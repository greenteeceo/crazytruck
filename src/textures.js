// Procedural pixel-art textures (16px per metre) for the voxel look.
import * as THREE from 'three';

let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const hex = (c) => '#' + c.toString(16).padStart(6, '0');

function canvasTex(w, h, draw, { repeat = true } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  t.anisotropy = 16;
  return t;
}

function noise(g, w, h, base, specks, amount = 0.12, size = 1) {
  g.fillStyle = base; g.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += size) for (let x = 0; x < w; x += size) {
    if (rnd() < amount) { g.fillStyle = specks[(rnd() * specks.length) | 0]; g.fillRect(x, y, size, size); }
  }
}

function bricks(g, w, h, base, mortar, light, bw = 8, bh = 4) {
  g.fillStyle = mortar; g.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += bh) {
    const off = ((y / bh) % 2) * (bw / 2);
    for (let x = -bw; x < w + bw; x += bw) {
      g.fillStyle = rnd() < 0.3 ? light : base;
      g.fillRect(x + off + 1, y + 1, bw - 1, bh - 1);
    }
  }
}

const cache = {};
export function tex(name) {
  if (cache[name]) return cache[name];
  seed = 1 + name.length * 977 + name.charCodeAt(0) * 31;
  let t;
  switch (name) {
    case 'grassTop': t = canvasTex(16, 16, (g, w, h) => noise(g, w, h, '#46d35c', ['#5ee872', '#3bbf50', '#6ff07f'], 0.2)); break;
    case 'grassSide': t = canvasTex(16, 8, (g, w, h) => {
      g.clearRect(0, 0, w, h); g.fillStyle = '#46d35c'; g.fillRect(0, 0, w, 4);
      for (let x = 0; x < w; x++) { const d = 4 + ((rnd() * 4) | 0); g.fillStyle = rnd() < 0.5 ? '#46d35c' : '#3bbf50'; g.fillRect(x, 3, 1, d - 3); }
      for (let x = 0; x < w; x += 2) if (rnd() < 0.5) { g.fillStyle = '#6ff07f'; g.fillRect(x, 0, 1, 1); }
    }); break;
    case 'dirt': t = canvasTex(16, 16, (g, w, h) => noise(g, w, h, '#f7c9a9', ['#ecb58f', '#fcd8bf', '#e6a982'], 0.08, 2)); break;
    case 'sand': t = canvasTex(16, 16, (g, w, h) => noise(g, w, h, '#ffd9b8', ['#f4c49e', '#ffe6cc'], 0.1, 2)); break;
    case 'wood': t = canvasTex(16, 16, (g, w, h) => {
      g.fillStyle = '#c9765a'; g.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 4) { g.fillStyle = '#a95d48'; g.fillRect(0, y + 3, w, 1); g.fillStyle = '#d98c6e'; g.fillRect(0, y, w, 1); }
      for (let i = 0; i < 6; i++) { g.fillStyle = '#b5664f'; g.fillRect((rnd() * w) | 0, (rnd() * h) | 0, 3, 1); }
    }); break;
    case 'plank': t = canvasTex(16, 16, (g, w, h) => {
      noise(g, w, h, '#c9765a', ['#b5664f', '#d98c6e'], 0.15);
      g.fillStyle = '#9a523f'; g.fillRect(0, 0, w, 1); g.fillRect(0, h - 1, w, 1); g.fillRect(0, 0, 1, h); g.fillRect(w - 1, 0, 1, h);
      g.fillStyle = '#d6dbe6'; g.fillRect(2, 2, 2, 2); g.fillRect(w - 4, 2, 2, 2); g.fillRect(2, h - 4, 2, 2); g.fillRect(w - 4, h - 4, 2, 2);
    }); break;
    case 'stone': t = canvasTex(16, 16, (g, w, h) => bricks(g, w, h, '#a3a8b6', '#7d8292', '#b8bdca')); break;
    case 'castle': t = canvasTex(16, 16, (g, w, h) => bricks(g, w, h, '#b9bdc9', '#8c90a0', '#cdd1db', 8, 4)); break;
    case 'castleTop': t = canvasTex(16, 16, (g, w, h) => bricks(g, w, h, '#a7acbb', '#878b9b', '#bfc3cf', 8, 8)); break;
    case 'concrete': t = canvasTex(16, 16, (g, w, h) => { noise(g, w, h, '#c4c8d4', ['#b3b8c6', '#d2d6e0'], 0.12); g.fillStyle = '#a9aebd'; g.fillRect(0, 15, w, 1); g.fillRect(15, 0, 1, h); }); break;
    case 'concreteTop': t = canvasTex(16, 16, (g, w, h) => { noise(g, w, h, '#b7bcc9', ['#a9aebd', '#c6cad6'], 0.12); g.fillStyle = '#ffd21a'; g.fillRect(0, 6, w, 2); }); break;
    case 'girder': t = canvasTex(16, 16, (g, w, h) => {
      g.fillStyle = '#e8333c'; g.fillRect(0, 0, w, h); g.fillStyle = '#b81f2a'; g.fillRect(0, 0, w, 2); g.fillRect(0, h - 2, w, 2);
      g.fillStyle = '#c4242f'; for (let x = 0; x < w; x += 8) { g.fillRect(x, 2, 1, h - 4); }
      g.fillStyle = '#ff7078'; for (let x = 3; x < w; x += 8) { g.fillRect(x, 4, 2, 2); g.fillRect(x, h - 6, 2, 2); }
    }); break;
    case 'metal': t = canvasTex(16, 16, (g, w, h) => {
      g.fillStyle = '#3b4766'; g.fillRect(0, 0, w, h); g.fillStyle = '#2b3550'; g.fillRect(0, 0, w, 1); g.fillRect(0, 0, 1, h);
      g.fillStyle = '#4a5878'; g.fillRect(1, 1, w - 2, 1); g.fillRect(1, 1, 1, h - 2);
      g.fillStyle = '#8fa0c4'; g.fillRect(3, 3, 1, 1); g.fillRect(12, 3, 1, 1); g.fillRect(3, 12, 1, 1); g.fillRect(12, 12, 1, 1);
    }); break;
    case 'metalTop': t = canvasTex(16, 16, (g, w, h) => { noise(g, w, h, '#d9e0ec', ['#c7cfde', '#e6ebf3'], 0.1); g.fillStyle = '#9aa6bd'; g.fillRect(0, 0, w, 1); g.fillRect(0, 0, 1, h); }); break;
    case 'pad': t = canvasTex(16, 16, (g, w, h) => { g.fillStyle = '#18cfff'; g.fillRect(0, 0, w, h); g.fillStyle = '#9ff4ff'; g.fillRect(2, 2, w - 4, h - 4); g.fillStyle = '#4fe2ff'; g.fillRect(4, 4, w - 8, h - 8); }); break;
    case 'crate': t = canvasTex(16, 16, (g, w, h) => {
      g.fillStyle = '#ff8a1f'; g.fillRect(0, 0, w, h); g.fillStyle = '#d96a0c'; g.fillRect(0, 0, w, 2); g.fillRect(0, h - 2, w, 2); g.fillRect(0, 0, 2, h); g.fillRect(w - 2, 0, 2, h);
      for (let i = 2; i < 14; i++) { g.fillRect(i, i, 2, 1); g.fillRect(w - i - 2, i, 2, 1); }
    }); break;
    case 'labcrate': t = canvasTex(16, 16, (g, w, h) => {
      noise(g, w, h, '#f2604c', ['#e04a38', '#ff7a66'], 0.2, 2); g.fillStyle = '#b8352a'; g.fillRect(0, 0, w, 1); g.fillRect(0, h - 1, w, 1); g.fillRect(0, 0, 1, h); g.fillRect(w - 1, 0, 1, h);
    }); break;
    case 'log': t = canvasTex(16, 16, (g, w, h) => { noise(g, w, h, '#8a5233', ['#6f3f26', '#a0623f'], 0.25, 2); }); break;
    case 'barrel': t = canvasTex(16, 16, (g, w, h) => { g.fillStyle = '#2f7cf6'; g.fillRect(0, 0, w, h); g.fillStyle = '#ffd21a'; g.fillRect(0, 3, w, 2); g.fillRect(0, 11, w, 2); }); break;
    case 'hazard': t = canvasTex(16, 16, (g, w, h) => {
      g.fillStyle = '#ffcc12'; g.fillRect(0, 0, w, h); g.fillStyle = '#1d1d22';
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (((x + y) % 8) < 4) g.fillRect(x, y, 1, 1);
    }); break;
    case 'checker': t = canvasTex(8, 8, (g, w, h) => { for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { g.fillStyle = (Math.floor(x / 2) + Math.floor(y / 2)) % 2 ? '#1d1d22' : '#ffffff'; g.fillRect(x, y, 1, 1); } }); break;
    // ---- world 5-20 ground textures
    case 'sandstone': t = canvasTex(16, 16, (g, w, h) => { noise(g, w, h, '#f0b878', ['#e2a362', '#f7c98e'], 0.12, 2); g.fillStyle = '#d99a58'; g.fillRect(0, 5, w, 1); g.fillRect(0, 11, w, 1); }); break;
    case 'desertTop': t = canvasTex(16, 16, (g, w, h) => { noise(g, w, h, '#ffd796', ['#f6c87e', '#ffe3ae'], 0.15, 1); g.fillStyle = '#f0c27c'; for (let x = 0; x < w; x += 4) g.fillRect(x, (x * 3) % 16, 3, 1); }); break;
    case 'snowTop': t = canvasTex(16, 16, (g, w, h) => noise(g, w, h, '#ffffff', ['#eef5ff', '#e2edfb'], 0.15)); break;
    case 'snowSide': t = canvasTex(16, 8, (g, w, h) => { g.clearRect(0, 0, w, h); g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, 4); for (let x = 0; x < w; x++) { const d = 4 + ((rnd() * 4) | 0); g.fillStyle = rnd() < 0.5 ? '#ffffff' : '#e6f0fc'; g.fillRect(x, 3, 1, d - 3); } }); break;
    case 'frozenDirt': t = canvasTex(16, 16, (g, w, h) => noise(g, w, h, '#b9c7dc', ['#a6b6cd', '#c9d6e8'], 0.12, 2)); break;
    case 'jungleTop': t = canvasTex(16, 16, (g, w, h) => noise(g, w, h, '#2fb24f', ['#279a43', '#3ccb5c', '#1f8a3a'], 0.25)); break;
    case 'jungleSide': t = canvasTex(16, 8, (g, w, h) => { g.clearRect(0, 0, w, h); g.fillStyle = '#2fb24f'; g.fillRect(0, 0, w, 4); for (let x = 0; x < w; x++) { const d = 4 + ((rnd() * 4) | 0); g.fillStyle = rnd() < 0.5 ? '#2fb24f' : '#1f8a3a'; g.fillRect(x, 3, 1, d - 3); } for (let x = 1; x < w; x += 5) { g.fillStyle = '#1f8a3a'; g.fillRect(x, 4, 1, 4); } }); break;
    case 'mud': t = canvasTex(16, 16, (g, w, h) => noise(g, w, h, '#b07a52', ['#9a6a46', '#c08a60'], 0.12, 2)); break;
    case 'basalt': t = canvasTex(16, 16, (g, w, h) => { noise(g, w, h, '#3a3340', ['#2e2934', '#463e4e'], 0.2, 2); g.fillStyle = '#ff6a1a'; g.fillRect(3, 6, 4, 1); g.fillRect(6, 7, 1, 3); g.fillRect(11, 12, 3, 1); }); break;
    case 'basaltTop': t = canvasTex(16, 16, (g, w, h) => { noise(g, w, h, '#4a4250', ['#3a3340', '#564c5e'], 0.2, 2); g.fillStyle = '#ff8a2a'; g.fillRect(2, 3, 5, 1); g.fillRect(9, 10, 1, 4); g.fillRect(9, 10, 4, 1); }); break;
    case 'candy': t = canvasTex(16, 16, (g, w, h) => { g.fillStyle = '#fff3f8'; g.fillRect(0, 0, w, h); g.fillStyle = '#ff6fb5'; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (((x + y) % 8) < 3) g.fillRect(x, y, 1, 1); }); break;
    case 'candyTop': t = canvasTex(16, 16, (g, w, h) => { g.fillStyle = '#ffd1ea'; g.fillRect(0, 0, w, h); const cs = ['#ff5a8a', '#5ac8ff', '#ffe04a', '#7ae86a', '#ffffff']; for (let i = 0; i < 14; i++) { g.fillStyle = cs[i % cs.length]; g.fillRect((rnd() * 15) | 0, (rnd() * 15) | 0, 2, 1); } }); break;
    case 'candySide': t = canvasTex(16, 8, (g, w, h) => { g.clearRect(0, 0, w, h); g.fillStyle = '#ffd1ea'; g.fillRect(0, 0, w, 4); for (let x = 0; x < w; x += 4) { g.fillRect(x, 4, 3, 2 + ((rnd() * 3) | 0)); } }); break;
    case 'beachTop': t = canvasTex(16, 16, (g, w, h) => { noise(g, w, h, '#ffe2a8', ['#f8d494', '#fff0c8'], 0.15); g.fillStyle = '#ffffff'; g.fillRect((rnd() * 14) | 0, (rnd() * 14) | 0, 2, 1); }); break;
    case 'asphalt': t = canvasTex(16, 16, (g, w, h) => { noise(g, w, h, '#4a4e5e', ['#3e4252', '#565a6c'], 0.18); g.fillStyle = '#ffd21a'; g.fillRect(0, 0, w, 1); }); break;
    case 'asphaltTop': t = canvasTex(16, 16, (g, w, h) => { noise(g, w, h, '#3a3e4c', ['#323644', '#444858'], 0.18); g.fillStyle = '#f2f2f2'; g.fillRect(2, 7, 6, 2); }); break;
    case 'docksTop': t = canvasTex(16, 16, (g, w, h) => { g.fillStyle = '#a8724a'; g.fillRect(0, 0, w, h); for (let x = 0; x < w; x += 4) { g.fillStyle = '#87573a'; g.fillRect(x + 3, 0, 1, h); g.fillStyle = '#b8825a'; g.fillRect(x, 0, 1, h); } g.fillStyle = '#5a3a22'; g.fillRect(1, 2, 1, 1); g.fillRect(9, 12, 1, 1); }); break;
    case 'moon': t = canvasTex(16, 16, (g, w, h) => noise(g, w, h, '#8e93a6', ['#7c8194', '#a0a5b8'], 0.2, 2)); break;
    case 'moonTop': t = canvasTex(16, 16, (g, w, h) => { noise(g, w, h, '#b8bccb', ['#a6aabb', '#c8ccd8'], 0.15); g.fillStyle = '#8e93a6'; g.fillRect(3, 3, 4, 4); g.fillStyle = '#c8ccd8'; g.fillRect(4, 4, 2, 2); g.fillStyle = '#9a9fb0'; g.fillRect(11, 10, 3, 3); }); break;
    case 'mars': t = canvasTex(16, 16, (g, w, h) => { noise(g, w, h, '#b8543a', ['#a4462e', '#c86448'], 0.2, 2); g.fillStyle = '#94402a'; g.fillRect(0, 7, w, 1); }); break;
    case 'marsTop': t = canvasTex(16, 16, (g, w, h) => noise(g, w, h, '#d8744e', ['#c86442', '#e88a62'], 0.2)); break;
    case 'coral': t = canvasTex(16, 16, (g, w, h) => noise(g, w, h, '#ffd8c0', ['#ffc8a8', '#ffe4d2'], 0.12, 2)); break;
    case 'coralTop': t = canvasTex(16, 16, (g, w, h) => { noise(g, w, h, '#ff8a9a', ['#ff6a8a', '#ffa0ac', '#ffb46a'], 0.3); }); break;
    case 'coralSide': t = canvasTex(16, 8, (g, w, h) => { g.clearRect(0, 0, w, h); g.fillStyle = '#ff8a9a'; g.fillRect(0, 0, w, 3); for (let x = 0; x < w; x += 2) { g.fillStyle = rnd() < 0.5 ? '#ff6a8a' : '#ffb46a'; g.fillRect(x, 3, 2, 1 + ((rnd() * 4) | 0)); } }); break;
    case 'autumnTop': t = canvasTex(16, 16, (g, w, h) => noise(g, w, h, '#f29a2a', ['#e8782a', '#ffbc3a', '#d85a1a'], 0.3)); break;
    case 'autumnSide': t = canvasTex(16, 8, (g, w, h) => { g.clearRect(0, 0, w, h); g.fillStyle = '#f29a2a'; g.fillRect(0, 0, w, 4); for (let x = 0; x < w; x++) { const d = 4 + ((rnd() * 4) | 0); g.fillStyle = rnd() < 0.5 ? '#f29a2a' : '#d85a1a'; g.fillRect(x, 3, 1, d - 3); } }); break;
    case 'ice': t = canvasTex(16, 16, (g, w, h) => { g.fillStyle = '#7ac8f0'; g.fillRect(0, 0, w, h); g.fillStyle = '#a8e0fa'; for (let i = 0; i < 16; i++) g.fillRect(i, 15 - i, 1, 1); g.fillStyle = '#5aa8d8'; g.fillRect(0, 15, w, 1); g.fillRect(15, 0, 1, h); }); break;
    case 'iceTop': t = canvasTex(16, 16, (g, w, h) => { g.fillStyle = '#d8f4ff'; g.fillRect(0, 0, w, h); g.fillStyle = '#ffffff'; g.fillRect(2, 2, 5, 1); g.fillRect(9, 9, 4, 1); g.fillStyle = '#b8e4fa'; g.fillRect(0, 0, w, 1); g.fillRect(0, 0, 1, h); }); break;
    case 'toy': t = canvasTex(16, 16, (g, w, h) => { const cs = ['#ff4a4a', '#3a9aff', '#ffd23a', '#4ac85a']; for (let y = 0; y < h; y += 8) for (let x = 0; x < w; x += 8) { g.fillStyle = cs[((x + y) / 8 + y / 8) % 4]; g.fillRect(x, y, 8, 8); g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(x, y + 7, 8, 1); g.fillRect(x + 7, y, 1, 8); } }); break;
    case 'toyTop': t = canvasTex(16, 16, (g, w, h) => { g.fillStyle = '#4ac85a'; g.fillRect(0, 0, w, h); for (let y = 2; y < h; y += 8) for (let x = 2; x < w; x += 8) { g.fillStyle = '#6ae07a'; g.fillRect(x, y, 4, 4); g.fillStyle = '#38a848'; g.fillRect(x + 1, y + 4, 4, 1); } }); break;
    case 'neon': t = canvasTex(16, 16, (g, w, h) => { g.fillStyle = '#1a0838'; g.fillRect(0, 0, w, h); g.fillStyle = '#ff3fd0'; g.fillRect(0, 0, w, 1); g.fillRect(0, 0, 1, h); }); break;
    case 'neonTop': t = canvasTex(16, 16, (g, w, h) => { g.fillStyle = '#24104a'; g.fillRect(0, 0, w, h); g.fillStyle = '#3af0ff'; g.fillRect(0, 0, w, 1); g.fillRect(0, 0, 1, h); }); break;
    case 'cloudTop': t = canvasTex(16, 16, (g, w, h) => noise(g, w, h, '#ffffff', ['#f0f6ff', '#e6f0fc'], 0.12)); break;
    case 'cloudSide': t = canvasTex(16, 8, (g, w, h) => { g.clearRect(0, 0, w, h); g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, 5); for (let x = 0; x < w; x += 3) { g.beginPath(); g.fillRect(x, 5, 3, 1 + ((rnd() * 3) | 0)); } }); break;
    default: t = canvasTex(4, 4, (g) => { g.fillStyle = '#ff00ff'; g.fillRect(0, 0, 4, 4); });
  }
  cache[name] = t;
  return t;
}

export function skyTexture(top, bottom) {
  const c = document.createElement('canvas'); c.width = 2; c.height = 256;
  const g = c.getContext('2d'); const gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, top); gr.addColorStop(1, bottom); g.fillStyle = gr; g.fillRect(0, 0, 2, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export { hex };
