# Crane Rush

A voxel physics driving game: drive the crane monster truck across floating islands, rope bridges,
seesaws, drawbridges and energy pads, collect gems, race rival trucks in cups and unlock new trucks in the shop.

- **20 worlds × 20 levels (400)**: Classic, Construction, Medieval, Science, Desert Dunes, Snow Peaks, Jungle Ruins, Lava Land, Candy Land, Sunny Beach, Night City, Pirate Docks, Moon Base, Red Planet, Coral Reef, Autumn Woods, Ice Cave, Toy Box, Neon Grid, Sky Islands. Worlds 1–4 have 10 hand-made levels each; everything else comes from a seeded generator and every shipped seed is verified by the bot. Worlds 11–20 are locked behind a star total (60 → 330).
- **Race mode**: 3–6 lane races (pick before each cup race) on 32 tracks (12 hand-made + 20 seeded random, themed across the new worlds), plus a Random track quick race (dominoes, swinging hammers, rolling boulders, crate walls, seesaws, bounce pads), 4 cups × 3 races vs 4 AI trucks, crash breakup (boom, hook, wheel and chunks fly off) and respawn at a checkpoint before the obstacle, never past it, points table, trophies
- **Trophies and leaderboard**: every 1st place in a race (cup or random track) is +1 trophy. The Top 100 board (tap the trophy counter, or Top on the Race tab) ranks you against 99 simulated players (`src/leaderboard.js`) whose totals grow over real time from a per-device seed (some play every day, some rarely), so the board moves while you are away and you climb it by winning. Results show your new rank. Clearing a level for the first time pays 20 + 5 × world gems; gems buy trucks
- **Shop** (tabs): **Trucks**: swipe left / right anywhere (or the arrows) to browse all 16 trucks with their price; 5 upgradeable stats per owned truck (speed, power, grip, air, **stability**: less wheelie kick, a self-righting push on two wheels, survives harder wall hits), 5 levels each. **Gems**: free videos (+gems, 2x booster) and the gem packs sold through the HS SDK (products in the HS dashboard)
- **Sea jumps**: from world 5 on, levels 10 and 20 end with a long run-up, a kicker and 14 m of open water that every truck clears on its own speed, with gems along the arc; every 4th seeded race track has one too
- **Every level can be finished by every truck**: all trucks share the hero's physics body (wheels, chassis, cab boxes, weight) and differ only by small stat tiers. `tools/passable.mjs` drives a level with several bot styles that back up and retry like a player; `tools/gensel.mjs` only ships generated levels that all 16 trucks plus 5 fully upgraded ones finish, and the 40 hand-made levels pass the same check (0 impassable for all 21 variants)
- **Stars**: finish, collect every gem, beat the par time
- **Crashes**: only obstacles you can knock over (crates, logs, barrels, dominoes, boulders) throw debris in their material, plus paint and frame chips off the truck when the hit is hard. Walls, steps and the road never throw debris: the road only gets tyre smoke (wheel spin, braking, landings). Hitting a wall at more than 12.5 m/s tumbles the truck over it ("Too fast!"). The finish banner sits above crane-boom height; a truck flying high enough to hit it clangs into it (debris, the gate sways)
- **Real physics, no assists**: one gravity (10 m/s²) everywhere, including Moon Base and Red Planet; no low-gravity levels, no self-righting push, no tumble block. In the air, throttle and brake only tip the truck a little (wheel inertia), like a real truck, not a jetpack. Stability upgrades add ballast low in the chassis (lower centre of mass). Bounce pads are the only things that throw a truck up, because they are springs
- **Nothing goes through anything**: the truck's physics body includes its whole voxel model (convex outlines of the cab, bodywork, crane boom and every accessory - ladders, cones, flags, tails - generated into `src/hulls.json`), so no part of the model can go into a wall, a beam or the road; they add no weight, and parts above the roof count as the roof for crash checks. The crane hook swings into walls, the road and crates like a real one
- **Real ground only**: no terrain hangs in the air. Earth slabs and ramps are filled down to the water, thin decks (girders, planks, plates) stand on piers, a beam over the road (the castle gate) stands on towers at both sides of the road, sliding decks ride on a hydraulic ram. Swinging hammers and spinning bars are gone (barrels, log piles and crate walls instead)
- **Finish area**: 30 m of road after the line ending in a barrel barrier, so a truck that crosses at full speed brakes to a stop instead of driving into the sea. Spectators on a stand at the line jump, throw their arms up and clap when you finish, with synthesized applause and cheering
- **Road and obstacle variety**: generated levels have 4-9 segments from a bigger pool: rolling hills, rocky road, valleys, long climbs, shipping containers to drive over, a car wreck with a kicker ramp, oil barrels, log piles, big round rocks, plus the hills, steps, gaps, bridges, seesaws and drawbridges from before
- **World 1, designed**: the first 20 levels of the game are laid out stretch by stretch (`PLANS` in `src/levels.js`): levels 1-3 are the hand-made warm-up, then each level brings one new thing or a harder mix - first obstacles (4), soft sand (5), a mud puddle (6), steep hills (8), a big jump (10)... up to an 8-stretch final exam (20); the seed only varies sizes and spacing
- **Difficulty**: levels 1-3 of a world are the warm-up. From level 4 it gets hard: soft sand (dunes that bog the truck down), mud puddles (a slippery dip full of muddy water that drags the wheels), steep hills, rocky road, barrels and log piles join the mix, and levels get more stretches. The hand-made levels 4-10 of worlds 2-4 carry on past their old finish with a generated hard stretch (2 to 5 extra stretches, seeds validated like the rest)
- **Stuck = over**: a truck lying on its side (propped on the boom or an accessory) or high-centred with no wheel on the ground, that has not got anywhere for 1.5 s, ends the run as a roll-over (it rocks on its spinning wheels, so this is judged by position, not speed). A truck standing straight up on one wheel (over ~70°) for 1.2 s also ends the run: a truck cannot drive like that. Wedged upright against something with the wheels spinning for 3 s: a tip to back up and an orange ↻ retry button appear
- **Champion**: winning a cup opens a celebration before the standings: the trophy drops in on turning golden rays, CHAMPION!, fireworks all over the sky, confetti, a fanfare and the crowd's applause
- **Autoplay drivers (dev)**: Settings → DEV TEST → Autoplay driver, and the TEST menu: **Noob** (holds the throttle down nearly all the time, no control in the air, lets go at random, never backs up), **Normal** (a 0.8-skill bot) or **Pro** (the best bot, and it backs up and retries when stuck). Test runs include "Hard levels of this world (4-20)" and "20 random hard levels"; failures are listed with the reason and where (e.g. `stuck @ 52 m`)
- **Fair races**: every race rolls each rival's form around the cup's level (a good day or a bad one) and shuffles who gets which; a rival's form sets how fast it dares to go, weaker rivals react late to GO and now and then lift off the throttle, and a rival far ahead of you eases off. In simulation a careful driver wins 8-33% of single races against 5 rivals and is usually top 3, so cups are winnable
- **Level script (worlds 1-7)**: `SCRIPT` in `src/levels.js` - levels 1-3 warm up, then a climb with a hard spike on every level divisible by 5 (5, 10, 15, 20 = boss) and an easier breather right after each spike; stretches per level 3 → 8, each world a notch harder. World 1 is laid out by hand (`CLASSIC_PLANS`), worlds 2-7 draw from world-fitting warm-up / normal / hard sets. Levels are short (crane bot: ~11 s normal, 13-22 s spikes) so a session runs at about 8 ad impressions per 5 minutes: interstitial `level_end` / `race_end` between levels at most every 30 s (only the very first level end is ad-free) plus the rewarded offers
- **Loading picture**: `assets/loading.jpg` (the crane flying over crates, rendered from the game) fills the loading screen under the title and progress bar; bundled in the web build, a file in the TikTok package
- **Countdown**: every level has a time limit (a stopwatch on the left under the pause button: green, yellow under 10 s, red and pulsing with a tick each second under 5 s). Out of time before the finish = lost ("TIME UP!"). The clock only runs while you drive (it stops during a crash, the fail screen, a continue and pause). The limit comes from the crane's own drive time: x3.2 + 10 s on warm-ups (levels 1-3), x2.8 + 10 s on normal levels, x2.5 + 10 s on the hard ones (5, 10, 15, 20). Every second left at the finish pays 2 gems (shown as "Time left" on the win screen)
- **Continues**: at most 2 video continues per level attempt (the button shows how many are left; the clock carries on from where it stopped plus 10 s, or 15 s after running out); after that the fail screen says GAME OVER and only Retry / Home / Levels remain
- **Open content**: for now only the first 7 worlds (140 levels) can be played; the other 13 are built but hidden ("more soon") until they are opened in an update (`OPEN_WORLDS` in `src/main.js`)
- **Throttle control**: holding ◀ while rolling forward brakes smoothly, then reverses; reversing from a standstill only dips the nose a little. Hit an obstacle with the gas held down and the nose comes up (crates, barrels, speed bumps hard enough to flip you): keep holding through it and nothing helps - the engine keeps lifting the nose and the truck can go over on its back. Let go when the nose comes up and it drops; press again and it is brought down onto its wheels (a truck is never driven along standing on end)
- **Races stay on the ground**: no bounce pads, no jumps over gaps, no sea jumps in race tracks (hand-made or generated) - racing is about pushing through obstacles: crate walls, dominoes, barrels, log piles, toppling plank walls, boulders
- **Finish line**: a level (or race) is finished only when the whole truck is past the line - the back of the chassis and both wheels. Touching the gate, or the crane boom poking over it, does not count (the banner is high enough for a crane boom to pass under it, even in a wheelie; only a truck flying high clangs into it)
- **Controls**: hold anywhere on the road in front of the truck to drive, behind it to brake / reverse; the side is re-read every frame, so sliding the finger past the truck switches direction. The ◀ ▶ arrows still work as buttons and light up with the direction you are going
- **Vibration**: every real hit is felt, graded by how hard it was (light / medium / heavy); hard landings, a wheel coming off, the boom hitting the banner, a roll-over (double bump), a crash (heavy) and the flip back (light)
- **Dents**: every hit (a wall, a crate, the road under a roll-over, the roof) dents the body where it landed: the truck's own model is pushed in along the hit direction with a little crumple, harder hits go deeper, each spot is capped so the truck never caves in, and the dents stay for the rest of the run while it keeps driving. The body also rocks on its mounts and settles. Walls, steps and the road kick up dust; metal, stone and concrete throw a few sparks. No cartoon squash/stretch, finish hop or camera FOV punch
- **Crash severity**: judged only by how hard the truck actually hit something (approach speed along the contact, last 0.6 s), never by how fast it was going or spinning. Tipping over or rolling onto the roof without a hard hit (under 8 m/s) is a roll-over: the truck just flips with a soft puff, nothing breaks; parts only fly off from a real smash (8-12 m/s: a wheel and small parts, over 12 m/s: both wheels and the big parts). A medium crash loses an axle (its two tyres bounce and roll away separately) and some small parts (lights, bumpers, bars, fins, exhausts). A big smash sends both axles' tyres everywhere and throws off the large parts too (crane boom, fire ladder, dozer blade, mixer drum, ice-cream cone, tractor roof...). No abstract debris cubes from the road; everything is bolted back on when the truck flips back. Smoke (exhaust, tyre spin, landings) is round puffs that curl and fade softly
- **No sinking into the road**: the voxel model is bigger than the physics shapes (roof lips, beacons, the crane boom), so whenever the truck tips, crashes or tumbles the renderer checks the model's outline (2D convex hull per piece, broken-off parts excluded) against a 10 cm ground profile and lifts it so it rests on the road (an upside-down crane props itself on its boom). The flip-back animation lifts the truck just clear of the road, rolls it upright and sets it down on its wheels, wheels included in the check; loose parts and tyres rest on their real lowest point
- Fail screen with a close-up crash photo (roof / nose-dive / belly flop stickers and captions), level-complete and race-result animations, synthesized sound

- **No lives**: there is no heart / lives system - a crash just means trying again (or continuing from the checkpoint with a video)
- **No hints**: every level has to be driven by the player (no rewarded "let the bot drive" option)
- **Try a truck**: trucks you do not own have a Try button in the shop (rewarded video) for one free level
- **Tutorial**: the first level points a hand at ▶ ("Hold to drive!"), then tips for braking and for tilting in the air
- **Developer tools**: Settings has a DEV TEST section with **Autoplay (bot drives)** and **All resources (dev)** (infinite gems, every truck owned, every world, level and cup open). The AUTO chip and TEST button (tour of all 20 worlds, 20 random levels, every level of a world, 10 random races with 3–6 lanes, with a pass/fail report) are on the home screen. Shown while `DEV_TOOLS` is `true` in `src/platform/config.js`; set it to `false` for the store build (tapping the version line in Settings 5 times still unlocks them). Any cup already won (or all of them with All resources) can be picked on the Race tab

## Economy

Gems are the only currency. Measured on the shipped levels: a first clear of all 400 levels with every gem and 3 stars pays ~52,700 gems (realistically ~41,000 in 4–5 hours), i.e. ~100–150 gems a minute on new levels and ~50 a minute replaying; a race win pays 100–300.

| Sink | Gems |
|---|---|
| Trucks (16) | 1,500 … 28,000 (150,500 in all) |
| Upgrades | level 1 = 3% of the truck price (min 150), +75% per level; maxing a truck ≈ 1.9× its price |

Gem packs (`GEM_PACKS`, `STARTER_PACK` in `src/platform/config.js`): 1,200 / $0.99 · 2,600 / $1.99 · 7,000 / $4.99 · 15,000 / $9.99 · 32,000 / $19.99 (each lines up with a truck: Scoop, Rubble, Mixer, Knight, Rocket Racer), plus a one-time starter pack of 3,000 gems for $0.99. They are HS dashboard products (`PRODUCTS` in `src/economy.js`); the game shows the store's own price.

Rewarded videos that pay gems: level complete x3 · race result x2 · cup win bonus x2 · daily gift x2 (7-day streak 100 → 600) · **2x Gems** booster (every level and race reward doubled for 10 minutes; button next to Play and in the shop) · free +150 gems (5 a day) · plus continue and try a truck.

## Controls

- ▶ / Right arrow / D: drive forward. In the air it tilts the truck back.
- ◀ / Left arrow / A: brake and reverse. In the air it tilts the truck forward.
- R: retry, Esc / P: pause.

## Download

Android release build: [`release/CraneRush-3.2.apk`](release/CraneRush-3.2.apk) (signed, minSdk 23, targetSdk 36).
A Play Store bundle is at [`release/CraneRush-3.2.aab`](release/CraneRush-3.2.aab).

TikTok Mini Games package: [`release/CraneRush-tiktok-3.2.zip`](release/CraneRush-tiktok-3.2.zip) (native runtime: `game.js`, `game.json`, `project.config.json`, `fredoka.ttf`; about 1 MB, limit 4 MB for the main package).

## TikTok Mini Games

TikTok stopped accepting HTML (H5) mini games on 28 Aug 2026, so the game runs on the **native runtime**: one WebGL canvas, no DOM. The whole UI is drawn on a 2D canvas (`src/ui/`) and composited over the 3D scene, and `src/platform/` maps the few runtime APIs the game uses itself (canvas, touch, storage, font, audio, show / hide, vibrate: the ones the HS Android app also has).

**HS SDK** (the kit in `hs-kit/`, version 3.3.4 / SDK 1.1.3). `dist-tiktok/` holds `game.js` plus the two kit files `hs-game.js` and `hs-sdk.min.js` (copied by `build.mjs`, never edited). All ads, rewards, TikTok missions, share, login, cloud save and purchases go through `HSGame`; the game never calls TikTok's ad / mission / share APIs itself. The web / artifact build uses a small local stand-in with the same API (`src/platform/hs-local.js`: test ads, rewards from the defaults).

- **Progress**: one `HSGame.profile` (save: cloud): `gems`, `trophies` (max), `stars` (max, the summary shown if a guest's progress meets an account's), `starter`, and `game` (everything else). The old local save is moved in once.
- **Rewards**: the game reports moments by key, HSGame pays them. Defaults in `src/economy.js` (`DEFAULTS`), the live values in the HS dashboard. Gem multipliers (x3 / x2), the 2x booster and lives are items the game applies in `onGive`.
- **Before uploading**: put the HS **Game ID** and **SDK key** in `src/platform/config.js` (`HS_GAME_ID`, `HS_SDK_KEY`; empty = runs offline), the TikTok **App ID** in `dist-tiktok/project.config.json` → `appid`, and the TikTok ad unit ids into `dist-tiktok.hs-dashboard.json` (written next to the game folder by `build.mjs`; ids filled in by hand are kept on rebuild). Then paste it into the HS dashboard (`node hs-kit/web/hs-web.mjs dashboard dist-tiktok`). Never put the TikTok Client Secret anywhere in the game.
- **Check**: `node hs-kit/hs-check.mjs dist-tiktok` → 0 fail (the 2 warnings are the App ID and the ad unit ids).

**TikTok review buttons** (home screen, top-left): **Launch** (add to home screen, `HSGame.tiktokMission.start('shortcut')`, 300 gems once) and **Entry** (open from the profile, `start('profile')`, 300 gems once), shown while `HSGame.has('tiktok_missions')` and hidden once done, and **Share** (`HSGame.share`, 50 gems once a day). Each opens a popup with numbered steps and the reward.

**Ad places** (every `HSGame.showAd('<label>')`; each is a place in the HS dashboard with its own ad unit and cooldown, shown only while `HSGame.canShowAd`):

| Label | Type | Where |
| --- | --- | --- |
| `level_x3` | rewarded | Level complete: "x3 gems" (pays 2x the level's gems on top) |
| `race_x2` | rewarded | Race results: "x2 gems" |
| `cup_x2` | rewarded | Cup won: "x2 bonus" (the cup bonus again) |
| `daily_x2` | rewarded | Daily gift popup: "Claim x2" |
| `gem_boost` | rewarded | Home (next to Play) and Shop › Gems: "2x", doubles level and race gems for 10 minutes |
| `free_gems` | rewarded | Shop (top-left) and Shop › Gems: "+150 gems", 5 a day |
| `revive` | rewarded | Fail screen: "Continue" (back on the wheels at the last checkpoint) |
| `try_truck` | rewarded | Shop › Trucks, a truck not owned: "Try" (free for the next level) |
| `level_end` | interstitial | Tapping Next / Retry / Home / Levels after a level (none in the first 3 level ends of a session) |
| `race_end` | interstitial | Tapping Next race / Another one / Home after a race (none in the first 3 ends) |

Cooldowns: 30 s per rewarded place, 45 s for interstitials (levels last 10–20 s). Ads only start on the player's tap; an ad pauses the game and its sound (`HSGame.on('pause' / 'resume')`).

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
| `src/platform/` | Platform layer (web / Android WebView / TikTok runtime), DOM adapter for the runtime, config (HS ids, gem packs), local HSGame stand-in for the web build |
| `src/economy.js` | Ad places, reward defaults, items and products for HSGame and the HS dashboard |
| `hs-kit/` | The HS SDK kit (hs-game.js, hs-sdk.min.js, hs-check, preview / pack tools, guides) |
| `tools/passable.mjs` | "Can a player finish this level with this truck": adaptive bot styles, used by gensel and the checks |
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
