// Minimal browser globals for the TikTok native runtime (no DOM there). three.js and our
// texture code only need `document.createElement('canvas')`, `window` and a few no-op hooks.
// Imported first in the TikTok build; does nothing in a real browser.
const g = globalThis;
const T = g.TTMinis?.game || g.tt || g.wx;

if (typeof g.document === 'undefined' && T) {
  const noop = () => {};
  // the first createCanvas() call in the runtime returns the on-screen canvas
  g.__mainCanvas ||= T.createCanvas();
  g.__mainCanvas.style ||= {};
  g.__mainCanvas.addEventListener ||= noop; g.__mainCanvas.removeEventListener ||= noop;
  const info = T.getSystemInfoSync ? T.getSystemInfoSync() : {};
  g.window = g;
  g.devicePixelRatio = info.pixelRatio || 2;
  g.innerWidth = info.windowWidth || 360;
  g.innerHeight = info.windowHeight || 640;
  g.addEventListener ||= noop; g.removeEventListener ||= noop;
  g.navigator ||= { userAgent: 'tiktok-minigame', platform: info.platform || '' };
  g.document = {
    createElement: (tag) => (tag === 'canvas' ? T.createCanvas() : { style: {}, appendChild: noop, addEventListener: noop }),
    createElementNS: (_ns, tag) => g.document.createElement(tag),
    getElementById: () => null,
    body: { appendChild: noop, removeChild: noop, style: {} },
    documentElement: { style: {} },
    addEventListener: noop, removeEventListener: noop,
    hidden: false,
  };
  g.performance ||= { now: () => Date.now() };
  g.requestAnimationFrame ||= T.requestAnimationFrame || ((f) => setTimeout(() => f(g.performance.now()), 16));
  g.cancelAnimationFrame ||= T.cancelAnimationFrame || clearTimeout;
  g.HTMLCanvasElement ||= class {};
  g.HTMLImageElement ||= class {};
}
