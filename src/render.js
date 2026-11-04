// Three.js renderer: level scene, trucks, particles, camera, menu dioramas.
import * as THREE from 'three';
import { tex, skyTexture } from './textures.js';
import { bake } from './bake.js';
import { P } from './platform/index.js';
import { mat, box, cbox, buildTruck, buildWheel, buildTyre, buildHookLink, buildGem, buildFinish, buildDeco, boulder, pendulum, addOutline } from './models.js';

const D = 4; // terrain depth (z)
const _col = new THREE.Color(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3(), _m = new THREE.Matrix4(), _m2 = new THREE.Matrix4(), _v3 = new THREE.Vector3(), _box = new THREE.Box3();

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
  if (!texMats[k]) { texMats[k] = new THREE.MeshLambertMaterial({ map: tex(name), ...(emissive ? { emissive, emissiveIntensity: 0.6 } : {}) }); texMats[k].userData.shared = true; }
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
  const side = capMats[cap[1]] ||= Object.assign(new THREE.MeshLambertMaterial({ map: tex(cap[1]), transparent: true, alphaTest: 0.5 }), { userData: { shared: true } });
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

let labelFont = 'Fredoka, sans-serif';
export const setLabelFont = (f) => { labelFont = f; };
function nameSprite(text, color = '#ffffff') {
  const c = P.createCanvas(256, 64);
  const g = c.getContext('2d');
  g.font = `700 34px ${labelFont}`; g.textAlign = 'center'; g.textBaseline = 'middle';
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
    const dpr = P.info.dpr || 1;
    // MSAA is expensive at high DPR and barely visible there
    this.r = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', stencil: false });
    this.quality = 0;
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
    P.onResize(() => this.resize());
  }

  // TikTok runtime: there is one on-screen canvas, so the 2D UI canvas is drawn on top of the
  // 3D scene as a full-screen textured quad (re-uploaded only when the UI redraws).
  setOverlay(canvas) {
    this.overlayTex = new THREE.CanvasTexture(canvas);
    this.overlayTex.colorSpace = THREE.SRGBColorSpace; this.overlayTex.minFilter = THREE.LinearFilter; this.overlayTex.generateMipmaps = false;
    this.overlayScene = new THREE.Scene();
    this.overlayCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const q = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ map: this.overlayTex, transparent: true, depthTest: false, depthWrite: false, toneMapped: false }));
    q.frustumCulled = false; this.overlayScene.add(q);
  }
  overlayChanged() { if (this.overlayTex) this.overlayTex.needsUpdate = true; }
  drawOverlay() {
    if (!this.overlayScene) return;
    this.r.autoClear = false; this.r.render(this.overlayScene, this.overlayCam); this.r.autoClear = true;
  }

  // Render `scene` with `cam` into an offscreen 2D canvas (no toDataURL / preserveDrawingBuffer needed).
  capture(scene, cam, w, h, { transparent = false } = {}) {
    w = Math.round(w); h = Math.round(h);
    const rt = new THREE.WebGLRenderTarget(w, h, { depthBuffer: true });
    rt.texture.colorSpace = THREE.SRGBColorSpace;
    const buf = new Uint8Array(w * h * 4);
    const bg = scene.background, oldClear = this.r.getClearColor(new THREE.Color()), oldA = this.r.getClearAlpha();
    if (transparent) { scene.background = null; this.r.setClearColor(0x000000, 0); }
    const shadows = this.r.shadowMap.enabled;
    this.r.setRenderTarget(rt); this.r.clear(); this.r.render(scene, cam);
    this.r.readRenderTargetPixels(rt, 0, 0, w, h, buf);
    this.r.setRenderTarget(null); rt.dispose();
    if (transparent) { scene.background = bg; this.r.setClearColor(oldClear, oldA); }
    void shadows;
    const c = P.createCanvas(w, h), ctx = c.getContext('2d'), img = ctx.createImageData(w, h);
    for (let y = 0; y < h; y++) img.data.set(buf.subarray((h - 1 - y) * w * 4, (h - y) * w * 4), y * w * 4);   // flip Y
    ctx.putImageData(img, 0, 0);
    return c;
  }

  // Quality tiers. 0 = sharp (DPR up to 2, 2048 soft shadows), 1 = 1024 shadows, 2 = no shadows,
  // 3 = no shadows and DPR 1.5. Shadows go first: a lower resolution is what makes a phone screen look broken.
  // Starts from the saved tier and steps down automatically when the frame rate stays low.
  setQuality(q) {
    this.quality = Math.max(0, Math.min(3, q | 0));
    this.applyPixelRatio();
    const sm = this.quality === 0 ? 2048 : 1024;
    this.r.shadowMap.type = this.quality === 0 ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
    this.shadowSize = sm;
    if (this.sun && this.sun.shadow.mapSize.x !== sm) { this.sun.shadow.mapSize.set(sm, sm); this.sun.shadow.map?.dispose(); this.sun.shadow.map = null; }
    this.r.shadowMap.enabled = this.shadowsOn !== false && this.quality < 2;
    if (this.sun) this.sun.castShadow = this.r.shadowMap.enabled;
  }

  applyPixelRatio() {
    const dpr = P.info.dpr || 1;
    const cap = [2, 2, 2, 1.5][this.quality ?? 0];
    this.r.setPixelRatio(Math.max(1, Math.min(dpr, cap)));
  }

  // Called every frame while playing: drops a quality tier after 4 s under 40 fps
  // (the first 3 s of a level are ignored: shader compiles and loading hitches are not slowness).
  watchFps(dt) {
    if (this.mode !== 'game') { this.fpsAcc = 0; this.fpsN = 0; this.fpsWarm = 0; return; }
    this.fpsWarm = (this.fpsWarm || 0) + dt; if (this.fpsWarm < 3) return;
    this.fpsAcc = (this.fpsAcc || 0) + dt; this.fpsN = (this.fpsN || 0) + 1;
    if (this.fpsAcc < 4) return;
    const fps = this.fpsN / this.fpsAcc; this.fps = fps; this.fpsAcc = 0; this.fpsN = 0;
    if (fps < 40 && this.quality < 3 && this.autoQuality !== false) { this.setQuality(this.quality + 1); this.onQuality?.(this.quality, fps); }
  }

  setShadows(on) { this.shadowsOn = on; this.setQuality(this.quality ?? 0); }

  resize() {
    const w = P.info.w, h = P.info.h;
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
    sun.position.set(-8, 20, 14); sun.castShadow = this.r.shadowMap.enabled;
    sun.shadow.mapSize.set(this.shadowSize || 2048, this.shadowSize || 2048);
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
      c.position.set(x, 20 + srand() * 12, -70 - srand() * 40); c.scale.setScalar(1.6); c.userData.dynamic = true; s.add(c); this.clouds.push(c);
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
    this.mode = 'game'; this.fpsWarm = 0; this.fpsAcc = 0; this.fpsN = 0;
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
        const f = buildFinish(Dd); f.position.set(p.x, p.y, 0); f.userData.dynamic = true; s.add(f); this.finish = f;
      }
    }
    this.background(s, theme, minX, maxX, waterY);
    this.bakeScene(s);
    this.level = level;
    this.lanes = [];
    this.gemViews = [];
    if (lanes > 1) { const sc = this.sun.shadow.camera; sc.top = 22; sc.bottom = -16; sc.left = -26; sc.right = 26; sc.updateProjectionMatrix(); }
    return s;
  }

  // Move every static mesh of the scene under one group and merge it (terrain, props, mountains).
  bakeScene(s, root = s) {
    const g = new THREE.Group(); g.userData.levelRoot = true;
    for (const c of [...root.children]) {
      if (c.isLight || c.userData.dynamic || c.isPoints || c.isInstancedMesh || c === this.sun?.target || c.isSprite) continue;
      if (!c.isMesh && !c.isGroup) continue;
      g.add(c);
    }
    root.add(g);
    bake(g);
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
    const car = { sim, spec, parts, wheels, hook, tag, dustT: 0, z, squash: 0, hop: 0, lift: 0, hull: this.truckHull(spec, parts) };
    if (!this.groundProf) this.buildGroundProfile(sim);
    this.cars.push(car);
    return car;
  }

  // ------------------------------------------------------------ keeping the model out of the road
  // The physics shapes are simpler than the voxel model (roof lips, beacons, the crane boom...). When the truck
  // tips, crashes or flips back, the model is lifted just enough that no part of it sinks into the road.
  // Outline = 2D convex hull of the model per piece (body, boom, each accessory), so broken-off parts stop counting.
  truckHull(spec, parts) {
    this.hullCache ||= new Map();
    if (this.hullCache.has(spec.id)) return this.hullCache.get(spec.id);
    const g = parts.group; g.updateWorldMatrix(true, true);
    const inv = new THREE.Matrix4().copy(g.matrixWorld).invert(), m = new THREE.Matrix4(), v = new THREE.Vector3();
    const owner = (o) => { for (let q = o; q && q !== g; q = q.parent) { if (q === parts.boom) return 'boom'; if (q === parts.piston) return 'piston'; const a = parts.acc.find((x) => x.obj === q); if (a) return 'acc:' + a.name; } return 'main'; };
    const pts = {};
    g.traverse((o) => {
      if (!o.isMesh || !o.geometry?.attributes?.position) return;
      const key = owner(o), arr = (pts[key] ||= []), pos = o.geometry.attributes.position;
      m.multiplyMatrices(inv, o.matrixWorld);
      for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(m); arr.push([Math.round(v.x * 50) / 50, Math.round(v.y * 50) / 50]); }
    });
    const hull = (P) => {   // monotone chain, returns flat [x0,y0,x1,y1,...]
      P = [...new Map(P.map((p) => [p[0] + ',' + p[1], p])).values()].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
      if (P.length < 3) return P.flat();
      const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
      const lo = [], up = [];
      for (const p of P) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
      for (let i = P.length - 1; i >= 0; i--) { const p = P[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
      return [...lo.slice(0, -1), ...up.slice(0, -1)].flat();
    };
    const out = {}; for (const k in pts) out[k] = hull(pts[k]);
    // wheels (only used while the flip-back animation carries them rigidly)
    const wp = []; spec.wheelX.forEach((wx) => { for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; wp.push(wx + Math.cos(a) * spec.wheelR, spec.wheelY + Math.sin(a) * spec.wheelR); } });
    out.wheels = wp;
    this.hullCache.set(spec.id, out);
    return out;
  }
  // Static ground height every 10 cm along the level (one table, cheap lookups every frame)
  buildGroundProfile(sim) {
    const x0 = (sim.level.minX ?? -12) - 5, x1 = (sim.finishX ?? 200) + 30, step = 0.1, n = Math.ceil((x1 - x0) / step) + 1;
    const h = new Float32Array(n);
    for (let i = 0; i < n; i++) { const g = sim.groundAt(x0 + i * step); h[i] = g == null ? NaN : g; }
    this.groundProf = { x0, step, h };
  }
  groundY(x) {
    const P = this.groundProf; if (!P) return null;
    const f = (x - P.x0) / P.step, i = Math.floor(f);
    if (i < 0 || i >= P.h.length - 1) return null;
    const a = P.h[i], b = P.h[i + 1];
    if (Number.isNaN(a) || Number.isNaN(b)) return Number.isNaN(a) ? (Number.isNaN(b) ? null : b) : a;
    return Math.abs(a - b) > 0.6 ? Math.max(a, b) : a + (b - a) * (f - i);   // a step: use the top
  }
  // How far the model at pose (x, y, a) dips below the road (0 if it does not)
  hullLift(car, x, y, a, withWheels = false) {
    const H = car.hull, c = Math.cos(a), s = Math.sin(a); let lift = 0;
    const check = (pts) => {
      if (!pts) return;
      for (let i = 0; i < pts.length; i += 2) {
        const px = x + pts[i] * c - pts[i + 1] * s, py = y + pts[i] * s + pts[i + 1] * c, g = this.groundY(px);
        if (g == null) continue;
        const pen = g - py;
        if (pen > lift && pen < 2.6) lift = pen;   // deeper than that = a wall or a ceiling, not the road under us
      }
    };
    check(H.main);
    if (car.parts.boom && car.parts.boom.parent === car.parts.group) check(H.boom);
    if (car.parts.piston?.visible) check(H.piston);
    for (const acc of car.parts.acc || []) if (!acc.off) check(H['acc:' + acc.name]);
    if (withWheels) check(H.wheels);
    return Math.min(lift, 2.5);
  }

  // ------------------------------------------------------------ particles
  // All short-lived effects share instanced pools: one draw call per effect type.
  pools() {
    if (this._pools && this._pools.scene === this.scene) return this._pools;
    const mk = (geo, mat, n, order = 0) => {
      const m = new THREE.InstancedMesh(geo, mat, n); m.count = n; m.frustumCulled = false; m.renderOrder = order;
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      const hide = new THREE.Matrix4().makeScale(0, 0, 0); for (let i = 0; i < n; i++) m.setMatrixAt(i, hide);
      this.scene.add(m); return m;
    };
    if (!this.trackTex) {
      const c = P.createCanvas(16, 16); const g = c.getContext('2d');
      g.fillStyle = 'rgba(40,28,20,0.9)'; for (let i = 0; i < 16; i += 5) g.fillRect(1, i, 14, 3);
      this.trackTex = new THREE.CanvasTexture(c); this.trackTex.magFilter = THREE.NearestFilter; this.trackTex.userData.shared = true;
    }
    const box1 = new THREE.BoxGeometry(1, 1, 1);
    const PL = {
      scene: this.scene,
      bits: { mesh: mk(box1, new THREE.MeshLambertMaterial({ color: 0xffffff }), 240), items: [], next: 0 },
      smoke: { mesh: mk(this.smokeGeo(), this.smokeMat(), 200, 2), items: [], next: 0 },
      track: { mesh: mk(new THREE.PlaneGeometry(0.5, 0.52), new THREE.MeshLambertMaterial({ map: this.trackTex, transparent: true, opacity: 0.3, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 }), 240, 1), items: [], next: 0 },
    };
    PL.bits.mesh.setColorAt(0, new THREE.Color()); PL.bits.mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    for (const k of ['bits', 'smoke', 'track']) { const pl = PL[k]; for (let i = 0; i < pl.mesh.count; i++) pl.items.push({ life: 0, i }); }
    this._pools = PL;
    return PL;
  }
  // Smoke puffs: smooth round balls, each with its own opacity (instance attribute) so they fade softly.
  smokeGeo() {
    const g = new THREE.SphereGeometry(0.5, 12, 9);
    g.setAttribute('aAlpha', new THREE.InstancedBufferAttribute(new Float32Array(200), 1).setUsage(THREE.DynamicDrawUsage));
    return g;
  }
  smokeMat() {
    const m = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0xb4b4b4, transparent: true, opacity: 0.8, depthWrite: false });
    m.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aAlpha;\nvarying float vAlpha;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvAlpha = aAlpha;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vAlpha;').replace('vec4 diffuseColor = vec4( diffuse, opacity );', 'vec4 diffuseColor = vec4( diffuse, opacity * vAlpha );');
    };
    return m;
  }

  take(pool) { const it = pool.items[pool.next]; pool.next = (pool.next + 1) % pool.items.length; return it; }

  spawn(x, y, z, vx, vy, vz, color, life = 0.8, size = 0.22, grav = -9) {
    const PL = this.pools(), it = this.take(PL.bits);
    it.p ||= new THREE.Vector3(); it.v ||= new THREE.Vector3(); it.r ||= new THREE.Euler();
    it.p.set(x, y, z); it.v.set(vx, vy, vz); it.life = it.max = life; it.size = size; it.grav = grav; it.r.set(0, 0, 0); it.floor = null; it.chunk = false;
    PL.bits.mesh.setColorAt(it.i, _col.setHex(color)); PL.bits.mesh.instanceColor.needsUpdate = true;
    return it;
  }

  // Collision debris: chunky voxel pieces sprayed away from the hit (dirX), bouncing on the ground at floorY.
  // They keep full size most of their life, then shrink away.
  debris(x, y, z, colors, n, speed, dirX, floorY) {
    for (let i = 0; i < n; i++) {
      const s = speed * (0.45 + Math.random() * 0.75), a = (0.25 + Math.random() * 0.9) * Math.PI / 2;
      // start on the camera side of the hit and fly towards the camera a little, so the truck does not hide them
      const it = this.spawn(x, y, z + 0.5 + Math.random() * 0.9, dirX * Math.cos(a) * s + (Math.random() - 0.5) * 1.5, Math.sin(a) * s * 1.2 + 2, (0.15 + Math.random() * 0.85) * s * 0.55,
        colors[i % colors.length], 1.2 + Math.random() * 0.8, 0.24 + Math.random() * 0.26, -16);
      it.floor = floorY; it.chunk = true; it.r.set(Math.random() * 3, Math.random() * 3, 0);
    }
  }
  // The finish gate sways after the crane boom clangs into its banner.
  kickFinish(k) { this.finishKick = Math.min(1.5, (this.finishKick || 0) + k); }

  // Soft voxel exhaust puff: grows, rises and fades.
  smoke(x, y, z, size = 0.3, vx = 0, vy = null) {
    const it = this.take(this.pools().smoke);
    it.p ||= new THREE.Vector3(); it.v ||= new THREE.Vector3(); it.r ||= new THREE.Euler();
    it.p.set(x, y, z); it.r.set(Math.random(), Math.random(), Math.random());
    it.v.set(vx + (Math.random() - 0.5) * 0.4, vy ?? 0.7 + Math.random() * 0.5, (Math.random() - 0.5) * 0.3);
    it.life = it.max = 1.3 + Math.random() * 0.6; it.s0 = size * 0.7; it.s1 = size * (2.6 + Math.random());
    // curl: each puff drifts on a small spiral (rolling smoke) with its own phase and direction
    it.ph = Math.random() * Math.PI * 2; it.cw = (Math.random() < 0.5 ? -1 : 1) * (3 + Math.random() * 2.5); it.ca = size * (0.6 + Math.random() * 0.6);
  }

  // Faint tread mark on the ground, fades out over a few seconds.
  track(x, y, z, ang) {
    const PL = this.pools(), it = this.take(PL.track);
    _q.setFromEuler(_e.set(-Math.PI / 2, 0, ang, 'ZYX'));
    it.m ||= new THREE.Matrix4(); it.m.compose(_v.set(x, y, z), _q, _s.set(1, 1, 1));
    it.life = it.max = 3.2;
    PL.track.mesh.setMatrixAt(it.i, it.m); PL.track.mesh.instanceMatrix.needsUpdate = true;
  }

  updatePools(dt) {
    const PL = this._pools; if (!PL || PL.scene !== this.scene) return;
    const zero = _m.makeScale(0, 0, 0).clone();
    let dirty = false;
    for (const it of PL.bits.items) {
      if (it.life <= 0) continue;
      it.life -= dt; it.v.y += it.grav * dt; it.p.addScaledVector(it.v, dt);
      let spin = 1;
      if (it.floor != null && it.p.y < it.floor + it.size / 2) {
        it.p.y = it.floor + it.size / 2;   // bounce and skid on the ground
        if (it.v.y < 0) { it.v.y = Math.abs(it.v.y) < 1.2 ? 0 : -it.v.y * 0.35; it.v.x *= 0.55; it.v.z *= 0.55; }
        if (!it.v.y) { it.v.x *= Math.exp(-dt * 6); it.v.z *= Math.exp(-dt * 6); spin = 0.1; }
      }
      it.r.x += dt * 4 * spin; it.r.y += dt * 3 * spin;
      const sc = it.size * (it.chunk ? Math.min(1, it.life / it.max * 3.5) : Math.max(0.05, it.life / it.max));
      PL.bits.mesh.setMatrixAt(it.i, it.life <= 0 ? zero : _m.compose(it.p, _q.setFromEuler(it.r), _s.set(sc, sc, sc)));
      dirty = true;
    }
    if (dirty) PL.bits.mesh.instanceMatrix.needsUpdate = true;
    dirty = false;
    const alpha = PL.smoke.mesh.geometry.attributes.aAlpha.array;
    for (const it of PL.smoke.items) {
      if (it.life <= 0) continue;
      it.life -= dt; const k = 1 - it.life / it.max;
      it.p.addScaledVector(it.v, dt); it.v.multiplyScalar(1 - dt * 1.1); it.v.y += dt * 0.35;   // slows down, warm air keeps it rising
      // rolling curl around the drift path, widening as the puff grows
      const ph = it.ph + it.cw * k, ca = it.ca * (0.4 + k);
      _v3.set(it.p.x + Math.cos(ph) * ca, it.p.y + Math.sin(ph) * ca * 0.7, it.p.z);
      it.r.z += dt * it.cw * 0.3;
      const ease = 1 - Math.pow(1 - k, 3), sc = it.s0 + (it.s1 - it.s0) * ease;     // grows fast, then billows out slowly
      alpha[it.i] = it.life <= 0 ? 0 : Math.min(1, k * 7) * Math.pow(1 - k, 1.4);   // soft fade in, long fade out
      PL.smoke.mesh.setMatrixAt(it.i, it.life <= 0 ? zero : _m.compose(_v3, _q.setFromEuler(it.r), _s.set(sc, sc * 0.9, sc)));
      dirty = true;
    }
    if (dirty) { PL.smoke.mesh.instanceMatrix.needsUpdate = true; PL.smoke.mesh.geometry.attributes.aAlpha.needsUpdate = true; }
    dirty = false;
    for (const it of PL.track.items) {
      if (it.life <= 0) continue;
      it.life -= dt;
      if (it.life < 1) {   // fade: narrow the mark away
        const k = Math.max(0, it.life);
        _m.copy(it.m).multiply(_m2.makeScale(k, 1, 1));
        PL.track.mesh.setMatrixAt(it.i, it.life <= 0 ? zero : _m); dirty = true;
      }
    }
    if (dirty) PL.track.mesh.instanceMatrix.needsUpdate = true;
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

  // Broken parts: the crane boom leaves the truck and follows its own physics body; chunks are small
  // voxel cubes in the truck's colours that shrink away before the sim removes them.
  syncDebris(car) {
    const sim = car.sim, z = car.z;
    car.debrisViews ||= new Map();
    const live = new Set(sim.debris || []);
    for (const [d, m] of car.debrisViews) {
      if (live.has(d)) continue;
      if (d.kind === 'boom') {
        const b = car.parts.boom, c = car.spec.crane;
        car.parts.group.add(b); b.position.set(c.pivot[0], c.pivot[1], 0); b.rotation.set(0, 0, c.angle);
        if (car.parts.piston) car.parts.piston.visible = true;
      } else this.scene.remove(m);
      car.debrisViews.delete(d);
    }
    for (const d of live) {
      let m = car.debrisViews.get(d);
      if (!m) {
        if (d.kind === 'boom') {
          if (!car.parts.boom) continue;
          m = car.parts.boom; this.scene.add(m);
          if (car.parts.piston) car.parts.piston.visible = false;
        } else {
          m = new THREE.Group();
          box(m, -d.size / 2, -d.size / 2, -d.size / 2, d.size / 2, d.size / 2, d.size / 2, d.color);
          box(m, -d.size * 0.3, d.size / 2, -d.size * 0.3, d.size * 0.2, d.size * 0.62, d.size * 0.2, d.color);
          m.userData.zoff = (Math.random() - 0.5) * 1.6;
          this.scene.add(m);
        }
        car.debrisViews.set(d, m);
      }
      const q = d.body.getPosition();
      m.position.set(q.x, q.y, z + (m.userData.zoff || 0)); m.rotation.set(0, 0, d.body.getAngle());
      if (d.kind === 'chunk') m.scale.setScalar(Math.min(1, d.ttl / 0.8));
    }
  }

  // ------------------------------------------------------------ per-frame
  update(dt, focus, throttle = 0) {
    this.watchFps(dt);
    const t = performance.now() / 1000;
    for (const car of this.cars) {
      const { sim } = car;
      this.syncDebris(car);
      if (car.flying?.length) this.flyAcc(car, dt);
      if (car.tyres?.length) this.rollTyres(car, dt);
      const c = sim.chassis, al = this.alpha ?? 1, p = sim.pose(c, al);
      const z = car.z;
      // squash & stretch on landings, little hop on finish
      car.squash *= Math.exp(-dt * 7); car.hop = Math.max(0, car.hop - dt);
      const sq = Math.sin(Math.min(1, car.squash) * Math.PI) * car.squash;
      const hopY = car.hop > 0 ? Math.abs(Math.sin(car.hop * 9)) * 0.35 * car.hop : 0;
      if (car.anim) {
        // flip-back: lift, roll upright and drop a little behind the crash spot
        // phases: lift off the ground at the crash angle, roll upright while moving back, drop onto the wheels
        // with a small bounce. Every frame the model (wheels included) is kept above the road.
        const an = car.anim; an.t += dt;
        const k = Math.min(1, an.t / an.dur), ss = (a, b) => { const t = Math.min(1, Math.max(0, (k - a) / (b - a))); return t * t * (3 - 2 * t); };
        const kr = ss(0.12, 0.8), kx = ss(0.08, 0.85);
        const x = an.from.x + (an.to.x - an.from.x) * kx, ang = an.from.a + (an.to.a - an.from.a) * kr;
        let y = an.from.y + (an.to.y - an.from.y) * kx + Math.sin(Math.min(1, k / 0.85) * Math.PI) * 1.1;
        if (k > 0.85) y += Math.abs(Math.sin((k - 0.85) / 0.15 * Math.PI)) * 0.22;   // little bounce on landing
        y += this.hullLift(car, x, y, ang, true);
        car.lift = 0;
        car.parts.group.position.set(x, y, z); car.parts.group.rotation.z = ang; car.parts.group.scale.set(1, 1, 1);
        const ca = Math.cos(ang), sa = Math.sin(ang), sp = car.spec;
        sp.wheelX.forEach((wx, i) => { car.wheels[i].position.set(x + wx * ca - sp.wheelY * sa, y + wx * sa + sp.wheelY * ca, z); car.wheels[i].rotation.z += dt * 12; });
        if (sp.crane) { const cr = sp.crane, tx = cr.pivot[0] + Math.cos(cr.angle) * cr.length, ty = cr.pivot[1] + Math.sin(cr.angle) * cr.length; car.hook.forEach((h, i) => { const ly = ty - cr.linkLen * (i + 0.5); h.position.set(x + tx * ca - ly * sa, y + tx * sa + ly * ca, z); h.rotation.z = ang; }); }
        if (k >= 1) { car.anim = null; car.squash = 0.9; for (let i = 0; i < 8; i++) this.smoke(x + (Math.random() - 0.5) * 3, y - 0.9, z + (Math.random() - 0.5) * 1.8, 0.35, (Math.random() - 0.5) * 2, 0.3 + Math.random() * 0.4); }
        if (an.t >= an.dur * 0.5 && (car.flying?.length || car.tyres?.length)) this.fixAcc(car);   // parts snap back on mid-flip
        if (car.tag) car.tag.position.set(x, y + 3.2, z);
        continue;
      }
      // tipped over, crashed or tumbling: lift the model so no part sinks into the road (instantly up, gently down)
      let na = p.a % (Math.PI * 2); if (na > Math.PI) na -= Math.PI * 2; if (na < -Math.PI) na += Math.PI * 2;
      const needLift = sim.state === 'fail' || Math.abs(na) > 0.9 || sim.airborne;
      const want = needLift ? this.hullLift(car, p.x, p.y, p.a) : 0;
      car.lift = want > car.lift ? want : car.lift + (want - car.lift) * (1 - Math.exp(-dt * 8));
      const ly = hopY + car.lift;
      car.parts.group.position.set(p.x, p.y + ly, z); car.parts.group.rotation.z = p.a;
      car.parts.group.scale.set(1 + sq * 0.1, 1 - sq * 0.16, 1 + sq * 0.08);
      sim.wheels.forEach((w, i) => {
        const q = sim.pose(w, al), wv = car.wheels[i];
        wv.position.set(q.x, q.y + (sim.joints[i] ? ly : 0), z); wv.rotation.z = q.a;
        // tyre squash from suspension compression (joint travel is negative when compressed)
        const tr = sim.joints[i] ? sim.joints[i].getJointTranslation() : 0;
        const comp = Math.min(0.35, Math.max(0, -tr - 0.02)) / 0.35;
        const k = 1 - Math.exp(-dt * 18);
        wv.userData.sq = (wv.userData.sq || 0) + (comp - (wv.userData.sq || 0)) * k;
        wv.scale.set(1 + wv.userData.sq * 0.08, 1 - wv.userData.sq * 0.12, 1 + wv.userData.sq * 0.05);
      });
      sim.hook.forEach((b, i) => { const q = sim.pose(b, al); car.hook[i].position.set(q.x, q.y + (sim.hookJoint ? ly : hopY), z); car.hook[i].rotation.z = q.a; });
      for (const sp of car.parts.spin) sp.obj.rotation[sp.axis] += sp.speed * dt;
      if (car.tag) car.tag.position.set(p.x, p.y + 3.2, z);
      // tyre tracks: drop a mark pair every ~0.45 m a grounded wheel travels
      if (sim.state !== 'fail') {
        car.trk ||= sim.wheels.map(() => ({ x: null }));
        const ang = p.a, sn = Math.sin(ang), cs = Math.cos(ang), r = sim.spec.wheelR;
        sim.wheels.forEach((w, i) => {
          if (sim.lostWheels.has(i)) return;
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
      // tyre smoke on the road: puffs behind a grounded wheel that spins up, slips or brakes hard (no debris on the road)
      car.dustT -= dt;
      if (car === this.cars[0] && car.dustT <= 0 && sim.state === 'run' && throttle !== 0) {
        const vx = sim.chassis.getLinearVelocity().x, r = sim.spec.wheelR;
        sim.wheels.forEach((w, i) => {
          if (sim.lostWheels.has(i) || sim.wheelTouch[i] <= 0) return;
          const slip = Math.abs(w.getAngularVelocity() * r + vx);   // rim speed vs ground speed
          if (slip > 2.5 || Math.abs(w.getAngularVelocity()) > 9) {
            const q = w.getPosition(), back = -Math.sign(throttle || 1);
            this.smoke(q.x + back * r * 0.7, q.y - r + 0.2, z + (Math.random() < 0.5 ? -0.86 : 0.86), 0.3 + Math.min(0.35, slip * 0.04), back * (0.6 + Math.random()), 0.25 + Math.random() * 0.35);
          }
        });
        car.dustT = 0.06;
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
    if (this.finish) {
      this.finish.traverse((o) => { if (o.userData.wave) o.rotation.y = Math.sin(t * 6 + o.position.z) * 0.25; });
      if (this.finishKick > 0.001) { this.finishKick *= Math.exp(-dt * 2.2); this.finish.rotation.z = -Math.sin(t * 17) * this.finishKick * 0.07; }
      else if (this.finish.rotation.z) this.finish.rotation.z = 0;
    }
    this.scene.traverse((o) => { if (o.userData.flicker) { o.userData.sy ??= o.scale.y; o.scale.y = o.userData.sy * (0.85 + Math.sin(t * 20 + o.id) * 0.15); } });
    for (const c of this.clouds || []) c.position.x += dt * 0.4;
    this.updatePools(dt);
    this.pops = (this.pops || []).filter((q) => {
      q.t += dt; q.sp.position.y += dt * 1.6;
      const k = q.t < 0.15 ? q.t / 0.15 : 1; q.sp.scale.set(2.4 * k, 0.6 * k, 1);
      q.sp.material.opacity = Math.max(0, 1 - Math.max(0, q.t - 0.5) / 0.4);
      if (q.t > 0.9) { this.scene.remove(q.sp); return false; } return true;
    });
    if (this.mode === 'game' && focus) this.follow(dt, focus);
    if (this.mode === 'menu') this.menuUpdate(dt);
    this.r.render(this.scene, this.camera);
    this.drawOverlay();
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
      // short screens (16:9) show less height: shift the lanes down to keep room for the HUD and start lights
      look.y += THREE.MathUtils.clamp((aspect - 0.46) * 20, 0, 2);
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

  snapshot(w = 360, h = 380) { return this.capture(this.scene, this.camera, w, h); }

  // Start the flip-back animation from a sim 'recover' event. Angle goes the short way round.
  // Crash: accessories up to this severity tier break off the truck and fly / bounce / skid on the ground.
  // At the edge tier only some go (a medium crash does not always lose the bumper).
  breakAcc(car, tier = 3) {
    const sim = car.sim, v = sim.chassis.getLinearVelocity();
    car.flying ||= [];
    if (tier <= 1) return;   // a gentle roll-over breaks nothing
    // medium: small parts (some of them); big: everything loose, large parts included
    const list = (car.parts.acc || []).filter((a) => !a.off && (tier >= 3 || (a.tier <= 2 && Math.random() < 0.7)));
    for (const a of list) {
      a.off = true;
      const o = a.obj; o.updateWorldMatrix(true, false); o.getWorldPosition(_v); o.getWorldQuaternion(_q);
      this.scene.add(o); o.position.copy(_v); o.quaternion.copy(_q);
      const k = tier >= 3 ? 2.2 : 1.1;   // big crash: parts fly everywhere
      car.flying.push({ a, v: new THREE.Vector3(v.x * 0.45 + (Math.random() - 0.5) * 4 * k, 2.5 + Math.random() * 3 * k, 0.4 + Math.random() * 1.4),
        w: new THREE.Vector3((Math.random() - 0.5) * 7 * k, (Math.random() - 0.5) * 7 * k, (Math.random() - 0.5) * 9 * k) });
    }
  }
  flyAcc(car, dt) {
    const sim = car.sim, water = (sim.level.water ?? -4) - 3;
    for (const f of car.flying) {
      const o = f.a.obj;
      if (o.position.y < water) { o.visible = false; continue; }
      f.v.y -= 18 * dt; o.position.addScaledVector(f.v, dt);
      o.rotation.x += f.w.x * dt; o.rotation.y += f.w.y * dt; o.rotation.z += f.w.z * dt;
      const gy = this.groundY(o.position.x) ?? sim.groundAt(o.position.x);
      _box.setFromObject(o); const bottom = _box.min.y;
      if (gy != null && bottom < gy && o.position.y > gy - 1.5) {
        o.position.y += gy - bottom;   // rest on the road, never in it
        if (f.v.y < 0) { f.v.y = Math.abs(f.v.y) < 1.6 ? 0 : -f.v.y * 0.32; f.v.x *= 0.6; f.v.z *= 0.6; f.w.multiplyScalar(0.55); }
        if (!f.v.y) { const d = Math.exp(-dt * 5); f.v.x *= d; f.v.z *= d; f.w.multiplyScalar(Math.exp(-dt * 7)); }
      }
    }
  }
  // A wheel comes off: the axle splits into its two tyres, which bounce, roll away and fall over.
  splitWheel(car, idx) {
    const sim = car.sim, w = sim.wheels[idx], q = w.getPosition(), v = w.getLinearVelocity(), r = car.spec.wheelR;
    car.wheels[idx].visible = false;
    car.tyres ||= [];
    for (const side of [-1, 1]) {
      const t = buildTyre(r, side); this.scene.add(t);
      t.position.set(q.x, q.y, car.z + side * 0.86); t.rotation.z = w.getAngle();
      const big = (sim.tier ?? 2) >= 3;   // a big smash sends the tyres everywhere
      car.tyres.push({ obj: t, r, side, tip: 0, v: new THREE.Vector3(v.x * 0.5 + (Math.random() - 0.5) * (big ? 10 : 5), (big ? 6.5 : 4) + Math.random() * (big ? 5 : 3.5), side * ((big ? 2 : 1) + Math.random() * (big ? 3.5 : 2))), spin: (Math.random() - 0.5) * (big ? 30 : 18) });
    }
  }
  rollTyres(car, dt) {
    const sim = car.sim;
    for (const t of car.tyres) {
      const o = t.obj; t.v.y -= 18 * dt; o.position.addScaledVector(t.v, dt);
      const tilt = Math.abs(o.rotation.x), gy = this.groundY(o.position.x) ?? sim.groundAt(o.position.x);
      const hh = t.r * Math.cos(tilt) + 0.34 * Math.sin(tilt);   // a tilted tyre: radius * cos + half width * sin
      if (gy != null && o.position.y - hh < gy && o.position.y > gy - 2) {
        o.position.y = gy + hh;
        if (t.v.y < 0) { t.v.y = Math.abs(t.v.y) < 1.5 ? 0 : -t.v.y * 0.45; t.v.z *= 0.7; }   // rubber bounces
        if (!t.v.y) {
          t.spin = -t.v.x / t.r;                                             // rolling
          t.v.x *= Math.exp(-dt * 0.9); t.v.z *= Math.exp(-dt * 3);
          if (Math.abs(t.v.x) < 1.2) t.tip = Math.min(1, t.tip + dt * 1.6);  // slows down, wobbles and falls over
        }
      } else if (o.position.y < (sim.level.water ?? -4) - 3) o.visible = false;
      o.rotation.z += t.spin * dt * (1 - t.tip);
      o.rotation.x = t.side * t.tip * Math.PI / 2 + (t.tip > 0 && t.tip < 1 ? Math.sin(t.tip * 14) * 0.15 * (1 - t.tip) : 0);
    }
  }
  // Back on its wheels: everything is bolted back on.
  fixAcc(car) {
    for (const t of car.tyres || []) this.scene.remove(t.obj);
    car.tyres = [];
    for (const w of car.wheels) w.visible = true;
    for (const a of car.parts.acc || []) {
      if (!a.off) continue;
      a.off = false; const o = a.obj;
      car.parts.group.add(o); o.position.copy(a.home); o.rotation.set(0, 0, 0); o.visible = true;
    }
    car.flying = [];
  }

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
    const aspect = cam.aspect; cam.aspect = 1 / 1.05;
    cam.fov = 38; cam.updateProjectionMatrix(); cam.lookAt(target);
    const shot = this.capture(this.scene, cam, 400, 420);
    cam.position.copy(keep.pos); cam.quaternion.copy(keep.quat); cam.up.copy(keep.up); cam.fov = keep.fov; cam.aspect = aspect; cam.updateProjectionMatrix();
    return shot;
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
    tg.userData.dynamic = true; bake(g);
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
  // Still image of a truck for shop cards and the loading screen (2D canvas, transparent background).
  thumbnail(spec, w = 240, h = 160) {
    const s2 = new THREE.Scene();
    s2.add(new THREE.HemisphereLight(0xffffff, 0x8a9ab8, 1.4));
    const l = new THREE.DirectionalLight(0xffffff, 1.8); l.position.set(-4, 8, 8); s2.add(l);
    const tg = new THREE.Group(); s2.add(tg);
    tg.add(buildTruck(spec).group);
    spec.wheelX.forEach((wx) => { const wv = buildWheel(spec.wheelR, spec.look); wv.position.set(wx, spec.wheelY, 0); tg.add(wv); });
    if (spec.crane) { const c = spec.crane; const y = c.pivot[1] + Math.sin(c.angle) * c.length; const x = c.pivot[0] + Math.cos(c.angle) * c.length; for (let i = 0; i < c.links; i++) { const lk = buildHookLink(i === c.links - 1); lk.position.set(x, y - c.linkLen * (i + 0.5), 0); tg.add(lk); } }
    const cam = new THREE.PerspectiveCamera(30, w / h, 0.1, 100);
    cam.position.set(5.5, 3.6, 8.5); cam.lookAt(0.3, 0.6, 0);
    const shot = this.capture(s2, cam, w, h, { transparent: true });
    s2.traverse((o) => { if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose(); });
    return shot;
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
    // free GPU memory owned only by the previous scene (merged level meshes, label textures, effect pools)
    if (this.scene) {
      const geos = new Set(), mats = new Set(), texs = new Set();
      this.scene.traverse((o) => {
        if (o.geometry && !o.geometry.userData.shared) geos.add(o.geometry);
        for (const m of [].concat(o.material || [])) {
          if (m.userData.shared) continue;
          mats.add(m);
          if (m.map && !m.map.userData.shared) texs.add(m.map);
        }
      });
      geos.forEach((g) => g.dispose()); mats.forEach((m) => m.dispose()); texs.forEach((t) => t.dispose());
    }
    if (this.scene?.background?.isTexture) this.scene.background.dispose();
    // every scene has its own sun: its shadow map is a full render target (up to 2048² depth)
    if (this.sun?.shadow?.map) { this.sun.shadow.map.dispose(); this.sun.shadow.map = null; }
    this.cars = []; this._pools = null; this.finish = null; this.finishKick = 0; this.groundProf = null; this.lanes = []; this.gemViews = []; this.laneCount = 1; this.focusZ = 0; this.punch = 0;
    this.clouds = []; this.dioramaRoot = null; this.menuSpin = []; this.garage = false;
    this.snapCam = true;
  }
}
