// Deterministic 2D physics simulation of one truck on one level (planck / Box2D).
import * as pl from 'planck';

const V = pl.Vec2;
export const DT = 1 / 60;
const CAT_TERRAIN = 0x0001, CAT_CAR = 0x0002, CAT_DYN = 0x0004;

const FRICTION = { snow: 0.75, icecave: 0.6, asphalt: 0.95, docks: 0.95, toy: 0.9, grass: 0.9, dirt: 0.9, wood: 0.95, stone: 0.85, concrete: 0.85, girder: 0.8, metal: 0.75, castle: 0.85, ice: 0.08, sand: 0.9, pad: 0.8 };

export class Sim {
  constructor(level, spec, opts = {}) {
    this.level = level;
    this.spec = spec;
    this.opts = opts;
    this.world = new pl.World({ gravity: V(0, -(level.gravity ?? 10)) });
    this.time = opts.time || 0;
    this.state = 'run';
    this.reason = '';
    this.finishTime = 0;
    this.dynamics = [];   // { body, piece } for renderer
    this.kinematics = []; // movers/spinners
    this.gems = [];       // { piece, body, taken }
    this.gemsTaken = 0;
    this.wheelTouch = [0, 0];
    this.headTouch = 0;
    this.headTime = 0;
    this.padCooldown = 0;
    this.freeze = 0;
    this.debris = []; this.impacts = []; this.lostWheels = new Set();
    this.failPose = '';
    this.landed = 0;     // set when wheel lands after air; used for fx
    this.airTime = 0;
    this.events = [];    // queued fx events for renderer/audio
    this.maxX = 0;
    this.collectGems = opts.collectGems !== false;
    this.buildLevel();
    this.buildCar();
    this.contacts();
  }

  // ---------------- level -----------------
  fixtureOpts(style, extra = {}) {
    return {
      friction: FRICTION[style] ?? 0.85,
      restitution: 0.02,
      density: 1,
      filterCategoryBits: CAT_TERRAIN,
      filterMaskBits: 0xffff,
      userData: { kind: 'ground', style },
      ...extra,
    };
  }

  buildLevel() {
    const w = this.world;
    this.ground = w.createBody();
    for (const p of this.level.pieces) {
      switch (p.t) {
        case 'box': {
          const b = w.createBody({ position: V(p.x, p.y), angle: p.a || 0 });
          b.createFixture(pl.Box(p.w / 2, p.h / 2), this.fixtureOpts(p.s));
          if (p.s === 'pad') b.getFixtureList().setUserData({ kind: 'ground', style: 'pad', pad: p });
          break;
        }
        case 'poly': {
          const b = w.createBody();
          b.createFixture(pl.Polygon(p.pts.map(([x, y]) => V(x, y))), this.fixtureOpts(p.s));
          break;
        }
        case 'bridge': this.buildBridge(p); break;
        case 'dyn': {
          const b = w.createDynamicBody({ position: V(p.x, p.y), angle: p.a || 0 });
          b.createFixture(pl.Box(p.w / 2, p.h / 2), this.fixtureOpts(p.s, { density: p.d ?? 0.5, filterCategoryBits: CAT_DYN, userData: { kind: 'ground', style: p.s, prop: !!this.level.race, smash: true } }));
          this.dynamics.push({ body: b, piece: p });
          break;
        }
        case 'seesaw': {
          const b = w.createDynamicBody({ position: V(p.x, p.y) });
          b.createFixture(pl.Box(p.w / 2, 0.18), this.fixtureOpts(p.s || 'wood', { density: p.d ?? 0.6, filterCategoryBits: CAT_DYN }));
          w.createJoint(pl.RevoluteJoint({ enableLimit: true, lowerAngle: -(p.lim ?? 0.45), upperAngle: p.lim ?? 0.45 }, this.ground, b, V(p.x, p.y)));
          b.setAngle(p.a0 || 0);
          this.dynamics.push({ body: b, piece: { ...p, h: 0.36 } });
          break;
        }
        case 'hinge': {
          // plank hinged at its left (or right) end
          const len = p.w, dir = p.right ? -1 : 1;
          const cx = p.x + dir * len / 2 * Math.cos(p.a0 || 0), cy = p.y + dir * len / 2 * Math.sin(p.a0 || 0);
          const b = w.createDynamicBody({ position: V(p.x + dir * len / 2, p.y) });
          b.createFixture(pl.Box(len / 2, (p.h || 0.3) / 2), this.fixtureOpts(p.s || 'wood', { density: p.d ?? 0.5, filterCategoryBits: CAT_DYN }));
          w.createJoint(pl.RevoluteJoint({ enableLimit: true, lowerAngle: p.lo ?? -1.5, upperAngle: p.hi ?? 1.5 }, this.ground, b, V(p.x, p.y)));
          b.setTransform(V(cx, cy), p.a0 || 0);
          this.dynamics.push({ body: b, piece: { ...p, h: p.h || 0.3 } });
          break;
        }
        case 'ball': {
          const b = w.createDynamicBody({ position: V(p.x, p.y), angularDamping: 0.05 });
          b.createFixture(pl.Circle(p.r), this.fixtureOpts(p.s || 'stone', { density: p.d ?? 0.35, friction: 0.6, restitution: 0.25, filterCategoryBits: CAT_DYN, userData: { kind: 'ground', style: 'stone', prop: true, smash: true } }));
          if (p.vx) b.setLinearVelocity(V(p.vx, 0));
          this.dynamics.push({ body: b, piece: p });
          break;
        }
        case 'pend': {
          // swinging hammer: body origin at pivot, only the head collides
          const b = w.createDynamicBody({ position: V(p.x, p.y), angularDamping: 0 });
          b.createFixture(pl.Box(0.08, p.len / 2, V(0, -p.len / 2)), { density: 0.2, filterMaskBits: 0 });
          b.createFixture(pl.Box(p.bw / 2, p.bh / 2, V(0, -p.len)), this.fixtureOpts('metal', { density: p.d ?? 2, restitution: 0.3, filterCategoryBits: CAT_DYN, filterMaskBits: CAT_CAR, userData: { kind: 'ground', style: 'metal', prop: true } }));
          w.createJoint(pl.RevoluteJoint({}, this.ground, b, V(p.x, p.y)));
          b.setTransform(V(p.x, p.y), p.a0 ?? 1.0);
          this.dynamics.push({ body: b, piece: p });
          break;
        }
        case 'mover': case 'spin': {
          const b = w.createKinematicBody({ position: V(p.x, p.y), angle: p.a || 0 });
          b.createFixture(pl.Box(p.w / 2, p.h / 2), this.fixtureOpts(p.s));
          this.kinematics.push({ body: b, piece: p });
          this.dynamics.push({ body: b, piece: p });
          break;
        }
        case 'gem': {
          if (!this.collectGems) break;
          const b = w.createBody({ position: V(p.x, p.y) });
          const g = { piece: p, body: b, taken: false };
          b.createFixture(pl.Circle(0.45), { isSensor: true, userData: { kind: 'gem', gem: g } });
          this.gems.push(g);
          break;
        }
        case 'finish': {
          const b = w.createBody({ position: V(p.x, p.y + 2.5) });
          b.createFixture(pl.Box(0.4, 2.5), { isSensor: true, userData: { kind: 'finish' } });
          this.finishX = p.x; this.finishY = p.y;
          break;
        }
        case 'boost': {
          const b = w.createBody({ position: V(p.x, p.y + 0.6) });
          b.createFixture(pl.Box((p.w || 2) / 2, 0.6), { isSensor: true, userData: { kind: 'boost', p } });
          break;
        }
        default: break; // deco handled by renderer only
      }
    }
  }

  buildBridge(p) {
    const w = this.world;
    const n = p.n || Math.max(4, Math.round(Math.hypot(p.x2 - p.x1, p.y2 - p.y1) / 0.9));
    const dx = (p.x2 - p.x1) / n, dy = (p.y2 - p.y1) / n;
    const len = Math.hypot(dx, dy), ang = Math.atan2(dy, dx);
    let prev = this.ground;
    for (let i = 0; i < n; i++) {
      const cx = p.x1 + dx * (i + 0.5), cy = p.y1 + dy * (i + 0.5);
      const b = w.createDynamicBody({ position: V(cx, cy - 0.12), angle: ang, angularDamping: 0.6, linearDamping: 0.1 });
      b.createFixture(pl.Box(len / 2 * 0.98, 0.14), this.fixtureOpts(p.s || 'wood', { density: p.d ?? 1.2, filterCategoryBits: CAT_DYN, filterMaskBits: CAT_CAR | CAT_TERRAIN }));
      w.createJoint(pl.RevoluteJoint({}, prev, b, V(p.x1 + dx * i, p.y1 + dy * i)));
      this.dynamics.push({ body: b, piece: { t: 'plank', w: len * 0.98, h: 0.28, s: p.s || 'wood', bridge: true } });
      prev = b;
    }
    w.createJoint(pl.RevoluteJoint({}, prev, this.ground, V(p.x2, p.y2)));
  }

  // ---------------- car -----------------
  buildCar() {
    const s = this.spec, w = this.world;
    const st = this.opts.start || this.level.start || { x: 0, y: 0 };
    const cy = st.y + s.wheelR - s.wheelY + 0.05;
    const carFix = (ud, extra = {}) => ({ filterCategoryBits: CAT_CAR, filterMaskBits: CAT_TERRAIN | CAT_DYN, userData: ud, ...extra });
    const ch = this.chassis = w.createDynamicBody({ position: V(st.x, cy), angularDamping: 0.05 });
    ch.createFixture(pl.Box(s.chassis.hw, s.chassis.hh), carFix({ kind: 'car', part: 'chassis' }, { density: s.density, friction: 0.5 }));
    for (const h of s.heads) {
      ch.createFixture(pl.Box(h.hw, h.hh, V(h.x, h.y)), carFix({ kind: 'car', part: 'head' }, { density: s.density * 0.4, friction: 0.4 }));
    }
    if (s.blade) ch.createFixture(pl.Box(0.12, 0.42, V(2.0, -0.05)), carFix({ kind: 'car', part: 'chassis' }, { density: 0.5, friction: 0.3 }));
    this.wheels = []; this.joints = [];
    s.wheelX.forEach((wx, i) => {
      const wb = w.createDynamicBody({ position: V(st.x + wx, cy + s.wheelY), angularDamping: 0.2 });
      wb.createFixture(pl.Circle(s.wheelR), carFix({ kind: 'car', part: 'wheel', idx: i }, { density: s.wheelDensity, friction: s.grip, restitution: 0.05 }));
      this.wheels.push(wb); this.joints.push(this.makeJoint(wb));
    });
    // crane hook pendulum (visual, no collisions)
    this.hook = [];
    if (s.crane) {
      const c = s.crane;
      const tx = c.pivot[0] + Math.cos(c.angle) * c.length, ty = c.pivot[1] + Math.sin(c.angle) * c.length;
      let prev = ch, px = st.x + tx, py = cy + ty;
      for (let i = 0; i < c.links; i++) {
        const b = w.createDynamicBody({ position: V(px, py - c.linkLen * (i + 0.5)), angularDamping: 0.4, linearDamping: 0.1 });
        b.createFixture(pl.Box(0.06, c.linkLen / 2), { density: 0.15, filterMaskBits: 0, filterCategoryBits: 0 });
        const j = w.createJoint(pl.RevoluteJoint({}, prev, b, V(px, py - c.linkLen * i)));
        if (i === 0) this.hookJoint = j;
        this.hook.push(b); prev = b;
      }
    }
    if (s.stab) {
      // stability upgrade = ballast low in the chassis: the centre of mass moves down, nothing else
      const md = { mass: 0, center: V(0, 0), I: 0 }; ch.getMassData(md);
      const c0 = md.center, c1 = V(c0.x, c0.y - 0.22 * s.stab), Ic = md.I - md.mass * (c0.x * c0.x + c0.y * c0.y);
      ch.setMassData({ mass: md.mass, center: c1, I: Ic + md.mass * (c1.x * c1.x + c1.y * c1.y) });
    }
    this.mass = ch.getMass() + this.wheels.reduce((a, b) => a + b.getMass(), 0);
    // bodies whose render pose is interpolated between physics steps
    this.tracked = [ch, ...this.wheels, ...this.hook, ...this.dynamics.map((d) => d.body)];
    this.prev = new Map(this.tracked.map((b) => [b, { x: b.getPosition().x, y: b.getPosition().y, a: b.getAngle() }]));
    this.startX = (this.level.start || { x: 0 }).x;
  }

  makeJoint(wb) {
    const s = this.spec;
    return this.world.createJoint(pl.WheelJoint({ enableMotor: true, maxMotorTorque: s.torque, motorSpeed: 0, frequencyHz: s.susHz, dampingRatio: s.susDamp }, this.chassis, wb, wb.getPosition(), V(0, 1)));
  }

  // Crash: the crane boom snaps off (hook still hanging from it) and a few body chunks fly out.
  // Debris are real bodies that bounce on the terrain; chunks fade after a few seconds.
  breakApart(tier = 3) {
    const s = this.spec, w = this.world, ch = this.chassis, v = ch.getLinearVelocity(), a = ch.getAngle();
    const L = s.look || {};
    // no abstract chunks: real parts break off (wheels here, accessories in the renderer, the boom below)
    if (tier >= 3 && s.crane && !this.debris.some((d) => d.kind === 'boom')) {
      const c = s.crane, piv = ch.getWorldPoint(V(c.pivot[0], c.pivot[1]));
      const b = w.createDynamicBody({ position: piv, angle: a + c.angle, angularDamping: 0.3 });
      b.createFixture(pl.Box(c.length / 2, 0.2, V(c.length / 2, 0), 0), { density: 0.5, friction: 0.6, restitution: 0.2, filterCategoryBits: CAT_DYN, filterMaskBits: CAT_TERRAIN | CAT_DYN });
      b.setLinearVelocity(V(v.x * 0.6 - 1.5, Math.max(v.y, 0) + 6));
      b.setAngularVelocity(2.5 + Math.random() * 2);
      this.debris.push({ body: b, kind: 'boom' });
      if (this.hookJoint) { w.destroyJoint(this.hookJoint); this.hookJoint = null; }
      this.hookBoomJoint = w.createJoint(pl.RevoluteJoint({}, b, this.hook[0], b.getWorldPoint(V(c.length, 0))));
      for (const h of this.hook) h.getFixtureList().setFilterData({ groupIndex: 0, categoryBits: CAT_DYN, maskBits: CAT_TERRAIN });
    }
    this.events.push({ type: 'breakup', tier });
  }

  tickDebris() {
    if (!this.debris.length) return;
    this.debris = this.debris.filter((d) => {
      if (d.kind !== 'chunk') return true;
      d.ttl -= DT;
      if (d.ttl > 0) return true;
      this.world.destroyBody(d.body); return false;
    });
  }

  holdPose() {
    const p = this.recoverPose; if (!p) return;
    const s = this.spec, zero = V(0, 0);
    const place = (b, px, py) => { b.setTransform(V(px, py), 0); b.setLinearVelocity(zero); b.setAngularVelocity(0); };
    place(this.chassis, p.x, p.y);
    s.wheelX.forEach((wx, i) => place(this.wheels[i], p.x + wx, p.y + s.wheelY));
    if (s.crane) {
      const c = s.crane, tx = c.pivot[0] + Math.cos(c.angle) * c.length, ty = c.pivot[1] + Math.sin(c.angle) * c.length;
      this.hook.forEach((b, i) => place(b, p.x + tx, p.y + ty - c.linkLen * (i + 0.5)));
    }
  }

  // A crash knocks one wheel off; it rolls away as a loose body until recover() bolts it back on.
  get lostWheel() { return this.lostWheels.size ? this.lostWheels.values().next().value : null; }
  loseWheel(i = null) {
    if (i == null) {
      if (this.lostWheels.size) return;
      i = this.wheelTouch[0] <= 0 && this.wheelTouch[1] > 0 ? 0 : this.wheelTouch[1] <= 0 ? 1 : (Math.random() < 0.5 ? 0 : 1);
    }
    const j = this.joints[i]; if (!j || this.lostWheels.has(i)) return;
    this.world.destroyJoint(j); this.joints[i] = null; this.lostWheels.add(i);
    const wb = this.wheels[i], v = wb.getLinearVelocity();
    wb.setLinearVelocity(V(v.x + (i === 0 ? -2.5 : 2.5), v.y + 4));
    wb.setAngularVelocity(wb.getAngularVelocity() * 0.5 - 12);
    this.events.push({ type: 'wheelOff', idx: i });
  }

  // How hard did the truck run into something? Approach speed along the contact normal.
  // Collected during the step and handled after it (the world is locked inside callbacks).
  noteImpact(c, u, o, fo) {
    const wm = c.getWorldManifold(null); if (!wm || !wm.points.length) return;
    const carIsA = c.getFixtureA().getUserData() === u;
    const n = carIsA ? wm.normal : V(-wm.normal.x, -wm.normal.y);   // from the truck into the obstacle
    const pt = wm.points[0], cb = (carIsA ? c.getFixtureA() : c.getFixtureB()).getBody(), ob = fo.getBody();
    // the truck as a whole (chassis velocity): wheel spin and suspension bounce are not impacts
    const vc = this.chassis.getLinearVelocity(), vo = ob.getLinearVelocityFromWorldPoint(pt);
    const v = (vc.x - vo.x) * n.x + (vc.y - vo.y) * n.y;
    if (v < 2.5) return;
    const side = Math.abs(n.x) > 0.6;                     // a wall / step face, not the road under the wheels
    if (u.part === 'wheel' && !side) return;               // wheels landing on the road: that is a landing, not a crash
    const heavy = !ob.isDynamic() || ob.getMass() > this.mass * 0.6;
    // a wall, not a ledge: near-vertical face hit at axle height or above (a wheel cannot roll over it), or the body itself
    const wall = Math.abs(n.x) > 0.95 && (u.part !== 'wheel' || pt.y > cb.getPosition().y - this.spec.wheelR * 0.15);
    // smash: a loose obstacle you can knock over (crates, logs, barrels, dominoes, boulders) - the only kind that throws debris
    this.impacts.push({ x: pt.x, y: pt.y, nx: n.x, ny: n.y, v, side, wall, heavy, part: u.part, style: o.style, prop: !!o.prop, smash: !!o.smash });
  }

  // After the step: debris for every real hit, and a very hard hit into something heavy tips the truck over.
  handleImpacts() {
    if (!this.impacts.length) return;
    const ch = this.chassis;
    let best = null;
    for (const im of this.impacts) if (!best || im.v > best.v) best = im;
    this.impacts.length = 0;
    if (this.time - (this.lastImpactT ?? -9) < 0.12) return;
    this.lastImpactT = this.time;
    if (best.heavy) { this.lastHardV = best.v; this.lastHardT = this.time; }
    this.events.push({ type: 'impact', ...best });
    if (this.state !== 'run') return;
  }

  // The crane boom is taller than the finish gate: when its tip passes the banner it clangs into it.
  // Debris and the hook swinging back (the banner is light: it does not stop the truck).
  checkBanner() {
    const s = this.spec;
    if (!s.crane || this.bannerHit || this.finishX == null || this.debris.some((d) => d.kind === 'boom')) return;
    const c = s.crane, ch = this.chassis;
    const a = ch.getWorldPoint(V(c.pivot[0], c.pivot[1])), b = ch.getWorldPoint(V(c.pivot[0] + Math.cos(c.angle) * c.length, c.pivot[1] + Math.sin(c.angle) * c.length));
    const x0 = this.finishX - 0.25, x1 = this.finishX + 0.25, y0 = this.finishY + 3.45, y1 = this.finishY + 4.35;
    // sample the boom segment against the banner box
    for (let i = 0; i <= 8; i++) {
      const px = a.x + (b.x - a.x) * i / 8, py = a.y + (b.y - a.y) * i / 8;
      if (px >= x0 && px <= x1 && py >= y0 && py <= y1) {
        this.bannerHit = true;
        // the boom is over the line: that counts as crossing it (so the knock below can never cost the win)
        if (this.state === 'run') { this.state = 'win'; this.finishTime = this.time; this.events.push({ type: 'win' }); }
        const sp = Math.abs(ch.getLinearVelocity().x);
        for (const h of this.hook) { const hv = h.getLinearVelocity(); h.setLinearVelocity(V(hv.x - sp * 0.8, hv.y + 2)); }
        this.events.push({ type: 'bannerHit', x: this.finishX, y: py, v: sp });
        return;
      }
    }
  }

  contacts() {
    const handle = (c, delta) => {
      const fa = c.getFixtureA(), fb = c.getFixtureB();
      const ua = fa.getUserData() || {}, ub = fb.getUserData() || {};
      for (const [u, o, fo] of [[ua, ub, fb], [ub, ua, fa]]) {
        if (u.kind !== 'car') continue;
        if (o.kind === 'ground') {
          if (delta > 0) this.noteImpact(c, u, o, fo);
          if (u.part === 'wheel') this.wheelTouch[u.idx] = Math.max(0, this.wheelTouch[u.idx] + delta);
          else if (u.part === 'head') { if (o.prop) this.headProp = Math.max(0, (this.headProp || 0) + delta); else this.headTouch = Math.max(0, this.headTouch + delta); }
          if (delta > 0 && o.prop) this.events.push({ type: 'bonk', style: o.style });
          if (delta > 0 && o.style === 'pad' && o.pad) this.events.push({ type: 'pad', p: o.pad });
        } else if (delta > 0 && o.kind === 'gem' && !o.gem.taken) {
          o.gem.taken = true; this.gemsTaken++;
          this.events.push({ type: 'gem', gem: o.gem });
        } else if (delta > 0 && o.kind === 'finish' && this.state === 'run') {
          this.state = 'win'; this.finishTime = this.time;
          this.events.push({ type: 'win' });
        } else if (delta > 0 && o.kind === 'boost') {
          this.events.push({ type: 'boost', p: o.p });
        }
      }
    };
    this.world.on('begin-contact', (c) => handle(c, 1));
    this.world.on('end-contact', (c) => handle(c, -1));
  }

  get airborne() { return this.wheelTouch[0] <= 0 && this.wheelTouch[1] <= 0; }
  get x() { return this.chassis.getPosition().x; }
  get progress() { return this.finishX ? Math.min(1, Math.max(0, (this.x - this.startX) / (this.finishX - this.startX))) : 0; }

  step(throttle) {
    const s = this.spec;
    if (this.freeze > 0) {
      this.freeze -= DT; this.time += DT;
      this.world.step(DT, 8, 3); this.tickDebris(); this.impacts.length = 0;
      this.holdPose();
      if (this.freeze <= 0) { this.state = 'run'; this.events.push({ type: 'recovered' }); }
      return;
    }
    const running = this.state === 'run';
    const t = running ? throttle : 0;
    for (const j of this.joints) {
      if (!j) continue;
      if (t !== 0) { j.setMotorSpeed(-t * s.speed); j.setMaxMotorTorque(s.torque); }
      else { j.setMotorSpeed(0); j.setMaxMotorTorque(this.state === 'win' ? s.torque * 0.6 : s.torque * 0.06); }
    }
    const air = this.airborne;
    if (!air && t !== 0 && running) {
      // engine torque reaction: strongest when the wheels are spinning up (standstill, hard reverse),
      // fades out at speed. Hold it long enough and the truck wheelies over -> flip.
      const wv = Math.abs(this.wheels[0].getAngularVelocity() + this.wheels[1].getAngularVelocity()) / 2;
      const slip = Math.max(0, 1 - wv / s.speed);
      const vx = this.chassis.getLinearVelocity().x;
      const against = (t > 0 && vx < -1) || (t < 0 && vx > 1) ? 1.3 : 1;   // braking into reverse kicks harder
      const kick = t < 0 ? (s.wheelie ?? 2.4) : (s.wheelie ?? 2.4) * 0.25;   // reverse kicks hardest
      this.chassis.setAngularVelocity(this.chassis.getAngularVelocity() + t * kick * slip * against * DT);
    }
    if (air) {
      this.airTime += DT;
      if (t !== 0) {
        // throttle / brake in the air pitch the truck a little (wheel inertia), not like a jetpack
        const av = this.chassis.getAngularVelocity() + t * s.air * 0.55 * DT;
        this.chassis.setAngularVelocity(Math.max(-3.2, Math.min(3.2, av)));
      }
    } else {
      if (this.airTime > 0.45) this.events.push({ type: 'land', v: this.airTime });
      this.airTime = 0;
    }
    // boost pads (science world): applied while overlapping
    for (const k of this.kinematics) {
      const p = k.piece, ph = (this.time / (p.period || 3)) * Math.PI * 2 + (p.phase || 0);
      if (p.t === 'mover') {
        const f = (2 * Math.PI) / (p.period || 3);
        k.body.setLinearVelocity(V((p.dx || 0) * f * Math.cos(ph) / 2, (p.dy || 0) * f * Math.cos(ph) / 2));
      } else {
        k.body.setAngularVelocity(p.speed || 1);
      }
    }
    for (const b of this.tracked) { const q = this.prev.get(b), pos = b.getPosition(); q.x = pos.x; q.y = pos.y; q.a = b.getAngle(); }
    this.world.step(DT, 8, 3);
    this.time += DT;
    this.tickDebris();
    this.handleImpacts();
    this.checkBanner();

    for (const e of this.events) {
      if ((e.type === 'pad' || e.type === 'boost') && this.padCooldown <= 0) {
        const p = e.p, v = this.chassis.getLinearVelocity();
        const nv = V(Math.max(v.x, p.vx ?? 0) + (p.ax ?? 0), Math.max(v.y, p.vy ?? 10));
        this.chassis.setLinearVelocity(nv);
        this.wheels.forEach((w) => w.setLinearVelocity(nv));
        this.padCooldown = 0.5; e.applied = true;
      }
    }
    if (this.padCooldown > 0) this.padCooldown -= DT;

    if (this.state === 'run') {
      const pos = this.chassis.getPosition();
      this.maxX = Math.max(this.maxX, pos.x);
      // roof on solid ground: instant crash. Roof on a prop (crate, domino...) or resting upside down: a short grace period.
      let a = this.chassis.getAngle() % (Math.PI * 2); if (a > Math.PI) a -= Math.PI * 2; if (a < -Math.PI) a += Math.PI * 2;
      const v = this.chassis.getLinearVelocity(), slow = Math.abs(v.x) + Math.abs(v.y) < 1.5;
      if (this.headTouch > 0) {
        this.headTime += DT;
        if (this.headTime > 0.1) this.fail('crash');
      } else if (((this.headProp || 0) > 0 && Math.abs(a) > 1.1) || (Math.abs(a) > 2.0 && slow)) {   // a crate on the roof of an upright truck is just a dent
        this.headTime += DT;
        if (this.headTime > 0.6) this.fail('crash');
      } else this.headTime = 0;
      if (!this.dunked && pos.y < (this.level.water ?? -4) + 0.5) { this.dunked = true; this.events.push({ type: 'dunk' }); }
      if (pos.y < (this.level.water ?? -4) - 1.2) this.fail('splash');
      if (pos.x < (this.level.minX ?? -12)) this.fail('lost');
    }
  }

  fail(reason) {
    if (this.state !== 'run') return;
    this.state = 'fail'; this.reason = reason;
    this.failPose = this.classifyPose(reason);
    if (reason === 'crash') {
      // how bad was it? speed going in, the hardest recent hit, how fast it was spinning
      const v = this.chassis.getLinearVelocity(), hit = this.time - (this.lastHardT ?? -9) < 0.6 ? this.lastHardV : 0;
      const sev = Math.max(Math.hypot(v.x, v.y), hit) + Math.abs(this.chassis.getAngularVelocity()) * 0.6;
      this.severity = sev; this.tier = sev < 4.5 ? 1 : sev < 9 ? 2 : 3;
      // a gentle roll-over keeps everything on; a medium crash loses an axle; a big one sends both flying
      if (this.tier >= 2) this.loseWheel();
      if (this.tier >= 3) this.loseWheel(this.lostWheel === 0 ? 1 : 0);
      this.breakApart(this.tier);
    }
    this.events.push({ type: 'fail', reason, pose: this.failPose });
  }

  // How did we crash? Used for funny captions and stickers.
  classifyPose(reason) {
    let a = this.chassis.getAngle() % (Math.PI * 2);
    if (a > Math.PI) a -= Math.PI * 2; if (a < -Math.PI) a += Math.PI * 2;
    const v = this.chassis.getLinearVelocity();
    if (reason === 'lost') return 'lost';
    if (reason === 'splash') {
      if (Math.abs(a) > 2.2) return 'splashRoof';
      if (v.x < 1 && this.maxX - this.x > 2.5) return 'splashShort';   // fell off the edge backwards / short jump
      return Math.abs(this.chassis.getAngularVelocity()) > 2.5 ? 'splashSpin' : 'splash';
    }
    if (Math.abs(a) > 2.3) return 'roof';
    if (a < -0.8) return 'nose';
    if (a > 0.8) return 'backflip';
    return 'crash';
  }

  // Put the truck back on its wheels near x without rebuilding the level (scenery keeps its state).
  // The caller animates the flip; physics is frozen for `hold` seconds meanwhile.
  recover(x, hold = 0.8) {
    const s = this.spec;
    // find a spot where both wheels sit on roughly level static ground
    let gx = x, gy = null;
    const span = Math.max(...s.wheelX.map(Math.abs)) + 0.3;
    for (let i = 0; i < 80 && gy == null; i++) {
      const a = this.groundAt(gx - span), b = this.groundAt(gx + span), c = this.groundAt(gx);
      if (a != null && b != null && c != null && Math.abs(a - b) < 0.5 && c <= Math.max(a, b) + 0.3) gy = Math.max(a, b);
      else gx -= 0.5;   // walk back towards the start: a respawn never skips an obstacle
    }
    if (gy == null || gx < this.startX) { gx = this.startX; gy = this.level.start?.y || 0; }
    const from = { x: this.x, y: this.chassis.getPosition().y, a: this.chassis.getAngle() };
    const cy = gy + s.wheelR - s.wheelY + 0.08;
    const zero = V(0, 0);
    const place = (b, px, py, ang = 0) => { b.setTransform(V(px, py), ang); b.setLinearVelocity(zero); b.setAngularVelocity(0); b.setAwake(true); };
    place(this.chassis, gx, cy);
    s.wheelX.forEach((wx, i) => { place(this.wheels[i], gx + wx, cy + s.wheelY); if (!this.joints[i]) this.joints[i] = this.makeJoint(this.wheels[i]); });
    this.lostWheels.clear();
    if (s.crane) {
      const c = s.crane, tx = c.pivot[0] + Math.cos(c.angle) * c.length, ty = c.pivot[1] + Math.sin(c.angle) * c.length;
      this.hook.forEach((b, i) => place(b, gx + tx, cy + ty - c.linkLen * (i + 0.5)));
      // bolt the boom back on: drop the broken boom body, re-hang the hook from the truck
      const boom = this.debris.find((d) => d.kind === 'boom');
      if (boom) {
        if (this.hookBoomJoint) { this.world.destroyJoint(this.hookBoomJoint); this.hookBoomJoint = null; }
        this.world.destroyBody(boom.body); this.debris = this.debris.filter((d) => d !== boom);
      }
      if (!this.hookJoint) this.hookJoint = this.world.createJoint(pl.RevoluteJoint({}, this.chassis, this.hook[0], V(gx + tx, cy + ty)));
      for (const h of this.hook) h.getFixtureList().setFilterData({ groupIndex: 0, categoryBits: 0, maskBits: 0 });
    }
    this.recoverPose = { x: gx, y: cy };
    this.headTouch = 0; this.headProp = 0; this.headTime = 0; this.airTime = 0; this.wheelTouch = [0, 0];
    for (const b of this.tracked) { const q = this.prev.get(b), pos = b.getPosition(); q.x = pos.x; q.y = pos.y; q.a = b.getAngle(); }
    this.state = 'recover'; this.reason = ''; this.freeze = hold;
    this.maxX = Math.max(this.maxX, gx);
    const to = { x: gx, y: cy, a: 0 };
    this.events.push({ type: 'recover', from, to, hold });
    return to;
  }

  // Render pose of a body, blended between the previous and current physics step (alpha 0..1).
  pose(b, alpha = 1) {
    const pos = b.getPosition(), a = b.getAngle(), q = this.prev.get(b);
    if (!q || alpha >= 1) return { x: pos.x, y: pos.y, a };
    return { x: q.x + (pos.x - q.x) * alpha, y: q.y + (pos.y - q.y) * alpha, a: q.a + (a - q.a) * alpha };
  }

  // Highest static ground surface at x (for respawns), or null over a gap.
  groundAt(x) {
    let best = null;
    this.world.rayCast(V(x, 40), V(x, -20), (f, pt, n, frac) => {
      const u = f.getUserData();
      if (!u || u.kind !== 'ground' || f.getBody().isDynamic() || f.isSensor()) return -1;
      if (best == null || pt.y > best) best = pt.y;
      return frac;
    });
    return best;
  }

  drainEvents() { const e = this.events; this.events = []; return e; }
}
