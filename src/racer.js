// Race helpers shared by the game and the headless race test.
import { Sim, DT } from './sim.js';

// Track a racer's progress and respawn it after a crash or when stuck.
export function makeRacer(level, spec, opts = {}) {
  return { level, spec, opts, sim: new Sim(level, spec, opts), failT: 0, stuckT: 0, bestX: -1e9, respawns: 0 };
}

// Flip the truck back upright a little behind where it got into trouble. Keeps the same simulation.
export function respawnAt(r, x) {
  r.sim.recover(x);
  r.failT = 0; r.stuckT = 0; r.respawns++;
  return r.sim;
}

// Call once per physics step. Returns 'respawn' when the truck was put back on its wheels.
export function racerWatch(r) {
  const s = r.sim;
  if (s.state === 'win' || s.state === 'recover') return null;
  if (s.state === 'fail') {
    r.failT += DT;
    if (r.failT > 0.9) { respawnAt(r, Math.max(s.startX, Math.min(s.x, s.maxX) - 3)); r.bestX = -1e9; return 'respawn'; }
    return null;
  }
  const x = s.x;
  if (x > r.bestX + 0.4) { r.bestX = x; r.stuckT = 0; } else r.stuckT += DT;
  if (r.stuckT > (r.opts.stuckLimit ?? 3.5)) {
    // first time: back up a little; stuck again at the same spot: hop past the obstacle
    const again = Math.abs(s.maxX - (r.lastStuckX ?? -1e9)) < 4;
    r.lastStuckX = s.maxX;
    respawnAt(r, again ? s.maxX + 4 : s.maxX - 2); r.bestX = -1e9; return 'respawn';
  }
  return null;
}
