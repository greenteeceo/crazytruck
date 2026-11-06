// Seeded procedural levels and race tracks built from proven obstacle segments.
// Every seed that ships is validated by tools/gensel.mjs (bot must finish).
import { B, settle } from './builder.js';
import { WORLD_DEFS } from './worlds.js';

function rng(seed) {
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

const POOLS = {
  classic: ['hill', 'hill', 'stepUp', 'rampDown', 'gap', 'gap', 'bridge', 'bridge', 'seesaw', 'crates', 'logs', 'bigJump', 'rolling', 'rocky', 'valley', 'logPile', 'climb', 'barrels'],
  construction: ['hill', 'stepUp', 'rampDown', 'gap', 'girderGap', 'girderGap', 'crates', 'seesaw', 'bigJump', 'bumps', 'containers', 'containers', 'wreck', 'barrels', 'valley', 'rolling', 'pipes'],
  medieval: ['hill', 'stepUp', 'rampDown', 'gap', 'bridge', 'bridge', 'drawbridge', 'drawbridge', 'seesaw', 'bumps', 'bigJump', 'logs', 'rocky', 'logPile', 'climb', 'valley', 'barrels'],
  science: ['pad', 'pad', 'stepUp', 'rampDown', 'gap', 'crates', 'seesaw', 'pad', 'bumps', 'bigJump', 'containers', 'barrels', 'wreck', 'rolling', 'valley', 'pipes'],
};
const RACE_EXTRA = ['dominoes', 'barrels', 'boulders', 'wall', 'dominoes', 'logPile', 'wall', 'boulders'];

const RACE_WORDS = [['Mega', 'Wild', 'Crazy', 'Turbo', 'Wacky', 'Bumpy', 'Chaos', 'Super', 'Hyper', 'Rowdy', 'Loopy', 'Zany'], ['Derby', 'Rally', 'Rumble', 'Scramble', 'Dash', 'Mayhem', 'Circuit', 'Run', 'Brawl', 'Frenzy']];

function nameFor(words, r) { return `${words[0][(r() * words[0].length) | 0]} ${words[1][(r() * words[1].length) | 0]}`; }

// Build a track from segments. Returns a level object (same shape as hand-made levels).
function build(def, seed, diff, { race = false, length, sea = 0 } = {}) {
  const r = rng(seed);
  const st = def;
  const b = new B(st.ground);
  const zones = [];
  const pick = (a) => a[(r() * a.length) | 0];
  const rr = (a, c) => a + r() * (c - a);
  let x = 6, top = 0;
  const water = -3;
  const ground = (x0, x1, t = top, s = st.ground) => b.ground(x0, x1, t, s, t - water);
  b.ground(-8, x, 0, def.startGround, 3);
  const pool = race ? [...POOLS[def.kind], ...RACE_EXTRA] : POOLS[def.kind];
  const nSeg = length ?? (race ? 9 : 4 + Math.round(diff * 5));
  let last = '';
  for (let i = 0; i < nSeg; i++) {
    let seg = pick(pool);
    if (seg === last) seg = pick(pool);
    last = seg;
    // keep the track inside a sensible height band
    if (seg === 'stepUp' && top > 2.2) seg = 'rampDown';
    if (seg === 'rampDown' && top < 0.6) seg = 'hill';
    if ((seg === 'seesaw' || seg === 'drawbridge') && top < -0.2) seg = 'hill';
    const lead = rr(3, 5);
    ground(x, x + lead); x += lead;
    switch (seg) {
      case 'hill': {
        const L = rr(7, 10), h = rr(0.8, 1.1 + diff * 0.6);
        ground(x, x + L); b.hill(x + 0.5, x + L - 0.5, h, top, def.hill);
        b.gem(x + L / 2, top + h + 1.3); x += L; break;
      }
      case 'bumps': {
        const n = 3 + ((r() * 3) | 0);
        ground(x, x + n * 4 + 2);
        for (let k = 0; k < n; k++) b.block(x + 2 + k * 4, top + 0.22, 2, 0.44, def.bump);
        b.gem(x + 2 + 2 * 4, top + 1.5); x += n * 4 + 2; break;
      }
      case 'stepUp': {
        const n = 2 + ((r() * 3) | 0), dx = 2.6;
        b.steps(x, top, n, dx, 0.42, def.step, top - water);
        b.gem(x + n * dx - 1.3, top + n * 0.42 + 1.3);
        x += n * dx; top += n * 0.42;
        ground(x, x + 3); x += 3; break;
      }
      case 'rampDown': {
        const drop = Math.min(top + 0.2, rr(1.2, 2.4)), L = drop * 3.4 + 2;
        b.ramp(x, top, x + L, top - drop, st.ground, top - drop - 1.5);
        b.gem(x + L / 2, top - drop / 2 + 1.3);
        x += L; top -= drop; break;
      }
      case 'gap': {
        const gap = rr(3.5, 4.5 + diff * 1.5), K = 6;
        ground(x, x + K); b.ramp(x, top, x + K, top + 1.3, st.ground, top - 0.5);
        b.gem(x + K + gap / 2, top + 2.8);
        x += K + gap; ground(x, x + 6); x += 6; break;
      }
      case 'bigJump': {
        const gap = rr(8, 10);
        ground(x, x + 8); b.ramp(x, top, x + 8, top + 2.0, st.ground, top - 0.5);
        const lx = x + 8 + gap;
        b.ramp(lx, top + 1.2, lx + 12, top, st.ground, top - 2);
        b.gems(x + 10, top + 4.2, 3, 2.4);
        zones.push(['air']);
        x = lx + 12; ground(x, x + 4); x += 4; break;
      }
      case 'bridge': {
        const L = rr(10, 14);
        b.bridge(x, top, x + L, top, 'wood');
        b.gem(x + L / 2, top + 0.7);
        zones.push([x - 2, x + L + 1, 9]);
        x += L; ground(x, x + 5); x += 5; break;
      }
      case 'girderGap': {
        const L = rr(9, 12);
        b.block(x + L / 2, top - 0.2, L, 0.4, 'girder');
        b.gem(x + L / 2, top + 1.0);
        x += L; ground(x, x + 4); x += 4; break;
      }
      case 'seesaw': {
        // left ground at top, pivot top+0.3, right ground top-0.8
        const px = x + 4.6;
        b.block(px, top - 1.6 - (top - 0) / 2, 0.8, 3.6 + top, def.pillar);
        b.seesaw(px, top + 0.3, 9.2, 0.2, 0.2, def.plank);
        b.gem(px, top + 2.0);
        zones.push([x - 4, px + 5, 6]);
        x = px + 4.6; top -= 0.8; ground(x, x + 6); x += 6; break;
      }
      case 'drawbridge': {
        // ground already ends at x; hinge a little after it
        const L = rr(9, 11);
        b.p[b.p.length - 1].w -= 0.4; b.p[b.p.length - 1].x -= 0.2;
        b.hinge(x, top - 0.18, L, 1.25, -0.02, 1.3, 'wood');
        b.block(x + L + 0.4, top - 0.5, 0.8, 0.6, 'castle');
        b.gem(x + L / 2, top + 1.0);
        x += L + 0.8; ground(x, x + 5); x += 5; break;
      }
      case 'mover': {
        b.mover(x + 4.5, top - 0.3, 6.5, 0.6, 1.6, 0, rr(2.2, 2.8), def.mover, rr(0, 3));
        b.gem(x + 4.5, top + 1.0);
        x += 9; ground(x, x + 5); x += 5; break;
      }
      case 'pad': {
        b.pad(x - 2, top + 0.02, 2.4, 11, 8);
        const gap = rr(8, 10);
        b.gems(x + 2, top + 3.6, 3, 2.2);
        x += gap; ground(x, x + 6); x += 6; break;
      }
      case 'crates': {
        ground(x, x + 9);
        b.stack(x + 3, top, 3, 2, 0.85, def.crate);
        b.gem(x + 7.5, top + 1.2); x += 9; break;
      }
      case 'logs': {
        ground(x, x + 8);
        b.dyn(x + 3, top + 0.3, 0.6, 0.6, 'log', 0.2).dyn(x + 3.8, top + 0.3, 0.6, 0.6, 'log', 0.2).dyn(x + 3.4, top + 0.9, 0.6, 0.6, 'log', 0.2);
        b.gem(x + 6.5, top + 1.2); x += 8; break;
      }
      // ---- road shapes
      case 'rolling': {   // a wavy road: several smooth humps in a row
        const n = 3 + ((r() * 2) | 0), L = rr(5, 6.5), h = rr(0.45, 0.7 + diff * 0.3);
        ground(x, x + n * L);
        for (let k = 0; k < n; k++) b.hill(x + k * L, x + (k + 1) * L, h * (0.8 + 0.4 * r()), top, def.hill);
        b.gem(x + L * 1.5, top + h + 1.2); x += n * L; break;
      }
      case 'rocky': {   // rough ground: low rocks sticking out of the road
        const L = rr(10, 14);
        ground(x, x + L);
        for (let rx = x + 1.2; rx < x + L - 1; rx += rr(1.4, 2.6)) { const w = rr(0.6, 1.2), h = rr(0.14, 0.3 + diff * 0.1); b.ramp(rx, top, rx + w / 2, top + h, 'stone', top - 0.1); b.ramp(rx + w / 2, top + h, rx + w, top, 'stone', top - 0.1); }
        b.gem(x + L / 2, top + 1.3); x += L; break;
      }
      case 'valley': {   // down into a dip and straight back up
        const d = rr(1.2, 2.0 + diff * 0.6), L = d * 3 + 2, F = rr(3, 5);
        b.ramp(x, top, x + L, top - d, st.ground);
        ground(x + L, x + L + F, top - d);
        b.ramp(x + L + F, top - d, x + 2 * L + F, top, st.ground);
        b.gem(x + L + F / 2, top - d + 1.2); x += 2 * L + F; ground(x, x + 3); x += 3; break;
      }
      case 'climb': {   // a long climb to a crest, then down the other side
        const h = rr(2.2, 3.2 + diff * 0.6), L1 = h * 3.2, L2 = h * 3.6;
        ground(x, x + L1 + L2 + 2);
        b.ramp(x, top, x + L1, top + h, st.ground, top - 0.5);
        b.ramp(x + L1, top + h, x + L1 + 2, top + h, st.ground, top - 0.5);
        b.ramp(x + L1 + 2, top + h, x + L1 + 2 + L2, top, st.ground, top - 0.5);
        b.gem(x + L1 + 1, top + h + 1.3); x += L1 + L2 + 2; break;
      }
      // ---- obstacles
      case 'barrels': {   // oil barrels standing on the road: knock them over
        const n = 2 + ((r() * 3) | 0);
        ground(x, x + 4 + n * 1.2);
        for (let k = 0; k < n; k++) b.dyn(x + 3 + k * 1.1, top + 0.45, 0.7, 0.9, 'barrel', 0.2);
        if (n >= 3) b.dyn(x + 3.55, top + 1.35, 0.7, 0.9, 'barrel', 0.2);
        b.gem(x + 2 + n * 1.2, top + 1.4); x += 4 + n * 1.2; break;
      }
      case 'logPile': {   // a pyramid of logs across the road
        ground(x, x + 9);
        const lx = x + 3.5;
        for (let row = 0; row < 3; row++) for (let k = 0; k < 3 - row; k++) b.dyn(lx + k * 0.62 + row * 0.31, top + 0.3 + row * 0.56, 0.6, 0.56, 'log', 0.2);
        b.gem(x + 7.5, top + 1.2); x += 9; break;
      }
      case 'containers': {   // shipping containers: drive up a ramp, along the roof and drop off the end
        const L = rr(6, 9), h = rr(1.0, 1.3);
        ground(x, x + L + 9);
        b.ramp(x, top, x + 4, top + h, 'concrete', top - 0.5);
        b.block(x + 4 + L / 2, top + h / 2, L, h, 'metal');
        b.gem(x + 4 + L / 2, top + h + 1.2); x += L + 9; break;
      }
      case 'wreck': {   // an old car wreck on the road with a kicker ramp to jump it
        ground(x, x + 16);
        b.ramp(x, top, x + 4, top + 0.9, 'wood', top - 0.5);
        b.block(x + 7.2, top + 0.45, 3.2, 0.9, 'metal');
        b.gem(x + 7.2, top + 2.6); x += 16; break;
      }
      case 'pipes': {   // big round rocks lying on the road (they roll when hit)
        const n = 2 + ((r() * 2) | 0);
        ground(x, x + 4 + n * 3);
        for (let k = 0; k < n; k++) b.ball(x + 3 + k * 3, top + 0.55, 0.55, 0, 'stone');
        b.gem(x + 2 + n * 1.5, top + 1.6); x += 4 + n * 3; break;
      }
      // ---- race-only chaos
      case 'dominoes': {
        const n = 4 + ((r() * 4) | 0);
        ground(x, x + n * 1.6 + 3); b.dominoes(x + 1.5, n, 1.6, top, 2.2, def.domino);
        x += n * 1.6 + 3; break;
      }
      case 'hammer': {
        ground(x, x + 8); b.hammer(x + 4, top, r() < 0.5 ? 1.2 : -1.2);
        b.gem(x + 4, top + 1.2); x += 8; break;
      }
      case 'wall': {
        ground(x, x + 7); b.wall(x + 3, 1 + ((r() * 2) | 0), 2 + ((r() * 2) | 0), top, 0.75, def.crate);
        x += 7; break;
      }
      case 'boulders': {
        const L = 14, h = 2.4;
        b.ramp(x, top, x + L, top + h, st.ground, top - 0.5);
        ground(x, x + L);
        ground(x + L, x + L + 8, top + h);
        b.ball(x + L + 3, top + h + 1.2, 0.8, -3).ball(x + L + 6, top + h + 1.2, 0.9, -2);
        b.ramp(x + L + 8, top + h, x + L + 18, top, st.ground, top - 0.5);
        zones.push([x - 1, x + L + 2, 8]);
        x += L + 18; ground(x, x + 3); x += 3; break;
      }
      default: break;
    }
  }
  // sea jump finale: a long run-up, a kicker and open water the truck clears on its own speed (no items)
  const seaGaps = [];
  if (sea) {
    const G = sea;
    ground(x, x + 24);
    b.ramp(x + 24, top, x + 28, top + 1.6, st.ground, water);
    const lip = x + 28, land = lip + G;
    for (let i = 1; i <= 3; i++) b.gem(lip + (G * i) / 4, top + 2.6 + (i === 2 ? 0.6 : 0));
    b.ramp(land, top + 0.8, land + 12, top, st.ground, water);   // gentle landing slope
    ground(land + 12, land + 24);
    seaGaps.push({ lip, land, top });
    x = land + 24;
  }
  ground(x, x + 14, top, def.startGround);
  b.finish(x + 8, top);
  const ai = { zones: zones.filter((z) => z.length === 3) };
  if (zones.some((z) => z[0] === 'air')) ai.airAngle = -0.1;
  const words = race ? RACE_WORDS : def.words;
  const nr = rng(seed * 7 + 3);
  const opts = { water, ai, name: nameFor(words, nr), gen: seed, ...(seaGaps.length ? { seaGaps } : {}) };
  return { pieces: settle(b.p, water), start: { x: 0, y: 0 }, ...opts };
}

const defOf = (w) => (typeof w === 'string' ? WORLD_DEFS.find((d) => d.id === w) : WORLD_DEFS[w]);
export const genLevel = (world, seed, diff, o = {}) => build(defOf(world), seed, diff, o);
export const genRace = (worldIdx, seed, o = {}) => ({ ...build(defOf(worldIdx), seed, 0.9, { race: true, ...o }), raceWorld: worldIdx });
