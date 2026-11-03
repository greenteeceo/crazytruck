// Three.js renderer: level scene, trucks, particles, camera, menu dioramas.
import * as THREE from 'three';
import { tex, skyTexture } from './textures.js';
import { mat, box, cbox, buildTruck, buildWheel, buildHookLink, buildGem, buildFinish, buildDeco, boulder, pendulum, addOutline } from './models.js';

const D = 4; // terrain depth (z)

const STYLE = {
  grass: { top: 'grassTop', side: 'dirt', cap: ['grassTop', 'grassSide'] },
  desert: { top: 'desertTop', side: 'sandstone' },
  snow: { top: 'snowTop', side: 'frozenDirt', cap: ['snowTop', 'snowSide'] },
  jungle: { top: 'jungleTop', side: 'mud', cap: ['jungleTop', 'jungleSide'] },
  basalt: { top: 'basaltTop', side: 'basalt', emissive: 0x220800 },
  candy: { top: 'candyTop', side: 'candy', cap: ['candyTop', 'candySide'] },
  beach: { top: 'beachTop', side: 'sandstone' },
  asphalt: { top: 'asphaltTop', side: 'asphalt' },
  docks: { top: 'docksTop', side: 'wood' },
  moon: { top: 'moonTop', side: 'moon' },
  mars: { top: 'marsTop', side: 'mars' },
  coral: { top: 'coralTop', side: 'coral', cap: ['coralTop', 'coralSide'] },
  autumn: { top: 'autumnTop', side: 'dirt', cap: ['autumnTop', 'autumnSide'] },
  icecave: { top: 'iceTop', side: 'ice' },
  toy: { top: 'toyTop', side: 'toy' },
  neon: { top: 'neonTop', side: 'neon', emissive: 0x140628 },
  cloudgrass: { top: 'grassTop', side: 'cloudTop', cap: ['grassTop', 'grassSide'] },
  dirt: { top: 'dirt', side: 'dirt' },
  sand: { top: 'sand', side: 'sand' },
  wood: { top: 'plank', side: 'wood' },
  stone: { top: 'castleTop', side: 'stone' },
  castle: { top: 'castleTop', side: 'castle' },
  concrete: { top: 'concreteTop', side: 'concrete' },
  girder: { top: 'girder', side: 'girder' },
  metal: { top: 'metalTop', side: 'metal' },
  pad: { top: 'pad', side: 'metal', emissive: 0x0a7d99 },
  crate: { top: 'crate', side: 'crate' },
  labcrate: { top: 'labcrate', side: 'labcrate' },
  log: { top: 'log', side: 'log' },
  barrel: { top: 'barrel', side: 'barrel' },
};
const texMats = {};
function tmat(name, emissive) {
  const k = name + (emissive || '');
  if (!texMats[k]) texMats[k] = new THREE.MeshLambertMaterial({ map: tex(name), ...(emissive ? { emissive, emissiveIntensity: 0.6 } : {}) });
  return texMats[k];
}
const styleMats = (s) => { const st = STYLE[s] || STYLE.concrete; return [tmat(st.top, st.emissive), tmat(st.side)]; };

// Extrude a 2D convex polygon into a terrain prism with world-space box-projected UVs
function prismGeo(pts, depth = D, zc = 0) {
  const shape = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
  let g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
  g.translate(0, 0, zc - depth / 2);
  g = g.toNonIndexed(); g.computeVertexNormals();
  const pos = g.attributes.position, nor = g.attributes.normal;
  const top = [], side = [];
  for (let i = 0; i < pos.count; i += 3) {
    const ny = (nor.getY(i) + nor.getY(i + 1) + nor.getY(i + 2)) / 3;
    (ny > 0.45 ? top : side).push(i);
  }
  const P = [], N = [], U = [];
  const push = (i) => {
    for (let k = 0; k < 3; k++) {
      const x = pos.getX(i + k), y = pos.getY(i + k), z = pos.getZ(i + k);
      const nx = nor.getX(i + k), ny = nor.getY(i + k), nz = nor.getZ(i + k);
      P.push(x, y, z); N.push(nx, ny, nz);
      const ax = Math.abs(nx), ay = Math.abs(ny), az = Math.abs(nz);
      if (ay >= ax && ay >= az) U.push(x, z); else if (az >= ax) U.push(x, y); else U.push(z, y);
    }
  };
  top.forEach(push); side.forEach(push);
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  out.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
  out.addGroup(0, top.length * 3, 0); out.addGroup(top.length * 3, side.length * 3, 1);
  return out;
}

function piecePoly(p) {
  if (p.t === 'poly') return p.pts;
  const c = Math.cos(p.a || 0), s = Math.sin(p.a || 0), hw = p.w / 2, hh = p.h / 2;
  return [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].map(([x, y]) => [p.x + x * c - y * s, p.y + x * s + y * c]);
}

const capMats = {};
// grass cap along a top edge
function capMesh(x0, y0, x1, y1, depth = D + 0.08, cap = ['grassTop', 'grassSide']) {
  const len = Math.hypot(x1 - x0, y1 - y0), ang = Math.atan2(y1 - y0, x1 - x0);
  const h = 0.42;
  const geo = new THREE.BoxGeometry(len + 0.04, h, depth);
  const uv = geo.attributes.uv;
  for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) {
    const i = f * 4 + k;
    if (f === 2 || f === 3) uv.setXY(i, uv.getX(i) * len, uv.getY(i) * depth);
    else if (f === 4 || f === 5) uv.setXY(i, uv.getX(i) * len, uv.getY(i));
    else uv.setXY(i, uv.getX(i) * depth, uv.getY(i));
  }
  const side = capMats[cap[1]] ||= new THREE.MeshLambertMaterial({ map: tex(cap[1]), transparent: true, alphaTest: 0.5 });
  const top = tmat(cap[0]);
  const m = new THREE.Mesh(geo, [side, side, top, top, side, side]);
  m.position.set((x0 + x1) / 2 - Math.sin(ang) * -0.0, (y0 + y1) / 2 - h / 2 + 0.06, 0);
  m.rotation.z = ang; m.receiveShadow = true; m.castShadow = false;
  return m;
}

function texturedBox(w, h, d, style) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const uv = geo.attributes.uv;
  const sizes = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) { const i = f * 4 + k; uv.setXY(i, uv.getX(i) * sizes[f][0], uv.getY(i) * sizes[f][1]); }
  const [top, side] = styleMats(style);
  const cube = ['crate', 'labcrate', 'barrel'].includes(style);
  if (cube) { for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / sizes[(i / 4) | 0][0], uv.getY(i) / sizes[(i / 4) | 0][1]); }
  const m = new THREE.Mesh(geo, [side, side, top, top, side, side]);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

function nameSprite(text, color = '#ffffff') {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64;
  const g = c.getContext('2d');
  g.font = '700 34px Fredoka, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 8; g.strokeStyle = '#11131c'; g.strokeText(text, 128, 34); g.fillStyle = color; g.fillText(text, 128, 34);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true }));
  s.scale.set(3.2, 0.8, 1); s.renderOrder = 10;
  return s;
}

let rseed = 1;
const srand = () => ((rseed = (rseed * 16807) % 2147483647) / 2147483647);

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.r = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.applyPixelRatio();
    this.r.outputColorSpace = THREE.SRGBColorSpace;
    this.r.shadowMap.enabled = true;
    this.r.shadowMap.type = THREE.PCFSoftShadowMap;
    this.camera = new THREE.PerspectiveCamera(32, 1, 0.5, 600);
    this.scene = new THREE.Scene();
    this.cars = [];
    this.particles = [];
    this.shake = 0;
    this.camPos = new THREE.Vector3();
    this.camLook = new THREE.Vector3();
    this.mode = 'none';
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  // Sharp rendering on phones: use the full device pixel ratio up to ~3.2M pixels.
  applyPixelRatio() {
    const dpr = window.devicePixelRatio || 1, px = window.innerWidth * window.innerHeight;
    const pr = Math.min(dpr, 3, Math.sqrt(3.2e6 / Math.max(1, px)));
    this.r.setPixelRatio(Math.max(1, pr));
  }

  setShadows(on) { this.shadowsOn = on; this.r.shadowMap.enabled = on; if (this.sun) this.sun.castShadow = on; }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.applyPixelRatio();
    this.r.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  }

  // ------------------------------------------------------------ shared scene bits
  newScene(theme) {
    const s = new THREE.Scene();
    s.background = skyTexture(theme.skyTop, theme.skyBottom);
    s.fog = new THREE.Fog(theme.fog, 70, 260);
    s.add(new THREE.HemisphereLight(0xffffff, 0x8a9ab8, 1.35));
    const sun = new THREE.DirectionalLight(0xffffff, 1.9);
    sun.position.set(-8, 20, 14); sun.castShadow = this.shadowsOn !== false;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera; sc.left = -22; sc.right = 22; sc.top = 16; sc.bottom = -12; sc.near = 1; sc.far = 80;
    sun.shadow.bias = -0.0008; sun.shadow.normalBias = 0.02;
    s.add(sun); s.add(sun.target);
    this.sun = sun;
    return s;
  }

  background(s, theme, x0, x1, waterY) {
    rseed = 99;
    const mg = new THREE.ConeGeometry(1, 1, 4, 1);
    for (let x = x0 - 120; x < x1 + 160; x += 26 + srand() * 22) {
      const h = 30 + srand() * 45, r = h * (0.8 + srand() * 0.4);
      const m = new THREE.Mesh(mg, mat(theme.mount[(srand() * 3) | 0], { flatShading: true, fog: true }));
      m.scale.set(r, h, r * 0.7); m.position.set(x, waterY + h / 2 - 2, -110 - srand() * 70); m.rotation.y = Math.PI / 4 + srand() * 0.3;
      s.add(m);
    }
    // clouds
    this.clouds = [];
    for (let x = x0 - 60; x < x1 + 80; x += 18 + srand() * 20) {
      const c = new THREE.Group(); const cm = mat(theme.cloud, { fog: false });
      const w = 6 + srand() * 8;
      cbox(c, 0, 0, 0, w, 0.5, 3, cm); cbox(c, srand() * 2, 0.4, 0, w * 0.6, 0.5, 2.6, cm);
      c.children.forEach((m) => { m.castShadow = false; });
      c.position.set(x, 20 + srand() * 12, -70 - srand() * 40); c.scale.setScalar(1.6); s.add(c); this.clouds.push(c);
    }
    // water / floor
    const water = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), new THREE.MeshLambertMaterial({ color: theme.water, transparent: true, opacity: theme.lava ? 0.95 : 0.78, ...(theme.lava ? { emissive: 0xc83a00 } : {}) }));
    if (theme.stars) {
      const pts = []; for (let i = 0; i < 500; i++) pts.push((srand() - 0.3) * 900 + x0, 30 + srand() * 220, -200 - srand() * 150);
      const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
      s.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: true, fog: false })));
    }
    water.rotation.x = -Math.PI / 2; water.position.y = waterY; water.receiveShadow = true; s.add(water);
    const deep = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), new THREE.MeshBasicMaterial({ color: theme.waterDeep, fog: true }));
    deep.rotation.x = -Math.PI / 2; deep.position.set(0, waterY + 0.01, -1500 - 30); s.add(deep);
  }

  // ------------------------------------------------------------ level
  buildLevel(level, theme, { lanes = 1, laneW = 2.7 } = {}) {
    this.dispose();
    const Dd = this.depth = lanes > 1 ? lanes * laneW + 0.8 : D;
    this.laneCount = lanes; this.laneW = laneW;
    const s = this.scene = this.newScene(theme);
    this.mode = 'game';
    this.theme = theme;
    const pieces = level.pieces;
    let minX = 0, maxX = 0;
    rseed = 17 + level.index * 13 + level.world * 101;
    const foam = mat(0xffffff);
    const waterY = level.water ?? -3;
    for (const p of pieces) {
      if (p.t === 'box' || p.t === 'poly') {
        const pts = piecePoly(p);
        const m = new THREE.Mesh(prismGeo(pts, Dd), styleMats(p.s)); m.receiveShadow = true; m.castShadow = true; s.add(m);
        if (lanes > 1 && p.t === 'box' && !p.a && p.w > 2 && p.s !== 'pad') {
          // lane divider stripes
          const lm = mat(0xffffff, { transparent: true, opacity: 0.55 });
          for (let i = 1; i < lanes; i++) {
            const z = -Dd / 2 + 0.4 + i * laneW;
            for (let x = p.x - p.w / 2 + 0.6; x < p.x + p.w / 2 - 1; x += 2.2) {
              const st = box(s, x, p.y + p.h / 2 + 0.005, z - 0.07, x + 1.2, p.y + p.h / 2 + 0.03, z + 0.07, lm); st.castShadow = false;
            }
          }
        }
        const xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1]);
        const bx0 = Math.min(...xs), bx1 = Math.max(...xs), by0 = Math.min(...ys), by1 = Math.max(...ys);
        minX = Math.min(minX, bx0); maxX = Math.max(maxX, bx1);
        if (by0 < waterY + 0.05 && by1 > waterY) box(s, bx0 - 0.12, waterY - 0.02, -Dd / 2 - 0.12, bx1 + 0.12, waterY + 0.06, Dd / 2 + 0.12, foam).castShadow = false;
        // grass caps on upward faces
        if (STYLE[p.s]?.cap && !p.a) {
          for (let i = 0; i < pts.length; i++) {
            const a = pts[i], b = pts[(i + 1) % pts.length];
            if (b[0] > a[0] + 0.01 === false) continue;
            const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
            if (Math.abs(ang) > 0.9) continue;
            // only top edges: interior lies below edge
            const cx = xs.reduce((u, v) => u + v) / xs.length, cy = ys.reduce((u, v) => u + v) / ys.length;
            const cross = (b[0] - a[0]) * (cy - a[1]) - (b[1] - a[1]) * (cx - a[0]);
            if (cross > 0) continue;
            s.add(capMesh(a[0], a[1], b[0], b[1], Dd + 0.08, STYLE[p.s].cap));
          }
          // auto decoration on wide flat grass
          if (p.t === 'box' && p.w > 5) this.autoDeco(s, theme, bx0 + 1, bx1 - 1, by1);
        } else if (p.t === 'box' && p.w > 6 && !['girder', 'pad', 'wood'].includes(p.s)) this.autoDeco(s, theme, bx0 + 1, bx1 - 1, by1);
      } else if (p.t === 'deco') {
        const d = buildDeco(p.kind, srand); d.position.set(p.x, p.y, -Dd / 2 + 0.8); s.add(d);
      } else if (p.t === 'bridge') {
        for (const [x, y] of [[p.x1, p.y1], [p.x2, p.y2]]) for (const z of [-Dd / 2 + 0.25, Dd / 2 - 0.25]) {
          box(s, x - 0.16, y - 1.0, z - 0.16, x + 0.16, y + 1.2, z + 0.16, 0x9a5b34);
          box(s, x - 0.2, y + 1.1, z - 0.2, x + 0.2, y + 1.25, z + 0.2, 0x7a4426);
        }
      } else if (p.t === 'pend') {
        const hz = Dd / 2 - 0.2;
        for (const z of [-hz, hz]) box(s, p.x - 0.2, p.y - p.len - 2.5, z - 0.2, p.x + 0.2, p.y + 0.3, z + 0.2, 0xffc61a);
        box(s, p.x - 0.25, p.y, -hz - 0.25, p.x + 0.25, p.y + 0.45, hz + 0.25, 0x3c3d44);
      } else if (p.t === 'finish') {
        const f = buildFinish(Dd); f.position.set(p.x, p.y, 0); s.add(f); this.finish = f;
      }
    }
    this.background(s, theme, minX, maxX, waterY);
    this.level = level;
    this.lanes = [];
    this.gemViews = [];
    if (lanes > 1) { const sc = this.sun.shadow.camera; sc.top = 22; sc.bottom = -16; sc.left = -26; sc.right = 26; sc.updateProjectionMatrix(); }
    return s;
  }

  autoDeco(s, theme, x0, x1, y) {
    for (let x = x0; x < x1; x += 3 + srand() * 5) {
      if (srand() < 0.35) continue;
      const kind = theme.deco[(srand() * theme.deco.length) | 0];
      const d = buildDeco(kind, srand);
      d.position.set(x, y, -this.depth / 2 + 0.7 - srand() * 0.4); d.rotation.y = (srand() - 0.5) * 0.6;
      s.add(d);
    }
  }

  // Render one simulation's moving pieces in its own lane (z offset). Returns the lane handle.
  attachSim(sim, { z = 0, gems = true } = {}) {
    const s = this.scene;
    const lane = { sim, z, dynViews: [], ropes: [], bridgeBodies: [] };
    const plankD = this.laneCount > 1 ? this.laneW - 0.25 : 3.4;
    let planks = 0;
    for (const d of sim.dynamics) {
      const p = d.piece;
      let m;
      if (p.t === 'plank') {
        m = texturedBox(p.w, p.h, plankD, 'wood'); m.material = [tmat('wood'), tmat('wood'), tmat('plank'), tmat('wood'), tmat('wood'), tmat('wood')];
        planks++; lane.bridgeBodies.push(d.body);
      } else if (p.t === 'ball') {
        m = boulder(p.r, p.s);
      } else if (p.t === 'pend') {
        m = pendulum(p, this.laneCount > 1 ? this.laneW - 0.6 : 2.4);
      } else {
        const depth = ['crate', 'labcrate', 'barrel'].includes(p.s) ? p.w : this.laneCount > 1 ? this.laneW - 0.25 : p.t === 'dyn' && p.s === 'log' ? 3 : 3.4;
        m = texturedBox(p.w, p.h, depth, p.s);
      }
      s.add(m); lane.dynViews.push({ m, body: d.body });
    }
    if (planks) {
      for (const dz of [-plankD / 2, plankD / 2]) {
        const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(planks * 6), 3));
        const line = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0x5b3a1e }));
        line.frustumCulled = false; s.add(line); lane.ropes.push({ line, z: z + dz });
      }
    }
    if (gems) for (const g of sim.gems) {
      const v = buildGem(); v.position.set(g.piece.x, g.piece.y, z); s.add(v); this.gemViews.push({ v, g, t: srand() * 6, pop: 0, z });
    }
    this.lanes.push(lane);
    return lane;
  }

  detachLane(lane) {
    for (const d of lane.dynViews) this.scene.remove(d.m);
    for (const r of lane.ropes) this.scene.remove(r.line);
    this.lanes = this.lanes.filter((l) => l !== lane);
    this.gemViews = this.gemViews.filter((g) => { if (lane.sim.gems.includes(g.g)) { this.scene.remove(g.v); return false; } return true; });
  }

  addCar(sim, spec, { label, color, ghost, z = 0 } = {}) {
    const parts = buildTruck(spec);
    this.scene.add(parts.group);
    const wheels = sim.wheels.map(() => { const w = buildWheel(spec.wheelR, spec.look); this.scene.add(w); return w; });
    const hook = sim.hook.map((b, i) => { const h = buildHookLink(i === sim.hook.length - 1); this.scene.add(h); return h; });
    if (ghost) [parts.group, ...wheels, ...hook].forEach((o) => o.traverse((m) => { if (m.isMesh) { m.material = (Array.isArray(m.material) ? m.material[0] : m.material).clone(); m.material.transparent = true; m.material.opacity = 0.55; m.castShadow = false; } }));
    let tag = null;
    if (label) { tag = nameSprite(label, color); if (this.laneCount > 1) tag.scale.set(4.8, 1.2, 1); this.scene.add(tag); }
    const car = { sim, spec, parts, wheels, hook, tag, dustT: 0, z, squash: 0, hop: 0 };
    this.cars.push(car);
    return car;
  }

  // ------------------------------------------------------------ particles
  spawn(x, y, z, vx, vy, vz, color, life = 0.8, size = 0.22, grav = -9) {
    let p = this.particles.find((q) => q.life <= 0);
    if (!p) {
      if (this.particles.length > 220) return;
      const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ color }));
      this.scene.add(m); p = { m, life: 0 }; this.particles.push(p);
    }
    if (p.m.parent !== this.scene) this.scene.add(p.m);
    p.m.material.color.setHex(color); p.m.visible = true;
    p.m.position.set(x, y, z); p.v = new THREE.Vector3(vx, vy, vz); p.life = p.max = life; p.size = size; p.grav = grav;
    p.m.scale.setScalar(size);
  }

  // Soft voxel exhaust puff: grows, rises and fades.
  smoke(x, y, z, size = 0.3, vx = 0) {
    this.smokes ||= [];
    let p = this.smokes.find((q) => q.life <= 0);
    if (!p) {
      if (this.smokes.length > 90) return;
      const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x9a9a9a, transparent: true, opacity: 0.7, depthWrite: false }));
      m.renderOrder = 2; p = { m, life: 0 }; this.smokes.push(p);
    }
    if (p.m.parent !== this.scene) this.scene.add(p.m);
    p.m.visible = true; p.m.position.set(x, y, z); p.m.rotation.set(Math.random(), Math.random(), Math.random());
    p.v = new THREE.Vector3(vx + (Math.random() - 0.5) * 0.4, 0.7 + Math.random() * 0.5, (Math.random() - 0.5) * 0.3);
    p.life = p.max = 1.1 + Math.random() * 0.5; p.s0 = size; p.s1 = size * (2.4 + Math.random());
  }

  // Faint tread mark on the ground, fades out over a few seconds.
  track(x, y, z, ang) {
    this.tracks ||= [];
    if (!this.trackGeo) {
      const c = document.createElement('canvas'); c.width = 16; c.height = 16; const g = c.getContext('2d');
      g.fillStyle = 'rgba(40,28,20,0.9)'; for (let i = 0; i < 16; i += 5) g.fillRect(1, i, 14, 3);
      const t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter;
      this.trackTex = t; this.trackGeo = new THREE.PlaneGeometry(0.5, 0.52);
    }
    let p = this.tracks.find((q) => q.life <= 0);
    if (!p) {
      if (this.tracks.length > 220) { p = this.tracks.reduce((a, b) => (a.life < b.life ? a : b)); }
      else {
        const m = new THREE.Mesh(this.trackGeo, new THREE.MeshLambertMaterial({ map: this.trackTex, transparent: true, opacity: 0.32, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 }));
        m.receiveShadow = true; m.renderOrder = 1; p = { m, life: 0 }; this.tracks.push(p);
      }
    }
    if (p.m.parent !== this.scene) this.scene.add(p.m);
    p.m.visible = true; p.m.position.set(x, y, z); p.m.rotation.set(-Math.PI / 2, 0, ang, 'ZYX');
    p.life = p.max = 3.2;
  }

  burst(x, y, color, n = 16, speed = 5, grav = -9, life = 0.9, z = 0) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = speed * (0.4 + Math.random() * 0.6);
      this.spawn(x, y, z + (Math.random() - 0.5) * 2, Math.cos(a) * s, Math.abs(Math.sin(a)) * s + 1, (Math.random() - 0.5) * s, color, life * (0.6 + Math.random() * 0.6), 0.14 + Math.random() * 0.18, grav);
    }
  }

  popText(text, x, y, z = 0, color = '#ffd21a') {
    const sp = nameSprite(text, color); sp.position.set(x, y, z); sp.scale.set(2.4, 0.6, 1);
    this.scene.add(sp); (this.pops ||= []).push({ sp, t: 0 });
  }

  // ------------------------------------------------------------ per-frame
  update(dt, focus, throttle = 0) {
    const t = performance.now() / 1000;
    for (const car of this.cars) {
      const { sim } = car;
      const c = sim.chassis, al = this.alpha ?? 1, p = sim.pose(c, al);
      const z = car.z;
      // squash & stretch on landings, little hop on finish
      car.squash *= Math.exp(-dt * 7); car.hop = Math.max(0, car.hop - dt);
      const sq = Math.sin(Math.min(1, car.squash) * Math.PI) * car.squash;
      const hopY = car.hop > 0 ? Math.abs(Math.sin(car.hop * 9)) * 0.35 * car.hop : 0;
      if (car.anim) {
        // flip-back: lift, roll upright and drop a little behind the crash spot
        const an = car.anim; an.t += dt;
        const k = Math.min(1, an.t / an.dur), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        const x = an.from.x + (an.to.x - an.from.x) * e, y = an.from.y + (an.to.y - an.from.y) * e + Math.sin(k * Math.PI) * 1.6;
        const ang = an.from.a + (an.to.a - an.from.a) * e;
        car.parts.group.position.set(x, y, z); car.parts.group.rotation.z = ang; car.parts.group.scale.set(1, 1, 1);
        const ca = Math.cos(ang), sa = Math.sin(ang), sp = car.spec;
        sp.wheelX.forEach((wx, i) => { car.wheels[i].position.set(x + wx * ca - sp.wheelY * sa, y + wx * sa + sp.wheelY * ca, z); car.wheels[i].rotation.z += dt * 12; });
        if (sp.crane) { const cr = sp.crane, tx = cr.pivot[0] + Math.cos(cr.angle) * cr.length, ty = cr.pivot[1] + Math.sin(cr.angle) * cr.length; car.hook.forEach((h, i) => { const ly = ty - cr.linkLen * (i + 0.5); h.position.set(x + tx * ca - ly * sa, y + tx * sa + ly * ca, z); h.rotation.z = ang; }); }
        if (k >= 1) { car.anim = null; car.squash = 0.9; this.burst(x, y - 0.9, 0xf3e2d2, 10, 3, -4, 0.5, z); }
        if (car.tag) car.tag.position.set(x, y + 3.2, z);
        continue;
      }
      car.parts.group.position.set(p.x, p.y + hopY, z); car.parts.group.rotation.z = p.a;
      car.parts.group.scale.set(1 + sq * 0.1, 1 - sq * 0.16, 1 + sq * 0.08);
      sim.wheels.forEach((w, i) => {
        const q = sim.pose(w, al), wv = car.wheels[i];
        wv.position.set(q.x, q.y + hopY, z); wv.rotation.z = q.a;
        // tyre squash from suspension compression (joint travel is negative when compressed)
        const tr = sim.joints[i] ? sim.joints[i].getJointTranslation() : 0;
        const comp = Math.min(0.35, Math.max(0, -tr - 0.02)) / 0.35;
        const k = 1 - Math.exp(-dt * 18);
        wv.userData.sq = (wv.userData.sq || 0) + (comp - (wv.userData.sq || 0)) * k;
        wv.scale.set(1 + wv.userData.sq * 0.08, 1 - wv.userData.sq * 0.12, 1 + wv.userData.sq * 0.05);
      });
      sim.hook.forEach((b, i) => { const q = sim.pose(b, al); car.hook[i].position.set(q.x, q.y + hopY, z); car.hook[i].rotation.z = q.a; });
      for (const sp of car.parts.spin) sp.obj.rotation[sp.axis] += sp.speed * dt;
      if (car.tag) car.tag.position.set(p.x, p.y + 3.2, z);
      // tyre tracks: drop a mark pair every ~0.45 m a grounded wheel travels
      if (sim.state !== 'fail') {
        car.trk ||= sim.wheels.map(() => ({ x: null }));
        const ang = p.a, sn = Math.sin(ang), cs = Math.cos(ang), r = sim.spec.wheelR;
        sim.wheels.forEach((w, i) => {
          if (sim.lostWheel === i) return;
          const q = sim.pose(w, al), tk = car.trk[i];
          if (sim.wheelTouch[i] <= 0) { tk.x = null; return; }
          if (tk.x == null) { tk.x = q.x; return; }
          if (Math.abs(q.x - tk.x) >= 0.45) {
            tk.x = q.x;
            const gx = q.x + sn * r, gy = q.y - cs * r + 0.03;
            for (const dz of [-0.86, 0.86]) this.track(gx, gy, z + dz, ang);
          }
        });
      }
      // exhaust smoke from the back of the truck: thick under throttle, a light wisp when idling
      car.smokeT = (car.smokeT ?? 0) - dt;
      if (car.smokeT <= 0 && (sim.state === 'run' || sim.state === 'win')) {
        const thr = car === this.cars[0] ? throttle !== 0 : Math.abs(sim.chassis.getLinearVelocity().x) > 2;
        const ang = p.a, lx = -1.95, ly = 0.55;
        const ex = p.x + lx * Math.cos(ang) - ly * Math.sin(ang), ey = p.y + lx * Math.sin(ang) + ly * Math.cos(ang);
        this.smoke(ex, ey, z + 0.45, thr ? 0.28 : 0.16, thr ? -1.2 : -0.2);
        car.smokeT = thr ? (car === this.cars[0] ? 0.06 : 0.12) : 0.32;
      }
      // dust from spinning wheels on ground
      car.dustT -= dt;
      if (car === this.cars[0] && car.dustT <= 0 && sim.state === 'run' && throttle !== 0) {
        sim.wheels.forEach((w, i) => {
          if (sim.wheelTouch[i] > 0 && Math.abs(w.getAngularVelocity()) > 6) {
            const q = w.getPosition();
            this.spawn(q.x - 0.5 * Math.sign(throttle), q.y - sim.spec.wheelR + 0.15, z + (Math.random() - 0.5) * 2.2, -throttle * (1 + Math.random() * 2), 1 + Math.random() * 1.5, 0, this.theme?.deco?.includes('tank') ? 0xbfe6d8 : 0xf3e2d2, 0.5, 0.18 + Math.random() * 0.15, -2);
          }
        });
        car.dustT = 0.05;
      }
    }
    for (const lane of this.lanes || []) {
      for (const d of lane.dynViews) { const q = lane.sim.pose(d.body, this.alpha ?? 1); d.m.position.set(q.x, q.y, lane.z); d.m.rotation.z = q.a; }
      for (const r of lane.ropes) {
        const arr = r.line.geometry.attributes.position.array; let k = 0;
        for (const b of lane.bridgeBodies) {
          const q = b.getPosition();
          arr[k++] = q.x; arr[k++] = q.y; arr[k++] = r.z; arr[k++] = q.x; arr[k++] = q.y + 0.9; arr[k++] = r.z;
        }
        r.line.geometry.attributes.position.needsUpdate = true;
      }
    }
    for (const gv of this.gemViews || []) {
      gv.t += dt;
      if (gv.g.taken) {
        gv.pop += dt;
        const k = Math.min(1, gv.pop / 0.35);
        gv.v.scale.setScalar(Math.max(0.001, 1 + k * 0.8) * (1 - k));
        gv.v.position.y = gv.g.piece.y + k * 1.5; gv.v.rotation.y += dt * 20;
        if (k >= 1) gv.v.visible = false;
      } else {
        gv.v.rotation.y = gv.t * 2.2; gv.v.position.y = gv.g.piece.y + Math.sin(gv.t * 3) * 0.12; gv.v.scale.setScalar(1 + Math.sin(gv.t * 6) * 0.06);
      }
    }
    if (this.finish) this.finish.traverse((o) => { if (o.userData.wave) o.rotation.y = Math.sin(t * 6 + o.position.z) * 0.25; });
    this.scene.traverse((o) => { if (o.userData.flicker) o.scale.y = 0.28 * (0.85 + Math.sin(t * 20 + o.id) * 0.15); });
    for (const c of this.clouds || []) c.position.x += dt * 0.4;
    for (const p of this.smokes || []) {
      if (p.life <= 0) continue;
      p.life -= dt; const k = 1 - p.life / p.max;
      p.m.position.addScaledVector(p.v, dt); p.v.multiplyScalar(1 - dt * 0.8);
      p.m.scale.setScalar(p.s0 + (p.s1 - p.s0) * Math.sqrt(k)); p.m.rotation.y += dt;
      p.m.material.opacity = 0.72 * (1 - k) * Math.min(1, k * 8);
      if (p.life <= 0) p.m.visible = false;
    }
    for (const p of this.tracks || []) {
      if (p.life <= 0) continue;
      p.life -= dt; p.m.material.opacity = 0.32 * Math.min(1, p.life / 1.2);
      if (p.life <= 0) p.m.visible = false;
    }
    this.pops = (this.pops || []).filter((q) => {
      q.t += dt; q.sp.position.y += dt * 1.6;
      const k = q.t < 0.15 ? q.t / 0.15 : 1; q.sp.scale.set(2.4 * k, 0.6 * k, 1);
      q.sp.material.opacity = Math.max(0, 1 - Math.max(0, q.t - 0.5) / 0.4);
      if (q.t > 0.9) { this.scene.remove(q.sp); return false; } return true;
    });
    for (const p of this.particles) {
      if (p.life <= 0) continue;
      p.life -= dt;
      p.v.y += p.grav * dt;
      p.m.position.addScaledVector(p.v, dt);
      p.m.scale.setScalar(p.size * Math.max(0.05, p.life / p.max));
      p.m.rotation.x += dt * 4; p.m.rotation.y += dt * 3;
      if (p.life <= 0) p.m.visible = false;
    }
    if (this.mode === 'game' && focus) this.follow(dt, focus);
    if (this.mode === 'menu') this.menuUpdate(dt);
    this.r.render(this.scene, this.camera);
  }

  follow(dt, sim) {
    const c = sim.chassis, p = sim.pose(c, this.alpha ?? 1), v = c.getLinearVelocity();
    const aspect = this.camera.aspect;
    const race = this.laneCount > 1;
    let look, pos;
    if (race) {
      // 3/4 chase view over all lanes, player lane nearest the camera
      const viewW = aspect < 0.7 ? 17 : aspect < 1 ? 19 : 24;
      const dist = viewW / (2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * aspect);
      const zc = this.focusZ * 0.35;
      look = new THREE.Vector3(p.x + 2.6 + THREE.MathUtils.clamp(v.x * 0.15, -1, 2.5), p.y + 0.6 + THREE.MathUtils.clamp(v.y * 0.05, -1, 1), zc);
      pos = new THREE.Vector3(look.x + dist * 0.28, look.y + dist * 0.62, zc + dist * 0.8);
    } else {
      const viewW = aspect < 0.7 ? 11.5 : aspect < 1 ? 14 : aspect < 1.4 ? 19 : 24;
      const dist = viewW / (2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * aspect);
      look = new THREE.Vector3(p.x + 1.8 + THREE.MathUtils.clamp(v.x * 0.15, -2, 2.5), p.y + 0.7 + THREE.MathUtils.clamp(v.y * 0.06, -1, 1), 0);
      pos = new THREE.Vector3(look.x + dist * 0.2, look.y + dist * 0.2, dist);
    }
    const k = this.snapCam ? 1 : 1 - Math.exp(-dt * 4.5);
    this.camLook.lerp(look, k); this.camPos.lerp(pos, k);
    this.snapCam = false;
    this.camera.position.copy(this.camPos);
    if (this.shake > 0) { this.shake -= dt; const a = this.shake * 0.6; this.camera.position.x += (Math.random() - 0.5) * a; this.camera.position.y += (Math.random() - 0.5) * a; }
    // FOV punch for boosts
    this.punch = Math.max(0, (this.punch || 0) - dt * 1.5);
    const fov = 32 + this.punch * 8;
    if (Math.abs(this.camera.fov - fov) > 0.01) { this.camera.fov = fov; this.camera.updateProjectionMatrix(); }
    this.camera.lookAt(this.camLook);
    if (this.sun) { this.sun.position.set(p.x - 8, p.y + 20, 14); this.sun.target.position.set(p.x, p.y, 0); }
  }

  snapshot() {
    this.r.render(this.scene, this.camera);
    try { return this.canvas.toDataURL('image/jpeg', 0.82); } catch { return ''; }
  }

  // Start the flip-back animation from a sim 'recover' event. Angle goes the short way round.
  carRecover(car, e) {
    let a = e.from.a % (Math.PI * 2);
    if (a > Math.PI) a -= Math.PI * 2; if (a < -Math.PI) a += Math.PI * 2;
    car.anim = { from: { x: e.from.x, y: e.from.y, a }, to: e.to, t: 0, dur: e.hold * 0.9 };
  }

  // Close-up "crash photo": camera dives in with a tilted (dutch) angle, then everything is restored.
  snapshotCar(sim, z = 0, reason = sim.reason) {
    const p = sim.chassis.getPosition();
    const cam = this.camera, keep = { pos: cam.position.clone(), quat: cam.quaternion.clone(), up: cam.up.clone(), fov: cam.fov };
    const water = sim.level.water ?? -3;
    const target = new THREE.Vector3(p.x + 0.4, Math.max(p.y, water + 0.6) + 0.4, z);
    const side = reason === 'splash' ? 1 : -1;
    cam.position.set(target.x + 6.5 * side, target.y + 4.2, z + 11);
    cam.up.set(Math.sin(0.28 * side), Math.cos(0.28 * side), 0);
    cam.fov = 38; cam.updateProjectionMatrix(); cam.lookAt(target);
    this.r.render(this.scene, cam);
    let url = '';
    try { url = this.canvas.toDataURL('image/jpeg', 0.85); } catch { /* ignore */ }
    cam.position.copy(keep.pos); cam.quaternion.copy(keep.quat); cam.up.copy(keep.up); cam.fov = keep.fov; cam.updateProjectionMatrix();
    return url;
  }

  // ------------------------------------------------------------ menus
  showDiorama(world, spec, lift = 0) {
    this.dispose();
    const th = world.theme;
    const s = this.scene = this.newScene(th);
    s.fog = null;
    this.mode = 'menu';
    this.theme = th;
    const g = new THREE.Group(); s.add(g); this.dioramaRoot = g;
    // water block base
    const wb = new THREE.Mesh(new THREE.BoxGeometry(9, 1.6, 6.4), new THREE.MeshLambertMaterial({ color: th.water, transparent: true, opacity: 0.92 }));
    wb.position.y = -0.8; wb.receiveShadow = true; g.add(wb);
    box(g, -4.5, -0.02, -3.2, 4.5, 0.02, 3.2, 0xffffff).material = mat(th.waterDeep);
    const styleOf = world.ground || 'grass';
    const isl = new THREE.Mesh(prismGeo([[-3.6, -1.2], [2.4, -1.2], [2.4, 1.3], [-3.6, 1.3]], 3.4), styleMats(styleOf)); g.add(isl); isl.castShadow = isl.receiveShadow = true;
    if (STYLE[styleOf]?.cap) g.add(capMesh(-3.6, 1.3, 2.4, 1.3, 3.48, STYLE[styleOf].cap));
    if (th.lava) wb.material.emissive = new THREE.Color(0x8a2200);
    rseed = 5 + world.id.length;
    if (world.id === 'classic') {
      for (let i = 0; i < 5; i++) { const pl = texturedBox(0.75, 0.2, 2.6, 'wood'); pl.position.set(2.9 + i * 0.8, 1.1 - i * 0.28, 0); pl.rotation.z = -0.32; g.add(pl); }
      const t = buildDeco('tree', srand); t.position.set(-2.8, 1.3, -1.1); g.add(t);
      const b = buildDeco('rock', srand); b.position.set(1.6, 1.3, -1.1); g.add(b);
      for (let i = 0; i < 3; i++) { const gm = buildGem(); gm.position.set(-1 + i * 0.9, 3.5, 0); gm.scale.setScalar(0.7); g.add(gm); }
    } else if (world.id === 'construction') {
      for (let i = 0; i < 2; i++) box(g, -3.4 + i * 4.8, 1.3, -1.6, -3.0 + i * 4.8, 4.0, -1.2, 0xe8333c);
      box(g, -3.4, 3.8, -1.7, 1.8, 4.2, -1.1, 0xe8333c);
      for (const [x, k] of [[-3, 'cone'], [1.7, 'barrier'], [2, 'cone']]) { const d = buildDeco(k); d.position.set(x, 1.3, 1.2); g.add(d); }
      const c = buildDeco('crateDeco'); c.position.set(-2.4, 1.3, -0.6); g.add(c);
    } else if (world.id === 'medieval') {
      const tower = new THREE.Mesh(prismGeo([[-1.2, 1.3], [0.8, 1.3], [0.8, 5.0], [-1.2, 5.0]], 1.8, -1.2), styleMats('castle')); g.add(tower); tower.castShadow = true;
      for (let i = 0; i < 3; i++) box(g, -1.2 + i * 0.75, 5.0, -2.1, -0.85 + i * 0.75, 5.4, -0.3, 0xb9bdc9);
      box(g, -0.55, 1.3, -0.28, 0.15, 2.6, -0.26, 0x5b3a1e);
      for (let i = 0; i < 4; i++) { const pl = texturedBox(0.75, 0.25, 2.6, 'wood'); pl.position.set(2.8 + i * 0.78, 1.15, 0); g.add(pl); }
      const tr = buildDeco('torch'); tr.position.set(-3, 1.3, 1.2); g.add(tr);
      const bn = buildDeco('banner'); bn.position.set(1.6, 1.3, -1.2); g.add(bn);
    } else if (world.id !== 'science') {
      // generic diorama for worlds 5-20: themed props + a little bridge and some gems
      const d = th.deco;
      [[-2.8, -1.1, d[0]], [1.6, -1.1, d[1]], [-2.9, 1.1, d[2] || d[0]], [1.8, 1.1, d[0]]].forEach(([x, z, k]) => { const o = buildDeco(k, srand); o.position.set(x, 1.3, z); g.add(o); });
      for (let i = 0; i < 4; i++) { const pl = texturedBox(0.75, 0.22, 2.6, world.plank === 'wood' ? 'wood' : world.plank); pl.position.set(2.85 + i * 0.8, 1.15 - i * 0.18, 0); pl.rotation.z = -0.2; g.add(pl); }
      for (let i = 0; i < 3; i++) { const gm = buildGem(); gm.position.set(-1 + i * 0.9, 3.5, 0); gm.scale.setScalar(0.7); g.add(gm); }
    } else {
      for (const [x, z] of [[-3, -1.1], [1.8, -1.1]]) { const t = buildDeco('tank'); t.position.set(x, 1.3, z); g.add(t); }
      const pad = texturedBox(1.6, 0.12, 1.6, 'pad'); pad.position.set(1.2, 1.36, 0.9); g.add(pad);
      for (let i = 0; i < 2; i++) { const c = buildDeco('labcrateDeco'); c.position.set(-2.6 + i * 0.85, 1.3 + i * 0.0, 0.9); g.add(c); }
      box(g, -1.6, 1.3, -1.7, 0.6, 3.6, -1.3, 0x3b4766); box(g, -1.4, 1.6, -1.31, 0.4, 3.3, -1.28, 0x7df9ff).material = mat(0x7df9ff, { emissive: 0x1a8a99 });
    }
    // the truck
    const tg = new THREE.Group(); tg.position.set(-0.6, 1.3 + spec.wheelR - spec.wheelY, 0.2); tg.scale.setScalar(0.62); g.add(tg);
    const parts = buildTruck(spec); tg.add(parts.group);
    spec.wheelX.forEach((wx) => { const w = buildWheel(spec.wheelR, spec.look); w.position.set(wx, spec.wheelY, 0); tg.add(w); });
    if (spec.crane) { const c = spec.crane; let y = c.pivot[1] + Math.sin(c.angle) * c.length; const x = c.pivot[0] + Math.cos(c.angle) * c.length; for (let i = 0; i < c.links; i++) { const l = buildHookLink(i === c.links - 1); l.position.set(x, y - c.linkLen * (i + 0.5), 0); tg.add(l); } }
    this.menuSpin = parts.spin;
    this.menuT = 0;
    this.menuCam = { pos: new THREE.Vector3(9, 7 + lift, 14), look: new THREE.Vector3(0, 1.4 + lift, 0) };
    this.sun.position.set(-6, 14, 10); this.sun.target.position.set(0, 0, 0);
    const sc = this.sun.shadow.camera; sc.left = -8; sc.right = 8; sc.top = 8; sc.bottom = -8; sc.updateProjectionMatrix();
  }

  showGarage(spec) {
    this.dispose();
    const s = this.scene = this.newScene({ skyTop: '#3b8cff', skyBottom: '#bfe3ff', fog: 0xbfe3ff });
    s.fog = null; this.mode = 'menu';
    const g = new THREE.Group(); s.add(g); this.dioramaRoot = g;
    const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.4, 0.6, 24), mat(0x2a63d9)); pedestal.position.y = -0.3; pedestal.receiveShadow = true; g.add(pedestal);
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(3.45, 3.45, 0.14, 24), mat(0xffc61a)); ring.position.y = -0.62; g.add(ring);
    const tg = new THREE.Group(); tg.position.set(0, spec.wheelR - spec.wheelY + 0.05, 0); g.add(tg);
    const parts = buildTruck(spec); tg.add(parts.group);
    spec.wheelX.forEach((wx) => { const w = buildWheel(spec.wheelR, spec.look); w.position.set(wx, spec.wheelY, 0); tg.add(w); });
    if (spec.crane) { const c = spec.crane; const y = c.pivot[1] + Math.sin(c.angle) * c.length; const x = c.pivot[0] + Math.cos(c.angle) * c.length; for (let i = 0; i < c.links; i++) { const l = buildHookLink(i === c.links - 1); l.position.set(x, y - c.linkLen * (i + 0.5), 0); tg.add(l); } }
    this.menuSpin = parts.spin; this.menuT = 0;
    this.menuCam = { pos: new THREE.Vector3(8.5, 4.6, 11), look: new THREE.Vector3(0, 0.5, 0) };
    this.sun.position.set(-6, 14, 10);
    const sc = this.sun.shadow.camera; sc.left = -6; sc.right = 6; sc.top = 6; sc.bottom = -6; sc.updateProjectionMatrix();
  }

  menuUpdate(dt) {
    this.menuT += dt;
    if (this.dioramaRoot) {
      this.dioramaRoot.rotation.y = Math.sin(this.menuT * 0.5) * 0.35 - 0.25;
      this.dioramaRoot.position.y = Math.sin(this.menuT * 1.2) * 0.12;
      this.dioramaRoot.traverse((o) => { if (o.geometry?.type === 'OctahedronGeometry') o.parent.rotation.y += dt * 2; });
    }
    for (const sp of this.menuSpin || []) sp.obj.rotation[sp.axis] += sp.speed * dt;
    const aspect = this.camera.aspect;
    const d = Math.max(1, 0.95 / aspect);
    const mc = this.menuCam;
    if (mc) {
      this.camera.position.copy(mc.look).addScaledVector(mc.pos.clone().sub(mc.look), d);
      this.camera.lookAt(mc.look.x, mc.look.y - (d - 1) * 0.6, mc.look.z);
    }
  }

  // Render a still image of a truck for shop cards
  thumbnail(spec, w = 240, h = 160) {
    if (!this.thumbR) {
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      this.thumbR = new THREE.WebGLRenderer({ canvas: c, antialias: true, alpha: true, preserveDrawingBuffer: true });
      this.thumbR.outputColorSpace = THREE.SRGBColorSpace;
      this.thumbR.setSize(w, h, false);
    }
    const s = new THREE.Scene();
    s.add(new THREE.HemisphereLight(0xffffff, 0x8a9ab8, 1.4));
    const l = new THREE.DirectionalLight(0xffffff, 1.8); l.position.set(-4, 8, 8); s.add(l);
    const tg = new THREE.Group(); s.add(tg);
    tg.add(buildTruck(spec).group);
    spec.wheelX.forEach((wx) => { const wv = buildWheel(spec.wheelR, spec.look); wv.position.set(wx, spec.wheelY, 0); tg.add(wv); });
    if (spec.crane) { const c = spec.crane; const y = c.pivot[1] + Math.sin(c.angle) * c.length; const x = c.pivot[0] + Math.cos(c.angle) * c.length; for (let i = 0; i < c.links; i++) { const lk = buildHookLink(i === c.links - 1); lk.position.set(x, y - c.linkLen * (i + 0.5), 0); tg.add(lk); } }
    const cam = new THREE.PerspectiveCamera(30, w / h, 0.1, 100);
    cam.position.set(5.5, 3.6, 8.5); cam.lookAt(0.3, 0.6, 0);
    this.thumbR.setClearColor(0x000000, 0);
    this.thumbR.render(s, cam);
    return this.thumbR.domElement.toDataURL('image/png');
  }

  // Dev helper: 4 orthographic-ish views of a truck (3/4 front, side, 3/4 rear, front) on one square canvas.
  views(spec, size = 1024) {
    const c = document.createElement('canvas'); c.width = size; c.height = size;
    const r = new THREE.WebGLRenderer({ canvas: c, antialias: true, preserveDrawingBuffer: true });
    r.outputColorSpace = THREE.SRGBColorSpace; r.setSize(size, size, false); r.setClearColor(0xffffff, 1); r.setScissorTest(true);
    const s = new THREE.Scene();
    s.add(new THREE.HemisphereLight(0xffffff, 0x8a9ab8, 1.4));
    const l = new THREE.DirectionalLight(0xffffff, 1.8); l.position.set(-4, 8, 8); s.add(l);
    const tg = new THREE.Group(); s.add(tg);
    tg.add(buildTruck(spec).group);
    spec.wheelX.forEach((wx) => { const wv = buildWheel(spec.wheelR, spec.look); wv.position.set(wx, spec.wheelY, 0); tg.add(wv); });
    if (spec.crane) { const cr = spec.crane; const y = cr.pivot[1] + Math.sin(cr.angle) * cr.length; const x = cr.pivot[0] + Math.cos(cr.angle) * cr.length; for (let i = 0; i < cr.links; i++) { const lk = buildHookLink(i === cr.links - 1); lk.position.set(x, y - cr.linkLen * (i + 0.5), 0); tg.add(lk); } }
    const cams = [[6, 3.4, 7.5], [0.4, 1.2, 10.5], [-6, 3.4, 7.5], [10.5, 1.4, 0.3]];
    const h = size / 2;
    cams.forEach((p, i) => {
      const cam = new THREE.PerspectiveCamera(28, 1, 0.1, 100); cam.position.set(...p); cam.lookAt(0.1, 0.8, 0);
      const x = (i % 2) * h, y = i < 2 ? h : 0;
      r.setViewport(x, y, h, h); r.setScissor(x, y, h, h); r.render(s, cam);
    });
    return c.toDataURL('image/png');
  }

  dispose() {
    this.cars = []; this.particles = []; this.smokes = []; this.tracks = []; this.finish = null; this.lanes = []; this.gemViews = []; this.laneCount = 1; this.focusZ = 0; this.punch = 0;
    this.clouds = []; this.dioramaRoot = null; this.menuSpin = []; this.garage = false;
    this.snapCam = true;
  }
}
