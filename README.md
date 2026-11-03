# Crane Rush

A voxel physics driving game: drive the crane monster truck across floating islands, rope bridges,
seesaws, drawbridges and energy pads, collect gems, race rival trucks in cups and unlock new trucks in the shop.

- **4 worlds × 10 levels**: Classic (islands), Construction, Medieval, Science (low gravity, boost pads)
- **Race mode**: 5-lane races on 12 wacky tracks (dominoes, swinging hammers, rolling boulders, crate walls, seesaws, bounce pads), 4 cups × 3 races vs 4 AI trucks, auto-respawn, points table, trophies
- **Shop**: 8 trucks with different speed / power / grip / air control, bought with gems
- **Stars**: finish, collect every gem, beat the par time
- Fail screen with a snapshot of the crash, level-complete and race-result animations, synthesized sound

## Controls

- ▶ / Right arrow / D: drive forward. In the air it tilts the truck back.
- ◀ / Left arrow / A: brake and reverse. In the air it tilts the truck forward.
- R: retry, Esc / P: pause.

## Download

Android release build: [`release/CraneRush-1.1.apk`](release/CraneRush-1.1.apk) (signed, minSdk 23, targetSdk 35).
A Play Store bundle is at [`release/CraneRush-1.1.aab`](release/CraneRush-1.1.aab).

## Project layout

| Path | What it is |
| --- | --- |
| `src/sim.js` | 2D physics (planck.js / Box2D): truck with wheel-joint suspension, bridges, seesaws, movers, pads, win/fail rules |
| `src/levels.js` | All 40 levels and world themes |
| `src/vehicles.js` | Truck stats and looks (shop catalogue) |
| `src/models.js`, `src/textures.js`, `src/render.js` | Three.js voxel models, pixel textures, scene, camera, particles |
| `src/main.js`, `src/index.html` | Game flow, UI screens, input, save data |
| `src/bot.js`, `src/racer.js` | AI driver for rival trucks; race respawn (crash / stuck) |
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
