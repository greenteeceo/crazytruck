// Voxel models built from boxes: trucks, wheels, gems, finish gate, decorations.
import * as THREE from 'three';
import { tex } from './textures.js';

const matCache = new Map();
export function mat(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (!matCache.has(key)) matCache.set(key, new THREE.MeshLambertMaterial({ color, ...opts }));
  return matCache.get(key);
}
const boxGeo = new THREE.BoxGeometry(1, 1, 1);

// axis-aligned box from min to max corner
export function box(parent, x0, y0, z0, x1, y1, z1, color, opts) {
  const m = new THREE.Mesh(boxGeo, typeof color === 'object' && color.isMaterial ? color : mat(color, opts));
  m.scale.set(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0));
  m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  m.castShadow = true; m.receiveShadow = true;
  parent.add(m);
  return m;
}
// centred box
export function cbox(parent, x, y, z, w, h, d, color, opts) { return box(parent, x - w / 2, y - h / 2, z - d / 2, x + w / 2, y + h / 2, z + d / 2, color, opts); }
// mirrored on z
function zbox(p, x0, y0, z0, x1, y1, z1, c) { box(p, x0, y0, z0, x1, y1, z1, c); box(p, x0, y0, -z1, x1, y1, -z0, c); }

const BLACK = 0x1c1c22, TIRE = 0x26262c, TIRE2 = 0x34343b, SILVER = 0xc9ccd6, SILVER2 = 0x8d91a0, GLASS = 0x15161c, WHITE = 0xfafafa, RED = 0xff2a3a;

// ---------------------------------------------------------------- wheels
export function buildWheel(r, look) {
  const g = new THREE.Group();
  const W = 0.5;
  for (const side of [-1, 1]) {
    const t = new THREE.Group(); t.position.z = side * 0.86; g.add(t);
    const cyl = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.86, r * 0.86, W, 10), mat(TIRE, { flatShading: true }));
    cyl.rotation.x = Math.PI / 2; cyl.castShadow = true; t.add(cyl);
    const n = 12;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const lug = new THREE.Group(); lug.rotation.z = a; t.add(lug);
      const off = i % 2 ? 0.1 : -0.1;
      box(lug, r * 0.78, -0.13, -W / 2 + (i % 2 ? 0.08 : 0), r, 0.13, W / 2 - (i % 2 ? 0 : 0.08), i % 2 ? TIRE : TIRE2);
      void off;
    }
    // hub
    const hz = side * (W / 2 + 0.02);
    cbox(t, 0, 0, hz, r * 0.62, r * 0.62, 0.06, SILVER);
    cbox(t, 0, 0, hz + side * 0.03, r * 0.4, r * 0.4, 0.06, SILVER2);
    cbox(t, 0, 0, hz + side * 0.06, r * 0.18, r * 0.18, 0.04, 0x6b6f7c);
  }
  return g;
}

// ---------------------------------------------------------------- trucks
function frame(g, L) {
  const f = L.frame, fd = L.frameDark;
  box(g, -1.75, -0.32, -0.7, 1.62, 0.06, 0.7, f);
  box(g, -1.0, -0.6, -0.3, 1.0, -0.32, 0.3, fd);           // driveshaft
  for (const x of [-1.1, 1.1]) box(g, x - 0.12, -0.58, -0.86, x + 0.12, -0.36, 0.86, fd); // axles
  box(g, 1.62, -0.2, -0.74, 1.95, 0.12, 0.74, fd);           // bumper
  box(g, -1.86, -0.2, -0.74, -1.72, 0.1, 0.74, fd);          // rear bumper
  zbox(g, -1.9, -0.05, 0.42, -1.85, 0.12, 0.62, RED);        // tail lights
}

function headlights(g, x) {
  zbox(g, x, 0.28, 0.32, x + 0.06, 0.44, 0.56, WHITE);
  box(g, x, 0.12, -0.24, x + 0.04, 0.22, 0.24, GLASS);
}

function cab(g, L, x0, x1, top, hoodX) {
  const b = L.body, bd = L.bodyDark;
  box(g, x0, 0.06, -0.62, x1, top, 0.62, b);
  box(g, x0 + 0.06, top, -0.56, x1 - 0.12, top + 0.06, 0.56, bd);
  // windows
  zbox(g, x0 + 0.35, top - 0.48, 0.62, x1 - 0.1, top - 0.1, 0.64, GLASS);
  box(g, x1, top - 0.48, -0.5, x1 + 0.02, top - 0.1, 0.5, GLASS);
  // hood
  box(g, x1, 0.06, -0.62, hoodX, top - 0.5, 0.62, b);
  box(g, x1, top - 0.5, -0.5, hoodX - 0.12, top - 0.44, 0.5, bd);
  box(g, hoodX - 0.04, 0.06, -0.62, hoodX + 0.02, top - 0.5, 0.62, bd);
  headlights(g, hoodX);
}

function outriggers(g, L) {
  for (const z of [-0.74, 0.74]) {
    box(g, -1.78, -0.42, z - 0.1, -1.56, 0.5, z + 0.1, L.body);
    box(g, -1.8, 0.42, z - 0.13, -1.54, 0.56, z + 0.13, L.frameDark);
    box(g, -1.8, -0.5, z - 0.13, -1.54, -0.38, z + 0.13, L.frameDark);
  }
}

function hazardRing(g, x, y, r, h) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 16, 1), [new THREE.MeshLambertMaterial({ map: tex('hazard') }), mat(0x3c3d44), mat(0x3c3d44)]);
  const t = tex('hazard').clone(); t.needsUpdate = true; t.repeat.set(5, 0.5); m.material[0].map = t;
  m.position.set(x, y, 0); m.castShadow = true; g.add(m);
  return m;
}

export function buildTruck(spec) {
  const L = spec.look;
  const g = new THREE.Group();
  const parts = { group: g, spin: [] };
  frame(g, L);
  switch (L.type) {
    case 'crane': {
      cab(g, L, 0.05, 1.12, 1.0, 1.82);
      // fenders
      zbox(g, 0.5, 0.0, 0.62, 1.7, 0.12, 0.8, L.bodyDark);
      cbox(g, 0.62, 1.12, 0, 0.42, 0.14, 0.46, 0x4a4b52); cbox(g, 0.62, 1.2, 0, 0.3, 0.06, 0.34, 0x8d91a0); // roof block
      box(g, -1.75, 0.06, -0.75, 0.05, 0.28, 0.75, L.frame);  // deck
      hazardRing(g, -0.72, 0.4, 0.68, 0.24);
      box(g, -1.38, 0.52, -0.56, -0.12, 1.08, 0.56, L.frame);   // crane house
      box(g, -1.42, 0.98, -0.6, -0.08, 1.1, 0.6, L.frameDark);
      zbox(g, -1.0, 0.68, 0.56, -0.62, 0.98, 0.6, L.body);      // orange side panel
      box(g, -1.45, 0.6, -0.3, -1.38, 0.9, 0.3, L.body);
      outriggers(g, L);
      // boom
      const c = spec.crane;
      const boom = new THREE.Group(); boom.position.set(c.pivot[0], c.pivot[1], 0); boom.rotation.z = c.angle; g.add(boom);
      box(boom, -0.3, -0.18, -0.2, 2.3, 0.18, 0.2, L.body);
      box(boom, -0.3, 0.14, -0.16, 2.3, 0.2, 0.16, L.bodyDark);
      box(boom, 2.2, -0.13, -0.15, c.length - 0.05, 0.13, 0.15, 0x6b6c75);
      for (const bx of [0.55, 1.45, 2.2]) box(boom, bx - 0.09, -0.22, -0.24, bx + 0.09, 0.22, 0.24, L.bodyDark);
      cbox(boom, c.length, 0, 0, 0.36, 0.36, 0.36, 0x55565e);
      cbox(boom, c.length, 0, 0.19, 0.16, 0.16, 0.04, SILVER);
      cbox(boom, c.length, 0, -0.19, 0.16, 0.16, 0.04, SILVER);
      // hydraulic piston
      const pis = new THREE.Group(); pis.position.set(-0.25, 0.9, 0); g.add(pis);
      const tip = new THREE.Vector3(c.pivot[0] + Math.cos(c.angle) * 1.15, c.pivot[1] + Math.sin(c.angle) * 1.15 - 0.15, 0);
      const d = tip.clone().sub(pis.position); pis.rotation.z = Math.atan2(d.y, d.x);
      box(pis, 0, -0.09, -0.09, d.length() * 0.55, 0.09, 0.09, 0x2f3036);
      box(pis, d.length() * 0.5, -0.05, -0.05, d.length(), 0.05, 0.05, 0xdfe2ea);
      break;
    }
    case 'pickup': {
      cab(g, L, -0.35, 0.65, 1.0, 1.8);
      zbox(g, 0.5, 0.0, 0.62, 1.7, 0.12, 0.8, L.bodyDark);
      box(g, -1.75, 0.06, -0.66, -0.35, 0.5, 0.66, L.body);
      box(g, -1.6, 0.2, -0.52, -0.42, 0.52, 0.52, L.frameDark);
      // roll bar
      zbox(g, -0.6, 0.5, 0.5, -0.5, 1.15, 0.6, L.frame); box(g, -0.6, 1.08, -0.6, -0.5, 1.18, 0.6, L.frame);
      zbox(g, -0.62, 1.05, 0.2, -0.48, 1.2, 0.4, 0xffe066);
      if (L.accent) zbox(g, -1.7, 0.3, 0.66, 1.75, 0.38, 0.68, L.accent);
      break;
    }
    case 'hauler': {
      cab(g, L, 0.45, 1.2, 1.05, 1.85);
      box(g, -1.8, 0.06, -0.72, 0.38, 0.95, 0.72, L.bodyDark);
      box(g, -1.7, 0.95, -0.62, 0.28, 1.0, 0.62, L.body);
      // stone blocks
      cbox(g, -1.2, 1.2, 0.25, 0.42, 0.42, 0.42, 0xa3a8b6); cbox(g, -0.6, 1.2, -0.2, 0.42, 0.42, 0.42, 0xff8a1f); cbox(g, -0.95, 1.6, 0, 0.4, 0.4, 0.4, 0x46d35c);
      zbox(g, -1.8, 0.3, 0.72, 0.38, 0.4, 0.74, 0xffd21a);
      break;
    }
    case 'dozer': {
      box(g, -1.6, 0.06, -0.66, 1.4, 0.45, 0.66, L.body);
      box(g, -0.6, 0.45, -0.6, 0.6, 1.0, 0.6, L.body);
      box(g, -0.5, 0.5, -0.61, 0.5, 0.92, 0.61, GLASS);
      box(g, -0.65, 1.0, -0.62, 0.65, 1.08, 0.62, L.bodyDark);
      box(g, -1.4, 0.45, 0.25, -1.25, 1.1, 0.4, 0x2f3036);
      // blade
      zbox(g, 1.4, 0.0, 0.3, 1.95, 0.12, 0.42, L.frameDark);
      box(g, 1.92, -0.48, -0.95, 2.12, 0.42, 0.95, L.bodyDark);
      box(g, 2.0, -0.5, -0.95, 2.18, -0.38, 0.95, SILVER2);
      headlights(g, 1.4);
      break;
    }
    case 'mixer': {
      cab(g, L, 0.62, 1.4, 1.0, 1.85);
      box(g, -1.75, 0.06, -0.62, 0.55, 0.28, 0.62, L.frame);
      const drum = new THREE.Group(); drum.position.set(-0.55, 0.78, 0); drum.rotation.z = 0.18; g.add(drum);
      const spinner = new THREE.Group(); drum.add(spinner);
      const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.58, 2.0, 8), mat(L.body, { flatShading: true }));
      cyl.rotation.z = Math.PI / 2; cyl.castShadow = true; spinner.add(cyl);
      for (let i = 0; i < 4; i++) { const s = new THREE.Group(); s.rotation.x = (i / 4) * Math.PI * 2; spinner.add(s); box(s, -0.9, 0.5, -0.08, 0.9, 0.6, 0.08, L.accent); }
      parts.spin.push({ obj: spinner, axis: 'x', speed: 3 });
      break;
    }
    case 'rover': {
      box(g, -1.6, 0.06, -0.6, 1.6, 0.32, 0.6, L.body);
      box(g, 1.2, 0.06, -0.5, 1.8, 0.24, 0.5, L.bodyDark);
      headlights(g, 1.8);
      // cage
      for (const [x0, x1] of [[-0.5, -0.4], [0.7, 0.8]]) zbox(g, x0, 0.32, 0.48, x1, 1.05, 0.56, L.frame);
      box(g, -0.5, 1.0, -0.56, 0.8, 1.08, 0.56, L.frame);
      cbox(g, 0.15, 0.55, 0, 0.5, 0.4, 0.5, L.accent);
      cbox(g, -1.2, 0.55, 0, 0.5, 0.45, 0.8, 0x7df9ff, { emissive: 0x1a8a99 });
      box(g, -1.5, 0.32, 0.3, -1.45, 1.6, 0.35, SILVER);
      cbox(g, -1.47, 1.65, 0.32, 0.12, 0.12, 0.12, 0xff3d6b, { emissive: 0x991133 });
      break;
    }
    case 'knight': {
      cab(g, L, -0.2, 0.8, 1.05, 1.8);
      box(g, -1.75, 0.06, -0.66, -0.2, 0.55, 0.66, L.frame);
      for (let x = -1.65; x < -0.3; x += 0.42) zbox(g, x, 0.55, 0.5, x + 0.22, 0.75, 0.66, L.frame);
      zbox(g, -0.2, 0.9, 0.62, 1.8, 0.98, 0.64, L.accent);
      zbox(g, 1.82, 0.0, 0.5, 2.05, 0.1, 0.6, SILVER);
      box(g, -1.5, 0.55, -0.05, -1.42, 2.0, 0.05, 0x5b3a1e);
      box(g, -1.42, 1.45, -0.03, -0.85, 1.95, 0.03, L.accent);
      box(g, -1.42, 1.55, -0.035, -0.95, 1.85, 0.035, L.body);
      break;
    }
  }
  return parts;
}

export function buildHookLink(isHook) {
  const g = new THREE.Group();
  if (!isHook) { box(g, -0.05, -0.14, -0.05, 0.05, 0.14, 0.05, 0x2a2b31); return g; }
  // hook block + J hook
  cbox(g, 0, 0, 0, 0.3, 0.3, 0.3, 0x55565e);
  cbox(g, 0, 0, 0.16, 0.14, 0.14, 0.03, SILVER);
  box(g, -0.05, -0.38, -0.06, 0.05, -0.15, 0.06, 0x3c3d44);
  box(g, -0.05, -0.48, -0.06, 0.22, -0.38, 0.06, 0x3c3d44);
  box(g, 0.14, -0.48, -0.06, 0.24, -0.3, 0.06, 0x3c3d44);
  return g;
}

// ---------------------------------------------------------------- collectibles & gates
let gemGeo;
export function buildGem() {
  gemGeo ||= new THREE.OctahedronGeometry(0.42, 0);
  const g = new THREE.Group();
  const m = new THREE.Mesh(gemGeo, mat(0xffc61a, { emissive: 0x7a4a00, flatShading: true }));
  m.scale.set(1, 1.05, 0.55); m.castShadow = true; g.add(m);
  const inner = new THREE.Mesh(gemGeo, mat(0xfff1a8, { emissive: 0x806a20, flatShading: true }));
  inner.scale.set(0.5, 0.55, 0.62); g.add(inner);
  return g;
}

export function buildFinish() {
  const g = new THREE.Group();
  for (const z of [-2.1, 2.1]) {
    box(g, -0.25, 0, z - 0.25, 0.25, 4.2, z + 0.25, 0x8d93a3);
    for (const y of [0.6, 1.8, 3.0]) box(g, -0.28, y, z - 0.28, 0.28, y + 0.2, z + 0.28, 0x646a7a);
    box(g, -0.04, 4.2, z - 0.04, 0.04, 5.4, z + 0.04, 0x3c3d44);
    const flag = box(g, 0.04, 4.9, z - 0.02, 0.7, 5.35, z + 0.02, RED);
    flag.userData.wave = true;
  }
  const t = tex('checker').clone(); t.needsUpdate = true; t.repeat.set(5, 1);
  const banner = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.9, 4.6), [mat(0x1d1d22), mat(0x1d1d22), mat(0x1d1d22), mat(0x1d1d22), new THREE.MeshLambertMaterial({ map: t }), new THREE.MeshLambertMaterial({ map: t })]);
  const t2 = tex('checker').clone(); t2.needsUpdate = true; t2.repeat.set(5, 1); t2.rotation = Math.PI / 2;
  banner.material[0] = new THREE.MeshLambertMaterial({ map: t2 }); banner.material[1] = banner.material[0];
  banner.position.set(0, 3.9, 0); banner.castShadow = true; g.add(banner);
  return g;
}

// ---------------------------------------------------------------- decorations
export function buildDeco(kind, rnd = Math.random) {
  const g = new THREE.Group();
  switch (kind) {
    case 'tree': {
      const h = 1.2 + rnd() * 1.2;
      box(g, -0.2, 0, -0.2, 0.2, h, 0.2, 0x9a5b34);
      const c = [0x3ccf52, 0x2fb845, 0x56e06a][(rnd() * 3) | 0];
      cbox(g, 0, h + 0.4, 0, 1.6, 0.9, 1.6, c);
      cbox(g, 0, h + 1.1, 0, 1.1, 0.7, 1.1, c);
      cbox(g, 0.2, h + 1.6, 0.1, 0.6, 0.45, 0.6, c);
      break;
    }
    case 'bush': cbox(g, 0, 0.35, 0, 1.0, 0.7, 0.8, 0x3ccf52); cbox(g, 0.4, 0.25, 0.2, 0.6, 0.5, 0.6, 0x56e06a); cbox(g, -0.2, 0.75, 0, 0.3, 0.2, 0.3, 0xffffff); break;
    case 'rock': cbox(g, 0, 0.3, 0, 0.9, 0.6, 0.8, 0xa3a8b6); cbox(g, 0.35, 0.2, 0.2, 0.5, 0.4, 0.5, 0x8d93a3); cbox(g, -0.1, 0.65, 0, 0.5, 0.2, 0.4, 0xb8bdca); break;
    case 'cone':
      cbox(g, 0, 0.04, 0, 0.6, 0.08, 0.6, 0xff6a1a);
      cbox(g, 0, 0.25, 0, 0.36, 0.34, 0.36, 0xff6a1a); cbox(g, 0, 0.45, 0, 0.28, 0.1, 0.28, 0xffffff); cbox(g, 0, 0.6, 0, 0.18, 0.22, 0.18, 0xff6a1a);
      break;
    case 'barrier': {
      for (const x of [-0.6, 0.6]) { box(g, x - 0.06, 0, -0.25, x + 0.06, 0.9, -0.15, 0x8d6a3a); box(g, x - 0.06, 0, 0.15, x + 0.06, 0.9, 0.25, 0x8d6a3a); }
      const t = tex('hazard').clone(); t.needsUpdate = true; t.repeat.set(1.5, 0.25);
      const m = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ map: t })); m.scale.set(1.6, 0.28, 0.12); m.position.set(0, 0.72, 0); m.castShadow = true; g.add(m);
      cbox(g, -0.6, 1.0, 0, 0.16, 0.16, 0.16, RED, { emissive: 0x880000 }); cbox(g, 0.6, 1.0, 0, 0.16, 0.16, 0.16, RED, { emissive: 0x880000 });
      break;
    }
    case 'crateDeco': { const m = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ map: tex('crate') })); m.scale.set(0.9, 0.9, 0.9); m.position.y = 0.45; m.castShadow = true; g.add(m); break; }
    case 'labcrateDeco': { const m = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ map: tex('labcrate') })); m.scale.set(0.8, 0.8, 0.8); m.position.y = 0.4; m.castShadow = true; g.add(m); break; }
    case 'torch': box(g, -0.07, 0, -0.07, 0.07, 1.3, 0.07, 0x6b4426); cbox(g, 0, 1.38, 0, 0.26, 0.18, 0.26, 0x55565e); { const f = cbox(g, 0, 1.6, 0, 0.2, 0.28, 0.2, 0xffb21a, { emissive: 0xff7a00 }); f.userData.flicker = true; } break;
    case 'banner': box(g, -0.05, 0, -0.05, 0.05, 2.6, 0.05, 0x5b3a1e); box(g, -0.5, 2.5, -0.05, 0.5, 2.6, 0.05, 0x5b3a1e); box(g, -0.45, 1.3, -0.03, 0.45, 2.5, 0.03, 0xe8333c); cbox(g, 0, 1.95, 0.04, 0.3, 0.3, 0.02, 0xffcf3a); break;
    case 'tank': {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 1.6, 8), mat(0x7df9ff, { emissive: 0x1a8a99, transparent: true, opacity: 0.85, flatShading: true })); m.position.y = 1.0; g.add(m);
      cbox(g, 0, 0.1, 0, 1.0, 0.2, 1.0, 0x3b4766); cbox(g, 0, 1.9, 0, 0.9, 0.2, 0.9, 0x3b4766); cbox(g, 0, 2.05, 0, 0.3, 0.15, 0.3, 0xc9ccd6);
      break;
    }
    case 'lamp': box(g, -0.06, 0, -0.06, 0.06, 2.4, 0.06, 0x3b4766); box(g, -0.06, 2.3, -0.06, 0.6, 2.4, 0.06, 0x3b4766); cbox(g, 0.55, 2.25, 0, 0.3, 0.12, 0.3, 0xcaffff, { emissive: 0x66ffff }); break;
    default: break;
  }
  return g;
}
