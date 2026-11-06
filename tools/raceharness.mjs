import { RACE_TRACKS } from '../src/levels.js';
import { VEHICLES } from '../src/vehicles.js';
import { makeBot } from '../src/bot.js';
import { makeRacer, racerWatch } from '../src/racer.js';
const spec = { ...VEHICLES[0] };
for (const l of RACE_TRACKS) {
  const res = [];
  for (const skill of [1, 0.85, 0.7]) {
    const r = makeRacer(l, spec, { collectGems: false }), bot = makeBot(skill, 3);
    let fin = null;
    for (let i = 0; i < 60 * 90 && fin == null; i++) {
      r.sim.step(bot(r.sim));
      for (const e of r.sim.drainEvents()) if (e.type === 'win') fin = r.sim.finishTime;
      racerWatch(r);
    }
    res.push(`${skill}:${fin ? fin.toFixed(1) : 'DNF@' + r.sim.x.toFixed(0)}(r${r.respawns})`);
  }
  console.log(l.id.padEnd(9), l.name.padEnd(16), res.join('  '));
}
