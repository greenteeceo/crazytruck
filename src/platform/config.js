// Ad units, ad pacing (cooldowns), reward amounts and products live in the HS dashboard (defaults: src/economy.js).
export const REWARDS = {
  freeGemsPerDay: 5,      // the "+gems" video in the shop, at most this many times a day
};

// Developer test tools in Settings (Autoplay, All resources) and the AUTO / TEST chips.
// true while testing; set to false for the store build (5 taps on the version line in Settings still unlocks them).
export const DEV_TOOLS = true;

// Gem packs for real money: these become the HS dashboard products (economy.js → PRODUCTS). The price shown in
// the game is the store's own (p.price, or Beans on TikTok); the USD prices here are the targets.
// Economy (see README "Economy"): players earn ~100-150 gems a minute on new levels, so the small pack is
// ~10 minutes of play, and each pack lines up with a truck people want (Scoop, Rubble, Mixer, Knight, Rocket).
export const GEM_PACKS = [
  { id: 'gems_s', gems: 1200, price: '$0.99' },
  { id: 'gems_m', gems: 2600, price: '$1.99', tag: '+8%' },
  { id: 'gems_l', gems: 7000, price: '$4.99', tag: '+15%' },
  { id: 'gems_xl', gems: 15000, price: '$9.99', tag: '+25% Popular' },
  { id: 'gems_xxl', gems: 32000, price: '$19.99', tag: '+30% Best value' },
];
// one-time offer shown until bought
export const STARTER_PACK = { id: 'starter', gems: 3000, price: '$0.99' };

// HS SDK (hs-kit/): the TikTok game's HS Game ID and SDK key, from the HS dashboard → Games. Empty while drafting:
// the game then runs offline (progress on the phone, rewards from src/economy.js, no real ads / shop / cloud).
// Never put the TikTok Client Secret anywhere in the game.
export const HS_GAME_ID = '';
export const HS_SDK_KEY = '';
