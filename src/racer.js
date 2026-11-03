// Race helpers shared by the game and the headless race test.
import { Sim, DT } from './sim.js';

// Track a racer's progress and respawn it after a crash or when stuck.
export function makeRacer(level, spec, opts = {}) {
  return { level, spec, opts, sim: new Sim(level, spec, opts), failT: 0, stuckT: 0, bestX: -1e9, respawns: 0 };
}

export function respawnAt(r, x) {
  const old = r.sim;
  let gx = x, gy = null;
  for (let i = 0; i < 40 && gy == null; i++) { gy = old.groundAt(gx); if (gy == null) gx += 1; }
  if (gy == null) { gx = r.level.start?.x || 0; gy = r.level.start?.y || 0; }
  const sim = new Sim(r.level, r.spec, { ...r.opts, start: { x: gx, y: gy + 0.25 }, time: old.time + 0.6 });
  if (r.opts.collectGems !== false) sim.gems.forEach((g, i) => { if (old.gems[i]?.taken) { g.taken = true; sim.gemsTaken++; } });
  r.sim = sim; r.failT = 0; r.stuckT = 0; r.respawns++;
  return sim;
}

// Call once per physics step. Returns 'respawn' when the sim was replaced.
export function racerWatch(r) {
  const s = r.sim;
  if (s.state === 'win') return null;
  if (s.state === 'fail') {
    r.failT += DT;
    if (r.failT > 0.9) { respawnAt(r, Math.max(s.startX, s.maxX - 2.5)); return 'respawn'; }
    return null;
  }
  const x = s.x;
  if (x > r.bestX + 0.4) { r.bestX = x; r.stuckT = 0; } else r.stuckT += DT;
  if (r.stuckT > (r.opts.stuckLimit ?? 3.5)) { respawnAt(r, s.maxX + 3); r.bestX = -1e9; return 'respawn'; }
  return null;
}
