// Draw-call reduction: merge static meshes of a model or a level into a few big meshes.
// Plain-colour Lambert meshes become one vertex-coloured mesh; textured meshes are merged per material.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const vcMats = new Map();
function vertexColorMat(flat, fog) {
  const k = `${flat}|${fog}`;
  if (!vcMats.has(k)) { const m = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: flat, fog }); m.userData.shared = true; vcMats.set(k, m); }
  return vcMats.get(k);
}

const isPlain = (m) => m && m.isMeshLambertMaterial && !m.map && !m.transparent && m.emissive.getHex() === 0 && m.opacity === 1;

// Geometry in `root` space, non-indexed, with only position/normal(/uv).
function transformed(mesh, inv) {
  let g = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
  const keep = ['position', 'normal', 'uv'];
  for (const k of Object.keys(g.attributes)) if (!keep.includes(k)) g.deleteAttribute(k);
  if (!g.attributes.normal) g.computeVertexNormals();
  g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, mesh.matrixWorld));
  return g;
}

function sliceGroup(g, grp) {
  const out = new THREE.BufferGeometry();
  for (const [k, a] of Object.entries(g.attributes)) {
    const n = a.itemSize;
    out.setAttribute(k, new THREE.BufferAttribute(a.array.slice(grp.start * n, (grp.start + grp.count) * n), n));
  }
  return out;
}

// Merge the static meshes directly or indirectly under `root`. Subtrees with userData.dynamic
// (moving parts) and meshes with userData.noBake/flicker/wave are left untouched.
export function bake(root, { shadows = true } = {}) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const colored = { flat: [], smooth: [] };
  const byMat = new Map();
  const remove = [];
  let fog = true;
  const walk = (o) => {
    if (o !== root && o.userData.dynamic) return;
    for (const c of [...o.children]) walk(c);
    if (!o.isMesh || o.isInstancedMesh || o.userData.noBake || o.userData.flicker || o.userData.wave) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    if (!Array.isArray(o.material) && isPlain(o.material)) {
      const g = transformed(o, inv);
      const c = o.material.color, n = g.attributes.position.count, col = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      if (g.attributes.uv) g.deleteAttribute('uv');
      (o.material.flatShading ? colored.flat : colored.smooth).push(g);
      fog = fog && o.material.fog;
      remove.push(o); return;
    }
    if (mats.some((m) => m.transparent || !m.isMeshLambertMaterial)) return;
    const g = transformed(o, inv);
    if (!g.attributes.uv) return;
    const groups = Array.isArray(o.material) ? (g.groups.length ? g.groups : [{ start: 0, count: g.attributes.position.count, materialIndex: 0 }]) : [{ start: 0, count: g.attributes.position.count, materialIndex: 0 }];
    for (const grp of groups) {
      const m = mats[grp.materialIndex ?? 0];
      if (!byMat.has(m)) byMat.set(m, []);
      byMat.get(m).push(Array.isArray(o.material) ? sliceGroup(g, grp) : g);
    }
    remove.push(o);
  };
  walk(root);
  for (const o of remove) o.parent.remove(o);
  const add = (geos, material) => {
    if (!geos.length) return;
    const merged = mergeGeometries(geos, false); if (!merged) return;
    const m = new THREE.Mesh(merged, material);
    m.castShadow = shadows; m.receiveShadow = true; m.userData.baked = true;
    root.add(m);
  };
  add(colored.flat, vertexColorMat(true, fog));
  add(colored.smooth, vertexColorMat(false, fog));
  for (const [m, geos] of byMat) add(geos, m);
  return root;
}
