import { P } from './platform/index.js';
// Tiny synthesized sound engine (no asset files).
let ctx, master, engine, engGain, engFilter, enabled = true;

function ensure() {
  if (ctx) return ctx;
  ctx = P.audioContext();
  if (!ctx) return null;
  master = ctx.createGain(); master.gain.value = 0.55; master.connect(ctx.destination);
  return ctx;
}

export const Audio = {
  unlock() { const c = ensure(); if (c && c.state === 'suspended') c.resume(); },
  setEnabled(v) { enabled = v; if (master) master.gain.value = v ? 0.55 : 0; if (!v) this.engineStop(); },
  get enabled() { return enabled; },

  tone(freq, dur = 0.12, type = 'square', vol = 0.18, slide = 0, delay = 0) {
    const c = ensure(); if (!c || !enabled) return;
    const t = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
  },
  noise(dur = 0.25, vol = 0.3, freq = 800, delay = 0) {
    const c = ensure(); if (!c || !enabled) return;
    const t = c.currentTime + delay;
    const b = c.createBuffer(1, Math.max(1, (c.sampleRate * dur) | 0), c.sampleRate);
    const d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const s = c.createBufferSource(); s.buffer = b;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq;
    const g = c.createGain(); g.gain.value = vol;
    s.connect(f); f.connect(g); g.connect(master); s.start(t);
  },
  click() { this.tone(660, 0.06, 'square', 0.08); this.tone(990, 0.05, 'square', 0.06, 0, 0.03); },
  gem() { this.tone(1046, 0.09, 'square', 0.1); this.tone(1568, 0.14, 'square', 0.1, 0, 0.06); },
  land(v = 1) { this.noise(0.18, Math.min(0.5, 0.15 + v * 0.2), 300); },
  boost() { this.tone(220, 0.35, 'sawtooth', 0.12, 700); this.noise(0.3, 0.15, 2000); },
  splash() { this.noise(0.6, 0.45, 1400); this.tone(300, 0.4, 'sine', 0.1, -200); },
  crash() { this.noise(0.4, 0.5, 600); this.tone(160, 0.35, 'square', 0.12, -100); },
  fail() { [523, 440, 349, 262].forEach((f, i) => this.tone(f, 0.18, 'square', 0.09, 0, 0.15 + i * 0.14)); },
  win() { [523, 659, 784, 1046, 784, 1046].forEach((f, i) => this.tone(f, i === 5 ? 0.4 : 0.13, 'square', 0.1, 0, i * 0.1)); },
  coin(i = 0) { this.tone(1318 + (i % 5) * 60, 0.07, 'square', 0.06); },
  countdown(go) { this.tone(go ? 880 : 440, go ? 0.35 : 0.15, 'square', 0.12); },
  star(i) { this.tone(784 + i * 196, 0.18, 'square', 0.1); },

  engineStart() {
    const c = ensure(); if (!c || !enabled || engine) return;
    engine = [c.createOscillator(), c.createOscillator()];
    engine[0].type = 'sawtooth'; engine[1].type = 'square';
    engFilter = c.createBiquadFilter(); engFilter.type = 'lowpass'; engFilter.frequency.value = 400;
    engGain = c.createGain(); engGain.gain.value = 0.0;
    engine.forEach((o, i) => { o.frequency.value = 50 + i * 1.5; o.connect(engFilter); o.start(); });
    engFilter.connect(engGain); engGain.connect(master);
  },
  engineSet(rpm, throttle) {
    if (!engine) return;
    const t = ctx.currentTime;
    const f = 42 + rpm * 3.2 + (throttle ? 12 : 0);
    engine[0].frequency.setTargetAtTime(f, t, 0.05); engine[1].frequency.setTargetAtTime(f * 0.5 + 1, t, 0.05);
    engFilter.frequency.setTargetAtTime(300 + rpm * 25 + (throttle ? 300 : 0), t, 0.05);
    engGain.gain.setTargetAtTime(throttle ? 0.075 : 0.04, t, 0.08);
  },
  engineStop() {
    if (!engine) return;
    try { engGain.gain.setTargetAtTime(0, ctx.currentTime, 0.05); const e = engine; setTimeout(() => e.forEach((o) => o.stop()), 300); } catch { /* ignore */ }
    engine = null;
  },
};
