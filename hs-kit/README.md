# HS SDK kit 3.3.4 (SDK 1.1.3) — START HERE

This folder adds the HS SDK (rewards, ads, cloud save, shop, TikTok missions)
to a **native TikTok mini game** (`game.js` + `game.json`), and lets HS turn the
same game into an Android app later.

## You (the developer): 3 steps

1. Open your game project in your AI tool (Claude Code, Codex, Gemini, Cursor…)
   with this folder available to it.
2. Tell it: **"Read README.md in the hs-kit folder and integrate the kit into
   my game."** It will ask you a few questions first.
3. When it is done, run the check it tells you about and fix every ❌.

No registration is needed while you are drafting — see
[INTEGRATE-WITH-AI.md](INTEGRATE-WITH-AI.md) "When do I register?".

---

## You (the AI assistant): your instructions

You are integrating this kit into the user's native TikTok mini game. Do this,
in order:

1. **Read [INTEGRATE-WITH-AI.md](INTEGRATE-WITH-AI.md) completely.** The fenced
   prompt in its "Step 1" is your task specification — follow it exactly
   (THE MODEL, API, TIKTOK REVIEW, RULES, WHEN DONE).
2. **Ask the user before writing any code — in ONE message, each question
   with your recommended answer** — and wait for the answers:
   - SAVE: `cloud` (recommended) or `local`
   - their HS Game ID and SDK key — or "none yet" (then leave them empty; the
     game runs offline until they register)
   - the questions under "BEFORE YOU WRITE CODE" in that prompt (Q1 save
     conflict screen + summary field, Q2 shop + ad moments, Q3 a sign-in button,
     Q4 ad and reward pacing — the developer decides the numbers)
   Ask nothing else about platforms: the same code runs on TikTok and in the
   Android app, and `HSGame.has()` decides which buttons show where. Never ask
   which UI is "for TikTok" or "for Google Play", nor about ad providers,
   prices, login methods or Google Play setup — HS handles those.
   Never ask for, accept or write the TikTok **Client Secret** anywhere.
3. **Copy exactly two files next to the game's `game.js`:** `hs-game.js` and
   `hs-sdk.min.js` (from this folder). Never edit them. Copy nothing else into
   the game folder — this kit folder must stay OUTSIDE it, because everything
   in the game folder is uploaded to TikTok.
4. Integrate as the prompt says, then write `<game folder>.hs-dashboard.json`
   NEXT TO the game folder.
5. Run `node <this folder>/hs-check.mjs <game folder>` and fix every ❌ FAIL.
   Report the ⚠️ WARN lines to the user.
6. Self-check by hand: run `node <this folder>/web/hs-web.mjs preview <game folder>`,
   open the link it prints and click through ads, the shop and "Fresh install"
   (TikTok and Android, switch at the top) — or tell the user to. Everything
   in it is fake and offline.
7. Give the user the summary the prompt asks for ("WHEN DONE" → B).

**When the game already uses the kit** (a `hs-game.js` is next to its
`game.js`) and the user brings a NEW kit ("update the HS kit", "use the new
zip"…) — this is an UPGRADE, not a new integration:

1. Compare versions: the first line of each `hs-game.js` (`hs-game.js 3.x.y`),
   and `INTEGRATE-WITH-AI.md` → "What changed" for every version in between.
2. Replace `hs-game.js` and `hs-sdk.min.js` in the game folder with the ones
   from this folder. Do NOT re-integrate, restyle or rewrite working code.
3. Change game code only where "What changed" says a game must (an "Action"
   line), and update `<game folder>.hs-dashboard.json` the same way.
4. Run `hs-check` (0 ❌), tell the user what changed, and — if they send an
   Android build package — run `web/hs-web.mjs pack` again.

An upgrade asks none of the integration questions (SAVE, Q1–Q3): those were
answered the first time. Q4 (ad and reward pacing) is new in 3.2.4: a game
upgrading from before 3.2.4 asks Q4 once, in one message. The app's details and icon are already next to the
game folder (`<game>.android.json` or `android.json`, `<game>.icon-512.png`
or `icon-512.png`) — reuse them; ask only whether `version_name` goes up for
this release (e.g. 1.0.0 → 1.0.1). A game written in the older style
(`HSGame.save()` / `onLoad`) keeps working: an upgrade never moves it to
`HSGame.profile()` — that is a separate change, only when the user asks.

**When the user wants to upload to TikTok** ("build tiktok", "prepare the
TikTok upload", "pack for TikTok"…):

1. Check `project.config.json` in the game folder has `"appid"`: the TikTok
   **App ID** from the TikTok developer portal. If it is missing, ask the user
   for it (INTEGRATE-WITH-AI.md, step 0). Never ask for the Client Secret.
2. Run `node <this folder>/web/hs-web.mjs pack <game folder> --tiktok` and fix
   every ❌ it reports, then run it again. It writes `<game folder>-tiktok.zip`
   NEXT TO the game folder.
3. Tell the user how to upload that zip (the tool prints it): TikTok developer
   portal → the app → **Code version** → **Add code asset**, or TikTok's CLI
   from the game folder (`ttmg upload`). Do not upload it yourself.

**When the user wants the Android version** ("prepare the Android build",
"package for HS"…):

1. Ask for the app's details and write them NEXT TO the game folder as
   `<game folder>.android.json`:
   `{ "app_name", "package_name" (optional), "version_name", "privacy_policy_url", "contact_email", "hs_game_id", "hs_sdk_key" }`
   (rules: INTEGRATE-WITH-AI.md, step 5). `hs_game_id` + `hs_sdk_key` are the
   **Android HS game's own** Game ID and SDK key — HS dashboard → Games → the
   game marked ANDROID (create it there, platform Android, if it does not
   exist). Never the TikTok pair from `game.js`: the app is its own HS game
   (`pack` refuses it). The user does not have them and HS sets them → leave
   both out.
   **Ads — always ask, never assume** (also on a kit update, and keep the
   answer for the next build): "Does the app show ads?"
   - **No** → no `"ads"` here, and in `<game>.android-dashboard.json` no
     `ad_provider` and no ad units. The game's `showAd()` calls stay: they
     are silent without units, and `HSGame.has('ads')` hides the ad buttons.
   - **Yes** → ask "Do the app's ads run on AppLovin
   MAX? Which ad networks are switched on in your MAX ad units (Unity,
   AdMob, Meta, Liftoff)?" and write `"ads": { "provider": "applovin_max", "networks": ["unity", "meta"] }`
   (names: `unity`, `admob`, `meta`, `liftoff` — the list is `ads-networks.json`)
   — `[]` for AppLovin's own ads only. AdMob also needs the AdMob **Android**
   app id: `"admob_app_id": "ca-app-pub-…~…"` (AdMob → Apps → App settings).
   The build puts in exactly these networks: one switched on in MAX but
   missing here gets no ads.
2. Ask for the app icon: a 512×512 PNG with a solid background. Save it next to
   the game folder as `<game folder>.icon-512.png`.
3. Run `node <this folder>/web/hs-web.mjs pack <game folder>` and fix what it
   reports. It writes `<game folder>-android.zip` — tell the user to send that
   one file to their HS contact.

**When the user wants an iOS build** ("prepare ios", "build for iPhone",
"TestFlight"…). The iOS app is its own HS game; the game's code does not change
except for step 4. Write every file NEXT TO the game folder, never inside it:

1. Write `ios.json`: `{ "app_name", "bundle_id", "version_name", "hs_game_id", "hs_sdk_key" }`.
   Ask the user for the **bundle ID** — it must be exactly the one of their
   app in App Store Connect (like `com.yourstudio.game`). `app_name` up to 30
   characters; `version_name` up to three numbers (`1.0.0`). `hs_game_id` +
   `hs_sdk_key` = the **iOS HS game's own** Game ID and SDK key (HS dashboard →
   Games → the game marked iOS), never the TikTok pair from `game.js`; left
   out when HS sets them. Ads → `"ads"` as for Android (step 1 there), with
   the AdMob **iOS** app id. An earlier `ios.json` → reuse it, ask only whether
   `version_name` goes up.
2. Make `icon-1024.png`: 1024×1024 PNG with **no transparency and no alpha
   channel** (Apple refuses one even when every pixel is opaque). Start from
   the game's existing icon (`<game>.icon-512.png`) if there is one, and make
   it yourself — do not ask the user to. On macOS, scaled up and with the
   alpha channel dropped (a JPEG step has none):
   `sips -s format jpeg -z 1024 1024 <icon> --out /tmp/i.jpg && sips -s format png /tmp/i.jpg --out icon-1024.png`.
   Elsewhere: Python Pillow (`Image.open(p).convert('RGB').resize((1024, 1024)).save('icon-1024.png')`).
   A transparent corner turns black that way — put the icon on its own
   background colour first if it has one. hs-check stops on any alpha left.
3. Write `<game folder>.ios-dashboard.json` (next section, "set up the HS
   dashboard", for the iOS HS game). If the game sells (`HSGame.shop` / `buy`
   in its code), its `products` copy the TikTok products with the same `id`s
   and add to each `"consumable"` (`false` = bought once for good: No Ads, a
   skin) and `"price_usd"`; keep `name` 2–30 and `description` 1–45
   characters. **Ask the user for the prices** — one of Apple's price points
   (DASHBOARD-CONFIG.md, "iOS (App Store)"); suggest one per product. No
   `google_id`, no Apple ids.
4. If any product has `"consumable": false`, the shop must show a **Restore
   purchases** link: drawn while `HSGame.has('restore')`, calling
   `HSGame.restore()` (INTEGRATE-WITH-AI.md, API). Add it if missing. Then
   apply RULE 18 (no other store on screen): text naming TikTok / Beans /
   Google Play / Android only inside gated UI, a Quit button only while
   `HSGame.has('exit')`. These are the only code changes.
   Look at every screen with `node <this folder>/web/hs-web.mjs preview <game folder> --platform ios`
   (or tell the user to): the shop with Apple prices, "Bought on another
   iPhone" → the Restore link brings the item back.
5. Run `node <this folder>/hs-check.mjs <game folder> --ios` and fix every ❌.
   Then run `node <this folder>/web/hs-web.mjs pack <game folder> --ios` — it
   checks again and writes `<game folder>-ios.zip` (the game + `ios.json` +
   `icon-1024.png`). Do not zip by hand.
6. Tell the user: upload the zip in the HS portal (a new version → iOS build
   for TestFlight), and paste the iOS HS game's data — run
   `node <this folder>/web/hs-web.mjs dashboard <game folder> --for ios` and
   give them its output. New products show in TestFlight at once, for real
   players only after Apple's review. What only they can do in App Store Connect:
   - **once per game, before the first build:** create the app (App Store
     Connect → Apps → + New App) with exactly the `bundle_id` of `ios.json` —
     HS cannot create it, and the build stops until it exists;
   - **before the first release:** App Privacy → "Device ID" and "Purchase
     History", used for app functionality only, no tracking; and one review
     screenshot per in-app product (HS creates the products, Apple wants the
     screenshot).

Never ask for, accept or write Apple keys (`.p8`), certificates, provisioning
profiles or Apple ID passwords — HS signs and uploads the app.

**When the user wants to set up the HS dashboard** ("set up the dashboard",
"add ads", "add AppLovin", "update the products"…) — for one HS game: TikTok,
Android or iOS (each is its own HS game). Rules: DASHBOARD-CONFIG.md.

1. Pick the file next to the game folder: `<game>.hs-dashboard.json` (TikTok),
   `<game>.android-dashboard.json` (Android app) or `<game>.ios-dashboard.json`
   (iOS app). Same shape: `{ "iaa_config": { … }, "products": [ … ] }`.
   Start from the TikTok one: the same places, rewards, items and product ids.
2. Ad units:
   - **TikTok:** ask for the `ad…` ids from the TikTok developer console, one per
     place, and give each its `"type"` (`rewarded` / `interstitial`).
   - **Android / iOS:** ask ONE question — **"Do you have your own ad provider
     account (AppLovin MAX)?"**
     - **Yes:** ask the user to paste the **SDK key** (AppLovin → Account →
       General → Keys) and one **MAX ad unit id** per place (tell them to
       create the units: MAX → Mediation → Manage → Ad Units, platform and
       package name / bundle id of this app, the place's type; names with
       letters, digits and `_` only). Write them into `ad_provider.sdk_key`
       and each place's `ads`.
     - **No:** write `"<AppLovin SDK key>"` and `"<MAX rewarded unit id>"` /
       `"<MAX interstitial unit id>"` placeholders — HS fills them.
     Every unit gets `"type"`; `ad_provider` = `{ "name": "applovin_max",
     "sdk_key": …, "test_mode": true }`.
3. Products: **Android** — each product's `"google_id"` is its Play Console
   product id (ask the user; a `"<Play product id>"` placeholder until it
   exists) and `"consumable": false` for a one-time unlock. **iOS** — as in
   "When the user wants an iOS build", step 3.
4. Run `node <this folder>/hs-check.mjs <game folder>` (fix every ❌), then
   `node <this folder>/web/hs-web.mjs dashboard <game folder> --for <tiktok|android|ios>`.
   It prints ① the ad config and ② the products import, or the `<…>` values
   still to fill. Give the user its output as is: ① goes into that HS game's
   **Ads Config → Edit raw JSON** (saving creates the ad units), ② into
   **Products → Import JSON** with that HS game as the target.

5. **Ads in the Android / iOS app — what only the user can do**, tell them
   once (they own the developer account and the website):
   - **`app-ads.txt`** on the developer website named in the store listing
     (root, e.g. `https://yourstudio.com/app-ads.txt`), with the AppLovin line
     their AppLovin dashboard gives (and the same domain in AppLovin → Account
     → General). Without it most advertisers do not buy — income drops a lot.
     With HS's AppLovin account, HS gives them the line.
   - **Google Play → App content → Data safety:** the app collects the
     **advertising ID**, for advertising, shared with AppLovin; and **Ads:
     yes** under "Ads".
   - **App Store Connect → App Privacy (iOS):** advertising data (device ID,
     usage, diagnostics) "used for third-party advertising", **not** for
     tracking (the app shows no tracking prompt).
   - **Before the release:** set `"test_mode": false` (a test build stays in
     test mode anyway) and paste again — `test_mode: true` in a release shows
     players test ads and earns nothing.

An SDK key and ad unit ids are not secrets (every app that shows ads carries
them) — writing them into these files is fine. Never write a password, an
AppLovin account's report key or management key, or any TikTok / Apple secret.

Do not use the low-level SDK API directly (`HSTikTokSDK.*`) — the game talks
to `hs-game.js` only. [docs/SDK-REFERENCE.md](docs/SDK-REFERENCE.md) is for
engines that cannot use the kit, not for this task.

---

## What is in this folder

| File | |
|---|---|
| `INTEGRATE-WITH-AI.md` | the full guide + the AI prompt (steps 0–5) |
| `hs-game.js`, `hs-sdk.min.js` | the kit — the only two files that go into the game |
| `hs-check.mjs` | checks an integrated game (TikTok + Android), offline |
| `DASHBOARD-CONFIG.md` | the HS dashboard data: rewards, ad places, items, products |
| `web/` | `node web/hs-web.mjs preview <game folder>` (see it on a fake phone, TikTok or Android, offline) · `… pack <game folder> --tiktok` (the zip to upload to TikTok) · `… pack <game folder>` (the Android package for HS) · `… pack <game folder> --ios` (the iOS zip for the HS portal) |
| `docs/SDK-REFERENCE.md`, `sample/` | the low-level SDK, for other engines |

TikTok upload: tell your AI **"build tiktok"**. It checks the game and writes
`<game>-tiktok.zip` for the TikTok developer portal (INTEGRATE-WITH-AI.md, step 2b).

Android version: no code change. Tell your AI **"prepare the Android build"**,
then send the `<game>-android.zip` it makes to your HS contact
(INTEGRATE-WITH-AI.md, step 5).

iOS version: tell your AI **"prepare ios"**. It asks for the bundle ID and the
prices, then makes `<game>-ios.zip` — upload it in the HS portal for a
TestFlight build.
