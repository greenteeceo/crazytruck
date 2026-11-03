// Pick generator seeds whose levels / race tracks the bot can actually finish, write src/genseeds.json.
import fs from 'fs';
import { Sim } from '../src/sim.js';
import { genLevel, genRace } from '../src/gen.js';
import { WORLD_DEFS } from '../src/worlds.js';
import { WORLDS, RACE_TRACKS, genDiff } from '../src/levels.js';
import { VEHICLES } from '../src/vehicles.js';
import { makeBot } from '../src/bot.js';
import { makeRacer, racerWatch } from '../src/racer.js';
const spec = VEHICLES[0];
const names = new Set([...WORLDS.slice(0, 4).flatMap((w) => w.levels.map((l) => l.name)), ...RACE_TRACKS.slice(0, 12).map((l) => l.name)]);
const solo = (l, skill) => { const s = new Sim(l, spec), bot = makeBot(skill, 1); for (let i = 0; i < 60 * 60 && s.state === 'run'; i++) { s.step(bot(s)); s.drainEvents(); } return s.state === 'win' ? s.finishTime : null; };
const raced = (l, skill) => { const r = makeRacer(l, spec, { collectGems: false }), bot = makeBot(skill, 3); let fin = null; for (let i = 0; i < 60 * 60 && fin == null; i++) { r.sim.step(bot(r.sim)); for (const e of r.sim.drainEvents()) if (e.type === 'win') fin = r.sim.finishTime; racerWatch(r); } return fin == null ? null : { t: fin, resp: r.respawns }; };
const prev = JSON.parse(fs.readFileSync('src/genseeds.json', 'utf8'));
const out = { levels: {}, races: [] };
let tried = 0;
for (const [wi, d] of WORLD_DEFS.entries()) {
  const handmade = wi < 4;
  if (handmade && prev.levels[d.id]?.length === 10) { out.levels[d.id] = prev.levels[d.id]; continue; }
  if (!handmade && prev.levels[d.id]?.length === 20 && !process.env.REGEN) { out.levels[d.id] = prev.levels[d.id]; prev.levels[d.id].forEach((sd, k) => names.add(genLevel(d.id, sd, genDiff(k, true)).name)); continue; }
  out.levels[d.id] = [];
  const count = handmade ? 10 : 20;
  for (let k = 0; k < count; k++) {
    const diff = genDiff(k, !handmade);
    for (let seed = 1000 * (wi + 1) + k * 101; ; seed++) {
      tried++;
      const l = genLevel(d.id, seed, diff);
      if (names.has(l.name)) continue;
      const t1 = solo(l, 1);
      if (t1 == null || t1 > 45) continue;
      if (solo(l, 0.85) == null) continue;
      names.add(l.name); out.levels[d.id].push(seed);
      console.log(d.id, k + 1, seed, l.name.padEnd(18), t1.toFixed(1) + 's');
      break;
    }
  }
}
for (let i = 0; i < 20; i++) {
  const w = 4 + (i % 16);
  for (let seed = 50000 + i * 131; ; seed++) {
    tried++;
    const l = genRace(w, seed);
    if (names.has(l.name)) continue;
    const res = [1, 0.85, 0.7].map((sk) => raced(l, sk));
    if (res.some((x) => !x || x.t > 50 || x.resp > 4)) continue;
    names.add(l.name); out.races.push({ w, seed });
    console.log('race', i + 1, WORLD_DEFS[w].id, seed, l.name.padEnd(18), res.map((x) => x.t.toFixed(1) + '(r' + x.resp + ')').join(' '));
    break;
  }
}
fs.writeFileSync('src/genseeds.json', JSON.stringify(out, null, 1));
console.log('tried', tried);
