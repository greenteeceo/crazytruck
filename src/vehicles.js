// Vehicle catalogue: physics stats + visual config. Shared by sim, renderer and shop.
// Coordinates are chassis-local (metres), +x = forward.

// Every truck has the hero's body for physics (wheels, chassis, cab boxes, weight): the voxel models differ,
// the handling is the same family. Pricier trucks are a little faster / stronger / grippier, never so much
// that a jump overshoots: every level is checked with the hero, the strongest truck and max upgrades.
const base = {
  wheelR: 0.72,
  wheelX: [-1.1, 1.1],      // rear, front
  wheelY: -0.5,
  chassis: { hw: 1.75, hh: 0.28 },
  heads: [{ x: 0.7, y: 0.6, hw: 0.55, hh: 0.33 }, { x: -0.7, y: 0.52, hw: 0.55, hh: 0.24 }],   // the hero's cab boxes (crash detection)
  density: 1.2,
  wheelDensity: 0.8,
  grip: 1.6,
  speed: 21,        // wheel angular speed rad/s
  torque: 29,       // per wheel
  air: 7.5,         // air pitch accel rad/s^2
  susHz: 4.2,
  susDamp: 0.65,
  crane: null,
};

export const VEHICLES = [
  {
    ...base,
    id: 'crane', name: 'Crane Rush', price: 0,
    desc: 'Telescoping crane, chunky tread tires. The hero.',
    look: { type: 'crane', body: 0xff9a14, bodyDark: 0xe07800, frame: 0x55565e, frameDark: 0x3c3d44 },
    heads: [{ x: 0.7, y: 0.6, hw: 0.55, hh: 0.33 }, { x: -0.7, y: 0.52, hw: 0.55, hh: 0.24 }],
    crane: { pivot: [-0.6, 0.85], angle: 0.5, length: 3.3, links: 3, linkLen: 0.28 },
    wheelR: 0.72, wheelY: -0.5,
  },
  {
    ...base,
    id: 'rubble', name: 'Rubble Rider', price: 2000,
    desc: 'Light red pickup. Fast but twitchy.',
    speed: 21.6, torque: 29.5, grip: 1.6, air: 8.3,
    look: { type: 'pickup', body: 0xe8333c, bodyDark: 0xb31f2a, frame: 0x55565e, frameDark: 0x3c3d44 },
  },
  {
    ...base,
    id: 'hauler', name: 'Block Hauler', price: 3500,
    desc: 'Heavy blue hauler. Climbs anything.',
    speed: 21.2, torque: 32.5, grip: 1.75, air: 7.6,
    look: { type: 'hauler', body: 0x2f7cf6, bodyDark: 0x1f58c0, frame: 0x55565e, frameDark: 0x3c3d44 },
  },
  {
    ...base,
    id: 'dozer', name: 'Dozer Dash', price: 5500,
    desc: 'Bulldozer blade up front. Pushes crates aside.',
    speed: 21.4, torque: 33, grip: 1.75, air: 7.8,
    look: { type: 'dozer', body: 0xffd21a, bodyDark: 0xd9a800, frame: 0x4a4b52, frameDark: 0x333339 },
  },
  {
    ...base,
    id: 'mixer', name: 'Mixer Max', price: 6500,
    desc: 'Spinning drum, low centre of gravity.',
    speed: 21.8, torque: 31.5, grip: 1.7, air: 8.0,
    look: { type: 'mixer', body: 0xf2f2f2, bodyDark: 0xcfcfd6, accent: 0xff7a1a, frame: 0x55565e, frameDark: 0x3c3d44 },
  },
  {
    ...base,
    id: 'rover', name: 'Lab Rover', price: 11000,
    desc: 'Science buggy with gyro: best air control.',
    speed: 22.0, torque: 31.5, grip: 1.7, air: 9.6,
    look: { type: 'rover', body: 0x2ee6c8, bodyDark: 0x17b39a, accent: 0xffffff, frame: 0x3a4152, frameDark: 0x262b38 },
  },
  {
    ...base,
    id: 'knight', name: 'Iron Knight', price: 15000,
    desc: 'Armoured medieval monster. Tanky and grippy.',
    speed: 22.1, torque: 33, grip: 1.85, air: 8.6,
    look: { type: 'knight', body: 0x8a5cf0, bodyDark: 0x6438c9, accent: 0xffcf3a, frame: 0x8d93a3, frameDark: 0x646a7a },
  },
  {
    ...base,
    id: 'titan', name: 'Gold Titan', price: 22000,
    desc: 'The ultimate truck. Fast, strong, golden.',
    speed: 22.4, torque: 34, grip: 1.85, air: 9.2,
    look: { type: 'pickup', body: 0xffc61a, bodyDark: 0xe09a00, accent: 0xffffff, frame: 0x2e2f36, frameDark: 0x1d1e23 },
  },
  // ---- added in 2.1
  {
    ...base,
    id: 'icecream', name: 'Scoop Truck', price: 1500,
    desc: 'Ice-cream van with a giant cone on the roof.',
    speed: 21.3, torque: 30, grip: 1.65, air: 7.8,
    look: { type: 'icecream', body: 0xffa8d0, bodyDark: 0xf07ab0, accent: 0xffffff, frame: 0x55565e, frameDark: 0x3c3d44 },
  },
  {
    ...base,
    id: 'taxi', name: 'Turbo Taxi', price: 2500,
    desc: 'Checker-stripe cab. Quick and light.',
    speed: 21.8, torque: 30, grip: 1.65, air: 8.0,
    look: { type: 'taxi', body: 0xffd21a, bodyDark: 0xe0a800, frame: 0x2e2f36, frameDark: 0x1d1e23 },
  },
  {
    ...base,
    id: 'tractor', name: 'Farm Tractor', price: 4500,
    desc: 'Slow, grippy farm muscle.',
    speed: 21.1, torque: 33.5, grip: 1.8, air: 7.6,
    look: { type: 'tractor', body: 0x3fae4a, bodyDark: 0x2f8c3a, accent: 0xffd21a, frame: 0x3c3d44, frameDark: 0x2a2b31 },
  },
  {
    ...base,
    id: 'police', name: 'Patrol Monster', price: 8000,
    desc: 'Black-and-white cruiser with flashing lights.',
    speed: 22.2, torque: 31, grip: 1.7, air: 8.6,
    look: { type: 'police', body: 0x1d1e26, bodyDark: 0x0f1016, accent: 0xffffff, frame: 0x3c3d44, frameDark: 0x2a2b31 },
  },
  {
    ...base,
    id: 'garbage', name: 'Trash Titan', price: 9500,
    desc: 'Heavy garbage truck. Bulldozes anything.',
    speed: 21.5, torque: 34, grip: 1.8, air: 7.8,
    look: { type: 'garbage', body: 0x2fae5a, bodyDark: 0x1f8a42, accent: 0xffffff, frame: 0x55565e, frameDark: 0x3c3d44 },
  },
  {
    ...base,
    id: 'fire', name: 'Blaze Engine', price: 13000,
    desc: 'Fire truck with a ladder and light bar.',
    speed: 21.9, torque: 33, grip: 1.8, air: 8.2,
    look: { type: 'fire', body: 0xe8333c, bodyDark: 0xb31f2a, accent: 0xffffff, frame: 0x55565e, frameDark: 0x3c3d44 },
  },
  {
    ...base,
    id: 'dino', name: 'Dino Crusher', price: 18000,
    desc: 'A monster truck that is also a dinosaur.',
    speed: 22.3, torque: 33.5, grip: 1.85, air: 9.0,
    look: { type: 'dino', body: 0x5ac84a, bodyDark: 0x3a9a32, accent: 0xff8a1a, frame: 0x3c3d44, frameDark: 0x2a2b31 },
  },
  {
    ...base,
    id: 'rocket', name: 'Rocket Racer', price: 28000,
    desc: 'Fins, a booster and the best air control.',
    speed: 22.5, torque: 33, grip: 1.75, air: 9.6,
    look: { type: 'rocket', body: 0xf4f4f8, bodyDark: 0xc8c9d6, accent: 0xe8333c, frame: 0x3c3d44, frameDark: 0x2a2b31 },
  },
];

// ---- upgrades: 5 levels per stat, bought with gems
export const UPGRADES = [
  { id: 'speed', name: 'Speed', key: 'speed', pct: 0.025, lo: 16, hi: 31 },   // small: faster trucks still land their jumps
  { id: 'power', name: 'Power', key: 'torque', pct: 0.05, lo: 20, hi: 52 },
  { id: 'grip', name: 'Grip', key: 'grip', pct: 0.04, lo: 1.2, hi: 2.5 },
  { id: 'air', name: 'Air', key: 'air', pct: 0.07, lo: 5, hi: 17 },
  // stability: ballast low in the chassis, a lower centre of mass (fewer flips) (added, base 0)
  { id: 'stability', name: 'Stability', key: 'stab', add: 0.25, lo: 0, hi: 1.25 },
];
export const MAX_UPGRADE = 5;
// level 1 costs 3% of the truck price (min 150), each further level costs more: maxing every stat of a truck
// costs ~1.9x its price (Rocket Racer: ~52k), a long-term sink that stays reachable
export const upgradeCost = (v, lvl) => Math.round((Math.max(150, v.price * 0.03) * (1 + lvl * 0.75)) / 10) * 10;
export function withUpgrades(v, ups = {}) {
  const out = { ...v };
  for (const u of UPGRADES) out[u.key] = u.add ? (v[u.key] || 0) + u.add * (ups[u.id] || 0) : v[u.key] * (1 + u.pct * (ups[u.id] || 0));
  return out;
}

export const vehicleById = (id) => VEHICLES.find((v) => v.id === id) || VEHICLES[0];
