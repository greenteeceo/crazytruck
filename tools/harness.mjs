import { Sim, DT } from '../src/sim.js';
import { WORLDS } from '../src/levels.js';
import { VEHICLES } from '../src/vehicles.js';
import { makeBot } from '../src/bot.js';
const vid = process.argv[2] || 'crane';
const spec = VEHICLES.find(v => v.id === vid);
const out = {};
for (const w of WORLDS) for (const l of w.levels) {
  const sim = new Sim(l, spec); const bot = makeBot(1, 1);
  let steps = 0;
  while (sim.state === 'run' && steps < 60 * 60) { sim.step(bot(sim)); sim.drainEvents(); steps++; }
  const t = sim.state === 'win' ? sim.finishTime : null;
  out[l.id] = t;
  console.log(l.id.padEnd(16), l.name.padEnd(16), sim.state.padEnd(5), sim.reason.padEnd(7), (t ?? 0).toFixed(2), 'x=', sim.x.toFixed(1), 'gems', sim.gemsTaken + '/' + sim.gems.length);
}
if (process.argv[3]) (await import('fs')).writeFileSync(process.argv[3], JSON.stringify(out, null, 1));
