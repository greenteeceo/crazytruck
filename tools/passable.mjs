// "Can a player finish this level with this truck?" A driver who adapts: several bot styles (full speed,
// slower), and when stuck it backs up and tries again, like a player would. Passable if any style finishes.
import { Sim } from '../src/sim.js';
import { VEHICLES, withUpgrades } from '../src/vehicles.js';
import { makeBot } from '../src/bot.js';

export const STYLES = [[1, 1, false], [1, 1, true], [0.85, 2, true], [0.7, 3, true], [1, 4, true], [0.92, 5, true]];
export function drive(level, spec, [skill, seed, unstuck], maxSteps = 4800) {
  const sim = new Sim(level, spec); const bot = makeBot(skill, seed);
  let n = 0, bestX = -1e9, lastGain = 0, back = 0;
  while (sim.state === 'run' && n < maxSteps) {
    let t = bot(sim);
    if (unstuck) {
      if (sim.x > bestX + 0.4) { bestX = sim.x; lastGain = n; }
      if (back > 0) { back--; t = -1; } else if (n - lastGain > 150) { back = 45 + (n % 40); lastGain = n; }
    }
    sim.step(t); sim.drainEvents(); n++;
  }
  return sim.state === 'win' ? { ok: true, t: sim.finishTime } : { ok: false, why: `${sim.reason || 'timeout'}@${sim.x.toFixed(0)}` };
}
export function passable(level, spec) {
  let last = null;
  for (const st of STYLES) { last = drive(level, spec, st); if (last.ok) return last; }
  return last;
}
const byId = (id) => VEHICLES.find((v) => v.id === id);
const MAXUP = { speed: 5, power: 5, grip: 5, air: 5, stability: 5 };
// every level is checked with every truck at base stats, plus the fully upgraded hero and a few fully upgraded others
export const CHECK_TRUCKS = [
  ...VEHICLES.map((v) => [v.id, v]),
  ...['crane', 'taxi', 'garbage', 'titan', 'rocket'].map((id) => [id + '+max', withUpgrades(byId(id), MAXUP)]),
];
export const allPass = (level) => { for (const [name, spec] of CHECK_TRUCKS) { const r = passable(level, spec); if (!r.ok) return { ok: false, why: `${name} ${r.why}` }; } return { ok: true }; };
