// Race helpers shared by the game and the headless race test.
import { Sim, DT } from './sim.js';

// Track a racer's progress and respawn it after a crash or when stuck.
export function makeRacer(level, spec, opts = {}) {
  // races are lenient: a truck in trouble struggles and is only put back once it lies flipped and still
  opts = { lenient: true, ...opts };
  return { level, spec, opts, sim: new Sim(level, spec, opts), failT: 0, stuckT: 0, bestX: -1e9, respawns: 0, safe: [], safeT: 0 };
}

// Last spot where the truck was driving upright on its wheels, at least `back` metres behind x.
function checkpoint(r, x, back) {
  for (let i = r.safe.length - 1; i >= 0; i--) if (r.safe[i] <= x - back) return r.safe[i];
  return r.sim.startX;
}

// Flip the truck back upright behind where it got into trouble. Keeps the same simulation.
export function respawnAt(r, x) {
  r.sim.recover(x);
  r.safe = r.safe.filter((sx) => sx <= x + 0.01);
  r.failT = 0; r.stuckT = 0; r.respawns++; r.bestX = -1e9;
  return r.sim;
}

// Record checkpoints while driving upright with both wheels down (call once per physics step).
export function trackSafe(r) {
  const s = r.sim;
  if (s.state !== 'run') return;
  r.safeT += DT;
  if (r.safeT <= 0.25) return;
  r.safeT = 0;
  let a = s.chassis.getAngle() % (Math.PI * 2); if (a > Math.PI) a -= Math.PI * 2; if (a < -Math.PI) a += Math.PI * 2;
  if (s.wheelTouch[0] > 0 && s.wheelTouch[1] > 0 && Math.abs(a) < 0.35 && s.lostWheel == null) {
    const last = r.safe[r.safe.length - 1];
    if (last == null || s.x > last + 1) r.safe.push(s.x);
  }
}

// Call once per physics step. Returns 'respawn' when the truck was put back on its wheels.
export function racerWatch(r) {
  const s = r.sim;
  if (s.state === 'win' || s.state === 'recover') return null;
  if (s.state === 'fail') {
    r.failT += DT;
    // give the crash a moment to play out, then go back to a checkpoint before the obstacle
    // a splash means the jump was too short: go further back for a proper run-up
    if (r.failT > 0.8) { respawnAt(r, checkpoint(r, s.x, s.reason === 'splash' ? 9 : 5)); return 'respawn'; }
    return null;
  }
  trackSafe(r);
  const x = s.x, v = s.chassis.getLinearVelocity();
  // stuck = really not moving at all (wedged), not just slow: pushing crates, climbing or backing up for a run-up
  // never counts. Then it goes back for a run-up, never ahead.
  // (rival bots cannot think of backing up: for them no progress at all for a while is enough)
  if (x > r.bestX + 0.4) { r.bestX = x; r.stuckT = 0; }
  else if (!r.opts.stillStuck || Math.abs(v.x) + Math.abs(v.y) < 0.6) r.stuckT += DT;
  else r.stuckT = Math.max(0, r.stuckT - DT * 0.5);
  if (r.stuckT > (r.opts.stuckLimit ?? 4)) { respawnAt(r, checkpoint(r, x, 6)); return 'respawn'; }
  return null;
}
