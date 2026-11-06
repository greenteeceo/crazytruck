// AI driver used by race opponents (and the level test harness).
const norm = (a) => { a %= Math.PI * 2; if (a > Math.PI) a -= Math.PI * 2; if (a < -Math.PI) a += Math.PI * 2; return a; };

// opts.pace(): a multiplier on the bot's top speed (races use it so a runaway rival eases off)
export function makeBot(skill = 1, seed = 1, opts = {}) {
  let r = seed * 9301 + 49297;
  const rand = () => ((r = (r * 9301 + 49297) % 233280) / 233280);
  let hold = 0, holdVal = 1, started = false;
  return (sim) => {
    // race rivals react to GO a moment late (the weaker, the later)
    if (opts.race && !started) { started = true; hold = Math.round((0.15 + rand() * 0.5) * 60 * (1.3 - skill)); holdVal = 0; }
    const c = sim.chassis, a = norm(c.getAngle()), v = c.getLinearVelocity();
    const lvl = sim.level, x = c.getPosition().x;
    let maxV = (lvl.ai?.maxV ?? 99) * (0.82 + 0.18 * skill);
    // race rivals: their form sets how fast they dare to go (a 0.5 rival runs at ~80% of its truck's top speed)
    if (opts.race) maxV = Math.min(maxV, sim.spec.speed * sim.spec.wheelR * (0.6 + 0.4 * skill));
    if (opts.pace) maxV *= opts.pace();
    for (const z of lvl.ai?.zones || []) if (x >= z[0] && x <= z[1]) maxV = Math.min(maxV, z[2] * (0.9 + 0.1 * skill));
    // small human-like hesitation for weaker bots
    if (hold > 0) { hold--; return holdVal; }
    if (skill < 1 && rand() < 0.012 * (1 - skill)) { hold = 8 + (rand() * 14) | 0; holdVal = rand() < 0.5 ? 0 : 1; }
    // race rivals also make real mistakes now and then: they lift off the throttle for a while (not in the air)
    if (opts.race && !sim.airborne && skill < 1 && rand() < 0.02 * (1 - skill)) { hold = 15 + (rand() * 35) | 0; holdVal = 0; }
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

// Autoplay "players" for testing the hard parts the way people really drive them:
//  noob - holds the throttle down nearly all the time (wheelies, flips), no control in the air, lets go at random,
//         never thinks of backing up
//  avg  - the race bot at 0.8 skill (some hesitation, slower in tricky zones)
//  pro  - the best bot, plus what a good player does when stuck: back up a little and try again
export const PLAYER_KINDS = ['noob', 'avg', 'pro'];
export function makePlayer(kind = 'pro', seed = 1) {
  if (kind === 'avg') return makeBot(0.8, seed);
  if (kind === 'noob') {
    let r = seed * 7919 + 13, off = 0;
    const rand = () => ((r = (r * 9301 + 49297) % 233280) / 233280);
    return (sim) => {
      if (off > 0) { off--; return 0; }
      if (rand() < 0.008) off = 10 + ((rand() * 30) | 0);   // lets go of the screen now and then
      if (sim.airborne) return rand() < 0.85 ? 1 : 0;        // keeps pressing in the air (tips back)
      return 1;
    };
  }
  const bot = makeBot(1, seed);
  let bestX = -1e9, lastGain = 0, back = 0, n = 0;
  return (sim) => {
    n++;
    const x = sim.chassis.getPosition().x;
    if (x > bestX + 0.4) { bestX = x; lastGain = n; }
    if (back > 0) { back--; return -1; }
    if (n - lastGain > 150) { back = 45 + (n % 40); lastGain = n; return -1; }   // 2.5 s without progress: back up and retry
    return bot(sim);
  };
}
