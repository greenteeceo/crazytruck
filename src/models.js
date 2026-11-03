// Voxel models built from boxes: trucks, wheels, gems, finish gate, decorations.
import * as THREE from 'three';
import { tex } from './textures.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

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

// Merge crisp dark edge lines over every box/cylinder of a model (voxel "ink" look).
const outlineMat = new THREE.LineBasicMaterial({ color: 0x14141c, transparent: true, opacity: 0.55 });
const edgeCache = new Map();
export function addOutline(group, mat2 = outlineMat) {
  group.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(group.matrixWorld).invert();
  const pos = [], v = new THREE.Vector3(), m = new THREE.Matrix4();
  group.traverse((o) => {
    if (!o.isMesh || o.userData.noOutline) return;
    let e = edgeCache.get(o.geometry.uuid);
    if (!e) { e = new THREE.EdgesGeometry(o.geometry, 25).attributes.position; edgeCache.set(o.geometry.uuid, e); }
    m.multiplyMatrices(inv, o.matrixWorld);
    for (let i = 0; i < e.count; i++) { v.fromBufferAttribute(e, i).applyMatrix4(m); pos.push(v.x, v.y, v.z); }
  });
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const lines = new THREE.LineSegments(g, mat2); lines.userData.outline = true;
  group.add(lines);
  return lines;
}

const BLACK = 0x1c1c22, TIRE = 0x26262c, TIRE2 = 0x34343b, SILVER = 0xc9ccd6, SILVER2 = 0x8d91a0, GLASS = 0x15161c, WHITE = 0xfafafa, RED = 0xff2a3a;

// ---------------------------------------------------------------- wheels
// Chunky voxel monster-truck tyre: knobby cube treads around a thick rim, inset hub cap.
// Geometry is merged per colour so a 6-truck race stays cheap.
const wheelCache = new Map();
const RIM = 0xd5d8e0, RIM_D = 0x9a9fad, BOLT = 0x6b6f7c;
export function buildWheel(r, look) {
  const key = r.toFixed(2);
  if (!wheelCache.has(key)) wheelCache.set(key, makeWheelGeo(r));
  const { dark, light, rim, rimD, bolt } = wheelCache.get(key);
  const g = new THREE.Group();
  for (const [geo, c, flat] of [[dark, TIRE, true], [light, TIRE2, true], [rim, RIM, false], [rimD, RIM_D, false], [bolt, BOLT, false]]) {
    const m = new THREE.Mesh(geo, mat(c, { flatShading: flat })); m.castShadow = true; m.receiveShadow = true; g.add(m);
  }
  addOutline(g);
  return g;
}

// Monster tyre like the reference: thick drum, 12 big block lugs alternating across the tread,
// round silver rim with a recessed lip, 8 bolts and a centre cap.
function makeWheelGeo(r) {
  const W = 0.64;
  const dark = [], light = [], rim = [], rimD = [], bolt = [];
  const bx = (arr, x0, y0, z0, x1, y1, z1, rot = 0) => {
    const geo = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0);
    geo.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    if (rot) geo.rotateZ(rot);
    arr.push(geo);
  };
  const disc = (arr, rad, z0, z1, seg = 24) => {
    const geo = new THREE.CylinderGeometry(rad, rad, Math.abs(z1 - z0), seg);
    geo.rotateX(Math.PI / 2); geo.translate(0, 0, (z0 + z1) / 2); arr.push(geo);
  };
  for (const side of [-1, 1]) {
    const zc = side * 0.86, out = zc + side * W / 2;
    // tyre body
    const drum = new THREE.CylinderGeometry(r * 0.8, r * 0.8, W, 16); drum.rotateX(Math.PI / 2); drum.translate(0, 0, zc); dark.push(drum);
    // big block lugs: each lug covers ~60% of the width, alternating left/right, plus a centre bridge
    const n = 16, lw = r * 0.3;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2, left = i % 2 === 0;
      const z0 = left ? zc - W / 2 - 0.02 : zc - W * 0.08, z1 = left ? zc + W * 0.08 : zc + W / 2 + 0.02;
      bx(left ? dark : light, r * 0.74, -lw / 2, z0, r * 1.0, lw / 2, z1, a);
      bx(light, r * 0.74, -lw * 0.32, zc - W * 0.2, r * 0.9, lw * 0.32, zc + W * 0.2, a + Math.PI / n);
    }
    // rim: dark lip, silver face, bolt ring, centre cap
    disc(rimD, r * 0.56, out - side * 0.02, out + side * 0.03);
    disc(rim, r * 0.5, out + side * 0.02, out + side * 0.07);
    disc(rimD, r * 0.2, out + side * 0.06, out + side * 0.1, 16);
    disc(rim, r * 0.15, out + side * 0.09, out + side * 0.13, 16);
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2, rr = r * 0.34;
      const b = new THREE.CylinderGeometry(0.035, 0.035, 0.04, 8); b.rotateX(Math.PI / 2);
      b.translate(Math.cos(a) * rr, Math.sin(a) * rr, out + side * 0.08); bolt.push(b);
    }
    // inner side: plain dark-silver plate
    disc(rimD, r * 0.42, zc - side * (W / 2 + 0.03), zc - side * W / 2);
  }
  const merge = (arr) => mergeGeometries(arr, false);
  return { dark: merge(dark), light: merge(light), rim: merge(rim), rimD: merge(rimD), bolt: merge(bolt) };
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
    box(g, -1.76, -0.3, z - 0.11, -1.54, 0.62, z + 0.11, L.body);          // orange post
    box(g, -1.8, 0.62, z - 0.15, -1.5, 0.76, z + 0.15, 0x8d91a0);          // cap
    box(g, -1.8, -0.44, z - 0.15, -1.5, -0.3, z + 0.15, 0x8d91a0);         // foot pad
    box(g, -1.72, -0.3, z - 0.06, -1.58, -0.2, z + 0.06, 0x3c3d44);
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
      const ORANGE = L.body, OD = L.bodyDark, OL = 0xffb23a, G = L.frame, GD = L.frameDark, GL = 0x8d91a0;
      // ---- cab (front): tall box, big windshield, side windows, darker roof lip, beacon box on top
      box(g, 0.2, 0.06, -0.66, 1.2, 1.08, 0.66, ORANGE);
      box(g, 0.14, 1.02, -0.7, 1.26, 1.1, 0.7, OD);                       // roof lip
      box(g, 0.26, 1.1, -0.56, 1.14, 1.16, 0.56, OD);                      // roof top
      box(g, 1.2, 0.5, -0.56, 1.23, 1.0, 0.56, GLASS);                     // windshield
      zbox(g, 0.42, 0.5, 0.66, 1.1, 1.0, 0.69, GLASS);                     // side windows
      box(g, 0.14, 0.5, -0.5, 0.2, 1.0, 0.5, OD);                          // rear cab wall
      cbox(g, 0.5, 1.26, 0, 0.5, 0.2, 0.5, G); cbox(g, 0.5, 1.4, 0, 0.36, 0.08, 0.36, GL);   // beacon box
      // ---- hood: short step in front of the cab, grille slot + white lamps at the corners
      box(g, 1.2, 0.06, -0.66, 1.86, 0.62, 0.66, ORANGE);
      box(g, 1.2, 0.62, -0.58, 1.8, 0.68, 0.58, OD);
      box(g, 1.86, 0.06, -0.66, 1.9, 0.62, 0.66, OD);                      // nose
      box(g, 1.9, 0.38, -0.26, 1.93, 0.5, 0.26, GLASS);                    // grille
      zbox(g, 1.9, 0.14, 0.3, 1.95, 0.32, 0.62, WHITE);                    // headlights
      box(g, 1.82, 0.0, -0.72, 1.98, 0.1, 0.72, GD);                       // front bumper
      // ---- fenders over the front wheels
      zbox(g, 0.55, 0.06, 0.66, 1.75, 0.16, 0.8, OD);
      // ---- rear deck (dark grey) with side rails
      box(g, -1.8, 0.06, -0.78, 0.2, 0.3, 0.78, G);
      zbox(g, -1.8, 0.3, 0.68, 0.2, 0.4, 0.78, GD);
      box(g, -1.84, 0.02, -0.74, -1.78, 0.34, 0.74, GD);                   // rear plate
      zbox(g, -1.88, 0.1, 0.36, -1.82, 0.26, 0.56, RED);                   // tail lights
      // ---- turntable (hazard stripes) + crane house
      hazardRing(g, -0.78, 0.46, 0.66, 0.26);
      box(g, -1.4, 0.59, -0.56, -0.16, 1.2, 0.56, G);                      // house
      box(g, -1.44, 1.16, -0.6, -0.12, 1.24, 0.6, GD);                     // house roof
      zbox(g, -1.34, 0.72, 0.56, -0.26, 1.1, 0.585, GL);                   // side panel (lighter)
      zbox(g, -0.6, 0.8, 0.585, -0.3, 1.06, 0.61, ORANGE);                 // orange square on the side
      box(g, -1.44, 0.66, -0.16, -1.4, 1.14, 0.16, ORANGE);                // orange stripe on the back
      cbox(g, -0.78, 1.28, 0, 0.3, 0.08, 0.3, GL);                         // pivot cap
      outriggers(g, L);
      // ---- telescopic boom: 3 orange sections with lighter collars, grey head
      const c = spec.crane;
      const boom = new THREE.Group(); boom.position.set(c.pivot[0], c.pivot[1], 0); boom.rotation.z = c.angle; g.add(boom);
      const secs = [[-0.35, 1.35, 0.22], [1.25, 2.35, 0.17], [2.25, c.length - 0.18, 0.12]];
      secs.forEach(([x0, x1, h], i) => {
        box(boom, x0, -h, -h, x1, h, h, i === 2 ? OL : ORANGE);
        box(boom, x0 + 0.05, h, -h * 0.75, x1 - 0.05, h + 0.05, h * 0.75, i === 2 ? ORANGE : OD);   // top ridge
      });
      for (const bx of [1.3, 2.3]) box(boom, bx - 0.12, -0.27, -0.27, bx + 0.12, 0.27, 0.27, OL);   // collars
      box(boom, -0.35, -0.3, -0.3, -0.1, 0.3, 0.3, OD);                                              // base block
      cbox(boom, c.length, 0, 0, 0.4, 0.4, 0.4, G);                                                  // head
      cbox(boom, c.length, 0, 0.21, 0.2, 0.2, 0.04, GL); cbox(boom, c.length, 0, -0.21, 0.2, 0.2, 0.04, GL);
      // ---- hydraulic cylinder: dark barrel from the deck, silver rod up to the boom
      const pis = new THREE.Group(); pis.position.set(-0.3, 0.72, 0); g.add(pis);
      const tip = new THREE.Vector3(c.pivot[0] + Math.cos(c.angle) * 1.2, c.pivot[1] + Math.sin(c.angle) * 1.2 - 0.2, 0);
      const d = tip.clone().sub(pis.position); pis.rotation.z = Math.atan2(d.y, d.x);
      cbox(pis, 0.05, 0, 0, 0.22, 0.26, 0.26, GD);
      box(pis, 0.1, -0.1, -0.1, d.length() * 0.55, 0.1, 0.1, 0x4f525c);
      box(pis, d.length() * 0.5, -0.055, -0.055, d.length(), 0.055, 0.055, 0xdfe2ea);
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
  addOutline(g);
  return parts;
}

export function buildHookLink(isHook) {
  const g = new THREE.Group();
  if (!isHook) { cbox(g, 0, 0, 0, 0.16, 0.16, 0.16, 0x6b6f7c); box(g, -0.04, -0.14, -0.04, 0.04, 0.14, 0.04, 0x2a2b31); return g; }
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

export function buildFinish(width = 4.2) {
  const g = new THREE.Group();
  const hz = width / 2 + 0.1;
  for (const z of [-hz, hz]) {
    box(g, -0.25, -0.3, z - 0.25, 0.25, 4.2, z + 0.25, 0x8d93a3);
    for (const y of [0.6, 1.8, 3.0]) box(g, -0.28, y, z - 0.28, 0.28, y + 0.2, z + 0.28, 0x646a7a);
    box(g, -0.04, 4.2, z - 0.04, 0.04, 5.4, z + 0.04, 0x3c3d44);
    const flag = box(g, 0.04, 4.9, z - 0.02, 0.7, 5.35, z + 0.02, RED);
    flag.userData.wave = true;
  }
  const cm = () => { const t = tex('checker').clone(); t.needsUpdate = true; t.repeat.set(width * 1.2, 1); return new THREE.MeshLambertMaterial({ map: t }); };
  const dark = mat(0x1d1d22);
  const banner = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.9, width + 0.4), [dark, dark, dark, dark, dark, dark]);
  const side = cm(); side.map.rotation = Math.PI / 2; side.map.repeat.set(1, width * 1.2);
  banner.material[0] = side; banner.material[1] = side;
  banner.position.set(0, 3.9, 0); banner.castShadow = true; g.add(banner);
  // checkered strip on the ground
  const stripT = tex('checker').clone(); stripT.needsUpdate = true; stripT.repeat.set(1, width);
  const strip = new THREE.Mesh(new THREE.PlaneGeometry(1.0, width), new THREE.MeshLambertMaterial({ map: stripT, polygonOffset: true, polygonOffsetFactor: -2 }));
  strip.rotation.x = -Math.PI / 2; strip.position.y = 0.03; strip.receiveShadow = true; strip.userData.noOutline = true; g.add(strip);
  return g;
}

// Rolling boulder (race obstacle)
export function boulder(r, style) {
  const g = new THREE.Group();
  const geo = new THREE.IcosahedronGeometry(r, 0);
  const col = style === 'snow' ? 0xe9f1ff : style === 'barrel' ? 0x2f7cf6 : 0x9aa0ae;
  const m = new THREE.Mesh(geo, mat(col, { flatShading: true })); m.castShadow = true; m.receiveShadow = true; g.add(m);
  const band = new THREE.Mesh(new THREE.IcosahedronGeometry(r * 1.02, 0), mat(0x7d8292, { flatShading: true, wireframe: false }));
  band.scale.set(0.35, 1, 1); g.add(band);
  addOutline(g);
  return g;
}

// Swinging hammer: group origin = pivot, hangs along -y
export function pendulum(p, depth) {
  const g = new THREE.Group();
  box(g, -0.09, -p.len, -0.09, 0.09, 0, 0.09, 0x3c3d44);
  const bob = new THREE.Group(); bob.position.y = -p.len; g.add(bob);
  const t = tex('hazard').clone(); t.needsUpdate = true; t.repeat.set(1.5, 1);
  const m = new THREE.Mesh(new THREE.BoxGeometry(p.bw, p.bh, depth), [mat(0xe8333c), mat(0xe8333c), new THREE.MeshLambertMaterial({ map: t }), mat(0xe8333c), new THREE.MeshLambertMaterial({ map: t }), new THREE.MeshLambertMaterial({ map: t })]);
  m.castShadow = true; bob.add(m);
  cbox(bob, 0, 0, depth / 2 + 0.02, p.bw * 0.5, p.bh * 0.5, 0.06, 0xffffff);
  addOutline(g);
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
    case 'cactus': {
      const c = 0x3fae4a, d = 0x2f8c3a, h = 1.4 + rnd() * 0.8;
      box(g, -0.18, 0, -0.18, 0.18, h, 0.18, c);
      box(g, 0.18, h * 0.45, -0.12, 0.5, h * 0.45 + 0.22, 0.12, c); box(g, 0.36, h * 0.45, -0.12, 0.54, h * 0.8, 0.12, c);
      box(g, -0.48, h * 0.6, -0.12, -0.18, h * 0.6 + 0.2, 0.12, d); box(g, -0.5, h * 0.6, -0.12, -0.32, h * 0.9, 0.12, d);
      cbox(g, 0, h + 0.06, 0, 0.14, 0.12, 0.14, 0xff6a9a); break;
    }
    case 'pine': {
      const h = 0.5 + rnd() * 0.3;
      box(g, -0.15, 0, -0.15, 0.15, h, 0.15, 0x7a4a2a);
      [[1.5, 0.6], [1.15, 0.55], [0.8, 0.5], [0.45, 0.45]].forEach(([w, hh], i) => { const y = h + i * 0.48; cbox(g, 0, y + hh / 2, 0, w, hh, w, 0x2f8a5a); cbox(g, 0, y + hh - 0.04, 0, w * 0.9, 0.1, w * 0.9, 0xffffff); });
      break;
    }
    case 'snowman':
      cbox(g, 0, 0.35, 0, 0.7, 0.7, 0.7, 0xffffff); cbox(g, 0, 0.95, 0, 0.5, 0.5, 0.5, 0xffffff); cbox(g, 0, 1.4, 0, 0.36, 0.36, 0.36, 0xffffff);
      cbox(g, 0.22, 1.4, 0, 0.18, 0.06, 0.06, 0xff8a1a); cbox(g, 0, 1.64, 0, 0.42, 0.06, 0.42, 0x2a2b31); cbox(g, 0, 1.78, 0, 0.26, 0.24, 0.26, 0x2a2b31);
      cbox(g, 0, 1.15, 0, 0.54, 0.1, 0.54, 0xe8333c); break;
    case 'palm': {
      const h = 2.2 + rnd() * 0.8;
      for (let i = 0; i < 6; i++) cbox(g, i * 0.06, i * (h / 6) + h / 12, 0, 0.26, h / 6, 0.26, i % 2 ? 0xb07a4a : 0x9a6638);
      const tx = 0.36;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [0.7, 0.7], [-0.7, -0.7]]) {
        const leaf = new THREE.Group(); leaf.position.set(tx, h, 0); leaf.rotation.y = Math.atan2(-dz, dx); g.add(leaf);
        box(leaf, 0, -0.06, -0.14, 0.9, 0.06, 0.14, 0x3cc85a); box(leaf, 0.7, -0.3, -0.12, 1.1, -0.06, 0.12, 0x2fae4a);
      }
      cbox(g, tx, h - 0.12, 0.14, 0.16, 0.16, 0.16, 0x7a4a2a); break;
    }
    case 'umbrella': {
      box(g, -0.04, 0, -0.04, 0.04, 1.8, 0.04, 0xeeeeee);
      const cols = [0xff4a5a, 0xffffff];
      for (let i = 0; i < 4; i++) cbox(g, 0, 1.8 - i * 0.08, 0, 1.6 - i * 0.3, 0.1, 1.6 - i * 0.3, cols[i % 2]);
      cbox(g, 0.6, 0.12, 0.3, 1.0, 0.1, 0.6, 0x3ab8ff); break;
    }
    case 'lollipop': {
      box(g, -0.05, 0, -0.05, 0.05, 1.6, 0.05, 0xffffff);
      const c = [0xff4a8a, 0x4ac8ff, 0xffd23a][(rnd() * 3) | 0];
      cbox(g, 0, 1.9, 0, 0.8, 0.8, 0.16, c); cbox(g, 0, 1.9, 0.02, 0.5, 0.5, 0.16, 0xffffff); cbox(g, 0, 1.9, 0.04, 0.26, 0.26, 0.16, c); break;
    }
    case 'candycane': {
      for (let i = 0; i < 7; i++) cbox(g, 0, 0.12 + i * 0.24, 0, 0.18, 0.24, 0.18, i % 2 ? 0xffffff : 0xff3a5a);
      cbox(g, 0.18, 1.78, 0, 0.18, 0.18, 0.18, 0xff3a5a); cbox(g, 0.36, 1.66, 0, 0.18, 0.2, 0.18, 0xffffff); cbox(g, 0.36, 1.48, 0, 0.18, 0.18, 0.18, 0xff3a5a); break;
    }
    case 'ember': {
      cbox(g, 0, 0.3, 0, 0.9, 0.6, 0.8, 0x2e2934); cbox(g, 0.3, 0.2, 0.2, 0.5, 0.4, 0.5, 0x3a3340);
      const f = cbox(g, 0, 0.66, 0, 0.3, 0.14, 0.3, 0xff8a2a, { emissive: 0xff4a00 }); f.userData.flicker = true;
      cbox(g, -0.3, 0.45, 0.41, 0.24, 0.06, 0.02, 0xff6a1a, { emissive: 0xff3a00 }); break;
    }
    case 'building': {
      const h = 3 + rnd() * 3, w = 1.4 + rnd() * 0.6, c = [0x2a3060, 0x3a2a60, 0x202a4a][(rnd() * 3) | 0];
      box(g, -w / 2, 0, -0.6, w / 2, h, 0.6, c);
      for (let y = 0.5; y < h - 0.4; y += 0.6) for (let x = -w / 2 + 0.25; x < w / 2 - 0.2; x += 0.45) if (rnd() < 0.7) box(g, x, y, 0.6, x + 0.24, y + 0.3, 0.62, rnd() < 0.5 ? 0xffe27a : 0x7ae8ff, { emissive: 0x6a5a20 });
      box(g, -w / 2 - 0.05, h, -0.65, w / 2 + 0.05, h + 0.12, 0.65, 0x161a36); break;
    }
    case 'barrelDeco': {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.9, 10), mat(0x9a6638, { flatShading: true })); m.position.y = 0.45; m.castShadow = true; g.add(m);
      for (const y of [0.18, 0.72]) { const r2 = new THREE.Mesh(new THREE.CylinderGeometry(0.37, 0.37, 0.08, 10), mat(0x55565e, { flatShading: true })); r2.position.y = y; g.add(r2); }
      break;
    }
    case 'flag':
      box(g, -0.05, 0, -0.05, 0.05, 2.8, 0.05, 0x5b3a1e);
      { const f = box(g, 0.05, 2.0, -0.03, 0.95, 2.7, 0.03, 0x1d1d22); f.userData.wave = true; }
      cbox(g, 0.5, 2.35, 0.04, 0.24, 0.24, 0.02, 0xffffff); break;
    case 'antenna':
      box(g, -0.08, 0, -0.08, 0.08, 1.6, 0.08, 0xc9ccd6); cbox(g, 0, 1.8, 0, 0.9, 0.08, 0.9, 0xdfe2ea);
      box(g, -0.03, 1.8, -0.03, 0.03, 2.3, 0.03, 0x8d91a0); { const l = cbox(g, 0, 2.35, 0, 0.12, 0.12, 0.12, 0xff3a3a, { emissive: 0xaa0000 }); l.userData.flicker = true; }
      break;
    case 'crystal': {
      const c = [0x7ae8ff, 0xb48aff, 0xff7ab8][(rnd() * 3) | 0];
      [[0, 0, 0.36, 1.4, 0], [0.32, 0.1, 0.26, 0.9, 0.35], [-0.28, 0.05, 0.24, 0.8, -0.4]].forEach(([x, z, w, h, a]) => {
        const m = new THREE.Mesh(new THREE.OctahedronGeometry(1, 0), mat(c, { flatShading: true, emissive: 0x224466, transparent: true, opacity: 0.9 }));
        m.scale.set(w, h, w); m.position.set(x, h * 0.75, z); m.rotation.z = a; m.castShadow = true; g.add(m);
      });
      break;
    }
    case 'coral': {
      const c = [0xff6a8a, 0xffa04a, 0xb47aff][(rnd() * 3) | 0];
      box(g, -0.12, 0, -0.12, 0.12, 1.1, 0.12, c); box(g, 0.12, 0.4, -0.1, 0.5, 0.6, 0.1, c); box(g, 0.32, 0.6, -0.1, 0.5, 1.0, 0.1, c);
      box(g, -0.5, 0.6, -0.1, -0.12, 0.78, 0.1, c); box(g, -0.5, 0.78, -0.1, -0.32, 1.3, 0.1, c);
      cbox(g, 0, 1.16, 0, 0.3, 0.12, 0.3, 0xffffff); break;
    }
    case 'autumnTree': {
      const h = 1.2 + rnd() * 1.0;
      box(g, -0.2, 0, -0.2, 0.2, h, 0.2, 0x7a4a2a);
      const c = [0xf28a2a, 0xe8562a, 0xffc23a][(rnd() * 3) | 0];
      cbox(g, 0, h + 0.4, 0, 1.6, 0.9, 1.6, c); cbox(g, 0, h + 1.1, 0, 1.1, 0.7, 1.1, c); cbox(g, 0.2, h + 1.6, 0.1, 0.6, 0.45, 0.6, c); break;
    }
    case 'pumpkin':
      cbox(g, 0, 0.3, 0, 0.8, 0.6, 0.7, 0xff8a1a); cbox(g, 0, 0.3, 0, 0.6, 0.62, 0.72, 0xf07a10); cbox(g, 0, 0.68, 0, 0.12, 0.18, 0.12, 0x4a7a2a); break;
    case 'toyblock': {
      const c = [0xff4a4a, 0x3a9aff, 0xffd23a, 0x4ac85a][(rnd() * 4) | 0], w = 0.8 + rnd() * 0.6;
      cbox(g, 0, 0.4, 0, w, 0.8, 0.8, c);
      for (let x = -w / 2 + 0.2; x < w / 2; x += 0.4) for (const z of [-0.2, 0.2]) { const st = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.12, 10), mat(c)); st.position.set(x, 0.86, z); g.add(st); }
      break;
    }
    case 'neonpost':
      box(g, -0.06, 0, -0.06, 0.06, 2.6, 0.06, 0x24104a);
      cbox(g, 0, 2.7, 0, 0.18, 0.5, 0.18, [0xff3fd0, 0x3af0ff][(rnd() * 2) | 0], { emissive: 0xaa2a99 }); break;
    case 'cloudpuff':
      cbox(g, 0, 0.5, 0, 1.6, 0.6, 1.0, 0xffffff); cbox(g, 0.3, 0.9, 0, 0.9, 0.5, 0.8, 0xffffff); cbox(g, -0.4, 0.8, 0.1, 0.7, 0.4, 0.7, 0xf2f6ff); break;
    default: break;
  }
  return g;
}
