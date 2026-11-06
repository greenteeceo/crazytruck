// What every reward moment, ad place and product is worth. HSGame (hs-game.js) reads DEFAULTS when offline;
// the same data goes into the HS dashboard (dist-tiktok.hs-dashboard.json, written by build.mjs), where it
// can be changed without a new build. The game only reports moments by key; it never decides their worth.
import { GEM_PACKS, STARTER_PACK } from './platform/config.js';

// Ad places: every HSGame.showAd('<label>') in the game. cooldown = seconds between two ads at that place.
export const AD_PLACES = [
  { label: 'level_x3', type: 'rewarded', cooldown: 30, where: 'Level complete screen: "x3 gems" button (pays 2x the level gems on top)' },
  { label: 'race_x2', type: 'rewarded', cooldown: 30, where: 'Race results screen: "x2 gems" button' },
  { label: 'cup_x2', type: 'rewarded', cooldown: 30, where: 'Cup won screen: "x2 bonus" button (the cup bonus again)' },
  { label: 'daily_x2', type: 'rewarded', cooldown: 30, where: 'Daily gift popup: "Claim x2" button' },
  { label: 'gem_boost', type: 'rewarded', cooldown: 30, where: 'Home (next to Play) and Shop > Gems: "2x" button, doubles level and race gems for 10 min' },
  { label: 'free_gems', type: 'rewarded', cooldown: 30, where: 'Shop (top-left) and Shop > Gems: "+150 gems" button, 5 a day' },
  { label: 'refill_lives', type: 'rewarded', cooldown: 30, where: 'Out of lives popup (and tapping the hearts): "Refill 5" button' },
  { label: 'revive', type: 'rewarded', cooldown: 30, where: 'Fail screen: "Continue" button (back on the wheels at the last checkpoint)' },
  { label: 'try_truck', type: 'rewarded', cooldown: 30, where: 'Shop > Trucks, a truck not owned: "Try" button (free for the next level)' },
  { label: 'level_end', type: 'interstitial', cooldown: 45, where: 'After a level: tapping Next / Retry / Home / Levels (none in the first 3 level ends)' },
  { label: 'race_end', type: 'interstitial', cooldown: 45, where: 'After a race: tapping Next race / Another one / Home (none in the first 3 ends)' },
];

export const DEFAULTS = {
  rewards: {
    // moments the game claims
    cup_win: { gems: 250 },                                   // a cup won for the first time (the game claims it once per cup)
    daily_gift_1: { gems: 100, $limit: 'daily' },            // daily gift by login streak day
    daily_gift_2: { gems: 150, $limit: 'daily' },
    daily_gift_3: { gems: 200, $limit: 'daily' },
    daily_gift_4: { gems: 250, $limit: 'daily' },
    daily_gift_5: { gems: 300, $limit: 'daily' },
    daily_gift_6: { gems: 400, $limit: 'daily' },
    daily_gift_7: { gems: 600, $limit: 'daily' },
    share: { gems: 50, $limit: 'daily' },
    tiktok_shortcut: { gems: 300 },                          // opened from the home-screen icon (once)
    tiktok_profile: { gems: 300 },                           // came in from the profile (once)
    // ad places that pay (the others only let the player go on)
    level_x3: { mult: 3 },
    race_x2: { mult: 2 },
    cup_x2: { mult: 2 },
    daily_x2: { mult: 2 },
    gem_boost: { boost_min: 10 },
    free_gems: { gems: 150 },
    refill_lives: { lives: 5 },
  },
  items: {
    gems: { category: 'currency', name: 'Gems' },
    lives: { category: 'consumable', name: 'Lives' },
    mult: { category: 'boost', name: 'Gem multiplier' },
    boost_min: { category: 'boost', name: '2x Gems (minutes)' },
  },
};

// Shop products (HS dashboard → Products). beans_cost ≈ the USD price on TikTok; the app stores set their own price.
const BEANS = { '$0.99': 70, '$1.99': 140, '$4.99': 350, '$9.99': 700, '$19.99': 1400 };
export const PRODUCTS = [
  { id: 1, name: 'Starter pack', description: `${STARTER_PACK.gems.toLocaleString('en-US')} gems, once`, beans_cost: BEANS[STARTER_PACK.price], price_usd: STARTER_PACK.price,
    rewards: { gems: STARTER_PACK.gems }, badge: 'Once', starter: true },
  ...GEM_PACKS.map((p, i) => ({ id: i + 2, name: `${p.gems.toLocaleString('en-US')} gems`, description: p.tag ? `${p.tag}` : 'Gem pack', beans_cost: BEANS[p.price], price_usd: p.price, rewards: { gems: p.gems }, ...(p.tag ? { badge: p.tag } : {}) })),
];
export const STARTER_ID = 1;
// ad-free level ends at the start of a session (the gap between interstitials is the dashboard cooldown)
export const AD_FREE_ENDS = 3;
