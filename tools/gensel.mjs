// Pick generator seeds whose levels / race tracks the bot can actually finish, write src/genseeds.json.
import fs from 'fs';
import { Sim } from '../src/sim.js';
import { genLevel, genRace } from '../src/gen.js';
import { WORLD_DEFS } from '../src/worlds.js';
import { WORLDS, RACE_TRACKS, HANDMADE, TAIL_FROM, tailLen, tailDiff, genSpec, genCount, raceSea } from '../src/levels.js';
import { extendLevel } from '../src/gen.js';
import { VEHICLES } from '../src/vehicles.js';
import { makeBot } from '../src/bot.js';
import { makeRacer, racerWatch } from '../src/racer.js';
import { allPass, CHECK_TRUCKS } from './passable.mjs';
const spec = VEHICLES[0];
const names = new Set([...WORLDS.slice(0, 4).flatMap((w) => w.levels.map((l) => l.name)), ...RACE_TRACKS.slice(0, 12).map((l) => l.name)]);
const solo = (l, skill) => { const s = new Sim(l, spec), bot = makeBot(skill, 1); for (let i = 0; i < 60 * 60 && s.state === 'run'; i++) { s.step(bot(s)); s.drainEvents(); } return s.state === 'win' ? s.finishTime : null; };
const raced = (l, skill, sp = spec) => { const r = makeRacer(l, sp, { collectGems: false }), bot = makeBot(skill, 3); let fin = null; for (let i = 0; i < 60 * 60 && fin == null; i++) { r.sim.step(bot(r.sim)); for (const e of r.sim.drainEvents()) if (e.type === 'win') fin = r.sim.finishTime; racerWatch(r); } return fin == null ? null : { t: fin, resp: r.respawns }; };
const prev = JSON.parse(fs.readFileSync('src/genseeds.json', 'utf8'));
const out = { levels: {}, tails: {}, races: [] };
let tried = 0;
for (const [wi, d] of WORLD_DEFS.entries()) {
  const handmade = !!HANDMADE[d.id];
  // ONLY=<world id>: re-pick just that world, keep everything else as shipped
  if (process.env.ONLY && process.env.ONLY !== d.id) { out.levels[d.id] = prev.levels[d.id]; if (prev.tails?.[d.id]) out.tails[d.id] = prev.tails[d.id]; for (const l of WORLDS[wi].levels) names.add(l.name); continue; }
  out.levels[d.id] = [];
  // hand-made levels 4-10: the harder stretch added after them (the hero, a slower driver and all 21 trucks must finish)
  if (handmade && HANDMADE[d.id].length > TAIL_FROM) {
    out.tails[d.id] = [];
    for (let li = TAIL_FROM; li < HANDMADE[d.id].length; li++) {
      const j = li - TAIL_FROM, base = HANDMADE[d.id][li];
      const mk = (seed) => { const l = extendLevel(base, d.id, seed, tailDiff(li), tailLen(li)); l.world = wi; l.index = li; l.id = `${d.id}-${li + 1}`; return l; };
      const ok = (l) => { const t1 = solo(l, 1); return t1 != null && t1 <= 60 && solo(l, 0.85) != null && allPass(l).ok ? t1 : null; };
      const old = prev.tails?.[d.id]?.[j];
      if (old != null) { const t0 = ok(mk(old)); if (t0 != null) { out.tails[d.id].push(old); continue; } console.log('replace tail', d.id, li + 1); }
      for (let seed = 70000 + wi * 1000 + li * 37 + (old != null ? 7919 : 0); ; seed++) {
        tried++;
        const t1 = ok(mk(seed));
        if (t1 == null) continue;
        out.tails[d.id].push(seed);
        console.log('tail', d.id, li + 1, seed, base.name.padEnd(16), t1.toFixed(1) + 's');
        break;
      }
    }
  }
  const count = genCount(d.id);
  for (let k = 0; k < count; k++) {
    const sp = genSpec(d.id, k), diff = sp.diff, gopt = { sea: sp.sea, plan: sp.plan };
    // a shipped seed stays if the hero, a starter truck, the fastest and the fully upgraded trucks all finish it
    const old = prev.levels[d.id]?.[k];
    if (old != null && !(handmade && process.env.ONLY_NEW)) { const l0 = genLevel(d.id, old, diff, gopt); const t0 = solo(l0, 1); if (t0 != null && t0 <= (sp.plan ? 75 : 45) && allPass(l0).ok) { out.levels[d.id].push(old); names.add(l0.name); continue; } console.log('replace', d.id, k + 1, l0.name, allPass(l0).why || 'hero'); }
    for (let seed = 1000 * (wi + 1) + k * 101 + (old != null ? 7919 : 0); ; seed++) {
      tried++;
      const l = genLevel(d.id, seed, diff, gopt);
      if (names.has(l.name)) continue;
      const t1 = solo(l, 1);
      if (t1 == null || t1 > (sp.plan ? 75 : 45)) continue;
      if (solo(l, 0.85) == null) continue;
      if (!allPass(l).ok) continue;
      names.add(l.name); out.levels[d.id].push(seed);
      console.log(d.id, k + 1, seed, l.name.padEnd(18), t1.toFixed(1) + 's');
      break;
    }
  }
}
const strong = CHECK_TRUCKS.find(([n]) => n === 'titan+max')[1];
const raceOk = (l) => { const res = [1, 0.85, 0.7].map((sk) => raced(l, sk)); const st = raced(l, 1, strong); return !res.some((x) => !x || x.t > 50 || x.resp > 3) && st && st.resp <= 3 ? res : null; };
if (process.env.ONLY) out.races = prev.races;
else for (let i = 0; i < 20; i++) {
  const w = 4 + (i % 16);
  const old = prev.races?.[i];
  if (old && old.w === w) { const l0 = genRace(w, old.seed, { sea: raceSea(i) }); if (raceOk(l0)) { out.races.push(old); names.add(l0.name); continue; } console.log('replace race', i + 1, l0.name); }
  for (let seed = 50000 + i * 131 + (old ? 7919 : 0); ; seed++) {
    tried++;
    const l = genRace(w, seed, { sea: raceSea(i) });
    if (names.has(l.name)) continue;
    const res = raceOk(l);
    if (!res) continue;
    names.add(l.name); out.races.push({ w, seed });
    console.log('race', i + 1, WORLD_DEFS[w].id, seed, l.name.padEnd(18), res.map((x) => x.t.toFixed(1) + '(r' + x.resp + ')').join(' '));
    break;
  }
}
fs.writeFileSync('src/genseeds.json', JSON.stringify(out, null, 1));
console.log('tried', tried);
