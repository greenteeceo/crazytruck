// One API for the three places the game runs: browser / artifact, the Android app (WebView),
// and the TikTok Mini Games native runtime (namespace TTMinis.game, also exposed as tt / wx).
import { TIKTOK, isPlaceholder } from './config.js';

const g = globalThis;
const T = g.TTMinis?.game || g.tt || g.wx || null;
const isTT = !!T && typeof g.__mainCanvas !== 'undefined';
const can = (name) => { try { return !!T && typeof T[name] === 'function' && (!T.canIUse || T.canIUse(name) !== false); } catch { return false; } };

function sysInfo() {
  if (isTT && T.getSystemInfoSync) {
    const i = T.getSystemInfoSync();
    const sa = i.safeArea || {};
    return { w: i.windowWidth, h: i.windowHeight, dpr: i.pixelRatio || 2, top: sa.top || i.statusBarHeight || 0, bottom: sa.bottom ? Math.max(0, i.windowHeight - sa.bottom) : 0 };
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
    if (isTT) { T.onWindowResize?.(() => { P.info = sysInfo(); cb(P.info); }); return; }
    g.addEventListener('resize', () => { P.info = sysInfo(); cb(P.info); });
  },

  // ---------------------------------------------------------------- input: normalized touches in CSS px
  onTouch({ start, move, end }) {
    if (isTT) {
      const map = (fn) => (e) => { for (const t of e.changedTouches || []) fn({ id: t.identifier, x: t.clientX, y: t.clientY }); };
      T.onTouchStart?.(map(start)); T.onTouchMove?.(map(move)); T.onTouchEnd?.(map(end)); T.onTouchCancel?.(map(end));
      return;
    }
    const el = document.getElementById('ui');
    const map = (fn) => (e) => { e.preventDefault(); fn({ id: e.pointerId, x: e.clientX, y: e.clientY }); };
    el.addEventListener('pointerdown', (e) => { el.setPointerCapture?.(e.pointerId); map(start)(e); });
    el.addEventListener('pointermove', map(move));
    el.addEventListener('pointerup', map(end));
    el.addEventListener('pointercancel', map(end));
    el.addEventListener('contextmenu', (e) => e.preventDefault());
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
  save(key, value) {
    try { if (isTT) T.setStorageSync(key, value); else g.localStorage.setItem(key, value); } catch { /* storage full or blocked */ }
  },

  // ---------------------------------------------------------------- font
  // Web: the @font-face in index.html (base64 woff2). TikTok: fredoka.ttf shipped in the package.
  async loadFont() {
    if (isTT) { try { return T.loadFont?.('fredoka.ttf') || 'sans-serif'; } catch { return 'sans-serif'; } }
    try { await Promise.race([document.fonts.load('700 20px Fredoka'), new Promise((r) => setTimeout(r, 2500))]); return 'Fredoka'; } catch { return 'sans-serif'; }
  },

  // ---------------------------------------------------------------- audio (Web Audio API on both)
  audioContext() {
    try {
      if (isTT) return T.createWebAudioContext ? T.createWebAudioContext() : null;
      const AC = g.AudioContext || g.webkitAudioContext; return AC ? new AC() : null;
    } catch { return null; }
  },

  vibrate() { try { if (isTT) T.vibrateShort?.({ type: 'light' }); else g.navigator?.vibrate?.(15); } catch { /* not supported */ } },

  // ---------------------------------------------------------------- TikTok startup
  setLoadingProgress(p) { try { if (isTT) T.setLoadingProgress?.({ progress: Math.min(1, p) }); } catch { /* old base library */ } },
  silentLogin() {
    // silent login: returns a code for a game server; kept for when a backend exists
    return new Promise((res) => { if (!can('login')) return res(null); T.login({ success: (r) => res(r?.code || null), fail: () => res(null) }); });
  },
  launchQuery() { try { return (isTT && T.getLaunchOptionsSync?.()) || {}; } catch { return {}; } },

  // ---------------------------------------------------------------- ads
  // A placeholder ad unit (or the web build) uses `fakeAd`, a local test ad drawn by the UI.
  fakeAd: null,
  hasRealAds(kind) { return isTT && !isPlaceholder(kind === 'rewarded' ? TIKTOK.rewardedAdUnitId : TIKTOK.interstitialAdUnitId); },

  showRewarded() {
    if (!this.hasRealAds('rewarded') || !can('createRewardedVideoAd')) return this.fakeAd ? this.fakeAd('rewarded') : Promise.resolve(false);
    return new Promise((resolve) => {
      let ad;
      try { ad = T.createRewardedVideoAd({ adUnitId: TIKTOK.rewardedAdUnitId }); } catch { return resolve(false); }
      const done = (ok) => { try { ad.offClose(); ad.offError(); } catch { /* ignore */ } resolve(ok); };
      ad.onClose((res) => done(!!(res && res.isEnded)));
      ad.onError(() => done(false));
      ad.show().catch(() => done(false));
    });
  },

  showInterstitial() {
    if (!this.hasRealAds('interstitial') || !can('createInterstitialAd')) return this.fakeAd ? this.fakeAd('interstitial') : Promise.resolve(false);
    return new Promise((resolve) => {
      let ad;
      try { ad = T.createInterstitialAd({ adUnitId: TIKTOK.interstitialAdUnitId }); } catch { return resolve(false); }
      const done = (ok) => { try { ad.offClose(); ad.offError(); } catch { /* ignore */ } resolve(ok); };
      ad.onClose(() => done(true));
      ad.onError(() => done(false));   // 11004 / 11005: shown too often, just skip
      ad.show().catch(() => done(false));
    });
  },

  // ---------------------------------------------------------------- the 3 TikTok capabilities
  // 1. Add to Home Screen
  canShortcut() { return can('addShortcut'); },
  addShortcut() {
    return new Promise((res) => { if (!can('addShortcut')) return res(false); T.addShortcut({ success: () => res(true), fail: () => res(false) }); });
  },
  shortcutReward() {
    return new Promise((res) => { if (!can('getShortcutMissionReward')) return res(false); T.getShortcutMissionReward({ success: (r) => res(!!r?.canReceiveReward), fail: () => res(false) }); });
  },
  // 2. Revisit from Profile (sidebar)
  canSidebar() { return can('startEntranceMission'); },
  startSidebar() {
    return new Promise((res) => { if (!can('startEntranceMission')) return res(false); T.startEntranceMission({ success: () => res(true), fail: () => res(false) }); });
  },
  sidebarReward() {
    return new Promise((res) => { if (!can('getEntranceMissionReward')) return res(false); T.getEntranceMissionReward({ success: (r) => res(!!r?.canReceiveReward), fail: () => res(false) }); });
  },
  // 3. Share
  canShare() { return can('shareAppMessage') || (!isTT && !!g.navigator?.share); },
  share({ title, desc, query }) {
    if (isTT) {
      return new Promise((res) => {
        if (!can('shareAppMessage')) return res(false);
        T.shareAppMessage({ title, desc, query, success: () => res(true), fail: () => res(false) });
      });
    }
    if (g.navigator?.share) return g.navigator.share({ title, text: desc }).then(() => true, () => false);
    return Promise.resolve(false);
  },
};
