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
  hammer(x, top = 0, a0 = 1.1, len = 4.4) { return this.add({ t: 'pend', x, y: top + len + 1.8, len, bw: 1.0, bh: 1.4, a0 }); }
}

export const lvl = (name, style, fn, opts = {}) => { const b = new B(style); fn(b); return { name, pieces: b.p, water: -3, start: { x: 0, y: 0 }, ...opts }; };
