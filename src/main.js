// Crane Rush: game flow, UI screens, input and main loop.
import { Sim, DT } from './sim.js';
import { WORLDS, RACE_TRACKS } from './levels.js';
import { makeRacer, racerWatch } from './racer.js';
import { VEHICLES, vehicleById } from './vehicles.js';
import { makeBot } from './bot.js';
import { Renderer } from './render.js';
import { Audio } from './audio.js';
import PARS from './pars.json';

// ------------------------------------------------------------ save
const KEY = 'cranerush.save.v2';
const defaults = { diamonds: 0, owned: ['crane'], car: 'crane', levels: {}, world: 0, cups: {}, cup: { idx: 0, race: 0, pts: null }, sound: true, shadows: true, trophies: 0 };
let save;
try { save = { ...defaults, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { save = { ...defaults }; }
const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(save)); } catch { /* ignore */ } };

// ------------------------------------------------------------ icons
const I = {
  play: '<svg viewBox="0 0 24 24"><path d="M7 4.5v15a1 1 0 0 0 1.5.86l12-7.5a1 1 0 0 0 0-1.72l-12-7.5A1 1 0 0 0 7 4.5z"/></svg>',
  pause: '<svg viewBox="0 0 24 24"><rect x="5" y="4" width="5" height="16" rx="1.5"/><rect x="14" y="4" width="5" height="16" rx="1.5"/></svg>',
  retry: '<svg viewBox="0 0 24 24"><path d="M12 4a8 8 0 1 0 7.75 10h-2.6A5.5 5.5 0 1 1 12 6.5c1.5 0 2.9.6 3.9 1.6L13 11h7V4l-2.3 2.3A8 8 0 0 0 12 4z"/></svg>',
  home: '<svg viewBox="0 0 24 24"><path d="M12 3 2 12h3v8h5v-5h4v5h5v-8h3z"/></svg>',
  levels: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="3.5" rx="1.5"/><rect x="3" y="10.25" width="18" height="3.5" rx="1.5"/><rect x="3" y="16.5" width="18" height="3.5" rx="1.5"/></svg>',
  worlds: '<svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm6.9 6h-3a15.6 15.6 0 0 0-1.4-3.6A8 8 0 0 1 18.9 8zM12 4c.8 1.2 1.5 2.5 1.9 4h-3.8c.4-1.5 1.1-2.8 1.9-4zM4.3 14a8.2 8.2 0 0 1 0-4h3.4a16 16 0 0 0 0 4zm.8 2h3a15.6 15.6 0 0 0 1.4 3.6A8 8 0 0 1 5.1 16zm3-8h-3a8 8 0 0 1 4.4-3.6C8.9 5.5 8.4 6.7 8.1 8zM12 20c-.8-1.2-1.5-2.5-1.9-4h3.8c-.4 1.5-1.1 2.8-1.9 4zm2.3-6H9.7a14.7 14.7 0 0 1 0-4h4.6a14.7 14.7 0 0 1 0 4zm.2 5.6c.6-1.1 1.1-2.3 1.4-3.6h3a8 8 0 0 1-4.4 3.6zm1.8-5.6a16 16 0 0 0 0-4h3.4a8.2 8.2 0 0 1 0 4z"/></svg>',
  trophy: '<svg viewBox="0 0 24 24"><path d="M7 3h10v2h4v3a5 5 0 0 1-4.6 5 5 5 0 0 1-3.4 2.9V18h3v3H8v-3h3v-2.1A5 5 0 0 1 7.6 13 5 5 0 0 1 3 8V5h4zm10 4v4a3 3 0 0 0 2-3V7zM5 7v1a3 3 0 0 0 2 3V7z"/></svg>',
  settings: '<svg viewBox="0 0 24 24"><path d="M19.4 13a7.7 7.7 0 0 0 0-2l2.1-1.6-2-3.5-2.5 1a7.4 7.4 0 0 0-1.7-1L15 3h-4l-.4 2.7a7.4 7.4 0 0 0-1.7 1l-2.5-1-2 3.5L6.6 11a7.7 7.7 0 0 0 0 2l-2.1 1.6 2 3.5 2.5-1a7.4 7.4 0 0 0 1.7 1L11 21h4l.4-2.7a7.4 7.4 0 0 0 1.7-1l2.5 1 2-3.5zM13 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z"/></svg>',
  shop: '<svg viewBox="0 0 24 24"><path d="M7 18a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm10 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM1 2v2h2l3.6 7.6-1.4 2.4A2 2 0 0 0 7 17h12v-2H7.4l1.1-2h7.5a2 2 0 0 0 1.7-1l3.6-6.5A1 1 0 0 0 20.4 4H5.2l-.9-2z"/></svg>',
  flag: '<svg viewBox="0 0 24 24"><path d="M4 2h2v20H4z"/><path fill="#fff" d="M6 3h15v11H6z"/><path d="M6 3h3v3H6zm6 0h3v3h-3zm6 0h3v3h-3zM9 6h3v3H9zm6 0h3v3h-3zM6 9h3v3H6zm6 0h3v3h-3zm6 0h3v3h-3zM9 12h3v2H9zm6 0h3v2h-3z"/></svg>',
  lock: '<svg viewBox="0 0 24 24"><path d="M6 10V8a6 6 0 1 1 12 0v2h1a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V11a1 1 0 0 1 1-1zm2 0h8V8a4 4 0 1 0-8 0z"/></svg>',
  left: '<svg viewBox="0 0 24 24"><path d="M15.5 3.5 7 12l8.5 8.5 2.1-2.1L11.2 12l6.4-6.4z"/></svg>',
  right: '<svg viewBox="0 0 24 24"><path d="m8.5 3.5 8.5 8.5-8.5 8.5-2.1-2.1 6.4-6.4-6.4-6.4z"/></svg>',
  next: '<svg viewBox="0 0 24 24"><path d="M5 4.5v15a1 1 0 0 0 1.5.86L16 14.4V20h3V4h-3v5.6L6.5 3.64A1 1 0 0 0 5 4.5z"/></svg>',
  star: '<svg viewBox="0 0 24 24"><path d="m12 2 3 6.6 7.2.7-5.4 4.9 1.6 7.1L12 17.6l-6.4 3.7 1.6-7.1L1.8 9.3 9 8.6z"/></svg>',
  check: '<svg viewBox="0 0 24 24"><path d="m9.5 16.2-4.2-4.2-2.1 2.1 6.3 6.3L21 9l-2.1-2.1z"/></svg>',
  sound: '<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9zm13.5 3A4.5 4.5 0 0 0 14 8v8a4.5 4.5 0 0 0 2.5-4zM14 3.2v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6z"/></svg>',
};
const gemIcon = '<i class="gemi"></i>';

// ------------------------------------------------------------ DOM
const $ = (s, el = document) => el.querySelector(s);
const ui = $('#ui');
const canvas = $('#gl');
const R = new Renderer(canvas);
R.setShadows(save.shadows);
Audio.setEnabled(save.sound);

function html(strings, ...vals) { return strings.reduce((a, s, i) => a + s + (i < vals.length ? vals[i] : ''), ''); }
function screen(cls, content) {
  ui.innerHTML = `<div class="screen ${cls}">${content}</div>`;
  ui.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); Audio.unlock(); Audio.click(); actions[b.dataset.act]?.(b.dataset, b); }));
  return ui.firstElementChild;
}
const fmt = (t) => { if (t == null) return '--:--.--'; const m = Math.floor(t / 60), s = t - m * 60; return `${m}:${s.toFixed(2).padStart(5, '0')}`; };
const ord = (n) => n + (['th', 'st', 'nd', 'rd'][(n % 100 > 10 && n % 100 < 14) ? 0 : n % 10] || 'th');
const topbar = () => html`<div class="topbar"><div class="pill" id="dpill">${gemIcon}<b id="dcount">${save.diamonds}</b></div><div class="pill"><span class="ico gold">${I.trophy}</span><b>${save.trophies}</b></div></div>`;
const navbar = (active) => html`<nav class="nav">${[['race', 'Race', I.trophy], ['worlds', 'Worlds', I.worlds], ['shop', 'Shop', I.shop], ['settings', 'Settings', I.settings]].map(([k, n, ic]) => `<button class="${active === k ? 'on' : ''}" data-act="tab" data-tab="${k}"><span class="ico">${ic}</span><span>${n}</span></button>`).join('')}</nav>`;

// ------------------------------------------------------------ progress helpers
const lvlSave = (l) => save.levels[l.id] || null;
const worldDone = (w) => WORLDS[w].levels.filter((l) => lvlSave(l)?.time != null).length;
const totalStars = () => Object.values(save.levels).reduce((a, v) => a + (v?.stars || 0), 0);
const starsNeeded = (w) => Math.max(0, (WORLDS[w].starsReq || 0) - totalStars());
const worldUnlocked = (w) => save.unlockAll || !!testRun || w === 0 || (worldDone(w - 1) >= 5 && starsNeeded(w) === 0);
let testRun = null;   // active automated test session (see startTest)
const levelUnlocked = (l) => save.unlockAll || l.index === 0 || lvlSave(WORLDS[l.world].levels[l.index - 1])?.time != null;
const par = (l) => Math.ceil((PARS[l.id] ?? 10) * 1.25 * 2) / 2;
const totalDone = () => WORLDS.reduce((a, _, i) => a + worldDone(i), 0);

// ------------------------------------------------------------ game session
let game = null;   // active play session
const keys = { left: false, right: false };
let touchL = false, touchR = false;
const throttleInput = () => { const r = keys.right || touchR, l = keys.left || touchL; return r && !l ? 1 : l && !r ? -1 : 0; };

const RIVALS = [
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
const laneZ = (i) => ((laneCount() - 1) / 2 - i) * LANE_W;   // lane 0 (player) is nearest the camera

function aiSpec(id) {
  const base = VEHICLES[0], v = vehicleById(id);
  return { ...base, look: v.look, crane: null, blade: false };
}

function startLevel(level, race = null) {
  const spec = vehicleById(save.car);
  const theme = WORLDS[level.world].theme;
  R.buildLevel(level, theme, race ? { lanes: laneCount(), laneW: LANE_W } : {});
  const z0 = race ? laneZ(0) : 0;
  const me = makeRacer(level, spec, { stuckLimit: 5 });
  const sim = me.sim;
  const lane = R.attachSim(sim, { z: z0 });
  const player = R.addCar(sim, spec, race ? { label: 'You', color: '#ffe14d', z: z0 } : {});
  R.focusZ = z0;
  game = { level, spec, sim, me, lane, player, z: z0, race, racers: [], acc: 0, over: false, failT: 0, countdown: race ? 3.0 : 0, autoBot: makeBot(1, 11) };
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
  R.snapCam = true;
  hud();
  Audio.engineStart();
}

function hud() {
  const g = game, l = g.level, w = WORLDS[l.world];
  const el = screen('hud', html`
    <div class="hud-top">
      <div class="hudl"><button class="btn sq blue" data-act="pause">${I.pause}</button><button class="autochip ${save.autoplay || testRun ? 'on' : ''}" data-act="autoplay">AUTO</button></div>
      <div class="hud-mid">
        <div class="lvname">${g.race ? (g.race.random ? `Random · ${l.name}` : `${g.race.cup.name} · Race ${g.race.idx + 1}/3`) : `${w.name} ${l.index + 1}. ${l.name}`}</div>
        <div class="timer" id="timer">0:00.00</div>
      </div>
      ${g.race ? '<div class="pos" id="pos">1st</div>' : `<div class="pill small">${gemIcon}<b id="gcount">0/${g.sim.gems.length}</b></div>`}
    </div>
    ${g.race ? '<div class="track"><div class="trackbar" id="trackbar"></div></div>' : ''}
    ${testRun ? `<div class="testbar"><b>TEST</b><span>${testRun.i + 1}/${testRun.queue.length}</span><span class="ok">✓ ${testRun.pass}</span><span class="bad">✗ ${testRun.fails.length}</span><button data-act="testStop">Stop</button></div>` : ''}
    <div class="ctrl left" id="cl">${I.left}</div>
    <div class="ctrl right" id="cr">${I.right}</div>
    ${g.race ? '<div class="lights" id="lights"><i></i><i></i><i></i></div><div class="count" id="count"></div>' : `<div class="banner" id="banner">${l.index + 1}. ${l.name}</div>`}
  `);
  const bind = (id, set) => {
    const b = $(id, el);
    const on = (e) => { e.preventDefault(); Audio.unlock(); set(true); b.classList.add('down'); };
    const off = (e) => { e.preventDefault(); set(false); b.classList.remove('down'); };
    b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off); b.addEventListener('pointercancel', off); b.addEventListener('pointerleave', off);
  };
  bind('#cl', (v) => { touchL = v; });
  bind('#cr', (v) => { touchR = v; });
  if (g.race) {
    const tb = $('#trackbar', el);
    tb.innerHTML = [{ name: 'You', color: '#ffe14d' }, ...g.racers].map((r, i) => `<span class="dot" data-i="${i}" style="background:${r.color}"></span>`).join('');
  }
}

function tick(dt) {
  const g = game;
  if (!g || g.paused) return;
  if (g.countdown > 0) {
    const before = Math.ceil(g.countdown);
    g.countdown -= dt;
    const after = Math.ceil(g.countdown);
    const c = $('#count');
    if (c && (before !== after || !c.textContent)) {
      c.textContent = after > 0 ? after : 'GO!';
      c.classList.remove('popk'); void c.offsetWidth; c.classList.add('popk');
      const bulbs = document.querySelectorAll('#lights i');
      bulbs.forEach((b, i) => { b.className = after <= 0 ? 'go' : i < 3 - after + 1 ? 'on' : ''; });
      Audio.countdown(after <= 0);
    }
    if (g.countdown <= 0) setTimeout(() => { const c2 = $('#count'); if (c2) c2.textContent = ''; $('#lights')?.classList.add('out'); }, 700);
    return;
  }
  g.acc += Math.min(dt, 0.1);
  const t = save.autoplay || testRun ? g.autoBot(g.sim) : throttleInput();
  while (g.acc >= DT) {
    g.acc -= DT;
    g.sim.step(t);
    for (const e of g.sim.drainEvents()) fx(e, g.sim, g.z, g.player);
    if (g.race && racerWatch(g.me) === 'respawn') Audio.boost();
    for (const r of g.racers) {
      const rs = r.r.sim;
      if (r.finish != null) { rs.step(0); rs.drainEvents(); continue; }
      rs.step(r.bot(rs));
      for (const e of rs.drainEvents()) {
        if (e.type === 'win') r.finish = rs.finishTime;
        else if (e.type === 'land') r.car.squash = Math.min(1, e.v);
        else if (e.type === 'recover') R.carRecover(r.car, e);
        else if (e.type === 'wheelOff') { const q = rs.wheels[e.idx].getPosition(); R.burst(q.x, q.y, 0x55565e, 6, 3, -8, 0.5, r.z); }
        else if (e.type === 'bonk' && Math.random() < 0.3) R.burst(rs.x, rs.chassis.getPosition().y + 0.5, 0xffffff, 5, 3, -6, 0.4, r.z);
      }
      racerWatch(r.r);
      if (rs.time > 120 && r.finish == null) r.finish = Infinity;
    }
  }
  // engine sound
  const av = Math.abs(g.sim.wheels[0].getAngularVelocity());
  Audio.engineSet(av, t !== 0 && g.sim.state === 'run');
  // HUD
  const tm = $('#timer'); if (tm) tm.textContent = fmt(g.sim.state === 'win' ? g.sim.finishTime : g.sim.time);
  const gc = $('#gcount'); if (gc) gc.textContent = `${g.sim.gemsTaken}/${g.sim.gems.length}`;
  if (g.race) {
    const all = [{ x: g.sim.x, fin: g.sim.state === 'win' ? g.sim.finishTime : null, me: true }, ...g.racers.map((r) => ({ x: r.r.sim.x, fin: r.finish }))];
    const me = all[0];
    const ahead = all.filter((o) => o !== me && ((o.fin != null && (me.fin == null || o.fin < me.fin)) || (o.fin == null && me.fin == null && o.x > me.x))).length;
    const pe = $('#pos'); if (pe) { const txt = ord(ahead + 1); if (pe.dataset.v !== txt) { pe.dataset.v = txt; pe.innerHTML = `${txt}<small>/${all.length}</small>`; pe.classList.remove('popk'); void pe.offsetWidth; pe.classList.add('popk'); } }
    const finishX = g.sim.finishX || 1, sx = g.level.start?.x || 0;
    document.querySelectorAll('#trackbar .dot').forEach((d) => { const o = all[+d.dataset.i]; const p = o.fin != null ? 1 : Math.max(0, Math.min(1, (o.x - sx) / (finishX - sx))); d.style.left = `${p * 100}%`; });
  }
  const st = g.sim.state;
  if (testRun && !g.over) {
    // test mode: record the result and move on without touching save data
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
    if (g.race) {
      g.winT = (g.winT || 0) + dt;
      // wait a moment, then fast-forward the rivals
      if (g.winT > 1.4) { g.over = true; finishRace(); }
    } else { g.winT = (g.winT || 0) + dt; if (g.winT > 1.1) { g.over = true; onWin(); } }
  }
}

function fx(e, sim, z = 0, car = null) {
  const p = sim.chassis.getPosition();
  switch (e.type) {
    case 'gem': R.burst(e.gem.piece.x, e.gem.piece.y, 0xffd21a, 12, 4, -6, 0.6, z); R.popText('+1', e.gem.piece.x, e.gem.piece.y + 0.8, z); Audio.gem(); break;
    case 'land':
      R.burst(p.x, p.y - 0.9, 0xf3e2d2, 8 + Math.min(10, e.v * 6), 2.5 + e.v, -4, 0.5, z); Audio.land(e.v);
      if (car) car.squash = Math.min(1, 0.4 + e.v * 0.5);
      if (e.v > 1) R.shake = 0.2;
      if (e.v > 1.3) R.popText(e.v > 2 ? 'HUGE AIR!' : 'Nice air!', p.x, p.y + 2.6, z, '#7df9ff');
      break;
    case 'pad': case 'boost': R.burst(p.x, p.y - 0.6, 0x5ff0ff, 18, 6, -3, 0.7, z); R.punch = 1; Audio.boost(); break;
    case 'bonk':
      if ((game.bonkT || 0) < performance.now()) {
        game.bonkT = performance.now() + 450;
        R.burst(p.x + 1, p.y + 0.6, 0xffffff, 6, 3, -6, 0.4, z); Audio.land(0.3);
        if (e.style === 'metal' || e.style === 'stone') { R.popText(e.style === 'metal' ? 'BONK!' : 'THUD!', p.x, p.y + 2.6, z, '#ff6b74'); R.shake = 0.25; }
      }
      break;
    case 'dunk':
      // photo at the moment the truck hits the water, before it sinks
      if (!game.race && !game.snap) { game.snap = R.snapshotCar(sim, z, 'splash'); R.burst(p.x, p.y, 0xffffff, 24, 6, -10, 0.9, z); }
      break;
    case 'wheelOff': { const q = sim.wheels[e.idx].getPosition(); R.burst(q.x, q.y, 0x55565e, 8, 4, -8, 0.6, z); R.popText('Wheel off!', q.x, q.y + 1.6, z, '#ffffff'); Audio.land(0.6); break; }
    case 'recover': if (car) { R.carRecover(car, e); R.popText('Flip!', e.to.x, e.to.y + 2.6, z, '#ffffff'); } break;
    case 'win':
      for (const c of [0xffffff, 0xff3d6b, 0x2f7cf6, 0xffd21a]) R.burst(p.x + 1, p.y + 2, c, 14, 7, -5, 1.2, z);
      if (car) car.hop = 1.2;
      Audio.win(); break;
    case 'fail':
      if (e.reason === 'splash') { R.burst(p.x, (sim.level.water ?? -3) + 0.2, 0xffffff, 30, 7, -10, 1, z); Audio.splash(); }
      else { R.burst(p.x, p.y, 0x9a9eab, 18, 5, -8, 0.8, z); Audio.crash(); R.shake = 0.35; }
      if (!game.race) setTimeout(() => { if (game && !game.snap) game.snap = R.snapshotCar(sim, z); }, 420);
      else R.popText(e.reason === 'splash' ? 'SPLASH!' : 'OOPS!', p.x, p.y + 2.4, z, '#ffffff');
      break;
    default: break;
  }
}

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
const STICKERS = {
  roof: 'stars', nose: 'bang', backflip: 'spin', crash: 'bang',
  splash: 'bubbles', splashSpin: 'bubbles', splashRoof: 'bubbles', splashShort: 'bubbles', lost: 'bang',
};
const stickerHtml = (kind) => ({
  stars: '<div class="stk stars"><i>' + I.star + '</i><i>' + I.star + '</i><i>' + I.star + '</i></div><div class="stk zz">z<span>z</span><span>z</span></div>',
  bang: '<div class="stk bang">BONK!</div><div class="stk lines"><i></i><i></i><i></i></div>',
  spin: '<div class="stk spin">360°?</div><div class="stk lines"><i></i><i></i><i></i></div>',
  bubbles: '<div class="stk bubbles"><i></i><i></i><i></i><i></i><i></i></div><div class="stk fish">&lt;°)))&gt;&lt;</div>',
})[kind] || '';

function onFail() {
  Audio.engineStop(); Audio.fail();
  const g = game, l = g.level;
  const snap = g.snap || R.snapshotCar(g.sim, g.z);
  const pose = g.sim.failPose || g.sim.reason || 'crash';
  const q = QUIPS[pose] || QUIPS.crash;
  const tilt = (Math.random() * 10 - 5).toFixed(1);
  screen('fail', html`
    <div class="polaroid" style="--tilt:${tilt}deg">
      <div class="photo" style="background-image:url(${snap})">${stickerHtml(STICKERS[pose])}<div class="stamp">OOPS!</div></div>
      <div class="caption">${q[(Math.random() * q.length) | 0]}</div>
    </div>
    <div class="barbtns">
      <button class="btn gray" data-act="home"><span class="ico">${I.home}</span><span>Home</span></button>
      <button class="btn blue big" data-act="retry"><span class="ico">${I.retry}</span><span>Retry</span></button>
      <button class="btn gray" data-act="levels" data-w="${l.world}"><span class="ico">${I.levels}</span><span>Levels</span></button>
    </div>`);
}

function onWin() {
  Audio.engineStop();
  const g = game, l = g.level, sim = g.sim;
  const t = sim.finishTime;
  const prev = lvlSave(l);
  const allGems = sim.gemsTaken >= sim.gems.length;
  const stars = 1 + (allGems ? 1 : 0) + (t <= par(l) ? 1 : 0);
  let earn = sim.gemsTaken * 5;
  if (!prev || prev.time == null) earn += 20;
  if (stars === 3 && (!prev || (prev.stars || 0) < 3)) earn += 30;
  const best = prev?.time != null ? Math.min(prev.time, t) : t;
  save.levels[l.id] = { time: best, stars: Math.max(stars, prev?.stars || 0) };
  const newBest = !prev || prev.time == null || t < prev.time;
  persist();
  const next = WORLDS[l.world].levels[l.index + 1];
  const el = screen('win', html`
    <div class="panel winp">
      <div class="ribbon">Level Complete!</div>
      <div class="stars">${[0, 1, 2].map((i) => `<span class="star ${i < stars ? 'got' : ''}" style="animation-delay:${0.25 + i * 0.25}s">${I.star}</span>`).join('')}</div>
      <div class="rows">
        <div class="row"><span>Time</span><b>${fmt(t)}</b></div>
        <div class="row"><span>Best</span><b>${fmt(best)} ${newBest ? '<em class="new">NEW!</em>' : ''}</b></div>
        <div class="row"><span>Gems</span><b>${sim.gemsTaken}/${sim.gems.length}</b></div>
        <div class="row hint"><span>${I.star} finish · ${I.star} all gems · ${I.star} under ${fmt(par(l))}</span></div>
      </div>
      <div class="earn">+<b id="earn">0</b> ${gemIcon}</div>
    </div>
    <div class="barbtns">
      <button class="btn gray" data-act="home"><span class="ico">${I.home}</span><span>Home</span></button>
      <button class="btn gray" data-act="retry"><span class="ico">${I.retry}</span><span>Retry</span></button>
      ${next ? `<button class="btn blue big" data-act="next"><span class="ico">${I.next}</span><span>Next</span></button>` : `<button class="btn blue big" data-act="levels" data-w="${l.world}"><span class="ico">${I.levels}</span><span>Levels</span></button>`}
    </div>`);
  [0, 1, 2].forEach((i) => { if (i < stars) setTimeout(() => Audio.star(i), 300 + i * 250); });
  countUp($('#earn', el), earn, 1000);
  if (save.autoplay && next) setTimeout(() => { if (ui.firstElementChild?.classList.contains('win') && game?.level === l) actions.next(); }, 2600);
  save.diamonds += earn; persist();
}

function countUp(el, n, delay = 0) {
  if (!el) return;
  let v = 0; const steps = Math.min(30, n);
  setTimeout(() => {
    const iv = setInterval(() => { v = Math.min(n, v + Math.ceil(n / steps)); el.textContent = v; Audio.coin(v); if (v >= n) clearInterval(iv); }, 35);
  }, delay);
  if (n === 0) el.textContent = '0';
}

// ------------------------------------------------------------ race flow
function finishRace() {
  Audio.engineStop();
  const g = game;
  // fast-forward rivals still driving (max 60s sim)
  for (const r of g.racers) {
    let n = 0;
    while (r.finish == null && n < 60 * 60) {
      r.r.sim.step(r.bot(r.r.sim)); n++;
      for (const e of r.r.sim.drainEvents()) if (e.type === 'win') r.finish = r.r.sim.finishTime;
      racerWatch(r.r);
    }
    if (r.finish == null) r.finish = Infinity;
  }
  const rows = [{ name: 'You', car: save.car, color: '#ffe14d', time: g.sim.finishTime, me: true }, ...g.racers.map((r) => ({ name: r.name, car: r.car, color: r.color, time: r.finish }))]
    .sort((a, b) => a.time - b.time);
  const race = g.race;
  const pts = race.random ? {} : save.cup.pts || {};
  rows.forEach((r, i) => { r.pts = rows.length - i; pts[r.name] = (pts[r.name] || 0) + r.pts; });
  if (!race.random) save.cup.pts = pts;
  const myPlace = rows.findIndex((r) => r.me);
  const earn = Math.round(PLACE_GEMS[myPlace] * race.cup.reward) + g.sim.gemsTaken * 5;
  save.diamonds += earn;
  if (!race.random) save.cup.race = race.idx + 1;
  persist();
  if (myPlace === 0) Audio.win(); else Audio.star(0);
  const el = screen('results', html`
    ${topbar()}
    <div class="panel resp">
      <div class="ribbon">Race Results</div>
      <div class="table">
        <div class="thead"><span>Place</span><span>Name</span><span>Time</span><span>Pts</span></div>
        ${rows.map((r, i) => `<div class="trow p${i + 1} ${r.me ? 'me' : ''}" style="animation-delay:${0.15 + i * 0.12}s"><span class="medal">${i + 1}</span><span class="nm">${r.name}</span><span>${r.time === Infinity ? 'DNF' : fmt(r.time)}</span><span class="pt">${r.pts}</span></div>`).join('')}
      </div>
      <div class="earn">+<b id="earn">0</b> ${gemIcon}</div>
    </div>
    <div class="barbtns">
      <button class="btn gray" data-act="home"><span class="ico">${I.home}</span><span>Home</span></button>
      <button class="btn blue big" data-act="raceNext"><span class="ico">${I.next}</span><span>${race.random ? 'Another one' : race.idx < 2 ? 'Next race' : 'Standings'}</span></button>
    </div>`);
  confetti(el);
  countUp($('#earn', el), earn, 700);
  setTimeout(() => flyGems(earn, $('#earn', el)), 700);
}

function flyGems(n, from) {
  const target = $('#dcount'); if (!from || !target) return;
  const a = from.getBoundingClientRect(), b = target.getBoundingClientRect();
  const k = Math.min(12, Math.max(3, Math.round(n / 15)));
  for (let i = 0; i < k; i++) {
    const d = document.createElement('i'); d.className = 'gemi fly';
    d.style.left = `${a.left + (Math.random() - 0.5) * 60}px`; d.style.top = `${a.top + (Math.random() - 0.5) * 30}px`;
    d.style.setProperty('--dx', `${b.left - a.left}px`); d.style.setProperty('--dy', `${b.top - a.top}px`);
    d.style.animationDelay = `${i * 0.06}s`;
    document.body.appendChild(d);
    setTimeout(() => d.remove(), 1400 + i * 60);
  }
  setTimeout(() => { target.textContent = save.diamonds; target.parentElement.classList.add('bump'); setTimeout(() => target.parentElement?.classList.remove('bump'), 300); }, 1100);
}

function confetti(el) {
  const colors = ['#ff3d6b', '#ffd21a', '#2f7cf6', '#46d35c', '#ffffff', '#ff8a1f'];
  for (let i = 0; i < 60; i++) {
    const c = document.createElement('i'); c.className = 'confetti';
    c.style.left = `${Math.random() * 100}%`; c.style.background = colors[i % colors.length];
    c.style.animationDelay = `${Math.random() * 0.8}s`; c.style.animationDuration = `${1.8 + Math.random() * 1.6}s`;
    c.style.setProperty('--rx', `${(Math.random() - 0.5) * 200}px`);
    el.appendChild(c);
  }
}

function cupStandings() {
  const cupIdx = save.cup.idx, cup = CUPS[cupIdx];
  const pts = save.cup.pts || {};
  const rows = Object.entries(pts).map(([name, p]) => ({ name, p })).sort((a, b) => b.p - a.p);
  const me = rows.findIndex((r) => r.name === 'You');
  const won = me === 0;
  if (won && !save.cups[cupIdx]) { save.cups[cupIdx] = true; save.trophies++; save.diamonds += 250; }
  save.cup = { idx: won && cupIdx < CUPS.length - 1 ? cupIdx + 1 : cupIdx, race: 0, pts: null };
  persist();
  if (won) Audio.win(); else Audio.fail();
  const el = screen('results', html`
    ${topbar()}
    <div class="panel resp">
      <div class="ribbon" style="background:${cup.color}">${cup.name} ${won ? 'Won!' : 'Final'}</div>
      <div class="cupbig ${won ? 'won' : ''}" style="--c:${cup.color}">${I.trophy}</div>
      <div class="table">${rows.map((r, i) => `<div class="trow p${i + 1} ${r.name === 'You' ? 'me' : ''}" style="animation-delay:${0.15 + i * 0.12}s"><span class="medal">${i + 1}</span><span class="nm">${r.name}</span><span></span><span class="pt">${r.p}</span></div>`).join('')}</div>
      <div class="sub">${won ? '+250 bonus gems! Next cup unlocked.' : 'Finish 1st overall to win the cup. Try again!'}</div>
    </div>
    <div class="barbtns"><button class="btn blue big" data-act="tab" data-tab="race"><span class="ico">${I.trophy}</span><span>Continue</span></button></div>`);
  if (won) confetti(el);
}

// ------------------------------------------------------------ test mode
function testMenu() {
  const ov = document.createElement('div'); ov.className = 'overlay';
  const w = WORLDS[save.world];
  ov.innerHTML = html`<div class="panel testp"><div class="ribbon" style="background:#46d35c">Test mode</div>
    <div class="sub">The bot drives. Results are not saved.</div>
    <button class="btn blue wide" data-t="tour"><span>Tour: level 1 of all ${WORLDS.length} worlds</span></button>
    <button class="btn blue wide" data-t="random"><span>20 random levels (any world)</span></button>
    <button class="btn blue wide" data-t="world"><span>All ${w.levels.length} levels of ${w.name}</span></button>
    <button class="btn orange wide" data-t="races"><span>10 random races (3–6 lanes)</span></button>
    <button class="btn gray wide" data-t="close"><span>Close</span></button></div>`;
  ov.addEventListener('click', (e) => {
    const b = e.target.closest('[data-t]'); if (!b) return;
    Audio.unlock(); Audio.click(); ov.remove();
    if (b.dataset.t !== 'close') startTest(b.dataset.t);
  });
  ui.appendChild(ov);
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
    const n = item.lanes - 1, prevLanes = save.lanes; save.lanes = item.lanes;
    const rivals = Array.from({ length: n }, (_, i) => ({ ...RIVALS[i % RIVALS.length], skill: 0.7 + Math.random() * 0.3 }));
    startLevel(item.level, { cup: { name: 'Test', reward: 0, color: '#46d35c' }, idx: 0, rivals, random: true });
    save.lanes = prevLanes;
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
  const done = t.pass + t.fails.length;
  screen('results', html`
    <div class="panel resp testsum">
      <div class="ribbon" style="background:${t.fails.length ? '#ff5a6e' : '#46d35c'}">Test ${stopped ? 'stopped' : 'finished'}</div>
      <div class="rows">
        <div class="row"><span>Run</span><b>${done} / ${t.queue.length}</b></div>
        <div class="row"><span>Passed</span><b>${t.pass}</b></div>
        <div class="row"><span>Failed</span><b>${t.fails.length}</b></div>
      </div>
      <div class="testlog">${t.fails.length ? t.fails.map((f) => `<div class="bad">✗ ${f}</div>`).join('') : '<div class="ok">Every run reached the finish.</div>'}${t.times.map((f) => `<div class="ok">✓ ${f}</div>`).join('')}</div>
    </div>
    <div class="barbtns">
      <button class="btn gray" data-act="home"><span class="ico">${I.home}</span><span>Home</span></button>
      <button class="btn blue big" data-act="testStart" data-mode="${t.mode}"><span class="ico">${I.retry}</span><span>Run again</span></button>
    </div>`);
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
  // stable rival set per cup
  const rivals = Array.from({ length: laneCount() - 1 }, (_, i) => ({ ...RIVALS[(cupIdx + i) % RIVALS.length], skill: cup.skill[i] }));
  rivals.forEach((r) => { if (save.cup.pts[r.name] == null) save.cup.pts[r.name] = 0; });
  persist();
  const level = RACE_TRACKS[cup.races[idx]];
  startLevel(level, { cup, cupIdx, idx, rivals });
}

// ------------------------------------------------------------ menu screens
let thumbs = {};
const thumb = (v) => (thumbs[v.id] ||= R.thumbnail(v));

function showWorlds() {
  game = null; Audio.engineStop();
  const wi = save.world, w = WORLDS[wi];
  R.showDiorama(w, vehicleById(save.car));
  const unlocked = worldUnlocked(wi), done = worldDone(wi);
  document.body.style.setProperty('--theme', w.theme.ui);
  screen('home', html`
    ${topbar()}
    <div class="logo"><span>CRANE</span><span class="r">RUSH</span></div>
    <div class="wtitle">${unlocked ? '' : `<span class="wlock">${I.lock}</span>`}${w.name}</div>
    <div class="prog"><span class="flagi">${I.flag}</span><div class="bar"><i style="width:${(done / w.levels.length) * 100}%"></i></div><b>${done}/${w.levels.length}</b></div>
    <button class="arrow l" data-act="world" data-d="-1" ${wi === 0 ? 'disabled' : ''}>${I.left}</button>
    <button class="arrow r" data-act="world" data-d="1" ${wi === WORLDS.length - 1 ? 'disabled' : ''}>${I.right}</button>
    <div class="wsub">${w.sub}</div>
    <div class="wcount">${wi + 1} / ${WORLDS.length}${w.starsReq ? ` · ${I.star} ${w.starsReq}` : ''}</div>
    <div class="topleft"><button class="autochip ${save.autoplay ? 'on' : ''}" data-act="autoplay">AUTO</button><button class="testbtn" data-act="testMenu">TEST</button></div>
    ${unlocked ? `<button class="btn blue play" data-act="levels" data-w="${wi}"><span class="ico">${I.play}</span><span>Play</span></button>`
      : `<button class="btn gray play locked" disabled><span class="ico">${I.lock}</span><span>${worldDone(wi - 1) < 5 ? `Clear 5 in ${WORLDS[wi - 1].name}` : `Need ${starsNeeded(wi)} more stars`}</span></button>`}
    ${navbar('worlds')}`);
  swipe((d) => actions.world({ d }));
}

function swipe(cb) {
  let sx = null;
  const el = ui.firstElementChild;
  el.addEventListener('pointerdown', (e) => { sx = e.clientX; });
  el.addEventListener('pointerup', (e) => { if (sx != null && Math.abs(e.clientX - sx) > 60) cb(e.clientX < sx ? 1 : -1); sx = null; });
}

function showLevels(wi) {
  game = null; Audio.engineStop();
  const w = WORLDS[wi];
  if (R.mode !== 'menu') R.showDiorama(w, vehicleById(save.car));
  const firstOpen = w.levels.findIndex((l) => lvlSave(l)?.time == null);
  const el = screen('levels', html`
    <div class="lvtitle"><button class="btn sq gray" data-act="tab" data-tab="worlds">${I.left}</button><span>${w.name}</span><button class="autochip ${save.autoplay ? 'on' : ''}" data-act="autoplay">AUTO</button><span class="pill small">${I.star}<b>${w.levels.reduce((a, l) => a + (lvlSave(l)?.stars || 0), 0)}/${w.levels.length * 3}</b></span></div>
    <div class="list">${w.levels.map((l, i) => {
    const sv = lvlSave(l), open = levelUnlocked(l), cur = i === firstOpen;
    return `<button class="lv ${open ? '' : 'lock'} ${cur ? 'cur' : ''}" ${open ? `data-act="play" data-w="${wi}" data-l="${i}"` : 'disabled'} style="animation-delay:${i * 0.035}s">
        <span class="lvic">${!open ? I.lock : sv?.time != null ? I.flag : I.play}</span>
        <span class="lvn">${i + 1}. ${l.name}</span>
        <span class="lvs">${[0, 1, 2].map((k) => `<i class="${k < (sv?.stars || 0) ? 'on' : ''}">${I.star}</i>`).join('')}</span>
        <span class="lvt">${fmt(sv?.time)}</span></button>`;
  }).join('')}</div>`);
  const cur = $('.lv.cur', el); if (cur) setTimeout(() => cur.scrollIntoView({ block: 'center' }), 50);
}

function showRace() {
  game = null; Audio.engineStop();
  const cupIdx = save.cup.idx, cup = CUPS[cupIdx];
  R.showDiorama(WORLDS[cup.world], vehicleById(save.car), 2.6);
  const raceNo = save.cup.race || 0;
  const pts = save.cup.pts || {};
  screen('race', html`
    ${topbar()}
    <div class="cups">${CUPS.map((c, i) => `<div class="cup ${save.cups[i] ? 'won' : ''} ${i === cupIdx ? 'cur' : ''} ${i > cupIdx && !save.cups[i] ? 'lock' : ''}" style="--c:${c.color}"><span class="ico">${i > cupIdx && !save.cups[i] ? I.lock : I.trophy}</span><span>${c.name}</span></div>`).join('')}</div>
    <div class="panel racep">
      <div class="ribbon" style="background:${cup.color}">${cup.name}</div>
      <div class="sub">Race ${raceNo + 1} of 3 · ${RACE_TRACKS[cup.races[raceNo]].name}</div>
      <div class="lanesel"><span>Lanes</span>${[3, 4, 5, 6].map((n) => `<button class="${laneCount() === n ? 'on' : ''}" data-act="lanes" data-n="${n}">${n}</button>`).join('')}</div>
      <div class="standings">${Object.keys(pts).length ? Object.entries(pts).sort((a, b) => b[1] - a[1]).map(([n, p], i) => `<div class="st ${n === 'You' ? 'me' : ''}"><span>${i + 1}</span><span>${n}</span><b>${p} pts</b></div>`).join('') : `<div class="sub">Beat ${laneCount() - 1} rival trucks over 3 races.<br>1st place wins the cup!</div>`}</div>
    </div>
    <button class="btn red race" data-act="race"><span>Race!</span><span class="ico">${I.flag}</span></button>
    <button class="btn orange rnd" data-act="randomRace"><span class="ico">${I.retry}</span><span>Random track</span></button>
    ${navbar('race')}`);
}

function showShop(sel) {
  game = null; Audio.engineStop();
  const cur = vehicleById(sel || save.car);
  R.showGarage(cur);
  const stat = (v, k, lo, hi) => Math.round(((v[k] - lo) / (hi - lo)) * 100);
  screen('shop', html`
    ${topbar()}
    <div class="shopinfo">
      <div class="sname">${cur.name}</div>
      <div class="sdesc">${cur.desc}</div>
      <div class="stats">
        ${[['Speed', stat(cur, 'speed', 16, 28)], ['Power', stat(cur, 'torque', 20, 44)], ['Grip', stat(cur, 'grip', 1.2, 2.1)], ['Air', stat(cur, 'air', 5, 11.5)]].map(([n, p]) => `<div class="stat"><span>${n}</span><div class="bar"><i style="width:${Math.max(8, Math.min(100, p))}%"></i></div></div>`).join('')}
      </div>
    </div>
    <div class="cards">${VEHICLES.map((v) => {
    const own = save.owned.includes(v.id), on = save.car === v.id;
    return `<button class="card ${v.id === cur.id ? 'sel' : ''} ${on ? 'using' : ''}" data-act="shopSel" data-id="${v.id}"><img src="${thumb(v)}" alt=""><span class="cn">${v.name}</span>${on ? `<span class="tag ok">${I.check}</span>` : own ? '' : `<span class="tag price">${gemIcon}${v.price}</span>`}</button>`;
  }).join('')}</div>
    <div class="shopbtn">${save.car === cur.id ? '<button class="btn gray" disabled>Selected</button>'
      : save.owned.includes(cur.id) ? `<button class="btn blue" data-act="use" data-id="${cur.id}">Use truck</button>`
        : `<button class="btn ${save.diamonds >= cur.price ? 'orange' : 'gray'}" data-act="buy" data-id="${cur.id}">Buy ${gemIcon} ${cur.price}</button>`}</div>
    ${navbar('shop')}`);
  const s = $('.card.sel'); if (s) s.scrollIntoView({ inline: 'center', block: 'nearest' });
}

function showSettings() {
  game = null; Audio.engineStop();
  if (R.mode !== 'menu') R.showDiorama(WORLDS[save.world], vehicleById(save.car));
  screen('settings', html`
    ${topbar()}
    <div class="panel setp">
      <div class="ribbon">Settings</div>
      <button class="toggle ${save.sound ? 'on' : ''}" data-act="sound"><span class="ico">${I.sound}</span><span>Sound</span><i></i></button>
      <button class="toggle ${save.shadows ? 'on' : ''}" data-act="shadows"><span class="ico">${I.settings}</span><span>Shadows (quality)</span><i></i></button>
      <div class="setlbl">Test tools</div>
      <button class="toggle ${save.autoplay ? 'on' : ''}" data-act="autoplay"><span class="ico">${I.play}</span><span>Autoplay (bot drives)</span><i></i></button>
      <button class="toggle ${save.unlockAll ? 'on' : ''}" data-act="unlockAll"><span class="ico">${I.lock}</span><span>Unlock all levels</span><i></i></button>
      <button class="btn gray wide" data-act="reset">Reset progress</button>
      <div class="sub">Controls: ◀ ▶ on screen, or Arrow keys / A D.<br>In the air, ▶ tilts back and ◀ tilts forward.<br>Levels cleared: ${totalDone()}/${WORLDS.reduce((a, w) => a + w.levels.length, 0)} · Race tracks: ${RACE_TRACKS.length}</div>
    </div>
    ${navbar('settings')}`);
}

function pauseMenu() {
  if (!game) return;
  game.paused = true; Audio.engineStop();
  const l = game.level;
  const ov = document.createElement('div'); ov.className = 'overlay';
  ov.innerHTML = html`<div class="panel pausep"><div class="ribbon">Paused</div>
    <button class="btn blue wide" data-a="resume"><span class="ico">${I.play}</span><span>Resume</span></button>
    <button class="btn gray wide" data-a="retry"><span class="ico">${I.retry}</span><span>Retry</span></button>
    ${game.race ? '' : `<button class="btn gray wide" data-a="levels"><span class="ico">${I.levels}</span><span>Levels</span></button>`}
    <button class="btn gray wide" data-a="home"><span class="ico">${I.home}</span><span>Home</span></button></div>`;
  ov.addEventListener('click', (e) => {
    const b = e.target.closest('[data-a]'); if (!b) return;
    Audio.click(); ov.remove();
    const a = b.dataset.a;
    if (a === 'resume') { game.paused = false; Audio.engineStart(); }
    else if (a === 'retry') actions.retry();
    else if (a === 'levels') showLevels(l.world);
    else actions.home();
  });
  ui.appendChild(ov);
}

const actions = {
  tab: ({ tab }) => ({ race: showRace, worlds: showWorlds, shop: () => showShop(), settings: showSettings })[tab](),
  world: ({ d }) => { const n = Math.max(0, Math.min(WORLDS.length - 1, save.world + +d)); if (n !== save.world) { save.world = n; persist(); showWorlds(); } },
  levels: ({ w }) => showLevels(+w),
  play: ({ w, l }) => startLevel(WORLDS[+w].levels[+l]),
  pause: () => pauseMenu(),
  retry: () => { const g = game; if (!g) return; if (g.race) startLevel(g.level, { ...g.race }); else startLevel(g.level); },
  next: () => { const l = game.level; startLevel(WORLDS[l.world].levels[l.index + 1]); },
  home: () => { if (game?.race) showRace(); else showWorlds(); },
  race: () => startRace(),
  raceNext: () => { if (game?.race?.random) startRandomRace(); else if ((save.cup.race || 0) >= 3) cupStandings(); else showRace(); },
  randomRace: () => startRandomRace(),
  autoplay: (_, btn) => {
    save.autoplay = !save.autoplay; persist();
    const cls = ui.firstElementChild?.classList;
    if (cls?.contains('hud') || cls?.contains('home')) { btn.classList.toggle('on', save.autoplay); return; }
    if (cls?.contains('levels')) showLevels(save.world); else showSettings();
  },
  testMenu: () => testMenu(),
  testStart: ({ mode }) => startTest(mode),
  testStop: () => endTest(true),
  unlockAll: () => { save.unlockAll = !save.unlockAll; persist(); showSettings(); },
  shopSel: ({ id }) => showShop(id),
  lanes: ({ n }) => { save.lanes = +n; persist(); showRace(); },
  buy: ({ id }) => {
    const v = vehicleById(id);
    if (save.diamonds < v.price) { const p = $('#dpill'); p?.classList.add('shake'); setTimeout(() => p?.classList.remove('shake'), 400); Audio.crash(); return; }
    save.diamonds -= v.price; save.owned.push(id); save.car = id; persist(); Audio.win(); showShop(id);
  },
  use: ({ id }) => { save.car = id; persist(); showShop(id); },
  sound: () => { save.sound = !save.sound; Audio.setEnabled(save.sound); persist(); showSettings(); },
  shadows: () => { save.shadows = !save.shadows; R.setShadows(save.shadows); persist(); showSettings(); },
  reset: (_, btn) => {
    if (!btn.classList.contains('confirm')) { btn.classList.add('confirm', 'red'); btn.textContent = 'Tap again to erase everything'; return; }
    save = { ...defaults, levels: {}, cups: {}, owned: ['crane'], cup: { idx: 0, race: 0, pts: null } }; persist(); showWorlds();
  },
};

// ------------------------------------------------------------ input
const KL = ['ArrowLeft', 'KeyA'], KR = ['ArrowRight', 'KeyD'];
window.addEventListener('keydown', (e) => {
  Audio.unlock();
  if (KL.includes(e.code)) keys.left = true;
  if (KR.includes(e.code)) keys.right = true;
  if (game && !game.paused && !game.over) {
    if (e.code === 'KeyR') actions.retry();
    if (e.code === 'Escape' || e.code === 'KeyP') pauseMenu();
  }
});
window.addEventListener('keyup', (e) => { if (KL.includes(e.code)) keys.left = false; if (KR.includes(e.code)) keys.right = false; });
window.addEventListener('blur', () => { keys.left = keys.right = touchL = touchR = false; if (game && !game.over && !game.paused) pauseMenu(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && game && !game.over && !game.paused) pauseMenu(); });

// ------------------------------------------------------------ loop
let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  tick(dt);
  R.alpha = game && !game.paused && game.countdown <= 0 ? Math.min(1, game.acc / DT) : 1;
  R.update(dt, game?.sim, throttleInput());
  requestAnimationFrame(loop);
}

// expose a tiny debug/test hook
window.__crane = { get testRun() { return testRun; }, startTest, worlds: WORLDS, icon: (n) => R.thumbnail(VEHICLES[0], n, n), views: (id) => R.views(vehicleById(id || 'crane')), get game() { return game; }, save: () => save, actions, startLevel: (w, l) => startLevel(WORLDS[w].levels[l]), keys };

document.fonts?.load('700 20px Fredoka').finally(() => { showWorlds(); requestAnimationFrame(loop); $('#boot')?.remove(); });
