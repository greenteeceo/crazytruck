// The 20 worlds: look (sky, water, decorations, ground styles) and generator settings.
// Worlds 1-4 have hand-made levels 1-10; every other level is generated from validated seeds.
// Worlds 11-20 are locked behind a star total (see starsReq).

const base = (kind, ground, extra = {}) => ({
  kind, ground, startGround: ground, hill: ground, bump: ground, step: ground,
  pillar: 'wood', plank: 'wood', mover: 'girder', crate: 'crate', domino: 'wood', lowGravChance: 0, ...extra,
});

export const WORLD_DEFS = [
  {
    id: 'classic', name: 'Classic', sub: 'A timeless grassy adventure.', ...base('classic', 'grass'),
    words: [['Meadow', 'Clover', 'Pebble', 'Sunny', 'Lagoon', 'Mossy', 'Breezy', 'Puddle', 'Daisy', 'Willow', 'Coral', 'Sandy'], ['Run', 'Hop', 'Dash', 'Leap', 'Crossing', 'Bend', 'Climb', 'Drift', 'Shore', 'Skip']],
    theme: { skyTop: '#2fb6ff', skyBottom: '#bff0ff', mount: [0x1f8bff, 0x0f74f0, 0x45a8ff], water: 0x16c3ff, waterDeep: 0x0a8fe6, fog: 0x9fe2ff, ui: '#1d8cff', deco: ['tree', 'bush', 'rock'], cloud: 0xffffff },
  },
  {
    id: 'construction', name: 'Construction', sub: 'Industrial platforms and site hazards.', ...base('construction', 'concrete', { bump: 'girder', step: 'girder', pillar: 'girder', plank: 'girder', domino: 'girder' }),
    words: [['Rebar', 'Crane', 'Cement', 'Girder', 'Rivet', 'Scaffold', 'Bolt', 'Gravel', 'Hardhat', 'Asphalt', 'Steel', 'Brick'], ['Yard', 'Lift', 'Zone', 'Stack', 'Rush', 'Works', 'Site', 'Drop', 'Climb', 'Run']],
    theme: { skyTop: '#ff4b3a', skyBottom: '#ffae6b', mount: [0xff7a5c, 0xe95a45, 0xffa07a], water: 0xffd2b0, waterDeep: 0xf2a77e, fog: 0xffb88f, ui: '#ff5a3c', deco: ['cone', 'barrier', 'crateDeco'], cloud: 0xfff1e6 },
  },
  {
    id: 'medieval', name: 'Medieval', sub: 'Castles, bridges and royal challenges.', ...base('medieval', 'castle', { startGround: 'grass', pillar: 'wood' }),
    words: [['Knight', 'Dragon', 'Moat', 'Tower', 'Banner', 'Royal', 'Squire', 'Rampart', 'Crown', 'Keep', 'Joust', 'Gate'], ['Charge', 'Crossing', 'Path', 'Leap', 'Run', 'Quest', 'March', 'Siege', 'Bridge', 'Gallop']],
    theme: { skyTop: '#2b54d9', skyBottom: '#7aa2ff', mount: [0x284fc9, 0x1d3aa0, 0x3d66e6], water: 0x2aa9ff, waterDeep: 0x1b6fd6, fog: 0x6f8ff0, ui: '#3557e0', deco: ['tree', 'torch', 'rock'], cloud: 0xe9efff },
  },
  {
    id: 'science', name: 'Science', sub: 'A high-tech lab with energy mechanics.', ...base('science', 'metal', { pillar: 'metal', plank: 'metal', mover: 'metal', crate: 'labcrate', lowGravChance: 0.3 }),
    words: [['Quantum', 'Plasma', 'Laser', 'Ion', 'Neutron', 'Photon', 'Fusion', 'Vector', 'Gamma', 'Proton', 'Orbit', 'Turbo'], ['Lab', 'Leap', 'Loop', 'Drift', 'Pulse', 'Jump', 'Test', 'Field', 'Core', 'Boost']],
    theme: { skyTop: '#1d2a5a', skyBottom: '#45d98a', mount: [0x2a3a6e, 0x223060, 0x34508a], water: 0x5cf2a0, waterDeep: 0x24b46a, fog: 0x3f9a8a, ui: '#14a37a', deco: ['tank', 'lamp', 'labcrateDeco'], cloud: 0xcaf7ff },
  },
  // ---------------------------------------------------------------- new worlds 5-10 (open)
  {
    id: 'desert', name: 'Desert Dunes', sub: 'Hot sand, cacti and hidden oases.', ...base('classic', 'desert', { pillar: 'wood' }),
    words: [['Dune', 'Cactus', 'Mirage', 'Oasis', 'Scorpion', 'Canyon', 'Camel', 'Sunbaked', 'Dusty', 'Mesa', 'Sahara', 'Tumble'], ['Run', 'Ridge', 'Drift', 'Pass', 'Trail', 'Jump', 'Crossing', 'Rush', 'Hop', 'Dash']],
    theme: { skyTop: '#ff9e3d', skyBottom: '#ffe7b0', mount: [0xe8a35c, 0xd18a45, 0xf2bd7a], water: 0x2ec4b6, waterDeep: 0x1a9c90, fog: 0xffd9a0, ui: '#e8892a', deco: ['cactus', 'rock', 'palm'], cloud: 0xfff4e0 },
  },
  {
    id: 'snow', name: 'Snow Peaks', sub: 'Frosty hills and snowy bridges.', ...base('classic', 'snow', { hill: 'snow' }),
    words: [['Frosty', 'Snowy', 'Glacier', 'Polar', 'Blizzard', 'Icicle', 'Yeti', 'Alpine', 'Chilly', 'Winter', 'Flurry', 'Arctic'], ['Slope', 'Run', 'Peak', 'Drift', 'Pass', 'Hop', 'Ridge', 'Slide', 'Trail', 'Dash']],
    theme: { skyTop: '#6fb8ff', skyBottom: '#eaf6ff', mount: [0xdbe9ff, 0xb8d2f5, 0xffffff], water: 0x8fd8ff, waterDeep: 0x5fb4e6, fog: 0xdcecff, ui: '#4a9be8', deco: ['pine', 'snowman', 'pine', 'rock'], cloud: 0xffffff },
  },
  {
    id: 'jungle', name: 'Jungle Ruins', sub: 'Vines, rope bridges and lost temples.', ...base('medieval', 'jungle', { hill: 'stone' }),
    words: [['Vine', 'Temple', 'Monkey', 'Tiki', 'Jaguar', 'Parrot', 'Lost', 'Canopy', 'Mossy', 'Banana', 'Totem', 'Wild'], ['Run', 'Ruins', 'Swing', 'Trail', 'Path', 'Leap', 'Crossing', 'Quest', 'Climb', 'Dash']],
    theme: { skyTop: '#2fa86a', skyBottom: '#c9f7d8', mount: [0x1f8a52, 0x16703f, 0x2fae6a], water: 0x22c7b5, waterDeep: 0x139684, fog: 0x9fe6c0, ui: '#1f9a5a', deco: ['palm', 'bush', 'tree'], cloud: 0xf0fff6 },
  },
  {
    id: 'volcano', name: 'Lava Land', sub: 'Don’t touch the lava!', ...base('construction', 'basalt', { mover: 'basalt', pillar: 'basalt', plank: 'girder' }),
    words: [['Magma', 'Lava', 'Ember', 'Ash', 'Inferno', 'Molten', 'Cinder', 'Blaze', 'Scorch', 'Fire', 'Obsidian', 'Sulfur'], ['Run', 'Rush', 'Flow', 'Leap', 'Crater', 'Jump', 'Bridge', 'Dash', 'Path', 'Climb']],
    theme: { skyTop: '#2a0b1c', skyBottom: '#ff7a3a', mount: [0x5a1e1e, 0x3e1414, 0x7a2a1a], water: 0xff5a1a, waterDeep: 0xd43a00, fog: 0xa83a24, ui: '#e2462a', deco: ['ember', 'rock', 'ember'], cloud: 0x6a3a3a, lava: true },
  },
  {
    id: 'candy', name: 'Candy Land', sub: 'Sweet hills of frosting and lollipops.', ...base('classic', 'candy', { pillar: 'candy' }),
    words: [['Sugar', 'Gumdrop', 'Lolly', 'Candy', 'Toffee', 'Sprinkle', 'Jelly', 'Fudge', 'Cupcake', 'Cookie', 'Bonbon', 'Caramel'], ['Hop', 'Swirl', 'Run', 'Lane', 'Twist', 'Drop', 'Leap', 'Road', 'Dash', 'Bounce']],
    theme: { skyTop: '#ff8fcf', skyBottom: '#ffe3f4', mount: [0xffb3de, 0xf59acb, 0xffd0ea], water: 0x9be7ff, waterDeep: 0x6ccdf0, fog: 0xffd6ee, ui: '#f05aa8', deco: ['lollipop', 'candycane', 'lollipop'], cloud: 0xffffff },
  },
  {
    id: 'beach', name: 'Sunny Beach', sub: 'Palm trees, waves and beach umbrellas.', ...base('classic', 'beach'),
    words: [['Surf', 'Palm', 'Seashell', 'Tide', 'Sunny', 'Coconut', 'Breeze', 'Wave', 'Sandy', 'Lagoon', 'Pelican', 'Tropic'], ['Run', 'Bay', 'Shore', 'Hop', 'Splash', 'Drift', 'Dash', 'Reef', 'Cove', 'Ride']],
    theme: { skyTop: '#28b8ff', skyBottom: '#d6f6ff', mount: [0x31a9e8, 0x1f8fd0, 0x5cc4f2], water: 0x1fd1e0, waterDeep: 0x0fa8c0, fog: 0xb8ecff, ui: '#16a6d8', deco: ['palm', 'umbrella', 'rock'], cloud: 0xffffff },
  },
  // ---------------------------------------------------------------- worlds 11-20 (locked by stars)
  {
    id: 'city', name: 'Night City', sub: 'Neon streets and rooftop jumps.', ...base('construction', 'asphalt', { bump: 'concrete', step: 'concrete', pillar: 'girder', plank: 'girder', domino: 'girder' }),
    words: [['Midnight', 'Downtown', 'Neon', 'Skyline', 'Traffic', 'Rooftop', 'Subway', 'Avenue', 'Metro', 'Uptown', 'Boulevard', 'Alley'], ['Run', 'Rush', 'Drift', 'Jump', 'Cruise', 'Dash', 'Loop', 'Lane', 'Block', 'Ride']],
    theme: { skyTop: '#0b1230', skyBottom: '#5a3c96', mount: [0x1c2350, 0x151a40, 0x262e66], water: 0x2b2f5c, waterDeep: 0x1b1e40, fog: 0x3a2f6e, ui: '#7a4ce0', deco: ['building', 'lamp', 'cone'], cloud: 0x8a7ac0 },
    starsReq: 60,
  },
  {
    id: 'docks', name: 'Pirate Docks', sub: 'Wooden piers, barrels and drawbridges.', ...base('medieval', 'docks', { startGround: 'beach', hill: 'docks' }),
    words: [['Pirate', 'Anchor', 'Parrot', 'Cannon', 'Treasure', 'Plank', 'Captain', 'Galleon', 'Kraken', 'Barrel', 'Compass', 'Jolly'], ['Pier', 'Dock', 'Walk', 'Jump', 'Raid', 'Run', 'Harbor', 'Leap', 'Bay', 'Dash']],
    theme: { skyTop: '#ff8a5c', skyBottom: '#ffd3a0', mount: [0x3a6fb0, 0x2a5a96, 0x4a82c4], water: 0x1a8fd0, waterDeep: 0x0f6aa8, fog: 0xffc49a, ui: '#c45a2a', deco: ['barrelDeco', 'crateDeco', 'flag'], cloud: 0xfff0e0 },
    starsReq: 90,
  },
  {
    id: 'moon', name: 'Moon Base', sub: 'Low gravity, big air.', ...base('science', 'moon', { pillar: 'metal', plank: 'metal', mover: 'metal', crate: 'labcrate', gravity: 4 }),
    words: [['Lunar', 'Crater', 'Apollo', 'Orbit', 'Rocket', 'Comet', 'Star', 'Galaxy', 'Cosmic', 'Astro', 'Nova', 'Meteor'], ['Base', 'Hop', 'Leap', 'Drift', 'Walk', 'Jump', 'Flight', 'Run', 'Float', 'Bounce']],
    theme: { skyTop: '#02030a', skyBottom: '#1b2142', mount: [0x3a3f56, 0x2c3044, 0x4a5068], water: 0x1a1d30, waterDeep: 0x10121f, fog: 0x1b2142, ui: '#5a6ad0', deco: ['antenna', 'rock', 'tank'], cloud: 0x2a2f48, stars: true },
    starsReq: 120,
  },
  {
    id: 'mars', name: 'Red Planet', sub: 'Dusty red rocks under a pink sky.', ...base('science', 'mars', { pillar: 'metal', plank: 'metal', mover: 'metal', crate: 'labcrate', gravity: 6.5 }),
    words: [['Martian', 'Rusty', 'Dusty', 'Olympus', 'Rover', 'Red', 'Crimson', 'Phobos', 'Deimos', 'Canyon', 'Solar', 'Ares'], ['Ridge', 'Run', 'Drift', 'Crater', 'Leap', 'Trek', 'Valley', 'Dash', 'Hop', 'Pass']],
    theme: { skyTop: '#c86a5a', skyBottom: '#ffd0b8', mount: [0xb04a30, 0x963a24, 0xc85a3a], water: 0x6a2a1a, waterDeep: 0x4a1a10, fog: 0xe8a088, ui: '#c84a2a', deco: ['rock', 'crystal', 'antenna'], cloud: 0xffe0d0 },
    starsReq: 150,
  },
  {
    id: 'reef', name: 'Coral Reef', sub: 'Colourful coral islands in a tropical sea.', ...base('classic', 'coral', { pillar: 'wood' }),
    words: [['Coral', 'Starfish', 'Lagoon', 'Turtle', 'Pearl', 'Seahorse', 'Dolphin', 'Shell', 'Kelp', 'Bubble', 'Manta', 'Clam'], ['Reef', 'Run', 'Hop', 'Drift', 'Dive', 'Cove', 'Splash', 'Dash', 'Leap', 'Shoal']],
    theme: { skyTop: '#16a0d8', skyBottom: '#9ff0ff', mount: [0x1aa8b8, 0x13909e, 0x3ac0cc], water: 0x0ab3d0, waterDeep: 0x0784a8, fog: 0x8ae6f0, ui: '#0aa0c0', deco: ['coral', 'coral', 'rock'], cloud: 0xffffff },
    starsReq: 180,
  },
  {
    id: 'autumn', name: 'Autumn Woods', sub: 'Golden leaves and pumpkin patches.', ...base('medieval', 'autumn', { hill: 'autumn' }),
    words: [['Maple', 'Acorn', 'Harvest', 'Pumpkin', 'Amber', 'Golden', 'Oak', 'Hazel', 'Rustle', 'Cider', 'Copper', 'Fox'], ['Trail', 'Run', 'Path', 'Hollow', 'Leap', 'Grove', 'Bridge', 'Dash', 'Hop', 'Woods']],
    theme: { skyTop: '#f5a04a', skyBottom: '#ffe9c2', mount: [0xd4743a, 0xb85a2a, 0xe8924a], water: 0x3aa8d8, waterDeep: 0x2a84b8, fog: 0xffd0a0, ui: '#d8682a', deco: ['autumnTree', 'pumpkin', 'autumnTree'], cloud: 0xfff4e4 },
    starsReq: 210,
  },
  {
    id: 'icecave', name: 'Ice Cave', sub: 'Crystal caverns with bounce pads.', ...base('science', 'icecave', { pillar: 'icecave', plank: 'metal', mover: 'icecave', crate: 'labcrate' }),
    words: [['Crystal', 'Frozen', 'Glacial', 'Shiver', 'Frost', 'Prism', 'Diamond', 'Chill', 'Sapphire', 'Ice', 'Cobalt', 'Hail'], ['Cave', 'Slide', 'Drift', 'Hop', 'Tunnel', 'Run', 'Grotto', 'Leap', 'Dash', 'Vault']],
    theme: { skyTop: '#1a3a6a', skyBottom: '#9fe0ff', mount: [0x5aa8e0, 0x3a88c8, 0x8ac8f0], water: 0x2a6aa8, waterDeep: 0x1a4a88, fog: 0x7ab8e0, ui: '#3a8ae0', deco: ['crystal', 'crystal', 'rock'], cloud: 0xcfeeff },
    starsReq: 240,
  },
  {
    id: 'toy', name: 'Toy Box', sub: 'Brick blocks and building toys.', ...base('construction', 'toy', { bump: 'toy', step: 'toy', pillar: 'toy', plank: 'toy', mover: 'toy', domino: 'toy' }),
    words: [['Brick', 'Block', 'Teddy', 'Robot', 'Puzzle', 'Marble', 'Yo-yo', 'Kite', 'Rubber', 'Plastic', 'Wind-up', 'Jigsaw'], ['Box', 'Run', 'Tower', 'Stack', 'Rush', 'Hop', 'Track', 'Ramp', 'Dash', 'Party']],
    theme: { skyTop: '#4a8aff', skyBottom: '#ffe08a', mount: [0xff5a5a, 0x4ac85a, 0xffc83a], water: 0x5ab8ff, waterDeep: 0x3a98e0, fog: 0xc8e0ff, ui: '#ff5a5a', deco: ['toyblock', 'toyblock', 'cone'], cloud: 0xffffff },
    starsReq: 270,
  },
  {
    id: 'neon', name: 'Neon Grid', sub: 'Glowing lines in a synthwave night.', ...base('science', 'neon', { pillar: 'neon', plank: 'metal', mover: 'neon', crate: 'labcrate' }),
    words: [['Neon', 'Synth', 'Retro', 'Pixel', 'Laser', 'Arcade', 'Volt', 'Cyber', 'Glitch', 'Turbo', 'Chrome', 'Disco'], ['Grid', 'Run', 'Wave', 'Drive', 'Loop', 'Rush', 'Beat', 'Dash', 'Line', 'Pulse']],
    theme: { skyTop: '#140430', skyBottom: '#ff3fa0', mount: [0x3a0a6a, 0x2a0850, 0x5a1490], water: 0x1a0a3a, waterDeep: 0x0f0628, fog: 0x6a1a7a, ui: '#d02ae0', deco: ['neonpost', 'crystal', 'neonpost'], cloud: 0xff7ad0, stars: true },
    starsReq: 300,
  },
  {
    id: 'sky', name: 'Sky Islands', sub: 'Floating islands above the clouds.', ...base('classic', 'cloudgrass'),
    words: [['Cloud', 'Sky', 'Feather', 'Breezy', 'Heaven', 'Rainbow', 'Soaring', 'Airy', 'Nimbus', 'Zephyr', 'Sunbeam', 'Halo'], ['Isles', 'Hop', 'Leap', 'Drift', 'Glide', 'Run', 'Jump', 'Float', 'Dash', 'Way']],
    theme: { skyTop: '#5ab0ff', skyBottom: '#ffffff', mount: [0xffffff, 0xe8f4ff, 0xd8ecff], water: 0xeaf6ff, waterDeep: 0xd0e8ff, fog: 0xeaf6ff, ui: '#3a9aff', deco: ['tree', 'cloudpuff', 'bush'], cloud: 0xffffff },
    starsReq: 330,
  },
];
