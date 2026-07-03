import { useEffect, useRef, useState } from "react";
import { createGame, type GameConfig, type GameHandle } from "./engine";
import { MAPS } from "./maps";
import { TANK_MODELS } from "./tanks";
import { BULLET_TYPES } from "./bullets";
import { initAudio, playSfx, playMusic, stopMusic } from "./audio";

type Screen = "menu" | "maps" | "tanks" | "bullets" | "game" | "victory" | "defeat";

export default function BattleTanks({ onChangeGame }: { onChangeGame?: () => void }) {
  const [screen, setScreen] = useState<Screen>("menu");
  const [mapIdx, setMapIdx] = useState(0);
  const [tankIdx, setTankIdx] = useState(0);
  const [bulletIdx, setBulletIdx] = useState(0);
  const [primary, setPrimary] = useState("#3d5a2b");
  const [secondary, setSecondary] = useState("#2a3d1e");
  const [tankName, setTankName] = useState("PANZER-01");
  const [cannonSize, setCannonSize] = useState(1);
  const [tankSize, setTankSize] = useState(1);
  const [mode, setMode] = useState<"bot" | "2p">("bot");
  const [stats, setStats] = useState<{ time: number; score: number } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<GameHandle | null>(null);

  // Menu background canvas
  const bgRef = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    if (screen === "game") return;
    const c = bgRef.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    let raf = 0;
    const particles: { x: number; y: number; vx: number; vy: number; life: number; size: number }[] = [];
    const resize = () => { c.width = window.innerWidth; c.height = window.innerHeight; };
    resize();
    window.addEventListener("resize", resize);
    let t = 0;
    const loop = () => {
      t += 0.016;
      ctx.fillStyle = "#0a0e07";
      ctx.fillRect(0, 0, c.width, c.height);
      // dynamic light
      const g = ctx.createRadialGradient(c.width / 2 + Math.sin(t * 0.3) * 200, c.height / 2, 50, c.width / 2, c.height / 2, 800);
      g.addColorStop(0, "rgba(120,90,40,0.35)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, c.width, c.height);
      // tanks silhouettes
      for (let i = 0; i < 3; i++) {
        const x = ((t * 20 + i * 400) % (c.width + 200)) - 100;
        const y = c.height - 120 - i * 60;
        ctx.save();
        ctx.translate(x, y);
        ctx.fillStyle = `rgba(30,40,20,${0.4 - i * 0.1})`;
        ctx.fillRect(-40, -15, 80, 30);
        ctx.fillRect(-25, -25, 40, 15);
        ctx.fillRect(15, -8, 40, 4);
        ctx.restore();
      }
      // smoke particles
      if (Math.random() < 0.3) particles.push({ x: Math.random() * c.width, y: c.height, vx: (Math.random() - 0.5) * 0.5, vy: -0.5 - Math.random(), life: 1, size: 30 + Math.random() * 40 });
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx; p.y += p.vy; p.life -= 0.005;
        if (p.life <= 0) { particles.splice(i, 1); continue; }
        ctx.fillStyle = `rgba(80,80,80,${p.life * 0.15})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1.5 - p.life), 0, Math.PI * 2); ctx.fill();
      }
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, [screen]);

  // Start game
  useEffect(() => {
    if (screen !== "game") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const config: GameConfig = {
      map: MAPS[mapIdx],
      tankModel: TANK_MODELS[tankIdx],
      bulletType: BULLET_TYPES[bulletIdx],
      primary, secondary, tankName, cannonSize, tankSize,
      mode,
      primary2: "#2a4a8a", secondary2: "#152540", tankName2: "PLAYER-2",
      onVictory: (s) => { setStats(s); setScreen("victory"); stopMusic(); playSfx("victory"); },
      onDefeat: (s) => { setStats(s); setScreen("defeat"); stopMusic(); playSfx("defeat"); },
    };
    gameRef.current = createGame(canvas, config);
    playMusic("battle");
    return () => { gameRef.current?.destroy(); stopMusic(); };
  }, [screen, mapIdx, tankIdx, bulletIdx, primary, secondary, tankName, cannonSize, tankSize, mode]);

  const click = () => { initAudio(); playSfx("click"); };

  useEffect(() => { if (screen === "menu") playMusic("menu"); }, [screen]);

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#0a0e07] text-[#d4c9a8] font-mono select-none">
      <canvas ref={bgRef} className="absolute inset-0 w-full h-full pointer-events-none" style={{ display: screen === "game" ? "none" : "block" }} />

      {screen === "menu" && (
        <div className="relative z-10 flex flex-col items-center justify-center min-h-screen gap-8 animate-fade-in">
          <div className="text-center">
            <h1 className="text-7xl md:text-9xl font-black tracking-widest text-[#d4c9a8]" style={{ textShadow: "0 0 30px #7a5a2a, 4px 4px 0 #1a1a0a" }}>BATTLE</h1>
            <h1 className="text-7xl md:text-9xl font-black tracking-widest text-[#7a5a2a] -mt-4" style={{ textShadow: "0 0 20px #d4c9a8" }}>TANKS</h1>
            <div className="text-sm tracking-[0.5em] opacity-60 mt-2">// COMBAT SIMULATOR v1.0</div>
          </div>
          <div className="flex flex-col gap-3 w-72">
            {[
              { l: "▶  JOUER", a: () => { click(); setScreen("game"); } },
              { l: `👥  MODE: ${mode === "bot" ? "SOLO vs BOT" : "2 JOUEURS"}`, a: () => { click(); setMode(mode === "bot" ? "2p" : "bot"); } },
              { l: "🗺  MAPS", a: () => { click(); setScreen("maps"); } },
              { l: "🛠  TANKS", a: () => { click(); setScreen("tanks"); } },
              { l: "💥  BALLES", a: () => { click(); setScreen("bullets"); } },
              ...(onChangeGame ? [{ l: "🔄  CHANGER DE JEU", a: () => { click(); onChangeGame(); } }] : []),
            ].map((b, i) => (
              <button key={i} onClick={b.a}
                className="group relative px-6 py-4 bg-[#1a1f10]/80 border-2 border-[#7a5a2a] hover:border-[#d4c9a8] hover:bg-[#2a3020]/90 transition-all duration-200 hover:scale-105 hover:translate-x-2 text-left tracking-widest font-bold">
                <span className="absolute inset-y-0 left-0 w-1 bg-[#7a5a2a] group-hover:bg-[#d4c9a8] group-hover:w-2 transition-all"></span>
                {b.l}
              </button>
            ))}
          </div>
          <div className="absolute bottom-4 text-xs opacity-40 tracking-widest">MAP: {MAPS[mapIdx].name} · TANK: {TANK_MODELS[tankIdx].name} · AMMO: {BULLET_TYPES[bulletIdx].name}</div>
        </div>
      )}

      {screen === "maps" && (
        <SubScreen title="SELECTION DE CARTE" onBack={() => { click(); setScreen("menu"); }}>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 max-w-6xl mx-auto p-4">
            {MAPS.map((m, i) => (
              <button key={m.id} onClick={() => { click(); setMapIdx(i); }}
                className={`group relative aspect-[4/3] border-2 overflow-hidden transition-all hover:scale-105 ${mapIdx === i ? "border-[#d4c9a8] shadow-[0_0_20px_#7a5a2a]" : "border-[#7a5a2a]/50"}`}>
                <MapPreview map={m} />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-2">
                  <div className="text-sm font-bold tracking-wider">{m.name}</div>
                  <div className="text-[10px] opacity-60">{m.mood}</div>
                </div>
                {mapIdx === i && <div className="absolute top-2 right-2 bg-[#d4c9a8] text-black text-[10px] px-2 py-0.5 font-bold">SELECTED</div>}
              </button>
            ))}
          </div>
        </SubScreen>
      )}

      {screen === "tanks" && (
        <SubScreen title="GARAGE" onBack={() => { click(); setScreen("menu"); }}>
          <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto p-4">
            <div className="md:col-span-2 grid grid-cols-2 md:grid-cols-4 gap-3">
              {TANK_MODELS.map((t, i) => (
                <button key={t.name} onClick={() => { click(); setTankIdx(i); }}
                  className={`aspect-square border-2 p-3 transition-all hover:scale-105 ${tankIdx === i ? "border-[#d4c9a8] bg-[#2a3020]" : "border-[#7a5a2a]/50 bg-[#1a1f10]/50"}`}>
                  <TankPreview model={t} primary={primary} secondary={secondary} />
                  <div className="text-xs font-bold mt-2">{t.name}</div>
                </button>
              ))}
            </div>
            <div className="bg-[#1a1f10]/80 border-2 border-[#7a5a2a] p-4 space-y-3">
              <div className="text-sm tracking-widest opacity-70">CUSTOMISATION</div>
              <label className="block text-xs">NOM
                <input value={tankName} onChange={(e) => setTankName(e.target.value.toUpperCase().slice(0, 12))} className="w-full mt-1 bg-black/50 border border-[#7a5a2a] p-2 text-[#d4c9a8]" />
              </label>
              <label className="block text-xs">COULEUR PRINCIPALE
                <input type="color" value={primary} onChange={(e) => setPrimary(e.target.value)} className="w-full h-10 mt-1 bg-transparent" />
              </label>
              <label className="block text-xs">COULEUR SECONDAIRE
                <input type="color" value={secondary} onChange={(e) => setSecondary(e.target.value)} className="w-full h-10 mt-1 bg-transparent" />
              </label>
              <label className="block text-xs">TAILLE CANON: {cannonSize.toFixed(1)}
                <input type="range" min={0.7} max={1.5} step={0.1} value={cannonSize} onChange={(e) => setCannonSize(+e.target.value)} className="w-full" />
              </label>
              <label className="block text-xs">TAILLE TANK: {tankSize.toFixed(1)}
                <input type="range" min={0.8} max={1.3} step={0.1} value={tankSize} onChange={(e) => setTankSize(+e.target.value)} className="w-full" />
              </label>
            </div>
          </div>
        </SubScreen>
      )}

      {screen === "bullets" && (
        <SubScreen title="MUNITIONS" onBack={() => { click(); setScreen("menu"); }}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto p-4">
            {BULLET_TYPES.map((b, i) => (
              <button key={b.name} onClick={() => { click(); setBulletIdx(i); }}
                className={`p-4 border-2 transition-all hover:scale-105 ${bulletIdx === i ? "border-[#d4c9a8] bg-[#2a3020]" : "border-[#7a5a2a]/50 bg-[#1a1f10]/50"}`}>
                <BulletPreview bullet={b} />
                <div className="text-sm font-bold mt-2">{b.name}</div>
                <div className="text-[10px] opacity-60">DMG {b.damage} · V{b.speed}</div>
              </button>
            ))}
          </div>
        </SubScreen>
      )}

      {screen === "game" && (
        <>
          <canvas ref={canvasRef} className="block w-full h-full" />
        </>
      )}

      {(screen === "victory" || screen === "defeat") && stats && (
        <div className="relative z-10 flex flex-col items-center justify-center min-h-screen animate-fade-in">
          <div className={`text-8xl font-black tracking-widest ${screen === "victory" ? "text-[#d4c9a8]" : "text-[#a03020]"}`}
               style={{ textShadow: screen === "victory" ? "0 0 40px #7a5a2a" : "0 0 40px #a03020" }}>
            {screen === "victory" ? "VICTOIRE" : "DÉFAITE"}
          </div>
          <div className="mt-8 text-2xl tracking-widest">TEMPS: {stats.time.toFixed(1)}s</div>
          <div className="text-2xl tracking-widest">SCORE: {stats.score}</div>
          <div className="flex gap-4 mt-8">
            <button onClick={() => { click(); setScreen("game"); }} className="px-8 py-3 bg-[#7a5a2a] hover:bg-[#d4c9a8] hover:text-black font-bold tracking-widest transition-all hover:scale-105">REJOUER</button>
            <button onClick={() => { click(); setScreen("menu"); }} className="px-8 py-3 border-2 border-[#7a5a2a] hover:border-[#d4c9a8] font-bold tracking-widest transition-all hover:scale-105">MENU</button>
          </div>
        </div>
      )}
    </div>
  );
}

function SubScreen({ title, children, onBack }: { title: string; children: React.ReactNode; onBack: () => void }) {
  return (
    <div className="relative z-10 min-h-screen p-8 animate-fade-in">
      <div className="flex items-center justify-between mb-8 max-w-6xl mx-auto">
        <button onClick={onBack} className="px-4 py-2 border-2 border-[#7a5a2a] hover:border-[#d4c9a8] tracking-widest transition-all hover:scale-105">← RETOUR</button>
        <h2 className="text-3xl md:text-5xl font-black tracking-widest" style={{ textShadow: "0 0 20px #7a5a2a" }}>{title}</h2>
        <div className="w-24" />
      </div>
      {children}
    </div>
  );
}

function MapPreview({ map }: { map: typeof MAPS[number] }) {
  return (
    <div className="w-full h-full relative" style={{ background: map.previewBg }}>
      {map.previewDots.map((d, i) => (
        <div key={i} className="absolute rounded-full" style={{ left: `${d.x}%`, top: `${d.y}%`, width: d.s, height: d.s, background: d.c }} />
      ))}
    </div>
  );
}

function TankPreview({ model, primary, secondary }: { model: typeof TANK_MODELS[number]; primary: string; secondary: string }) {
  return (
    <div className="w-full aspect-square relative flex items-center justify-center">
      <div className="relative" style={{ width: 60 * model.scale, height: 40 * model.scale }}>
        <div className="absolute inset-0 rounded-sm" style={{ background: primary, border: `2px solid ${secondary}` }} />
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ width: 24 * model.scale, height: 24 * model.scale, background: secondary }} />
        <div className="absolute left-1/2 top-1/2 -translate-y-1/2" style={{ width: 30 * model.scale, height: 4, background: secondary }} />
      </div>
    </div>
  );
}

function BulletPreview({ bullet }: { bullet: typeof BULLET_TYPES[number] }) {
  return (
    <div className="w-full h-16 flex items-center justify-center">
      <div className="rounded-full" style={{ width: bullet.size * 4, height: bullet.size * 4, background: bullet.color, boxShadow: `0 0 ${bullet.glow}px ${bullet.color}` }} />
    </div>
  );
}
