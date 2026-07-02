// Web-Audio synthesised sound effects & music. No external assets.
let ctx: AudioContext | null = null;
let musicNodes: { osc: OscillatorNode; gain: GainNode; timer: number } | null = null;

export function initAudio() {
  if (!ctx) {
    try { ctx = new (window.AudioContext || (window as any).webkitAudioContext)(); } catch { /* noop */ }
  }
  if (ctx && ctx.state === "suspended") ctx.resume();
}

export function playSfx(kind: "click" | "shoot" | "explode" | "hit" | "engine" | "victory" | "defeat") {
  if (!ctx) return;
  const c = ctx;
  const now = c.currentTime;
  const g = c.createGain();
  g.connect(c.destination);
  if (kind === "click") {
    const o = c.createOscillator(); o.type = "square"; o.frequency.value = 800;
    g.gain.setValueAtTime(0.08, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    o.connect(g); o.start(now); o.stop(now + 0.09);
  } else if (kind === "shoot") {
    const o = c.createOscillator(); o.type = "sawtooth"; o.frequency.setValueAtTime(180, now); o.frequency.exponentialRampToValueAtTime(40, now + 0.2);
    g.gain.setValueAtTime(0.25, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    o.connect(g); o.start(now); o.stop(now + 0.26);
    // noise burst
    const buf = c.createBuffer(1, c.sampleRate * 0.15, c.sampleRate); const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const s = c.createBufferSource(); s.buffer = buf; const ng = c.createGain(); ng.gain.value = 0.3;
    s.connect(ng); ng.connect(c.destination); s.start(now);
  } else if (kind === "explode") {
    const buf = c.createBuffer(1, c.sampleRate * 0.6, c.sampleRate); const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2);
    const s = c.createBufferSource(); s.buffer = buf; const ng = c.createGain(); ng.gain.value = 0.5;
    const bq = c.createBiquadFilter(); bq.type = "lowpass"; bq.frequency.value = 400;
    s.connect(bq); bq.connect(ng); ng.connect(c.destination); s.start(now);
  } else if (kind === "hit") {
    const o = c.createOscillator(); o.type = "triangle"; o.frequency.value = 120;
    g.gain.setValueAtTime(0.15, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    o.connect(g); o.start(now); o.stop(now + 0.11);
  } else if (kind === "victory") {
    [523, 659, 784, 1046].forEach((f, i) => {
      const o = c.createOscillator(); const gg = c.createGain(); o.type = "triangle"; o.frequency.value = f;
      gg.gain.setValueAtTime(0.15, now + i * 0.15); gg.gain.exponentialRampToValueAtTime(0.001, now + i * 0.15 + 0.4);
      o.connect(gg); gg.connect(c.destination); o.start(now + i * 0.15); o.stop(now + i * 0.15 + 0.42);
    });
  } else if (kind === "defeat") {
    [400, 300, 200, 100].forEach((f, i) => {
      const o = c.createOscillator(); const gg = c.createGain(); o.type = "sawtooth"; o.frequency.value = f;
      gg.gain.setValueAtTime(0.15, now + i * 0.2); gg.gain.exponentialRampToValueAtTime(0.001, now + i * 0.2 + 0.5);
      o.connect(gg); gg.connect(c.destination); o.start(now + i * 0.2); o.stop(now + i * 0.2 + 0.52);
    });
  }
}

export function playMusic(kind: "menu" | "battle") {
  if (!ctx) return;
  stopMusic();
  const c = ctx;
  const gain = c.createGain(); gain.gain.value = 0.04; gain.connect(c.destination);
  const osc = c.createOscillator(); osc.type = "sawtooth"; osc.frequency.value = kind === "menu" ? 55 : 65;
  const bq = c.createBiquadFilter(); bq.type = "lowpass"; bq.frequency.value = 300;
  osc.connect(bq); bq.connect(gain); osc.start();
  const notes = kind === "menu" ? [55, 65, 55, 49] : [65, 73, 82, 65, 49, 55];
  let i = 0;
  const timer = window.setInterval(() => {
    osc.frequency.setTargetAtTime(notes[i % notes.length], c.currentTime, 0.05);
    i++;
  }, 600);
  musicNodes = { osc, gain, timer };
}

export function stopMusic() {
  if (!musicNodes) return;
  try { musicNodes.osc.stop(); } catch { /* noop */ }
  clearInterval(musicNodes.timer);
  musicNodes = null;
}
