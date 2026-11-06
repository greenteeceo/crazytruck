// One API for the three places the game runs: browser / artifact, the Android app (WebView),
// and the TikTok Mini Games native runtime (tt). In the TikTok build only the tt APIs that the HS Android app
// also has are used (canvas, touch, storage, font, audio, show / hide, vibrate).

const g = globalThis;
const T = [g.tt, g.TTMinis?.game, g.wx].find((x) => x && typeof x.createCanvas === 'function') || null;   // the runtime's tt
const isTT = !!T && typeof g.__mainCanvas !== 'undefined';

function sysInfo() {
  if (isTT && T.getSystemInfoSync) {
    const i = T.getSystemInfoSync() || {};
    const w = i.windowWidth || 360, h = i.windowHeight || 640, sa = i.safeArea || null;
    return { w, h, dpr: i.pixelRatio || 2, top: sa ? sa.top : (i.statusBarHeight || 0), bottom: sa && sa.bottom ? Math.max(0, h - sa.bottom) : 0 };
  }
  const css = (v) => { try { return parseFloat(getComputedStyle(document.documentElement).getPropertyValue(v)) || 0; } catch { return 0; } };
  return { w: g.innerWidth, h: g.innerHeight, dpr: g.devicePixelRatio || 1, top: css('--sat'), bottom: css('--sab') };
}

export const P = {
  kind: isTT ? 'tiktok' : 'web',
  isTT,
  T,
  info: sysInfo(),

  // ---------------------------------------------------------------- canvas
  mainCanvas() {
    if (isTT) return g.__mainCanvas;
    return document.getElementById('gl');
  },
  createCanvas(w, h) {
    const c = isTT ? T.createCanvas() : document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  },

  onResize(cb) {
    if (isTT) return;   // a mini game's window does not resize
    g.addEventListener('resize', () => { P.info = sysInfo(); cb(P.info); });
  },

  // ---------------------------------------------------------------- input: normalized touches in CSS px
  onTouch({ start, move, end }) {
    if (isTT) {
      // Touch fields are not spelled out in TikTok's docs: accept the usual names
      const map = (fn) => (e) => {
        (e.changedTouches || []).forEach((t, k) => fn({ id: t.identifier ?? t.id ?? k, x: t.clientX ?? t.pageX ?? t.x ?? 0, y: t.clientY ?? t.pageY ?? t.y ?? 0 }));
      };
      T.onTouchStart?.(map(start)); T.onTouchMove?.(map(move)); T.onTouchEnd?.(map(end)); T.onTouchCancel?.(map(end));
      return;
    }
    const el = document.getElementById('ui');
    // Fingers come in as touch events (a finger held still stays down for as long as it is held - phone browsers
    // can cancel a still pointer after a moment, which would let go of the throttle); mouse / pen as pointer events.
    const stop = (e) => { if (e.cancelable) e.preventDefault(); };
    const touchMap = (fn) => (e) => { stop(e); for (const t of e.changedTouches) fn({ id: 1000 + t.identifier, x: t.clientX, y: t.clientY }); };
    el.addEventListener('touchstart', touchMap(start), { passive: false });
    el.addEventListener('touchmove', touchMap(move), { passive: false });
    el.addEventListener('touchend', touchMap(end), { passive: false });
    el.addEventListener('touchcancel', touchMap(end), { passive: false });
    const map = (fn) => (e) => { if (e.pointerType === 'touch') return; e.preventDefault(); fn({ id: e.pointerId, x: e.clientX, y: e.clientY }); };
    el.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'touch') el.setPointerCapture?.(e.pointerId); map(start)(e); });
    el.addEventListener('pointermove', map(move));
    el.addEventListener('pointerup', map(end));
    el.addEventListener('pointercancel', map(end));
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    // a finger on the game must never zoom the page: no pinch, no double-tap zoom, no long-press magnifier
    // (the page may be embedded without our viewport tag, e.g. the web artifact)
    document.addEventListener('touchmove', (e) => { if (e.touches && e.touches.length > 1) stop(e); }, { passive: false });
    for (const ev of ['gesturestart', 'gesturechange', 'gestureend', 'dblclick']) document.addEventListener(ev, stop, { passive: false });
    try {
      if (!document.querySelector('meta[name=viewport]')) { const m = document.createElement('meta'); m.name = 'viewport'; m.content = 'width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover'; document.head.appendChild(m); }
    } catch { /* read-only head */ }
  },

  onKey(down, up) {
    if (isTT) return;
    g.addEventListener('keydown', (e) => down(e.code));
    g.addEventListener('keyup', (e) => up(e.code));
  },

  // ---------------------------------------------------------------- lifecycle
  onHide(cb) { if (isTT) T.onHide?.(cb); else { document.addEventListener('visibilitychange', () => document.hidden && cb()); g.addEventListener('blur', cb); } },
  onShow(cb) { if (isTT) T.onShow?.(cb); else document.addEventListener('visibilitychange', () => !document.hidden && cb()); },
  get hidden() { return isTT ? false : document.hidden; },

  // ---------------------------------------------------------------- storage
  load(key) {
    try { return isTT ? T.getStorageSync(key) || null : g.localStorage.getItem(key); } catch { return null; }
  },
  // only used once, to move the old save into the HSGame profile
  remove(key) {
    try { if (isTT) T.removeStorageSync(key); else g.localStorage.removeItem(key); } catch { /* blocked */ }
  },

  // ---------------------------------------------------------------- font
  // Web: the @font-face in index.html (base64 woff2). TikTok: fredoka.ttf shipped in the package.
  async loadFont() {
    if (isTT) { try { const f = T.loadFont?.('fredoka.ttf'); return typeof f === 'string' && f ? f : 'sans-serif'; } catch { return 'sans-serif'; } }
    try { await Promise.race([document.fonts.load('700 20px Fredoka'), new Promise((r) => setTimeout(r, 2500))]); return 'Fredoka'; } catch { return 'sans-serif'; }
  },

  // ---------------------------------------------------------------- audio (Web Audio API on both)
  // A picture for the canvas UI: the TikTok runtime loads it by file name from the package, the web from the
  // bundled data URL. Resolves to the image, or null when the runtime cannot load images (the game goes on).
  loadImage(dataUrl, file) {
    return new Promise((res) => {
      try {
        const img = isTT ? T.createImage?.() : new g.Image();
        if (!img) return res(null);
        img.onload = () => res(img); img.onerror = () => res(null);
        img.src = isTT ? file : dataUrl;
        setTimeout(() => res(img.width ? img : null), 3000);
      } catch { res(null); }
    });
  },
  audioContext() {
    try {
      if (isTT) return T.createWebAudioContext ? T.createWebAudioContext() : null;
      const AC = g.AudioContext || g.webkitAudioContext; return AC ? new AC() : null;
    } catch { return null; }
  },

  // kind: 'light' (a bump), 'medium' (a hard hit, a roll-over), 'heavy' (a crash); 'flip' = two pulses
  vibrate(kind = 'light') {
    try {
      if (isTT) { T.vibrateShort?.({ type: kind === 'flip' ? 'medium' : kind }); if (kind === 'flip') setTimeout(() => { try { T.vibrateShort?.({ type: 'light' }); } catch { /* */ } }, 140); }
      else g.navigator?.vibrate?.(kind === 'heavy' ? 70 : kind === 'medium' ? 35 : kind === 'flip' ? [35, 90, 20] : 15);
    } catch { /* not supported */ }
  },

  // Ads, rewards, TikTok missions, share, login and payments go through HSGame (hs-game.js) — never here.
};
