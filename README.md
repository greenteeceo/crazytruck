# Crane Rush

A voxel physics driving game: drive the crane monster truck across floating islands, rope bridges,
seesaws, drawbridges and energy pads, collect gems, race rival trucks in cups and unlock new trucks in the shop.

- **4 worlds × 20 levels (80)**: Classic (islands), Construction, Medieval, Science (low gravity, boost pads). Levels 11–20 of each world come from a seeded generator; every shipped seed is verified by the bot.
- **Race mode**: 3–6 lane races (pick before each cup race) on 32 tracks (12 hand-made + 20 seeded random), plus a Random track quick race (dominoes, swinging hammers, rolling boulders, crate walls, seesaws, bounce pads), 4 cups × 3 races vs 4 AI trucks, in-place flip-back recovery, points table, trophies
- **Shop**: 8 trucks with different speed / power / grip / air control, bought with gems
- **Stars**: finish, collect every gem, beat the par time
- Fail screen with a close-up crash photo (roof / nose-dive / belly flop stickers and captions), level-complete and race-result animations, synthesized sound

- **Test tools** (Settings): Autoplay lets the bot drive (auto-advances to the next level on a win), Unlock all levels

## Controls

- ▶ / Right arrow / D: drive forward. In the air it tilts the truck back.
- ◀ / Left arrow / A: brake and reverse. In the air it tilts the truck forward.
- R: retry, Esc / P: pause.

## Download

Android release build: [`release/CraneRush-1.3.apk`](release/CraneRush-1.3.apk) (signed, minSdk 23, targetSdk 36).
A Play Store bundle is at [`release/CraneRush-1.3.aab`](release/CraneRush-1.3.aab).

## Google Play checklist

- Upload `release/CraneRush-1.3.aab` (Play requires an App Bundle, not the APK). Target SDK 36, no native libraries (16 KB page-size safe), not debuggable.
- Enrol in Play App Signing; the local keystore then acts as the upload key. Keep `android/cranerush-release.keystore` + `keystore.properties` private.
- Store assets in `store/`: 512×512 icon, 1024×500 feature graphic. Add at least 2 phone screenshots (1080×1920+).
- Fill in the Data safety form (the app collects nothing; progress is stored on device), content rating questionnaire (IARC), and a privacy policy URL.
- Change `appId` in `capacitor.config.json` / `android/app/build.gradle` if `com.greentee.cranerush` is not the package you want; it cannot be changed after the first upload.

## Project layout

| Path | What it is |
| --- | --- |
| `src/sim.js` | 2D physics (planck.js / Box2D): truck with wheel-joint suspension, bridges, seesaws, movers, pads, win/fail rules |
| `src/levels.js`, `src/builder.js` | Hand-made levels, race tracks, world themes, and the level-building DSL |
| `src/vehicles.js` | Truck stats and looks (shop catalogue) |
| `src/models.js`, `src/textures.js`, `src/render.js` | Three.js voxel models, pixel textures, scene, camera, particles |
| `src/main.js`, `src/index.html` | Game flow, UI screens, input, save data |
| `src/bot.js`, `src/racer.js` | AI driver for rival trucks; race respawn (crash / stuck) |
| `src/gen.js`, `src/genseeds.json`, `tools/gensel.mjs` | Segment-based level / race generator, the validated seeds, and the seed picker that runs the bot |
| `tools/raceharness.mjs` | Headless test: every race track with the bot at three skill levels |
| `tools/harness.mjs` | Headless test: drives every level with the bot and writes par times to `src/pars.json` |
| `android/` | Capacitor Android project (immersive full screen, portrait) |

## Build

```bash
npm install
node build.mjs                 # -> dist/index.html (single self-contained file)

# level check + par times
npx esbuild tools/harness.mjs --bundle --platform=node --format=esm --outfile=/tmp/h.mjs && node /tmp/h.mjs crane src/pars.json

# Android
npx cap sync android
cd android && ./gradlew assembleRelease   # or bundleRelease
```

Release signing reads `android/keystore.properties` (not committed):

```
storeFile=../cranerush-release.keystore
storePassword=...
keyAlias=cranerush
keyPassword=...
```

iOS: `npm i @capacitor/ios@7 && npx cap add ios`, then build in Xcode on a Mac.
