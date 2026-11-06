// AI driver used by race opponents (and the level test harness).
const norm = (a) => { a %= Math.PI * 2; if (a > Math.PI) a -= Math.PI * 2; if (a < -Math.PI) a += Math.PI * 2; return a; };

export function makeBot(skill = 1, seed = 1) {
  let r = seed * 9301 + 49297;
  const rand = () => ((r = (r * 9301 + 49297) % 233280) / 233280);
  let hold = 0, holdVal = 1;
  return (sim) => {
    const c = sim.chassis, a = norm(c.getAngle()), v = c.getLinearVelocity();
    const lvl = sim.level, x = c.getPosition().x;
    let maxV = (lvl.ai?.maxV ?? 99) * (0.82 + 0.18 * skill);
    for (const z of lvl.ai?.zones || []) if (x >= z[0] && x <= z[1]) maxV = Math.min(maxV, z[2] * (0.9 + 0.1 * skill));
    // small human-like hesitation for weaker bots
    if (hold > 0) { hold--; return holdVal; }
    if (skill < 1 && rand() < 0.012 * (1 - skill)) { hold = 8 + (rand() * 14) | 0; holdVal = rand() < 0.5 ? 0 : 1; }
    // sea crossings: Rocket on the run-up, Super Jump at the lip, Glider once airborne
    for (const g of lvl.seaGaps || []) {
      if (x < g.lip - 4 || x > g.land || !sim.useItem) continue;
      if (!sim.fx.boost && !sim.fx.glide && sim.count('boost') > 0 && x > g.lip - 3) sim.useItem('boost');
      else if (!sim.fx.boost && !sim.fx.glide && !sim.usedJumpAt && sim.count('jump') > 0 && x > g.lip - 0.4 && sim.count('boost') === 0) { sim.useItem('jump'); sim.usedJumpAt = x; }
      else if (!sim.fx.boost && !sim.fx.glide && sim.airborne && x > g.lip + 1 && sim.count('glide') > 0) sim.useItem('glide');
      if (x > g.lip - 6 && x < g.lip) return 1;   // full throttle on the run-up
    }
    let t = 1;
    if (sim.airborne) {
      const w = c.getAngularVelocity();
      const target = lvl.ai?.airAngle ?? 0;
      const err = a - target + w * 0.25;
      t = err > 0.12 ? -1 : err < -0.12 ? 1 : 0;
    } else {
      if (a > 0.7 || (a > 0.35 && c.getAngularVelocity() > 1.5)) t = 0;   // ease off before a wheelie turns into a flip
      if (v.x > maxV) t = v.x > maxV + 3 && a > -0.15 && c.getAngularVelocity() > -0.8 ? -1 : 0;   // brake gently: reverse torque pitches the nose down
      if (a < -0.9 && v.x > 3) t = 0;    // steep nose-down: don't accelerate
    }
    return t;
  };
}
