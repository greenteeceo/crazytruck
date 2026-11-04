// Crane Rush: game flow, screens (drawn on a canvas by ui/kit.js), input, ads and main loop.
import { DT } from './sim.js';
import { WORLDS, RACE_TRACKS } from './levels.js';
import { makeRacer, racerWatch, respawnAt, trackSafe } from './racer.js';
import { VEHICLES, vehicleById, UPGRADES, MAX_UPGRADE, upgradeCost, withUpgrades } from './vehicles.js';
import { makeBot } from './bot.js';
import { Renderer, setLabelFont } from './render.js';
import { Audio } from './audio.js';
import { P } from './platform/index.js';
import { AD_RULES, REWARDS } from './platform/config.js';
import { UI, INK, GOLD, GRAD } from './ui/kit.js';
import PARS from './pars.json';
import { board, rankOf, BOARD_SIZE } from './leaderboard.js';

// ------------------------------------------------------------ save
const KEY = 'cranerush.save.v2';
const defaults = { upgrades: {}, diamonds: 0, owned: ['crane'], car: 'crane', levels: {}, world: 0, cups: {}, cup: { idx: 0, race: 0, pts: null }, sound: true, shadows: true, trophies: 0, tt: {} };
let save;
try { save = { ...defaults, ...JSON.parse(P.load(KEY) || '{}') }; } catch { save = { ...defaults }; }
save.tt ||= {};
save.tut ||= {};   // tutorial steps already shown
// dev tools (AUTO, TEST, infinite gems, unlock all) are hidden in release; tap the version line in Settings 5 times
const VERSION = '3.2';
if (!save.dev) { save.autoplay = false; save.infinite = false; save.unlockAll = false; }
const dev = () => !!save.dev;
// leaderboard: per-device seed for the simulated players, and when this player joined
if (!save.lb) save.lb = { seed: (Math.random() * 2 ** 31) | 0, start: Date.now() };
const persist = () => P.save(KEY, JSON.stringify(save));

// ------------------------------------------------------------ canvases
const glCanvas = P.mainCanvas();
const uiCanvas = P.isTT ? P.createCanvas(2, 2) : document.getElementById('ui');
const R = new Renderer(glCanvas);
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
const starsNeeded = (w) => Math.max(0, (WORLDS[w].starsReq || 0) - totalStars());
let testRun = null;   // active automated test session (see startTest)
const worldUnlocked = (w) => save.unlockAll || !!testRun || w === 0 || (worldDone(w - 1) >= 5 && starsNeeded(w) === 0);
const levelUnlocked = (l) => save.unlockAll || l.index === 0 || lvlSave(WORLDS[l.world].levels[l.index - 1])?.time != null;
const par = (l) => Math.ceil((PARS[l.id] ?? 10) * 1.25 * 2) / 2;
const totalDone = () => WORLDS.reduce((a, _, i) => a + worldDone(i), 0);
const today = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };

// ------------------------------------------------------------ lives: a crash in a level costs one, they come back over time
// or all at once for a rewarded video. Races never cost lives (something to do while waiting).
const LIVES_MAX = 5, LIFE_MS = 8 * 60 * 1000;
if (!save.lives) save.lives = { n: LIVES_MAX, t: Date.now() };
const freeLives = () => save.infinite || save.autoplay || !!testRun;
function livesNow() {
  const L = save.lives, now = Date.now();
  if (L.n >= LIVES_MAX) { L.t = now; return L.n; }
  const k = Math.floor((now - L.t) / LIFE_MS);
  if (k > 0) { L.n = Math.min(LIVES_MAX, L.n + k); L.t = L.n >= LIVES_MAX ? now : L.t + k * LIFE_MS; persist(); }
  return L.n;
}
const nextLifeIn = () => { const ms = Math.max(0, LIFE_MS - (Date.now() - save.lives.t)); const s = Math.ceil(ms / 1000); return `${(s / 60) | 0}:${String(s % 60).padStart(2, '0')}`; };
function loseLife() { if (freeLives()) return; const n = livesNow(); if (n >= LIVES_MAX) save.lives.t = Date.now(); save.lives.n = Math.max(0, n - 1); persist(); }
function addLives(k) { livesNow(); save.lives.n = Math.min(LIVES_MAX, save.lives.n + k); if (save.lives.n >= LIVES_MAX) save.lives.t = Date.now(); persist(); }
function livesPill(u, x, y, h, right = false, compact = false) {
  const n = livesNow(), txt = n >= LIVES_MAX || freeLives() || compact ? (freeLives() ? '∞' : `${n}`) : `${n}  ${nextLifeIn()}`;
  const w = Math.max(64, u.measure(txt, h * 0.5) + h * 0.9 + 18), x0 = right ? x - w : x;
  u.pill(x0, y, h, { icon: 'heart', iconColor: '#ff4d6a', text: txt }, { minW: w });
  u.hit(x0, y, w, h, { id: 'lives', onTap: tap(() => { if (livesNow() < LIVES_MAX && !freeLives()) noLivesMenu(); }) });
  if (n < LIVES_MAX) u.request(1);
  return w;
}
// Out of lives (or tapping the heart counter): refill with a video, wait, or go race.
function noLivesMenu(retry) {
  ui.overlay((u, age) => {
    const n = livesNow();
    if (retry && n > 0) { u.closeOverlay(); retry(); return false; }
    const pw = Math.min(u.w - PAD * 2, 360), ph = 330, px = u.w / 2 - pw / 2, py = u.h / 2 - ph / 2;
    u.panel(px, py, pw, ph, { ribbon: n ? 'Lives' : 'Out of lives', ribbonColor: 'red', scale: u.pop(0, 0.3, age) });
    const hk = 1 + Math.sin(u.t * 4) * 0.06;
    for (let i = 0; i < LIVES_MAX; i++) { const hx = u.w / 2 + (i - 2) * 46; u.ctx.save(); u.ctx.translate(hx, py + 76); u.ctx.scale(hk, hk); u.icon('heart', -20, -20, 40, i < n ? '#ff4d6a' : 'rgba(255,255,255,0.25)'); u.ctx.restore(); }
    u.text(`Next life in ${nextLifeIn()}`, u.w / 2, py + 124, 18, '#fff', { maxW: pw - 30 });
    u.button('refill', px + PAD, py + 150, pw - PAD * 2, 56, { color: 'green', parts: [{ icon: 'video', size: 26 }, 'Refill', { icon: 'heart', size: 24, color: '#ff4d6a' }, `${LIVES_MAX}`], size: 22, onTap: tap(() => watchAd(() => { addLives(LIVES_MAX); u.closeOverlay(); Audio.win(); ui.toast('Lives refilled!'); if (retry) retry(); })) });
    u.button('lrace', px + PAD, py + 150 + 56 + GAP, pw - PAD * 2, 48, { color: 'orange', icon: 'flag', label: 'Race meanwhile (free)', size: 17, onTap: tap(() => { u.closeOverlay(); game = null; showRace(); }) });
    u.button('lclose', px + PAD, py + ph - PAD - 44, pw - PAD * 2, 44, { color: 'gray', label: 'Close', size: 18, onTap: tap(() => u.closeOverlay()) });
    u.request(1);
    return age < 0.4;
  });
}

// ------------------------------------------------------------ game session
let game = null;
let trialCar = null;
const keys = { left: false, right: false };
let touchL = false, touchR = false;
const throttleInput = () => { const r = keys.right || touchR, l = keys.left || touchL; return r && !l ? 1 : l && !r ? -1 : 0; };

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
  { name: 'Grass Cup', world: 0, races: [0, 1, 4], skill: [0.55, 0.62, 0.7, 0.78, 0.84], color: '#46d35c', reward: 1 },
  { name: 'Girder Cup', world: 1, races: [2, 5, 11], skill: [0.62, 0.7, 0.8, 0.88, 0.92], color: '#ff6a3c', reward: 1.5 },
  { name: 'Castle Cup', world: 2, races: [6, 7, 10], skill: [0.7, 0.8, 0.88, 0.95, 0.98], color: '#7f96ff', reward: 2 },
  { name: 'Lab Cup', world: 3, races: [3, 8, 9], skill: [0.8, 0.88, 0.95, 1.0, 1.0], color: '#2ee6c8', reward: 3 },
];
const PLACE_GEMS = [100, 60, 30, 15, 8, 4];
const LANE_W = 3.4;
const laneCount = () => Math.min(6, Math.max(3, save.lanes || 5));
const laneZ = (i) => ((laneCount() - 1) / 2 - i) * LANE_W;

function aiSpec(id) { const base = VEHICLES[0], v = vehicleById(id); return { ...base, look: v.look, crane: null, blade: false }; }

function startLevel(level, race = null, opts = {}) {
  if (!race && !opts.hint && !freeLives() && livesNow() <= 0) { noLivesMenu(() => startLevel(level, race, opts)); return; }
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
  game = { level, spec, sim, me, lane, player, z: z0, race, racers: [], acc: 0, over: false, failT: 0, countdown: race ? 3.0 : 0, autoBot: makeBot(1, 11), t0: ui.t, continued: false, hint: !!opts.hint };
  if (race) {
    race.rivals.forEach((rv, i) => {
      const s2 = aiSpec(rv.car);
      const r = makeRacer(level, s2, { collectGems: false });
      const z = laneZ(i + 1);
      const ln = R.attachSim(r.sim, { z, gems: false });
      const car = R.addCar(r.sim, s2, { label: rv.name, color: rv.color, z });
      game.racers.push({ ...rv, r, lane: ln, car, z, bot: makeBot(rv.skill, i + 3), spec: s2, finish: null });
    });
  }
  if (!race && !testRun && !save.autoplay && !opts.hint && !save.tut.drive) game.tut = 'drive';
  if (opts.hint) tip(game, 'Hint: watch how it is done!', 3);
  R.snapCam = true;
  showHud();
  Audio.engineStart();
}
// tutorial: hold ▶ to drive (first level), then a one-off tip for braking and for tilting in the air
const tip = (g, text, sec = 3) => { g.tip = { text, t0: ui.t, sec }; ui.request(sec + 0.5); };
function tutorialTick(g, dt, input) {
  if (save.autoplay || testRun || g.hint || g.race) return;
  if (g.tut === 'drive') {
    if (input > 0) g.tutT = (g.tutT || 0) + dt;
    if (g.tutT > 0.8) { g.tut = null; save.tut.drive = true; persist(); tip(g, 'Nice! Hold ◀ to brake and reverse', 2.6); }
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
  g.acc += Math.min(dt, 0.1);
  const t = save.autoplay || testRun || g.hint ? g.autoBot(g.sim) : throttleInput();
  tutorialTick(g, dt, t);
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
        else if (e.type === 'land') r.car.squash = Math.min(1, e.v);
        else if (e.type === 'recover') R.carRecover(r.car, e);
        else if (e.type === 'breakup') R.burst(rs.x, rs.chassis.getPosition().y + 0.5, 0x55565e, 8, 4, -9, 0.6, r.z);
        else if (e.type === 'wheelOff') { const q = rs.wheels[e.idx].getPosition(); R.burst(q.x, q.y, 0x55565e, 6, 3, -8, 0.5, r.z); }
        else if (e.type === 'impact' && e.v > 4) impactFx(e, rs, r.z, r.spec?.look, true);
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
    if (st === 'fail' && !g.race) { g.failT += dt; if (g.failT > 0.9) { g.over = true; testResult(false, g.sim.failPose || g.sim.reason); } return; }
    if (st === 'win') { g.winT = (g.winT || 0) + dt; if (g.winT > 0.9) { g.over = true; testResult(true, fmt(g.sim.finishTime)); } return; }
    if (g.sim.time > limit) { g.over = true; testResult(false, 'timeout'); }
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
      const k = impactFx(e, sim, z, game?.spec?.look);
      if (!k) { if (e.v > 8 && e.heavy) { Audio.land(Math.min(1, e.v / 12)); R.shake = Math.max(R.shake, 0.12); } break; }   // blocker: a thud, no debris
      Audio.land(Math.min(1, e.v / 10));
      if (e.v > 8) { R.shake = Math.max(R.shake, 0.15 + k * 0.35); P.vibrate(); }
      if (e.v > 9 && (game.impT || 0) < ui.t) { game.impT = ui.t + 0.8; R.popText(e.heavy ? 'CRASH!' : 'SMASH!', e.x, e.y + 2.2, z, '#ff6b74'); }
      break;
    }
    case 'tumble': R.popText('Too fast!', p.x, p.y + 2.8, z, '#ffd21a'); R.shake = 0.5; Audio.crash(); P.vibrate(); break;
    case 'bannerHit': {
      const look = game?.spec?.look;
      R.debris(e.x - 0.3, e.y, z, [0x1d1d22, 0xffffff, 0x8d93a3, look?.body ?? 0xff9a14], 18, 4 + Math.min(5, e.v * 0.5), -1, sim.groundAt(e.x - 1.5) ?? e.y - 3.6);
      R.kickFinish(0.5 + Math.min(1, e.v / 10)); R.popText('CLANG!', e.x, e.y + 1.2, z, '#ffd21a');
      R.shake = Math.max(R.shake, 0.3); Audio.crash(); P.vibrate();
      break;
    }
    case 'gem': R.burst(e.gem.piece.x, e.gem.piece.y, 0xffd21a, 12, 4, -6, 0.6, z); R.popText('+1', e.gem.piece.x, e.gem.piece.y + 0.8, z); Audio.gem(); break;
    case 'land':
      // landing on the road: tyre smoke puffs at both wheels, no debris
      for (const w of sim.wheels) { const q = w.getPosition(); for (let i = 0; i < 2 + Math.min(4, e.v * 3); i++) R.smoke(q.x + (Math.random() - 0.5) * 1.2, q.y - sim.spec.wheelR + 0.25, z + (Math.random() < 0.5 ? -0.86 : 0.86), 0.25 + Math.min(0.3, e.v * 0.15), (Math.random() - 0.5) * 2.4, 0.2 + Math.random() * 0.5); }
      Audio.land(e.v);
      if (car) car.squash = Math.min(1, 0.4 + e.v * 0.5);
      if (e.v > 1) R.shake = 0.2;
      if (e.v > 1.3) R.popText(e.v > 2 ? 'HUGE AIR!' : 'Nice air!', p.x, p.y + 2.6, z, '#7df9ff');
      break;
    case 'pad': case 'boost': R.burst(p.x, p.y - 0.6, 0x5ff0ff, 18, 6, -3, 0.7, z); R.punch = 1; Audio.boost(); break;
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
    case 'wheelOff': { const q = sim.wheels[e.idx].getPosition(); R.burst(q.x, q.y, 0x55565e, 8, 4, -8, 0.6, z); R.popText('Wheel off!', q.x, q.y + 1.6, z, '#ffffff'); Audio.land(0.6); P.vibrate(); break; }
    case 'breakup': R.burst(p.x, p.y + 0.6, 0xffd21a, 10, 5, -9, 0.7, z); R.burst(p.x, p.y + 0.4, 0x55565e, 10, 4, -9, 0.7, z); break;
    case 'recover': if (car) { R.carRecover(car, e); R.popText(e.to.x < e.from.x - 1 ? 'Back you go!' : 'Flip!', e.from.x, e.from.y + 2.6, z, '#ffffff'); } break;
    case 'win':
      for (const c of [0xffffff, 0xff3d6b, 0x2f7cf6, 0xffd21a]) R.burst(p.x + 1, p.y + 2, c, 14, 7, -5, 1.2, z);
      if (car) car.hop = 1.2;
      Audio.win(); break;
    case 'fail':
      if (e.reason === 'splash') { R.burst(p.x, (sim.level.water ?? -3) + 0.2, 0xffffff, 30, 7, -10, 1, z); Audio.splash(); }
      else { for (let i = 0; i < 10; i++) R.smoke(p.x + (Math.random() - 0.5) * 2.5, p.y - 0.4, z + (Math.random() - 0.5) * 1.8, 0.4, (Math.random() - 0.5) * 2, 0.4 + Math.random() * 0.6); Audio.crash(); R.shake = 0.35; P.vibrate(); }
      if (!game.race) setTimeout(() => { if (game && !game.snap) game.snap = R.snapshotCar(sim, z); }, 420);
      else R.popText(e.reason === 'splash' ? 'SPLASH!' : 'OOPS!', p.x, p.y + 2.4, z, '#ffffff');
      break;
    default: break;
  }
}

// ------------------------------------------------------------ ads
const clock = () => ui.t;
let lastInterstitial = -1e9, levelEnds = 0;
// Interstitials only at natural breaks (leaving a result screen), paced by AD_RULES.
function adBreak(next) {
  if (testRun || save.autoplay) return next();
  levelEnds++;
  const t = clock();
  if (t < AD_RULES.firstInterstitialAfterSec || t - lastInterstitial < AD_RULES.minInterstitialGapSec || levelEnds % AD_RULES.levelsBetweenInterstitials !== 0) return next();
  lastInterstitial = t;
  Audio.engineStop(); const snd = save.sound; Audio.setEnabled(false);
  P.showInterstitial().finally(() => { Audio.setEnabled(snd); next(); });
}
// Rewarded video: the reward is only granted when the video was watched to the end.
function watchAd(onReward) {
  const snd = save.sound; Audio.setEnabled(false); Audio.engineStop();
  P.showRewarded().then((ok) => {
    Audio.setEnabled(snd);
    if (ok) onReward(); else ui.toast('Watch the whole video to get the reward', '#ff5a6e');
  });
}
// Local stand-in ad for the web build and for placeholder ad unit IDs.
P.fakeAd = (kind) => new Promise((resolve) => {
  const dur = kind === 'rewarded' ? 3 : 2;
  ui.overlay((u, age) => {
    const w = Math.min(u.w - 40, 340), h = 300, x = (u.w - w) / 2, y = u.h / 2 - h / 2;
    u.panel(x, y, w, h, { ribbon: kind === 'rewarded' ? 'Test video' : 'Test ad', ribbonColor: 'purple', scale: u.pop(0, 0.3, age) });
    u.text('TEST AD', u.w / 2, y + 70, 40, GOLD);
    u.text(kind === 'rewarded' ? 'Real TikTok video ads show here' : 'Real TikTok interstitials show here', u.w / 2, y + 112, 15, '#fff', { maxW: w - 30 });
    u.text('once the ad unit IDs are set.', u.w / 2, y + 134, 15, '#fff', { maxW: w - 30 });
    const left = Math.max(0, dur - age);
    u.bar(x + 30, y + 160, w - 60, 18, 1 - left / dur, { fill: GRAD.gold });
    const done = left <= 0;
    u.button('adclose', x + 30, y + h - 82, w - 60, 54, { color: done ? 'green' : 'gray', label: done ? (kind === 'rewarded' ? 'Claim reward' : 'Close') : `Wait ${Math.ceil(left)}s`, disabled: !done, onTap: () => { u.closeOverlay(); resolve(true); } });
    if (kind === 'rewarded' && !done) u.button('adskip', x + w - 70, y + 16, 54, 30, { color: 'red', label: 'Skip', size: 14, radius: 10, onTap: () => { u.closeOverlay(); resolve(false); } });
    return !done || age < dur + 0.5;
  });
});

// ------------------------------------------------------------ TikTok capabilities (the 3 buttons)
function grantMission(kind, first, daily, label) {
  const st = save.tt[kind] ||= {};
  if (st.day === today()) return;
  const amount = st.first ? daily : first;
  st.first = true; st.day = today(); persist();
  earnGems(amount, { x: ui.w / 2, y: ui.h / 2 });
  ui.toast(`${label}: +${amount} gems`, '#46d35c');
}
async function checkMissionRewards() {
  if (!P.isTT) return;
  if (await P.shortcutReward()) grantMission('shortcut', REWARDS.shortcutFirst, REWARDS.shortcutDaily, 'Home screen reward');
  if (await P.sidebarReward()) grantMission('sidebar', REWARDS.sidebarFirst, REWARDS.sidebarDaily, 'Profile reward');
}
const ttButtons = {
  addhome: async () => {
    if (!P.isTT) return ui.toast('Available in the TikTok app', '#ff8a1f');
    const ok = await P.addShortcut();
    if (ok) {
      const st = save.tt.shortcut ||= {};
      if (!st.added) { st.added = true; persist(); grantMission('shortcut', REWARDS.shortcutFirst, REWARDS.shortcutDaily, 'Added to home screen'); }
      else ui.toast('Open Crane Rush from your home screen daily for gems!');
    }
  },
  sidebar: async () => {
    if (!P.isTT) return ui.toast('Available in the TikTok app', '#ff8a1f');
    const ok = await P.startSidebar();
    if (ok) ui.toast('Open Crane Rush from your TikTok profile for gems!');
  },
  share: async () => {
    const ok = await P.share({ title: 'Crane Rush', desc: `I cleared ${totalDone()} levels in Crane Rush. Can you beat me?`, query: 'from=share' });
    if (!ok && !P.canShare()) ui.toast('Sharing is available in the TikTok app', '#ff8a1f');
  },
};
const missionReady = (kind) => (save.tt[kind]?.day !== today());

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
  const n = Math.max(0, Math.min(WORLDS.length - 1, save.world + d));
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
  // TikTok capability buttons (top-left row): Add to Home Screen, Profile sidebar, Share
  const bs = sh ? 40 : 44; let bx = PAD; const by0 = topY(u) + 3;   // +3: white ring
  roundBtn(u, 'tt_add', bx, by0, bs, 'addhome', 'Add', 'orange', ttButtons.addhome, missionReady('shortcut')); bx += bs + 16;
  roundBtn(u, 'tt_side', bx, by0, bs, 'sidebar', 'Profile', 'purple', ttButtons.sidebar, missionReady('sidebar')); bx += bs + 16;
  roundBtn(u, 'tt_share', bx, by0, bs, 'share', 'Share', 'teal', ttButtons.share);
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
    const dis = (d < 0 && wi === 0) || (d > 0 && wi === WORLDS.length - 1);
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
  const nLv = WORLDS.reduce((a, x) => a + x.levels.length, 0);
  const wc = `World ${wi + 1} / ${WORLDS.length} · ${nLv} levels` + (w.starsReq ? `   ★ ${w.starsReq}` : '');
  u.text(wc, u.w / 2, countY, 17);
  const bob = Math.sin(u.t * 3.9) * 3;
  if (unlocked) {
    const pw2 = 180;
    u.button('play', u.w / 2 - pw2 / 2, playY - playH + bob, pw2, playH, { label: 'Play', icon: 'play', size: 32, scale: u.pop(0.1, 0.4), onTap: tap(() => showLevels(wi)) });
    livesPill(u, u.w / 2 + pw2 / 2 + 8, playY - playH / 2 - 17 + bob, 34, false, true);
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
  ui.show('levels', (u) => drawLevels(u, wi, firstOpen));
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
  rx -= livesPill(u, rx, topY(u) + 8, 34, true) + 10;
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
  if (dev() || testRun || g.hint) chip(u, 'auto', PAD + 2, topY(u) + 50 + 10, g.hint ? 'HINT' : 'AUTO', !!(save.autoplay || testRun || g.hint), () => { if (g.hint) return; save.autoplay = !save.autoplay; persist(); u.request(); });
  const name = g.race ? (g.race.random ? `Random · ${l.name}` : `${g.race.cup.name} · Race ${g.race.idx + 1}/3`) : `${w.name} ${l.index + 1}. ${l.name}`;
  u.text(name, u.w / 2, topY(u) + 10, 15, '#fff', { maxW: u.w - 180 });
  u.text(fmt(g.sim.state === 'win' ? g.sim.finishTime : g.sim.time), u.w / 2, topY(u) + 38, 30);
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
    const tr = testRun, txt = `TEST  ${tr.i + 1}/${tr.queue.length}   ✓ ${tr.pass}   ✗ ${tr.fails.length}`, tw2 = u.measure(txt, 15) + 90, tx2 = u.w / 2 - tw2 / 2, ty2 = topY(u) + 92;
    u.rr(tx2, ty2, tw2, 36, 12); c.fillStyle = 'rgba(10,30,80,0.75)'; c.fill(); c.lineWidth = 3; c.strokeStyle = INK; c.stroke();
    u.text(txt, tx2 + 14, ty2 + 19, 15, '#b8ffc0', { align: 'left' });
    u.button('teststop', tx2 + tw2 - 66, ty2 + 5, 58, 26, { color: 'red', label: 'Stop', size: 14, radius: 9, ring: false, onTap: tap(() => endTest(true)) });
  }
  // drive controls: hold anywhere on the left / right half of the lower screen
  const cs = Math.min(u.w * 0.3, 170), cy = u.h - B - 28 - cs, half = u.w / 2;
  for (const [side, ic, x] of [['L', 'left', u.w * 0.04], ['R', 'right', u.w * 0.96 - cs]]) {
    const id = 'ctrl' + side, down = u.isDown(id) || (side === 'L' ? keys.left : keys.right);
    c.save(); c.globalAlpha = down ? 1 : 0.75;
    const s = down ? 0.88 : 1; c.translate(x + cs / 2, cy + cs / 2); c.scale(s, s); c.translate(-(x + cs / 2), -(cy + cs / 2));
    u.icon(ic, x + cs * 0.06, cy + cs * 0.06, cs * 0.88, '#fff', false);
    c.restore();
    u.hit(side === 'L' ? 0 : half, u.h * 0.45, half, u.h * 0.55, { id, hold: (v) => { if (side === 'L') touchL = v; else touchR = v; Audio.unlock(); u.request(); } });
  }
  // tutorial: hand on the ▶ control, then short tips
  if (g.tut === 'drive') {
    const x = u.w * 0.96 - cs, k = 0.5 + 0.5 * Math.sin(u.t * 5);
    c.save(); c.globalAlpha = 0.35 + 0.35 * k; c.beginPath(); c.arc(x + cs / 2, cy + cs / 2, cs * (0.55 + 0.08 * k), 0, Math.PI * 2); c.lineWidth = 6; c.strokeStyle = GOLD; c.stroke(); c.restore();
    const hs = cs * 0.62, hx = x + cs / 2 - hs * 0.4, hy = cy + cs * 0.45 + k * 10;
    u.icon('hand', hx, hy, hs, '#fff');
    const txt = 'Hold to drive!', bw = u.measure(txt, 22) + 36, bx = Math.min(u.w - PAD - bw, x + cs / 2 - bw / 2), byy = cy - 58;
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
const STICKERS = { roof: 'stars', nose: 'bang', backflip: 'spin', crash: 'bang', splash: 'bubbles', splashSpin: 'bubbles', splashRoof: 'bubbles', splashShort: 'bubbles', lost: 'bang' };

const failCount = {};   // this session: crashes per level (the Hint offer appears after 2)
function onFail() {
  const g = game, l = g.level;
  if (g.hint) { R.popText('Again!', g.sim.x, 3, g.z, '#fff'); setTimeout(() => { if (game === g) startLevel(l, null, { hint: true }); }, 600); return; }
  Audio.engineStop(); Audio.fail();
  loseLife(); failCount[l.id] = (failCount[l.id] || 0) + 1;
  const snap = g.snap || R.snapshotCar(g.sim, g.z);
  const pose = g.sim.failPose || g.sim.reason || 'crash';
  const q = QUIPS[pose] || QUIPS.crash;
  const st = { snap, sticker: STICKERS[pose], caption: q[(Math.random() * q.length) | 0], tilt: (Math.random() * 10 - 5) * Math.PI / 180, l, lives: livesNow(), hint: failCount[l.id] >= 2 && !save.autoplay };
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
  const canContinue = !st.continued && game && !game.race;
  const barH = short() ? 72 : 82, contH = canContinue || st.hint ? 64 : 0, heartsH = 44;
  const avail = u.h - T - B - barH - contH - 90 - heartsH;
  const pw = Math.min(u.w * 0.78, 360, avail / 1.33), ph = pw * 1.05, frameH = ph + 16 + 64;
  const px = u.w / 2 - pw / 2, py = T + 30 + heartsH + (avail - frameH) / 2 + 10;
  // lives left (the one just lost pops out)
  if (!freeLives()) {
    const hy = topY(u) + 6, hs = 30;
    for (let i = 0; i < LIVES_MAX; i++) {
      const hx = u.w / 2 + (i - (LIVES_MAX - 1) / 2) * (hs + 8) - hs / 2, lost = i === st.lives, k = lost ? Math.min(1, t / 0.6) : 0;
      c.save(); c.globalAlpha = lost ? 1 - k * 0.75 : 1; c.translate(hx + hs / 2, hy + hs / 2 - k * 14); c.scale(1 + k * 0.4, 1 + k * 0.4);
      u.icon('heart', -hs / 2, -hs / 2, hs, i < st.lives ? '#ff4d6a' : 'rgba(255,255,255,0.3)'); c.restore();
    }
  }
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
    c.save(); c.translate(pw / 2 - 64, fy + 46); c.rotate(0.24); c.scale(ss, ss); c.globalAlpha = 0.9 * sk;
    u.rr(-56, -22, 112, 44, 8); c.lineWidth = 4; c.strokeStyle = '#ff3d57'; c.stroke();
    u.text('OOPS!', 0, 2, 28, '#ff3d57', { outline: false }); c.restore();
  }
  u.text(st.caption, 0, fy + 16 + ph + 34, Math.min(24, pw / 13), '#8a92a6', { outline: false, maxW: pw });
  c.restore();
  // buttons
  const by = u.h - B - 24 - barH;
  // rewarded offers: continue from the checkpoint, and after 2 crashes on this level a hint (the bot shows the way)
  const offers = [];
  if (canContinue) offers.push({ id: 'continue', color: 'green', parts: [{ icon: 'video', size: 22 }, 'Continue'], fn: () => continueAfterCrash(st) });
  if (st.hint) offers.push({ id: 'hint', color: 'purple', parts: [{ icon: 'video', size: 22 }, 'Hint', { icon: 'bulb', size: 22, color: GOLD }], fn: () => startLevel(st.l, null, { hint: true }) });
  if (offers.length) {
    const ow = Math.min(u.w - PAD * 2, offers.length > 1 ? 360 : 280), bw = (ow - GAP * (offers.length - 1)) / offers.length;
    offers.forEach((o, i) => u.button(o.id, u.w / 2 - ow / 2 + i * (bw + GAP), by - 66, bw, 52, { color: o.color, parts: o.parts, size: 20, scale: u.pop(0.6, 0.4), onTap: tap(() => watchAd(o.fn)) }));
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
  st.continued = true; addLives(1);   // the crash did not end the run after all
  const back = g.sim.reason === 'splash' ? 9 : 5;
  const cp = [...g.me.safe].reverse().find((x) => x <= g.sim.x - back) ?? g.sim.startX;
  respawnAt(g.me, cp);
  g.over = false; g.failT = 0; g.snap = null; g.paused = false;
  showHud(); Audio.engineStart();
}

// ------------------------------------------------------------ level complete
function onWin() {
  Audio.engineStop();
  const g = game, l = g.level, sim = g.sim;
  const t = sim.finishTime, prev = lvlSave(l), allGems = sim.gemsTaken >= sim.gems.length;
  // a hint run (the bot drove) clears the level with 1 star; drive it yourself for more
  const stars = g.hint ? 1 : 1 + (allGems ? 1 : 0) + (t <= par(l) ? 1 : 0);
  let earn = sim.gemsTaken * 5;
  if (!prev || prev.time == null) earn += 20 + l.world * 5;   // first clear: coins to buy trucks
  if (stars === 3 && (!prev || (prev.stars || 0) < 3)) earn += 30;
  const best = prev?.time != null ? Math.min(prev.time, t) : t;
  save.levels[l.id] = { time: best, stars: Math.max(stars, prev?.stars || 0) };
  const newBest = !prev || prev.time == null || t < prev.time;
  persist();
  const next = WORLDS[l.world].levels[l.index + 1];
  const st = { l, t, best, newBest, stars, earn, gems: `${sim.gemsTaken}/${sim.gems.length}`, next, mult: 1, hint: g.hint };
  [0, 1, 2].forEach((i) => { if (i < stars) setTimeout(() => Audio.star(i), 300 + i * 250); });
  ui.show('win', (u) => drawWin(u, st), { anim: 2.6 });
  setTimeout(() => earnGems(earn, st.earnPos), 1000);
  if (save.autoplay && next) setTimeout(() => { if (ui.screen?.name === 'win' && game?.level === l) startLevel(next); }, 2600);
}
function drawWin(u, st) {
  const c = u.ctx, T = u.safeTop, B = u.safeBottom, barH = short() ? 72 : 82;
  c.fillStyle = 'rgba(10,60,170,0.35)'; c.fillRect(0, 0, u.w, u.h);
  const pw = Math.min(u.w * 0.9, 400), ph = 330, px = u.w / 2 - pw / 2;
  const by = u.h - B - 24 - barH, py = Math.max(T + 50, (by - 80 - ph) / 2 + 10);
  u.panel(px, py, pw, ph, { ribbon: 'Level Complete!', scale: u.pop(0, 0.4) });
  for (let i = 0; i < 3; i++) {
    const k = i < st.stars ? Math.min(1.3, u.pop(0.25 + i * 0.25, 0.5)) : 1, big = i === 1;
    u.star(u.w / 2 + (i - 1) * 76, py + 70 - (big ? 12 : 0), big ? 78 : 66, i < st.stars && k > 0.3, i < st.stars ? Math.max(0.01, k) : 1);
  }
  const rows = [['Time', fmt(st.t)], ['Best', fmt(st.best) + (st.newBest ? '  NEW!' : '')], ['Gems', st.gems]];
  rows.forEach(([a, b], i) => {
    const ry = py + 128 + i * 38;
    u.text(a, px + 24, ry, 20, '#fff', { align: 'left' }); u.text(b, px + pw - 24, ry, 20, b.includes('NEW') ? GOLD : '#fff', { align: 'right' });
    c.fillStyle = 'rgba(255,255,255,0.15)'; c.fillRect(px + 20, ry + 18, pw - 40, 2);
  });
  u.text(st.hint ? 'Hint used: drive it yourself for 3 stars!' : `★ finish · ★ all gems · ★ under ${fmt(par(st.l))}`, u.w / 2, py + 248, st.hint ? 15 : 13, st.hint ? '#ffe9a8' : '#fff', { maxW: pw - 30 });
  const shown = Math.round(st.earn * st.mult * Math.min(1, Math.max(0, (u.st - 1) / 0.9)));
  u.row([{ text: `+${shown}`, color: GOLD }, { gem: true, size: 30 }], u.w / 2, py + 290, { size: 30, gap: 10 });
  st.earnPos = { x: u.w / 2, y: py + 290 };
  if (st.mult === 1 && st.earn > 0) {
    const bw = Math.min(u.w - 60, 280);
    u.button('x3', u.w / 2 - bw / 2, by - 66, bw, 52, { color: 'green', icon: 'video', label: `x${REWARDS.winMultiplier} gems`, size: 20, scale: u.pop(1.2, 0.4), onTap: tap(() => watchAd(() => { st.mult = REWARDS.winMultiplier; st.t0x = u.t; earnGems(st.earn * (REWARDS.winMultiplier - 1), st.earnPos); Audio.win(); })) });
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
  const earn = Math.round(PLACE_GEMS[myPlace] * race.cup.reward) + g.sim.gemsTaken * 5;
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
  const by = u.h - B - 24 - barH, showX2 = st.mult === 1 && st.earn > 0 && !testRun;
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
    u.button('x2', u.w / 2 - bw / 2, by - 66, bw, 52, { color: 'green', icon: 'video', label: `x${REWARDS.raceMultiplier} gems`, size: 20, scale: u.pop(1, 0.4), onTap: tap(() => watchAd(() => { st.mult = REWARDS.raceMultiplier; earnGems(st.earn * (REWARDS.raceMultiplier - 1), st.earnPos); Audio.win(); })) });
  }
  const nextLabel = st.race.random ? 'Another one' : st.race.idx < 2 ? 'Next race' : 'Standings';
  barButtons(u, [
    { id: 'home', label: 'Home', icon: 'home', onTap: () => adBreak(showRace) },
    { id: 'next', label: nextLabel, icon: 'next', color: 'blue', big: true, onTap: () => adBreak(() => { if (st.race.random) startRandomRace(); else if ((save.cup.race || 0) >= 3) cupStandings(); else showRace(); }) },
  ], by);
  return u.st < 2.4;
}

function cupStandings() {
  game = null;
  const cupIdx = save.cup.idx, cup = CUPS[cupIdx];
  const pts = save.cup.pts || {};
  const rows = Object.entries(pts).map(([name, p]) => ({ name, p, me: name === 'You' })).sort((a, b) => b.p - a.p);
  const won = rows[0]?.me;
  if (won && !save.cups[cupIdx]) { save.cups[cupIdx] = true; setTimeout(() => earnGems(250, { x: ui.w / 2, y: ui.h / 2 }), 600); }
  save.cup = { idx: won && cupIdx < CUPS.length - 1 ? cupIdx + 1 : cupIdx, race: 0, pts: null };
  persist();
  if (won) { Audio.win(); ui.confetti(); } else Audio.fail();
  R.showDiorama(WORLDS[cup.world], vehicleById(save.car), 2.6);
  ui.show('standings', (u) => {
    const c = u.ctx, T = u.safeTop, B = u.safeBottom;
    c.fillStyle = 'rgba(10,60,170,0.35)'; c.fillRect(0, 0, u.w, u.h);
    topbar(u);
    const by = u.h - B - 24 - (short() ? 72 : 82), n = rows.length, ts = short() ? 64 : 92;
    const pw = Math.min(u.w * 0.92, 420), px = u.w / 2 - pw / 2, py = topY(u) + pillH() + GAP + 22, ty = py + 34 + ts;
    const rh = Math.max(34, Math.min(short() ? 44 : 50, Math.floor((by - GAP - ty - 50) / n) - 8)), gap = rh < 44 ? 6 : 8;
    u.panel(px, py, pw, ty - py + n * (rh + gap) + 44, { ribbon: `${cup.name} ${won ? 'Won!' : 'Final'}`, ribbonColor: cup.color });
    const k = u.pop(0.1, 0.6) * (won ? 1 + Math.sin(u.t * 4) * 0.05 : 1);
    c.save(); c.translate(u.w / 2, py + 26 + ts / 2); c.scale(k, k); u.icon('trophy', -ts / 2, -ts / 2, ts, won ? GOLD : '#8e97b0'); c.restore();
    const endY = tableRows(u, rows, px + 14, ty, pw - 28, { time: false, rh });
    u.text(won ? '+250 bonus gems! Next cup unlocked.' : 'Finish 1st overall to win the cup!', u.w / 2, endY + 16, 15, '#fff', { maxW: pw - 20 });
    barButtons(u, [{ id: 'cont', label: 'Continue', icon: 'trophy', color: 'blue', big: true, onTap: showRace }], by);
    return true;
  });
}

function startRandomRace() {
  const level = RACE_TRACKS[(Math.random() * RACE_TRACKS.length) | 0];
  const n = laneCount() - 1, start = (Math.random() * RIVALS.length) | 0;
  const rivals = Array.from({ length: n }, (_, i) => ({ ...RIVALS[(start + i) % RIVALS.length], skill: 0.65 + Math.random() * 0.3 }));
  startLevel(level, { cup: { name: 'Random', reward: 1, color: '#ff8a1f' }, idx: 0, rivals, random: true });
}
function startRace() {
  const cupIdx = save.cup.idx, cup = CUPS[cupIdx];
  const idx = save.cup.race || 0;
  if (!save.cup.pts) save.cup.pts = { You: 0 };
  const rivals = Array.from({ length: laneCount() - 1 }, (_, i) => ({ ...RIVALS[(cupIdx + i) % RIVALS.length], skill: cup.skill[i] }));
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
    const lock = i > cupIdx && !save.cups[i], cur = i === cupIdx, x = cx0 + i * (cw + 8);
    u.rr(x, cy, cw, 66, 14); c.fillStyle = 'rgba(10,30,80,0.5)'; c.fill(); c.lineWidth = 3; c.strokeStyle = INK; c.stroke();
    if (cur) { u.rr(x - 3, cy - 3, cw + 6, 72, 16); c.lineWidth = 3; c.strokeStyle = cp.color; c.stroke(); }
    c.globalAlpha = lock ? 0.6 : 1;
    u.icon(lock ? 'lock' : 'trophy', x + cw / 2 - 16, cy + 6, 32, save.cups[i] ? GOLD : cur ? cp.color : '#6f7894');
    u.text(cp.name, x + cw / 2, cy + 52, 11, '#fff', { maxW: cw - 6 });
    c.globalAlpha = 1;
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
  ui.show('shop', drawShop, { keepScroll: !!sel });
}
function drawShop(u) {
  const c = u.ctx, T = u.safeTop, B = u.safeBottom, sh = short();
  const cur = vehicleById(shopSel), own = save.owned.includes(cur.id), ups = save.upgrades?.[cur.id] || {};
  topbar(u);
  // free gems for a video (left, under the safe area)
  u.button('freegems', PAD, topY(u), 132, pillH(), { color: 'green', parts: [{ icon: 'video', size: 22 }, `+${REWARDS.freeGems}`, { gem: true, size: 18 }], size: 17, radius: 12, onTap: tap(() => watchAd(() => { earnGems(REWARDS.freeGems, { x: 70, y: T + 30 }); Audio.win(); })) });
  const ny = T + (sh ? 76 : 86);
  u.text(cur.name, u.w / 2, ny, sh ? 26 : 32);
  u.text(cur.desc, u.w / 2, ny + (sh ? 26 : 30), sh ? 13 : 15, '#fff', { maxW: u.w - 30 });
  // stats
  const pct = (val, up) => Math.max(0.06, Math.min(1, (val - up.lo) / (up.hi - up.lo)));
  const sw = Math.min(u.w - 30, own ? 340 : 380), sx = u.w / 2 - sw / 2, sy = ny + (sh ? 46 : 54);
  UPGRADES.forEach((up, i) => {
    const lvl = ups[up.id] || 0, baseP = pct(cur[up.key], up), upP = pct(cur[up.key] * (1 + up.pct * lvl), up);
    const cols = own ? 1 : 2, colW = (sw - (cols - 1) * 14) / cols;
    const x = sx + (own ? 0 : (i % 2) * (colW + 14)), y = sy + (own ? i * (sh ? 25 : 28) : Math.floor(i / 2) * 24);
    u.text(up.name, x, y + 8, 14, '#fff', { align: 'left' });
    const bx = x + 50, bw = colW - 50 - (own ? 66 : 0), bh = 14;
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
  // truck cards
  const bh0 = sh ? 46 : 52, btnY = navTop(u) - 2 * GAP - bh0, cardH = sh ? 96 : 112, cardW = sh ? 110 : 128, cy = btnY - 2 * GAP - cardH;
  const list = [...VEHICLES].sort((a, b) => a.price - b.price);
  const selIdx = list.findIndex((v) => v.id === cur.id);
  let made = false;
  u.scroll('cards', 0, cy - 8, u.w, cardH + 16, list.length * (cardW + GAP) + PAD * 2 - GAP, () => {
    list.forEach((v, i) => {
      const x = PAD + i * (cardW + GAP), y = cy, o = save.owned.includes(v.id), on = save.car === v.id, sel = v.id === cur.id;
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
    u.button('try', x0, btnY, tw, bh, { color: 'purple', parts: [{ icon: 'video', size: 22 }, 'Try'], size: 20, onTap: tap(() => watchAd(() => {
      trialCar = cur.id; Audio.win(); showLevels(save.world); ui.toast(`${cur.name}: free for your next level!`, '#b47aff');
    })) });
    u.button('buy', x0 + tw + GAP, btnY, bw2, bh, { color: canAfford(cur.price) ? 'orange' : 'gray', parts: ['Buy', { gem: true, size: 22 }, String(cur.price)], onTap: () => doBuy(cur.id) });
  }
  navbar(u, 'shop');
  return made || u.st < 0.8;
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
const SETTING_KEYS = ['sound', 'shadows', 'autoplay', 'infinite', 'unlockAll'];
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
  const rows = [['sound', 'sound', 'Sound'], ['shadows', 'settings', 'Shadows (quality)'], ...(dev() ? [null, ['autoplay', 'play', 'Autoplay (bot drives)'], ['infinite', 'gem', 'Infinite gems (dev)'], ['unlockAll', 'lock', 'Unlock all levels']] : [])];
  const size = rows.length * (rowH + 6) + 160;
  u.scroll('set', px + 10, bodyY, pw - 20, bodyH, size, () => {
    let y = bodyY + 4;
    for (const r of rows) {
      if (!r) { u.text('TEST TOOLS', px + 22, y + 14, 13, 'rgba(255,255,255,0.8)', { align: 'left', outline: false }); y += 28; continue; }
      const [k, ic, label] = r, on = setDraft[k];
      u.rr(px + 16, y, pw - 32, rowH, 14); c.fillStyle = 'rgba(0,0,0,0.18)'; c.fill();
      u.icon(ic, px + 28, y + rowH / 2 - 13, 26, k === 'infinite' ? GOLD : '#fff');
      u.text(label, px + 66, y + rowH / 2 + 1, sh ? 16 : 18, '#fff', { align: 'left', maxW: pw - 170 });
      const tx = px + pw - 32 - 56, ty = y + rowH / 2 - 15;
      u.rr(tx, ty, 54, 30, 15); c.fillStyle = on ? '#46d35c' : '#8e97b0'; c.fill(); c.lineWidth = 3; c.strokeStyle = INK; c.stroke();
      c.beginPath(); c.arc(on ? tx + 39 : tx + 15, ty + 15, 10, 0, Math.PI * 2); c.fillStyle = '#fff'; c.fill();
      u.hit(px + 16, y, pw - 32, rowH, { id: 'tg' + k, onTap: tap(() => { setDraft[k] = !setDraft[k]; u.request(); }) });
      y += rowH + 6;
    }
    u.button('reset', px + 22, y + 8, pw - 44, 44, { color: resetArmed ? 'red' : 'gray', label: resetArmed ? 'Tap again to erase everything' : 'Reset progress', size: resetArmed ? 15 : 18, onTap: tap(() => {
      if (!resetArmed) { resetArmed = true; u.request(); return; }
      save = { ...defaults, levels: {}, cups: {}, owned: ['crane'], cup: { idx: 0, race: 0, pts: null }, tt: save.tt }; persist(); gemShown = 0; gemAnimT = -1; showWorlds(); ui.toast('Progress erased', '#ff5a6e');
    }) });
    y += 64;
    u.text('Controls: ◀ ▶ on screen, or Arrow keys / A D.', u.w / 2, y + 8, 12, '#fff', { maxW: pw - 40 });
    u.text('In the air, ▶ tilts back and ◀ tilts forward.', u.w / 2, y + 26, 12, '#fff', { maxW: pw - 40 });
    u.text(`Levels cleared: ${totalDone()}/${WORLDS.reduce((a, w) => a + w.levels.length, 0)} · Race tracks: ${RACE_TRACKS.length}`, u.w / 2, y + 44, 12, '#fff', { maxW: pw - 40 });
    u.text(`Crane Rush v${VERSION} · quality ${R.quality} · ${P.kind}${dev() ? ' · DEV' : ''}`, u.w / 2, y + 62, 11, 'rgba(255,255,255,0.7)', { outline: false });
    u.hit(px + 16, y + 50, pw - 32, 26, { id: 'devtap', onTap: () => {
      devTaps = u.t - devTapT < 1.5 ? devTaps + 1 : 1; devTapT = u.t;
      if (devTaps < 5) return;
      devTaps = 0; save.dev = !save.dev;
      if (!save.dev) { save.autoplay = save.infinite = save.unlockAll = false; for (const k of ['autoplay', 'infinite', 'unlockAll']) setDraft[k] = false; }
      persist(); u.toast(save.dev ? 'Developer tools on' : 'Developer tools off', '#ff8a1f'); u.request();
    } });
  });
  const fy = py + ph - footH, bw = (pw - 52) / 2;
  c.fillStyle = 'rgba(255,255,255,0.18)'; c.fillRect(px + 16, fy - 4, pw - 32, 2);
  u.button('cancel', px + 18, fy + 6, bw, footH - 20, { color: 'gray', label: 'Cancel', onTap: tap(() => { setDraft = null; showWorlds(); ui.toast('Changes discarded', '#8e97b0'); }) });
  const dirty = settingsDirty();
  u.button('save', px + 34 + bw, fy + 6, bw, footH - 20, { color: 'blue', label: 'Save', disabled: !dirty, onTap: tap(() => {
    for (const k of SETTING_KEYS) save[k] = setDraft[k];
    Audio.setEnabled(save.sound); R.setShadows(save.shadows); persist(); showWorlds(); ui.toast('Settings saved');
  }) });
  navbar(u, 'settings');
  return false;
}

// ------------------------------------------------------------ pause
function pauseMenu() {
  if (!game || game.over || game.paused) return;
  game.paused = true; Audio.engineStop(); touchL = touchR = false; keys.left = keys.right = false;
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
    const opts = [['tour', `Tour: level 1 of all ${WORLDS.length} worlds`, 'blue'], ['random', '20 random levels (any world)', 'blue'], ['world', `All ${w.levels.length} levels of ${w.name}`, 'blue'], ['races', '10 random races (3–6 lanes)', 'orange'], ['close', 'Close', 'gray']];
    const pw = Math.min(u.w * 0.9, 380), ph = 86 + opts.length * 62, px = u.w / 2 - pw / 2, py = u.h / 2 - ph / 2;
    u.panel(px, py, pw, ph, { ribbon: 'Test mode', ribbonColor: '#46d35c', scale: u.pop(0, 0.3, age) });
    u.text('The bot drives. Results are not saved.', u.w / 2, py + 44, 14, '#fff', { maxW: pw - 20 });
    opts.forEach(([id, label, col], i) => u.button('t' + id, px + 20, py + 70 + i * 62, pw - 40, 48, { color: col, label, size: 16, onTap: tap(() => { u.closeOverlay(); if (id !== 'close') startTest(id); }) }));
    return age < 0.4;
  });
}
function startTest(mode) {
  const pickLevel = () => { const w = WORLDS[(Math.random() * WORLDS.length) | 0]; return { level: w.levels[(Math.random() * w.levels.length) | 0] }; };
  let queue;
  if (mode === 'tour') queue = WORLDS.map((w) => ({ level: w.levels[0] }));
  else if (mode === 'random') queue = Array.from({ length: 20 }, pickLevel);
  else if (mode === 'world') queue = WORLDS[save.world].levels.map((level) => ({ level }));
  else queue = Array.from({ length: 10 }, () => ({ level: RACE_TRACKS[(Math.random() * RACE_TRACKS.length) | 0], lanes: 3 + ((Math.random() * 4) | 0) }));
  testRun = { mode, queue, i: -1, pass: 0, fails: [], times: [] };
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
    u.panel(px, py, pw, ph, { ribbon: `Test ${stopped ? 'stopped' : 'finished'}`, ribbonColor: t.fails.length ? 'red' : '#46d35c' });
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
P.onHide(() => { keys.left = keys.right = touchL = touchR = false; ui.releaseAll(); if (game && !game.over && !game.paused && !testRun) pauseMenu(); Audio.engineStop(); });
P.onShow(() => { checkMissionRewards(); });

// ------------------------------------------------------------ loading screen + main loop
let loading = { p: 0, shown: 0, art: null };
function drawLoading(u) {
  const c = u.ctx, g = c.createLinearGradient(0, 0, 0, u.h);
  g.addColorStop(0, '#2fb6ff'); g.addColorStop(1, '#bff0ff'); c.fillStyle = g; c.fillRect(0, 0, u.w, u.h);
  // sun rays
  c.save(); c.translate(u.w / 2, u.h * 0.42); c.rotate(u.t * 0.15);
  for (let i = 0; i < 12; i++) { c.rotate(Math.PI / 6); c.beginPath(); c.moveTo(0, 0); c.lineTo(-40, -u.h); c.lineTo(40, -u.h); c.closePath(); c.fillStyle = 'rgba(255,255,255,0.12)'; c.fill(); }
  c.restore();
  const k = u.pop(0, 0.6);
  c.save(); c.translate(u.w / 2, u.h * 0.2); c.rotate(-0.05); c.scale(k, k); u.text('CRANE', 0, -26, 52); u.text('RUSH', 0, 30, 66, GOLD); c.restore();
  if (loading.art) {
    const aw = Math.min(u.w * 0.86, 420), ah = aw * loading.art.height / loading.art.width, bob = Math.sin(u.t * 4) * 4;
    c.drawImage(loading.art, u.w / 2 - aw / 2, u.h * 0.44 - ah / 2 + bob, aw, ah);
  }
  loading.shown += (loading.p - loading.shown) * 0.2;
  const bw = Math.min(u.w * 0.7, 320), by = u.h * 0.74;
  u.bar(u.w / 2 - bw / 2, by, bw, 26, loading.shown, { fill: GRAD.gold });
  u.text(`${Math.round(loading.shown * 100)}%`, u.w / 2, by + 14, 16);
  const tips = ['Hold ▶ to drive, ◀ to brake and reverse', 'In the air, ▶ tilts back and ◀ tilts forward', 'Land on your wheels, not your roof!', 'Collect every gem for an extra star'];
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
const step = (p) => new Promise((res) => { loading.p = p; P.setLoadingProgress(p); setTimeout(res, 30); });
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
  P.silentLogin();
  await step(1);
  await new Promise((r) => setTimeout(r, 250));
  loadingDone = true;
  showWorlds();
  checkMissionRewards();
}
boot();

// debug / automated test hooks
globalThis.__crane = {
  get game() { return game; }, get testRun() { return testRun; }, save: () => save, ui, R, P, worlds: WORLDS,
  startLevel: (w, l) => startLevel(WORLDS[w].levels[l]), startTest, keys,
  actions: { board: () => showBoard(), standings: () => cupStandings(), tab: ({ tab }) => tabs2[tab](), race: startRace, randomRace: startRandomRace, levels: ({ w }) => showLevels(+w), shopSel: ({ id }) => showShop(id), use: ({ id }) => { save.car = id; persist(); } },
  stats: () => ({ calls: R.r.info.render.calls, tris: R.r.info.render.triangles, geos: R.r.info.memory.geometries, tex: R.r.info.memory.textures, pr: R.r.getPixelRatio() }),
  views: (id) => R.views(vehicleById(id || 'crane')), icon: (n) => { const c = R.thumbnail(VEHICLES[0], n, n); return c.toDataURL ? c.toDataURL() : ''; },
  tapAt: (x, y) => { ui.pointerDown({ id: 99, x, y }); ui.pointerUp({ id: 99, x, y }); },
};
