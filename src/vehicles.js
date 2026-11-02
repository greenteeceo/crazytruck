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
  },
  {
    ...base,
    id: 'rubble', name: 'Rubble Rider', price: 300,
    desc: 'Light red pickup. Fast but twitchy.',
    look: { type: 'pickup', body: 0xe8333c, bodyDark: 0xb31f2a, frame: 0x55565e, frameDark: 0x3c3d44 },
    speed: 24, torque: 25, density: 1.0, air: 8.5,
  },
  {
    ...base,
    id: 'hauler', name: 'Block Hauler', price: 600,
    desc: 'Heavy blue hauler. Climbs anything.',
    look: { type: 'hauler', body: 0x2f7cf6, bodyDark: 0x1f58c0, frame: 0x55565e, frameDark: 0x3c3d44 },
    speed: 19, torque: 38, density: 1.5, grip: 1.9, air: 6.5,
    heads: [{ x: 0.95, y: 0.62, hw: 0.5, hh: 0.34 }],
  },
  {
    ...base,
    id: 'dozer', name: 'Dozer Dash', price: 900,
    desc: 'Bulldozer blade up front. Pushes crates aside.',
    look: { type: 'dozer', body: 0xffd21a, bodyDark: 0xd9a800, frame: 0x4a4b52, frameDark: 0x333339 },
    speed: 20, torque: 36, density: 1.4, grip: 1.8,
    heads: [{ x: 0.0, y: 0.62, hw: 0.6, hh: 0.34 }],
    blade: true,
  },
  {
    ...base,
    id: 'mixer', name: 'Mixer Max', price: 1300,
    desc: 'Spinning drum, low centre of gravity.',
    look: { type: 'mixer', body: 0xf2f2f2, bodyDark: 0xcfcfd6, accent: 0xff7a1a, frame: 0x55565e, frameDark: 0x3c3d44 },
    speed: 22, torque: 32, density: 1.3, air: 7,
    heads: [{ x: 1.05, y: 0.6, hw: 0.45, hh: 0.33 }, { x: -0.55, y: 0.6, hw: 0.9, hh: 0.3 }],
  },
  {
    ...base,
    id: 'rover', name: 'Lab Rover', price: 1800,
    desc: 'Science buggy with gyro: best air control.',
    look: { type: 'rover', body: 0x2ee6c8, bodyDark: 0x17b39a, accent: 0xffffff, frame: 0x3a4152, frameDark: 0x262b38 },
    speed: 24, torque: 30, density: 1.0, air: 11, wheelR: 0.66, susHz: 3.6,
  },
  {
    ...base,
    id: 'knight', name: 'Iron Knight', price: 2500,
    desc: 'Armoured medieval monster. Tanky and grippy.',
    look: { type: 'knight', body: 0x8a5cf0, bodyDark: 0x6438c9, accent: 0xffcf3a, frame: 0x8d93a3, frameDark: 0x646a7a },
    speed: 22, torque: 37, density: 1.4, grip: 2.0, air: 8,
  },
  {
    ...base,
    id: 'titan', name: 'Gold Titan', price: 4000,
    desc: 'The ultimate truck. Fast, strong, golden.',
    look: { type: 'pickup', body: 0xffc61a, bodyDark: 0xe09a00, accent: 0xffffff, frame: 0x2e2f36, frameDark: 0x1d1e23 },
    speed: 27, torque: 41, density: 1.2, grip: 2.0, air: 10, wheelR: 0.68,
  },
];

export const vehicleById = (id) => VEHICLES.find((v) => v.id === id) || VEHICLES[0];
