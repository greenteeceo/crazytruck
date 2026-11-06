# HS dashboard — the data your game runs on

The game reports **moments** by key (`claim('mission_a')`, `showAd('revive')`,
`share()`). Everything those moments do is data here. Change it any time;
players get it at their next start.

Each platform is its own **HS game** (its own Game ID + SDK key) with its own
data. Your AI writes one JSON file per HS game, NEXT TO the game folder:

| HS game | File | Ad units from |
|---|---|---|
| TikTok | `<game>.hs-dashboard.json` | the TikTok developer console (`ad…` ids) |
| Android app | `<game>.android-dashboard.json` | AppLovin MAX (16-character ids) |
| iOS app | `<game>.ios-dashboard.json` | AppLovin MAX — its own units (MAX makes units per platform) |

Each file has the same two parts — exactly what is pasted:

```json
{ "iaa_config": { … },  "products": [ … ] }
```

`hs-check` validates every file by the rules the HS backend applies when you
save, and prints what to paste where:

```bash
node web/hs-web.mjs dashboard <game folder> --for tiktok|android|ios
```

① `iaa_config` → that HS game → **Ads Config → Edit raw JSON** → Save.
Saving also creates the game's **ad units** from it (no "Add Ad Placement" by
hand). ② `products` → **Products → Import JSON** → target game = that HS game.

A value the partner does not have yet is written as `"<…>"` (e.g.
`"<MAX rewarded unit id>"`): `dashboard` refuses to print until it is filled —
by the partner, or by HS when HS runs the ad account.

---

## ① The ad config — places, rewards, items

```json
{
  "placements": [
    { "label": "revive",    "ads": [ { "id": "ad7635013883317733396", "type": "rewarded", "config": { "cooldown": 30 } } ] },
    { "label": "level_win", "ads": [ { "id": "ad7635205496211589141", "type": "interstitial" } ] }
  ],
  "rewards": {
    "mission_a":       { "hint": 2, "revive": 1, "$limit": "once" },
    "daily_gift":      { "coins": 50, "$limit": "daily" },
    "revive":          { "revive": 1 },
    "share":           { "hint": 3, "$limit": "daily" },
    "tiktok_shortcut": { "hint": 3 },
    "tiktok_profile":  { "hint": 3 }
  },
  "items": {
    "hint":      { "category": "consumable", "name": "Hint",       "icon": "https://cdn.example.com/hint.png" },
    "coins":     { "category": "currency",   "name": "Coins" },
    "skin_gold": { "category": "skin",       "name": "Gold rings", "image": "https://cdn.example.com/gold.png" }
  }
}
```

**`placements`** — one per ad moment. `label` = the name in the code,
`showAd('revive')`, exactly (lowercase). `ads` = a waterfall of ad units: the
first one active and not cooling down is shown. Each unit has its **`id`** and
its **`type`** (`rewarded` / `interstitial`) — saving creates or updates the
unit with that type. `config.cooldown` = seconds before that unit shows again.
**No placement = no ad** at that moment — that is how you switch one off.

**`rewards`** — what a key gives: `{ "item": count }`. Optional `"$limit"`:
`"once"`, `"daily"`, or none (every time). Built in: `share` is daily,
`tiktok_*` once. The reward of an ad place has the place's name (`revive`).
`"key": null` switches a default reward off.

**`items`** — what each item is: `category`, `name`, `icon`/`image` (display).
An item that is a **number field of the game's profile** (`hint`, `coins`…) is
added to it automatically. Other items (a skin unlock…) need game code. So the
dashboard can change any amount and move known items between keys freely; a
brand-new item needs a build.

> Keep `rewards`, `items` and `ad_provider` at the top level, next to
> `placements`. Keys added inside a placement are dropped when the Ads Config
> builder saves.

**`features`** (optional) — switch a feature off for this game without a
build: `"features": { "share": false }`. Names: `tiktok_missions`, `share`,
`ads`, `shop` (also hides Restore purchases), `cloud`. The game's buttons
follow (`HSGame.has(name)`). A feature can only be switched off here — what a
platform cannot do stays off.

### Android / iOS: the ad provider

The app's ads come from **AppLovin MAX**. Its ad config adds the account's
SDK key at the top level, and its units are MAX ad unit ids (an app without
ads: no `ad_provider` and no ad units — `rewards` / `items` alone are fine):

```json
"ad_provider": { "name": "applovin_max", "sdk_key": "<AppLovin SDK key>", "test_mode": true, "networks": ["unity"] },
"placements": [
  { "label": "revive", "ads": [ { "id": "<MAX rewarded unit id>", "type": "rewarded" } ] }
]
```

- **SDK key:** AppLovin dashboard → Account → General → Keys (one per account).
- **Ad units:** MAX → Mediation → Manage → Ad Units → Create Ad Unit, one per
  place: platform Android (or iOS), the app's package name / bundle id, the
  place's type. Unit names: letters, digits and `_` only.
- **`test_mode: true`** shows MAX test ads — set `false` only for the release
  (a test build stays in test mode anyway).
- **`networks`:** the other ad networks switched on in the MAX ad units
  (`unity`, `admob`, `meta`, `liftoff` — the list is `ads-networks.json`;
  `[]` = AppLovin's own ads only). The same list as `"ads"`
  in `android.json` / `ios.json` — the app is built with exactly these, and
  the build stops when the two differ. `admob` also needs
  `"admob_app_id": "ca-app-pub-…~…"` (this platform's AdMob app id).
- The rest (`rewards`, `items`) is the same as the TikTok game's.

#### Add a network to the app (e.g. Meta)

1. **HS game:** add its name to `ad_provider.networks` (+ its app id when it
   needs one — today only `admob`) in `<game>.android-dashboard.json` /
   `.ios-dashboard.json`, then paste the ad config in the HS dashboard.
   Nothing else changes: same SDK key, same placements, same MAX unit ids.
2. **Package:** the same list in `"ads"` of `android.json` / `ios.json`
   (`pack` refuses a different one).
3. **New build** — the network's adapter is built into the app. Until then
   MAX skips the network. Taking a network out works the same way.

> Reminder: the network itself is set up by the partner — its account, its
> ids in each MAX ad unit's network row, its line in `app-ads.txt`, the
> Data safety / App Privacy answers. Meta also needs Business verification
> (slow — start early).

## ② Products

```json
[
  { "id": 1, "name": "Hint pack",      "beans_cost": 10, "rewards": { "hint": 15 } },
  { "id": 2, "name": "Gold skin pack", "beans_cost": 50, "rewards": { "skin_gold": 1, "coins": 200 },
    "consumable": false, "icon": "https://cdn.example.com/gold.png", "badge": "NEW" }
]
```

`id` a number, unique per game (re-importing an id updates it) ·
`beans_cost` the price · `rewards` like above · `"consumable": false` for a
product bought once for good (a skin, No Ads) — from the start · any other
field (`icon`, `badge`, `sort`…) reaches the shop screen as-is. The import
takes `{ "products": [ … ] }` — `dashboard` prints it that way.

### Android (Google Play)

Each product adds **`"google_id"`** — the product id in Play Console (Monetize
with Play → Products → One-time products), exactly. A product shows in the app
only when it has one AND exists in Play; the price shown is Google's.
`"consumable": false` for a permanent unlock (Google keeps it owned and
restores it on a new phone) — set before anyone buys. Play unlocks products
only after a build with billing is on a testing track, so the first Android
build may have no shop: fill `google_id` later and import again — no new build.

### iOS (App Store)

- **`consumable`** is required: `true` = can be bought again (hints, coins),
  `false` = bought once for good (No Ads, a skin). It can **never change**
  after the first sale — Apple fixes it.
- **`price_usd`** must be one of Apple's price points: 0.99, 1.99, 2.99, 3.99,
  4.99, 5.99, 6.99, 7.99, 8.99, 9.99, 14.99, 19.99, 24.99, 29.99, 49.99 or
  99.99. Apple sets the local prices; the shop shows Apple's (`p.price`).
- **`name`** 2–30 characters, **`description`** 1–45 (Apple's limits).
- **`rewards`** only items the game already has (a profile field, or in `items`).
- An **`id` is never reused** for a different product — Apple keeps every id
  for good.
- **No Apple ids, no `google_id`, no StoreKit code.** HS creates each product
  in App Store Connect from this list and the app maps `id` to it.
- A product with `"consumable": false` needs the shop's **Restore purchases**
  link (`HSGame.has('restore')` → `HSGame.restore()`); Apple rejects the app
  without it.
- A new product shows in **TestFlight at once**; real players see it only
  after Apple has reviewed it.

(An older kit wrote the iOS products alone to `<game>.ios-products.json`; it is
still read.)

## What works without a new build — and what does not

| ✅ Dashboard only | ❌ Needs a new build |
|---|---|
| change any amount or limit | a moment the code never reports (a new `claim` / `showAd` key) |
| switch an ad place on / off, its waterfall, cooldown | a brand-new item (not a profile field the game has) |
| a new reward key for a moment the code already reports | new UI, new game logic |
| new products, prices, badges — with items the game already has | |

`hs-check` lists the keys, places and categories a build supports, and fails
any reward this build cannot give.

> Remote images (`icon`, `image`) may need their domain allowed in the TikTok
> developer console; the game should fall back to a built-in icon.
