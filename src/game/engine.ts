import type { MapDef } from "./maps";
import type { TankModel } from "./tanks";
import type { BulletType } from "./bullets";
import { playSfx } from "./audio";

export type GameConfig = {
  map: MapDef;
  tankModel: TankModel;
  bulletType: BulletType;
  primary: string;
  secondary: string;
  tankName: string;
  cannonSize: number;
  tankSize: number;
  onVictory: (stats: { time: number; score: number }) => void;
  onDefeat: (stats: { time: number; score: number }) => void;
};

export type GameHandle = { destroy: () => void };

const WORLD_W = 2400;
const WORLD_H = 1800;

type Vec = { x: number; y: number };
type Obstacle = { x: number; y: number; w: number; h: number; kind: "concrete" | "rock" | "wall" };
type Decor = { x: number; y: number; type: string; color: string; size: number; rot: number };
type Bullet = { x: number; y: number; vx: number; vy: number; life: number; owner: "player" | "ai"; damage: number; type: BulletType };
type Particle = { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; size: number; color: string; kind: "smoke" | "fire" | "spark" | "dust" | "debris" };

type Tank = {
  x: number; y: number; angle: number; turretAngle: number;
  vx: number; vy: number;
  hp: number; maxHp: number;
  lastShot: number;
  trackOffset: number;
  model: TankModel;
  primary: string; secondary: string;
  name: string;
  scale: number;
  cannonScale: number;
  isAI: boolean;
};

export function createGame(canvas: HTMLCanvasElement, cfg: GameConfig): GameHandle {
  const ctx = canvas.getContext("2d")!;
  let width = 0, height = 0;
  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth; height = window.innerHeight;
    canvas.width = width * dpr; canvas.height = height * dpr;
    canvas.style.width = width + "px"; canvas.style.height = height + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resize();
  window.addEventListener("resize", resize);

  // World gen
  const obstacles: Obstacle[] = [];
  const decor: Decor[] = [];
  const rng = mulberry32(hashStr(cfg.map.id));
  // border walls
  const B = 60;
  obstacles.push({ x: 0, y: 0, w: WORLD_W, h: B, kind: "wall" });
  obstacles.push({ x: 0, y: WORLD_H - B, w: WORLD_W, h: B, kind: "wall" });
  obstacles.push({ x: 0, y: 0, w: B, h: WORLD_H, kind: "wall" });
  obstacles.push({ x: WORLD_W - B, y: 0, w: B, h: WORLD_H, kind: "wall" });
  // concrete blocks with cross
  for (let i = 0; i < 24; i++) {
    const s = 80;
    obstacles.push({ x: 200 + rng() * (WORLD_W - 400 - s), y: 200 + rng() * (WORLD_H - 400 - s), w: s, h: s, kind: "concrete" });
  }
  // rocks
  for (let i = 0; i < 18; i++) {
    const s = 40 + rng() * 40;
    obstacles.push({ x: 200 + rng() * (WORLD_W - 400 - s), y: 200 + rng() * (WORLD_H - 400 - s), w: s, h: s, kind: "rock" });
  }
  // decor (non-blocking)
  for (let i = 0; i < 250; i++) {
    const d = cfg.map.decor[Math.floor(rng() * cfg.map.decor.length)];
    decor.push({ x: rng() * WORLD_W, y: rng() * WORLD_H, type: d.type, color: d.color || "#222", size: 4 + rng() * 12, rot: rng() * Math.PI * 2 });
  }

  // ground tile cache
  const groundTile = document.createElement("canvas");
  groundTile.width = 200; groundTile.height = 200;
  {
    const g = groundTile.getContext("2d")!;
    g.fillStyle = cfg.map.ground; g.fillRect(0, 0, 200, 200);
    for (let i = 0; i < 400; i++) {
      g.fillStyle = i % 2 ? cfg.map.groundAlt : cfg.map.detail;
      g.globalAlpha = 0.15 + Math.random() * 0.35;
      const x = Math.random() * 200, y = Math.random() * 200, s = 1 + Math.random() * 3;
      g.fillRect(x, y, s, s);
    }
    g.globalAlpha = 1;
  }
  const groundPattern = ctx.createPattern(groundTile, "repeat")!;

  // Player
  const player: Tank = spawnTank(false, 200, 200);
  const ai: Tank = spawnTank(true, WORLD_W - 250, WORLD_H - 250);

  function spawnTank(isAI: boolean, x: number, y: number): Tank {
    return {
      x, y, angle: 0, turretAngle: 0, vx: 0, vy: 0,
      hp: cfg.tankModel.hp, maxHp: cfg.tankModel.hp,
      lastShot: 0, trackOffset: 0,
      model: cfg.tankModel,
      primary: isAI ? "#6a2020" : cfg.primary,
      secondary: isAI ? "#3a1010" : cfg.secondary,
      name: isAI ? "ENEMY" : cfg.tankName,
      scale: cfg.tankSize * cfg.tankModel.scale,
      cannonScale: cfg.cannonSize,
      isAI,
    };
  }

  const bullets: Bullet[] = [];
  const particles: Particle[] = [];
  let shake = 0;
  const cam: Vec = { x: player.x, y: player.y };
  let ammo = 30;
  let score = 0;
  const start = performance.now();
  let last = start;
  let ended = false;
  let fps = 60;
  let fpsAcc = 0, fpsCount = 0, fpsTimer = 0;

  // Input
  const keys = new Set<string>();
  const kd = (e: KeyboardEvent) => { keys.add(e.key.toLowerCase()); if (e.key === " ") e.preventDefault(); };
  const ku = (e: KeyboardEvent) => keys.delete(e.key.toLowerCase());
  window.addEventListener("keydown", kd);
  window.addEventListener("keyup", ku);

  // AI state
  const aiState = { target: { x: 0, y: 0 }, mode: "hunt" as "hunt" | "flank" | "hide" | "flee", modeUntil: 0, lastSeen: 0, dodgeTimer: 0, dodgeDir: 1 };

  function collides(nx: number, ny: number, radius: number): Obstacle | null {
    for (const o of obstacles) {
      const cx = Math.max(o.x, Math.min(nx, o.x + o.w));
      const cy = Math.max(o.y, Math.min(ny, o.y + o.h));
      if ((nx - cx) ** 2 + (ny - cy) ** 2 < radius * radius) return o;
    }
    return null;
  }

  function lineOfSight(a: Vec, b: Vec): boolean {
    const steps = 40;
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t;
      for (const o of obstacles) if (o.kind !== "wall" && x > o.x && x < o.x + o.w && y > o.y && y < o.y + o.h) return false;
    }
    return true;
  }

  function fire(t: Tank, now: number) {
    if (now - t.lastShot < t.model.fireRate) return;
    t.lastShot = now;
    if (!t.isAI) { if (ammo <= 0) return; ammo--; }
    const rad = t.model.cannonLength * t.cannonScale * t.scale + 6;
    const bx = t.x + Math.cos(t.turretAngle) * rad;
    const by = t.y + Math.sin(t.turretAngle) * rad;
    const bt = cfg.bulletType;
    bullets.push({
      x: bx, y: by,
      vx: Math.cos(t.turretAngle) * bt.speed,
      vy: Math.sin(t.turretAngle) * bt.speed,
      life: 120, owner: t.isAI ? "ai" : "player", damage: bt.damage, type: bt,
    });
    // recoil
    t.vx -= Math.cos(t.turretAngle) * 0.8;
    t.vy -= Math.sin(t.turretAngle) * 0.8;
    // muzzle flash
    for (let i = 0; i < 12; i++) {
      const a = t.turretAngle + (Math.random() - 0.5) * 0.6;
      particles.push({ x: bx, y: by, vx: Math.cos(a) * (2 + Math.random() * 4), vy: Math.sin(a) * (2 + Math.random() * 4), life: 12, maxLife: 12, size: 6 + Math.random() * 6, color: "#ffcc60", kind: "fire" });
    }
    for (let i = 0; i < 8; i++) {
      particles.push({ x: bx, y: by, vx: (Math.random() - 0.5) * 2, vy: (Math.random() - 0.5) * 2, life: 30, maxLife: 30, size: 4, color: "#888", kind: "smoke" });
    }
    shake = Math.max(shake, t.isAI ? 3 : 6);
    if (!t.isAI) playSfx("shoot");
    else playSfx("shoot");
  }

  function explode(x: number, y: number, big: boolean) {
    const n = big ? 60 : 30;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = 1 + Math.random() * (big ? 6 : 4);
      particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 40, maxLife: 40, size: 4 + Math.random() * 8, color: Math.random() < 0.5 ? "#ff8020" : "#ffcc40", kind: "fire" });
    }
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = 0.5 + Math.random() * 2;
      particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 0.5, life: 80, maxLife: 80, size: 10 + Math.random() * 20, color: "#555", kind: "smoke" });
    }
    for (let i = 0; i < 15; i++) {
      const a = Math.random() * Math.PI * 2, s = 2 + Math.random() * 5;
      particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 60, maxLife: 60, size: 3, color: "#333", kind: "debris" });
    }
    shake = Math.max(shake, big ? 20 : 10);
    playSfx("explode");
  }

  function updateTank(t: Tank, forward: number, turn: number, dt: number) {
    t.angle += turn * t.model.turnSpeed * dt * 60;
    const acc = forward * t.model.speed * 0.15;
    t.vx += Math.cos(t.angle) * acc;
    t.vy += Math.sin(t.angle) * acc;
    t.vx *= 0.9; t.vy *= 0.9;
    const speed = Math.hypot(t.vx, t.vy);
    if (speed > t.model.speed) { t.vx = (t.vx / speed) * t.model.speed; t.vy = (t.vy / speed) * t.model.speed; }
    let nx = t.x + t.vx * dt * 60;
    let ny = t.y + t.vy * dt * 60;
    const r = 20 * t.scale;
    if (collides(nx, t.y, r)) { nx = t.x; t.vx = 0; }
    if (collides(t.x, ny, r)) { ny = t.y; t.vy = 0; }
    t.x = nx; t.y = ny;
    t.trackOffset += speed * 0.5;
    // dust from tracks
    if (speed > 0.5 && Math.random() < speed * 0.15) {
      const ba = t.angle + Math.PI;
      const bx = t.x + Math.cos(ba) * 18 * t.scale;
      const by = t.y + Math.sin(ba) * 18 * t.scale;
      particles.push({ x: bx + (Math.random() - 0.5) * 20, y: by + (Math.random() - 0.5) * 20, vx: (Math.random() - 0.5) * 0.5, vy: (Math.random() - 0.5) * 0.5, life: 40, maxLife: 40, size: 4 + Math.random() * 6, color: cfg.map.detail, kind: "dust" });
    }
  }

  function runAI(now: number, dt: number) {
    const dx = player.x - ai.x, dy = player.y - ai.y;
    const dist = Math.hypot(dx, dy);
    const sees = lineOfSight(ai, player);
    if (sees) aiState.lastSeen = now;

    // pick mode
    if (now > aiState.modeUntil) {
      if (ai.hp < ai.maxHp * 0.25) aiState.mode = "hide";
      else if (sees && dist < 500) aiState.mode = Math.random() < 0.3 ? "flank" : "hunt";
      else aiState.mode = "hunt";
      aiState.modeUntil = now + 1500 + Math.random() * 2000;
    }

    // target
    let tx = player.x, ty = player.y;
    if (aiState.mode === "flank") {
      const ang = Math.atan2(dy, dx) + Math.PI / 2 * aiState.dodgeDir;
      tx = player.x + Math.cos(ang) * 300;
      ty = player.y + Math.sin(ang) * 300;
    } else if (aiState.mode === "hide") {
      // move away
      tx = ai.x - dx; ty = ai.y - dy;
    }

    // dodge bullets
    let dodge = 0;
    for (const b of bullets) {
      if (b.owner !== "player") continue;
      const bdx = ai.x - b.x, bdy = ai.y - b.y;
      const d = Math.hypot(bdx, bdy);
      if (d < 200) {
        const dot = (bdx * b.vx + bdy * b.vy) / (d * Math.hypot(b.vx, b.vy));
        if (dot < -0.7) dodge = 1;
      }
    }

    const desired = Math.atan2(ty - ai.y, tx - ai.x);
    let da = desired - ai.angle;
    while (da > Math.PI) da -= Math.PI * 2;
    while (da < -Math.PI) da += Math.PI * 2;
    let turn = Math.sign(da) * Math.min(1, Math.abs(da) * 3);
    if (dodge) turn = aiState.dodgeDir;
    const forward = Math.abs(da) < 0.8 ? 1 : 0.3;
    updateTank(ai, forward, turn, dt);

    // aim turret with prediction
    const pspeed = Math.hypot(player.vx, player.vy);
    const btSpeed = cfg.bulletType.speed;
    const eta = dist / btSpeed;
    const px = player.x + player.vx * eta * 0.9;
    const py = player.y + player.vy * eta * 0.9;
    const aimA = Math.atan2(py - ai.y, px - ai.x);
    let ta = aimA - ai.turretAngle;
    while (ta > Math.PI) ta -= Math.PI * 2;
    while (ta < -Math.PI) ta += Math.PI * 2;
    ai.turretAngle += ta * 0.12;

    if (sees && dist < 700 && Math.abs(ta) < 0.15) fire(ai, now);
    if (Math.random() < 0.005) aiState.dodgeDir *= -1;
    void pspeed;
  }

  function step(now: number) {
    if (ended) return;
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;
    fpsAcc += 1 / Math.max(0.001, dt); fpsCount++;
    fpsTimer += dt; if (fpsTimer > 0.5) { fps = fpsAcc / fpsCount; fpsAcc = 0; fpsCount = 0; fpsTimer = 0; }

    // player input
    const fw = (keys.has("z") || keys.has("arrowup") ? 1 : 0) - (keys.has("s") || keys.has("arrowdown") ? 1 : 0);
    const tr = (keys.has("d") || keys.has("arrowright") ? 1 : 0) - (keys.has("q") || keys.has("arrowleft") ? 1 : 0);
    updateTank(player, fw, tr, dt);
    // turret follows body smoothly with slight lead
    let ta = player.angle - player.turretAngle;
    while (ta > Math.PI) ta -= Math.PI * 2;
    while (ta < -Math.PI) ta += Math.PI * 2;
    player.turretAngle += ta * 0.15;
    if (keys.has(" ")) fire(player, now);

    runAI(now, dt);

    // bullets
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      b.x += b.vx; b.y += b.vy; b.life--;
      // trail
      if (b.type.trail !== "none") {
        const col = b.type.trailColor;
        particles.push({ x: b.x, y: b.y, vx: 0, vy: 0, life: b.type.trail === "smoke" ? 25 : 15, maxLife: 25, size: b.type.trail === "laser" ? 2 : 4, color: col, kind: b.type.trail === "fire" ? "fire" : "smoke" });
      }
      let hit = false;
      // hit tanks
      const targets: Tank[] = b.owner === "player" ? [ai] : [player];
      for (const tg of targets) {
        if (Math.hypot(tg.x - b.x, tg.y - b.y) < 22 * tg.scale) {
          tg.hp -= b.damage;
          explode(b.x, b.y, false);
          playSfx("hit");
          if (tg.hp <= 0) {
            explode(tg.x, tg.y, true);
            ended = true;
            const timeSec = (now - start) / 1000;
            setTimeout(() => {
              if (tg.isAI) { score = Math.max(0, 1000 - Math.floor(timeSec * 5)); cfg.onVictory({ time: timeSec, score }); }
              else cfg.onDefeat({ time: timeSec, score: Math.floor(timeSec) });
            }, 600);
          }
          hit = true;
          break;
        }
      }
      if (!hit) {
        const o = collides(b.x, b.y, 3);
        if (o) { explode(b.x, b.y, false); hit = true; }
      }
      if (hit || b.life <= 0 || b.x < 0 || b.y < 0 || b.x > WORLD_W || b.y > WORLD_H) bullets.splice(i, 1);
    }

    // particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx; p.y += p.vy;
      if (p.kind === "smoke") { p.vy -= 0.02; p.vx *= 0.98; p.vy *= 0.98; }
      else if (p.kind === "fire") { p.vx *= 0.92; p.vy *= 0.92; }
      else if (p.kind === "debris") { p.vy += 0.15; }
      p.life--;
      if (p.life <= 0) particles.splice(i, 1);
    }

    // camera
    cam.x += (player.x - cam.x) * 0.1;
    cam.y += (player.y - cam.y) * 0.1;
    shake *= 0.85;

    render();
    raf = requestAnimationFrame(step);
  }

  function render() {
    ctx.save();
    ctx.fillStyle = "#000"; ctx.fillRect(0, 0, width, height);
    const sx = (Math.random() - 0.5) * shake;
    const sy = (Math.random() - 0.5) * shake;
    const camX = cam.x - width / 2 + sx;
    const camY = cam.y - height / 2 + sy;
    ctx.translate(-camX, -camY);

    // ground
    ctx.fillStyle = groundPattern;
    ctx.fillRect(0, 0, WORLD_W, WORLD_H);

    // decor (below tanks)
    for (const d of decor) {
      if (d.x < camX - 50 || d.x > camX + width + 50 || d.y < camY - 50 || d.y > camY + height + 50) continue;
      drawDecor(d);
    }

    // obstacles
    for (const o of obstacles) {
      if (o.x + o.w < camX || o.x > camX + width || o.y + o.h < camY || o.y > camY + height) continue;
      drawObstacle(o);
    }

    // tanks
    drawTank(player);
    drawTank(ai);

    // bullets
    for (const b of bullets) drawBullet(b);

    // particles (top)
    for (const p of particles) drawParticle(p);

    ctx.restore();

    drawHUD();
  }

  function drawDecor(d: Decor) {
    ctx.save(); ctx.translate(d.x, d.y); ctx.rotate(d.rot);
    if (d.type === "tree") {
      ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.beginPath(); ctx.ellipse(2, 3, d.size + 4, d.size + 4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = d.color; ctx.beginPath(); ctx.arc(0, 0, d.size + 2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#3a2010"; ctx.fillRect(-2, -2, 4, 4);
    } else if (d.type === "bush") {
      ctx.fillStyle = d.color; ctx.beginPath(); ctx.arc(0, 0, d.size, 0, Math.PI * 2); ctx.arc(d.size * 0.6, 0, d.size * 0.7, 0, Math.PI * 2); ctx.fill();
    } else if (d.type === "flower") {
      ctx.fillStyle = d.color; ctx.beginPath(); ctx.arc(0, 0, 2, 0, Math.PI * 2); ctx.fill();
    } else if (d.type === "puddle") {
      ctx.fillStyle = d.color; ctx.globalAlpha = 0.7; ctx.beginPath(); ctx.ellipse(0, 0, d.size * 2, d.size, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
    } else if (d.type === "rock") {
      ctx.fillStyle = "rgba(0,0,0,0.4)"; ctx.beginPath(); ctx.arc(2, 3, d.size, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = d.color; ctx.beginPath(); ctx.arc(0, 0, d.size, 0, Math.PI * 2); ctx.fill();
    } else if (d.type === "sand") {
      ctx.fillStyle = d.color; ctx.globalAlpha = 0.4; ctx.beginPath(); ctx.ellipse(0, 0, d.size * 2, d.size, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  function drawObstacle(o: Obstacle) {
    // shadow
    ctx.fillStyle = "rgba(0,0,0,0.4)"; ctx.fillRect(o.x + 4, o.y + 6, o.w, o.h);
    if (o.kind === "concrete") {
      ctx.fillStyle = "#8a8578"; ctx.fillRect(o.x, o.y, o.w, o.h);
      ctx.fillStyle = "#6a6558"; ctx.fillRect(o.x, o.y + o.h - 6, o.w, 6);
      // cross
      ctx.strokeStyle = "#3a3528"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(o.x + 10, o.y + 10); ctx.lineTo(o.x + o.w - 10, o.y + o.h - 10);
      ctx.moveTo(o.x + o.w - 10, o.y + 10); ctx.lineTo(o.x + 10, o.y + o.h - 10); ctx.stroke();
      ctx.strokeStyle = "#4a4538"; ctx.lineWidth = 1; ctx.strokeRect(o.x + 0.5, o.y + 0.5, o.w - 1, o.h - 1);
    } else if (o.kind === "rock") {
      ctx.fillStyle = "#5a5550"; ctx.beginPath(); ctx.arc(o.x + o.w / 2, o.y + o.h / 2, o.w / 2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#7a7570"; ctx.beginPath(); ctx.arc(o.x + o.w / 2 - 3, o.y + o.h / 2 - 3, o.w / 3, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.fillStyle = cfg.map.obstacleColor; ctx.fillRect(o.x, o.y, o.w, o.h);
    }
  }

  function drawTank(t: Tank) {
    const s = t.scale;
    // shadow
    ctx.save();
    ctx.translate(t.x + 5, t.y + 8);
    ctx.rotate(t.angle);
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    roundRect(ctx, -22 * s, -16 * s, 44 * s, 32 * s, 3); ctx.fill();
    ctx.restore();

    // body
    ctx.save();
    ctx.translate(t.x, t.y);
    ctx.rotate(t.angle);
    // tracks
    ctx.fillStyle = "#151510";
    ctx.fillRect(-22 * s, -18 * s, 44 * s, 6 * s);
    ctx.fillRect(-22 * s, 12 * s, 44 * s, 6 * s);
    // track segments (rolling)
    ctx.fillStyle = "#0a0a08";
    for (let i = -3; i < 4; i++) {
      const off = (t.trackOffset % 8) - 8;
      ctx.fillRect(-22 * s + i * 8 + off, -18 * s, 3, 6 * s);
      ctx.fillRect(-22 * s + i * 8 + off, 12 * s, 3, 6 * s);
    }
    // hull
    const grad = ctx.createLinearGradient(0, -12 * s, 0, 12 * s);
    grad.addColorStop(0, lighten(t.primary, 15));
    grad.addColorStop(0.5, t.primary);
    grad.addColorStop(1, darken(t.primary, 20));
    ctx.fillStyle = grad;
    roundRect(ctx, -20 * s, -12 * s, 40 * s, 24 * s, 3); ctx.fill();
    // panel lines
    ctx.strokeStyle = darken(t.primary, 40); ctx.lineWidth = 1;
    ctx.strokeRect(-18 * s, -10 * s, 36 * s, 20 * s);
    // secondary trim
    ctx.fillStyle = t.secondary;
    ctx.fillRect(-20 * s, -12 * s, 3, 24 * s);
    ctx.fillRect(17 * s, -12 * s, 3, 24 * s);
    ctx.restore();

    // turret (independent rotation, but here follows body)
    ctx.save();
    ctx.translate(t.x, t.y);
    ctx.rotate(t.turretAngle);
    // cannon
    const cl = t.model.cannonLength * t.cannonScale * s;
    const cw = t.model.cannonWidth * s;
    ctx.fillStyle = darken(t.secondary, 20);
    ctx.fillRect(5 * s, -cw / 2, cl, cw);
    ctx.fillStyle = "#0a0a08"; ctx.fillRect(5 * s + cl - 3, -cw / 2 - 1, 3, cw + 2);
    // turret dome
    const tg = ctx.createRadialGradient(-2, -2, 2, 0, 0, 14 * s);
    tg.addColorStop(0, lighten(t.secondary, 30));
    tg.addColorStop(1, darken(t.secondary, 25));
    ctx.fillStyle = tg;
    ctx.beginPath(); ctx.arc(0, 0, 12 * s, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = darken(t.secondary, 45); ctx.lineWidth = 1; ctx.stroke();
    // hatch
    ctx.fillStyle = darken(t.secondary, 40); ctx.beginPath(); ctx.arc(-4 * s, 0, 3 * s, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    // name plate
    ctx.fillStyle = t.isAI ? "#ff4040" : "#40ff80";
    ctx.font = "bold 11px monospace"; ctx.textAlign = "center";
    ctx.fillText(t.name, t.x, t.y - 30 * s);
    // hp bar
    const bw = 40, bh = 4;
    ctx.fillStyle = "rgba(0,0,0,0.7)"; ctx.fillRect(t.x - bw / 2, t.y - 26 * s, bw, bh);
    ctx.fillStyle = t.hp > t.maxHp * 0.4 ? "#40ff80" : "#ff4040";
    ctx.fillRect(t.x - bw / 2, t.y - 26 * s, bw * (t.hp / t.maxHp), bh);
  }

  function drawBullet(b: Bullet) {
    const bt = b.type;
    ctx.save();
    ctx.shadowColor = bt.color; ctx.shadowBlur = bt.glow;
    ctx.fillStyle = bt.color;
    ctx.beginPath(); ctx.arc(b.x, b.y, bt.size, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function drawParticle(p: Particle) {
    const a = p.life / p.maxLife;
    ctx.save();
    if (p.kind === "smoke" || p.kind === "dust") {
      ctx.globalAlpha = a * 0.5;
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1.5 - a), 0, Math.PI * 2); ctx.fill();
    } else if (p.kind === "fire") {
      ctx.globalAlpha = a;
      ctx.shadowColor = p.color; ctx.shadowBlur = 12;
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size * a, 0, Math.PI * 2); ctx.fill();
    } else if (p.kind === "spark") {
      ctx.globalAlpha = a; ctx.fillStyle = "#fff"; ctx.fillRect(p.x, p.y, 2, 2);
    } else if (p.kind === "debris") {
      ctx.globalAlpha = a; ctx.fillStyle = p.color; ctx.fillRect(p.x - 1, p.y - 1, 3, 3);
    }
    ctx.restore();
  }

  function drawHUD() {
    // top: hp bars
    const bar = (x: number, y: number, w: number, val: number, label: string, col: string) => {
      ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fillRect(x, y, w, 22);
      ctx.strokeStyle = "#7a5a2a"; ctx.lineWidth = 2; ctx.strokeRect(x, y, w, 22);
      ctx.fillStyle = col; ctx.fillRect(x + 2, y + 2, (w - 4) * val, 18);
      ctx.fillStyle = "#fff"; ctx.font = "bold 11px monospace"; ctx.textAlign = "left"; ctx.fillText(label, x + 6, y + 15);
    };
    bar(20, 20, 300, player.hp / player.maxHp, `${cfg.tankName}  ${player.hp | 0}/${player.maxHp}`, "#40a060");
    bar(width - 320, 20, 300, ai.hp / ai.maxHp, `ENEMY  ${ai.hp | 0}/${ai.maxHp}`, "#a04040");

    // bottom stats
    ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fillRect(0, height - 70, width, 70);
    ctx.fillStyle = "#d4c9a8"; ctx.font = "bold 12px monospace"; ctx.textAlign = "left";
    ctx.fillText(`AMMO: ${ammo}`, 20, height - 44);
    ctx.fillText(`TANK: ${cfg.tankName}`, 20, height - 26);
    ctx.fillText(`MAP: ${cfg.map.name}`, 200, height - 44);
    ctx.fillText(`AMMO TYPE: ${cfg.bulletType.name}`, 200, height - 26);
    ctx.fillText(`FPS: ${fps.toFixed(0)}`, 400, height - 44);
    const t = (performance.now() - start) / 1000;
    ctx.fillText(`TIME: ${t.toFixed(1)}s`, 400, height - 26);

    // controls
    ctx.textAlign = "right";
    ctx.fillText("Z/S: AVANCER/RECULER  Q/D: TOURNER  ESPACE: TIRER", width - 20, height - 26);

    // radar
    const rs = 140;
    const rx = width - rs - 20, ry = height - rs - 90;
    ctx.fillStyle = "rgba(0,20,0,0.75)"; ctx.fillRect(rx, ry, rs, rs);
    ctx.strokeStyle = "#40ff80"; ctx.lineWidth = 2; ctx.strokeRect(rx, ry, rs, rs);
    const sx = rs / WORLD_W, sy = rs / WORLD_H;
    ctx.fillStyle = "#40ff80"; ctx.fillRect(rx + player.x * sx - 2, ry + player.y * sy - 2, 4, 4);
    ctx.fillStyle = "#ff4040"; ctx.fillRect(rx + ai.x * sx - 2, ry + ai.y * sy - 2, 4, 4);
    ctx.fillStyle = "rgba(255,255,255,0.2)";
    for (const o of obstacles) if (o.kind === "concrete") ctx.fillRect(rx + o.x * sx, ry + o.y * sy, Math.max(1, o.w * sx), Math.max(1, o.h * sy));
    ctx.fillStyle = "#40ff80"; ctx.font = "bold 10px monospace"; ctx.textAlign = "left"; ctx.fillText("RADAR", rx + 6, ry + 14);

    // ammo regen visualization
    if (ammo < 30 && Math.random() < 0.02) ammo++;
  }

  let raf = requestAnimationFrame(step);

  return {
    destroy() {
      ended = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", kd);
      window.removeEventListener("keyup", ku);
      window.removeEventListener("resize", resize);
    },
  };
}

// helpers
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
function hex(c: string) { const m = c.replace("#", ""); return [parseInt(m.slice(0, 2), 16), parseInt(m.slice(2, 4), 16), parseInt(m.slice(4, 6), 16)]; }
function toHex(r: number, g: number, b: number) { return "#" + [r, g, b].map((v) => Math.max(0, Math.min(255, v | 0)).toString(16).padStart(2, "0")).join(""); }
function lighten(c: string, n: number) { const [r, g, b] = hex(c); return toHex(r + n, g + n, b + n); }
function darken(c: string, n: number) { return lighten(c, -n); }
function hashStr(s: string) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h; }
function mulberry32(a: number) { return function () { let t = (a += 0x6D2B79F5); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
