// Bundles the game into a single self-contained dist/index.html (used by web, artifact and the Android app).
import { build } from 'esbuild';
import fs from 'fs';
const res = await build({ entryPoints: ['src/main.js'], bundle: true, minify: !process.env.NOMIN, format: 'iife', target: ['es2020'], write: false, legalComments: 'none' });
const js = res.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const font = fs.readFileSync('assets/fredoka.woff2').toString('base64');
const html = fs.readFileSync('src/index.html', 'utf8').replace('__FONT__', () => font).replace('__JS__', () => js);
fs.mkdirSync('dist', { recursive: true });
fs.writeFileSync('dist/index.html', html);
console.log('dist/index.html', (html.length / 1024).toFixed(0) + ' KB');

// Artifact variant: page content without the document wrapper (the host adds doctype/head/body).
const head = html.match(/<head>([\s\S]*?)<\/head>/)[1].replace(/<meta charset[^>]*>/, '').replace(/<meta name="viewport"[^>]*>/, '');
const body = html.match(/<body>([\s\S]*?)<\/body>/)[1];
fs.writeFileSync('dist/artifact.html', head.trim() + '\n' + body.trim() + '\n');

// ---------------------------------------------------------------- TikTok Mini Games package (native runtime)
// game.js (no HTML), game.json, project.config.json, the TTF font for TTMinis.game.loadFont.
const tt = await build({ entryPoints: ['src/tt-entry.js'], bundle: true, minify: !process.env.NOMIN, format: 'iife', target: ['es2018'], write: false, legalComments: 'none' });
const out = 'dist-tiktok';
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(`${out}/game.js`, tt.outputFiles[0].text);
fs.writeFileSync(`${out}/game.json`, JSON.stringify({ deviceOrientation: 'portrait', showStatusBar: false, networkTimeout: { request: 10000, downloadFile: 10000 } }, null, 2));
const ver = JSON.parse(fs.readFileSync('package.json', 'utf8')).version;
fs.writeFileSync(`${out}/project.config.json`, JSON.stringify({ projectname: 'crane-rush', appid: '', version: ver, description: 'Crane Rush - voxel physics truck game', setting: { es6: true, minified: true }, compileType: 'game' }, null, 2));
fs.copyFileSync('assets/fredoka.ttf', `${out}/fredoka.ttf`);
const size = fs.readdirSync(out).reduce((a, f) => a + fs.statSync(`${out}/${f}`).size, 0);
console.log(`${out}/ (game.js ${(fs.statSync(`${out}/game.js`).size / 1024).toFixed(0)} KB, package ${(size / 1024).toFixed(0)} KB; limit 4096 KB main package)`);
