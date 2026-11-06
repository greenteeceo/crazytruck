// Icons as SVG path data (24x24 grid), parsed once into canvas commands (M/L/C/Z only), so they
// draw the same in a browser and in the TikTok runtime (no Path2D or SVG needed).
const RAW = {
  play: 'M7 4.5v15a1 1 0 0 0 1.5.86l12-7.5a1 1 0 0 0 0-1.72l-12-7.5A1 1 0 0 0 7 4.5z',
  pause: 'M6.5 4h2a1.5 1.5 0 0 1 1.5 1.5v13a1.5 1.5 0 0 1-1.5 1.5h-2A1.5 1.5 0 0 1 5 18.5v-13A1.5 1.5 0 0 1 6.5 4zM15.5 4h2a1.5 1.5 0 0 1 1.5 1.5v13a1.5 1.5 0 0 1-1.5 1.5h-2a1.5 1.5 0 0 1-1.5-1.5v-13A1.5 1.5 0 0 1 15.5 4z',
  retry: 'M12 4a8 8 0 1 0 7.75 10h-2.6A5.5 5.5 0 1 1 12 6.5c1.5 0 2.9.6 3.9 1.6L13 11h7V4l-2.3 2.3A8 8 0 0 0 12 4z',
  home: 'M12 3 2 12h3v8h5v-5h4v5h5v-8h3z',
  levels: 'M4.5 4h15a1.5 1.5 0 0 1 0 3.5h-15a1.5 1.5 0 0 1 0-3.5zM4.5 10.25h15a1.5 1.5 0 0 1 0 3.5h-15a1.5 1.5 0 0 1 0-3.5zM4.5 16.5h15a1.5 1.5 0 0 1 0 3.5h-15a1.5 1.5 0 0 1 0-3.5z',
  worlds: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm6.9 6h-3a15.6 15.6 0 0 0-1.4-3.6A8 8 0 0 1 18.9 8zM12 4c.8 1.2 1.5 2.5 1.9 4h-3.8c.4-1.5 1.1-2.8 1.9-4zM4.3 14a8.2 8.2 0 0 1 0-4h3.4a16 16 0 0 0 0 4zm.8 2h3a15.6 15.6 0 0 0 1.4 3.6A8 8 0 0 1 5.1 16zm3-8h-3a8 8 0 0 1 4.4-3.6C8.9 5.5 8.4 6.7 8.1 8zM12 20c-.8-1.2-1.5-2.5-1.9-4h3.8c-.4 1.5-1.1 2.8-1.9 4zm2.3-6H9.7a14.7 14.7 0 0 1 0-4h4.6a14.7 14.7 0 0 1 0 4zm.2 5.6c.6-1.1 1.1-2.3 1.4-3.6h3a8 8 0 0 1-4.4 3.6zm1.8-5.6a16 16 0 0 0 0-4h3.4a8.2 8.2 0 0 1 0 4z',
  trophy: 'M7 3h10v2h4v3a5 5 0 0 1-4.6 5 5 5 0 0 1-3.4 2.9V18h3v3H8v-3h3v-2.1A5 5 0 0 1 7.6 13 5 5 0 0 1 3 8V5h4zm10 4v4a3 3 0 0 0 2-3V7zM5 7v1a3 3 0 0 0 2 3V7z',
  settings: 'M19.4 13a7.7 7.7 0 0 0 0-2l2.1-1.6-2-3.5-2.5 1a7.4 7.4 0 0 0-1.7-1L15 3h-4l-.4 2.7a7.4 7.4 0 0 0-1.7 1l-2.5-1-2 3.5L6.6 11a7.7 7.7 0 0 0 0 2l-2.1 1.6 2 3.5 2.5-1a7.4 7.4 0 0 0 1.7 1L11 21h4l.4-2.7a7.4 7.4 0 0 0 1.7-1l2.5 1 2-3.5zM13 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z',
  shop: 'M7 18a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm10 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM1 2v2h2l3.6 7.6-1.4 2.4A2 2 0 0 0 7 17h12v-2H7.4l1.1-2h7.5a2 2 0 0 0 1.7-1l3.6-6.5A1 1 0 0 0 20.4 4H5.2l-.9-2z',
  lock: 'M6 10V8a6 6 0 1 1 12 0v2h1a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V11a1 1 0 0 1 1-1zm2 0h8V8a4 4 0 1 0-8 0z',
  left: 'M15.5 3.5 7 12l8.5 8.5 2.1-2.1L11.2 12l6.4-6.4z',
  right: 'm8.5 3.5 8.5 8.5-8.5 8.5-2.1-2.1 6.4-6.4-6.4-6.4z',
  next: 'M5 4.5v15a1 1 0 0 0 1.5.86L16 14.4V20h3V4h-3v5.6L6.5 3.64A1 1 0 0 0 5 4.5z',
  star: 'm12 2 3 6.6 7.2.7-5.4 4.9 1.6 7.1L12 17.6l-6.4 3.7 1.6-7.1L1.8 9.3 9 8.6z',
  check: 'm9.5 16.2-4.2-4.2-2.1 2.1 6.3 6.3L21 9l-2.1-2.1z',
  gem: 'M12 2 22 12 12 22 2 12z',
  sound: 'M3 9v6h4l5 5V4L7 9zm13.5 3A4.5 4.5 0 0 0 14 8v8a4.5 4.5 0 0 0 2.5-4zM14 3.2v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6z',
  flagpole: 'M4 2h2v20H4z',
  flag: 'M4 2h2v20H4zM7 3h13l-3.5 5 3.5 5H7z',
  // TikTok capabilities
  addhome: 'M7 1h10a2 2 0 0 1 2 2v18a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2zm0 3v15h10V4zm4 3h2v3h3v2h-3v3h-2v-3H8v-2h3z',
  sidebar: 'M12 2a5 5 0 1 1 0 10 5 5 0 0 1 0-10zM3 21c0-4 4-7 9-7s9 3 9 7v1H3z',
  share: 'M18 2a3 3 0 1 1-2.8 4.1L8.9 9.4a3 3 0 0 1 0 2.2l6.3 3.3A3 3 0 1 1 15 16.4l-6.3-3.3a3 3 0 1 1 0-3.2l6.3-3.3A3 3 0 0 1 18 2z',
  video: 'M3 5h13a2 2 0 0 1 2 2v2.5l4-3v11l-4-3V17a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zm5 3.5v7l5.5-3.5z',
  heart: 'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54z',
  bulb: 'M9 20h6v1.5a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1zm3-18a7 7 0 0 0-4 12.7V17a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-2.3A7 7 0 0 0 12 2z',
  hand: 'M9 11.24V7.5a2.5 2.5 0 0 1 5 0v3.74c1.21-.81 2-2.18 2-3.74C16 5.01 13.99 3 11.5 3S7 5.01 7 7.5c0 1.56.79 2.93 2 3.74zm9.84 4.63-4.54-2.26c-.17-.07-.35-.11-.54-.11H13v-6a1.5 1.5 0 0 0-3 0v10.74l-3.43-.72c-.08-.01-.15-.03-.24-.03-.31 0-.59.13-.79.33l-.79.8 4.94 4.94c.27.27.65.44 1.06.44h6.79c.75 0 1.33-.55 1.44-1.28l.75-5.27c.01-.07.02-.14.02-.2 0-.62-.38-1.16-.91-1.38z',
  rocket: 'M12 1.5c3.2 2.3 5 6.2 5 10.5l-1.8 3.2H8.8L7 12c0-4.3 1.8-8.2 5-10.5zm0 6a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM6.6 13.4 4 16.5l1 3.5 3.1-2.6zm10.8 0L20 16.5l-1 3.5-3.1-2.6zM10 16.5h4l-.8 4.5h-2.4z',
  spring: 'M12 1.5 18 8h-4v3.5h-4V8H6zM5 13h14v2.2H5zm2 3.4h10v2.2H7zM5 19.8h14V22H5z',
  wings: 'M12 9.5C9.5 5 4.5 3.8 1 4.8c2 1.2 3 3.2 3 5.2 3-.9 5.8-.9 8 .2zm0 0c2.5-4.5 7.5-5.7 11-4.7-2 1.2-3 3.2-3 5.2-3-.9-5.8-.9-8 .2zM8.5 12h7l-1.2 7h-4.6z',
  shield: 'M12 1.5 20 4.6v6.3c0 5.2-3.4 9.9-8 11.6-4.6-1.7-8-6.4-8-11.6V4.6z',
  magnet: 'M4 3h5v8.5a3 3 0 0 0 6 0V3h5v8.5a8 8 0 0 1-16 0zm0 0v3.5h5V3zm11 0v3.5h5V3z',
  gift: 'M3 8h18v4H3zM4 13h7v9H4zm9 0h7v9h-7zM11 8h2v14h-2zM12 8C10 4 6 3 6 6s4 2 6 2zm0 0c2-4 6-5 6-2s-4 2-6 2z',
};

const cache = {};
const num = /-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi;

function arcToBeziers(x1, y1, rx, ry, phi, fa, fs, x2, y2) {
  if (rx === 0 || ry === 0) return [[x2, y2, x2, y2, x2, y2]];
  const s = Math.sin(phi * Math.PI / 180), c = Math.cos(phi * Math.PI / 180);
  const dx = (x1 - x2) / 2, dy = (y1 - y2) / 2;
  const x1p = c * dx + s * dy, y1p = -s * dx + c * dy;
  rx = Math.abs(rx); ry = Math.abs(ry);
  const lam = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lam > 1) { rx *= Math.sqrt(lam); ry *= Math.sqrt(lam); }
  const sign = fa === fs ? -1 : 1;
  const num2 = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
  const co = sign * Math.sqrt(Math.max(0, num2 / (rx * rx * y1p * y1p + ry * ry * x1p * x1p)));
  const cxp = co * rx * y1p / ry, cyp = -co * ry * x1p / rx;
  const cx = c * cxp - s * cyp + (x1 + x2) / 2, cy = s * cxp + c * cyp + (y1 + y2) / 2;
  const ang = (ux, uy, vx, vy) => { const d = ux * vx + uy * vy, l = Math.hypot(ux, uy) * Math.hypot(vx, vy); let a = Math.acos(Math.max(-1, Math.min(1, d / l))); if (ux * vy - uy * vx < 0) a = -a; return a; };
  let t1 = ang(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let dt = ang((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
  if (!fs && dt > 0) dt -= Math.PI * 2; else if (fs && dt < 0) dt += Math.PI * 2;
  const segs = Math.ceil(Math.abs(dt) / (Math.PI / 2)), d = dt / segs, out = [];
  const k = (4 / 3) * Math.tan(d / 4);
  const pt = (t) => [cx + rx * Math.cos(t) * c - ry * Math.sin(t) * s, cy + rx * Math.cos(t) * s + ry * Math.sin(t) * c];
  const dv = (t) => [-rx * Math.sin(t) * c - ry * Math.cos(t) * s, -rx * Math.sin(t) * s + ry * Math.cos(t) * c];
  for (let i = 0; i < segs; i++) {
    const a = t1 + i * d, b = a + d, p0 = pt(a), p1 = pt(b), d0 = dv(a), d1 = dv(b);
    out.push([p0[0] + k * d0[0], p0[1] + k * d0[1], p1[0] - k * d1[0], p1[1] - k * d1[1], p1[0], p1[1]]);
  }
  return out;
}

function parse(d) {
  const out = [];
  const toks = d.match(/[a-zA-Z]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi);
  let i = 0, x = 0, y = 0, sx = 0, sy = 0, cmd = '', lcx = 0, lcy = 0, prev = '';
  const n = () => parseFloat(toks[i++]);
  const flag = () => {
    // arc flags may be packed like "0 01" -> read a single digit
    const t = toks[i];
    if (t.length > 1 && (t[0] === '0' || t[0] === '1')) { toks[i] = t.slice(1); return +t[0]; }
    i++; return +t;
  };
  while (i < toks.length) {
    if (/[a-zA-Z]/.test(toks[i])) cmd = toks[i++];
    const rel = cmd === cmd.toLowerCase(), C = cmd.toUpperCase();
    const bx = rel ? x : 0, by = rel ? y : 0;
    if (C === 'M') { x = bx + n(); y = by + n(); sx = x; sy = y; out.push(['M', x, y]); cmd = rel ? 'l' : 'L'; }
    else if (C === 'L') { x = bx + n(); y = by + n(); out.push(['L', x, y]); }
    else if (C === 'H') { x = (rel ? x : 0) + n(); out.push(['L', x, y]); }
    else if (C === 'V') { y = (rel ? y : 0) + n(); out.push(['L', x, y]); }
    else if (C === 'C') { const a = [bx + n(), by + n(), bx + n(), by + n(), bx + n(), by + n()]; out.push(['C', ...a]); lcx = a[2]; lcy = a[3]; x = a[4]; y = a[5]; }
    else if (C === 'S') { const r1x = /[CS]/i.test(prev) ? 2 * x - lcx : x, r1y = /[CS]/i.test(prev) ? 2 * y - lcy : y; const a = [bx + n(), by + n(), bx + n(), by + n()]; out.push(['C', r1x, r1y, ...a]); lcx = a[0]; lcy = a[1]; x = a[2]; y = a[3]; }
    else if (C === 'Q') { const qx = bx + n(), qy = by + n(), ex = bx + n(), ey = by + n(); out.push(['C', x + (2 / 3) * (qx - x), y + (2 / 3) * (qy - y), ex + (2 / 3) * (qx - ex), ey + (2 / 3) * (qy - ey), ex, ey]); x = ex; y = ey; }
    else if (C === 'A') {
      const rx = n(), ry = n(), rot = n(), fa = flag(), fs = flag(), ex = bx + n(), ey = by + n();
      for (const b of arcToBeziers(x, y, rx, ry, rot, fa, fs, ex, ey)) out.push(['C', ...b]);
      x = ex; y = ey;
    } else if (C === 'Z') { out.push(['Z']); x = sx; y = sy; }
    else i++;
    prev = C;
  }
  return out;
}
void num;

export function iconPath(ctx, name, x, y, size) {
  const cmds = cache[name] ||= parse(RAW[name] || RAW.star);
  const k = size / 24;
  ctx.beginPath();
  for (const c of cmds) {
    if (c[0] === 'M') ctx.moveTo(x + c[1] * k, y + c[2] * k);
    else if (c[0] === 'L') ctx.lineTo(x + c[1] * k, y + c[2] * k);
    else if (c[0] === 'C') ctx.bezierCurveTo(x + c[1] * k, y + c[2] * k, x + c[3] * k, y + c[4] * k, x + c[5] * k, y + c[6] * k);
    else ctx.closePath();
  }
}

// Filled icon with the game's dark drop shadow.
export function icon(ctx, name, x, y, size, color = '#fff', shadow = true) {
  if (shadow) { iconPath(ctx, name, x, y + size * 0.08, size); ctx.fillStyle = 'rgba(17,19,28,0.9)'; ctx.fill(); }
  iconPath(ctx, name, x, y, size); ctx.fillStyle = color; ctx.fill();
}

export const ICONS = Object.keys(RAW);
