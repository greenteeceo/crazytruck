// Bundles the game into a single self-contained dist/index.html (used by web, artifact and the Android app).
import { build } from 'esbuild';
import fs from 'fs';
const res = await build({ entryPoints: ['src/main.js'], bundle: true, minify: true, format: 'iife', target: ['es2020'], write: false, legalComments: 'none' });
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
