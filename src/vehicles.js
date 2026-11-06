// Vehicle catalogue: physics stats + visual config. Shared by sim, renderer and shop.
// Coordinates are chassis-local (metres), +x = forward.

const base = {
  wheelR: 0.62,
  wheelX: [-1.1, 1.1],      // rear, front
  wheelY: -0.45,
  chassis: { hw: 1.75, hh: 0.28 },
  heads: [{ x: 0.7, y: 0.6, hw: 0.55, hh: 0.33 }],
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
    look: { type: 'pickup', body: 0xe8333c, bodyDark: 0xb31f2a, frame: 0x55565e, frameDark: 0x3c3d44 },
    speed: 24, torque: 25, density: 1.0, air: 8.5,
  },
  {
    ...base,
    id: 'hauler', name: 'Block Hauler', price: 3500,
    desc: 'Heavy blue hauler. Climbs anything.',
    look: { type: 'hauler', body: 0x2f7cf6, bodyDark: 0x1f58c0, frame: 0x55565e, frameDark: 0x3c3d44 },
    speed: 19, torque: 38, density: 1.5, grip: 1.9, air: 6.5,
    heads: [{ x: 0.95, y: 0.62, hw: 0.5, hh: 0.34 }],
  },
  {
    ...base,
    id: 'dozer', name: 'Dozer Dash', price: 5500,
    desc: 'Bulldozer blade up front. Pushes crates aside.',
    look: { type: 'dozer', body: 0xffd21a, bodyDark: 0xd9a800, frame: 0x4a4b52, frameDark: 0x333339 },
    speed: 20, torque: 36, density: 1.4, grip: 1.8,
    heads: [{ x: 0.0, y: 0.62, hw: 0.6, hh: 0.34 }],
    blade: true,
  },
  {
    ...base,
    id: 'mixer', name: 'Mixer Max', price: 6500,
    desc: 'Spinning drum, low centre of gravity.',
    look: { type: 'mixer', body: 0xf2f2f2, bodyDark: 0xcfcfd6, accent: 0xff7a1a, frame: 0x55565e, frameDark: 0x3c3d44 },
    speed: 22, torque: 32, density: 1.3, air: 7,
    heads: [{ x: 1.05, y: 0.6, hw: 0.45, hh: 0.33 }, { x: -0.55, y: 0.6, hw: 0.9, hh: 0.3 }],
  },
  {
    ...base,
    id: 'rover', name: 'Lab Rover', price: 11000,
    desc: 'Science buggy with gyro: best air control.',
    look: { type: 'rover', body: 0x2ee6c8, bodyDark: 0x17b39a, accent: 0xffffff, frame: 0x3a4152, frameDark: 0x262b38 },
    speed: 24, torque: 30, density: 1.0, air: 11, wheelR: 0.66, susHz: 3.6,
  },
  {
    ...base,
    id: 'knight', name: 'Iron Knight', price: 15000,
    desc: 'Armoured medieval monster. Tanky and grippy.',
    look: { type: 'knight', body: 0x8a5cf0, bodyDark: 0x6438c9, accent: 0xffcf3a, frame: 0x8d93a3, frameDark: 0x646a7a },
    speed: 22, torque: 37, density: 1.4, grip: 2.0, air: 8,
  },
  {
    ...base,
    id: 'titan', name: 'Gold Titan', price: 22000,
    desc: 'The ultimate truck. Fast, strong, golden.',
    look: { type: 'pickup', body: 0xffc61a, bodyDark: 0xe09a00, accent: 0xffffff, frame: 0x2e2f36, frameDark: 0x1d1e23 },
    speed: 27, torque: 41, density: 1.2, grip: 2.0, air: 10, wheelR: 0.68,
  },
  // ---- added in 2.1
  {
    ...base,
    id: 'icecream', name: 'Scoop Truck', price: 1500,
    desc: 'Ice-cream van with a giant cone on the roof.',
    look: { type: 'icecream', body: 0xffa8d0, bodyDark: 0xf07ab0, accent: 0xffffff, frame: 0x55565e, frameDark: 0x3c3d44 },
    speed: 21, torque: 27, density: 1.1, air: 7,
    heads: [{ x: 0.2, y: 0.75, hw: 1.3, hh: 0.4 }],
  },
  {
    ...base,
    id: 'taxi', name: 'Turbo Taxi', price: 2500,
    desc: 'Checker-stripe cab. Quick and light.',
    look: { type: 'taxi', body: 0xffd21a, bodyDark: 0xe0a800, frame: 0x2e2f36, frameDark: 0x1d1e23 },
    speed: 23, torque: 28, density: 1.1, air: 8,
  },
  {
    ...base,
    id: 'tractor', name: 'Farm Tractor', price: 4500,
    desc: 'Slow, grippy farm muscle.',
    look: { type: 'tractor', body: 0x3fae4a, bodyDark: 0x2f8c3a, accent: 0xffd21a, frame: 0x3c3d44, frameDark: 0x2a2b31 },
    speed: 18, torque: 42, density: 1.5, grip: 2.1, air: 6.5,
    heads: [{ x: -0.35, y: 0.75, hw: 0.55, hh: 0.45 }],
  },
  {
    ...base,
    id: 'police', name: 'Patrol Monster', price: 8000,
    desc: 'Black-and-white cruiser with flashing lights.',
    look: { type: 'police', body: 0x1d1e26, bodyDark: 0x0f1016, accent: 0xffffff, frame: 0x3c3d44, frameDark: 0x2a2b31 },
    speed: 25, torque: 31, air: 8.5,
  },
  {
    ...base,
    id: 'garbage', name: 'Trash Titan', price: 9500,
    desc: 'Heavy garbage truck. Bulldozes anything.',
    look: { type: 'garbage', body: 0x2fae5a, bodyDark: 0x1f8a42, accent: 0xffffff, frame: 0x55565e, frameDark: 0x3c3d44 },
    speed: 20, torque: 40, density: 1.5, grip: 1.8, air: 6.5,
    heads: [{ x: 1.25, y: 0.62, hw: 0.45, hh: 0.34 }, { x: -0.5, y: 0.75, hw: 1.2, hh: 0.4 }],
  },
  {
    ...base,
    id: 'fire', name: 'Blaze Engine', price: 13000,
    desc: 'Fire truck with a ladder and light bar.',
    look: { type: 'fire', body: 0xe8333c, bodyDark: 0xb31f2a, accent: 0xffffff, frame: 0x55565e, frameDark: 0x3c3d44 },
    speed: 21, torque: 36, density: 1.4, grip: 1.8, air: 7.5,
    heads: [{ x: 0.95, y: 0.62, hw: 0.5, hh: 0.34 }, { x: -0.6, y: 0.65, hw: 1.1, hh: 0.35 }],
  },
  {
    ...base,
    id: 'dino', name: 'Dino Crusher', price: 18000,
    desc: 'A monster truck that is also a dinosaur.',
    look: { type: 'dino', body: 0x5ac84a, bodyDark: 0x3a9a32, accent: 0xff8a1a, frame: 0x3c3d44, frameDark: 0x2a2b31 },
    speed: 24, torque: 40, density: 1.3, grip: 1.9, air: 9,
  },
  {
    ...base,
    id: 'rocket', name: 'Rocket Racer', price: 28000,
    desc: 'Fins, a booster and the best air control.',
    look: { type: 'rocket', body: 0xf4f4f8, bodyDark: 0xc8c9d6, accent: 0xe8333c, frame: 0x3c3d44, frameDark: 0x2a2b31 },
    speed: 29, torque: 38, density: 1.0, air: 12,
    heads: [{ x: 0.3, y: 0.5, hw: 0.7, hh: 0.25 }],
  },
];

// ---- upgrades: 5 levels per stat, bought with gems
export const UPGRADES = [
  { id: 'speed', name: 'Speed', key: 'speed', pct: 0.04, lo: 16, hi: 31 },
  { id: 'power', name: 'Power', key: 'torque', pct: 0.05, lo: 20, hi: 52 },
  { id: 'grip', name: 'Grip', key: 'grip', pct: 0.04, lo: 1.2, hi: 2.5 },
  { id: 'air', name: 'Air', key: 'air', pct: 0.07, lo: 5, hi: 17 },
  // stability: less wheelie kick, a self-righting push on two wheels, survives harder wall hits (added, base 0)
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
