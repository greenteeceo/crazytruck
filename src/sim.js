// Deterministic 2D physics simulation of one truck on one level (planck / Box2D).
import * as pl from 'planck';

const V = pl.Vec2;
export const DT = 1 / 60;
const CAT_TERRAIN = 0x0001, CAT_CAR = 0x0002, CAT_DYN = 0x0004;

const FRICTION = { grass: 0.9, dirt: 0.9, wood: 0.95, stone: 0.85, concrete: 0.85, girder: 0.8, metal: 0.75, castle: 0.85, ice: 0.08, sand: 0.9, pad: 0.8 };

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
          b.createFixture(pl.Box(p.w / 2, p.h / 2), this.fixtureOpts(p.s, { density: p.d ?? 0.5, filterCategoryBits: CAT_DYN, userData: { kind: 'ground', style: p.s } }));
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
          this.finishX = p.x;
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
      const j = w.createJoint(pl.WheelJoint({ enableMotor: true, maxMotorTorque: s.torque, motorSpeed: 0, frequencyHz: s.susHz, dampingRatio: s.susDamp }, ch, wb, wb.getPosition(), V(0, 1)));
      this.wheels.push(wb); this.joints.push(j);
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
        w.createJoint(pl.RevoluteJoint({}, prev, b, V(px, py - c.linkLen * i)));
        this.hook.push(b); prev = b;
      }
    }
    this.mass = ch.getMass() + this.wheels.reduce((a, b) => a + b.getMass(), 0);
    this.startX = (this.level.start || { x: 0 }).x;
  }

  contacts() {
    const handle = (c, delta) => {
      const fa = c.getFixtureA(), fb = c.getFixtureB();
      const ua = fa.getUserData() || {}, ub = fb.getUserData() || {};
      for (const [u, o, fo] of [[ua, ub, fb], [ub, ua, fa]]) {
        if (u.kind !== 'car') continue;
        if (o.kind === 'ground') {
          if (u.part === 'wheel') this.wheelTouch[u.idx] += delta;
          else if (u.part === 'head') this.headTouch += delta;
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
    const running = this.state === 'run';
    const t = running ? throttle : 0;
    for (const j of this.joints) {
      if (t !== 0) { j.setMotorSpeed(-t * s.speed); j.setMaxMotorTorque(s.torque); }
      else { j.setMotorSpeed(0); j.setMaxMotorTorque(this.state === 'win' ? s.torque * 0.6 : s.torque * 0.06); }
    }
    const air = this.airborne;
    if (air) {
      this.airTime += DT;
      if (t !== 0) {
        const av = this.chassis.getAngularVelocity() + t * s.air * DT;
        this.chassis.setAngularVelocity(Math.max(-4.5, Math.min(4.5, av)));
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
    this.world.step(DT, 8, 3);
    this.time += DT;

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
      if (this.headTouch > 0) {
        this.headTime += DT;
        if (this.headTime > 0.1) this.fail('crash');
      } else this.headTime = 0;
      if (pos.y < (this.level.water ?? -4) - 1.2) this.fail('splash');
      if (pos.x < (this.level.minX ?? -12)) this.fail('lost');
    }
  }

  fail(reason) {
    if (this.state !== 'run') return;
    this.state = 'fail'; this.reason = reason;
    this.events.push({ type: 'fail', reason });
  }

  drainEvents() { const e = this.events; this.events = []; return e; }
}
