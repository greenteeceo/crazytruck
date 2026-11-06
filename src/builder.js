// Level builder DSL shared by hand-made and generated levels. Units are metres.

export class B {
  constructor(style) { this.p = []; this.s = style; }
  add(o) { this.p.push(o); return this; }
  // static ground slab whose top is at `top`
  ground(x0, x1, top = 0, s = this.s, depth = 3) { return this.add({ t: 'box', x: (x0 + x1) / 2, y: top - depth / 2, w: x1 - x0, h: depth, s }); }
  block(cx, cy, w, h, s = this.s, a = 0) { return this.add({ t: 'box', x: cx, y: cy, w, h, s, a }); }
  // convex ramp from (x0,y0) to (x1,y1), filled down to `base`
  ramp(x0, y0, x1, y1, s = this.s, base) {
    const b = base ?? Math.min(y0, y1) - 1.2;
    return this.add({ t: 'poly', pts: [[x0, b], [x1, b], [x1, y1], [x0, y0]], s });
  }
  hill(x0, x1, h, top = 0, s = this.s) { const m = (x0 + x1) / 2; this.ramp(x0, top, m, top + h, s, top - 0.6); return this.ramp(m, top + h, x1, top, s, top - 0.6); }
  steps(x0, top0, n, dx, dy, s = this.s, depth = 3) { for (let i = 0; i < n; i++) this.ground(x0 + i * dx, x0 + (i + 1) * dx, top0 + (i + 1) * dy, s, depth + i * dy); return this; }
  bridge(x1, y1, x2, y2, s = 'wood', n) { return this.add({ t: 'bridge', x1, y1, x2, y2, s, n }); }
  dyn(x, y, w, h, s = 'crate', d = 0.4, a = 0) { return this.add({ t: 'dyn', x, y, w, h, s, d, a }); }
  crate(x, y, sz = 0.9, s = 'crate') { return this.dyn(x, y + sz / 2, sz, sz, s, 0.25); }
  stack(x, y, cols, rows, sz = 0.9, s = 'crate') { for (let r = 0; r < rows; r++) for (let c = 0; c < cols - r; c++) this.crate(x + c * sz + r * sz / 2, y + r * sz, sz, s); return this; }
  seesaw(x, y, w, a0 = 0.2, lim = 0.22, s = 'wood') { return this.add({ t: 'seesaw', x, y, w, a0, lim, s }); }
  hinge(x, y, w, a0, lo, hi, s = 'wood', h = 0.35) { return this.add({ t: 'hinge', x, y, w, a0, lo, hi, s, h }); }
  mover(x, y, w, h, dx, dy, period = 3, s = this.s, phase = 0) { return this.add({ t: 'mover', x, y, w, h, dx, dy, period, s, phase }); }
  spin(x, y, w, h, speed, s = this.s) { return this.add({ t: 'spin', x, y, w, h, speed, s }); }
  pad(x, top, w = 2.4, vx = 11, vy = 9) { this.add({ t: 'box', x, y: top - 0.15, w, h: 0.3, s: 'pad', vx, vy }); return this.add({ t: 'boost', x, y: top, w, vx, vy }); }
  gem(x, y) { return this.add({ t: 'gem', x, y }); }
  gems(x0, y, n, dx = 1.4) { for (let i = 0; i < n; i++) this.gem(x0 + i * dx, y); return this; }
  finish(x, y = 0) { return this.add({ t: 'finish', x, y }); }
  deco(kind, x, y, o = {}) { return this.add({ t: 'deco', kind, x, y, ...o }); }
  // ---- race obstacles
  dominoes(x0, n, dx = 1.5, top = 0, h = 2.2, s = 'wood') { for (let i = 0; i < n; i++) this.dyn(x0 + i * dx, top + h / 2, 0.32, h, s, 0.35); return this; }
  wall(x, cols, rows, top = 0, sz = 0.75, s = 'crate') { for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) this.dyn(x + c * sz, top + sz / 2 + r * sz, sz, sz, s, 0.15); return this; }
  ball(x, y, r = 0.8, vx = 0, s = 'stone') { return this.add({ t: 'ball', x, y, r, vx, s }); }
  // oil barrels standing on the road (a pile of 2-4, one on top when there are 3 or more)
  barrels(x, n = 3, top = 0) { for (let k = 0; k < n; k++) this.dyn(x + k * 1.1, top + 0.45, 0.7, 0.9, 'barrel', 0.2); if (n >= 3) this.dyn(x + 0.55, top + 1.35, 0.7, 0.9, 'barrel', 0.2); return this; }
  // a pyramid of logs across the road
  logPile(x, top = 0) { for (let row = 0; row < 3; row++) for (let k = 0; k < 3 - row; k++) this.dyn(x + k * 0.62 + row * 0.31, top + 0.3 + row * 0.56, 0.6, 0.56, 'log', 0.2); return this; }
  hammer(x, top = 0, a0 = 1.1, len = 4.4) { return this.add({ t: 'pend', x, y: top + len + 1.8, len, bw: 1.0, bh: 1.4, a0 }); }
}

// Real ground: nothing hangs in the air. Earth slabs and ramps whose underside is above the water are filled
// down to it; thin decks (girders, planks, plates) stand on piers instead; a moving deck rides on a ram (sim).
// Then a long run-out after the finish line with a barrel barrier at the end, so a truck that crosses the line
// at full speed brakes to a stop on the road instead of driving off into the sea.
const DECKS = new Set(['girder', 'wood', 'metal', 'concrete']);
export function insidePiece(q, x, y) {
  if (q.t === 'box') return !q.a && Math.abs(x - q.x) <= q.w / 2 + 1e-3 && Math.abs(y - q.y) <= q.h / 2 + 1e-3;
  const P = q.pts; let pos = 0, neg = 0;
  for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length], c = (b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]); if (c > 1e-6) pos++; else if (c < -1e-6) neg++; }
  return !(pos && neg);
}
export function settle(pieces, water = -3) {
  const solid = pieces.filter((p) => (p.t === 'box' && p.s !== 'pad') || p.t === 'poly');
  const held = (p, x, y) => solid.some((q) => q !== p && insidePiece(q, x, y - 0.08));
  const out = [];
  for (const p of pieces) {
    out.push(p);
    if (!solid.includes(p) || p.a) continue;
    const xs = p.t === 'box' ? [p.x - p.w / 2, p.x + p.w / 2] : p.pts.map((q) => q[0]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), bot = p.t === 'box' ? p.y - p.h / 2 : Math.min(...p.pts.map((q) => q[1]));
    if (bot <= water + 0.05) continue;
    const n = Math.max(2, Math.ceil((x1 - x0) / 0.8) + 1), samples = [];
    for (let i = 0; i < n; i++) samples.push(x0 + 0.12 + (x1 - x0 - 0.24) * i / (n - 1));
    if (samples.every((x) => held(p, x, bot))) continue;
    // over the road (a gate lintel, a beam to drive under): it stands on towers at both sides of the road
    let floor = null;
    for (let y = bot - 1.2; y > water && floor == null; y -= 0.2) if (solid.some((q) => q !== p && insidePiece(q, (x0 + x1) / 2, y))) floor = y;
    if (floor != null) { p.posts = floor; continue; }
    if (p.t === 'box' && p.h < 1 && p.w >= 2 && DECKS.has(p.s)) {
      // a deck: piers at both ends and every 6 m, wherever nothing already holds it up
      const k = Math.max(1, Math.ceil((x1 - x0 - 0.8) / 6)), ps = [];
      for (let i = 0; i <= k; i++) ps.push(x0 + 0.4 + (x1 - x0 - 0.8) * i / k);
      for (const px of ps) if (!held(p, px, bot)) out.push({ t: 'box', x: px, y: (bot + water) / 2, w: 0.5, h: bot - water, s: p.s, pier: true });
    } else if (p.t === 'box') {
      const top = p.y + p.h / 2; p.h = top - water; p.y = (top + water) / 2;
    } else {
      p.pts = p.pts.map(([x, y]) => [x, y <= bot + 1e-6 ? water : y]);
    }
  }
  const f = pieces.find((p) => p.t === 'finish');
  if (f) {
    const under = solid.find((q) => insidePiece(q, f.x, f.y - 0.1));
    const st = under?.s && under.s !== 'pad' ? under.s : 'concrete';
    // the road goes on from where the finish ground ends (no overlapping slabs), to 32 m past the line
    let xe = f.x; while (xe < f.x + 32 && solid.some((q) => insidePiece(q, xe + 0.05, f.y - 0.1))) xe += 0.1;
    if (xe < f.x + 32) out.push({ t: 'box', x: (xe + f.x + 32) / 2, y: (f.y + water) / 2, w: f.x + 32 - xe, h: f.y - water, s: st, runout: true });
    out.push({ t: 'box', x: f.x + 31.5, y: f.y + 0.6, w: 1, h: 1.2, s: 'barrel', barrier: true });
  }
  return out;
}

export const lvl = (name, style, fn, opts = {}) => { const b = new B(style); fn(b); return { name, pieces: settle(b.p, opts.water ?? -3), water: -3, start: { x: 0, y: 0 }, ...opts }; };
