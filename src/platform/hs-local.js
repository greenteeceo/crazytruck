// A small stand-in for HSGame (hs-game.js) used by the web / artifact build, where the HS kit and TikTok are
// not available. Same API subset as the kit, so main.js is the same code everywhere: progress in a profile
// (browser storage), rewards from DEFAULTS, test ads (the game's own "TEST AD" panel), test missions.
// The TikTok build defines the real HSGame before this file runs, and this file then does nothing.
import { PRODUCTS } from '../economy.js';
const g = globalThis;
if (!g.HSGame) {
  const store = { get: (k) => { try { return g.localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { g.localStorage.setItem(k, v); } catch { /* blocked */ } } };
  const listeners = {}, emit = (n, ...a) => (listeners[n] || []).forEach((f) => { try { f(...a); } catch (e) { console.error(e); } });
  let P = null, defaults = { rewards: {}, items: {} }, onGive = null;
  const claims = JSON.parse(store.get('hslocal.claims') || '{}');
  const today = () => new Date().toDateString();
  const used = (key, limit) => (limit === 'once' ? !!claims[key] : limit === 'daily' ? claims[key] === today() : false);
  const mark = (key) => { claims[key] = today(); store.set('hslocal.claims', JSON.stringify(claims)); };
  const give = (items, from) => {
    const special = {};
    const changes = {};
    for (const [id, n] of Object.entries(items)) { if (id === '$limit') continue; if (P && typeof P.defs[id] === 'number') changes[id] = (Number(P.data[id]) || 0) + n; else special[id] = n; }
    if (Object.keys(special).length && onGive) onGive({ ...special }, from);
    if (Object.keys(changes).length) P.api.update(changes);
    emit('given', { ...items }, from);
  };
  const entry = (key) => defaults.rewards[key] || null;
  const itemsOf = (e) => { const o = { ...e }; delete o.$limit; return o; };
  const INTERSTITIAL = new Set(['level_end', 'race_end']);
  g.HSGame = {
    local: true, platform: 'browser', version: 'local',
    profile(defs, opts = {}) {
      if (P) return P.api;
      const saved = JSON.parse(store.get('hslocal.profile') || 'null');
      P = { defs: { ...defs }, data: { ...defs, ...(saved || {}) }, on: {} };
      let t = null;
      const write = () => store.set('hslocal.profile', JSON.stringify(P.data));
      const apply = (ch) => {
        for (const [f, v] of Object.entries(ch)) { const before = P.data[f]; P.data[f] = v; (P.on[f] || []).forEach((cb) => cb(v, before)); }
        clearTimeout(t); t = setTimeout(write, 300);
      };
      P.api = {
        get: (f) => (P.data[f] && typeof P.data[f] === 'object' ? JSON.parse(JSON.stringify(P.data[f])) : P.data[f]),
        all: () => JSON.parse(JSON.stringify(P.data)),
        set: (f, v) => apply({ [f]: v }), add: (f, n) => apply({ [f]: (Number(P.data[f]) || 0) + n }), update: (o) => apply(o),
        on: (f, cb) => { (P.on[f] ||= []).push(cb); return () => {}; }, flush: write,
      };
      g.addEventListener?.('pagehide', write);
      return P.api;
    },
    start(opts = {}) { defaults = opts.defaults || defaults; onGive = opts.onGive || null; return Promise.resolve({ loggedIn: false, reason: 'local preview' }); },
    claim(key) { const e = entry(key); if (!e || used(key, e.$limit)) return null; mark(key); const it = itemsOf(e); give(it, 'claim:' + key); return it; },
    rewards(key) { const e = entry(key); return e ? itemsOf(e) : null; },
    available(key) { const e = entry(key); return !!e && !used(key, e.$limit); },
    item(id) { return defaults.items[id] || null; },
    canShowAd() { return true; },
    showAd(place) {
      return Promise.resolve(g.__fakeAd ? g.__fakeAd(INTERSTITIAL.has(place) ? 'interstitial' : 'rewarded') : false).then((ok) => {
        if (!ok) return null;
        const e = entry(place); if (!e) return {};
        const it = itemsOf(e); give(it, 'ad:' + place); return it;
      });
    },
    canShare() { return true; },
    share(opts) {
      const done = () => { const e = entry('share'); if (!e || used('share', e.$limit)) return {}; mark('share'); const it = itemsOf(e); give(it, 'share'); return it; };
      if (g.navigator?.share) return g.navigator.share({ title: opts.title, text: opts.subtitle }).then(done, () => null);
      return Promise.resolve(done());
    },
    tiktokMission: {
      supported: () => true,
      start(kind) { const key = kind === 'profile' ? 'tiktok_profile' : 'tiktok_shortcut'; if (!used(key, 'once')) { claims[key] = 'done'; store.set('hslocal.claims', JSON.stringify(claims)); give(itemsOf(entry(key) || {}), key); } return Promise.resolve(true); },
      done(kind) { return !!claims[kind === 'profile' ? 'tiktok_profile' : 'tiktok_shortcut']; },
    },
    _products: PRODUCTS,
    shop() { return Promise.resolve(this._products.map((p) => ({ product_id: p.id, name: p.name, description: p.description, beans_cost: p.beans_cost, price: p.price_usd, items: p.rewards, badge: p.badge }))); },
    buy() { return Promise.resolve({ ok: false, error: 'Purchases work in the published game' }); },
    restore() { return Promise.resolve({ ok: true, restored: [], owned: [] }); },
    has(f) { return f === 'ads' || f === 'share' || f === 'shop' || f === 'tiktok_missions'; },
    on(name, cb) { (listeners[name] ||= []).push(cb); return () => {}; },
    takeOver() {}, login() { return Promise.resolve({ loggedIn: false }); },
    canSignIn: false, loggedIn: false, paused: false,
  };
}
