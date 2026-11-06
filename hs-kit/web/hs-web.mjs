#!/usr/bin/env node
/*! hs-web.mjs 1.1.0 —a native TikTok mini game as a web page.
 *
 *   node hs-web.mjs preview <game folder> [--port 8090] [--dashboard file.json] [--platform tiktok|android|ios]
 *       The game in a phone-sized frame on your desktop, as TikTok Minis or
 *       as the HS Android / iOS app (switch in the page), with an inspector: what
 *       HSGame sees, the hard cases at one click (fresh install, the app dying
 *       mid-payment, another phone, +1 day…), the checker, a log, the phone's
 *       storage and the cloud. A fake HS backend inside the page answers from
 *       the dashboard JSON — offline, never the live backend (the page may not
 *       connect anywhere else). Listens on 127.0.0.1 only.
 *
 *   node hs-web.mjs pack <game folder>
 *       The package to send HS for the Android build: <game>-android.zip next
 *       to the game folder, from the files next to it — <game>.android.json
 *       (the app's details), <game>.icon-512.png, <game>.hs-dashboard.json.
 *       Checks them, refuses keys / keystores / .env files, and runs hs-check
 *       (0 FAIL needed).
 *
 *   node hs-web.mjs pack <game folder> --tiktok
 *       The zip to upload to TikTok: <game>-tiktok.zip next to the game folder,
 *       the game folder's files at the zip root. Checks TikTok's rules (appid
 *       set, no empty files, 30 MB total / 4 MB main package / 4 MB per
 *       independent subpackage), refuses keys / keystores / .env files, and
 *       runs hs-check (0 FAIL needed; the Android lines are only reported).
 *
 *   node hs-web.mjs pack <game folder> --ios
 *       The zip for the iOS build in the HS portal: <game>-ios.zip next to the
 *       game folder — the folder + ios.json + icon-1024.png (+ <game>.ios-products.json
 *       when there is one, so the build worker's hs-check sees them too).
 *       Refuses keys / certificates / .env files and symlinks, and runs
 *       hs-check --ios (0 FAIL needed).
 *
 *   node hs-web.mjs dashboard <game folder> [--for tiktok|android|ios]
 *       What to paste into the HS dashboard for that HS game, from the JSON
 *       next to the game folder (<game>.hs-dashboard.json / .android- /
 *       .ios-dashboard.json): ① the ad config (saving it creates the ad
 *       units), ② the products import. Refuses while hs-check fails the file.
 *
 *   node hs-web.mjs build <game folder> --out <dir> [--native hs-native.js] [--ads max]
 *       --ads max (or applovin_max, the "ads.provider" of android.json / ios.json):
 *       an app built with the AppLovin MAX plugin also gets max.js
 *       (loaded right after hs-native.js; it runs HSNative.ads on MAX).
 *       The www/ folder the Android app ships: the game's files, index.html,
 *       tt-web-shim.js, hs-loader.js, and game.js bundled into one file
 *       (esbuild when it is installed, else hs-loader.js loads the files at
 *       runtime; it also runs game.json subpackages). The app's
 *       bridge script (hs-native.js, defines HSNative) runs first.
 *
 * Node 18+. No dependencies (esbuild optional, for build).
 */
import { createServer } from 'node:http';
import { cpSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, join, relative, resolve, sep } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { deflateRawSync } from 'node:zlib';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SHIM_FILES = ['tt-web-shim.js', 'hs-loader.js', 'preview-runtime.js', 'preview-shell.js'];

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.css': 'text/css; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.m4a': 'audio/mp4', '.aac': 'audio/aac',
  '.mp4': 'video/mp4', '.ttf': 'font/ttf', '.otf': 'font/otf', '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.wasm': 'application/wasm', '.bin': 'application/octet-stream', '.atlas': 'text/plain; charset=utf-8', '.fnt': 'text/plain; charset=utf-8',
};

/** Files of the game folder that never go into the app. */
const SKIP = new Set(['node_modules', '.git', '.DS_Store', 'project.config.json', 'project.private.config.json']);

function fail(msg) {
  console.error(`hs-web: ${msg}`);
  process.exit(1);
}

function args(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('--')) { out[key] = next; i++; } else out[key] = true;
    } else out._.push(a);
  }
  return out;
}

function gameFolder(p) {
  if (!p) fail('give the game folder (the one with game.js)');
  const dir = resolve(p);
  if (!existsSync(join(dir, 'game.js'))) fail(`no game.js in ${dir}`);
  return dir;
}

/** The game's orientation from game.json — the app locks the screen to it. */
function orientation(dir) {
  try {
    const g = JSON.parse(readFileSync(join(dir, 'game.json'), 'utf8'));
    return g.deviceOrientation === 'landscape' ? 'landscape' : 'portrait';
  } catch {
    return 'portrait';
  }
}

function indexHtml({ title, scripts, boot }) {
  const tags = scripts.map((s) => `  <script src="${s}"></script>`).join('\n');
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">
  <title>${title.replace(/[<>&"]/g, '')}</title>
  <style>html,body{margin:0;height:100%;background:#000;overflow:hidden}</style>
</head>
<body>
${tags}
${boot ? `  <script>${boot}</script>\n` : ''}</body>
</html>
`;
}

// ─── preview ──────────────────────────────────────────────────────────────

// The page may load and run this server's files only, and talk to nothing
// else: the game's real Game ID / SDK key can never reach the live backend.
// (Images may come from anywhere — products and items have remote icons.)
const CSP = "default-src 'self' data: blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; " +
  "img-src 'self' data: blob: https:; media-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; frame-src 'self'; " +
  "form-action 'none'; base-uri 'none'";

function preview(opts) {
  const dir = gameFolder(opts._[1]);
  const port = Number(opts.port) || 8090;
  const dashPath = opts.dashboard ? resolve(String(opts.dashboard)) : `${dir}.hs-dashboard.json`;
  const platformForced = ['android', 'ios', 'tiktok'].includes(opts.platform);
  const name = basename(dir);
  const readDash = () => { try { return JSON.parse(readFileSync(dashPath, 'utf8')); } catch { return null; } };
  // The iOS HS game's products (README, iOS step 3), for the iOS mode.
  const readIosProducts = () => {
    const f = [`${dir}.ios-products.json`, join(dirname(dir), 'ios-products.json')].find((p) => existsSync(p));
    try { const j = f && JSON.parse(readFileSync(f, 'utf8')); return j && Array.isArray(j.products) ? j.products : null; } catch { return null; }
  };

  // The phone: runtime first (network, clock, the platform's services), then the web tt.
  const frame = indexHtml({
    title: `${name} — game`,
    scripts: ['/__hs/preview-runtime.js', '/__hs/tt-web-shim.js', '/__hs/hs-loader.js'],
    boot: "window.__hsPreviewAfterShim && window.__hsPreviewAfterShim(); HSLoader.run('game.js');",
  });
  // The page around it. Read on every load, so an edited dashboard JSON shows at once.
  const shell = () => {
    const cfg = { game: name, orientation: orientation(dir), platform: platformForced ? opts.platform : 'tiktok', platformForced, dashboard: readDash(), iosProducts: readIosProducts() };
    const json = JSON.stringify(cfg).replace(/</g, '\\u003c');
    return `<!doctype html>\n<html>\n<head>\n  <meta charset="utf-8">\n  <title>${name.replace(/[<>&"]/g, '')} — HS preview</title>\n</head>\n<body>\n` +
      `  <script>window.HSPreviewConfig = ${json};</script>\n  <script src="/__hs/preview-shell.js"></script>\n</body>\n</html>\n`;
  };

  // hs-check, run in the background and kept for the inspector.
  let check = null;
  const runCheck = () => {
    check = { running: true };
    const args = [join(HERE, '..', 'hs-check.mjs'), dir, '--json'];
    if (existsSync(dashPath)) args.push('--dashboard', dashPath);
    if (!existsSync(args[0])) { check = { error: 'hs-check.mjs not found next to web/' }; return; }
    const child = spawn(process.execPath, args, { stdio: ['ignore', 'pipe', 'ignore'] });
    let out = '';
    child.stdout.on('data', (d) => { out += d; });
    child.on('close', () => { try { check = JSON.parse(out); } catch { check = { error: 'hs-check gave no result' }; } });
  };
  runCheck();

  const send = (res, status, type, body) => {
    res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': CSP });
    res.end(body);
  };

  const server = createServer((req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, MIME['.txt'], 'GET only');
    // This computer's own names only: a web page whose domain is re-pointed at
    // 127.0.0.1 (DNS rebinding) must not read the game and its keys through the browser.
    const host = String(req.headers.host || '');
    if (host !== `127.0.0.1:${port}` && host !== `localhost:${port}`) return send(res, 403, MIME['.txt'], 'wrong host');
    let url;
    try {
      url = new URL(req.url, 'http://x');
      url.pathname = decodeURIComponent(url.pathname);
    } catch {
      return send(res, 400, MIME['.txt'], 'bad path');
    }
    const path = url.pathname;
    if (path === '/' || path === '/index.html') return send(res, 200, MIME['.html'], shell());
    if (path === '/__hs_frame.html') return send(res, 200, MIME['.html'], frame);
    if (path === '/__hs/check.json') {
      if (url.searchParams.get('again') && !(check && check.running)) runCheck();
      return send(res, 200, MIME['.json'], JSON.stringify(check || { running: true }));
    }
    if (path.startsWith('/__hs/')) {
      const file = path.slice('/__hs/'.length);
      if (!SHIM_FILES.includes(file)) return send(res, 404, MIME['.txt'], 'not found');
      return send(res, 200, MIME['.js'], readFileSync(join(HERE, file)));
    }
    // A game file — and nothing outside the game folder.
    const file = resolve(dir, '.' + path);
    if (file !== dir && !file.startsWith(dir + sep)) return send(res, 403, MIME['.txt'], 'outside the game folder');
    if (!existsSync(file) || !statSync(file).isFile()) return send(res, 404, MIME['.txt'], 'not found');
    return send(res, 200, MIME[extname(file).toLowerCase()] || 'application/octet-stream', readFileSync(file));
  });

  server.listen(port, '127.0.0.1', () => {
    console.log(`HS preview of ${name} (${orientation(dir)}): http://127.0.0.1:${port}/`);
    console.log(existsSync(dashPath) ? `Dashboard data from ${dashPath}` : `No ${basename(dashPath)} — no ads, rewards or products from a dashboard`);
    console.log('Offline: the game talks only to the fake HS backend in the page. Ctrl+C to stop.');
  });
}

// ─── build ────────────────────────────────────────────────────────────────

function copyGame(dir, out) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name) || name.endsWith('.hs-dashboard.json')) continue;
    cpSync(join(dir, name), join(out, name), {
      recursive: true,
      filter: (src) => !SKIP.has(basename(src)),
    });
  }
}

/**
 * A bundler installed next to this file (the kit's own node_modules) or where
 * hs-web is run from (a build worker's node_modules). Null when neither has it.
 */
async function loadBundler(name) {
  for (const base of [import.meta.url, pathToFileURL(join(process.cwd(), 'noop.js')).href]) {
    try {
      const path = createRequire(base).resolve(name);
      const mod = await import(pathToFileURL(path).href);
      return mod.build ? mod : mod.default;
    } catch {
      /* not installed there */
    }
  }
  return null;
}

/**
 * esbuild (native binary), else esbuild-wasm (runs inside node — for a sandbox
 * that may only exec node), else false: hs-loader.js loads the files at runtime.
 * A bundler that loads but cannot run falls through to the next one.
 */
async function bundle(dir, outFile) {
  for (const name of ['esbuild', 'esbuild-wasm']) {
    const esbuild = await loadBundler(name);
    if (!esbuild) continue;
    try {
      await esbuild.build({
        entryPoints: [join(dir, 'game.js')],
        outfile: outFile,
        bundle: true,
        format: 'iife',
        platform: 'browser',
        target: 'es2017',
        logLevel: 'warning',
        // The game's code stays readable in a crash report.
        minify: false,
        sourcemap: false,
      });
      return name;
    } catch (e) {
      console.log(`  ${name} could not bundle (${String(e && e.message || e).split('\n')[0]}) — trying the next way`);
    }
  }
  return false;
}

async function build(opts) {
  const dir = gameFolder(opts._[1]);
  if (!opts.out || opts.out === true) fail('give --out <dir>');
  const out = resolve(String(opts.out));
  if (out === dir || out.startsWith(dir + sep)) fail('--out must be outside the game folder');
  if (existsSync(out) && readdirSync(out).length) fail(`${out} is not empty`);
  mkdirSync(out, { recursive: true });

  copyGame(dir, out);
  cpSync(join(HERE, 'tt-web-shim.js'), join(out, 'tt-web-shim.js'));
  if (opts.native && opts.native !== true) cpSync(resolve(String(opts.native)), join(out, 'hs-native.js'));

  const bundled = await bundle(dir, join(out, 'game.bundle.js'));
  // Always there: a game.json subpackage is not in the bundle, and the shim
  // runs its game.js through HSLoader (tt.loadSubpackage).
  cpSync(join(HERE, 'hs-loader.js'), join(out, 'hs-loader.js'));

  // The ad provider's adapter (an app built with its native plugin): right after the bridge it extends.
  // --ads takes the provider's name in android.json / ios.json ("applovin_max"), or "max".
  const provider = opts.ads === 'max' ? AD_PROVIDERS.applovin_max : Object.hasOwn(AD_PROVIDERS, opts.ads) ? AD_PROVIDERS[opts.ads] : null;
  if (opts.ads && !provider) fail(`--ads ${opts.ads}: unknown provider (${Object.keys(AD_PROVIDERS).join(', ')})`);
  if (opts.ads) cpSync(join(HERE, provider.adapter), join(out, provider.adapter));

  const scripts = ['hs-native.js', ...(opts.ads ? [provider.adapter] : []), 'tt-web-shim.js', 'hs-loader.js', ...(bundled ? ['game.bundle.js'] : [])];
  writeFileSync(join(out, 'index.html'), indexHtml({
    title: basename(dir),
    scripts,
    boot: bundled ? '' : "HSLoader.run('game.js');",
  }));
  const manifest = {
    game: basename(dir),
    orientation: orientation(dir),
    entry: 'index.html',
    bundled,
    files: listFiles(out).length,
  };
  writeFileSync(join(out, 'hs-web.json'), JSON.stringify(manifest, null, 2) + '\n');
  console.log(`www for ${manifest.game}: ${out}`);
  console.log(`  ${manifest.files} files, ${bundled ? `game bundled (${bundled})` : 'game loaded by hs-loader.js (no bundler could run)'}, ${manifest.orientation}`);
  if (!existsSync(join(out, 'hs-native.js'))) console.log('  hs-native.js is not in it yet — the Android app build adds it.');
}

function listFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...listFiles(p).map((f) => join(name, f)));
    else out.push(relative(dir, p));
  }
  return out;
}

// ─── pack: the package partners send HS for the Android build ────────────

/** Never in a package: signing keys, private keys, environment files. */
const SECRET = /(\.(jks|keystore|p12|p8|pfx|pem|key|mobileprovision)$)|(^\.env)|(\.env$)|(^id_(rsa|dsa|ecdsa|ed25519)$)/i;

/**
 * The app's own HS game in its details file (android.json / ios.json):
 * "hs_game_id" + "hs_sdk_key", both or neither — the build worker uses them
 * when the job brings none. Never the TikTok game's pair, which is in game.js.
 */
function checkHsPair(d, dir, label, problems, notes) {
  const id = d.hs_game_id === undefined || d.hs_game_id === null ? '' : String(d.hs_game_id).trim();
  const key = typeof d.hs_sdk_key === 'string' ? d.hs_sdk_key.trim() : '';
  if (!id && !key) { notes.push(`${label} has no hs_game_id / hs_sdk_key — the build then needs the app's HS game from HS`); return; }
  if (!id || !key) { problems.push('hs_game_id and hs_sdk_key: both or neither'); return; }
  if (!/^\d{10,25}$/.test(id)) problems.push(`hs_game_id: the numeric Game ID of the ${label === 'ios.json' ? 'iOS' : 'Android'} HS game (HS dashboard → Games)`);
  if (!/^sk_(live|test)_[A-Za-z0-9]{16,128}$/.test(key)) problems.push('hs_sdk_key: that HS game\'s SDK key (sk_live_…), no spaces');
  let src = '';
  try { src = readFileSync(join(dir, 'game.js'), 'utf8'); } catch { /* hs-check reports it */ }
  if (src && (src.includes(id) || src.includes(key))) {
    problems.push(`hs_game_id / hs_sdk_key in ${label} are the TikTok game's (they are in game.js) — the app is its own HS game: use its own Game ID + SDK key`);
  }
}

/**
 * The ad providers an app build can carry, and the networks each one mediates,
 * from ../ads-networks.json (the build workers read the same file) —
 * "ads" in android.json / ios.json picks one provider and its networks:
 *   { "provider": "applovin_max", "networks": ["unity", "admob"], "admob_app_id": "ca-app-pub-…~…" }
 * A network's "appId" is a key the app needs inside the binary (no build without it).
 * A new provider or network: ADS-PROVIDERS.md.
 */
const AD_PROVIDERS = loadAdProviders();
function loadAdProviders() {
  const raw = JSON.parse(readFileSync(join(HERE, '..', 'ads-networks.json'), 'utf8'));
  const out = {};
  for (const [name, p] of Object.entries(raw)) {
    if (name.startsWith('_')) continue;
    const networks = {};
    for (const [n, net] of Object.entries(p.networks || {})) {
      const id = net.app_id;
      networks[n] = id ? { appId: id.key, format: new RegExp(id.format), example: id.example } : {};
    }
    out[name] = { adapter: p.adapter, networks };
  }
  return out;
}

/**
 * "ads" in the details file: one provider, only networks it mediates, each
 * network's app id — and the same provider as the HS game's dashboard JSON.
 */
function checkAds(d, label, dashFile, problems, notes) {
  let dashProvider = null, dashAp = null;
  if (dashFile && existsSync(dashFile)) {
    try {
      const ap = JSON.parse(readFileSync(dashFile, 'utf8'))?.iaa_config?.ad_provider;
      if (ap && typeof ap.name === 'string') { dashProvider = ap.name; dashAp = ap; }
    } catch { /* hs-check reports it */ }
  }
  if (d.ads === undefined) {
    if (dashProvider) problems.push(`${basename(dashFile)} sets ad_provider ${dashProvider}, ${label} has no "ads" — add "ads": { "provider": "${dashProvider}", "networks": [] } (or the app is built without ads)`);
    return;
  }
  const a = d.ads;
  if (!a || typeof a !== 'object' || Array.isArray(a)) { problems.push(`ads in ${label}: { "provider": "applovin_max", "networks": [] }`); return; }
  const p = Object.hasOwn(AD_PROVIDERS, a.provider) ? AD_PROVIDERS[a.provider] : null;
  if (!p) { problems.push(`ads.provider "${a.provider}": one of ${Object.keys(AD_PROVIDERS).join(', ')}`); return; }
  if (dashProvider && dashProvider !== a.provider) problems.push(`ads.provider is ${a.provider} but ${basename(dashFile)} has ad_provider ${dashProvider} — the same provider in both`);
  const nets = a.networks === undefined ? [] : a.networks;
  if (!Array.isArray(nets)) { problems.push('ads.networks: a list, like ["unity"] (or [] for the provider\'s own ads only)'); return; }
  const known = Object.keys(p.networks);
  if (new Set(nets).size !== nets.length) problems.push('ads.networks: a network listed twice');
  for (const n of nets) {
    if (!known.includes(n)) problems.push(`ads.networks "${n}": ${a.provider} mediates ${known.join(', ') || 'none'}`);
  }
  for (const [n, net] of Object.entries(p.networks)) {
    if (!net.appId) continue;
    const v = a[net.appId];
    if (!nets.includes(n)) {
      if (v !== undefined) problems.push(`ads.${net.appId} without "${n}" in ads.networks — add it there, or remove the id`);
    } else if (typeof v !== 'string' || !net.format.test(v) || v === net.example) {
      // Exactly as the build writes it into AndroidManifest / Info.plist: no spaces, not the example.
      problems.push(`ads.${net.appId}: the ${n} app id of this ${label === 'ios.json' ? 'iOS' : 'Android'} app, like ${net.example} (no spaces) — the app does not start without it`);
    }
  }
  // The HS game's ad_provider carries the same networks + ids: the build worker
  // checks the package against the live HS game, so both must say the same.
  if (dashAp && dashProvider === a.provider) {
    const theirs = Array.isArray(dashAp.networks) ? dashAp.networks : [];
    if ([...nets].sort().join() !== [...theirs].sort().join()) {
      problems.push(`ads.networks [${nets.join(', ')}] but ${basename(dashFile)} ad_provider.networks [${theirs.join(', ')}] — the same list in both`);
    }
    for (const net of Object.values(p.networks)) {
      const v = dashAp[net.appId];
      if (net.appId && typeof v === 'string' && !PLACEHOLDER_VALUE.test(v) && a[net.appId] !== undefined && v !== a[net.appId]) {
        problems.push(`ads.${net.appId} differs from ${basename(dashFile)} ad_provider.${net.appId} — the same id in both`);
      }
    }
  }
}
const PLACEHOLDER_VALUE = /^<.*>$/;   // "<AdMob app id>": left for HS in the dashboard JSON

function pack(opts) {
  const dir = gameFolder(opts._[1]);
  const name = basename(dir);
  const problems = [];
  const notes = [];
  // <game>.android.json — or android.json, the name inside an earlier package
  // (a studio that unpacked the zip it sent before keeps working).
  const side = (suffix) => {
    const own = join(dirname(dir), name + suffix);
    const plain = join(dirname(dir), suffix.slice(1));
    if (!existsSync(own) && suffix !== '.hs-dashboard.json' && existsSync(plain)) {
      notes.push(`using ${basename(plain)} (from an earlier package) as ${basename(own)}`);
      return plain;
    }
    return own;
  };

  // The app's details.
  const detailsFile = side('.android.json');
  let details = null;
  if (!existsSync(detailsFile)) problems.push(`missing ${basename(detailsFile)} next to the game folder (the app's details — see INTEGRATE-WITH-AI.md, step 5)`);
  else {
    try { details = JSON.parse(readFileSync(detailsFile, 'utf8')); } catch { problems.push(`${basename(detailsFile)} is not valid JSON`); }
  }
  if (details) {
    const d = details;
    if (typeof d.app_name !== 'string' || !d.app_name.trim() || d.app_name.length > 30) problems.push('app_name: 1–30 characters');
    if (d.package_name && !/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/.test(d.package_name)) problems.push('package_name: like com.yourstudio.game (lowercase, dots) — or leave it out and HS picks one');
    if (typeof d.version_name !== 'string' || !/^\d+(\.\d+){0,3}$/.test(d.version_name)) problems.push('version_name: like 1.0.0');
    if (typeof d.privacy_policy_url !== 'string' || !/^https:\/\/\S+$/.test(d.privacy_policy_url)) problems.push('privacy_policy_url: an https:// link (Google Play requires it)');
    if (typeof d.contact_email !== 'string' || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.contact_email)) problems.push('contact_email: an email address');
    checkHsPair(d, dir, 'android.json', problems, notes);
    checkAds(d, 'android.json', side('.android-dashboard.json'), problems, notes);
  }

  // The icon: a real 512×512 PNG, no transparency.
  const iconFile = side('.icon-512.png');
  if (!existsSync(iconFile)) problems.push(`missing ${basename(iconFile)} next to the game folder (512×512 PNG)`);
  else {
    const png = readFileSync(iconFile);
    const isPng = png.length > 33 && png.readUInt32BE(0) === 0x89504e47 && png.toString('ascii', 12, 16) === 'IHDR';
    if (!isPng) problems.push(`${basename(iconFile)} is not a PNG`);
    else {
      const w = png.readUInt32BE(16), h = png.readUInt32BE(20), colorType = png[25];
      if (w !== 512 || h !== 512) problems.push(`${basename(iconFile)} is ${w}×${h} — it must be 512×512`);
      // 4 = grey + alpha, 6 = RGBA; a palette PNG can carry a tRNS chunk. Many
      // tools save a fully opaque icon as RGBA, so this is a reminder, not a stop.
      if (colorType === 4 || colorType === 6 || png.includes(Buffer.from('tRNS'))) {
        notes.push(`${basename(iconFile)} has an alpha channel — make sure no pixel is transparent (Google Play needs a solid background)`);
      }
    }
  }

  // The dashboard JSON the AI wrote.
  const dashFile = side('.hs-dashboard.json');
  if (!existsSync(dashFile)) problems.push(`missing ${basename(dashFile)} next to the game folder`);

  // Nothing secret in the game folder.
  const files = listFiles(dir);
  const secrets = files.filter((f) => f.split(sep).some((part) => SECRET.test(part)));
  if (secrets.length) problems.push('remove these from the game folder (never send keys, keystores or .env files): ' + secrets.join(', '));

  if (problems.length) {
    console.log(`Cannot pack ${name}:\n` + problems.map((p) => '  ❌ ' + p).join('\n'));
    process.exit(1);
  }

  // The game must pass hs-check — the Android lines included.
  const fails = checkFails(dir);
  if (fails.length) {
    console.log(`Cannot pack ${name}: hs-check has failures — fix them first:\n` + fails.map((l) => '  ❌ ' + l.msg).join('\n'));
    process.exit(1);
  }

  const entries = [];
  for (const f of files) entries.push({ name: `${name}/${f.split(sep).join('/')}`, data: readFileSync(join(dir, f)) });
  entries.push({ name: `${name}.hs-dashboard.json`, data: readFileSync(dashFile) });
  // The Android HS game's JSON, when the AI wrote it: HS pastes it from the package.
  const appDash = side('.android-dashboard.json');
  if (existsSync(appDash)) entries.push({ name: `${name}.android-dashboard.json`, data: readFileSync(appDash) });
  entries.push({ name: 'icon-512.png', data: readFileSync(iconFile) });
  entries.push({ name: 'android.json', data: Buffer.from(JSON.stringify(details, null, 2) + '\n') });
  const out = side('-android.zip');
  writeFileSync(out, zip(entries));
  console.log(`Android package: ${out}\n  ${files.length} game files + dashboard JSON + icon + android.json · hs-check passed`);
  for (const n of notes) console.log('  ⚠️ ' + n);
  console.log('Send this file to your HS contact.');
}

/**
 * hs-check's FAIL lines. The checker missing next to web/ (a kit copied
 * without it) checks nothing; it not answering is a failure.
 */
function checkFails(dir, extra = []) {
  const checker = join(HERE, '..', 'hs-check.mjs');
  if (!existsSync(checker)) return [];
  const r = spawnSync(process.execPath, [checker, dir, '--json', ...extra], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  let report = null;
  try { report = JSON.parse(r.stdout); } catch { /* reported below */ }
  if (!report) return [{ level: 'FAIL', msg: 'hs-check did not run' }];
  return report.lines.filter((l) => l.level === 'FAIL');
}

// ─── pack --tiktok: the zip partners upload to TikTok ────────────────────

// TikTok's limits for a native (non-Unity) mini game, before compression
// (developers.tiktok.com → Mini games technical overview). The upload fails above them.
const TT_TOTAL = 30 * 1024 * 1024;
const TT_PART = 4 * 1024 * 1024;

/** Never uploaded: tool folders, OS junk, the DevTool's private settings (may hold a login). */
const TT_SKIP = new Set(['node_modules', '.git', '.DS_Store', 'Thumbs.db', '__MACOSX', 'project.private.config.json']);

/** HS files that live NEXT TO the game folder (with or without the `<game>.` prefix), and packs. */
const TT_SIDE = /^(.+\.)?(hs-dashboard\.json|android\.json|android-dashboard\.json|icon-512\.png|ios\.json|ios-dashboard\.json|ios-products\.json|icon-1024\.png)$|-(android|ios|tiktok)\.zip$/;

/** Kit files that stay in the kit folder: only hs-game.js and hs-sdk.min.js go into the game. */
const TT_KIT_ONLY = new Set(['hs-check.mjs', 'hs-web.mjs', 'tt-web-shim.js', 'hs-loader.js', 'preview-runtime.js', 'preview-shell.js',
  'max.js', 'ads-networks.json', 'INTEGRATE-WITH-AI.md', 'DASHBOARD-CONFIG.md', 'SDK-REFERENCE.md', 'releases.json']);

const mb = (n) => (n / 1024 / 1024).toFixed(1) + ' MB';

/**
 * The game folder's files, relative, without TT_SKIP (dropped ones are not
 * walked). Symlinks are listed in `links`, never followed: one could pull a
 * file from outside the folder (a key, ~/.ssh) into a public upload.
 */
function tiktokFiles(dir, links, base = dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    if (TT_SKIP.has(name)) continue;
    const p = join(dir, name);
    const st = lstatSync(p);
    if (st.isSymbolicLink()) links.push(relative(base, p));
    else if (st.isDirectory()) out.push(...tiktokFiles(p, links, base));
    else if (st.isFile()) out.push(relative(base, p));
  }
  return out;
}

function packTiktok(opts) {
  const dir = gameFolder(opts._[1]);
  const name = basename(dir);
  const problems = [];
  const notes = [];
  const links = [];
  const files = tiktokFiles(dir, links);
  const posix = (f) => f.split(sep).join('/');
  const sizes = new Map(files.map((f) => [f, statSync(join(dir, f)).size]));
  if (links.length) problems.push('replace these links with the real files (a link can pull in files from outside the game folder): ' + links.join(', '));

  // TikTok matches the package to the app by project.config.json → appid.
  let conf = null;
  try { conf = JSON.parse(readFileSync(join(dir, 'project.config.json'), 'utf8')); } catch { /* reported below */ }
  const appid = conf && typeof conf.appid === 'string' ? conf.appid.trim() : '';
  if (!appid || /YOUR|xxx|TODO|PASTE|[<>]/i.test(appid)) {
    problems.push('project.config.json → "appid": put the TikTok App ID there — it must match the app in the TikTok developer portal (INTEGRATE-WITH-AI.md, step 0)');
  }

  // Files that must not go up: secrets, and the HS files that live NEXT TO the folder.
  const secrets = files.filter((f) => f.split(sep).some((part) => SECRET.test(part)));
  if (secrets.length) problems.push('remove these from the game folder (never upload keys, keystores or .env files): ' + secrets.join(', '));
  const sideFiles = files.filter((f) => TT_SIDE.test(basename(f)));
  if (sideFiles.length) problems.push('move these NEXT TO the game folder, not inside it (everything inside is uploaded to TikTok): ' + sideFiles.join(', '));
  const kitFiles = files.filter((f) => TT_KIT_ONLY.has(basename(f)));
  if (kitFiles.length) problems.push('remove these kit files from the game folder (only hs-game.js and hs-sdk.min.js go in; the kit folder stays outside): ' + kitFiles.join(', '));
  // The Client Secret belongs in the HS dashboard only; the whole folder is public.
  const leaks = files.filter((f) => /\.(js|json|txt|md)$/i.test(f) && sizes.get(f) < 4 * 1024 * 1024 && /client_?secret/i.test(readFileSync(join(dir, f), 'utf8')));
  if (leaks.length) problems.push('these files mention a client secret — remove it (it goes into the HS dashboard only, everything here is public): ' + leaks.join(', '));

  // TikTok refuses empty files.
  const empty = files.filter((f) => sizes.get(f) === 0);
  if (empty.length) problems.push('TikTok refuses empty (0-byte) files — remove or fill: ' + empty.join(', '));

  // Sizes: the total, the main package (everything outside the subpackage roots), each independent subpackage.
  let game = null;
  try { game = JSON.parse(readFileSync(join(dir, 'game.json'), 'utf8')); } catch { /* hs-check reports it */ }
  const subs = [];
  for (const s of (game && Array.isArray(game.subpackages) ? game.subpackages : [])) {
    const given = String((s && s.root) || '');
    // The same path the file walk gives: relative to the folder, '/'-separated, no './' or trailing '/'.
    const abs = resolve(dir, given.replace(/\\/g, '/'));
    const root = posix(relative(dir, abs));
    const isFolder = existsSync(abs) && lstatSync(abs).isDirectory();
    if (!given.trim() || !root || root.startsWith('..') || !isFolder) { problems.push(`game.json → subpackages: root "${given}" is not a folder in the game`); continue; }
    if (subs.some((o) => o.root === root)) { problems.push(`game.json → subpackages: root "${given}" is listed twice`); continue; }
    subs.push({ name: (s && s.name) || root, root, independent: !!(s && s.independent), bytes: 0 });
  }
  // A file belongs to the deepest root that holds it (a subpackage inside another one is its own).
  const byDepth = [...subs].sort((a, b) => b.root.length - a.root.length);
  let total = 0, main = 0;
  for (const f of files) {
    const n = sizes.get(f);
    total += n;
    const sub = byDepth.find((s) => posix(f).startsWith(s.root + '/'));
    if (sub) sub.bytes += n; else main += n;
  }
  if (total > TT_TOTAL) problems.push(`the game is ${mb(total)} — TikTok allows ${mb(TT_TOTAL)} in all (before compression)`);
  if (main > TT_PART) problems.push(`the main package is ${mb(main)} — TikTok allows ${mb(TT_PART)}; move assets into subpackages (game.json → "subpackages")`);
  for (const s of subs) if (s.independent && s.bytes > TT_PART) problems.push(`independent subpackage "${s.name}" is ${mb(s.bytes)} — TikTok allows ${mb(TT_PART)}`);

  if (problems.length) {
    console.log(`Cannot pack ${name} for TikTok:\n` + problems.map((p) => '  ❌ ' + p).join('\n'));
    process.exit(1);
  }

  // hs-check: the TikTok side must pass; the Android lines do not stop a TikTok upload.
  const allFails = checkFails(dir);
  const androidFails = allFails.filter((l) => /^Android:/.test(l.msg));
  const fails = allFails.filter((l) => !androidFails.includes(l));
  if (fails.length) {
    console.log(`Cannot pack ${name} for TikTok: hs-check has failures — fix them first:\n` + fails.map((l) => '  ❌ ' + l.msg).join('\n'));
    process.exit(1);
  }
  if (androidFails.length) notes.push(`hs-check has ${androidFails.length} Android failure(s) — fine for TikTok, but fix them before "prepare the Android build"`);

  // The folder's files at the zip root, as TikTok's CLI uploads the folder itself.
  const out = join(dirname(dir), name + '-tiktok.zip');
  writeFileSync(out, zip(files.map((f) => ({ name: posix(f), data: readFileSync(join(dir, f)) }))));
  console.log(`TikTok package: ${out}\n  ${files.length} files · ${mb(total)} (main package ${mb(main)}${subs.length ? `, ${subs.length} subpackage(s)` : ''}) · hs-check passed`);
  for (const n of notes) console.log('  ⚠️ ' + n);
  console.log('Upload it: TikTok developer portal → your app → Code version → Add code asset → this zip.\n' +
    'Or from the game folder with TikTok\'s CLI: npm i -g @ttmg/cli · ttmg login · ttmg upload');
}

// ─── pack --ios: the zip the HS portal builds the iOS app from ───────────

function packIos(opts) {
  const dir = gameFolder(opts._[1]);
  const name = basename(dir);
  const problems = [];
  // ios.json / icon-1024.png next to the folder — or with the <game>. prefix.
  const near = (plain) => [join(dirname(dir), name + '.' + plain), join(dirname(dir), plain)].find((f) => existsSync(f)) || '';

  const detailsFile = near('ios.json');
  if (!detailsFile) problems.push('missing ios.json next to the game folder: { "app_name", "bundle_id", "version_name" } (README, "When the user wants an iOS build")');
  const notes = [];
  if (detailsFile) {
    let d = null;
    try { d = JSON.parse(readFileSync(detailsFile, 'utf8')); } catch { /* hs-check reports it */ }
    if (d && typeof d === 'object') {
      checkHsPair(d, dir, 'ios.json', problems, notes);
      checkAds(d, 'ios.json', near('ios-dashboard.json'), problems, notes);
    }
  }
  const iconFile = near('icon-1024.png');
  if (!iconFile) problems.push('missing icon-1024.png next to the game folder (1024×1024 PNG, no transparency)');

  // Nothing secret, no link out of the folder (it could pull in a key).
  const links = [];
  const files = tiktokFiles(dir, links);
  if (links.length) problems.push('symbolic links in the game folder — replace them with the real files: ' + links.join(', '));
  const secrets = files.filter((f) => f.split(sep).some((part) => SECRET.test(part)));
  if (secrets.length) problems.push('remove these from the game folder (never send keys, certificates, keystores or .env files): ' + secrets.join(', '));
  const sideFiles = files.filter((f) => TT_SIDE.test(basename(f)));
  if (sideFiles.length) problems.push('move these NEXT TO the game folder, not inside it: ' + sideFiles.join(', '));

  if (problems.length) {
    console.log(`Cannot pack ${name} for iOS:\n` + problems.map((p) => '  ❌ ' + p).join('\n'));
    process.exit(1);
  }

  // hs-check with its iOS lines (ios.json, the icon, the products, Restore) — the app lines count too:
  // the iOS app runs the game as the Android one does.
  const fails = checkFails(dir, ['--ios']);
  if (fails.length) {
    console.log(`Cannot pack ${name} for iOS: hs-check has failures — fix them first:\n` + fails.map((l) => '  ❌ ' + l.msg).join('\n'));
    process.exit(1);
  }

  const entries = files.map((f) => ({ name: `${name}/${f.split(sep).join('/')}`, data: readFileSync(join(dir, f)) }));
  entries.push({ name: 'ios.json', data: readFileSync(detailsFile) });
  entries.push({ name: 'icon-1024.png', data: readFileSync(iconFile) });
  // The products too: the build worker's hs-check then also checks them and the Restore link.
  // Under its own name: the worker's hs-check reads the ad config only from .ios-dashboard.json.
  const productsFile = near('ios-dashboard.json') || near('ios-products.json');
  if (productsFile) entries.push({ name: `${name}.${/ios-dashboard\.json$/.test(productsFile) ? 'ios-dashboard' : 'ios-products'}.json`, data: readFileSync(productsFile) });
  const out = join(dirname(dir), name + '-ios.zip');
  writeFileSync(out, zip(entries));
  console.log(`iOS package: ${out}\n  ${files.length} game files + ios.json + icon-1024.png${productsFile ? ' + products' : ''} · hs-check passed`);
  for (const n of notes) console.log('  ⚠️ ' + n);
  console.log('Upload it in the HS portal → the game → a new version → iOS build (TestFlight).');
}

// ─── dashboard: the JSON to paste into the HS dashboard ─────────────────

const DASH_TARGETS = {
  tiktok: { file: 'hs-dashboard.json', game: 'the TikTok HS game', fails: /^(dashboard JSON|product )/ },
  android: { file: 'android-dashboard.json', game: 'the ANDROID HS game', fails: /^Android dashboard JSON/ },
  ios: { file: 'ios-dashboard.json', game: 'the iOS HS game', fails: /^iOS( dashboard JSON|: .*(dashboard|products)\.json)/ },
};

/**
 * Prints what to paste where, for one HS game: ① its ad config (Ads Config →
 * Edit raw JSON — saving it also creates the ad units) and ② its products
 * (Products → Import JSON). Refuses while hs-check fails that file, so a paste
 * the backend would refuse never leaves here.
 */
function dashboard(opts) {
  const dir = gameFolder(opts._[1]);
  const name = basename(dir);
  const target = typeof opts.for === 'string' ? opts.for : 'tiktok';
  const t = DASH_TARGETS[target];
  if (!t) fail(`--for ${target}: use tiktok, android or ios`);
  const near = (plain) => [join(dirname(dir), `${name}.${plain}`), join(dirname(dir), plain)].find((f) => existsSync(f)) || '';
  const file = near(t.file) || (target === 'ios' ? near('ios-products.json') : '');
  if (!file) fail(`no ${name}.${t.file} next to the game folder — README, "When the user wants to set up the HS dashboard"`);
  let j = null;
  try { j = JSON.parse(readFileSync(file, 'utf8')); } catch { fail(`${basename(file)} is not valid JSON`); }

  const lines = checkLines(dir, target === 'ios' ? ['--ios'] : []);
  const mine = lines.filter((l) => t.fails.test(l.msg));
  const fails = mine.filter((l) => l.level === 'FAIL');
  if (fails.length) {
    console.log(`Not ready to paste — hs-check:\n` + fails.map((l) => '  ❌ ' + l.msg).join('\n'));
    process.exit(1);
  }
  // "<…>" placeholders: the backend refuses them on save — fill them in first.
  const open = mine.filter((l) => /left for HS to fill/.test(l.msg));
  if (open.length) {
    console.log(`Not ready to paste — fill these "<…>" values in ${basename(file)} first:\n` +
      open.map((l) => '  ✍️  ' + l.msg.replace(/^.*left for HS to fill: /, '')).join('\n'));
    process.exit(1);
  }

  console.log(`HS dashboard → ${t.game} (${name}), from ${basename(file)}\n`);
  if (j.iaa_config) {
    console.log(`① Ads Config → Edit raw JSON → paste, then save${target === 'tiktok' ? '' : ' (saving creates the ad units)'}:\n`);
    console.log(JSON.stringify(j.iaa_config, null, 2) + '\n');
  }
  if (Array.isArray(j.products) && j.products.length) {
    console.log(`② Products → Import JSON → target game: ${t.game} → paste:\n`);
    console.log(JSON.stringify({ products: j.products }, null, 2) + '\n');
  }
  for (const l of mine.filter((x) => x.level === 'WARN')) console.log('⚠️  ' + l.msg + (l.fix ? '\n    → ' + l.fix : ''));
}

/** All of hs-check's lines (an empty list when the checker is not next to web/). */
function checkLines(dir, extra = []) {
  const checker = join(HERE, '..', 'hs-check.mjs');
  if (!existsSync(checker)) return [];
  const r = spawnSync(process.execPath, [checker, dir, '--json', ...extra], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  try { return JSON.parse(r.stdout).lines; } catch { return [{ level: 'FAIL', msg: 'dashboard JSON: hs-check did not run' }]; }
}

// A small zip writer (deflate), so packing needs nothing installed.
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function zip(entries) {
  const parts = [], central = [];
  let offset = 0;
  for (const e of entries) {
    const name = Buffer.from(e.name, 'utf8');
    const packed = deflateRawSync(e.data);
    const crc = crc32(e.data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6); local.writeUInt16LE(8, 8);
    local.writeUInt32LE(0, 10); local.writeUInt32LE(crc, 14); local.writeUInt32LE(packed.length, 18); local.writeUInt32LE(e.data.length, 22);
    local.writeUInt16LE(name.length, 26); local.writeUInt16LE(0, 28);
    parts.push(local, name, packed);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(0x0800, 8); c.writeUInt16LE(8, 10);
    c.writeUInt32LE(0, 12); c.writeUInt32LE(crc, 16); c.writeUInt32LE(packed.length, 20); c.writeUInt32LE(e.data.length, 24);
    c.writeUInt16LE(name.length, 28); c.writeUInt32LE(offset, 42);
    central.push(c, name);
    offset += 30 + name.length + packed.length;
  }
  const centralBuf = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralBuf.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, centralBuf, end]);
}

const opts = args(process.argv.slice(2));
if (opts._[0] === 'preview') preview(opts);
else if (opts._[0] === 'build') build(opts).catch((e) => fail(String(e && e.message || e)));
else if (opts._[0] === 'pack') (opts.tiktok ? packTiktok : opts.ios ? packIos : pack)(opts);
else if (opts._[0] === 'dashboard') dashboard(opts);
else {
  console.log('usage:\n  node hs-web.mjs preview <game folder> [--port 8090] [--dashboard file.json] [--platform tiktok|android|ios]\n  node hs-web.mjs pack <game folder> [--tiktok | --ios]\n  node hs-web.mjs dashboard <game folder> [--for tiktok|android|ios]\n  node hs-web.mjs build <game folder> --out <dir> [--native hs-native.js] [--ads max]');
  process.exit(opts._[0] ? 1 : 0);
}
