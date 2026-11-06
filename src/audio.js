import { P } from './platform/index.js';
// Tiny synthesized sound engine (no asset files).
let ctx, master, engine, engGain, engFilter, enabled = true;
const t0 = Date.now();
// TikTok's WebAudioContext does not document currentTime: fall back to wall-clock seconds
const now = () => (ctx && typeof ctx.currentTime === 'number' ? ctx.currentTime : (Date.now() - t0) / 1000);
// sound must never break the game: every call is guarded
const safe = (fn) => function (...a) { try { return fn.apply(this, a); } catch { return undefined; } };

function ensure() {
  if (ctx) return ctx;
  ctx = P.audioContext();
  if (!ctx) return null;
  master = ctx.createGain(); master.gain.value = 0.55; master.connect(ctx.destination);
  return ctx;
}

const AudioImpl = {
  unlock() { const c = ensure(); if (c && c.state === 'suspended') c.resume(); },
  setEnabled(v) { enabled = v; if (master) master.gain.value = v ? 0.55 : 0; if (!v) this.engineStop(); },
  get enabled() { return enabled; },

  tone(freq, dur = 0.12, type = 'square', vol = 0.18, slide = 0, delay = 0) {
    const c = ensure(); if (!c || !enabled) return;
    const t = now() + delay;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
  },
  noise(dur = 0.25, vol = 0.3, freq = 800, delay = 0) {
    const c = ensure(); if (!c || !enabled) return;
    const t = now() + delay;
    const b = c.createBuffer(1, Math.max(1, (c.sampleRate * dur) | 0), c.sampleRate);
    const d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const s = c.createBufferSource(); s.buffer = b;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq;
    const g = c.createGain(); g.gain.value = vol;
    s.connect(f); f.connect(g); g.connect(master); s.start(t);
  },
  // the crowd at the finish: hand claps (many short bursts) over a cheering roar that swells and fades
  applause(dur = 3.2) {
    const c = ensure(); if (!c || !enabled) return;
    const t = now(), sr = c.sampleRate, n = (sr * dur) | 0;
    const b = c.createBuffer(1, n, sr), d = b.getChannelData(0);
    const env = (k) => Math.min(1, k / 0.12) * Math.max(0, 1 - Math.max(0, k - 0.45) / 0.55);   // swell in, long fade out
    const claps = Math.round(dur * 70);
    for (let i = 0; i < claps; i++) {
      const at = Math.pow(Math.random(), 1.4) * dur, i0 = (at * sr) | 0, len = (sr * (0.008 + Math.random() * 0.014)) | 0, a = (0.35 + Math.random() * 0.65) * env(at / dur);
      for (let j = 0; j < len && i0 + j < n; j++) d[i0 + j] += (Math.random() * 2 - 1) * a * Math.exp(-j / (len * 0.3));
    }
    const s = c.createBufferSource(); s.buffer = b;
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2000; f.Q.value = 0.6;
    const g = c.createGain(); g.gain.value = 0.55;
    s.connect(f); f.connect(g); g.connect(master); s.start(t);
    // cheering: a band of noise in the voice range, rising and falling like "hooray"
    const rb = c.createBuffer(1, n, sr), rd = rb.getChannelData(0);
    for (let i = 0; i < n; i++) { const k = i / n; rd[i] = (Math.random() * 2 - 1) * env(k) * (0.75 + 0.25 * Math.sin(k * 40)); }
    const rs = c.createBufferSource(); rs.buffer = rb;
    const rf = c.createBiquadFilter(); rf.type = 'bandpass'; rf.Q.value = 1.4; rf.frequency.setValueAtTime(520, t); rf.frequency.linearRampToValueAtTime(880, t + 0.5); rf.frequency.linearRampToValueAtTime(640, t + dur);
    const rg = c.createGain(); rg.gain.value = 0.32;
    rs.connect(rf); rf.connect(rg); rg.connect(master); rs.start(t);
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
    const t = now();
    const f = 42 + rpm * 3.2 + (throttle ? 12 : 0);
    engine[0].frequency.setTargetAtTime(f, t, 0.05); engine[1].frequency.setTargetAtTime(f * 0.5 + 1, t, 0.05);
    engFilter.frequency.setTargetAtTime(300 + rpm * 25 + (throttle ? 300 : 0), t, 0.05);
    engGain.gain.setTargetAtTime(throttle ? 0.075 : 0.04, t, 0.08);
  },
  engineStop() {
    if (!engine) return;
    try { engGain.gain.setTargetAtTime(0, now(), 0.05); const e = engine; setTimeout(() => e.forEach((o) => o.stop()), 300); } catch { /* ignore */ }
    engine = null;
  },
};

export const Audio = Object.fromEntries(Object.entries(Object.getOwnPropertyDescriptors(AudioImpl)).filter(([, d]) => typeof d.value === 'function').map(([k, d]) => [k, safe(d.value)]));
Object.defineProperty(Audio, 'enabled', { get: () => enabled });
