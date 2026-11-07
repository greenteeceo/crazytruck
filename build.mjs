// Bundles the game into a single self-contained dist/index.html (used by web, artifact and the Android app).
import { build } from 'esbuild';
import fs from 'fs';
const res = await build({ entryPoints: ['src/main.js'], bundle: true, minify: !process.env.NOMIN, format: 'iife', target: ['es2020'], write: false, legalComments: 'none', loader: { '.jpg': 'dataurl' } });
const js = res.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const font = fs.readFileSync('assets/fredoka.woff2').toString('base64');
// the game icon: browser tab (64 px) and home-screen icon (180 px), inlined
const icons = `<link rel="icon" type="image/png" href="data:image/png;base64,${fs.readFileSync('assets/icon-64.png').toString('base64')}"><link rel="apple-touch-icon" href="data:image/png;base64,${fs.readFileSync('assets/icon-180.png').toString('base64')}">`;
const html = fs.readFileSync('src/index.html', 'utf8').replace('__FONT__', () => font).replace('__JS__', () => js).replace('</head>', () => icons + '</head>');
fs.mkdirSync('dist', { recursive: true });
fs.writeFileSync('dist/index.html', html);
console.log('dist/index.html', (html.length / 1024).toFixed(0) + ' KB');

// Artifact variant: page content without the document wrapper (the host adds doctype/head/body).
const head = html.match(/<head>([\s\S]*?)<\/head>/)[1].replace(/<meta charset[^>]*>/, '').replace(/<meta name="viewport"[^>]*>/, '');
const body = html.match(/<body>([\s\S]*?)<\/body>/)[1];
fs.writeFileSync('dist/artifact.html', head.trim() + '\n' + body.trim() + '\n');

// ---------------------------------------------------------------- TikTok Mini Games package (native runtime)
// game.js (no HTML), game.json, project.config.json, the TTF font for TTMinis.game.loadFont.
// The HS kit (hs-kit/hs-game.js + hs-sdk.min.js) is loaded by game.js itself, next to it; the local stand-in
// used by the web build is left out.
const noLocalHS = { name: 'no-local-hs', setup(b) { b.onResolve({ filter: /hs-local\.js$/ }, () => ({ path: 'hs-local', namespace: 'empty' })); b.onLoad({ filter: /.*/, namespace: 'empty' }, () => ({ contents: '' })); } };
const tt = await build({ entryPoints: ['src/tt-entry.js'], bundle: true, minify: !process.env.NOMIN, format: 'iife', target: ['es2018'], write: false, legalComments: 'none', plugins: [noLocalHS], loader: { '.jpg': 'dataurl' }, define: { __STORE__: process.env.DEVTOOLS ? 'false' : 'true' } });   // DEVTOOLS=1: keep Autoplay / AUTO / TEST in the TikTok package
const out = 'dist-tiktok';
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(`${out}/game.js`, "var HSGame = require('./hs-game.js');   // the HS SDK kit: ads, rewards, missions, share, cloud save, shop\nglobalThis.HSGame = HSGame;\n" + tt.outputFiles[0].text);
for (const f of ['hs-game.js', 'hs-sdk.min.js']) fs.copyFileSync(`hs-kit/${f}`, `${out}/${f}`);
// HS dashboard data, NEXT TO the game folder (never uploaded): ad places, rewards, items, products
const { AD_PLACES, DEFAULTS, PRODUCTS } = await import('./src/economy.js');
const dash = {
  iaa_config: {
    placements: AD_PLACES.map((p) => ({ label: p.label, ads: [{ id: `<${p.type} AD UNIT ID for ${p.label}>`, type: p.type, config: { cooldown: p.cooldown } }] })),
    rewards: DEFAULTS.rewards, items: DEFAULTS.items,
  },
  products: PRODUCTS.map(({ id, name, description, beans_cost, rewards, badge }) => ({ id, name, description, beans_cost, rewards, ...(badge ? { badge } : {}) })),
};
const dashFile = `${out}.hs-dashboard.json`;
let keep = null; try { keep = JSON.parse(fs.readFileSync(dashFile, 'utf8')); } catch { /* first build */ }
// keep ad unit ids already filled in by hand
for (const pl of dash.iaa_config.placements) { const o = keep?.iaa_config?.placements?.find((x) => x.label === pl.label); if (o?.ads?.[0]?.id && !o.ads[0].id.startsWith('<')) pl.ads[0].id = o.ads[0].id; }
fs.writeFileSync(dashFile, JSON.stringify(dash, null, 2));
fs.writeFileSync(`${out}/game.json`, JSON.stringify({ deviceOrientation: 'portrait', showStatusBar: false, networkTimeout: { request: 10000, downloadFile: 10000 } }, null, 2));
const ver = JSON.parse(fs.readFileSync('package.json', 'utf8')).version;
fs.writeFileSync(`${out}/project.config.json`, JSON.stringify({ projectname: 'crane-rush', appid: '', version: ver, description: 'Crane Rush - voxel physics truck game', setting: { es6: true, minified: true }, compileType: 'game' }, null, 2));
fs.copyFileSync('assets/fredoka.ttf', `${out}/fredoka.ttf`);
fs.copyFileSync('assets/loading.jpg', `${out}/loading.jpg`);   // the loading screen picture (loaded by path in the TikTok runtime)
const size = fs.readdirSync(out).reduce((a, f) => a + fs.statSync(`${out}/${f}`).size, 0);
console.log(`${out}/ (game.js ${(fs.statSync(`${out}/game.js`).size / 1024).toFixed(0)} KB, package ${(size / 1024).toFixed(0)} KB; limit 4096 KB main package)`);
