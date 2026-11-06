# Crane Rush

A voxel physics driving game: drive the crane monster truck across floating islands, rope bridges,
seesaws, drawbridges and energy pads, collect gems, race rival trucks in cups and unlock new trucks in the shop.

- **20 worlds × 20 levels (400)**: Classic, Construction, Medieval, Science, Desert Dunes, Snow Peaks, Jungle Ruins, Lava Land, Candy Land, Sunny Beach, Night City, Pirate Docks, Moon Base (low gravity), Red Planet, Coral Reef, Autumn Woods, Ice Cave, Toy Box, Neon Grid, Sky Islands. Worlds 1–4 have 10 hand-made levels each; everything else comes from a seeded generator and every shipped seed is verified by the bot. Worlds 11–20 are locked behind a star total (60 → 330).
- **Race mode**: 3–6 lane races (pick before each cup race) on 32 tracks (12 hand-made + 20 seeded random, themed across the new worlds), plus a Random track quick race (dominoes, swinging hammers, rolling boulders, crate walls, seesaws, bounce pads), 4 cups × 3 races vs 4 AI trucks, crash breakup (boom, hook, wheel and chunks fly off) and respawn at a checkpoint before the obstacle, never past it, points table, trophies
- **Trophies and leaderboard**: every 1st place in a race (cup or random track) is +1 trophy. The Top 100 board (tap the trophy counter, or Top on the Race tab) ranks you against 99 simulated players (`src/leaderboard.js`) whose totals grow over real time from a per-device seed (some play every day, some rarely), so the board moves while you are away and you climb it by winning. Results show your new rank. Clearing a level for the first time pays 20 + 5 × world gems; gems buy trucks
- **Shop** (tabs): **Trucks**: swipe left / right anywhere (or the arrows) to browse all 16 trucks with their price; 5 upgradeable stats per owned truck (speed, power, grip, air, **stability**: less wheelie kick, a self-righting push on two wheels, survives harder wall hits), 5 levels each. **Items**: special items for gems, x1 or x5 for the price of 4. **Gems**: a free video, and gem packs for real money (`GEM_PACKS` in `src/platform/config.js`; buttons say coming soon until `IAP_ENABLED`)
- **Special items** (`src/items.js`, effects in `src/sim.js`): Rocket Boost, Super Jump (works mid-air), Glider Wings, Bubble Shield (a crash or splash pops it instead and the truck is put back on its wheels, never past the obstacle), Gem Magnet. Round buttons above the drive controls (keys 1–5); they glow when a sea crossing is near. New players start with a small pack
- **Sea crossings**: from world 5 on, levels 10 and 20 end with a 46 m (longer in low gravity) open-water crossing that no truck can jump, even fully upgraded; any one of Rocket, Super Jump or Glider gets across (all 32 checked with each item, and with none). Falling in without one offers a free Rocket for a video. Every 4th seeded race track has one too, with a "?" item box (a Rocket) on the run-up that re-arms after a respawn; rival trucks carry Rockets
- **Stars**: finish, collect every gem, beat the par time
- **Crashes**: only obstacles you can knock over (crates, logs, barrels, dominoes, boulders) throw debris in their material, plus paint and frame chips off the truck when the hit is hard. Walls, steps and the road never throw debris: the road only gets tyre smoke (wheel spin, braking, landings). Hitting a wall at more than 12.5 m/s tumbles the truck over it ("Too fast!"). The crane boom is taller than the finish gate: it clangs into the banner (debris, the gate sways, a fast truck pops a wheelie) and the boom over the line counts as the finish
- **Crash severity**: a gentle roll-over just flips the truck with a soft puff, nothing breaks. A medium crash loses an axle (its two tyres bounce and roll away separately) and some small parts (lights, bumpers, bars, fins, exhausts). A big smash sends both axles' tyres everywhere and throws off the large parts too (crane boom, fire ladder, dozer blade, mixer drum, ice-cream cone, tractor roof...). No abstract debris cubes from the road; everything is bolted back on when the truck flips back. Smoke (exhaust, tyre spin, landings) is round puffs that curl and fade softly
- **No sinking into the road**: the voxel model is bigger than the physics shapes (roof lips, beacons, the crane boom), so whenever the truck tips, crashes or tumbles the renderer checks the model's outline (2D convex hull per piece, broken-off parts excluded) against a 10 cm ground profile and lifts it so it rests on the road (an upside-down crane props itself on its boom). The flip-back animation lifts off, rolls upright and drops onto the wheels with a small bounce, wheels included in the check; loose parts and tyres rest on their real lowest point
- Fail screen with a close-up crash photo (roof / nose-dive / belly flop stickers and captions), level-complete and race-result animations, synthesized sound

- **Lives**: 5 hearts. A crash in a level costs one (given back if you continue from the checkpoint), one comes back every 8 minutes, a rewarded video refills all 5. Races never cost lives, so the out-of-lives panel offers a race meanwhile
- **Hint**: after 2 crashes on the same level the fail screen offers a Hint video: the bot drives the level for you and it counts as cleared with 1 star (drive it yourself for 3)
- **Try a truck**: trucks you do not own have a Try button in the shop (rewarded video) for one free level
- **Tutorial**: the first level points a hand at ▶ ("Hold to drive!"), then tips for braking and for tilting in the air
- **Developer tools**: Settings has a DEV TEST section with **Autoplay (bot drives)** and **All resources (dev)** (infinite gems and lives, every truck owned, every world, level and cup open). The AUTO chip and TEST button (tour of all 20 worlds, 20 random levels, every level of a world, 10 random races with 3–6 lanes, with a pass/fail report) are on the home screen. Shown while `DEV_TOOLS` is `true` in `src/platform/config.js`; set it to `false` for the store build (tapping the version line in Settings 5 times still unlocks them). Any cup already won (or all of them with All resources) can be picked on the Race tab

## Economy

Gems are the only currency. Measured on the shipped levels: a first clear of all 400 levels with every gem and 3 stars pays ~52,700 gems (realistically ~41,000 in 4–5 hours), i.e. ~100–150 gems a minute on new levels and ~50 a minute replaying; a race win pays 100–300.

| Sink | Gems |
|---|---|
| Trucks (16) | 1,500 … 28,000 (150,500 in all) |
| Upgrades | level 1 = 3% of the truck price (min 150), +75% per level; maxing a truck ≈ 1.9× its price |
| Items | Magnet 60 · Jump 90 · Glider 100 · Rocket 120 · Shield 150 (x5 for the price of 4) |

Gem packs (`GEM_PACKS`, `STARTER_PACK` in `src/platform/config.js`): 1,200 / $0.99 · 2,600 / $1.99 · 7,000 / $4.99 · 15,000 / $9.99 · 32,000 / $19.99 (each lines up with a truck: Scoop, Rubble, Mixer, Knight, Rocket Racer), plus a one-time starter pack 3,000 gems + 3 Rockets + 2 Shields for $0.99.

Rewarded videos that pay gems: level complete x3 · race result x2 · cup win bonus x2 · daily gift x2 (7-day streak 100 → 600) · **2x Gems** booster (every level and race reward doubled for 10 minutes; button next to Play and in the shop) · free +150 gems (5 a day) · plus continue, hint, free Rocket on a sea crossing, refill lives and try a truck.

## Controls

- ▶ / Right arrow / D: drive forward. In the air it tilts the truck back.
- ◀ / Left arrow / A: brake and reverse. In the air it tilts the truck forward.
- R: retry, Esc / P: pause.

## Download

Android release build: [`release/CraneRush-3.2.apk`](release/CraneRush-3.2.apk) (signed, minSdk 23, targetSdk 36).
A Play Store bundle is at [`release/CraneRush-3.2.aab`](release/CraneRush-3.2.aab).

TikTok Mini Games package: [`release/CraneRush-tiktok-3.2.zip`](release/CraneRush-tiktok-3.2.zip) (native runtime: `game.js`, `game.json`, `project.config.json`, `fredoka.ttf`; about 1 MB, limit 4 MB for the main package).

## TikTok Mini Games

TikTok stopped accepting HTML (H5) mini games on 28 Aug 2026, so the game runs on the **native runtime**: one WebGL canvas, no DOM. The whole UI is drawn on a 2D canvas (`src/ui/`) and composited over the 3D scene, and `src/platform/` maps the runtime APIs (namespace `TTMinis.game`, also `tt` / `wx`).

**Before uploading**, fill in `src/platform/config.js` and rebuild:

| Field | Where to find it |
| --- | --- |
| `clientKey` | Developer Portal → your app → Credentials |
| `rewardedAdUnitId` | Developer Portal → Monetization → Ad units (rewarded video) |
| `interstitialAdUnitId` | Developer Portal → Monetization → Ad units (interstitial) |

While an ad unit ID is a placeholder the game shows a local "TEST AD" panel instead, so every ad flow can be tried before the IDs exist.

**Required capabilities (checked in review)**, all on the first screen (top-left):

| Button | API | Reward |
| --- | --- | --- |
| Add (to Home Screen) | `addShortcut`, `getShortcutMissionReward` | 300 gems first time, 100 gems per day when launched from the shortcut |
| Profile (sidebar revisit) | `startEntranceMission`, `getEntranceMissionReward` | 300 gems first time, 100 gems per day when launched from the profile sidebar |
| Share | `shareAppMessage` | none |

Rewards are checked at start-up and every time the game comes back to the foreground, and are granted at most once per day.

**Ads**

| Type | Where | Rule |
| --- | --- | --- |
| Rewarded | Win screen: x3 gems · Race results: x2 gems · Cup win: x2 bonus · Daily gift: x2 · Home / shop: 2x Gems for 10 min · Shop: +150 gems (5 a day), Try a truck · Fail screen: continue, Hint (after 2 crashes), free Rocket (sea crossing) · Out of lives: refill 5 hearts | Reward only when the video was watched to the end (`isEnded`) |
| Interstitial | When leaving a win / fail / race result screen | Not in the first 45 s, at least 45 s apart (levels last 10–15 s, so about one every 3–4 levels), never during play, AUTO or TEST |

Pacing and reward amounts live in `src/platform/config.js` (`AD_RULES`, `REWARDS`).

**SDK conformance** (checked against the Mini Games SDK reference): `createCanvas` (first call = screen canvas), `onTouchStart/Move/End/Cancel` (`changedTouches`), `onShow` / `onHide`, `getLaunchOptionsSync`, `getSystemInfoSync` + `getWindowInfo` (pixelRatio, optional safeArea), `getStorageSync` / `setStorageSync`, `loadFont(path)` (null on failure), `createWebAudioContext`, `vibrateShort({ type })`, `createRewardedVideoAd` / `createInterstitialAd` (`onClose` → `isEnded`), `addShortcut` / `getShortcutMissionReward`, `startEntranceMission` / `getEntranceMissionReward`, `shareAppMessage` (`query`, `subTitle`; title and image come from the portal's share settings), `canIUse`. Two things the docs leave open are handled defensively: Touch coordinate field names (`clientX`/`pageX`/`x`) and WebAudio `currentTime` (falls back to wall-clock; any audio error is swallowed). `setLoadingProgress` is only documented for the legacy HTML SDK and is called only when `canIUse` reports it.

**Upload**: `npm i -g @ttmg/cli`, `ttmg login`, then `ttmg dev` in `dist-tiktok/` to test on a phone and upload from the DevTool page (or upload the zip under Developer Portal → Code version). Icons for the portal are in `store/icons/` (1024, 512, 144).

**Performance**: static scenery and trucks are merged into a few meshes, effects (dust, smoke, tyre marks) are instanced (one draw call each), GPU memory of the previous level (geometry, textures, shadow map) is released on every level change, and the renderer steps down a quality tier (pixel ratio, shadow map size, shadows) when a level runs under 45 fps. A 6-lane race went from 445 to about 160 draw calls; a normal level is about 40.

## Google Play checklist

- Upload `release/CraneRush-3.2.aab` (Play requires an App Bundle, not the APK). Target SDK 36, no native libraries (16 KB page-size safe), not debuggable.
- Enrol in Play App Signing; the local keystore then acts as the upload key. Keep `android/cranerush-release.keystore` + `keystore.properties` private.
- Store assets in `store/`: 512×512 icon, 1024×500 feature graphic. Add at least 2 phone screenshots (1080×1920+).
- Fill in the Data safety form (the app collects nothing; progress is stored on device), content rating questionnaire (IARC), and a privacy policy URL.
- Change `appId` in `capacitor.config.json` / `android/app/build.gradle` if `com.greentee.cranerush` is not the package you want; it cannot be changed after the first upload.

## Project layout

| Path | What it is |
| --- | --- |
| `src/sim.js` | 2D physics (planck.js / Box2D): truck with wheel-joint suspension, bridges, seesaws, movers, pads, win/fail rules |
| `src/worlds.js` | The 20 world definitions: theme, ground styles, generator settings, star locks |
| `src/levels.js`, `src/builder.js` | Hand-made levels, race tracks, world themes, and the level-building DSL |
| `src/vehicles.js` | Truck stats and looks (shop catalogue) |
| `src/models.js`, `src/textures.js`, `src/render.js` | Three.js voxel models, pixel textures, scene, camera, particles |
| `src/main.js` | Game flow, all screens, ads and TikTok capability buttons, input, save data, loading screen |
| `src/ui/kit.js`, `src/ui/icons.js` | Canvas UI kit (buttons, panels, outlined text, scroll lists, touch / hold / swipe, effects) and SVG-path icons |
| `src/platform/` | Platform layer (web / Android WebView / TikTok runtime), DOM adapter for the runtime, ad and reward config |
| `src/bake.js` | Merges static meshes to cut draw calls |
| `src/tt-entry.js` | TikTok package entry (adapter first, then the game) |
| `src/index.html` | Web / Android page: two canvases and the font |
| `src/leaderboard.js` | Trophy leaderboard: 99 simulated players, deterministic per device and time |
| `src/bot.js`, `src/racer.js` | AI driver for rival trucks; race respawn (crash / stuck) |
| `src/gen.js`, `src/genseeds.json`, `tools/gensel.mjs` | Segment-based level / race generator, the validated seeds, and the seed picker that runs the bot |
| `tools/raceharness.mjs` | Headless test: every race track with the bot at three skill levels |
| `tools/harness.mjs` | Headless test: drives every level with the bot and writes par times to `src/pars.json` |
| `android/` | Capacitor Android project (immersive full screen, portrait) |

## Build

```bash
npm install
node build.mjs                 # -> dist/index.html (web / Android) and dist-tiktok/ (TikTok package)

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
