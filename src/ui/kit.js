// Canvas UI kit: draws the whole interface on one 2D canvas (no DOM), so the same code runs in
// the browser, the Android WebView and the TikTok native runtime.
// Screens are draw functions called whenever something changed; they register hit regions as
// they draw. Logical units are CSS pixels; the canvas backing store is scaled by `dpr`.
import { icon as drawIcon, iconPath } from './icons.js';

export const INK = '#11131c';
export const GOLD = '#ffc61a';
export const GRAD = {
  blue: ['#2f9bff', '#0a6fe6'], gray: ['#b7bed1', '#8e97b0'], red: ['#ff5a6e', '#e8334a'], orange: ['#ffb02e', '#ff7a0a'],
  green: ['#5ae06a', '#2fae4a'], gold: ['#ffc84a', '#ff9a14'], dark: ['#6f7894', '#545c77'], panel: ['#2f8cff', '#155fd8'],
  purple: ['#b47aff', '#7a3ae0'], teal: ['#2ee6c8', '#13a88e'],
};
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const easeOutBack = (k) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2); };

export class UI {
  constructor(canvas) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d');
    this.w = 360; this.h = 640; this.dpr = 1; this.safeTop = 0; this.safeBottom = 0;
    this.font = 'sans-serif';
    this.t = 0; this.screenT0 = 0;
    this.screen = null; this.overlays = [];
    this.hits = []; this.pointers = new Map(); this.down = new Set();
    this.scrolls = {}; this.dirty = true; this.animUntil = 0;
    this.toasts = []; this.fx = [];
    this.ox = 0; this.oy = 0; this.clipR = null;
  }

  resize(w, h, dpr, top = 0, bottom = 0) {
    this.w = w; this.h = h; this.dpr = Math.min(dpr, 2); this.safeTop = top; this.safeBottom = bottom;
    this.canvas.width = Math.round(w * this.dpr); this.canvas.height = Math.round(h * this.dpr);
    this.dirty = true;
  }

  // ---------------------------------------------------------------- screens
  show(name, draw, opts = {}) {
    this.screen = { name, draw, ...opts };
    this.overlays = []; this.screenT0 = this.t; this.animUntil = this.t + (opts.anim ?? 1.6);
    if (!opts.keepScroll) this.scrolls = {};
    this.releaseAll();
    this.dirty = true;
  }
  overlay(draw, opts = {}) { this.overlays.push({ draw, t0: this.t, ...opts }); this.animUntil = this.t + 0.6; this.releaseAll(); this.dirty = true; }
  closeOverlay() { this.overlays.pop(); this.dirty = true; }
  get st() { return this.t - this.screenT0; }
  request(sec = 0) { this.dirty = true; if (sec) this.animUntil = Math.max(this.animUntil, this.t + sec); }

  toast(text, color = '#46d35c') { this.toasts.push({ text, color, t0: this.t }); this.request(1.8); }

  // ---------------------------------------------------------------- frame
  update(dt) {
    this.t += dt;
    for (const s of Object.values(this.scrolls)) {
      if (s.drag || Math.abs(s.vel) < 1) continue;
      s.off = clamp(s.off + s.vel * dt, 0, s.max); s.vel *= Math.exp(-dt * 4); this.dirty = true;
      if (s.off <= 0 || s.off >= s.max) s.vel = 0;
    }
    if (this.t < this.animUntil || this.fx.length || this.toasts.length) this.dirty = true;
    if (!this.dirty) return false;
    // cap the redraw rate (on TikTok every redraw is a full-screen texture upload)
    if (this.maxFps && this.t - (this.lastDraw ?? -1) < 1 / this.maxFps - 0.002) return false;
    this.lastDraw = this.t;
    this.draw();
    return true;
  }

  draw() {
    const c = this.ctx;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.clearRect(0, 0, this.w, this.h);
    this.hits = []; this.ox = 0; this.oy = 0; this.clipR = null;
    this.dirty = false;
    if (this.screen) {
      const more = this.screen.draw(this);
      if (more) this.dirty = true;
    }
    this.overlays.forEach((o, i) => {
      if (i === this.overlays.length - 1) this.hits = [];          // only the top overlay is interactive
      c.fillStyle = 'rgba(8,30,80,0.5)'; c.fillRect(0, 0, this.w, this.h);
      this.hit(0, 0, this.w, this.h, { id: '__block' });
      if (o.draw(this, this.t - o.t0)) this.dirty = true;
    });
    this.drawFx();
    this.drawToasts();
  }

  // ---------------------------------------------------------------- input
  hit(x, y, w, h, o = {}) {
    let r = { x: x + this.ox, y: y + this.oy, w, h, ...o };
    if (this.clipR) {
      const c = this.clipR, x0 = Math.max(r.x, c.x), y0 = Math.max(r.y, c.y), x1 = Math.min(r.x + r.w, c.x + c.w), y1 = Math.min(r.y + r.h, c.y + c.h);
      if (x1 <= x0 || y1 <= y0) return;
      r = { ...r, x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
    }
    this.hits.push(r);
  }
  isDown(id) { return this.down.has(id); }
  find(x, y) { for (let i = this.hits.length - 1; i >= 0; i--) { const r = this.hits[i]; if (x >= r.x && y >= r.y && x <= r.x + r.w && y <= r.y + r.h) return r; } return null; }

  pointerDown(p) {
    const r = this.find(p.x, p.y);
    const st = { x0: p.x, y0: p.y, x: p.x, y: p.y, r, t0: this.t, moved: false };
    this.pointers.set(p.id, st);
    if (r?.hold) { r.hold(true); this.down.add(r.id); }
    else if (r && !r.disabled && r.onTap) this.down.add(r.id);
    if (r?.scrollKey) { const s = this.scrolls[r.scrollKey]; if (s) { s.drag = true; s.vel = 0; st.scroll = s; st.off0 = s.off; } }
    this.onAny?.();
    this.dirty = true;
  }
  pointerMove(p) {
    const st = this.pointers.get(p.id); if (!st) return;
    const dx = p.x - st.x, dy = p.y - st.y; st.x = p.x; st.y = p.y;
    const tx = p.x - st.x0, ty = p.y - st.y0;
    if (!st.moved && Math.hypot(tx, ty) > 9) {
      st.moved = true;
      if (st.r && !st.r.hold) this.down.delete(st.r.id);   // a drag cancels the tap
    }
    // scroll (vertical or horizontal list)
    const sc = st.scroll || (st.r?.scrollKey && this.scrolls[st.r.scrollKey]);
    if (sc && st.moved) {
      const d = sc.horizontal ? dx : dy, dt = Math.max(1 / 120, this.t - (st.lt ?? st.t0));
      sc.off = clamp(sc.off - d, -40, sc.max + 40); sc.vel = -d / dt * 0.6; st.lt = this.t; this.dirty = true;
    }
    // a held control stays down while the finger slides off it a little (like the DOM version)
  }
  pointerUp(p) {
    const st = this.pointers.get(p.id); this.pointers.delete(p.id); if (!st) return;
    const r = st.r;
    if (r?.hold) { r.hold(false); this.down.delete(r.id); }
    const sc = st.scroll; if (sc) { sc.drag = false; if (sc.off < 0 || sc.off > sc.max) { sc.off = clamp(sc.off, 0, sc.max); sc.vel = 0; } }
    if (r && !r.hold && !st.moved && this.down.has(r.id)) { this.down.delete(r.id); if (!r.disabled) r.onTap?.(r); }
    else if (r) this.down.delete(r.id);
    // horizontal swipe on empty space
    const tx = st.x - st.x0, ty = st.y - st.y0;
    if ((!r || r.id === '__swipe') && Math.abs(tx) > 60 && Math.abs(tx) > Math.abs(ty) * 1.5) this.screen?.swipe?.(tx < 0 ? 1 : -1);
    this.dirty = true;
  }
  releaseAll() { for (const st of this.pointers.values()) if (st.r?.hold) st.r.hold(false); this.pointers.clear(); this.down.clear(); }

  // ---------------------------------------------------------------- scroll areas
  // Draws content(y) clipped to the rect; `size` is the content length. Returns nothing.
  scroll(key, x, y, w, h, size, content, { horizontal = false, start } = {}) {
    const s = this.scrolls[key] ||= { off: 0, vel: 0, drag: false, horizontal, max: 0, inited: false };
    s.max = Math.max(0, size - (horizontal ? w : h)); s.horizontal = horizontal;
    if (!s.inited) { s.inited = true; if (start != null) s.off = clamp(start, 0, s.max); }
    if (!s.drag) s.off = clamp(s.off, 0, s.max);
    const c = this.ctx;
    this.hit(x, y, w, h, { id: '__scroll_' + key, scrollKey: key });
    c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip();
    const prevClip = this.clipR, pox = this.ox, poy = this.oy;
    this.clipR = { x: x + this.ox, y: y + this.oy, w, h };
    if (horizontal) { c.translate(-s.off, 0); this.ox -= s.off; } else { c.translate(0, -s.off); this.oy -= s.off; }
    content();
    this.ox = pox; this.oy = poy; this.clipR = prevClip;
    c.restore();
    // scrollbar hint
    if (s.max > 0 && !horizontal) {
      const bh = Math.max(30, h * h / size), by = y + (h - bh) * (s.off / s.max);
      c.fillStyle = 'rgba(255,255,255,0.35)'; this.rr(x + w - 5, by, 4, bh, 2); c.fill();
    }
    return s;
  }

  // ---------------------------------------------------------------- primitives
  rr(x, y, w, h, r) {
    const c = this.ctx; r = Math.min(r, w / 2, h / 2);
    c.beginPath(); c.moveTo(x + r, y); c.lineTo(x + w - r, y); c.quadraticCurveTo(x + w, y, x + w, y + r);
    c.lineTo(x + w, y + h - r); c.quadraticCurveTo(x + w, y + h, x + w - r, y + h); c.lineTo(x + r, y + h);
    c.quadraticCurveTo(x, y + h, x, y + h - r); c.lineTo(x, y + r); c.quadraticCurveTo(x, y, x + r, y); c.closePath();
  }
  grad(y0, y1, [a, b]) { const g = this.ctx.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, a); g.addColorStop(1, b); return g; }
  f(size, weight = 700) { return `${weight} ${size}px ${this.font}`; }
  measure(str, size, weight = 700) { this.ctx.font = this.f(size, weight); return this.ctx.measureText(String(str)).width; }

  // Text with the chunky dark outline used everywhere in the game.
  text(str, x, y, size, color = '#fff', { align = 'center', base = 'middle', outline = true, weight = 700, maxW, alpha = 1 } = {}) {
    const c = this.ctx; str = String(str);
    c.font = this.f(size, weight); c.textAlign = align; c.textBaseline = base; c.lineJoin = 'round';
    if (maxW) { const m = c.measureText(str).width; if (m > maxW) { c.save(); const k = maxW / m; c.translate(x, y); c.scale(k, 1); x = 0; y = 0; this._textBody(str, x, y, size, color, outline, alpha); c.restore(); return; } }
    this._textBody(str, x, y, size, color, outline, alpha);
  }
  _textBody(str, x, y, size, color, outline, alpha) {
    const c = this.ctx; c.globalAlpha = alpha;
    if (outline) {
      const lw = Math.max(3, size * 0.2);
      c.strokeStyle = INK; c.lineWidth = lw;
      c.strokeText(str, x, y + Math.max(2, size * 0.09)); c.strokeText(str, x, y);
    }
    c.fillStyle = color; c.fillText(str, x, y);
    c.globalAlpha = 1;
  }

  icon(name, x, y, size, color = '#fff', shadow = true) { drawIcon(this.ctx, name, x, y, size, color, shadow); }

  gem(cx, cy, s) {
    const c = this.ctx, h = s / 2;
    c.beginPath(); c.moveTo(cx, cy - h); c.lineTo(cx + h, cy); c.lineTo(cx, cy + h); c.lineTo(cx - h, cy); c.closePath();
    c.fillStyle = INK; c.save(); c.translate(0, 1.5); c.fill(); c.restore();
    const g = c.createLinearGradient(cx - h, cy - h, cx + h, cy + h);
    g.addColorStop(0, '#fff3a8'); g.addColorStop(0.3, '#fff3a8'); g.addColorStop(0.3, '#ffc61a'); g.addColorStop(0.6, '#ffc61a'); g.addColorStop(0.6, '#e09a00'); g.addColorStop(1, '#e09a00');
    c.fillStyle = g; c.fill();
  }

  // Raised, outlined button (white ring, ink border, gradient, bottom shade). Registers a hit.
  button(id, x, y, w, h, o = {}) {
    const c = this.ctx, { color = 'blue', label, icon: ic, size = 20, iconSize, col = false, disabled = false, radius = 16, onTap, ring = true, hold, sub } = o;
    const pressed = this.isDown(id);
    c.save();
    if (pressed) { c.translate(x + w / 2, y + h / 2 + 3); c.scale(0.97, 0.97); c.translate(-(x + w / 2), -(y + h / 2)); }
    if (o.scale && o.scale !== 1) { c.translate(x + w / 2, y + h / 2); c.scale(o.scale, o.scale); c.translate(-(x + w / 2), -(y + h / 2)); }
    if (disabled) c.globalAlpha = 0.6;
    if (ring) { this.rr(x - 1, y + 5, w + 2, h + 2, radius + 2); c.fillStyle = 'rgba(0,0,0,0.18)'; c.fill(); this.rr(x - 3, y - 3, w + 6, h + 6, radius + 3); c.fillStyle = '#fff'; c.fill(); }
    this.rr(x, y, w, h, radius); c.fillStyle = this.grad(y, y + h, GRAD[color] || GRAD.blue); c.fill();
    c.save(); c.clip(); c.fillStyle = 'rgba(0,0,0,0.2)'; c.fillRect(x, y + h - 7, w, 7); c.fillStyle = 'rgba(255,255,255,0.18)'; c.fillRect(x, y, w, h * 0.42); c.restore();
    this.rr(x, y, w, h, radius); c.lineWidth = 3; c.strokeStyle = INK; c.stroke();
    // content: always laid out by row(), which measures every part and shrinks to fit the button
    const isz = iconSize ?? size * 1.25;
    if (col && ic) {
      this.icon(ic, x + w / 2 - isz / 2, y + h / 2 - isz / 2 - size * 0.55, isz);
      if (label) this.text(label, x + w / 2, y + h / 2 + isz * 0.5, size * 0.85, '#fff', { maxW: w - 8 });
    } else {
      const parts = o.parts || [...(ic ? [{ icon: ic, size: isz }] : []), ...(label ? [label] : [])];
      this.row(parts, x + w / 2, y + h / 2 + (sub ? -7 : 0) - 1, { size, maxW: w - 20 });
      if (sub) this.text(sub, x + w / 2, y + h / 2 + 13, size * 0.6, '#fff', { maxW: w - 20 });
    }
    c.restore();
    this.hit(x - 4, y - 4, w + 8, h + 8, { id, onTap, disabled, hold });
  }

  // Horizontal run of text / icons / gems centred on (cx, cy). Every part is measured, so a gem or an
  // icon can never sit on top of the text. Shrinks uniformly when wider than maxW. Returns the width.
  // parts: 'text' | { text, color } | { icon, color, size } | { gem, size }
  row(parts, cx, cy, { size = 20, color = '#fff', gap = 7, maxW = Infinity, outline = true } = {}) {
    const items = parts.filter((p) => p != null && p !== '').map((p) => (typeof p === 'string' || typeof p === 'number' ? { text: String(p) } : p));
    const widthAt = (sz) => items.reduce((a, p) => a + (p.text != null ? this.measure(p.text, sz) : p.icon ? (p.size ? p.size * sz / size : sz * 1.2) : (p.size ? p.size * sz / size : sz * 1.1)), 0) + gap * Math.max(0, items.length - 1) * sz / size;
    let sz = size, tot = widthAt(sz);
    if (tot > maxW) { sz = Math.max(9, size * maxW / tot); tot = widthAt(sz); }
    const k = sz / size, g = gap * k;
    let x = cx - tot / 2;
    for (const p of items) {
      if (p.text != null) { const tw = this.measure(p.text, sz); this.text(p.text, x, cy + 1, sz, p.color || color, { align: 'left', outline }); x += tw + g; }
      else if (p.icon) { const is = p.size ? p.size * k : sz * 1.2; this.icon(p.icon, x, cy - is / 2, is, p.color || '#fff'); x += is + g; }
      else { const gs = p.size ? p.size * k : sz * 1.1; this.gem(x + gs / 2, cy, gs); x += gs + g; }
    }
    return tot;
  }

  panel(x, y, w, h, { ribbon, ribbonColor = 'red', scale = 1 } = {}) {
    const c = this.ctx;
    c.save();
    if (scale !== 1) { c.translate(x + w / 2, y + h / 2); c.scale(scale, scale); c.translate(-(x + w / 2), -(y + h / 2)); }
    this.rr(x - 2, y + 10, w + 4, h + 4, 24); c.fillStyle = 'rgba(0,0,0,0.25)'; c.fill();
    this.rr(x - 4, y - 4, w + 8, h + 8, 26); c.fillStyle = '#fff'; c.fill();
    this.rr(x, y, w, h, 22); c.fillStyle = this.grad(y, y + h, GRAD.panel); c.fill(); c.lineWidth = 3; c.strokeStyle = INK; c.stroke();
    if (ribbon) this.ribbon(ribbon, x + w / 2, y, ribbonColor);
    c.restore();
  }
  ribbon(text, cx, cy, color = 'red', size = 26) {
    const c = this.ctx, w = this.measure(text, size) + 46, h = size + 20, x = cx - w / 2, y = cy - h / 2;
    this.rr(x - 3, y - 3, w + 6, h + 6, 17); c.fillStyle = '#fff'; c.fill();
    this.rr(x, y, w, h, 14); c.fillStyle = typeof color === 'string' && color[0] === '#' ? color : this.grad(y, y + h, GRAD[color] || GRAD.red); c.fill();
    c.lineWidth = 3; c.strokeStyle = INK; c.stroke();
    this.text(text, cx, cy + 1, size);
  }

  pill(x, y, h, content, { bg = 'rgba(10,30,80,0.55)', minW = 0 } = {}) {
    const c = this.ctx, size = h * 0.5, tw = this.measure(content.text, size);
    const w = Math.max(minW, tw + h * 0.9 + 18);
    this.rr(x - 2, y - 2, w + 4, h + 4, h / 2 + 2); c.fillStyle = 'rgba(255,255,255,0.7)'; c.fill();
    this.rr(x, y, w, h, h / 2); c.fillStyle = bg; c.fill(); c.lineWidth = 3; c.strokeStyle = INK; c.stroke();
    const isz = h * 0.6;
    const lead = content.gem ? { gem: true, size: isz } : content.icon ? { icon: content.icon, size: isz, color: content.iconColor || GOLD } : null;
    this.row([lead, content.text], x + w / 2, y + h / 2, { size, maxW: w - 12 });
    return w;
  }

  bar(x, y, w, h, pct, { bg = '#0b3e8a', fill = ['#5fd0ff', '#12a8ff'], ring = true } = {}) {
    const c = this.ctx;
    if (ring) { this.rr(x - 2, y - 2, w + 4, h + 4, h / 2 + 2); c.fillStyle = '#fff'; c.fill(); }
    this.rr(x, y, w, h, h / 2); c.fillStyle = bg; c.fill();
    c.save(); c.clip();
    if (pct > 0) { c.fillStyle = this.grad(y, y + h, fill); c.fillRect(x, y, w * clamp(pct, 0, 1), h); }
    c.restore();
    this.rr(x, y, w, h, h / 2); c.lineWidth = 3; c.strokeStyle = INK; c.stroke();
  }

  star(cx, cy, size, on, scale = 1) {
    const c = this.ctx; c.save(); c.translate(cx, cy); c.scale(scale, scale);
    iconPath(c, 'star', -size / 2, -size / 2 + size * 0.07, size); c.fillStyle = INK; c.fill();
    iconPath(c, 'star', -size / 2, -size / 2, size); c.fillStyle = on ? GOLD : '#0b3e8a'; c.fill();
    c.restore();
  }

  // pop-in scale for entrance animations: 0 -> overshoot -> 1 between `delay` and delay+dur
  pop(delay = 0, dur = 0.4, t = this.st) { const k = clamp((t - delay) / dur, 0, 1); return k <= 0 ? 0 : easeOutBack(k); }
  slide(delay = 0, dur = 0.35, t = this.st) { const k = clamp((t - delay) / dur, 0, 1); return 1 - Math.pow(1 - k, 3); }

  // ---------------------------------------------------------------- effects drawn on top
  confetti(n = 60) {
    const cols = ['#ff3d6b', '#ffd21a', '#2f7cf6', '#46d35c', '#ffffff', '#ff8a1f'];
    for (let i = 0; i < n; i++) this.fx.push({ kind: 'conf', x: Math.random() * this.w, y: -20 - Math.random() * 80, vx: (Math.random() - 0.5) * 60, vy: 140 + Math.random() * 160, r: Math.random() * 6, vr: (Math.random() - 0.5) * 10, col: cols[i % cols.length], delay: Math.random() * 0.8, t0: this.t, life: 3 });
  }
  flyGems(n, from, to) {
    const k = Math.min(12, Math.max(3, Math.round(n / 15)));
    for (let i = 0; i < k; i++) this.fx.push({ kind: 'gem', x0: from.x + (Math.random() - 0.5) * 60, y0: from.y + (Math.random() - 0.5) * 30, x1: to.x, y1: to.y, delay: i * 0.06, t0: this.t, life: 1.1 });
  }
  drawFx() {
    const c = this.ctx;
    this.fx = this.fx.filter((p) => {
      const age = this.t - p.t0 - (p.delay || 0);
      if (age < 0) return true;
      if (age > p.life) return false;
      if (p.kind === 'conf') {
        const x = p.x + p.vx * age, y = p.y + p.vy * age;
        c.save(); c.translate(x, y); c.rotate(p.r + p.vr * age); c.fillStyle = p.col; c.fillRect(-5, -8, 10, 16); c.restore();
      } else {
        const k = Math.min(1, age / p.life), e = k < 0.2 ? 0 : (k - 0.2) / 0.8, ee = e * e;
        const x = p.x0 + (p.x1 - p.x0) * ee, y = p.y0 + (p.y1 - p.y0) * ee - Math.sin(e * Math.PI) * 60;
        const s = (k < 0.2 ? k / 0.2 * 1.3 : 1.3 - e * 0.6) * 26;
        this.gem(x, y, s);
      }
      return true;
    });
  }
  drawToasts() {
    this.toasts = this.toasts.filter((t) => {
      const age = this.t - t.t0; if (age > 1.6) return false;
      const k = this.pop(0, 0.35, age), a = age > 1.2 ? 1 - (age - 1.2) / 0.4 : 1;
      const c = this.ctx, size = 22, w = Math.min(this.w - 24, this.measure(t.text, size) + 44), h = 48, x = this.w / 2 - w / 2, y = this.h * 0.4 - (age > 1.2 ? (age - 1.2) * 50 : 0);
      c.save(); c.globalAlpha = a; c.translate(this.w / 2, y + h / 2); c.scale(k, k); c.translate(-this.w / 2, -(y + h / 2));
      this.rr(x - 3, y - 3, w + 6, h + 6, 18); c.fillStyle = '#fff'; c.fill();
      this.rr(x, y, w, h, 16); c.fillStyle = t.color; c.fill(); c.lineWidth = 3; c.strokeStyle = INK; c.stroke();
      this.text(t.text, this.w / 2, y + h / 2 + 1, size, '#fff', { maxW: w - 24 });
      c.restore();
      return true;
    });
  }
}
