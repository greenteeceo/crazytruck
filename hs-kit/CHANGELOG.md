# HS SDK kit — what changed

Newest first. Upgrading a game: README.md → "When the game already uses the kit".

For upgrading a game that already uses the kit (README → "When the game
already uses the kit"). Replace the two files, then do only the **Action**
lines of each version newer than the game's. A game in the older style
(`HSGame.save()` / `onLoad` / `onGive`, its own storage) stays that way: it is
still supported, and moving it to `HSGame.profile()` is not part of an upgrade.

**3.3.4** (SDK 1.1.3) — apps without ads
- An Android / iOS app may have no ads: its dashboard JSON then has no
  `ad_provider` and no ad units (`rewards` / `items` alone pass hs-check).
  The game's `showAd()` calls stay — silent without units — and
  `HSGame.has('ads')` keeps the ad buttons hidden. Action: ask the user
  "Does the app show ads?" (README, Android step 1) — if not, remove `"ads"`
  from `android.json` / `ios.json` and `ad_provider` + the ad units from the
  app's dashboard JSON. No code change; `hs-game.js` is the same code as 3.3.1.

**3.3.3** (SDK 1.1.3) — the app's own HS game and its ad networks
- `android.json` / `ios.json` may carry the app HS game's own `hs_game_id` +
  `hs_sdk_key` (the build uses them when HS gives none); `pack` refuses the
  TikTok pair from `game.js`. Action: only if you set up the Android / iOS HS
  game yourself — add its pair.
- `android.json` / `ios.json` `"ads"`: the ad provider and the networks it
  mediates (`{ "provider": "applovin_max", "networks": ["unity", "meta"] }`;
  `unity`, `admob`, `meta`, `liftoff` — the list is `ads-networks.json`;
  `admob` also needs `"admob_app_id"`) — the build puts in exactly those. The
  app HS game's `ad_provider` carries the same `networks` (DASHBOARD-CONFIG.md,
  "Add a network to the app"); `pack` refuses when they differ, and refuses a
  dashboard JSON with an `ad_provider` but no `"ads"`. Action: an app with
  ads — add `"ads"` to `android.json` / `ios.json` and `networks` to the
  app's dashboard JSON (README, Android step 1). `hs-game.js` is the same code
  as 3.3.1.

**3.3.2** (SDK 1.1.3) — dashboard data by JSON
- One JSON per HS game next to the game folder — `<game>.hs-dashboard.json`
  (TikTok), `.android-dashboard.json`, `.ios-dashboard.json` (replaces
  `.ios-products.json`, still read) — and `node web/hs-web.mjs dashboard
  <game> --for tiktok|android|ios` prints exactly what to paste. Each ad unit
  in `placements` carries `"type"`: saving the config creates the ad units.
  Action: add `"type"` to each ad in `<game>.hs-dashboard.json` (hs-check
  warns); `hs-game.js` is the same code as 3.3.1.

**3.3.1** (SDK 1.1.3)
- Ads in the Android / iOS app: AppLovin MAX, set up by HS on the app's HS
  game (DASHBOARD-CONFIG.md, `ad_provider`). The app loads every ad before the
  first tap. Action: none — the same `showAd()` calls; replace `hs-game.js`.

**3.3.0** (SDK 1.1.3) — the iOS app
- The HS app now also runs on iOS (TestFlight, then the App Store): the same
  files, purchases through Apple with the same `shop()` / `buy()`. Its
  products are every product of the iOS HS game, by `product_id` — no Apple
  ids anywhere. `has()` and `platform` work as on Android.
- `HSGame.restore()` + `has('restore')`: the "Restore purchases" link Apple
  requires when the shop sells a one-time product. Action, only if the game
  sells a product with `"consumable": false` (No Ads, a skin): add the link to
  the shop (API above, RULE 12). hs-check fails an iOS package without it.
- RULE 18 (no other store on screen) + `has('exit')`. Action, only for a
  game going to iOS: text naming TikTok / Beans / Google Play / Android shows
  only in gated UI; a Quit button only while `has('exit')`. hs-check lists
  what it finds.
- iOS purchases are kept on the phone for the HS backend's Apple route (a
  later SDK sends them); nothing is sent to the Google route. Action: none.
- hs-check checks the iOS files when `ios.json` is next to the game folder
  (or with `--ios`). "prepare ios" — README → "When the user wants an iOS build".
  The preview has an **iOS app** mode (App Store sheet, "Bought on another
  iPhone" to try Restore purchases).

**3.2.4** (SDK 1.1.3)
- TikTok: an ad shows on the tap or not at all. The SDK loads the ad first
  (at most 8 s) and shows it only once it is loaded; before, an ad that was
  slow to load could answer "no ad" and then appear seconds later with no tap
  — TikTok review rejects that. While one ad loads or shows, `showAd()` for
  any place resolves `null` (`HSGame.lastAdError` = `busy`). A game frozen by
  an ad TikTok never answers is let go after 60 s, not 130 s. Action:
  replace `hs-game.js` and `hs-sdk.min.js`, run hs-check, upload again.
- Action, only if the game added its own ad guards after a failed ad ("no ads
  for N minutes", a debounce between ad requests, ads switched off after a
  timeout): remove them — they now only cost ad views (RULE 16). Keep real
  pacing: ad-free first levels stay in code; a gap between interstitials
  becomes the place's "cooldown" in the dashboard (Q4). Check every showAd()
  is inside a tap handler (RULE 16) and every repeatable reward has a limit
  (RULE 17).

**3.2.3, tools update** (hs-web 1.1.0; `hs-game.js` and the SDK unchanged)
- `node web/hs-web.mjs pack <game folder> --tiktok` makes the zip to upload
  to TikTok (step 2b). Your AI does it when you say "build tiktok".
  Action: none. Your game's two kit files stay as they are.

**3.2.3** (SDK 1.1.2)
- A change not yet in the cloud survives an app killed before the sync (or
  played offline): when no other phone wrote the cloud meanwhile, the next
  start hands `onLoad` this phone's last `save()` — not the older cloud copy —
  and uploads it; when another phone did, the cloud copy wins, as before —
  and a purchase that was only in this phone's lost copy is credited again
  (never lost; this can repeat each time another phone wrote the cloud first).
  Rewards, claims and purchases go up within about a second. Paid TikTok
  orders are confirmed only once an uploaded save holds them. `onLoad` may
  now also come at a start without network (this phone's last `save()` for
  the account that played here last); still at most once a session, except
  "Play here" or a sign-in to another account. Action: none for an `onLoad`
  that merges (keeps the further progress), as this guide writes it.
- Paid TikTok orders: delivery is confirmed (`mark_delivered`) 1–4 s after
  `buy()`, once the save holding the items is in the cloud. Action: none.
- Action, games with `HSGame.save()` (no profile): `onGive` calls
  `HSGame.save(progress)` before it returns (RULE 15) — run hs-check, it fails
  a game that saves later. A game that saves later gets a purchase credited
  again after a kill; one with `onLoad` that never calls `save()` keeps its
  orders unconfirmed — credited once, offered again at every login. Call
  `save()` in `onGive`.

**3.2.2** (SDK 1.1.1)
- Android: a pending Google payment that completes while the app is in the
  background is credited when the player comes back. Action: none.
- Action: products bought once for good (No Ads, a skin) get
  `"consumable": false` in `<game>.hs-dashboard.json`. `hs-check` warns otherwise.
- Action, only if the shop shows Beans alone: the price label becomes
  `p.price || (p.beans_cost + ' Beans')` (Android sends Google's price as
  `p.price`). A label that already uses `p.price` first is fine as it is.

**3.2.1** (SDK 1.1.1)
- Android: Google Play purchases through the same `HSGame.shop()` /
  `HSGame.buy()`; device accounts with cloud save, no sign-in screen.
  Action: none if the shop is written as in this guide.
- `HSGame.canSignIn` replaces `!HSGame.loggedIn` as the rule for showing a
  "Sign in" button. Action: only if the game has that button (Q3 = yes).

**3.2.0** (SDK 1.1.0) — the Android app. `HSGame.has()`, pause / resume,
`HSGame.platform`. Action: from 3.1, follow RULES 12 and 14.
