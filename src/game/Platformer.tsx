import { useEffect, useRef, useState } from "react";
import { initAudio, playSfx, playMusic, stopMusic } from "./audio";

type Screen = "menu" | "levels" | "game" | "win" | "lose";

type Tile = 0 | 1 | 2 | 3 | 4 | 5; // 0 empty, 1 grass, 2 ice, 3 lava, 4 stone, 5 mystery
type LevelDef = { world: string; name: string; bg: string; sky: [string, string]; tiles: string[]; snow?: boolean; ember?: boolean };

// Legend: . empty  G grass  I ice  L lava  S stone  ? mystery  C coin  E enemy  P player  F flag
const L = (rows: string[]) => rows;
const WORLDS: { name: string; theme: string; levels: LevelDef[] }[] = [
  { name: "PRAIRIE", theme: "grass", levels: [
    { world: "PRAIRIE", name: "1-1", bg: "grass", sky: ["#7ec8e0", "#c3e8f0"], tiles: L([
      "........................................",
      "........................................",
      "........................................",
      "..............C.........................",
      ".........?..............C.......C.......",
      "........................................",
      ".....C.......GGG.............?..........",
      ".................E.....C.....GGG........",
      "..P........................E............F.",
      "GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG",
      "GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG",
    ])},
    { world: "PRAIRIE", name: "1-2", bg: "grass", sky: ["#7ec8e0", "#c3e8f0"], tiles: L([
      "........................................",
      "..........C.....C.......................",
      ".........GGG...GGG......C.....?.........",
      ".................GGG..GGGGG.............",
      "......C........E.......................C",
      "....GGG..............E...........GGGGGGG",
      "..P.................................E...F",
      "GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG",
      "GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG",
    ])},
  ]},
  { name: "GLACIER", theme: "ice", levels: [
    { world: "GLACIER", name: "2-1", bg: "ice", sky: ["#a8dced", "#e8f4fa"], snow: true, tiles: L([
      "........................................",
      "........C.......C.......C..............",
      "......III......III.....III...?..........",
      "....................................C...",
      "...............E............IIIIIIIIIIII",
      ".........III...................E........",
      "..P..........................E..........F",
      "IIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIII",
      "IIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIII",
    ])},
  ]},
  { name: "VOLCAN", theme: "lava", levels: [
    { world: "VOLCAN", name: "3-1", bg: "lava", sky: ["#3a1010", "#7a2010"], ember: true, tiles: L([
      "........................................",
      "......?.........C..........C............",
      "....SSSS......SSSS........SSSS...?......",
      "....................C.................C.",
      ".........E................E.......SSSSSS",
      "....SSS.......SSS........................",
      "..P.....LLL.........LLL........LLL.......F",
      "SSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSS",
      "SSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSS",
    ])},
  ]},
];

const TILE = 40;

type Entity = { x: number; y: number; vx: number; vy: number; alive: boolean };
type Enemy = Entity & { kind: "penguin" | "monster"; dir: number };
type Coin = { x: number; y: number; collected: boolean; phase: number };
type Mystery = { x: number; y: number; hit: boolean; bounce: number };
type Part = { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; kind: "snow" | "ember" | "smoke" | "spark" };

export default function Platformer({ onExit }: { onExit: () => void }) {
  const [screen, setScreen] = useState<Screen>("menu");
  const [worldIdx, setWorldIdx] = useState(0);
  const [levelIdx, setLevelIdx] = useState(0);
  const [lives, setLives] = useState(3);
  const [score, setScore] = useState(0);
  const [time, setTime] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef<{ lives: number; score: number; time: number }>({ lives, score, time });
  stateRef.current = { lives, score, time };

  useEffect(() => { if (screen === "menu") playMusic("menu"); return () => stopMusic(); }, [screen]);

  useEffect(() => {
    if (screen !== "game") return;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    let W = 0, H = 0;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = window.innerWidth; H = window.innerHeight;
      canvas.width = W * dpr; canvas.height = H * dpr;
      canvas.style.width = W + "px"; canvas.style.height = H + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const level = WORLDS[worldIdx].levels[levelIdx];
    const rows = level.tiles;
    const cols = Math.max(...rows.map((r) => r.length));
    const map: Tile[][] = rows.map((r) => Array.from({ length: cols }, (_, x) => {
      const c = r[x] || ".";
      if (c === "G") return 1;
      if (c === "I") return 2;
      if (c === "L") return 3;
      if (c === "S") return 4;
      if (c === "?") return 5;
      return 0;
    }));

    let player: Entity & { onGround: boolean; facing: number; runFrame: number } = { x: 0, y: 0, vx: 0, vy: 0, alive: true, onGround: false, facing: 1, runFrame: 0 };
    let flagX = 0, flagY = 0;
    const enemies: Enemy[] = [];
    const coins: Coin[] = [];
    const mystery: Mystery[] = [];
    for (let y = 0; y < rows.length; y++) {
      for (let x = 0; x < cols; x++) {
        const c = (rows[y] || "")[x];
        const px = x * TILE, py = y * TILE;
        if (c === "P") { player.x = px; player.y = py; }
        else if (c === "F") { flagX = px; flagY = py; }
        else if (c === "C") coins.push({ x: px + 12, y: py + 12, collected: false, phase: Math.random() * Math.PI * 2 });
        else if (c === "E") enemies.push({ x: px, y: py, vx: -1, vy: 0, alive: true, kind: level.bg === "ice" ? "penguin" : "monster", dir: -1 });
      }
    }
    for (let y = 0; y < rows.length; y++) for (let x = 0; x < cols; x++) if (map[y][x] === 5) mystery.push({ x: x * TILE, y: y * TILE, hit: false, bounce: 0 });

    const camera = { x: 0, y: 0 };
    const parts: Part[] = [];
    const keys = new Set<string>();
    const kd = (e: KeyboardEvent) => { keys.add(e.key.toLowerCase()); if (e.key === " " || e.key.startsWith("Arrow")) e.preventDefault(); };
    const ku = (e: KeyboardEvent) => keys.delete(e.key.toLowerCase());
    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);

    const startTime = performance.now();
    let raf = 0;
    let last = startTime;
    let ended = false;

    const tileAt = (x: number, y: number): Tile => {
      const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
      if (ty < 0 || ty >= map.length || tx < 0 || tx >= cols) return 0;
      return map[ty][tx];
    };
    const solid = (t: Tile) => t === 1 || t === 2 || t === 4 || t === 5;

    const respawn = () => {
      const newLives = stateRef.current.lives - 1;
      setLives(newLives);
      if (newLives <= 0) { ended = true; setScreen("lose"); stopMusic(); playSfx("defeat"); return; }
      // find player start
      for (let y = 0; y < rows.length; y++) for (let x = 0; x < cols; x++) if ((rows[y] || "")[x] === "P") { player.x = x * TILE; player.y = y * TILE; }
      player.vx = 0; player.vy = 0;
      playSfx("hit");
    };

    const step = (now: number) => {
      if (ended) return;
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      setTime(+((now - startTime) / 1000).toFixed(1));

      // input
      const left = keys.has("q") || keys.has("arrowleft") || keys.has("a");
      const right = keys.has("d") || keys.has("arrowright");
      const jump = keys.has(" ") || keys.has("z") || keys.has("arrowup") || keys.has("w");
      const iceFactor = tileAt(player.x + 10, player.y + 45) === 2 ? 0.5 : 1;
      const accel = 0.6 * iceFactor;
      if (left) player.vx -= accel;
      if (right) player.vx += accel;
      if (!left && !right) player.vx *= iceFactor === 0.5 ? 0.99 : 0.82;
      player.vx = Math.max(-5, Math.min(5, player.vx));
      if (jump && player.onGround) { player.vy = -12; player.onGround = false; playSfx("click"); }
      player.vy += 0.55; if (player.vy > 15) player.vy = 15;

      // horizontal
      player.x += player.vx;
      collide(player, "x");
      player.y += player.vy;
      player.onGround = false;
      collide(player, "y");

      if (player.vx > 0.1) player.facing = 1;
      else if (player.vx < -0.1) player.facing = -1;
      if (player.onGround && Math.abs(player.vx) > 0.5) player.runFrame += Math.abs(player.vx) * 0.15;

      // enemies
      for (const e of enemies) {
        if (!e.alive) continue;
        e.vx = e.dir * 1.2;
        e.vy += 0.55; if (e.vy > 15) e.vy = 15;
        e.x += e.vx;
        // wall check
        if (solid(tileAt(e.x + (e.dir > 0 ? 32 : 0), e.y + 20))) { e.dir *= -1; e.x += e.dir * 2; }
        // ledge check
        if (!solid(tileAt(e.x + (e.dir > 0 ? 32 : 0), e.y + 42))) e.dir *= -1;
        e.y += e.vy;
        // ground
        if (solid(tileAt(e.x + 16, e.y + 32))) { e.y = Math.floor((e.y + 32) / TILE) * TILE - 32; e.vy = 0; }
        // collision player
        if (rectHit(player.x, player.y, 28, 40, e.x, e.y, 32, 32)) {
          if (player.vy > 2 && player.y + 40 < e.y + 20) {
            e.alive = false;
            player.vy = -8;
            setScore((s) => s + 100);
            playSfx("hit");
            burst(e.x + 16, e.y + 16, "#fff", 15);
          } else {
            respawn(); return;
          }
        }
      }

      // coins
      for (const c of coins) {
        if (c.collected) continue;
        c.phase += 0.1;
        if (rectHit(player.x, player.y, 28, 40, c.x - 8, c.y - 8, 16, 16)) {
          c.collected = true;
          setScore((s) => s + 50);
          playSfx("click");
          burst(c.x, c.y, "#ffd040", 10);
        }
      }

      // mystery
      for (const m of mystery) {
        m.bounce *= 0.85;
        if (m.hit) continue;
        if (rectHit(player.x, player.y, 28, 40, m.x, m.y, TILE, TILE) && player.vy < 0 && player.y > m.y) {
          m.hit = true; m.bounce = -6;
          setScore((s) => s + 200);
          playSfx("hit");
          for (let i = 0; i < 8; i++) parts.push({ x: m.x + 20, y: m.y, vx: (Math.random() - 0.5) * 3, vy: -3 - Math.random() * 3, life: 40, max: 40, color: "#ffd040", kind: "spark" });
        }
      }

      // lava death
      if (tileAt(player.x + 14, player.y + 40) === 3) { respawn(); return; }
      // fall off
      if (player.y > map.length * TILE + 200) { respawn(); return; }

      // flag
      if (rectHit(player.x, player.y, 28, 40, flagX, flagY - 40, 20, 80)) {
        ended = true;
        setScore((s) => s + Math.max(0, 1000 - Math.floor(stateRef.current.time * 10)));
        setScreen("win"); stopMusic(); playSfx("victory");
      }

      // camera
      camera.x = Math.max(0, Math.min(cols * TILE - W, player.x - W / 2));
      camera.y = Math.max(0, Math.min(map.length * TILE - H, player.y - H / 2));

      // ambient particles
      if (level.snow && Math.random() < 0.6) parts.push({ x: camera.x + Math.random() * W, y: camera.y - 20, vx: -0.3, vy: 1 + Math.random(), life: 300, max: 300, color: "#fff", kind: "snow" });
      if (level.ember && Math.random() < 0.5) parts.push({ x: camera.x + Math.random() * W, y: camera.y + H, vx: (Math.random() - 0.5) * 0.5, vy: -1 - Math.random() * 2, life: 120, max: 120, color: "#ff8020", kind: "ember" });
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.x += p.vx; p.y += p.vy; p.life--;
        if (p.kind === "spark") p.vy += 0.3;
        if (p.life <= 0) parts.splice(i, 1);
      }

      render();
      raf = requestAnimationFrame(step);
    };

    function collide(o: Entity, axis: "x" | "y") {
      const w = 28, h = 40;
      const points = [
        { x: o.x, y: o.y }, { x: o.x + w, y: o.y },
        { x: o.x, y: o.y + h / 2 }, { x: o.x + w, y: o.y + h / 2 },
        { x: o.x, y: o.y + h }, { x: o.x + w, y: o.y + h },
      ];
      for (const p of points) {
        const t = tileAt(p.x, p.y);
        if (solid(t)) {
          const tx = Math.floor(p.x / TILE) * TILE;
          const ty = Math.floor(p.y / TILE) * TILE;
          if (axis === "x") {
            if (o.vx > 0) o.x = tx - w - 0.01;
            else if (o.vx < 0) o.x = tx + TILE + 0.01;
            o.vx = 0;
          } else {
            if (o.vy > 0) { o.y = ty - h - 0.01; (o as any).onGround = true; o.vy = 0; }
            else if (o.vy < 0) { o.y = ty + TILE + 0.01; o.vy = 0; }
          }
        }
      }
    }

    function burst(x: number, y: number, color: string, n: number) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, s = 1 + Math.random() * 3;
        parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 1, life: 30, max: 30, color, kind: "spark" });
      }
    }

    function rectHit(ax: number, ay: number, aw: number, ah: number, bx: number, by: number, bw: number, bh: number) {
      return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
    }

    function render() {
      // sky gradient
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, level.sky[0]); sky.addColorStop(1, level.sky[1]);
      ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
      // parallax hills
      ctx.fillStyle = level.bg === "lava" ? "#4a1010" : level.bg === "ice" ? "#6a9dc0" : "#5a8a3a";
      ctx.globalAlpha = 0.4;
      for (let i = 0; i < 6; i++) {
        const hx = ((i * 300 - camera.x * 0.3) % (W + 400)) - 200;
        ctx.beginPath(); ctx.arc(hx, H - 100, 180, 0, Math.PI, true); ctx.fill();
      }
      ctx.globalAlpha = 1;

      ctx.save();
      ctx.translate(-camera.x, -camera.y);

      // tiles
      const x0 = Math.max(0, Math.floor(camera.x / TILE) - 1);
      const x1 = Math.min(cols, Math.ceil((camera.x + W) / TILE) + 1);
      const y0 = Math.max(0, Math.floor(camera.y / TILE) - 1);
      const y1 = Math.min(map.length, Math.ceil((camera.y + H) / TILE) + 1);
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
        const t = map[y][x];
        if (t === 0) continue;
        drawTile(x * TILE, y * TILE, t);
      }
      // mystery bounce
      for (const m of mystery) {
        if (Math.abs(m.bounce) < 0.1 && !m.hit) continue;
        drawTile(m.x, m.y + m.bounce, m.hit ? 4 : 5);
      }

      // coins
      for (const c of coins) if (!c.collected) {
        const bob = Math.sin(c.phase) * 3;
        ctx.save(); ctx.translate(c.x, c.y + bob);
        ctx.shadowColor = "#ffd040"; ctx.shadowBlur = 10;
        ctx.fillStyle = "#ffd040"; ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#c09020"; ctx.fillRect(-2, -6, 4, 12);
        ctx.restore();
      }

      // enemies
      for (const e of enemies) if (e.alive) drawEnemy(e);

      // flag
      ctx.fillStyle = "#333"; ctx.fillRect(flagX, flagY - 40, 3, 80);
      ctx.fillStyle = "#e04040"; ctx.beginPath();
      ctx.moveTo(flagX + 3, flagY - 40); ctx.lineTo(flagX + 25, flagY - 30); ctx.lineTo(flagX + 3, flagY - 20); ctx.fill();

      // player
      drawPlayer();

      // particles
      for (const p of parts) {
        const a = p.life / p.max;
        ctx.save(); ctx.globalAlpha = a;
        if (p.kind === "snow") { ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(p.x, p.y, 2, 0, Math.PI * 2); ctx.fill(); }
        else if (p.kind === "ember") { ctx.shadowColor = p.color; ctx.shadowBlur = 8; ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, 3, 3); }
        else { ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, 3, 3); }
        ctx.restore();
      }

      ctx.restore();

      // HUD
      ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fillRect(0, 0, W, 44);
      ctx.fillStyle = "#fff"; ctx.font = "bold 16px monospace"; ctx.textAlign = "left";
      ctx.fillText(`♥ ${stateRef.current.lives}`, 20, 28);
      ctx.fillText(`SCORE ${stateRef.current.score}`, 120, 28);
      ctx.fillText(`⏱ ${stateRef.current.time.toFixed(1)}s`, 300, 28);
      ctx.textAlign = "right";
      ctx.fillText(`${level.world} · ${level.name}`, W - 20, 28);
    }

    function drawTile(x: number, y: number, t: Tile) {
      if (t === 1) { // grass
        ctx.fillStyle = "#5a3a1a"; ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = "#4a8a2a"; ctx.fillRect(x, y, TILE, 10);
        ctx.fillStyle = "#6aaa3a"; ctx.fillRect(x, y, TILE, 4);
      } else if (t === 2) { // ice
        const g = ctx.createLinearGradient(x, y, x, y + TILE);
        g.addColorStop(0, "#e8f8ff"); g.addColorStop(1, "#a8d8ee");
        ctx.fillStyle = g; ctx.fillRect(x, y, TILE, TILE);
        ctx.strokeStyle = "#88b8ce"; ctx.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
      } else if (t === 3) { // lava
        const g = ctx.createLinearGradient(x, y, x, y + TILE);
        g.addColorStop(0, "#ffcc20"); g.addColorStop(0.5, "#ff6020"); g.addColorStop(1, "#a02010");
        ctx.fillStyle = g; ctx.fillRect(x, y, TILE, TILE);
      } else if (t === 4) { // stone
        ctx.fillStyle = "#5a5a5a"; ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = "#7a7a7a"; ctx.fillRect(x + 2, y + 2, TILE - 4, 4);
        ctx.strokeStyle = "#3a3a3a"; ctx.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
      } else if (t === 5) { // mystery
        const g = ctx.createLinearGradient(x, y, x, y + TILE);
        g.addColorStop(0, "#ffd040"); g.addColorStop(1, "#c07020");
        ctx.fillStyle = g; ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = "#fff"; ctx.font = "bold 24px monospace"; ctx.textAlign = "center";
        ctx.fillText("?", x + TILE / 2, y + TILE / 2 + 8);
      }
    }

    function drawPlayer() {
      const p = player;
      const bob = p.onGround && Math.abs(p.vx) > 0.3 ? Math.sin(p.runFrame) * 2 : 0;
      ctx.save();
      ctx.translate(p.x + 14, p.y + 20 + bob);
      ctx.scale(p.facing, 1);
      // shadow
      ctx.fillStyle = "rgba(0,0,0,0.3)"; ctx.beginPath(); ctx.ellipse(0, 22 - bob, 14, 4, 0, 0, Math.PI * 2); ctx.fill();
      // body
      ctx.fillStyle = "#e04030"; roundR(-12, -18, 24, 26, 4); ctx.fill();
      // belly
      ctx.fillStyle = "#f0c080"; ctx.fillRect(-8, -4, 16, 10);
      // head
      ctx.fillStyle = "#f0c080"; ctx.beginPath(); ctx.arc(0, -20, 10, 0, Math.PI * 2); ctx.fill();
      // hat
      ctx.fillStyle = "#e04030"; ctx.fillRect(-11, -30, 22, 6);
      ctx.beginPath(); ctx.arc(0, -28, 10, Math.PI, 0, false); ctx.fill();
      // eyes
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(3, -20, 3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#000"; ctx.beginPath(); ctx.arc(4, -20, 1.5, 0, Math.PI * 2); ctx.fill();
      // legs
      const swing = p.onGround ? Math.sin(p.runFrame) * 6 : (p.vy < 0 ? -4 : 4);
      ctx.fillStyle = "#2a2a4a";
      ctx.fillRect(-8, 6, 6, 12 + swing);
      ctx.fillRect(2, 6, 6, 12 - swing);
      ctx.fillStyle = "#3a2010";
      ctx.fillRect(-9, 16 + swing, 8, 4);
      ctx.fillRect(1, 16 - swing, 8, 4);
      ctx.restore();
    }

    function drawEnemy(e: Enemy) {
      ctx.save(); ctx.translate(e.x + 16, e.y + 16);
      ctx.fillStyle = "rgba(0,0,0,0.3)"; ctx.beginPath(); ctx.ellipse(0, 18, 14, 3, 0, 0, Math.PI * 2); ctx.fill();
      if (e.kind === "penguin") {
        ctx.fillStyle = "#1a1a2a"; ctx.beginPath(); ctx.ellipse(0, 0, 14, 16, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.ellipse(0, 2, 8, 12, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#ffa020"; ctx.beginPath(); ctx.moveTo(-3 * e.dir, 0); ctx.lineTo(5 * e.dir, -2); ctx.lineTo(-3 * e.dir, -4); ctx.fill();
        ctx.fillStyle = "#000"; ctx.beginPath(); ctx.arc(2 * e.dir, -6, 2, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.fillStyle = "#7a2ac0"; roundR(-14, -14, 28, 28, 6); ctx.fill();
        ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(-5, -3, 4, 0, Math.PI * 2); ctx.arc(5, -3, 4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#000"; ctx.beginPath(); ctx.arc(-5 + e.dir, -3, 2, 0, Math.PI * 2); ctx.arc(5 + e.dir, -3, 2, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-8, 6); ctx.lineTo(-5, 3); ctx.lineTo(-2, 6); ctx.lineTo(2, 3); ctx.lineTo(5, 6); ctx.lineTo(8, 3); ctx.stroke();
      }
      ctx.restore();
    }

    function roundR(x: number, y: number, w: number, h: number, r: number) {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    }

    playMusic("battle");
    raf = requestAnimationFrame(step);
    return () => {
      ended = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("keydown", kd);
      window.removeEventListener("keyup", ku);
    };
  }, [screen, worldIdx, levelIdx]);

  const startLevel = (w: number, l: number) => {
    initAudio();
    setWorldIdx(w); setLevelIdx(l);
    setLives(3); setScore(0); setTime(0);
    setScreen("game");
  };

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#0a0e1a] text-white font-mono select-none">
      {screen === "menu" && (
        <div className="min-h-screen flex flex-col items-center justify-center gap-8"
          style={{ background: "linear-gradient(180deg,#1a2a5a 0%,#4a6ac0 50%,#5a8a3a 100%)" }}>
          <div className="text-center">
            <h1 className="text-7xl md:text-9xl font-black tracking-widest" style={{ textShadow: "0 6px 0 #000, 0 0 40px #ffd040" }}>SKY DASH</h1>
            <div className="text-sm tracking-[0.5em] opacity-70 mt-2">// PLATFORM ADVENTURE</div>
          </div>
          <div className="flex flex-col gap-3 w-72">
            <button onClick={() => { initAudio(); playSfx("click"); startLevel(0, 0); }}
              className="px-6 py-4 bg-[#e04030] hover:bg-[#f05040] border-4 border-[#000] font-black tracking-widest shadow-[0_6px_0_#000] hover:translate-y-1 hover:shadow-[0_2px_0_#000] transition-all">▶  JOUER</button>
            <button onClick={() => { initAudio(); playSfx("click"); setScreen("levels"); }}
              className="px-6 py-4 bg-[#ffd040] text-black hover:bg-[#ffe060] border-4 border-[#000] font-black tracking-widest shadow-[0_6px_0_#000] hover:translate-y-1 hover:shadow-[0_2px_0_#000] transition-all">🗺  NIVEAUX</button>
            <button onClick={() => { initAudio(); playSfx("click"); onExit(); }}
              className="px-6 py-4 bg-[#2a3040] hover:bg-[#3a4050] border-4 border-[#000] font-black tracking-widest shadow-[0_6px_0_#000] hover:translate-y-1 hover:shadow-[0_2px_0_#000] transition-all">🔄  CHANGER DE JEU</button>
          </div>
        </div>
      )}

      {screen === "levels" && (
        <div className="min-h-screen p-8" style={{ background: "linear-gradient(180deg,#1a2a5a,#4a6ac0)" }}>
          <div className="flex justify-between max-w-5xl mx-auto mb-8">
            <button onClick={() => { playSfx("click"); setScreen("menu"); }} className="px-4 py-2 border-2 border-white/50 hover:border-white">← MENU</button>
            <h2 className="text-4xl font-black tracking-widest">NIVEAUX</h2>
            <div className="w-24" />
          </div>
          <div className="max-w-5xl mx-auto space-y-6">
            {WORLDS.map((w, wi) => (
              <div key={w.name}>
                <div className="text-2xl font-black tracking-widest mb-3 text-[#ffd040]">MONDE {wi + 1} · {w.name}</div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {w.levels.map((lv, li) => (
                    <button key={lv.name} onClick={() => { playSfx("click"); startLevel(wi, li); }}
                      className="aspect-video border-4 border-black shadow-[0_4px_0_#000] hover:translate-y-1 hover:shadow-[0_2px_0_#000] transition-all relative overflow-hidden"
                      style={{ background: `linear-gradient(180deg,${lv.sky[0]},${lv.sky[1]})` }}>
                      <div className="absolute inset-x-0 bottom-0 h-1/3" style={{ background: lv.bg === "ice" ? "#a8d8ee" : lv.bg === "lava" ? "#7a2010" : "#5a8a3a" }} />
                      <div className="absolute inset-x-0 bottom-0 p-2 text-left font-black tracking-widest text-white" style={{ textShadow: "1px 1px 0 #000" }}>{lv.name}</div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {screen === "game" && <canvas ref={canvasRef} className="block w-full h-full" />}

      {(screen === "win" || screen === "lose") && (
        <div className="min-h-screen flex flex-col items-center justify-center gap-6"
          style={{ background: screen === "win" ? "linear-gradient(180deg,#1a2a5a,#4a8ac0)" : "linear-gradient(180deg,#2a0a0a,#5a1010)" }}>
          <div className="text-8xl font-black tracking-widest" style={{ textShadow: "0 6px 0 #000" }}>
            {screen === "win" ? "VICTOIRE !" : "GAME OVER"}
          </div>
          <div className="text-2xl">SCORE {score} · TEMPS {time.toFixed(1)}s</div>
          <div className="flex gap-4">
            <button onClick={() => startLevel(worldIdx, levelIdx)} className="px-8 py-3 bg-[#e04030] border-4 border-black shadow-[0_6px_0_#000] font-black tracking-widest">REJOUER</button>
            <button onClick={() => setScreen("menu")} className="px-8 py-3 bg-[#ffd040] text-black border-4 border-black shadow-[0_6px_0_#000] font-black tracking-widest">MENU</button>
          </div>
        </div>
      )}
    </div>
  );
}
