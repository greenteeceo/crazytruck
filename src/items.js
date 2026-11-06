// Special items: consumables used from the HUD during a level or race (effects live in sim.js).
// Bought in the shop with gems, given by "?" item boxes on race tracks, or one free Rocket for a video.
export const ITEMS = [
  { id: 'boost', name: 'Rocket Boost', icon: 'rocket', color: 'orange', price: 120, desc: 'Rocket thrust: flies over long sea crossings.' },
  { id: 'jump', name: 'Super Jump', icon: 'spring', color: 'green', price: 90, desc: 'A giant spring hop, even in mid-air.' },
  { id: 'glide', name: 'Glider Wings', icon: 'wings', color: 'teal', price: 100, desc: 'Wings out: fall slowly and glide far.' },
  { id: 'shield', name: 'Bubble Shield', icon: 'shield', color: 'purple', price: 150, desc: 'Pops instead of crashing: back on your wheels.' },
  { id: 'magnet', name: 'Gem Magnet', icon: 'magnet', color: 'red', price: 60, desc: 'Pulls in every gem nearby for 10 seconds.' },
];
export const CROSSERS = ['boost', 'jump', 'glide'];   // any one of these gets you over a sea crossing
export const itemById = (id) => ITEMS.find((i) => i.id === id);
export const STARTER_ITEMS = { boost: 2, jump: 1, glide: 1, shield: 1, magnet: 1 };
