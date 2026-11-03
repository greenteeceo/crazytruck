// TikTok Mini Games configuration. Fill these in from the TikTok Developer Portal:
//   App page > Credentials (client key) and Monetization > Ad units (ad unit IDs).
// While an ID is empty or still a placeholder, the game shows a local "TEST AD" instead.
export const TIKTOK = {
  clientKey: '',                       // e.g. 'awxxxxxxxxxxxxxx'
  rewardedAdUnitId: 'REWARDED_AD_UNIT_ID',
  interstitialAdUnitId: 'INTERSTITIAL_AD_UNIT_ID',
};

// Interstitial pacing (TikTok also enforces its own minimum interval: error 11004).
export const AD_RULES = {
  firstInterstitialAfterSec: 45,   // never in the first 45 s of a session
  minInterstitialGapSec: 45,       // at least this long between two interstitials (levels last ~10-15 s)
  levelsBetweenInterstitials: 1,   // any level end may show one (the time gap does the pacing)
};

// Rewards (hard currency = gems). Shortcut and sidebar rewards follow TikTok's guidance:
// a bigger first-time reward and a smaller daily one.
export const REWARDS = {
  shortcutFirst: 300, shortcutDaily: 100,
  sidebarFirst: 300, sidebarDaily: 100,
  freeGems: 150,          // shop: watch a video
  winMultiplier: 3,       // level complete: x3 gems
  raceMultiplier: 2,      // race results: x2 gems
};

export const isPlaceholder = (id) => !id || /AD_UNIT_ID$/.test(id);
