// Crane Rush: game flow, screens (drawn on a canvas by ui/kit.js), input, ads and main loop.
import { DT } from './sim.js';
import { WORLDS, RACE_TRACKS } from './levels.js';
import { makeRacer, racerWatch, respawnAt, trackSafe } from './racer.js';
import { VEHICLES, vehicleById, UPGRADES, MAX_UPGRADE, upgradeCost, withUpgrades } from './vehicles.js';
import { makeBot, makePlayer } from './bot.js';
import { Renderer, setLabelFont } from './render.js';
import { Audio } from './audio.js';
import { P } from './platform/index.js';
import './platform/hs-local.js';   // web / artifact build: a local stand-in for HSGame (does nothing in the TikTok build)
import { REWARDS, DEV_TOOLS, HS_GAME_ID, HS_SDK_KEY } from './platform/config.js';
import { DEFAULTS, STARTER_ID, AD_FREE_ENDS } from './economy.js';
import { UI, INK, GOLD, GRAD } from './ui/kit.js';
import PARS from './pars.json';
import { board, rankOf, BOARD_SIZE } from './leaderboard.js';

// ------------------------------------------------------------ save: all progress in ONE HSGame profile
// (hs-game.js keeps it on the phone and in the cloud). Gems and trophies are profile fields (rewards are credited
// to them by HSGame); everything else lives in the profile field `game`. `save` is a view over the profile.
const defaults = { upgrades: {}, owned: ['crane'], car: 'crane', levels: {}, world: 0, cups: {}, cup: { idx: 0, race: 0, pts: null }, sound: true, shadows: true, tt: {} };
const profile = HSGame.profile({ gems: 0, trophies: 0, stars: 0, starter: 0, game: null }, {
  save: 'cloud', merge: { trophies: 'max', stars: 'max', starter: 'max' }, summary: 'stars',
});
// one-time move of the old local save into the profile
(() => {
  const OLD_KEY = 'cranerush.save.v2', old = P.load(OLD_KEY);
  if (!old) return;
  try { if (!profile.get('game')) { const { diamonds = 0, trophies = 0, items, ...rest } = JSON.parse(old); void items; profile.update({ gems: diamonds, trophies, game: rest }); } } catch { /* unreadable: start fresh */ }
  P.remove(OLD_KEY);
})();
function makeSave(data) {
  const s = { ...defaults, ...(data || {}) };
  delete s.diamonds; delete s.trophies; delete s.items;
  Object.defineProperty(s, 'diamonds', { get: () => profile.get('gems') || 0, set: (v) => profile.set('gems', Math.max(0, Math.round(v))), enumerable: false });
  Object.defineProperty(s, 'trophies', { get: () => profile.get('trophies') || 0, set: (v) => profile.set('trophies', v), enumerable: false });
  return s;
}
let save = makeSave(profile.get('game'));
save.tt ||= {};
save.tut ||= {};   // tutorial steps already shown
// dev tools (Autoplay, All resources, AUTO / TEST chips): on while DEV_TOOLS is true (config.js),
// otherwise hidden until the version line in Settings is tapped 5 times
const VERSION = '3.12';
const dev = () => DEV_TOOLS || !!save.dev;
if (save.allRes == null) save.allRes = !!(save.infinite && save.unlockAll);
if (!dev()) save.autoplay = save.allRes = false;
// "All resources": infinite gems, every truck, every world, level and cup open
save.infinite = save.unlockAll = !!save.allRes;
const owns = (id) => save.allRes || save.owned.includes(id);
// leaderboard: per-device seed for the simulated players, and when this player joined
if (!save.lb) save.lb = { seed: (Math.random() * 2 ** 31) | 0, start: Date.now() };
const persist = () => {
  profile.set('game', JSON.parse(JSON.stringify(save)));
  profile.set('stars', Object.values(save.levels).reduce((a, v) => a + (v?.stars || 0), 0));
};

// ------------------------------------------------------------ canvases
const glCanvas = P.mainCanvas();
const uiCanvas = P.isTT ? P.createCanvas(2, 2) : document.getElementById('ui');
// No usable WebGL (a broken device, or a test runtime like hs-check): the menus, saves, rewards and ads still
// work; the 3D view becomes a no-op instead of crashing the whole game at load.
const noRender = () => { const d = new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => 0 : k === 'then' ? undefined : d), set: () => true, apply: () => d, construct: () => d }); return d; };
let R;
try { R = new Renderer(glCanvas); } catch (e) { console.warn('3D view unavailable:', e && e.message); R = noRender(); }
// a slow moment last session should not make the game blurry forever: retry one tier sharper each launch
R.setQuality(Math.max(0, (save.quality ?? 0) - 1));
R.setShadows(save.shadows);
R.onQuality = (q) => { save.quality = q; persist(); };
if (P.isTT) R.setOverlay(uiCanvas);
const ui = new UI(uiCanvas);
ui.maxFps = P.isTT ? 30 : 60;
const fitUI = () => ui.resize(P.info.w, P.info.h, P.info.dpr, P.info.top, P.info.bottom);
fitUI();
P.onResize(fitUI);
ui.onAny = () => Audio.unlock();
Audio.setEnabled(save.sound);

const fmt = (t) => { if (t == null) return '--:--.--'; const m = Math.floor(t / 60), s = t - m * 60; return `${m}:${s.toFixed(2).padStart(5, '0')}`; };
const ord = (n) => n + (['th', 'st', 'nd', 'rd'][(n % 100 > 10 && n % 100 < 14) ? 0 : n % 10] || 'th');
const tap = (fn) => () => { Audio.click(); fn(); };

// ------------------------------------------------------------ gems (dev option: infinite gems)
const canAfford = (n) => save.infinite || save.diamonds >= n;
const spend = (n) => { if (!save.infinite) save.diamonds -= n; };
// the counter catches up with the real balance after flying-gem animations
let gemShown = save.diamonds, gemFrom = save.diamonds, gemAnimT = -1, gemBump = -1;
function earnGems(n, from) {
  if (n <= 0) return;
  gemFrom = gemShownNow(); save.diamonds += n; persist();
  gemAnimT = ui.t + 1.05; gemBump = gemAnimT;
  if (from && gemPill) ui.flyGems(n, from, gemPill);
  ui.request(2.4);
}
// a reward HSGame already put in the profile: just the flying gems and the counter catching up
function animateGems(n, from) {
  if (n <= 0) return;
  gemFrom = save.diamonds - n; gemAnimT = ui.t + 1.05; gemBump = gemAnimT;
  if (from && gemPill) ui.flyGems(n, from, gemPill);
  ui.request(2.4);
}
function gemShownNow() {
  if (gemAnimT < 0 || ui.t >= gemAnimT + 0.5) return (gemShown = save.diamonds);
  if (ui.t < gemAnimT) return gemFrom;
  const k = (ui.t - gemAnimT) / 0.5; return Math.round(gemFrom + (save.diamonds - gemFrom) * k);
}
const gemsText = () => (save.infinite ? '∞' : String(gemShownNow()));

// ------------------------------------------------------------ progress helpers
const lvlSave = (l) => save.levels[l.id] || null;
const worldDone = (w) => WORLDS[w].levels.filter((l) => lvlSave(l)?.time != null).length;
const totalStars = () => Object.values(save.levels).reduce((a, v) => a + (v?.stars || 0), 0);
// For now only the first 7 worlds (140 levels) are open; the rest stay hidden until they are unlocked in an update
const OPEN_WORLDS = 7;
if (save.world >= OPEN_WORLDS) save.world = 0;
const starsNeeded = (w) => Math.max(0, (WORLDS[w].starsReq || 0) - totalStars());
let testRun = null;   // active automated test session (see startTest)
const worldUnlocked = (w) => w < OPEN_WORLDS && (save.unlockAll || !!testRun || w === 0 || (worldDone(w - 1) >= 5 && starsNeeded(w) === 0));
const levelUnlocked = (l) => save.unlockAll || l.index === 0 || lvlSave(WORLDS[l.world].levels[l.index - 1])?.time != null;
const par = (l) => Math.ceil((PARS[l.id] ?? 10) * 1.25 * 2) / 2;
// Every level has a countdown: reach the finish before it runs out. How much time depends on the level - the
// crane's own drive time (pars) with room to spare: generous on the warm-ups, tighter on the hard levels (5, 10, 15, 20).
const timeLimit = (l) => { const li = l.index, k = li < 3 ? 2.6 : (li + 1) % 5 === 0 ? 1.9 : 2.2; return Math.ceil((PARS[l.id] ?? 12) * k + 6); };
const TIME_GEMS = 2;          // gems per second left on the clock at the finish
const MAX_CONTINUES = 2;      // video continues per level attempt, then it is game over
const totalDone = () => WORLDS.slice(0, OPEN_WORLDS).reduce((a, _, i) => a + worldDone(i), 0);
const today = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
const yesterday = () => { const d = new Date(Date.now() - 86400000); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };

// ------------------------------------------------------------ rewarded videos that double gems
// 2x Gems booster: every level / race gem reward is doubled for a few minutes
const gemBoostLeft = () => Math.max(0, (save.gemBoost || 0) - Date.now());
const gemMult = () => (gemBoostLeft() > 0 ? 2 : 1);
const mmss = (ms) => { const t = Math.ceil(ms / 1000); return `${(t / 60) | 0}:${String(t % 60).padStart(2, '0')}`; };
const boostMinutes = () => HSGame.rewards('gem_boost')?.boost_min || 10;
function startGemBoost() { adGo(HSGame.showAd('gem_boost'), () => { Audio.win(); ui.toast(`2x gems for ${boostMinutes()} minutes!`, '#46d35c'); }); }
function boostButton(u, x, y, w, h) {
  const left = gemBoostLeft();
  if (left > 0) { u.pill(x, y, h, { gem: true, text: `2x ${mmss(left)}` }, { minW: w, bg: 'rgba(30,140,60,0.8)' }); u.request(1); return; }
  if (!HSGame.has('ads') || !HSGame.canShowAd('gem_boost')) return;
  u.button('gboost', x, y, w, h, { color: 'green', parts: [{ icon: 'video', size: h * 0.45 }, '2x', { gem: true, size: h * 0.4 }], size: h * 0.42, radius: h / 2, ring: false, onTap: tap(startGemBoost) });
}
// free gems video: capped per day
const freeVidsLeft = () => REWARDS.freeGemsPerDay - (save.fv?.day === today() ? save.fv.n : 0);
function freeGemsVideo() {
  if (freeVidsLeft() <= 0) { ui.toast('Come back tomorrow for more free gems', '#ff8a1f'); return; }
  adGo(HSGame.showAd('free_gems'), () => { save.fv = { day: today(), n: (save.fv?.day === today() ? save.fv.n : 0) + 1 }; persist(); Audio.win(); });
}
const freeGemsAmount = () => HSGame.rewards('free_gems')?.gems || 150;
// daily gift: grows with the login streak (7-day cycle), x2 with a video. One reward key per streak day.
const DAILY_KEYS = 7;
const dailyRewards = (i) => [HSGame.rewards('daily_gift_1'), HSGame.rewards('daily_gift_2'), HSGame.rewards('daily_gift_3'), HSGame.rewards('daily_gift_4'), HSGame.rewards('daily_gift_5'), HSGame.rewards('daily_gift_6'), HSGame.rewards('daily_gift_7')][i]?.gems || 0;
function claimDaily(i) {
  switch (i) {
    case 0: return HSGame.claim('daily_gift_1');
    case 1: return HSGame.claim('daily_gift_2');
    case 2: return HSGame.claim('daily_gift_3');
    case 3: return HSGame.claim('daily_gift_4');
    case 4: return HSGame.claim('daily_gift_5');
    case 5: return HSGame.claim('daily_gift_6');
    default: return HSGame.claim('daily_gift_7');
  }
}
function dailyGift() {
  const d = save.daily || {};
  if (d.day === today() || testRun || !hsStarted) return;
  const streak = d.day === yesterday() ? (d.streak || 0) + 1 : 1, idx = (streak - 1) % DAILY_KEYS, amount = dailyRewards(idx);
  if (!amount) return;
  const claim = () => { save.daily = { day: today(), streak }; persist(); ui.closeOverlay(); claimDaily(idx); Audio.win(); ui.confetti(24); };
  ui.overlay((u, age) => {
    const c = u.ctx, pw = Math.min(u.w - PAD * 2, 380), ph = 300, px = u.w / 2 - pw / 2, py = u.h / 2 - ph / 2;
    u.panel(px, py, pw, ph, { ribbon: 'Daily Gift', ribbonColor: 'gold', scale: u.pop(0, 0.3, age) });
    u.text(`Day ${streak} in a row`, u.w / 2, py + 42, 16, '#fff');
    const bw = (pw - 28 - (DAILY_KEYS - 1) * 5) / DAILY_KEYS;
    for (let i = 0; i < DAILY_KEYS; i++) {
      const x = px + 14 + i * (bw + 5), y = py + 66, on = i === idx, done = i < idx;
      u.rr(x, y, bw, 70, 10); c.fillStyle = on ? u.grad(y, y + 70, GRAD.gold) : done ? 'rgba(70,211,92,0.5)' : 'rgba(10,30,80,0.5)'; c.fill(); c.lineWidth = 2; c.strokeStyle = INK; c.stroke();
      u.text(`D${i + 1}`, x + bw / 2, y + 12, 11, '#fff');
      u.gem(x + bw / 2, y + 34, Math.min(20, bw * 0.5));
      u.text(String(dailyRewards(i)), x + bw / 2, y + 56, 12, on ? '#5a3000' : '#fff', { outline: !on, maxW: bw - 2 });
    }
    u.row([{ text: `+${amount}`, color: GOLD }, { gem: true, size: 26 }], u.w / 2, py + 166, { size: 26 });
    const mult = HSGame.rewards('daily_x2')?.mult || 2;
    if (HSGame.has('ads') && HSGame.canShowAd('daily_x2'))
      u.button('dgx2', px + PAD, py + 192, pw - PAD * 2, 50, { color: 'green', parts: [{ icon: 'video', size: 22 }, `Claim x${mult}`, `+${amount * mult}`, { gem: true, size: 18 }], size: 18,
        onTap: tap(() => { multBase = { base: amount, pos: { x: u.w / 2, y: u.h / 2 } }; adGo(HSGame.showAd('daily_x2'), claim, () => { multBase = null; }); }) });
    u.button('dg1', px + PAD + 40, py + 250, pw - PAD * 2 - 80, 38, { color: 'gray', label: 'Claim', size: 16, onTap: tap(claim) });
    return age < 0.4;
  });
}

// No lives: crashing just means trying again (the old heart system is gone).

// ------------------------------------------------------------ game session
let game = null;
let trialCar = null;
const keys = { left: false, right: false };
let touchL = false, touchR = false;
// Fingers held on the road: in front of the truck drives forward, behind it brakes / reverses.
// The side is re-read every frame, so sliding the finger past the truck switches direction.
const drivePtrs = new Set();
function truckFrac() {
  const sim = game?.sim; if (!sim) return 0.5;
  try { const p = sim.chassis.getPosition(), f = R.screenX(p.x, p.y, game.z || 0); return typeof f === 'number' && f > 0.05 && f < 0.95 ? f : 0.5; } catch { return 0.5; }
}
function fingerSides() {
  let l = false, r = false; if (!drivePtrs.size) return [l, r];
  const tx = truckFrac() * ui.w;
  for (const st of drivePtrs) { if (st.x >= tx) r = true; else l = true; }
  return [l, r];
}
const throttleInput = () => { const [fl, fr] = fingerSides(), r = keys.right || touchR || fr, l = keys.left || touchL || fl; return r && !l ? 1 : l && !r ? -1 : 0; };

const RIVALS = [
  { name: 'Blaze Engine', car: 'fire', color: '#ff8a8a' },
  { name: 'Officer Bolt', car: 'police', color: '#9fc0ff' },
  { name: 'Dino Crusher', car: 'dino', color: '#9aff8a' },
  { name: 'Rubble Rider', car: 'rubble', color: '#ff6b74' },
  { name: 'Block Hauler', car: 'hauler', color: '#7fb2ff' },
  { name: 'Dozer Dash', car: 'dozer', color: '#ffe066' },
  { name: 'Mixer Max', car: 'mixer', color: '#ffffff' },
  { name: 'Lab Rover', car: 'rover', color: '#7df9e0' },
  { name: 'Iron Knight', car: 'knight', color: '#c6a8ff' },
];
const CUPS = [
  { name: 'Grass Cup', world: 0, races: [0, 1, 4], skill: [0.3, 0.38, 0.46, 0.54, 0.62], color: '#46d35c', reward: 1 },
  { name: 'Girder Cup', world: 1, races: [2, 5, 11], skill: [0.38, 0.46, 0.54, 0.62, 0.7], color: '#ff6a3c', reward: 1.5 },
  { name: 'Castle Cup', world: 2, races: [6, 7, 10], skill: [0.46, 0.54, 0.62, 0.7, 0.78], color: '#7f96ff', reward: 2 },
  { name: 'Lab Cup', world: 3, races: [3, 8, 9], skill: [0.55, 0.62, 0.7, 0.78, 0.86], color: '#2ee6c8', reward: 3 },
];
const PLACE_GEMS = [100, 60, 30, 15, 8, 4];
const LANE_W = 3.4;
const laneCount = () => Math.min(6, Math.max(3, save.lanes || 5));
const laneZ = (i) => ((laneCount() - 1) / 2 - i) * LANE_W;

function aiSpec(id) { const base = VEHICLES[0], v = vehicleById(id); return { ...base, look: v.look, crane: null, blade: false }; }

const timeLeft = (g) => g.limit + g.extraT - g.sim.time;
function startLevel(level, race = null, opts = {}) {
  R.camPush = 0;
  // a truck tried from the shop (rewarded video) drives the next level or race, once
  const carId = trialCar || save.car; if (trialCar) trialCar = null;
  const spec = withUpgrades(vehicleById(carId), save.upgrades?.[carId]);
  const theme = WORLDS[level.world].theme;
  R.buildLevel(level, theme, race ? { lanes: laneCount(), laneW: LANE_W } : {});
  const z0 = race ? laneZ(0) : 0;
  const me = makeRacer(level, spec, { stuckLimit: 5 });
  const sim = me.sim;
  const lane = R.attachSim(sim, { z: z0 });
  const player = R.addCar(sim, spec, race ? { label: 'You', color: '#ffe14d', z: z0 } : {});
  R.focusZ = z0;
  game = { level, spec, sim, me, lane, player, z: z0, race, racers: [], acc: 0, over: false, failT: 0, countdown: race ? 3.0 : 0, autoBot: makePlayer(testRun?.kind || save.autoKind || 'pro', 11), t0: ui.t, continued: false, limit: race ? 0 : timeLimit(level), extraT: 0, continues: 0, tickS: -1 };
  if (race) {
    race.rivals.forEach((rv, i) => {
      const s2 = aiSpec(rv.car);
      const r = makeRacer(level, s2, { collectGems: false });
      const z = laneZ(i + 1);
      const ln = R.attachSim(r.sim, { z, gems: false });
      const car = R.addCar(r.sim, s2, { label: rv.name, color: rv.color, z });
      game.racers.push({ ...rv, r, lane: ln, car, z, bot: null, spec: s2, finish: null });
      // rubber band: a rival far ahead of the player eases off, so a cup is never decided by one runaway bot
      { const gg = game, me2 = gg.racers[gg.racers.length - 1]; me2.bot = makeBot(rv.skill, i + 3 + ((Math.random() * 50) | 0), { race: true, pace: () => { const lead = me2.r.sim.x - gg.sim.x; return lead > 15 ? 0.55 : lead > 7 ? 0.72 : lead > 2 ? 0.86 : 1; } }); }
    });
  }
  if (!race && !testRun && !save.autoplay && !save.tut.drive) game.tut = 'drive';
  else if (level.seaGaps && !race) tip(game, 'Sea jump at the end: full speed off the ramp!', 3.2);
  R.snapCam = true;
  showHud();
  Audio.engineStart();
}
// tutorial: hold ▶ to drive (first level), then a one-off tip for braking and for tilting in the air
const tip = (g, text, sec = 3) => { g.tip = { text, t0: ui.t, sec }; ui.request(sec + 0.5); };
function tutorialTick(g, dt, input) {
  if (save.autoplay || testRun || g.race) return;
  if (g.tut === 'drive') {
    if (input > 0) g.tutT = (g.tutT || 0) + dt;
    if (g.tutT > 0.8) { g.tut = null; save.tut.drive = true; persist(); tip(g, 'Hold behind the truck (or ◀) to brake and reverse', 3.2); }
  }
  if (!save.tut.tilt) {
    g.airT = g.sim.airborne ? (g.airT || 0) + dt : 0;
    if (g.airT > 0.3) { save.tut.tilt = true; persist(); tip(g, 'In the air: ▶ tilts back, ◀ tilts forward', 3.2); }
  }
}

let hudT = 0;
function tick(dt) {
  const g = game;
  if (!g || g.paused) return;
  if (g.countdown > 0) {
    const before = Math.ceil(g.countdown);
    g.countdown -= dt;
    const after = Math.ceil(g.countdown);
    if (before !== after) { g.countT = ui.t; Audio.countdown(after <= 0); }
    ui.request(0.1);
    return;
  }
  // keep counting below zero so the lights and GO! fade out, then stop
  if (g.countdown > -1) { g.countdown = Math.max(-1, g.countdown - dt); ui.request(0.1); }
  // a crash plays in slow motion for a moment while the camera pushes in
  const slow = g.slowT > 0 ? 0.3 : 1; if (g.slowT > 0) { g.slowT -= dt; R.camPush = Math.min(1, (R.camPush || 0) + dt * 4); }
  g.acc += Math.min(dt, 0.1) * slow;
  const t = save.autoplay || testRun ? g.autoBot(g.sim) : throttleInput();
  tutorialTick(g, dt, t);
  // wedged against something with the wheels spinning (the truck is upright, so the game goes on): after a few
  // seconds without getting anywhere, offer the way out - back up, or start the level again
  if (!g.race && g.sim.state === 'run') {
    const x = g.sim.x;
    if (g.stuckX == null || Math.abs(x - g.stuckX) > 0.6) { g.stuckX = x; g.stuckS = 0; }
    else if (t !== 0) {
      g.stuckS = (g.stuckS || 0) + dt;
      if (g.stuckS > 3 && !g.stuckTip) { g.stuckTip = true; tip(g, 'Stuck? Hold behind the truck to back up, or tap ↻', 4); }
    }
  }
  // the countdown: out of time before the finish = lost (a tick each second for the last five)
  if (!g.race && g.limit && g.sim.state === 'run' && g.countdown <= 0) {
    const left = timeLeft(g);
    if (left <= 0) g.sim.fail('time');
    else if (left <= 5 && Math.ceil(left) !== g.tickS) { g.tickS = Math.ceil(left); Audio.countdown(false); }
  }
  while (g.acc >= DT) {
    g.acc -= DT;
    g.sim.step(t);
    for (const e of g.sim.drainEvents()) fx(e, g.sim, g.z, g.player);
    if (g.race) { if (racerWatch(g.me) === 'respawn') Audio.boost(); } else trackSafe(g.me);
    for (const r of g.racers) {
      const rs = r.r.sim;
      if (r.finish != null) { rs.step(0); rs.drainEvents(); continue; }
      rs.step(r.bot(rs));
      for (const e of rs.drainEvents()) {
        if (e.type === 'win') r.finish = rs.finishTime;
        else if (e.type === 'recover') R.carRecover(r.car, e);
        else if (e.type === 'breakup') R.breakAcc(r.car, e.tier);
        else if (e.type === 'wheelOff') R.splitWheel(r.car, e.idx);
        else if (e.type === 'impact') { R.hitCar(r.car, e); if (e.v > 4 && !impactFx(e, rs, r.z, r.spec?.look, true)) R.hitSurface(e, r.z); }
      }
      racerWatch(r.r);
      if (rs.time > 120 && r.finish == null) r.finish = Infinity;
    }
  }
  const av = Math.abs(g.sim.wheels[0].getAngularVelocity());
  Audio.engineSet(av, t !== 0 && g.sim.state === 'run');
  // HUD text changes every frame: redraw it ~20 times a second (cheaper texture uploads on TikTok)
  hudT += dt; if (hudT > 0.05) { hudT = 0; ui.request(); }
  if (g.race) {
    const all = [{ x: g.sim.x, fin: g.sim.state === 'win' ? g.sim.finishTime : null, me: true }, ...g.racers.map((r) => ({ x: r.r.sim.x, fin: r.finish }))];
    const me = all[0];
    const ahead = all.filter((o) => o !== me && ((o.fin != null && (me.fin == null || o.fin < me.fin)) || (o.fin == null && me.fin == null && o.x > me.x))).length;
    if (g.place !== ahead + 1) { g.place = ahead + 1; g.placeT = ui.t; }
    g.all = all;
  }
  const st = g.sim.state;
  if (testRun && !g.over) {
    const limit = g.race ? 100 : 75;
    if (st === 'fail' && !g.race) { g.failT += dt; if (g.failT > 0.9) { g.over = true; testResult(false, `${g.sim.failStuck ? 'stuck' : g.sim.failPose || g.sim.reason} @ ${g.sim.x.toFixed(0)} m`); } return; }
    if (st === 'win') { g.winT = (g.winT || 0) + dt; if (g.winT > 0.9) { g.over = true; testResult(true, fmt(g.sim.finishTime)); } return; }
    if (g.sim.time > limit) { g.over = true; testResult(false, `timeout @ ${g.sim.x.toFixed(0)} m`); }
    return;
  }
  if (st === 'fail' && !g.over) {
    g.failT += dt;
    if (!g.race && g.failT > 0.85) { g.over = true; onFail(); }
  }
  if (st === 'win' && !g.over) {
    g.winT = (g.winT || 0) + dt;
    if (g.race) { if (g.winT > 1.4) { g.over = true; finishRace(); } }
    else if (g.winT > 1.1) { g.over = true; onWin(); }
  }
}

// Debris colours per obstacle / ground style (what breaks off when a truck slams into it)
const DEBRIS = {
  grass: [0x5bbf3a, 0x8b5a2b], wood: [0xa8743f, 0x7a4f28], crate: [0xc08a4a, 0x7a4f28], log: [0x8b5a2b, 0xc69c6d], girder: [0xff6a3c, 0x7d8292],
  concrete: [0xb9bcc4, 0x8e93a0], barrel: [0x2f7cf6, 0xffffff], castle: [0x9aa0ae, 0x6f7486], metal: [0x8d93a3, 0x5e6372], pad: [0x2ee6c8, 0xffffff],
  labcrate: [0x2ee6c8, 0xffffff], desert: [0xe8c97a, 0xc79b52], snow: [0xffffff, 0xd6e6ff], jungle: [0x3f9a3a, 0x6b4a2b], stone: [0x9aa0ae, 0x7d8292],
  basalt: [0x4a4045, 0xff6a2a], candy: [0xff8fc8, 0xffffff], beach: [0xf2d98c, 0x5bbf3a], asphalt: [0x4a4d57, 0xffd21a], docks: [0x8b6a46, 0x4a4d57],
  moon: [0xc9ccd6, 0x8e93a0], mars: [0xc1502e, 0x8a3a22], coral: [0xff7f6b, 0x2ee6c8], autumn: [0xe07a2a, 0x8b5a2b], icecave: [0xcfe9ff, 0x8fd0ff],
  toy: [0xff4d6a, 0x2f7cf6, 0xffd21a], neon: [0x7f5cff, 0x2ee6c8], cloudgrass: [0x8fe07a, 0xffffff],
};
// every real hit leaves debris: bits of the obstacle, and paint / frame chips off the truck when it is hard
// Debris only flies off obstacles that can be knocked over; walls, steps and the road just stop the truck.
function impactFx(e, sim, z, look, small = false) {
  if (e.v < 3 || !e.smash) return 0;
  const k = Math.min(1, (e.v - 2.5) / 10), dir = e.nx ? -Math.sign(e.nx) : (Math.random() < 0.5 ? -1 : 1);
  const g = sim.groundAt(e.x - e.nx * 0.8), floor = Math.min(e.y, g ?? e.y - 0.5);
  const m = small ? 0.5 : 1;
  R.debris(e.x, e.y, z, DEBRIS[e.style] || [0x9aa0ae, 0x7d8292], Math.round((5 + k * 14) * m), 2.5 + k * 6, dir, floor);
  if (e.heavy && e.v > 6.5) R.debris(e.x - e.nx * 0.4, e.y + 0.3, z, [look?.body ?? 0xff9a14, look?.frame ?? 0x55565e], Math.round((2 + k * 7) * m), 3 + k * 5, dir, floor);
  return k;
}
function fx(e, sim, z = 0, car = null) {
  const p = sim.chassis.getPosition();
  switch (e.type) {
    case 'impact': {
      if (car) R.hitCar(car, e);   // dent where it hit + the body rocks on its mounts
      if (e.v > 4.5) P.vibrate(e.v > 11 ? 'heavy' : e.v > 7.5 ? 'medium' : 'light');   // every real hit is felt, harder hits harder
      const k = impactFx(e, sim, z, game?.spec?.look);
      if (!k) R.hitSurface(e, z);   // a wall / the road: dust and sparks, no debris
      if (!k) { if (e.v > 8 && e.heavy) { Audio.land(Math.min(1, e.v / 12)); R.shake = Math.max(R.shake, 0.12); } break; }   // blocker: a thud, no debris
      Audio.land(Math.min(1, e.v / 10));
      if (e.v > 8) R.shake = Math.max(R.shake, 0.15 + k * 0.35);
      if (e.v > 9 && (game.impT || 0) < ui.t) { game.impT = ui.t + 0.8; R.popText(e.heavy ? 'CRASH!' : 'SMASH!', e.x, e.y + 2.2, z, '#ff6b74'); }
      break;
    }
    case 'bannerHit': {
      const look = game?.spec?.look;
      R.debris(e.x - 0.3, e.y, z, [0x1d1d22, 0xffffff, 0x8d93a3, look?.body ?? 0xff9a14], 18, 4 + Math.min(5, e.v * 0.5), -1, sim.groundAt(e.x - 1.5) ?? e.y - 3.6);
      R.kickFinish(0.5 + Math.min(1, e.v / 10)); R.popText('CLANG!', e.x, e.y + 1.2, z, '#ffd21a');
      R.shake = Math.max(R.shake, 0.3); Audio.crash(); P.vibrate('medium');
      break;
    }
    case 'gem': R.burst(e.gem.piece.x, e.gem.piece.y, 0xffd21a, 12, 4, -6, 0.6, z); R.popText('+1', e.gem.piece.x, e.gem.piece.y + 0.8, z); Audio.gem(); break;
    case 'land':
      // landing on the road: tyre smoke puffs at both wheels, no debris
      for (const w of sim.wheels) { const q = w.getPosition(); for (let i = 0; i < 2 + Math.min(4, e.v * 3); i++) R.smoke(q.x + (Math.random() - 0.5) * 1.2, q.y - sim.spec.wheelR + 0.25, z + (Math.random() < 0.5 ? -0.86 : 0.86), 0.35 + Math.min(0.35, e.v * 0.18), (Math.random() - 0.5) * 2.4, 0.2 + Math.random() * 0.5); }
      Audio.land(e.v);
      if (e.v > 1) { R.shake = 0.2; P.vibrate(e.v > 1.8 ? 'medium' : 'light'); }
      if (e.v > 1.3) R.popText(e.v > 2 ? 'HUGE AIR!' : 'Nice air!', p.x, p.y + 2.6, z, '#7df9ff');
      break;
    case 'pad': case 'boost': R.burst(p.x, p.y - 0.6, 0x5ff0ff, 18, 6, -3, 0.7, z); Audio.boost(); break;
    case 'bonk':
      if ((game.bonkT || 0) < ui.t) {
        game.bonkT = ui.t + 0.45;
        Audio.land(0.3);   // debris comes from the 'impact' event
        if (e.style === 'metal' || e.style === 'stone') { R.popText(e.style === 'metal' ? 'BONK!' : 'THUD!', p.x, p.y + 2.6, z, '#ff6b74'); R.shake = 0.25; }
      }
      break;
    case 'dunk':
      if (!game.race && !game.snap) { game.snap = R.snapshotCar(sim, z, 'splash'); R.burst(p.x, p.y, 0xffffff, 24, 6, -10, 0.9, z); }
      break;
    case 'wheelOff': { const q = sim.wheels[e.idx].getPosition(); if (car) R.splitWheel(car, e.idx); R.smoke(q.x, q.y, z, 0.4, 0, 0.6); if (!car?.tyres || car.tyres.length <= 2) R.popText('Wheel off!', q.x, q.y + 1.6, z, '#ffffff'); Audio.land(0.6); P.vibrate('medium'); break; }
    case 'breakup': if (car) R.breakAcc(car, e.tier); break;   // accessories fly off according to how bad the crash was
    case 'recover': if (car) { P.vibrate('light'); R.carRecover(car, e); R.popText(e.to.x < e.from.x - 1 ? 'Back you go!' : 'Flip!', e.from.x, e.from.y + 2.6, z, '#ffffff'); } break;
    case 'win':
      for (const c of [0xffffff, 0xff3d6b, 0x2f7cf6, 0xffd21a]) R.burst(p.x + 1, p.y + 2, c, 14, 7, -5, 1.2, z);
      R.cheer(); Audio.applause();   // the crowd at the line jumps, claps and cheers
      Audio.win(); break;
    case 'fail':
      if (game && !game.race && e.reason !== 'splash' && e.reason !== 'time' && !testRun && !save.autoplay) game.slowT = 0.75;   // the crash in slow motion
      if (e.reason === 'splash') { R.burst(p.x, (sim.level.water ?? -3) + 0.2, 0xffffff, 30, 7, -10, 1, z); Audio.splash(); }
      else if ((sim.tier ?? 3) <= 1) {   // gentle roll-over: a soft puff and a thud, nothing breaks
        for (let i = 0; i < 4; i++) R.smoke(p.x + (Math.random() - 0.5) * 2, p.y - 0.4, z + (Math.random() - 0.5) * 1.4, 0.35, (Math.random() - 0.5) * 1.2, 0.3 + Math.random() * 0.3);
        Audio.land(0.5); R.shake = 0.08; P.vibrate('flip');   // the truck rolls over: a double bump
      } else {
        const big = sim.tier >= 3;
        for (let i = 0; i < (big ? 14 : 8); i++) R.smoke(p.x + (Math.random() - 0.5) * 2.5, p.y - 0.4, z + (Math.random() - 0.5) * 1.8, big ? 0.5 : 0.4, (Math.random() - 0.5) * 2, 0.4 + Math.random() * 0.6);
        Audio.crash(); R.shake = big ? 0.45 : 0.25; P.vibrate('heavy');
      }
      if (!game.race) setTimeout(() => { if (game && !game.snap) game.snap = R.snapshotCar(sim, z); }, 420);
      else R.popText(e.reason === 'splash' ? 'SPLASH!' : 'OOPS!', p.x, p.y + 2.4, z, '#ffffff');
      break;
    default: break;
  }
}

// ------------------------------------------------------------ ads
let levelEnds = 0;
// Interstitial when leaving a result screen (on the player's tap only). The first level ends of a session are
// ad-free; the gap between two is the place's "cooldown" in the HS dashboard.
function adBreak(next, race = false) {
  if (testRun || save.autoplay) return next();
  if (adBusy) return;
  levelEnds++;
  if (levelEnds <= AD_FREE_ENDS || !HSGame.has('ads')) return next();
  adBusy = true;
  const ad = race ? HSGame.showAd('race_end') : HSGame.showAd('level_end');
  ad.then(() => { adBusy = false; next(); }, () => { adBusy = false; next(); });
}
// A rewarded video started by a tap: `ad` is the HSGame.showAd('<place>') promise. Its reward (if the place has one)
// is already paid by HSGame when it resolves; onDone runs the game's side (continue, x3 ...).
let adBusy = false;
function adGo(ad, onDone, onNone) {
  adBusy = true;
  ad.then((r) => {
    adBusy = false;
    if (r) onDone(r);
    else { onNone?.(); ui.toast(HSGame.lastAdError === 'claimed' ? 'Already collected today' : 'No video right now, try again soon', '#ff8a1f'); }
  }, () => { adBusy = false; onNone?.(); });
}
// the base a gem multiplier (x2 / x3 ad places) applies to: set right before that showAd
let multBase = null;
// Rewards that are not profile number fields (gems and trophies are credited by HSGame itself)
function onGive(items, from) {
  for (const [k, n] of Object.entries(items)) {
    if (k === 'mult') { if (multBase) { earnGems(Math.round(multBase.base * (n - 1)), multBase.pos); multBase = null; } }
    else if (k === 'boost_min') { save.gemBoost = Math.max(Date.now(), save.gemBoost || 0) + n * 60000; persist(); }
    else if (k === 'lives') { /* lives no longer exist: an old reward is simply ignored */ }
    else throw new Error('unknown item ' + k + ' from ' + from);
  }
}
// Local stand-in ad for the web build and for placeholder ad unit IDs.
globalThis.__fakeAd = (kind) => new Promise((resolve) => {
  const dur = kind === 'rewarded' ? 3 : 2;
  ui.overlay((u, age) => {
    const w = Math.min(u.w - 40, 340), h = 300, x = (u.w - w) / 2, y = u.h / 2 - h / 2;
    u.panel(x, y, w, h, { ribbon: kind === 'rewarded' ? 'Test video' : 'Test ad', ribbonColor: 'purple', scale: u.pop(0, 0.3, age) });
    u.text('TEST AD', u.w / 2, y + 70, 40, GOLD);
    u.text(kind === 'rewarded' ? 'A video ad plays here' : 'An ad plays here', u.w / 2, y + 112, 15, '#fff', { maxW: w - 30 });
    u.text('(preview build)', u.w / 2, y + 134, 15, '#fff', { maxW: w - 30 });
    const left = Math.max(0, dur - age);
    u.bar(x + 30, y + 160, w - 60, 18, 1 - left / dur, { fill: GRAD.gold });
    const done = left <= 0;
    u.button('adclose', x + 30, y + h - 82, w - 60, 54, { color: done ? 'green' : 'gray', label: done ? (kind === 'rewarded' ? 'Claim reward' : 'Close') : `Wait ${Math.ceil(left)}s`, disabled: !done, onTap: () => { u.closeOverlay(); resolve(true); } });
    if (kind === 'rewarded' && !done) u.button('adskip', x + w - 70, y + 16, 54, 30, { color: 'red', label: 'Skip', size: 14, radius: 10, onTap: () => { u.closeOverlay(); resolve(false); } });
    return !done || age < dur + 0.5;
  });
});

// ------------------------------------------------------------ the 3 buttons TikTok review asks for (via HSGame)
// Entry Reward (open the game from the profile), Launch Reward (from a home-screen icon), Share. Each opens a
// popup with the steps and the reward; shown only where HSGame says the feature exists.
function stepsPopup(title, steps, rewardGems, goLabel, onGo) {
  ui.overlay((u, age) => {
    const pw = Math.min(u.w - PAD * 2, 380), ph = 150 + steps.length * 30 + (rewardGems ? 40 : 0), px = u.w / 2 - pw / 2, py = u.h / 2 - ph / 2;
    u.panel(px, py, pw, ph, { ribbon: title, ribbonColor: 'purple', scale: u.pop(0, 0.3, age) });
    steps.forEach((t, i) => u.text(`${i + 1}. ${t}`, px + 22, py + 50 + i * 30, 15, '#fff', { align: 'left', maxW: pw - 40 }));
    let y = py + 50 + steps.length * 30;
    if (rewardGems) { u.row(['Reward:', { text: `+${rewardGems}`, color: GOLD }, { gem: true, size: 20 }], u.w / 2, y + 12, { size: 18 }); y += 40; }
    u.button('stepsgo', px + PAD, y + 4, pw - PAD * 2, 48, { color: 'green', label: goLabel, size: 20, onTap: tap(() => { u.closeOverlay(); onGo(); }) });
    u.button('stepsclose', px + PAD + 50, y + 60, pw - PAD * 2 - 100, 34, { color: 'gray', label: 'Close', size: 15, onTap: tap(() => u.closeOverlay()) });
    return age < 0.4;
  });
}
const reviewButtons = {
  launch: () => stepsPopup('Launch Reward', ['Tap "Go"', 'Add the game to your home screen', 'Open the game from the new icon', 'Get the reward'], HSGame.rewards('tiktok_shortcut')?.gems, 'Go', () => HSGame.tiktokMission.start('shortcut')),
  entry: () => stepsPopup('Entry Reward', ['Go to your TikTok profile', 'Open "TikTok Minis"', 'Open this game from there', 'Come back and get the reward'], HSGame.rewards('tiktok_profile')?.gems, 'Go', () => HSGame.tiktokMission.start('profile')),
  share: () => stepsPopup('Share', ['Share Crane Rush with your friends'], HSGame.rewards('share')?.gems, 'Share', () => {
    HSGame.share({ title: 'Crane Rush', subtitle: `I cleared ${totalDone()} levels in Crane Rush. Can you beat me?` }).then((r) => { if (r && r.gems) Audio.win(); });
  }),
};

// ------------------------------------------------------------ shared widgets
let gemPill = null;
const short = () => ui.h < 700;
// One spacing system for every screen: 16 px side/edge padding, 12 px between blocks.
const PAD = 16, GAP = 12;
const topY = (u) => u.safeTop + 12;                       // first row (clears the status bar / host header)
const pillH = () => (short() ? 34 : 40);
const navH = () => (short() ? 66 : 76);
const navTop = (u) => u.h - u.safeBottom - PAD - navH();
function topbar(u) {
  const h = pillH(), y = topY(u);
  const tw = Math.max(64, u.measure(String(save.trophies), h * 0.5) + h * 0.9 + 18);
  u.pill(u.w - PAD - tw, y, h, { icon: 'trophy', text: String(save.trophies) }, { minW: tw });
  u.hit(u.w - PAD - tw, y, tw, h, { id: 'trophies', onTap: tap(showBoard) });
  const txt = gemsText(), gw = Math.max(74, u.measure(txt, h * 0.5) + h * 0.9 + 18), gx = u.w - PAD - 10 - tw - gw;
  const bump = gemBump > 0 && u.t > gemBump && u.t < gemBump + 0.6 ? 1 + Math.sin((u.t - gemBump) / 0.6 * Math.PI) * 0.15 : 1;
  const c = u.ctx; c.save(); c.translate(gx + gw / 2, y + h / 2); c.scale(bump, bump); c.translate(-(gx + gw / 2), -(y + h / 2));
  u.pill(gx, y, h, { gem: true, text: txt }, { minW: gw });
  c.restore();
  gemPill = { x: gx + h * 0.5, y: y + h / 2 };
}

function navbar(u, active) {
  const w = Math.min(u.w - PAD * 2, 460), h = navH(), x = (u.w - w) / 2, y = navTop(u), c = u.ctx;
  u.rr(x - 3, y + 6, w + 6, h + 4, 20); c.fillStyle = 'rgba(0,0,0,0.2)'; c.fill();
  u.rr(x - 3, y - 3, w + 6, h + 6, 21); c.fillStyle = '#fff'; c.fill();
  c.save(); u.rr(x, y, w, h, 18); c.clip();
  const tabs = [['race', 'Race', 'trophy'], ['worlds', 'Worlds', 'worlds'], ['shop', 'Shop', 'shop'], ['settings', 'Settings', 'settings']];
  const sw = w / tabs.length;
  tabs.forEach(([k, n, ic], i) => {
    const sx = x + i * sw, on = active === k, down = u.isDown('nav' + k);
    c.fillStyle = u.grad(y, y + h, on ? GRAD.blue : GRAD.gray); c.fillRect(sx, y, sw, h);
    c.fillStyle = 'rgba(0,0,0,0.2)'; c.fillRect(sx, y + h - 6, sw, 6);
    if (i) { c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(sx, y, 2, h); }
    const isz = short() ? 28 : 34, oy = down ? 2 : 0;
    u.icon(ic, sx + sw / 2 - isz / 2, y + h * 0.16 + oy, isz);
    u.text(n, sx + sw / 2, y + h * 0.78 + oy, short() ? 14 : 16);
    u.hit(sx, y, sw, h, { id: 'nav' + k, onTap: tap(() => tabs2[k]()) });
  });
  c.restore();
  u.rr(x, y, w, h, 18); c.lineWidth = 3; c.strokeStyle = INK; c.stroke();
}
const tabs2 = { race: () => showRace(), worlds: () => showWorlds(), shop: () => showShop(), settings: () => showSettings() };

// Row of joined buttons at the bottom of result screens. items: {id,label,icon,color,big,onTap}
function barButtons(u, items, y) {
  const h = short() ? 72 : 82, c = u.ctx;
  let ws = items.map((b) => (b.big ? 150 : 100));
  const total = ws.reduce((a, b) => a + b, 0), maxW = u.w - 28, k = Math.min(1, maxW / total);
  ws = ws.map((v) => v * k);
  const w = total * k, x0 = (u.w - w) / 2;
  u.rr(x0 - 3, y + 6, w + 6, h + 4, 20); c.fillStyle = 'rgba(0,0,0,0.2)'; c.fill();
  u.rr(x0 - 3, y - 3, w + 6, h + 6, 21); c.fillStyle = '#fff'; c.fill();
  c.save(); u.rr(x0, y, w, h, 18); c.clip();
  let x = x0;
  items.forEach((b, i) => {
    const bw = ws[i], down = u.isDown(b.id);
    c.fillStyle = u.grad(y, y + h, GRAD[b.color || 'gray']); c.fillRect(x, y, bw, h);
    c.fillStyle = 'rgba(0,0,0,0.2)'; c.fillRect(x, y + h - 7, bw, 7);
    if (i) { c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(x, y, 2, h); }
    const isz = 34, oy = down ? 3 : 0;
    u.icon(b.icon, x + bw / 2 - isz / 2, y + h * 0.14 + oy, isz);
    u.text(b.label, x + bw / 2, y + h * 0.76 + oy, b.big ? 21 : 18, '#fff', { maxW: bw - 8 });
    u.hit(x, y, bw, h, { id: b.id, onTap: tap(b.onTap) });
    x += bw;
  });
  c.restore();
  u.rr(x0, y, w, h, 18); c.lineWidth = 3; c.strokeStyle = INK; c.stroke();
  return h;
}

function chip(u, id, x, y, label, on, onTap, color = 'green') {
  const w = u.measure(label, 15) + 22, h = 30, c = u.ctx;
  u.rr(x, y, w, h, 12);
  c.fillStyle = on ? u.grad(y, y + h, GRAD[color]) : 'rgba(0,0,0,0.3)'; c.fill(); c.lineWidth = 3; c.strokeStyle = INK; c.stroke();
  const pulse = on && color === 'green' ? 0.75 + Math.sin(u.t * 5) * 0.25 : 1;
  u.text(label, x + w / 2, y + h / 2 + 1, 15, on ? '#fff' : '#c7cde0', { alpha: pulse });
  u.hit(x, y, w, h, { id, onTap: tap(onTap) });
  return w;
}

// Round icon button with a caption under it (the TikTok capability buttons on the home screen).
function roundBtn(u, id, x, y, size, ic, label, color, onTap, badge) {
  const c = u.ctx, down = u.isDown(id), r = size / 2;
  c.save(); if (down) { c.translate(x + r, y + r); c.scale(0.92, 0.92); c.translate(-(x + r), -(y + r)); }
  c.beginPath(); c.arc(x + r, y + r + 4, r + 2, 0, Math.PI * 2); c.fillStyle = 'rgba(0,0,0,0.2)'; c.fill();
  c.beginPath(); c.arc(x + r, y + r, r + 3, 0, Math.PI * 2); c.fillStyle = '#fff'; c.fill();
  c.beginPath(); c.arc(x + r, y + r, r, 0, Math.PI * 2); c.fillStyle = u.grad(y, y + size, GRAD[color]); c.fill(); c.lineWidth = 3; c.strokeStyle = INK; c.stroke();
  const isz = size * 0.56; u.icon(ic, x + r - isz / 2, y + r - isz / 2, isz);
  c.restore();
  u.text(label, x + r, y + size + 11, 12, '#fff', { maxW: size + 24 });
  if (badge) {
    const bx = x + size - 6, by = y + 4, pulse = 1 + Math.sin(u.t * 6) * 0.12;
    c.save(); c.translate(bx, by); c.scale(pulse, pulse);
    c.beginPath(); c.arc(0, 0, 11, 0, Math.PI * 2); c.fillStyle = '#ff3d57'; c.fill(); c.lineWidth = 2.5; c.strokeStyle = '#fff'; c.stroke();
    u.text('!', 0, 1, 14, '#fff', { outline: false });
    c.restore();
  }
  u.hit(x - 6, y - 6, size + 12, size + 26, { id, onTap: tap(onTap) });
}

// ------------------------------------------------------------ home (world select)
function showWorlds() {
  game = null; Audio.engineStop();
  R.showDiorama(WORLDS[save.world], vehicleById(save.car));
  ui.show('home', drawHome, { swipe: (d) => changeWorld(d) });
}
function changeWorld(d) {
  const n = Math.max(0, Math.min(OPEN_WORLDS - 1, save.world + d));
  if (n !== save.world) { save.world = n; persist(); Audio.click(); showWorlds(); }
}
function drawHome(u) {
  const wi = save.world, w = WORLDS[wi], unlocked = worldUnlocked(wi), done = worldDone(wi), T = u.safeTop, B = u.safeBottom, sh = short();
  u.hit(0, 0, u.w, u.h, { id: '__swipe' });
  topbar(u);
  // dev chips under the gem counter (right)
  const tw0 = u.measure('TEST', 15) + 22, chipY = topY(u) + pillH() + 10;
  if (dev()) {
    chip(u, 'test', u.w - PAD - tw0, chipY, 'TEST', true, () => testMenu(), 'orange');
    chip(u, 'auto', u.w - PAD - 8 - tw0 - (u.measure('AUTO', 15) + 22), chipY, 'AUTO', !!save.autoplay, () => { save.autoplay = !save.autoplay; persist(); u.request(); });
  }
  // the review buttons (top-left row): Launch Reward, Entry Reward, Share. A mission button goes once it is done.
  const bs = sh ? 40 : 44; let bx = PAD; const by0 = topY(u) + 3;   // +3: white ring
  if (HSGame.has('tiktok_missions')) {
    if (!HSGame.tiktokMission.done('shortcut')) { roundBtn(u, 'tt_add', bx, by0, bs, 'addhome', 'Launch', 'orange', reviewButtons.launch, true); bx += bs + 16; }
    if (!HSGame.tiktokMission.done('profile')) { roundBtn(u, 'tt_side', bx, by0, bs, 'sidebar', 'Entry', 'purple', reviewButtons.entry, true); bx += bs + 16; }
  }
  if (HSGame.has('share')) roundBtn(u, 'tt_share', bx, by0, bs, 'share', 'Share', 'teal', reviewButtons.share, HSGame.available('share'));
  // world title + progress
  // title sits one GAP below the chip row (top rows end at topY + pill + 10 + chip 30)
  const rowsEnd = topY(u) + pillH() + 10 + 30, ty = Math.max(rowsEnd + GAP + 28, sh ? 0 : u.h * 0.2), k = u.pop(0.05, 0.35);
  const c = u.ctx; c.save(); c.translate(u.w / 2, ty); c.scale(k, k);
  const tw = u.measure(w.name, 44);
  if (!unlocked) u.icon('lock', -tw / 2 - 40, -18, 32, '#c7cde0');
  u.text(w.name, unlocked ? 0 : 18, 0, 44, '#fff', { maxW: u.w - 40 });
  c.restore();
  const pw = Math.min(u.w * 0.78, 360), px = (u.w - pw) / 2, py = ty + 40;
  u.bar(px + 10, py, pw - 10, 30, done / w.levels.length);
  u.text(`${done}/${w.levels.length}`, px + pw / 2 + 5, py + 16, 20);
  c.save(); c.translate(px + 4, py + 14); c.rotate(-0.2); u.icon('flagpole', -16, -20, 40, INK, false); c.fillStyle = '#fff'; c.fillRect(-10, -18, 18, 13);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) if ((i + j) % 2 === 0) { c.fillStyle = INK; c.fillRect(-10 + i * 6, -18 + j * 6.5, 6, 6.5); }
  c.restore();
  // arrows
  const ay = u.h * 0.52, asz = 56;
  for (const [d, x, ic] of [[-1, PAD, 'left'], [1, u.w - PAD - asz, 'right']]) {
    const dis = (d < 0 && wi === 0) || (d > 0 && wi === OPEN_WORLDS - 1);
    c.save(); if (dis) c.globalAlpha = 0.35;
    if (u.isDown('arr' + d)) { c.translate(x + asz / 2, ay + asz / 2); c.scale(0.92, 0.92); c.translate(-(x + asz / 2), -(ay + asz / 2)); }
    c.beginPath(); c.arc(x + asz / 2, ay + asz / 2, asz / 2 + 3, 0, Math.PI * 2); c.fillStyle = '#fff'; c.fill();
    c.beginPath(); c.arc(x + asz / 2, ay + asz / 2, asz / 2, 0, Math.PI * 2); c.fillStyle = u.grad(ay, ay + asz, GRAD.blue); c.fill(); c.lineWidth = 3; c.strokeStyle = INK; c.stroke();
    u.icon(ic, x + 12, ay + 12, asz - 24);
    c.restore();
    if (!dis) u.hit(x - 6, ay - 6, asz + 12, asz + 12, { id: 'arr' + d, onTap: () => changeWorld(d) });
  }
  // bottom: subtitle, counter, play
  // bottom stack, laid out upwards from the nav bar: Play, world counter, subtitle
  const playH = sh ? 66 : 76, playY = navTop(u) - 2 * GAP;                 // playY = bottom edge of Play
  const countY = playY - playH - GAP - 10;                                 // centre of the "1 / 20" line
  if (!sh) {
    const sw = Math.min(u.w - PAD * 2, u.measure(w.sub, 17) + 28), sh2 = 30, sy = countY - 10 - 8 - sh2;
    u.rr(u.w / 2 - sw / 2, sy, sw, sh2, 14); c.fillStyle = 'rgba(10,30,80,0.45)'; c.fill();
    u.text(w.sub, u.w / 2, sy + sh2 / 2 + 1, 17, '#fff', { maxW: sw - 20 });
  }
  const nLv = WORLDS.slice(0, OPEN_WORLDS).reduce((a, x) => a + x.levels.length, 0);
  const wc = `World ${wi + 1} / ${OPEN_WORLDS} · ${nLv} levels` + (wi === OPEN_WORLDS - 1 ? ' · more soon!' : '') + (w.starsReq ? `   ★ ${w.starsReq}` : '');
  u.text(wc, u.w / 2, countY, 17);
  const bob = Math.sin(u.t * 3.9) * 3;
  if (unlocked) {
    const pw2 = 180;
    u.button('play', u.w / 2 - pw2 / 2, playY - playH + bob, pw2, playH, { label: 'Play', icon: 'play', size: 32, scale: u.pop(0.1, 0.4), onTap: tap(() => showLevels(wi)) });
    boostButton(u, u.w / 2 - pw2 / 2 - 8 - 70, playY - playH / 2 - 17 + bob, 70, 34);   // 2x Gems booster (video)
  } else {
    const msg = worldDone(wi - 1) < 5 ? `Clear 5 in ${WORLDS[wi - 1].name}` : `Need ${starsNeeded(wi)} more stars`;
    const pw2 = Math.min(u.w - 60, u.measure(msg, 17) + 70);
    u.button('locked', u.w / 2 - pw2 / 2, playY - playH, pw2, playH, { label: msg, icon: 'lock', size: 17, color: 'gray', disabled: true });
  }
  navbar(u, 'worlds');
  return true;   // bobbing Play button + pulsing badges
}

// ------------------------------------------------------------ level list
function showLevels(wi) {
  game = null; Audio.engineStop();
  if (R.mode !== 'menu') R.showDiorama(WORLDS[wi], vehicleById(save.car));
  const w = WORLDS[wi];
  const firstOpen = w.levels.findIndex((l) => lvlSave(l)?.time == null);
  ui.show('levels', (u) => drawLevels(u, wi, firstOpen), { dragScroll: 'lv' });   // swipe anywhere to scroll the list
}
function drawLevels(u, wi, firstOpen) {
  const w = WORLDS[wi], c = u.ctx, T = u.safeTop;
  const g = c.createLinearGradient(0, 0, 0, u.h); g.addColorStop(0, 'rgba(29,140,255,0.55)'); g.addColorStop(1, 'rgba(10,60,160,0.8)');
  c.fillStyle = g; c.fillRect(0, 0, u.w, u.h);
  u.button('back', PAD, topY(u), 50, 50, { color: 'gray', icon: 'left', iconSize: 28, radius: 14, onTap: tap(showWorlds) });
  const stars = w.levels.reduce((a, l) => a + (lvlSave(l)?.stars || 0), 0);
  const label = `${stars}/${w.levels.length * 3}`, pw = u.measure(label, 17) + 50;
  u.pill(u.w - PAD - pw, topY(u) + 8, 34, { icon: 'star', text: label }, { minW: pw });
  let rx = u.w - PAD - pw - 10;
  if (dev()) { const aw = u.measure('AUTO', 15) + 22; rx -= aw; chip(u, 'auto', rx, topY(u) + 10, 'AUTO', !!save.autoplay, () => { save.autoplay = !save.autoplay; persist(); u.request(); }); rx -= 10; }
  u.text(w.name, PAD + 50 + GAP, topY(u) + 26, 28, '#fff', { align: 'left', maxW: rx - (PAD + 50 + GAP) });
  const top = topY(u) + 50 + GAP, rowH = 70, gap = GAP, lw = Math.min(u.w - PAD * 2, 460), lx = (u.w - lw) / 2;
  const size = w.levels.length * (rowH + gap) + 30;
  u.scroll('lv', 0, top, u.w, u.h - top, size, () => {
    w.levels.forEach((l, i) => {
      const y = top + 10 + i * (rowH + gap), sv = lvlSave(l), open = levelUnlocked(l), cur = i === firstOpen;
      const k = u.slide(i * 0.03, 0.3), ox = (1 - k) * 60;
      c.save(); c.globalAlpha = k; c.translate(ox, 0);
      const id = 'lv' + i, down = u.isDown(id);
      if (down) { c.translate(0, 2); }
      u.rr(lx - 3, y - 3, lw + 6, rowH + 6, 20); c.fillStyle = '#fff'; c.fill();
      u.rr(lx, y, lw, rowH, 18); c.fillStyle = u.grad(y, y + rowH, !open ? GRAD.dark : cur ? GRAD.gold : GRAD.blue); c.fill();
      c.save(); c.clip(); c.fillStyle = 'rgba(0,0,0,0.2)'; c.fillRect(lx, y + rowH - 8, lw, 8); c.restore();
      u.rr(lx, y, lw, rowH, 18); c.lineWidth = 3; c.strokeStyle = INK; c.stroke();
      u.icon(!open ? 'lock' : sv?.time != null ? 'check' : 'play', lx + 14, y + rowH / 2 - 19, 38);
      u.text(`${i + 1}. ${l.name}`, lx + 62, y + 24, 20, '#fff', { align: 'left', maxW: lw - 190 });
      for (let s = 0; s < 3; s++) u.star(lx + 72 + s * 22, y + 50, 20, s < (sv?.stars || 0));
      u.text(fmt(sv?.time), lx + lw - 14, y + rowH / 2, 19, '#fff', { align: 'right' });
      c.restore();
      if (open) u.hit(lx, y, lw, rowH, { id, onTap: tap(() => startLevel(l)) });
    });
  }, { start: Math.max(0, firstOpen * (rowH + gap) - (u.h - top) / 2 + rowH) });
  return u.st < 1;
}

// ------------------------------------------------------------ in-game HUD
function showHud() { ui.show('hud', drawHud, { anim: 2.4 }); }
function drawHud(u) {
  const g = game; if (!g) return false;
  const l = g.level, w = WORLDS[l.world], T = u.safeTop, B = u.safeBottom, c = u.ctx;
  // pause + auto
  u.button('pause', PAD, topY(u), 50, 50, { icon: 'pause', iconSize: 28, radius: 14, onTap: tap(pauseMenu) });
  if (dev() || testRun) chip(u, 'auto', PAD + 2, topY(u) + 50 + 10, 'AUTO', !!(save.autoplay || testRun), () => { save.autoplay = !save.autoplay; persist(); u.request(); });
  const name = g.race ? (g.race.random ? `Random · ${l.name}` : `${g.race.cup.name} · Race ${g.race.idx + 1}/3`) : `${w.name} ${l.index + 1}. ${l.name}`;
  u.text(name, u.w / 2, topY(u) + 10, 15, '#fff', { maxW: u.w - 180 });
  u.text(fmt(g.sim.state === 'win' ? g.sim.finishTime : g.sim.time), u.w / 2, topY(u) + 38, 30);
  if (!g.race && g.limit) {
    // countdown clock on the left: white, yellow under 10 s, red and pulsing under 5 s
    const left = Math.max(0, g.sim.state === 'win' ? g.limit + g.extraT - g.sim.finishTime : timeLeft(g)), lw = 92, lh = 46, lx = PAD, ly = topY(u) + 108;
    const hot = left <= 5, warm = left <= 10, pulse = hot && g.sim.state === 'run' ? 1 + Math.abs(Math.sin(u.t * 6)) * 0.08 : 1;
    c.save(); c.translate(lx + lw / 2, ly + lh / 2); c.scale(pulse, pulse); c.translate(-(lx + lw / 2), -(ly + lh / 2));
    u.rr(lx, ly, lw, lh, 16); c.fillStyle = hot ? 'rgba(200,20,40,0.85)' : 'rgba(10,30,80,0.7)'; c.fill(); c.lineWidth = 3; c.strokeStyle = INK; c.stroke();
    // a small stopwatch face with the hand sweeping down the time left
    const cx = lx + 22, cy = ly + lh / 2 + 1, frac = Math.min(1, left / (g.limit + g.extraT));
    c.beginPath(); c.arc(cx, cy, 13, 0, Math.PI * 2); c.fillStyle = '#fff'; c.fill(); c.lineWidth = 3; c.strokeStyle = INK; c.stroke();
    c.beginPath(); c.moveTo(cx, cy); c.arc(cx, cy, 10, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2); c.closePath(); c.fillStyle = hot ? '#ff3d57' : warm ? '#ffc61a' : '#46d35c'; c.fill();
    c.fillStyle = INK; c.fillRect(cx - 3, cy - 19, 6, 5);
    u.text(`${Math.ceil(left)}s`, lx + 64, ly + lh / 2 + 1, 22, hot ? '#fff' : warm ? '#ffe14d' : '#fff');
    c.restore();
    if (g.sim.state === 'run') u.request(0.1);
  }
  if (!g.race && g.sim.state === 'run' && (g.stuckS || 0) > 3)
    u.button('stuckRetry', u.w / 2 - 34, topY(u) + 60, 68, 44, { color: 'orange', icon: 'retry', size: 18, radius: 14, scale: 0.95 + 0.05 * Math.sin(u.t * 6), onTap: tap(() => startLevel(g.level)) });
  if (g.race) {
    const pl = g.place || 1, n = (g.racers.length + 1), k = g.placeT ? 1 + Math.max(0, 0.3 - (u.t - g.placeT)) : 1;
    c.save(); c.translate(u.w - PAD, topY(u) + 28); c.scale(k, k);
    const sw = u.measure(`/${n}`, 18);
    u.text(ord(pl), -sw - 2, 0, 36, GOLD, { align: 'right' }); u.text(`/${n}`, 0, 6, 18, '#fff', { align: 'right' });
    c.restore();
    // progress track with a dot per truck
    const tx = PAD + 2 + u.measure('AUTO', 15) + 22 + GAP + 10, tw = u.w - PAD - 10 - tx, ty = topY(u) + 70, finishX = g.sim.finishX || 1, sx = l.start?.x || 0;
    u.rr(tx, ty, tw, 10, 5); c.fillStyle = 'rgba(10,30,80,0.5)'; c.fill(); c.lineWidth = 2; c.strokeStyle = INK; c.stroke();
    const all = g.all || [{ x: g.sim.x }];
    const cols = ['#ffe14d', ...g.racers.map((r) => r.color)];
    for (let i = all.length - 1; i >= 0; i--) {
      const o = all[i], pp = o.fin != null ? 1 : Math.max(0, Math.min(1, (o.x - sx) / (finishX - sx))), r = i === 0 ? 10 : 8;
      c.beginPath(); c.arc(tx + pp * tw, ty + 5, r, 0, Math.PI * 2); c.fillStyle = cols[i] || '#fff'; c.fill(); c.lineWidth = 2; c.strokeStyle = INK; c.stroke();
    }
  } else {
    const txt = `${g.sim.gemsTaken}/${g.sim.gems.length}`, pw = u.measure(txt, 17) + 50;
    u.pill(u.w - PAD - pw, topY(u) + 8, 34, { gem: true, text: txt }, { minW: pw });
  }
  if (testRun) {
    const tr = testRun, txt = `TEST ${(AUTO_KINDS.find((k) => k[0] === tr.kind) || AUTO_KINDS[2])[1]}  ${tr.i + 1}/${tr.queue.length}   ✓ ${tr.pass}   ✗ ${tr.fails.length}`, tw2 = u.measure(txt, 15) + 90, tx2 = u.w / 2 - tw2 / 2, ty2 = topY(u) + 92;
    u.rr(tx2, ty2, tw2, 36, 12); c.fillStyle = 'rgba(10,30,80,0.75)'; c.fill(); c.lineWidth = 3; c.strokeStyle = INK; c.stroke();
    u.text(txt, tx2 + 14, ty2 + 19, 15, '#b8ffc0', { align: 'left' });
    u.button('teststop', tx2 + tw2 - 66, ty2 + 5, 58, 26, { color: 'red', label: 'Stop', size: 14, radius: 9, ring: false, onTap: tap(() => endTest(true)) });
  }
  // drive controls: hold on the road in front of the truck to drive, behind it to brake / reverse;
  // the two arrows still work as buttons (they take the touch first)
  const cs = Math.min(u.w * 0.3, 170), cy = u.h - B - 28 - cs, thr = throttleInput();
  const dy0 = topY(u) + 130;
  u.hit(0, dy0, u.w, u.h - dy0, { id: 'drive', hold: (v, st) => { if (!st) return; if (v) drivePtrs.add(st); else drivePtrs.delete(st); Audio.unlock(); u.request(); } });
  for (const [side, ic, x] of [['L', 'left', u.w * 0.04], ['R', 'right', u.w * 0.96 - cs]]) {
    const id = 'ctrl' + side, down = u.isDown(id) || (side === 'L' ? keys.left || thr < 0 : keys.right || thr > 0);
    c.save(); c.globalAlpha = down ? 1 : 0.75;
    const s = down ? 0.88 : 1; c.translate(x + cs / 2, cy + cs / 2); c.scale(s, s); c.translate(-(x + cs / 2), -(cy + cs / 2));
    u.icon(ic, x + cs * 0.06, cy + cs * 0.06, cs * 0.88, '#fff', false);
    c.restore();
    u.hit(x - 12, cy - 12, cs + 24, cs + 24, { id, hold: (v) => { if (side === 'L') touchL = v; else touchR = v; Audio.unlock(); u.request(); } });
  }
  // tutorial: hand on the ▶ control, then short tips
  if (g.tut === 'drive') {
    const x = u.w * 0.96 - cs, k = 0.5 + 0.5 * Math.sin(u.t * 5);
    c.save(); c.globalAlpha = 0.35 + 0.35 * k; c.beginPath(); c.arc(x + cs / 2, cy + cs / 2, cs * (0.55 + 0.08 * k), 0, Math.PI * 2); c.lineWidth = 6; c.strokeStyle = GOLD; c.stroke(); c.restore();
    const hs = cs * 0.62, hx = x + cs / 2 - hs * 0.4, hy = cy + cs * 0.45 + k * 10;
    u.icon('hand', hx, hy, hs, '#fff');
    const txt = 'Hold in front to drive!', bw = u.measure(txt, 22) + 36, bx = Math.min(u.w - PAD - bw, x + cs / 2 - bw / 2), byy = cy - 58;
    u.rr(bx, byy, bw, 46, 16); c.fillStyle = 'rgba(10,30,80,0.8)'; c.fill(); c.lineWidth = 3; c.strokeStyle = INK; c.stroke();
    u.text(txt, bx + bw / 2, byy + 24, 22, GOLD);
    u.request(0.1);
  }
  if (g.tip && u.t - g.tip.t0 < g.tip.sec) {
    const a = Math.min(1, (u.t - g.tip.t0) / 0.2, (g.tip.sec - (u.t - g.tip.t0)) / 0.3), ty = u.h * 0.3, tw3 = Math.min(u.w - PAD * 2, u.measure(g.tip.text, 18) + 40);
    c.save(); c.globalAlpha = Math.max(0, a);
    u.rr(u.w / 2 - tw3 / 2, ty - 24, tw3, 48, 16); c.fillStyle = 'rgba(10,30,80,0.8)'; c.fill(); c.lineWidth = 3; c.strokeStyle = INK; c.stroke();
    u.text(g.tip.text, u.w / 2, ty + 1, 18, '#fff', { maxW: tw3 - 24 });
    c.restore(); u.request(0.1);
  }
  // race start lights + countdown, or level banner
  if (g.race) {
    // start lights and the count in one row under the HUD, above the trucks and their name tags
    const left = g.countdown, n = Math.ceil(left);
    const out = left <= 0 ? Math.min(1, (-left) / 0.6) : 0;
    if (out < 1) {
      const lw2 = 3 * 38 + 2 * 12 + 28, nsz = short() ? 54 : 64, numW = u.measure('GO!', nsz);
      const lx = u.w / 2 - (lw2 + GAP + numW) / 2, yy = topY(u) + (testRun ? 140 : 100) - out * 30;
      c.save(); c.globalAlpha = 1 - out;
      u.rr(lx - 3, yy - 3, lw2 + 6, 64, 21); c.fillStyle = '#fff'; c.fill();
      u.rr(lx, yy, lw2, 58, 18); c.fillStyle = '#1d1f2b'; c.fill(); c.lineWidth = 3; c.strokeStyle = INK; c.stroke();
      for (let i = 0; i < 3; i++) {
        const on = left <= 0 ? 'go' : i < 3 - n + 1 ? 'on' : '';
        c.beginPath(); c.arc(lx + 14 + 19 + i * 50, yy + 29, 19, 0, Math.PI * 2);
        c.fillStyle = on === 'go' ? '#46d35c' : on ? '#ff3d57' : '#3a3d4f'; c.fill();
      }
      const label = left > 0 ? String(n) : 'GO!', age = u.t - (g.countT ?? u.t), k = Math.min(1.1, u.pop(0, 0.45, age));
      const nx = lx + lw2 + GAP + numW / 2;
      c.translate(nx, yy + 30); c.scale(k, k); u.text(label, 0, 0, nsz, left > 0 ? GOLD : '#7dff8a');
      c.restore();
    }
  } else if (u.st < 2.1) {
    const a = u.st > 1.6 ? 1 - (u.st - 1.6) / 0.5 : 1, k = u.pop(0, 0.4), txt = `${l.index + 1}. ${l.name}`, bw = u.measure(txt, 30) + 44, by = u.h * 0.22 - (u.st > 1.6 ? (u.st - 1.6) * 40 : 0);
    c.save(); c.globalAlpha = Math.max(0, a); c.translate(u.w / 2, by); c.scale(k, k);
    u.rr(-bw / 2, -26, bw, 52, 16); c.fillStyle = 'rgba(10,30,80,0.4)'; c.fill();
    u.text(txt, 0, 1, 30); c.restore();
  }
  return g.countdown > -0.8;
}

// ------------------------------------------------------------ fail screen (crash photo)
const QUIPS = {
  time: ['Time\'s up!', 'Too slow, too late!', 'The clock won this one.', 'Tick tock... boom.'],
  roof: ['Roof parking is not a thing.', 'Wrong side up!', 'Turtle mode activated.', 'Nice ceiling view!'],
  nose: ['Face plant!', 'Nose first. Classic.', 'The ground said hello.', 'Headbutt of the year.'],
  backflip: ['Too much style!', 'Backflip... almost.', 'Show-off!', 'Rotation: 270°. Needed: 360°.'],
  crash: ['You got stuck! Try again!', 'Crane down!', 'That was a flip.', 'Ouch.'],
  splash: ['Trucks can\'t swim.', 'Glug glug glug...', 'Took an unplanned dip!', 'Need a bigger jump!'],
  splashSpin: ['Olympic dive! 10 points!', 'Spinning into the deep.', 'Tumble dry: ON.'],
  splashRoof: ['Belly flop!', 'Upside down AND wet.', 'Swimming lessons needed.'],
  splashShort: ['Just... one... more... metre.', 'Short jump. Long swim.', 'Gravity wins again.'],
  lost: ['Wrong way, driver!', 'The finish is the OTHER way.'],
};
const STICKERS = { time: 'stars', roof: 'stars', nose: 'bang', backflip: 'spin', crash: 'bang', splash: 'bubbles', splashSpin: 'bubbles', splashRoof: 'bubbles', splashShort: 'bubbles', lost: 'bang' };

function onFail() {
  const g = game, l = g.level;
  Audio.engineStop(); Audio.fail();
  const snap = g.snap || R.snapshotCar(g.sim, g.z);
  const pose = g.sim.failPose || g.sim.reason || 'crash';
  const q = QUIPS[pose] || QUIPS.crash;
  const st = { snap, pose, sticker: STICKERS[pose], caption: q[(Math.random() * q.length) | 0], tilt: (Math.random() * 10 - 5) * Math.PI / 180, l };
  ui.show('fail', (u) => drawFail(u, st));
}
function drawSticker(u, kind, x, y, w, h, t) {
  const c = u.ctx;
  if (kind === 'stars') {
    c.save(); c.translate(x + w / 2, y + h * 0.36); c.rotate(t * 3.9);
    for (const [sx, sy] of [[-46, -4], [36, -20], [20, 24]]) u.star(sx, sy, 30, true);
    c.restore();
    const zy = y + h * 0.18; u.text('z', x + w * 0.62, zy + Math.sin(t * 5) * 4, 22); u.text('z', x + w * 0.69, zy - 8 + Math.sin(t * 5 + 1) * 4, 28); u.text('z', x + w * 0.77, zy - 18 + Math.sin(t * 5 + 2) * 4, 34);
  } else if (kind === 'bang' || kind === 'spin') {
    const k = Math.min(1.2, u.pop(0.3, 0.4, t)) * (1 + Math.sin(t * 6) * 0.04), bx = x + w * 0.27, by = y + h * 0.2;
    c.save(); c.translate(bx, by); c.scale(k, k);
    c.beginPath(); for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2, r = i % 2 ? 40 : 60; c.lineTo(Math.cos(a) * r * 1.2, Math.sin(a) * r * 0.8); } c.closePath();
    c.fillStyle = kind === 'bang' ? '#ffd21a' : '#7df9ff'; c.fill(); c.lineWidth = 3; c.strokeStyle = INK; c.stroke();
    u.text(kind === 'bang' ? 'BONK!' : '360°?', 0, 2, 26, kind === 'bang' ? '#ff3d57' : '#0b3e8a', { outline: false });
    c.restore();
    for (let i = -1; i <= 1; i++) { c.save(); c.translate(x + w * 0.25 + i * 24, y + h * 0.62); c.rotate(i * 0.5); c.fillStyle = '#fff'; c.fillRect(-2, -26, 4, 26); c.restore(); }
  } else if (kind === 'bubbles') {
    for (let i = 0; i < 5; i++) {
      const ph = ((t * 0.45 + i * 0.21) % 1), bx = x + w * (0.3 + 0.1 * i), by = y + h * 0.9 - ph * h * 0.7, r = 5 + (i % 3) * 4 * (0.4 + ph);
      c.globalAlpha = Math.min(1, ph * 5) * (1 - ph); c.beginPath(); c.arc(bx, by, r, 0, Math.PI * 2); c.fillStyle = 'rgba(255,255,255,0.3)'; c.fill(); c.lineWidth = 3; c.strokeStyle = '#fff'; c.stroke(); c.globalAlpha = 1;
    }
    u.text('<°)))><', x + w * 0.1 + (Math.sin(t * 1.2) * 0.5 + 0.5) * w * 0.4, y + h * 0.84, 22, '#ffd21a', { align: 'left' });
  }
}
function drawFail(u, st) {
  const c = u.ctx, T = u.safeTop, B = u.safeBottom, t = u.st;
  c.fillStyle = 'rgba(10,60,170,0.35)'; c.fillRect(0, 0, u.w, u.h);
  const used = game?.continues || 0, canContinue = !st.continued && game && !game.race && used < MAX_CONTINUES, over = game && !game.race && used >= MAX_CONTINUES;
  const barH = short() ? 72 : 82, contH = canContinue ? 64 : 0, heartsH = 0;
  const avail = u.h - T - B - barH - contH - 90 - heartsH;
  const pw = Math.min(u.w * 0.78, 360, avail / 1.33), ph = pw * 1.05, frameH = ph + 16 + 64;
  const px = u.w / 2 - pw / 2, py = T + 30 + heartsH + (avail - frameH) / 2 + 10;
  // drop-in animation
  const k = u.slide(0, 0.55), drop = (1 - k) * -u.h * 0.6, rot = st.tilt + (1 - k) * 0.4;
  c.save(); c.translate(u.w / 2, py + frameH / 2 + drop); c.rotate(rot);
  const fx = -pw / 2 - 16, fy = -frameH / 2;
  c.fillStyle = '#0b2e66'; c.fillRect(fx - 10, fy + 12, pw + 32, frameH);
  c.fillStyle = '#fff'; c.fillRect(fx, fy, pw + 32, frameH);
  if (st.snap) c.drawImage(st.snap, -pw / 2, fy + 16, pw, ph); else { c.fillStyle = '#19a1ff'; c.fillRect(-pw / 2, fy + 16, pw, ph); }
  const vg = c.createRadialGradient(0, fy + 16 + ph / 2, pw * 0.3, 0, fy + 16 + ph / 2, pw * 0.75); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.28)');
  c.fillStyle = vg; c.fillRect(-pw / 2, fy + 16, pw, ph);
  c.save(); c.beginPath(); c.rect(-pw / 2, fy + 16, pw, ph); c.clip(); drawSticker(u, st.sticker, -pw / 2, fy + 16, pw, ph, t); c.restore();
  // OOPS stamp
  const sk = t < 0.5 ? 0 : Math.min(1, (t - 0.5) / 0.35), ss = 3 - 2 * sk;
  if (sk > 0) {
    const stamp = over ? 'GAME OVER' : st.pose === 'time' ? 'TIME UP!' : 'OOPS!', sw = stamp.length > 5 ? 168 : 112;
    c.save(); c.translate(pw / 2 - sw / 2 - 8, fy + 46); c.rotate(0.24); c.scale(ss, ss); c.globalAlpha = 0.9 * sk;
    u.rr(-sw / 2, -22, sw, 44, 8); c.lineWidth = 4; c.strokeStyle = '#ff3d57'; c.stroke();
    u.text(stamp, 0, 2, 28, '#ff3d57', { outline: false }); c.restore();
  }
  u.text(over ? 'GAME OVER - no continues left' : st.caption, 0, fy + 16 + ph + 34, Math.min(24, pw / 13), over ? '#ff3d57' : '#8a92a6', { outline: false, maxW: pw });
  c.restore();
  // buttons
  const by = u.h - B - 24 - barH;
  // rewarded offer: continue from the checkpoint (no hints: every level is driven by the player)
  const offers = [];
  if (canContinue && HSGame.has('ads') && HSGame.canShowAd('revive')) offers.push({ id: 'continue', color: 'green', parts: [{ icon: 'video', size: 22 }, `Continue (${MAX_CONTINUES - used} left)`], go: () => adGo(HSGame.showAd('revive'), () => continueAfterCrash(st)) });
  if (offers.length) {
    const ow = Math.min(u.w - PAD * 2, offers.length > 1 ? 360 : 280), bw = (ow - GAP * (offers.length - 1)) / offers.length;
    offers.forEach((o, i) => u.button(o.id, u.w / 2 - ow / 2 + i * (bw + GAP), by - 66, bw, 52, { color: o.color, parts: o.parts, size: 20, scale: u.pop(0.6, 0.4), onTap: tap(() => { if (!adBusy) o.go(); }) }));
  }
  barButtons(u, [
    { id: 'home', label: 'Home', icon: 'home', onTap: () => adBreak(showWorlds) },
    { id: 'retry', label: 'Retry', icon: 'retry', color: 'blue', big: true, onTap: () => adBreak(() => startLevel(st.l)) },
    { id: 'levels', label: 'Levels', icon: 'levels', onTap: () => adBreak(() => showLevels(st.l.world)) },
  ], by);
  return t < 1.2 || st.sticker === 'stars' || st.sticker === 'bubbles' || st.sticker === 'bang';
}
// Rewarded "continue": flip the truck back on its wheels at the last checkpoint and keep going.
function continueAfterCrash(st) {
  const g = game; if (!g) return;
  st.continued = true; g.continues = (g.continues || 0) + 1;
  // out of time: the clock gets 10 more seconds (and a few to spare beyond the time spent so far)
  if (g.sim.reason === 'time') g.extraT += Math.max(10, g.sim.time - (g.limit + g.extraT) + 10);
  const back = g.sim.reason === 'splash' ? 9 : g.sim.reason === 'time' ? 0 : 5;
  const cp = [...g.me.safe].reverse().find((x) => x <= g.sim.x - back) ?? g.sim.startX;
  respawnAt(g.me, cp);
  g.over = false; g.failT = 0; g.snap = null; g.paused = false; g.slowT = 0; R.camPush = 0;
  showHud(); Audio.engineStart();
}

// ------------------------------------------------------------ level complete
function onWin() {
  Audio.engineStop();
  const g = game, l = g.level, sim = g.sim;
  const t = sim.finishTime, prev = lvlSave(l), allGems = sim.gemsTaken >= sim.gems.length;
  const stars = 1 + (allGems ? 1 : 0) + (t <= par(l) ? 1 : 0);
  let earn = sim.gemsTaken * 5;
  const left = Math.max(0, Math.floor(g.limit + g.extraT - t)), timeGems = left * TIME_GEMS;   // finishing early pays
  earn += timeGems;
  if (!prev || prev.time == null) earn += 20 + l.world * 5;   // first clear: coins to buy trucks
  if (stars === 3 && (!prev || (prev.stars || 0) < 3)) earn += 30;
  const best = prev?.time != null ? Math.min(prev.time, t) : t;
  save.levels[l.id] = { time: best, stars: Math.max(stars, prev?.stars || 0) };
  const newBest = !prev || prev.time == null || t < prev.time;
  persist();
  const next = WORLDS[l.world].levels[l.index + 1];
  earn *= gemMult();   // 2x Gems booster
  const st = { l, t, best, newBest, stars, earn, gems: `${sim.gemsTaken}/${sim.gems.length}`, next, mult: 1, boosted: gemMult() > 1, left, timeGems };
  [0, 1, 2].forEach((i) => { if (i < stars) setTimeout(() => Audio.star(i), 300 + i * 250); });
  ui.show('win', (u) => drawWin(u, st), { anim: 2.6 });
  setTimeout(() => earnGems(earn, st.earnPos), 1000);
  if (save.autoplay && next) setTimeout(() => { if (ui.screen?.name === 'win' && game?.level === l) startLevel(next); }, 2600);
}
function drawWin(u, st) {
  const c = u.ctx, T = u.safeTop, B = u.safeBottom, barH = short() ? 72 : 82;
  c.fillStyle = 'rgba(10,60,170,0.35)'; c.fillRect(0, 0, u.w, u.h);
  const pw = Math.min(u.w * 0.9, 400), ph = 368, px = u.w / 2 - pw / 2;
  const by = u.h - B - 24 - barH, py = Math.max(T + 50, (by - 80 - ph) / 2 + 10);
  u.panel(px, py, pw, ph, { ribbon: 'Level Complete!', scale: u.pop(0, 0.4) });
  for (let i = 0; i < 3; i++) {
    const k = i < st.stars ? Math.min(1.3, u.pop(0.25 + i * 0.25, 0.5)) : 1, big = i === 1;
    u.star(u.w / 2 + (i - 1) * 76, py + 70 - (big ? 12 : 0), big ? 78 : 66, i < st.stars && k > 0.3, i < st.stars ? Math.max(0.01, k) : 1);
  }
  const rows = [['Time', fmt(st.t)], ['Best', fmt(st.best) + (st.newBest ? '  NEW!' : '')], ['Gems', st.gems], ['Time left', `${st.left}s  +${st.timeGems}`]];
  rows.forEach(([a, b], i) => {
    const ry = py + 128 + i * 38;
    u.text(a, px + 24, ry, 20, '#fff', { align: 'left' }); u.text(b, px + pw - 24, ry, 20, b.includes('NEW') ? GOLD : '#fff', { align: 'right' });
    c.fillStyle = 'rgba(255,255,255,0.15)'; c.fillRect(px + 20, ry + 18, pw - 40, 2);
  });
  u.text(`★ finish · ★ all gems · ★ under ${fmt(par(st.l))}`, u.w / 2, py + 286, 13, '#fff', { maxW: pw - 30 });
  const shown = Math.round(st.earn * st.mult * Math.min(1, Math.max(0, (u.st - 1) / 0.9)));
  u.row([{ text: `+${shown}`, color: GOLD }, { gem: true, size: 30 }, ...(st.boosted ? [{ text: ' 2x', color: '#7aff8a' }] : [])], u.w / 2, py + 328, { size: 30, gap: 10 });
  st.earnPos = { x: u.w / 2, y: py + 328 };
  if (st.mult === 1 && st.earn > 0 && !testRun && HSGame.has('ads') && HSGame.canShowAd('level_x3')) {
    const bw = Math.min(u.w - 60, 280);
    const m = HSGame.rewards('level_x3')?.mult || 3;
    u.button('x3', u.w / 2 - bw / 2, by - 66, bw, 52, { color: 'green', icon: 'video', label: `x${m} gems`, size: 20, scale: u.pop(1.2, 0.4),
      onTap: tap(() => { if (adBusy) return; multBase = { base: st.earn, pos: st.earnPos }; adGo(HSGame.showAd('level_x3'), () => { st.mult = m; st.t0x = u.t; Audio.win(); }, () => { multBase = null; }); }) });
  }
  barButtons(u, [
    { id: 'home', label: 'Home', icon: 'home', onTap: () => adBreak(showWorlds) },
    { id: 'retry', label: 'Retry', icon: 'retry', onTap: () => adBreak(() => startLevel(st.l)) },
    st.next ? { id: 'next', label: 'Next', icon: 'next', color: 'blue', big: true, onTap: () => adBreak(() => startLevel(st.next)) }
      : { id: 'levels', label: 'Levels', icon: 'levels', color: 'blue', big: true, onTap: () => adBreak(() => showLevels(st.l.world)) },
  ], by);
  return u.st < 2.6;
}

// ------------------------------------------------------------ race flow
function finishRace() {
  Audio.engineStop();
  const g = game;
  for (const r of g.racers) {
    let n = 0;
    while (r.finish == null && n < 60 * 60) {
      r.r.sim.step(r.bot(r.r.sim)); n++;
      for (const e of r.r.sim.drainEvents()) if (e.type === 'win') r.finish = r.r.sim.finishTime;
      racerWatch(r.r);
    }
    if (r.finish == null) r.finish = Infinity;
  }
  const rows = [{ name: 'You', color: '#ffe14d', time: g.sim.finishTime, me: true }, ...g.racers.map((r) => ({ name: r.name, color: r.color, time: r.finish }))].sort((a, b) => a.time - b.time);
  const race = g.race;
  const pts = race.random ? {} : save.cup.pts || {};
  rows.forEach((r, i) => { r.pts = rows.length - i; pts[r.name] = (pts[r.name] || 0) + r.pts; });
  if (!race.random) save.cup.pts = pts;
  const myPlace = rows.findIndex((r) => r.me);
  const earn = (Math.round(PLACE_GEMS[myPlace] * race.cup.reward) + g.sim.gemsTaken * 5) * gemMult();   // 2x Gems booster
  if (!race.random) save.cup.race = race.idx + 1;
  // every 1st place = +1 trophy on the leaderboard
  let rankMsg = null;
  if (myPlace === 0) {
    const before = rankOf(lbRows());
    save.trophies++;
    const after = rankOf(lbRows());
    rankMsg = after < before ? `Leaderboard rank #${after}  ▲${before - after}` : `Leaderboard rank #${after}`;
  }
  persist();
  if (myPlace === 0) Audio.win(); else Audio.star(0);
  const st = { rows, race, earn, mult: 1, trophy: myPlace === 0, rankMsg };
  ui.show('results', (u) => drawResults(u, st), { anim: 2.4 });
  ui.confetti();
  setTimeout(() => earnGems(earn, st.earnPos), 700);
}

function tableRows(u, rows, x, y, w, { time = true, rh = short() ? 44 : 50 } = {}) {
  const c = u.ctx, gap = rh < 44 ? 6 : 8;
  if (time) {
    u.text('Place', x + 10, y + 10, 15, '#fff', { align: 'left' }); u.text('Name', x + 70, y + 10, 15, '#fff', { align: 'left' });
    u.text('Time', x + w - 64, y + 10, 15, '#fff', { align: 'right' }); u.text('Pts', x + w - 10, y + 10, 15, '#fff', { align: 'right' });
    y += 24;
  }
  rows.forEach((r, i) => {
    const k = u.slide(0.15 + i * 0.12, 0.35), ry = y + i * (rh + gap) + (1 - k) * 40;
    c.save(); c.globalAlpha = k;
    const grad = i === 0 ? ['#ffd84a', '#f5b000'] : i === 1 ? ['#dfe3ee', '#b5bccd'] : i === 2 ? ['#e98a7a', '#c9604f'] : ['#5d6582', '#464d68'];
    if (r.me) { u.rr(x - 3, ry - 3, w + 6, rh + 6, 16); c.fillStyle = '#fff'; c.fill(); }
    u.rr(x, ry, w, rh, 14); c.fillStyle = u.grad(ry, ry + rh, grad); c.fill(); c.lineWidth = 3; c.strokeStyle = INK; c.stroke();
    const dark = i < 2, tc = dark ? (i === 0 ? '#6b3d00' : '#3c4258') : '#fff';
    c.beginPath(); c.arc(x + 26, ry + rh / 2, 15, 0, Math.PI * 2); c.fillStyle = 'rgba(255,255,255,0.4)'; c.fill();
    u.text(String(i + 1), x + 26, ry + rh / 2 + 1, 17, tc, { outline: !dark });
    u.text(r.name, x + 52, ry + rh / 2 + 1, 17, tc, { align: 'left', outline: !dark, maxW: w - 170 });
    if (time) u.text(r.time === Infinity ? 'DNF' : fmt(r.time), x + w - 52, ry + rh / 2 + 1, 16, tc, { align: 'right', outline: !dark });
    u.text(String(r.pts ?? r.p), x + w - 12, ry + rh / 2 + 1, 21, tc, { align: 'right', outline: !dark });
    c.restore();
  });
  return y + rows.length * (rh + gap);
}

function drawResults(u, st) {
  const c = u.ctx, B = u.safeBottom, barH = short() ? 72 : 82;
  c.fillStyle = 'rgba(10,60,170,0.35)'; c.fillRect(0, 0, u.w, u.h);
  topbar(u);
  const by = u.h - B - 24 - barH, showX2 = st.mult === 1 && st.earn > 0 && !testRun && HSGame.has('ads') && HSGame.canShowAd('race_x2');
  // fit the table between the top bar and the buttons: rows shrink on short screens with 6 trucks
  const pw = Math.min(u.w * 0.92, 420), px = u.w / 2 - pw / 2, py = topY(u) + pillH() + GAP + 22;
  const bottom = (showX2 ? by - 66 : by) - GAP, n = st.rows.length, extra = 50 + (st.rankMsg ? 26 : 0);
  const rh = Math.max(34, Math.min(short() ? 44 : 50, Math.floor((bottom - py - 60 - extra - 10) / n) - 8));
  const ph = 60 + n * (rh + (rh < 44 ? 6 : 8)) + extra;
  u.panel(px, py, pw, ph, { ribbon: 'Race Results' });
  const endY = tableRows(u, st.rows, px + 14, py + 36, pw - 28, { rh });
  const shown = Math.round(st.earn * st.mult * Math.min(1, Math.max(0, (u.st - 0.7) / 0.9)));
  u.row([{ text: `+${shown}`, color: GOLD }, { gem: true, size: 28 }, ...(st.trophy ? ['   +1', { icon: 'trophy', size: 30, color: GOLD }] : [])], u.w / 2, endY + 20, { size: 28, gap: 10, maxW: pw - 20 });
  if (st.rankMsg) u.text(st.rankMsg, u.w / 2, endY + 50, 17, '#ffe9a8', { maxW: pw - 20 });
  st.earnPos = { x: u.w / 2, y: endY + 20 };
  if (showX2) {
    const bw = Math.min(u.w - 60, 280);
    const m = HSGame.rewards('race_x2')?.mult || 2;
    u.button('x2', u.w / 2 - bw / 2, by - 66, bw, 52, { color: 'green', icon: 'video', label: `x${m} gems`, size: 20, scale: u.pop(1, 0.4),
      onTap: tap(() => { if (adBusy) return; multBase = { base: st.earn, pos: st.earnPos }; adGo(HSGame.showAd('race_x2'), () => { st.mult = m; Audio.win(); }, () => { multBase = null; }); }) });
  }
  const nextLabel = st.race.random ? 'Another one' : st.race.idx < 2 ? 'Next race' : 'Standings';
  barButtons(u, [
    { id: 'home', label: 'Home', icon: 'home', onTap: () => adBreak(showRace, true) },
    { id: 'next', label: nextLabel, icon: 'next', color: 'blue', big: true, onTap: () => adBreak(() => { if (st.race.random) startRandomRace(); else if ((save.cup.race || 0) >= 3) cupStandings(); else showRace(); }, true) },
  ], by);
  return u.st < 2.4;
}

function cupStandings() {
  game = null;
  const cupIdx = save.cup.idx, cup = CUPS[cupIdx];
  const pts = save.cup.pts || {};
  const rows = Object.entries(pts).map(([name, p]) => ({ name, p, me: name === 'You' })).sort((a, b) => b.p - a.p);
  const won = rows[0]?.me;
  // first win of a cup: the 'cup_win' reward (HSGame credits it); x2 with a video
  const firstWin = won && !save.cups[cupIdx], cupSt = { doubled: false };
  let bonus = 0;
  if (firstWin) { save.cups[cupIdx] = true; bonus = HSGame.claim('cup_win')?.gems || 0; }
  save.cup = { idx: won && cupIdx < CUPS.length - 1 ? cupIdx + 1 : cupIdx, race: 0, pts: null };
  persist();
  R.showDiorama(WORLDS[cup.world], vehicleById(save.car), 2.6);
  const standings = () => ui.show('standings', (u) => {
    const c = u.ctx, T = u.safeTop, B = u.safeBottom;
    c.fillStyle = 'rgba(10,60,170,0.35)'; c.fillRect(0, 0, u.w, u.h);
    topbar(u);
    const by0 = u.h - B - 24 - (short() ? 72 : 82), showX2 = bonus && !cupSt.doubled && !testRun && HSGame.has('ads') && HSGame.canShowAd('cup_x2'), by = by0 - (showX2 ? 66 : 0), n = rows.length, ts = short() ? 64 : 92;
    const pw = Math.min(u.w * 0.92, 420), px = u.w / 2 - pw / 2, py = topY(u) + pillH() + GAP + 22, ty = py + 34 + ts;
    const rh = Math.max(34, Math.min(short() ? 44 : 50, Math.floor((by - GAP - ty - 50) / n) - 8)), gap = rh < 44 ? 6 : 8;
    u.panel(px, py, pw, ty - py + n * (rh + gap) + 44, { ribbon: `${cup.name} ${won ? 'Won!' : 'Final'}`, ribbonColor: cup.color });
    const k = u.pop(0.1, 0.6) * (won ? 1 + Math.sin(u.t * 4) * 0.05 : 1);
    c.save(); c.translate(u.w / 2, py + 26 + ts / 2); c.scale(k, k); u.icon('trophy', -ts / 2, -ts / 2, ts, won ? GOLD : '#8e97b0'); c.restore();
    const endY = tableRows(u, rows, px + 14, ty, pw - 28, { time: false, rh });
    u.text(won ? (bonus ? `+${bonus} bonus gems! Next cup unlocked.` : 'Cup won again!') : 'Finish 1st overall to win the cup!', u.w / 2, endY + 16, 15, '#fff', { maxW: pw - 20 });
    if (showX2) { const bw = Math.min(u.w - 60, 280); u.button('cupx2', u.w / 2 - bw / 2, by0 - 66, bw, 52, { color: 'green', parts: [{ icon: 'video', size: 22 }, 'x2 bonus', `+${bonus}`, { gem: true, size: 18 }], size: 19, scale: u.pop(1, 0.4), onTap: tap(() => { if (adBusy) return; multBase = { base: bonus, pos: { x: u.w / 2, y: u.h / 2 } }; adGo(HSGame.showAd('cup_x2'), () => { cupSt.doubled = true; Audio.win(); }, () => { multBase = null; }); }) }); }
    barButtons(u, [{ id: 'cont', label: 'Continue', icon: 'trophy', color: 'blue', big: true, onTap: showRace }], by0);
    return true;
  });
  if (won) championParty(cup, standings); else { Audio.fail(); standings(); }
}

// Winning a cup is a big moment: the trophy drops in on golden rays, fireworks go off all over the sky,
// confetti rains, a fanfare plays over the crowd's applause. Tap (or wait) to see the standings.
function championParty(cup, next) {
  const st = { fw: [], nextFw: 0, t0: null, done: false };
  Audio.fanfare(); Audio.applause(4.5); ui.confetti(140); P.vibrate('heavy');
  setTimeout(() => { Audio.applause(3); ui.confetti(90); }, 2200);
  const go = () => { if (st.done) return; st.done = true; Audio.win(); next(); };
  setTimeout(() => { if (ui.screen?.name === 'champion') go(); }, 6500);
  ui.show('champion', (u) => {
    const c = u.ctx; if (st.t0 == null) st.t0 = u.t; const t = u.t - st.t0;
    c.fillStyle = `rgba(10,20,60,${Math.min(0.72, t * 1.5)})`; c.fillRect(0, 0, u.w, u.h);
    const cx = u.w / 2, cy = u.h * 0.4, R0 = Math.max(u.w, u.h);
    // golden rays turning behind the trophy
    c.save(); c.translate(cx, cy); c.rotate(t * 0.35); c.globalAlpha = Math.min(0.55, t);
    for (let i = 0; i < 16; i++) { c.rotate(Math.PI / 8); c.beginPath(); c.moveTo(0, 0); c.lineTo(R0, -R0 * 0.09); c.lineTo(R0, R0 * 0.09); c.closePath(); c.fillStyle = i % 2 ? '#ffd21a' : '#ff9f1a'; c.fill(); }
    c.restore();
    // fireworks: shells burst into rings of sparks that fall and fade
    if (t > 0.6 && t > st.nextFw) {
      st.nextFw = t + 0.28 + Math.random() * 0.35;
      const col = ['#ff3d6b', '#ffd21a', '#2fd4ff', '#46d35c', '#c6a8ff', '#ffffff', '#ff8a1f'][(Math.random() * 7) | 0];
      const fx = u.w * (0.12 + Math.random() * 0.76), fy = u.h * (0.1 + Math.random() * 0.35), n = 26 + ((Math.random() * 14) | 0), sp = 120 + Math.random() * 90;
      st.fw.push(...Array.from({ length: n }, (_, i) => { const a = (i / n) * Math.PI * 2; return { x: fx, y: fy, vx: Math.cos(a) * sp * (0.8 + Math.random() * 0.4), vy: Math.sin(a) * sp * (0.8 + Math.random() * 0.4), t0: t, col }; }));
      if (st.fw.length > 900) st.fw.splice(0, st.fw.length - 900);
    }
    st.fw = st.fw.filter((p) => t - p.t0 < 1.6);
    for (const p of st.fw) {
      const a = t - p.t0, x = p.x + p.vx * a, y = p.y + p.vy * a + 90 * a * a;
      c.globalAlpha = Math.max(0, 1 - a / 1.6); c.fillStyle = p.col; c.fillRect(x - 2.5, y - 2.5, 5, 5);
    }
    c.globalAlpha = 1;
    // the trophy drops in, bounces, then breathes; the title pops in under it
    const drop = Math.min(1, t / 0.7), ease = 1 - Math.pow(1 - drop, 3), bounce = t > 0.7 ? Math.abs(Math.sin((t - 0.7) * 9)) * Math.max(0, 1 - (t - 0.7) * 1.6) * 22 : 0;
    const ts = Math.min(u.w * 0.5, 230) * (1 + Math.sin(t * 3) * 0.03), ty = -ts + (cy - ts / 2 + ts) * ease - bounce;
    u.icon('trophy', cx - ts / 2, ty, ts, GOLD);
    const k = u.pop(0.8, 0.5);
    if (k > 0) {
      c.save(); c.translate(cx, cy + ts * 0.62); c.scale(k, k);
      u.text('CHAMPION!', 0, 0, Math.min(56, u.w * 0.13), GOLD);
      u.text(cup.name, 0, Math.min(52, u.w * 0.12), 24, '#fff');
      c.restore();
    }
    if (t > 1.6) u.text('Tap to continue', cx, u.h - u.safeBottom - 60, 16, `rgba(255,255,255,${0.5 + 0.5 * Math.sin(t * 4)})`);
    u.hit(0, 0, u.w, u.h, { id: 'champ', onTap: () => { if (t > 1.2) go(); } });
    u.request(0.1);
    return true;
  }, { anim: 6 });
}

function startRandomRace() {
  const level = RACE_TRACKS[(Math.random() * RACE_TRACKS.length) | 0];
  const n = laneCount() - 1, start = (Math.random() * RIVALS.length) | 0;
  const rivals = Array.from({ length: n }, (_, i) => ({ ...RIVALS[(start + i) % RIVALS.length], skill: 0.3 + Math.random() * 0.5 }));
  startLevel(level, { cup: { name: 'Random', reward: 1, color: '#ff8a1f' }, idx: 0, rivals, random: true });
}
function startRace() {
  const cupIdx = save.cup.idx, cup = CUPS[cupIdx];
  const idx = save.cup.race || 0;
  if (!save.cup.pts) save.cup.pts = { You: 0 };
  // every race is a little different: each rival's form is rolled (a good day or a bad one) around the cup's level,
  // and who gets which level is shuffled, so the player always has a real chance at the cup
  const skills = cup.skill.slice(0, laneCount() - 1).map((k) => Math.max(0.25, Math.min(1, k * (0.75 + Math.random() * 0.4)))).sort(() => Math.random() - 0.5);
  const rivals = Array.from({ length: laneCount() - 1 }, (_, i) => ({ ...RIVALS[(cupIdx + i) % RIVALS.length], skill: skills[i] ?? cup.skill[i] }));
  rivals.forEach((r) => { if (save.cup.pts[r.name] == null) save.cup.pts[r.name] = 0; });
  persist();
  startLevel(RACE_TRACKS[cup.races[idx]], { cup, cupIdx, idx, rivals });
}

function showRace() {
  game = null; Audio.engineStop();
  const cup = CUPS[save.cup.idx];
  R.showDiorama(WORLDS[cup.world], vehicleById(save.car), 2.6);
  ui.show('race', drawRace);
}
function drawRace(u) {
  const c = u.ctx, T = u.safeTop, B = u.safeBottom, sh = short();
  const cupIdx = save.cup.idx, cup = CUPS[cupIdx], raceNo = save.cup.race || 0, pts = save.cup.pts || {};
  topbar(u);
  // cups row
  const cw = Math.min(82, (u.w - PAD * 2 - 24) / 4), cx0 = u.w / 2 - (cw * 4 + 24) / 2, cy = topY(u) + pillH() + GAP;
  CUPS.forEach((cp, i) => {
    const lock = i > cupIdx && !save.cups[i] && !save.allRes, cur = i === cupIdx, x = cx0 + i * (cw + 8);
    u.rr(x, cy, cw, 66, 14); c.fillStyle = 'rgba(10,30,80,0.5)'; c.fill(); c.lineWidth = 3; c.strokeStyle = INK; c.stroke();
    if (cur) { u.rr(x - 3, cy - 3, cw + 6, 72, 16); c.lineWidth = 3; c.strokeStyle = cp.color; c.stroke(); }
    c.globalAlpha = lock ? 0.6 : 1;
    u.icon(lock ? 'lock' : 'trophy', x + cw / 2 - 16, cy + 6, 32, save.cups[i] ? GOLD : cur ? cp.color : '#6f7894');
    u.text(cp.name, x + cw / 2, cy + 52, 11, '#fff', { maxW: cw - 6 });
    c.globalAlpha = 1;
    // any open cup can be picked (won cups to replay; all of them with All resources)
    if (!lock && !cur) u.hit(x, cy, cw, 66, { id: 'cup' + i, onTap: tap(() => { save.cup = { idx: i, race: 0, pts: null }; persist(); showRace(); }) });
  });
  // panel
  const pw = Math.min(u.w * 0.9, 400), px = u.w / 2 - pw / 2, py = cy + (sh ? 100 : 118);
  const entries = Object.entries(pts).sort((a, b) => b[1] - a[1]);
  const ph = 130 + (entries.length ? entries.length * 28 : 50);
  u.panel(px, py, pw, ph, { ribbon: cup.name, ribbonColor: cup.color });
  u.text(`Race ${raceNo + 1} of 3 · ${RACE_TRACKS[cup.races[raceNo]].name}`, u.w / 2, py + 44, 16, '#fff', { maxW: pw - 20 });
  // lanes selector
  const lx0 = u.w / 2 - 110;
  u.text('Lanes', lx0, py + 84, 16, '#fff', { align: 'left' });
  [3, 4, 5, 6].forEach((n, i) => {
    const on = laneCount() === n, x = lx0 + 62 + i * 46, y = py + 64;
    u.rr(x, y, 40, 40, 12); c.fillStyle = on ? u.grad(y, y + 40, GRAD.gold) : 'rgba(0,0,0,0.25)'; c.fill(); c.lineWidth = 3; c.strokeStyle = INK; c.stroke();
    u.text(String(n), x + 20, y + 21, 20, on ? '#5a3000' : '#fff', { outline: !on });
    u.hit(x, y, 40, 40, { id: 'lane' + n, onTap: tap(() => { save.lanes = n; persist(); u.request(); }) });
  });
  if (entries.length) entries.forEach(([n, p], i) => {
    const y = py + 124 + i * 28, me = n === 'You';
    if (me) { u.rr(px + 14, y - 12, pw - 28, 26, 8); c.fillStyle = 'rgba(255,198,26,0.3)'; c.fill(); }
    u.text(`${i + 1}`, px + 28, y + 1, 16, '#fff', { align: 'left' }); u.text(n, px + 54, y + 1, 16, '#fff', { align: 'left' }); u.text(`${p} pts`, px + pw - 26, y + 1, 16, '#fff', { align: 'right' });
  });
  else { u.text(`Beat ${laneCount() - 1} rival trucks over 3 races.`, u.w / 2, py + 130, 15); u.text('1st place wins the cup!', u.w / 2, py + 152, 15); }
  const nT = navTop(u), bob = Math.sin(u.t * 3.9) * 3, rh = sh ? 64 : 74, raceY = nT - 2 * GAP - rh;
  u.button('race', u.w / 2 - 110, raceY + bob, 220, rh, { color: 'red', label: 'Race!', icon: 'flag', size: 34, onTap: tap(startRace) });
  const rw = 180, tw2 = 120, rx = u.w / 2 - (rw + GAP + tw2) / 2, ry = raceY - 2 * GAP - 44;
  u.button('rnd', rx, ry, rw, 44, { color: 'orange', label: 'Random track', icon: 'retry', size: 17, onTap: tap(startRandomRace) });
  u.button('top', rx + rw + GAP, ry, tw2, 44, { color: 'gold', label: 'Top', icon: 'trophy', size: 17, onTap: tap(showBoard) });
  navbar(u, 'race');
  return true;
}

// ------------------------------------------------------------ trophy leaderboard (simulated players, see leaderboard.js)
const lbRows = () => board(save.lb.seed, save.lb.start, { name: 'You', trophies: save.trophies || 0 });
const MEDAL = ['#ffd84a', '#dfe3ee', '#e98a7a'];
function avatar(u, cx, cy, r, color, name, ring) {
  const c = u.ctx;
  c.beginPath(); c.arc(cx, cy, r + 3, 0, Math.PI * 2); c.fillStyle = ring || '#fff'; c.fill();
  c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.fillStyle = color; c.fill(); c.lineWidth = 2.5; c.strokeStyle = INK; c.stroke();
  u.text(name[0].toUpperCase(), cx, cy + 1, r * 1.1);
}
function lbRow(u, r, x, y, w, h) {
  const c = u.ctx, top3 = r.rank <= 3;
  if (r.me) { u.rr(x - 3, y - 3, w + 6, h + 6, 15); c.fillStyle = '#fff'; c.fill(); }
  u.rr(x, y, w, h, 12); c.fillStyle = r.me ? u.grad(y, y + h, GRAD.gold) : 'rgba(10,30,80,0.45)'; c.fill(); c.lineWidth = 2.5; c.strokeStyle = INK; c.stroke();
  u.text(`#${r.rank}`, x + 12, y + h / 2 + 1, 16, top3 ? MEDAL[r.rank - 1] : '#fff', { align: 'left' });
  const ax = x + 12 + 46 + h * 0.32;
  avatar(u, ax, y + h / 2, h * 0.32, r.color, r.name);
  const tw = u.measure(String(r.trophies), 18) + 34;
  u.text(r.name, ax + h * 0.32 + 10, y + h / 2 + 1, 17, '#fff', { align: 'left', maxW: w - (ax - x) - h * 0.32 - 22 - tw });
  u.row([{ icon: 'trophy', size: 22, color: r.me ? '#fff' : GOLD }, String(r.trophies)], x + w - 10 - tw / 2, y + h / 2, { size: 18 });
}
function showBoard() {
  let rows = lbRows(), at = ui.t;
  delete ui.scrolls.lb;
  ui.overlay((u, age) => {
    if (u.t - at > 5) { rows = lbRows(); at = u.t; }    // the simulated players keep playing
    const c = u.ctx, sh = short();
    const pw = Math.min(u.w - PAD * 2, 440), px = u.w / 2 - pw / 2, py = topY(u) + 26, ph = u.h - u.safeBottom - PAD - py;
    u.panel(px, py, pw, ph, { ribbon: `Top ${BOARD_SIZE}`, ribbonColor: 'gold', scale: u.pop(0, 0.3, age) });
    if (age < 0.25) return true;
    const ix = px + PAD, iw = pw - PAD * 2;
    u.text('1st place in a race = +1 trophy', u.w / 2, py + 40, 14, '#fff', { maxW: iw });
    // podium: 2nd, 1st, 3rd
    const podY = py + 58, podH = sh ? 112 : 126, cw = iw / 3;
    [1, 0, 2].forEach((k, col) => {
      const r = rows[k], cx = ix + col * cw + cw / 2, rad = k === 0 ? (sh ? 24 : 28) : (sh ? 19 : 22), cy = podY + (k === 0 ? rad + 4 : rad + 18);
      avatar(u, cx, cy, rad, r.color, r.name, MEDAL[k]);
      c.beginPath(); c.arc(cx + rad * 0.75, cy - rad * 0.75, 10, 0, Math.PI * 2); c.fillStyle = MEDAL[k]; c.fill(); c.lineWidth = 2; c.strokeStyle = INK; c.stroke();
      u.text(String(k + 1), cx + rad * 0.75, cy - rad * 0.75 + 1, 13, '#5a3000', { outline: false });
      u.text(r.name, cx, cy + rad + 16, 14, r.me ? GOLD : '#fff', { maxW: cw - 6 });
      u.row([{ icon: 'trophy', size: 18, color: GOLD }, String(r.trophies)], cx, cy + rad + 36, { size: 16, maxW: cw - 6 });
    });
    // list 4..100, then the player's own row pinned above the close button
    const btnH = 48, btnY = py + ph - PAD - btnH, meH = 52, meY = btnY - GAP - meH, me = rows.find((r) => r.me);
    const listY = podY + podH + 6, listH = meY - 26 - listY, rh = 46, rest = rows.slice(3);
    u.scroll('lb', ix - 4, listY, iw + 8, listH, rest.length * (rh + 6) + 4, () => {
      const off = u.scrolls.lb?.off || 0;
      rest.forEach((r, i) => { const y = listY + 4 + i * (rh + 6); if (y + rh + 4 < listY + off || y - 4 > listY + off + listH) return; lbRow(u, r, ix, y, iw, rh); });
    });
    lbRow(u, me, ix, meY, iw, meH);
    const above = rows[me.rank - 2];
    const hint = !above ? 'You are the champion!' : `${above.trophies - me.trophies + 1} more win${above.trophies - me.trophies ? 's' : ''} to pass ${above.name}`;
    u.text(hint, u.w / 2, meY - 13, 13, '#ffe9a8', { maxW: iw });
    u.button('lbclose', ix, btnY, iw, btnH, { color: 'blue', label: 'Close', size: 20, onTap: tap(() => u.closeOverlay()) });
    return age < 0.6;
  });
}

// ------------------------------------------------------------ shop + upgrades
const thumbs = {};
let shopSel = null;
function showShop(sel) {
  game = null; Audio.engineStop();
  shopSel = sel || shopSel || save.car;
  R.showGarage(vehicleById(shopSel));
  ui.show('shop', drawShop, { keepScroll: !!sel, swipe: (d) => { if (shopTab === 'trucks') shopStep(d); } });
}
// swipe left / right anywhere on the showroom: next / previous truck
const shopList = () => [...VEHICLES].sort((a, b) => a.price - b.price);
function shopStep(d) {
  const list = shopList(), i = list.findIndex((v) => v.id === shopSel), n = Math.max(0, Math.min(list.length - 1, i + d));
  if (n === i) return;
  shopSel = list[n].id; R.showGarage(list[n]); Audio.click();
  const sc = ui.scrolls.cards; if (sc) { const cw = short() ? 110 : 128; sc.off = Math.max(0, Math.min(sc.max, n * (cw + GAP) - ui.w / 2 + cw / 2 + PAD)); sc.vel = 0; }
  ui.request(0.5);
}
let shopTab = 'trucks';
function drawShop(u) {
  const c = u.ctx, T = u.safeTop, B = u.safeBottom, sh = short();
  if (shopTab === 'trucks') u.hit(0, 0, u.w, u.h, { id: '__swipe' });   // empty space: swipe to change truck
  topbar(u);
  // free gems for a video (left, under the safe area)
  if (HSGame.has('ads') && HSGame.canShowAd('free_gems'))
    u.button('freegems', PAD, topY(u), 132, pillH(), { color: freeVidsLeft() > 0 ? 'green' : 'gray', parts: [{ icon: 'video', size: 22 }, `+${freeGemsAmount()}`, { gem: true, size: 18 }], size: 17, radius: 12, onTap: tap(() => { if (!adBusy) freeGemsVideo(); }) });
  // tabs: Trucks | Items | Gems
  const tabsY = topY(u) + pillH() + GAP, tabH = sh ? 34 : 38, tw = Math.min(u.w - PAD * 2, 360), tx0 = u.w / 2 - tw / 2;
  const tabs = [['trucks', 'Trucks', 'shop'], ['gems', 'Gems', null]];
  u.rr(tx0 - 3, tabsY - 3, tw + 6, tabH + 6, tabH / 2 + 3); c.fillStyle = 'rgba(255,255,255,0.7)'; c.fill();
  tabs.forEach(([id, label, ic], i) => {
    const x = tx0 + i * tw / tabs.length, on = shopTab === id;
    u.rr(x + 2, tabsY + 2, tw / tabs.length - 4, tabH - 4, (tabH - 4) / 2); c.fillStyle = on ? u.grad(tabsY, tabsY + tabH, GRAD.orange) : 'rgba(10,30,80,0.55)'; c.fill();
    u.row([ic ? { icon: ic, size: 18 } : { gem: true, size: 16 }, label], x + tw / tabs.length / 2, tabsY + tabH / 2, { size: sh ? 15 : 16, maxW: tw / tabs.length - 10 });
    u.hit(x, tabsY, tw / tabs.length, tabH, { id: 'stab' + id, onTap: tap(() => { shopTab = id; u.request(0.5); }) });
  });
  if (shopTab === 'gems') return drawShopGems(u, tabsY + tabH + GAP);
  const cur = vehicleById(shopSel), own = owns(cur.id), ups = save.upgrades?.[cur.id] || {};
  const ny = tabsY + tabH + (sh ? 22 : 30);
  u.text(cur.name, u.w / 2, ny, sh ? 24 : 30);
  // price (or owned) right under the name, so prices show while swiping through the trucks
  const list0 = shopList(), idx0 = list0.findIndex((v) => v.id === cur.id);
  u.row(own ? [{ icon: 'check', size: 16, color: '#7aff8a' }, `Owned · ${idx0 + 1}/${list0.length}`] : [{ gem: true, size: 16 }, String(cur.price), `· ${idx0 + 1}/${list0.length}`], u.w / 2, ny + (sh ? 22 : 26), { size: sh ? 14 : 16, color: own ? '#c8ffd0' : GOLD });
  u.text(cur.desc, u.w / 2, ny + (sh ? 40 : 48), sh ? 12 : 14, '#fff', { maxW: u.w - 30 });
  // stats
  const pct = (val, up) => Math.max(0.06, Math.min(1, (val - up.lo) / (up.hi - up.lo)));
  const upgraded = withUpgrades(cur, ups);
  const sw = Math.min(u.w - 30, own ? 340 : 380), sx = u.w / 2 - sw / 2, sy = ny + (sh ? 58 : 68);
  UPGRADES.forEach((up, i) => {
    const lvl = ups[up.id] || 0, baseP = pct(cur[up.key] || 0, up), upP = pct(upgraded[up.key] || 0, up);
    const cols = own ? 1 : 2, colW = (sw - (cols - 1) * 14) / cols;
    const x = sx + (own ? 0 : (i % 2) * (colW + 14)), y = sy + (own ? i * (sh ? 23 : 27) : Math.floor(i / 2) * 22);
    u.text(up.name, x, y + 8, 13, '#fff', { align: 'left', maxW: 58 });
    const bx = x + 62, bw = colW - 62 - (own ? 66 : 0), bh = 14;
    u.rr(bx, y + 1, bw, bh, 7); c.fillStyle = '#0b3e8a'; c.fill();
    c.save(); u.rr(bx, y + 1, bw, bh, 7); c.clip();
    c.fillStyle = u.grad(y, y + bh, ['#ffd84a', '#ff9a14']); c.fillRect(bx, y + 1, bw * baseP, bh);
    c.fillStyle = u.grad(y, y + bh, ['#7aff8a', '#2fc85a']); c.fillRect(bx + bw * baseP, y + 1, bw * (upP - baseP), bh);
    for (let k = 0; k < MAX_UPGRADE; k++) { c.fillStyle = k < lvl ? '#fff' : 'rgba(255,255,255,0.25)'; c.fillRect(bx + bw - 6 - (MAX_UPGRADE - 1 - k) * 8, y + 3, 6, bh - 4); }
    c.restore();
    u.rr(bx, y + 1, bw, bh, 7); c.lineWidth = 2; c.strokeStyle = INK; c.stroke();
    if (own) {
      const ux = bx + bw + 8;
      if (lvl >= MAX_UPGRADE) u.text('MAX', ux + 28, y + 9, 13, GOLD);
      else {
        const cost = upgradeCost(cur, lvl);
        u.button('up' + up.id, ux, y - 2, 58, 22, { color: canAfford(cost) ? 'green' : 'gray', label: `▲ ${cost}`, size: 12, radius: 8, ring: false, onTap: () => doUpgrade(cur.id, up.id) });
      }
    }
  });
  // swipe arrows (below the stats so they never cover an upgrade button)
  const ay = Math.max(u.h * 0.42, sy + (own ? UPGRADES.length * (sh ? 23 : 27) : Math.ceil(UPGRADES.length / 2) * 22) + 12);
  for (const [d, x] of [[-1, 6], [1, u.w - 6 - 30]]) {
    const ok = idx0 + d >= 0 && idx0 + d < list0.length; if (!ok) continue;
    u.icon(d < 0 ? 'left' : 'right', x, ay, 30, 'rgba(255,255,255,0.85)');
    u.hit(x - 6, ay - 10, 42, 50, { id: 'sw' + d, onTap: tap(() => shopStep(d)) });
  }
  // truck cards
  const bh0 = sh ? 46 : 52, btnY = navTop(u) - 2 * GAP - bh0, cardH = sh ? 96 : 112, cardW = sh ? 110 : 128, cy = btnY - 2 * GAP - cardH;
  const list = shopList();
  const selIdx = list.findIndex((v) => v.id === cur.id);
  let made = false;
  u.scroll('cards', 0, cy - 8, u.w, cardH + 16, list.length * (cardW + GAP) + PAD * 2 - GAP, () => {
    list.forEach((v, i) => {
      const x = PAD + i * (cardW + GAP), y = cy, o = owns(v.id), on = save.car === v.id, sel = v.id === cur.id;
      const dy = sel ? -4 : 0;
      u.rr(x - 3, y - 3 + dy, cardW + 6, cardH + 6, 18); c.fillStyle = sel ? GOLD : 'rgba(255,255,255,0.6)'; c.fill();
      u.rr(x, y + dy, cardW, cardH, 16); c.fillStyle = u.grad(y, y + cardH, GRAD.blue); c.fill(); c.lineWidth = 3; c.strokeStyle = INK; c.stroke();
      if (!thumbs[v.id] && !made) { thumbs[v.id] = R.thumbnail(v, 240, 150); made = true; }
      if (thumbs[v.id]) c.drawImage(thumbs[v.id], x + 2, y + dy + 2, cardW - 4, (cardW - 4) * 150 / 240);
      u.text(v.name, x + cardW / 2, y + dy + cardH - 16, sh ? 12 : 14, '#fff', { maxW: cardW - 8 });
      if (on) { c.beginPath(); c.arc(x + cardW - 16, y + dy + 16, 13, 0, Math.PI * 2); c.fillStyle = '#46d35c'; c.fill(); c.lineWidth = 2; c.strokeStyle = INK; c.stroke(); u.icon('check', x + cardW - 27, y + dy + 5, 22, '#fff', false); }
      else if (!o) { const tw = u.measure(String(v.price), 12) + 13 + 5 + 14; u.rr(x + cardW - tw - 4, y + dy + 4, tw, 22, 10); c.fillStyle = 'rgba(10,30,80,0.75)'; c.fill(); u.row([{ gem: true, size: 13 }, String(v.price)], x + cardW - 4 - tw / 2, y + dy + 15, { size: 12, gap: 5 }); }
      const lv = Object.values(save.upgrades?.[v.id] || {}).reduce((a, b) => a + b, 0);
      if (o && lv) { u.rr(x + 4, y + dy + 4, 34, 22, 10); c.fillStyle = '#2fae4a'; c.fill(); u.text(`+${lv}`, x + 21, y + dy + 16, 12); }
      u.hit(x, y, cardW, cardH, { id: 'card' + v.id, onTap: tap(() => { shopSel = v.id; R.showGarage(v); u.request(); }) });
    });
  }, { horizontal: true, start: selIdx * (cardW + GAP) - u.w / 2 + cardW / 2 + PAD });
  // buy / use
  const bw = 210, bx = u.w / 2 - bw / 2, bh = bh0;
  if (save.car === cur.id) u.button('sel', bx, btnY, bw, bh, { color: 'gray', label: 'Selected', disabled: true });
  else if (own) u.button('use', bx, btnY, bw, bh, { color: 'blue', label: 'Use truck', onTap: tap(() => { save.car = cur.id; persist(); u.request(); }) });
  else {
    // not owned: try it for one level with a video, or buy it
    const tw = 116, bw2 = Math.min(200, u.w - PAD * 2 - tw - GAP), x0 = u.w / 2 - (tw + GAP + bw2) / 2;
    if (HSGame.has('ads') && HSGame.canShowAd('try_truck'))
      u.button('try', x0, btnY, tw, bh, { color: 'purple', parts: [{ icon: 'video', size: 22 }, 'Try'], size: 20, onTap: tap(() => { if (adBusy) return; adGo(HSGame.showAd('try_truck'), () => {
        trialCar = cur.id; Audio.win(); showLevels(save.world); ui.toast(`${cur.name}: free for your next level!`, '#b47aff');
      }); }) });
    u.button('buy', x0 + tw + GAP, btnY, bw2, bh, { color: canAfford(cur.price) ? 'orange' : 'gray', parts: ['Buy', { gem: true, size: 22 }, String(cur.price)], onTap: () => doBuy(cur.id) });
  }
  navbar(u, 'shop');
  return made || u.st < 0.8;
}
// Gems tab: free videos (+gems, 2x booster) and the gem packs HSGame sells (products set in the HS dashboard).
let shopProducts = null, buying = false;
function loadProducts() { HSGame.shop().then((list) => { shopProducts = list || []; ui.request(0.5); }, () => { shopProducts = []; }); }
function drawShopGems(u, top) {
  const c = u.ctx, sh = short(), pw = Math.min(u.w - PAD * 2, 440), px = u.w / 2 - pw / 2;
  c.fillStyle = 'rgba(10,40,120,0.45)'; c.fillRect(0, top - 6, u.w, u.h);
  const fbw = (pw - GAP) / 2, fh = sh ? 50 : 56, fl = freeVidsLeft();
  let listTop = top + 4;
  if (HSGame.has('ads')) {
    if (HSGame.canShowAd('free_gems')) u.button('gfree', px, top + 4, fbw, fh, { color: fl > 0 ? 'green' : 'gray', parts: [{ icon: 'video', size: 22 }, `+${freeGemsAmount()}`, { gem: true, size: 18 }], sub: `${fl}/${REWARDS.freeGemsPerDay} today`, size: 18, onTap: tap(() => { if (!adBusy) freeGemsVideo(); }) });
    if (gemBoostLeft() > 0) { u.rr(px + fbw + GAP, top + 4, fbw, fh, 14); c.fillStyle = 'rgba(30,140,60,0.8)'; c.fill(); u.row([{ gem: true, size: 18 }, `2x ${mmss(gemBoostLeft())}`], px + fbw + GAP + fbw / 2, top + 4 + fh / 2, { size: 18 }); u.request(1); }
    else if (HSGame.canShowAd('gem_boost')) u.button('gboost2', px + fbw + GAP, top + 4, fbw, fh, { color: 'green', parts: [{ icon: 'video', size: 22 }, '2x', { gem: true, size: 18 }], sub: `${boostMinutes()} min`, size: 18, onTap: tap(() => { if (!adBusy) startGemBoost(); }) });
    listTop += fh + 10;
  }
  if (!HSGame.has('shop')) { u.text('Gem packs are coming soon.', u.w / 2, listTop + 30, 15, '#fff', { maxW: pw }); navbar(u, 'shop'); return u.st < 0.6; }
  if (!shopProducts) { loadProducts(); shopProducts = []; }
  const list = shopProducts.filter((p) => !(p.product_id === STARTER_ID && profile.get('starter')));
  const rh = sh ? 56 : 62, listY = listTop, listH = navTop(u) - 2 * GAP - listY;
  u.scroll('gemPacks', px - 4, listY, pw + 8, listH, list.length * (rh + 8) + 8, () => {
    list.forEach((p, i) => {
      const y = listY + 4 + i * (rh + 8), starter = p.product_id === STARTER_ID, gems = p.items?.gems || 0;
      u.rr(px, y, pw, rh, 14); c.fillStyle = u.grad(y, y + rh, starter ? GRAD.purple : GRAD.panel); c.fill(); c.lineWidth = 3; c.strokeStyle = INK; c.stroke();
      for (let k = 0; k < Math.min(4, 1 + Math.floor(Math.log10(Math.max(1, gems / 500)) * 2)); k++) u.gem(px + 28 + k * 9, y + rh / 2 - k * 3 + 4, 26);
      u.text(starter ? p.name : gems.toLocaleString('en-US'), px + 82, y + rh / 2 + (starter ? -8 : 0), sh ? 18 : 20, starter ? GOLD : '#fff', { align: 'left', maxW: pw - 200 });
      if (starter) u.row([{ gem: true, size: 14 }, gems.toLocaleString('en-US')], px + 82 + 40, y + rh / 2 + 14, { size: 14 });
      if (p.badge && !starter) { const tw = u.measure(p.badge, 11) + 14; u.rr(px + 82, y + 4, tw, 16, 8); c.fillStyle = '#ff3d57'; c.fill(); u.text(p.badge, px + 82 + tw / 2, y + 12, 11, '#fff', { outline: false }); }
      const label = p.price || (p.beans_cost + ' Beans');   // the store's own price text
      u.button('gp' + p.product_id, px + pw - 10 - 104, y + (rh - 40) / 2, 104, 40, { color: 'orange', label, size: 15, radius: 10, ring: false, onTap: tap(() => {
        if (buying) return; buying = true;
        HSGame.buy(p.product_id).then((r) => {
          buying = false;
          if (r && r.ok) { Audio.win(); ui.confetti(30); if (!r.delivered) ui.toast('Paid: your gems arrive at the next start', '#46d35c'); }
          else if (r && r.error) ui.toast(String(r.error), '#ff8a1f');
        }, () => { buying = false; });
      }) });
    });
  });
  navbar(u, 'shop');
  return u.st < 0.6;
}

function shakeGems() { Audio.crash(); ui.toast('Not enough gems', '#ff5a6e'); }
function doBuy(id) {
  const v = vehicleById(id);
  if (!canAfford(v.price)) return shakeGems();
  spend(v.price); save.owned.push(id); save.car = id; persist(); Audio.win(); ui.confetti(30); ui.request();
}
function doUpgrade(id, u) {
  const v = vehicleById(id); save.upgrades ||= {}; const ups = save.upgrades[id] ||= {};
  const lvl = ups[u] || 0; if (lvl >= MAX_UPGRADE) return;
  const cost = upgradeCost(v, lvl);
  if (!canAfford(cost)) return shakeGems();
  spend(cost); ups[u] = lvl + 1; persist(); Audio.star(lvl); ui.request();
}

// ------------------------------------------------------------ settings (draft: Save applies, Cancel discards)
const AUTO_KINDS = [['noob', 'Noob'], ['avg', 'Normal'], ['pro', 'Pro']];
// how the autoplay bot drives: badly (full throttle, no air control, never backs up), like an average player, or well
function kindPicker(u, x, y, w, h) {
  const c = u.ctx, bw = (w - 12) / 3;
  AUTO_KINDS.forEach(([k, label], i) => {
    const on = (save.autoKind || 'pro') === k, bx = x + i * (bw + 6);
    u.rr(bx, y, bw, h, 12); c.fillStyle = on ? u.grad(y, y + h, GRAD.gold) : 'rgba(0,0,0,0.25)'; c.fill(); c.lineWidth = 3; c.strokeStyle = INK; c.stroke();
    u.text(label, bx + bw / 2, y + h / 2 + 1, 15, on ? '#5a3000' : '#fff', { outline: !on });
    u.hit(bx, y, bw, h, { id: 'ak' + k, onTap: tap(() => { save.autoKind = k; persist(); u.request(); }) });
  });
}
const SETTING_KEYS = ['sound', 'shadows', 'autoplay', 'allRes'];
let setDraft = null, resetArmed = false;
function showSettings() {
  game = null; Audio.engineStop();
  if (R.mode !== 'menu') R.showDiorama(WORLDS[save.world], vehicleById(save.car));
  setDraft = Object.fromEntries(SETTING_KEYS.map((k) => [k, !!save[k]])); resetArmed = false;
  ui.show('settings', drawSettings);
}
const settingsDirty = () => SETTING_KEYS.some((k) => setDraft[k] !== !!save[k]);
let devTaps = 0, devTapT = -9;
function drawSettings(u) {
  const c = u.ctx, T = u.safeTop, B = u.safeBottom, sh = short();
  topbar(u);
  // panel: one GAP under the top pills (+ ribbon), 2 GAP above the nav bar
  const pw = Math.min(u.w - PAD * 2, 400), px = u.w / 2 - pw / 2, py = topY(u) + pillH() + GAP + 22, ph = navTop(u) - 2 * GAP - py;
  u.panel(px, py, pw, ph, { ribbon: 'Settings' });
  const footH = sh ? 56 : 64, bodyY = py + 36, bodyH = ph - 36 - footH - 8;
  const rowH = sh ? 44 : 52;
  const rows = [['sound', 'sound', 'Sound'], ['shadows', 'settings', 'Shadows (quality)'], ...(dev() ? [null, ['autoplay', 'play', 'Autoplay (bot drives)'], 'kind', ['allRes', 'gem', 'All resources (dev)']] : [])];
  const size = rows.length * (rowH + 6) + 200;
  u.scroll('set', px + 10, bodyY, pw - 20, bodyH, size, () => {
    let y = bodyY + 4;
    for (const r of rows) {
      if (!r) { u.text('DEV TEST', px + 22, y + 14, 13, 'rgba(255,255,255,0.8)', { align: 'left', outline: false }); y += 28; continue; }
      if (r === 'kind') { u.text('Autoplay driver', px + 22, y + 12, 13, 'rgba(255,255,255,0.8)', { align: 'left', outline: false }); kindPicker(u, px + 16, y + 26, pw - 32, 40); y += 74; continue; }
      const [k, ic, label] = r, on = setDraft[k];
      u.rr(px + 16, y, pw - 32, rowH, 14); c.fillStyle = 'rgba(0,0,0,0.18)'; c.fill();
      u.icon(ic, px + 28, y + rowH / 2 - 13, 26, k === 'allRes' ? GOLD : '#fff');
      u.text(label, px + 66, y + rowH / 2 + 1, sh ? 16 : 18, '#fff', { align: 'left', maxW: pw - 170 });
      const tx = px + pw - 32 - 56, ty = y + rowH / 2 - 15;
      u.rr(tx, ty, 54, 30, 15); c.fillStyle = on ? '#46d35c' : '#8e97b0'; c.fill(); c.lineWidth = 3; c.strokeStyle = INK; c.stroke();
      c.beginPath(); c.arc(on ? tx + 39 : tx + 15, ty + 15, 10, 0, Math.PI * 2); c.fillStyle = '#fff'; c.fill();
      u.hit(px + 16, y, pw - 32, rowH, { id: 'tg' + k, onTap: tap(() => { setDraft[k] = !setDraft[k]; u.request(); }) });
      y += rowH + 6;
    }
    u.button('reset', px + 22, y + 8, pw - 44, 44, { color: resetArmed ? 'red' : 'gray', label: resetArmed ? 'Tap again to erase everything' : 'Reset progress', size: resetArmed ? 15 : 18, onTap: tap(() => {
      if (!resetArmed) { resetArmed = true; u.request(); return; }
      save = makeSave({ tt: save.tt }); profile.update({ gems: 0, trophies: 0 }); persist(); gemShown = 0; gemAnimT = -1; showWorlds(); ui.toast('Progress erased', '#ff5a6e');
    }) });
    y += 64;
    u.text('Controls: ◀ ▶ on screen, or Arrow keys / A D.', u.w / 2, y + 8, 12, '#fff', { maxW: pw - 40 });
    u.text('In the air, ▶ tilts back and ◀ tilts forward.', u.w / 2, y + 26, 12, '#fff', { maxW: pw - 40 });
    u.text(`Levels cleared: ${totalDone()}/${WORLDS.slice(0, OPEN_WORLDS).reduce((a, w) => a + w.levels.length, 0)} · Race tracks: ${RACE_TRACKS.length}`, u.w / 2, y + 44, 12, '#fff', { maxW: pw - 40 });
    u.text(`Crane Rush v${VERSION} · quality ${R.quality} · ${P.kind}${dev() ? ' · DEV' : ''}`, u.w / 2, y + 62, 11, 'rgba(255,255,255,0.7)', { outline: false });
    u.hit(px + 16, y + 50, pw - 32, 26, { id: 'devtap', onTap: () => {
      devTaps = u.t - devTapT < 1.5 ? devTaps + 1 : 1; devTapT = u.t;
      if (devTaps < 5) return;
      devTaps = 0; save.dev = !save.dev;
      if (!dev()) { save.autoplay = save.allRes = save.infinite = save.unlockAll = false; for (const k of ['autoplay', 'allRes']) setDraft[k] = false; }
      persist(); u.toast(save.dev ? 'Developer tools on' : 'Developer tools off', '#ff8a1f'); u.request();
    } });
  });
  const fy = py + ph - footH, bw = (pw - 52) / 2;
  c.fillStyle = 'rgba(255,255,255,0.18)'; c.fillRect(px + 16, fy - 4, pw - 32, 2);
  u.button('cancel', px + 18, fy + 6, bw, footH - 20, { color: 'gray', label: 'Cancel', onTap: tap(() => { setDraft = null; showWorlds(); ui.toast('Changes discarded', '#8e97b0'); }) });
  const dirty = settingsDirty();
  u.button('save', px + 34 + bw, fy + 6, bw, footH - 20, { color: 'blue', label: 'Save', disabled: !dirty, onTap: tap(() => {
    for (const k of SETTING_KEYS) save[k] = setDraft[k];
    save.infinite = save.unlockAll = !!save.allRes;
    if (!save.allRes && !save.owned.includes(save.car)) save.car = 'crane';   // back to trucks you really own
    Audio.setEnabled(save.sound); R.setShadows(save.shadows); persist(); showWorlds(); ui.toast('Settings saved');
  }) });
  navbar(u, 'settings');
  return false;
}

// ------------------------------------------------------------ pause
function pauseMenu() {
  if (!game || game.over || game.paused) return;
  game.paused = true; Audio.engineStop(); touchL = touchR = false; drivePtrs.clear(); keys.left = keys.right = false;
  const l = game.level;
  ui.overlay((u, age) => {
    const items = [['resume', 'Resume', 'play', 'blue'], ['retry', 'Retry', 'retry', 'gray'], ...(game.race ? [] : [['levels', 'Levels', 'levels', 'gray']]), ['home', 'Home', 'home', 'gray']];
    const pw = Math.min(u.w * 0.86, 340), ph = 60 + items.length * 66, px = u.w / 2 - pw / 2, py = u.h / 2 - ph / 2;
    u.panel(px, py, pw, ph, { ribbon: 'Paused', scale: u.pop(0, 0.3, age) });
    items.forEach(([id, label, ic, col], i) => u.button('p' + id, px + 22, py + 44 + i * 66, pw - 44, 52, { color: col, label, icon: ic, onTap: tap(() => {
      u.closeOverlay();
      if (id === 'resume') { game.paused = false; Audio.engineStart(); showHud(); }
      else if (id === 'retry') startLevel(l, game.race ? { ...game.race } : null);
      else if (id === 'levels') showLevels(l.world);
      else if (game.race) showRace(); else showWorlds();
    }) }));
    return age < 0.4;
  });
}

// ------------------------------------------------------------ test mode (bot drives, nothing saved)
function testMenu() {
  const w = WORLDS[save.world];
  ui.overlay((u, age) => {
    const opts = [['hard', `Hard levels of ${w.name} (4–${w.levels.length})`, 'purple'], ['hardall', 'Hard levels: 20 random (level 4+)', 'purple'], ['tour', `Tour: level 1 of all ${OPEN_WORLDS} worlds`, 'blue'], ['random', '20 random levels (any world)', 'blue'], ['world', `All ${w.levels.length} levels of ${w.name}`, 'blue'], ['races', '10 random races (3–6 lanes)', 'orange'], ['close', 'Close', 'gray']];
    const rowH = Math.min(62, (u.h - 260) / opts.length), pw = Math.min(u.w * 0.9, 380), ph = 150 + opts.length * rowH, px = u.w / 2 - pw / 2, py = u.h / 2 - ph / 2;
    u.panel(px, py, pw, ph, { ribbon: 'Test mode', ribbonColor: '#46d35c', scale: u.pop(0, 0.3, age) });
    u.text('The bot drives like a… (results are not saved)', u.w / 2, py + 44, 14, '#fff', { maxW: pw - 20 });
    kindPicker(u, px + 20, py + 62, pw - 40, 40);
    opts.forEach(([id, label, col], i) => u.button('t' + id, px + 20, py + 124 + i * rowH, pw - 40, rowH - 12, { color: col, label, size: 15, onTap: tap(() => { u.closeOverlay(); if (id !== 'close') startTest(id); }) }));
    return true;
  });
}
function startTest(mode) {
  const pickLevel = () => { const w = WORLDS[(Math.random() * OPEN_WORLDS) | 0]; return { level: w.levels[(Math.random() * w.levels.length) | 0] }; };
  let queue;
  if (mode === 'hard') queue = WORLDS[save.world].levels.slice(3).map((level) => ({ level }));
  else if (mode === 'hardall') queue = Array.from({ length: 20 }, () => { const w = WORLDS[(Math.random() * OPEN_WORLDS) | 0]; return { level: w.levels[3 + ((Math.random() * (w.levels.length - 3)) | 0)] }; });
  else if (mode === 'tour') queue = WORLDS.slice(0, OPEN_WORLDS).map((w) => ({ level: w.levels[0] }));
  else if (mode === 'random') queue = Array.from({ length: 20 }, pickLevel);
  else if (mode === 'world') queue = WORLDS[save.world].levels.map((level) => ({ level }));
  else queue = Array.from({ length: 10 }, () => ({ level: RACE_TRACKS[(Math.random() * RACE_TRACKS.length) | 0], lanes: 3 + ((Math.random() * 4) | 0) }));
  testRun = { mode, queue, i: -1, pass: 0, fails: [], times: [], kind: save.autoKind || 'pro' };
  testNext();
}
function testNext() {
  if (!testRun) return;
  testRun.i++;
  if (testRun.i >= testRun.queue.length) { endTest(false); return; }
  const item = testRun.queue[testRun.i];
  if (item.lanes) {
    const prev = save.lanes; save.lanes = item.lanes;
    const rivals = Array.from({ length: item.lanes - 1 }, (_, i) => ({ ...RIVALS[i % RIVALS.length], skill: 0.7 + Math.random() * 0.3 }));
    startLevel(item.level, { cup: { name: 'Test', reward: 0, color: '#46d35c' }, idx: 0, rivals, random: true });
    save.lanes = prev;
  } else startLevel(item.level);
}
function testResult(ok, info) {
  const item = testRun.queue[testRun.i], l = item.level;
  const label = l.race ? `Race · ${l.name} (${item.lanes} lanes)` : `${WORLDS[l.world].name} ${l.index + 1}. ${l.name}`;
  if (ok) { testRun.pass++; testRun.times.push(`${label}: ${info}`); } else testRun.fails.push(`${label}: ${info}`);
  Audio.engineStop();
  setTimeout(testNext, 500);
}
function endTest(stopped) {
  const t = testRun; if (!t) return;
  testRun = null; game = null; Audio.engineStop();
  R.showDiorama(WORLDS[save.world], vehicleById(save.car));
  const lines = [...(t.fails.length ? t.fails.map((f) => ['✗ ' + f, '#ffb8c2']) : [['Every run reached the finish.', '#b8ffc0']]), ...t.times.map((f) => ['✓ ' + f, '#b8ffc0'])];
  ui.show('testsum', (u) => {
    const T = u.safeTop, B = u.safeBottom, c = u.ctx, barH = short() ? 72 : 82;
    c.fillStyle = 'rgba(10,60,170,0.35)'; c.fillRect(0, 0, u.w, u.h);
    const pw = Math.min(u.w * 0.92, 420), px = u.w / 2 - pw / 2, py = T + 50, ph = u.h - B - barH - 50 - py;
    u.panel(px, py, pw, ph, { ribbon: `Test ${stopped ? 'stopped' : 'finished'} · ${(AUTO_KINDS.find((k) => k[0] === t.kind) || AUTO_KINDS[2])[1]}`, ribbonColor: t.fails.length ? 'red' : '#46d35c' });
    [['Run', `${t.pass + t.fails.length} / ${t.queue.length}`], ['Passed', t.pass], ['Failed', t.fails.length]].forEach(([a, b], i) => {
      u.text(a, px + 24, py + 50 + i * 34, 19, '#fff', { align: 'left' }); u.text(String(b), px + pw - 24, py + 50 + i * 34, 19, '#fff', { align: 'right' });
    });
    u.scroll('log', px + 14, py + 156, pw - 28, ph - 170, lines.length * 22 + 10, () => {
      lines.forEach(([txt, col], i) => u.text(txt, px + 20, py + 168 + i * 22, 13, col, { align: 'left', outline: false, maxW: pw - 44 }));
    });
    barButtons(u, [{ id: 'home', label: 'Home', icon: 'home', onTap: showWorlds }, { id: 'again', label: 'Run again', icon: 'retry', color: 'blue', big: true, onTap: () => startTest(t.mode) }], u.h - B - 24 - barH);
    return false;
  });
}

// ------------------------------------------------------------ input
const KL = ['ArrowLeft', 'KeyA'], KR = ['ArrowRight', 'KeyD'];
P.onKey((code) => {
  Audio.unlock();
  if (KL.includes(code)) keys.left = true;
  if (KR.includes(code)) keys.right = true;
  if (game && !game.paused && !game.over) {
    if (code === 'KeyR') startLevel(game.level, game.race ? { ...game.race } : null);
    if (code === 'Escape' || code === 'KeyP') pauseMenu();
  }
}, (code) => { if (KL.includes(code)) keys.left = false; if (KR.includes(code)) keys.right = false; });
P.onTouch({ start: (p) => ui.pointerDown(p), move: (p) => ui.pointerMove(p), end: (p) => ui.pointerUp(p) });
P.onHide(() => { keys.left = keys.right = touchL = touchR = false; drivePtrs.clear(); ui.releaseAll(); if (game && !game.over && !game.paused && !testRun) pauseMenu(); Audio.engineStop(); });
// HSGame: an ad, a purchase or the app going away pauses everything; a reward toast; the account opened elsewhere
let hsPaused = false, hsStarted = false;
HSGame.on('pause', () => { Audio.setEnabled(false); Audio.engineStop(); keys.left = keys.right = touchL = touchR = false; drivePtrs.clear(); ui.releaseAll(); if (game && !game.over && !game.paused) { game.paused = true; hsPaused = true; } });
HSGame.on('resume', () => { Audio.setEnabled(save.sound); if (hsPaused && game) { game.paused = false; if (!game.over && game.countdown <= 0) Audio.engineStart(); } hsPaused = false; });
HSGame.on('given', (items, from) => {
  if (String(from).startsWith('product:') && Number(String(from).slice(8)) === STARTER_ID) profile.set('starter', 1);
  if (items.gems) { animateGems(items.gems, { x: ui.w / 2, y: ui.h / 2 }); ui.toast(`+${items.gems} gems`, '#46d35c'); }
});
HSGame.on('otherDevice', () => {
  ui.overlay((u, age) => {
    const pw = Math.min(u.w - PAD * 2, 340), ph = 200, px = u.w / 2 - pw / 2, py = u.h / 2 - ph / 2;
    u.panel(px, py, pw, ph, { ribbon: 'Another device', ribbonColor: 'purple', scale: u.pop(0, 0.3, age) });
    u.text('Your account is playing on another device.', u.w / 2, py + 60, 15, '#fff', { maxW: pw - 30 });
    u.button('playhere', px + PAD, py + ph - PAD - 52, pw - PAD * 2, 52, { color: 'green', label: 'Play here', size: 20, onTap: tap(() => { u.closeOverlay(); HSGame.takeOver(); }) });
    return age < 0.4;
  });
});

// ------------------------------------------------------------ loading screen + main loop
import LOADING_ART from '../assets/loading.jpg';
let loading = { p: 0, shown: 0, art: null, pic: null };
P.loadImage(LOADING_ART, 'loading.jpg').then((img) => { loading.pic = img; ui.request(0.5); });
function drawLoading(u) {
  const c = u.ctx, g = c.createLinearGradient(0, 0, 0, u.h);
  g.addColorStop(0, '#2fb6ff'); g.addColorStop(1, '#bff0ff'); c.fillStyle = g; c.fillRect(0, 0, u.w, u.h);
  if (loading.pic) {
    // the loading picture fills the screen (cover), the crane truck flying over the crates
    const iw = loading.pic.width, ih = loading.pic.height, sc = Math.max(u.w / iw, u.h / ih), dw = iw * sc, dh = ih * sc;
    c.drawImage(loading.pic, (u.w - dw) / 2, (u.h - dh) / 2 + Math.sin(u.t * 1.5) * 3, dw, dh);
    const sh = c.createLinearGradient(0, u.h * 0.62, 0, u.h); sh.addColorStop(0, 'rgba(10,40,110,0)'); sh.addColorStop(1, 'rgba(10,40,110,0.65)'); c.fillStyle = sh; c.fillRect(0, u.h * 0.62, u.w, u.h * 0.38);
  }
  // sun rays (until the picture is in)
  c.save(); c.translate(u.w / 2, u.h * 0.42); c.rotate(u.t * 0.15);
  for (let i = 0; i < (loading.pic ? 0 : 12); i++) { c.rotate(Math.PI / 6); c.beginPath(); c.moveTo(0, 0); c.lineTo(-40, -u.h); c.lineTo(40, -u.h); c.closePath(); c.fillStyle = 'rgba(255,255,255,0.12)'; c.fill(); }
  c.restore();
  const k = u.pop(0, 0.6);
  if (!loading.pic) { c.save(); c.translate(u.w / 2, u.h * 0.2); c.rotate(-0.05); c.scale(k, k); u.text('CRANE', 0, -26, 52); u.text('RUSH', 0, 30, 66, GOLD); c.restore(); }   // the picture has the title in it
  if (loading.art && !loading.pic) {
    const aw = Math.min(u.w * 0.86, 420), ah = aw * loading.art.height / loading.art.width, bob = Math.sin(u.t * 4) * 4;
    c.drawImage(loading.art, u.w / 2 - aw / 2, u.h * 0.44 - ah / 2 + bob, aw, ah);
  }
  loading.shown += (loading.p - loading.shown) * 0.2;
  const bw = Math.min(u.w * 0.7, 320), by = u.h * 0.8;
  u.bar(u.w / 2 - bw / 2, by, bw, 26, loading.shown, { fill: GRAD.gold });
  u.text(`${Math.round(loading.shown * 100)}%`, u.w / 2, by + 14, 16);
  const tips = ['Hold in front of the truck to drive, behind it to reverse', 'In the air, ▶ tilts back and ◀ tilts forward', 'Land on your wheels, not your roof!', 'Collect every gem for an extra star'];
  u.text(tips[Math.floor(u.t / 2.5) % tips.length], u.w / 2, by + 56, 15, '#fff', { maxW: u.w - 40 });
  return true;
}

let last = 0;
function loop(now) {
  const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016); last = now;
  if (!P.hidden) {
    if (!loadingDone) { ui.update(dt); } else {
      tick(dt);
      R.alpha = game && !game.paused && game.countdown <= 0 ? Math.min(1, game.acc / DT) : 1;
      if (ui.update(dt)) R.overlayChanged();
      R.update(dt, game?.sim, throttleInput());
    }
    if (!loadingDone && P.isTT) { R.overlayChanged(); R.r.clear(); R.drawOverlay(); }
  }
  requestAnimationFrame(loop);
}

let loadingDone = false;
const step = (p) => new Promise((res) => { loading.p = p; setTimeout(res, 30); });
async function boot() {
  ui.show('loading', drawLoading);
  requestAnimationFrame(loop);
  await step(0.1);
  const font = await P.loadFont(); ui.font = font; setLabelFont(font);
  await step(0.3);
  loading.art = R.thumbnail(vehicleById(save.car), 420, 270);
  await step(0.55);
  R.showDiorama(WORLDS[save.world], vehicleById(save.car));
  R.r.compile(R.scene, R.camera);
  await step(0.8);
  // HSGame: login (silent), cloud progress, dashboard rewards and ads. The game plays offline if this fails.
  HSGame.start({ gameId: HS_GAME_ID, sdkKey: HS_SDK_KEY, defaults: DEFAULTS, onGive }).then(() => { hsStarted = true; if (ui.screen?.name === 'home') dailyGift(); });
  await step(1);
  await new Promise((r) => setTimeout(r, 250));
  loadingDone = true;
  showWorlds();
  setTimeout(dailyGift, 600);   // once a day: streak gift, x2 with a video (after HSGame.start)
}
boot();

// debug / automated test hooks
globalThis.__crane = {
  get game() { return game; }, get testRun() { return testRun; }, save: () => save, ui, R, P, worlds: WORLDS,
  startLevel: (w, l) => startLevel(WORLDS[w].levels[l]), startTest, keys,
  actions: { testMenu: () => testMenu(), test: ({ mode }) => startTest(mode), champion: () => { R.showDiorama(WORLDS[0], vehicleById(save.car), 2.6); championParty(CUPS[0], showRace); }, daily: () => { save.daily = null; dailyGift(); }, board: () => showBoard(), standings: () => cupStandings(), tab: ({ tab }) => tabs2[tab](), race: startRace, randomRace: startRandomRace, levels: ({ w }) => showLevels(+w), shopSel: ({ id }) => showShop(id), use: ({ id }) => { save.car = id; persist(); } },
  stats: () => ({ calls: R.r.info.render.calls, tris: R.r.info.render.triangles, geos: R.r.info.memory.geometries, tex: R.r.info.memory.textures, pr: R.r.getPixelRatio() }),
  views: (id) => R.views(vehicleById(id || 'crane')), icon: (n) => { const c = R.thumbnail(VEHICLES[0], n, n); return c.toDataURL ? c.toDataURL() : ''; },
  tapAt: (x, y) => { ui.pointerDown({ id: 99, x, y }); ui.pointerUp({ id: 99, x, y }); },
};
