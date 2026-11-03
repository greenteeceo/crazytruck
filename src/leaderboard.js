// Trophy leaderboard with simulated players.
// There is no game server, so the other 99 players are bots whose trophy counts grow over
// real time: each bot has a starting total and a daily win rate, plays on some days and not
// others, and its total is a pure function of (seed, bot, time). The same device always sees
// the same board, it moves while the player is away, and the player can climb it by winning.

const DAY = 86400000;
export const BOARD_SIZE = 100;

// small integer hash -> [0, 1)
function hash(...n) {
  let h = 2166136261 >>> 0;
  for (const v of n) { h ^= v >>> 0; h = Math.imul(h, 16777619) >>> 0; h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995) >>> 0; h ^= h >>> 15; }
  return (h >>> 0) / 4294967296;
}

const FIRST = ['Turbo', 'Mud', 'Crazy', 'Rocket', 'Dusty', 'Nitro', 'Lucky', 'Big', 'Tiny', 'Wild', 'Rusty', 'Super', 'Mega', 'Hyper', 'Iron', 'Gravel', 'Speedy', 'Jumpy', 'Bumpy', 'Flip', 'Boom', 'Dizzy', 'Mighty', 'Sneaky', 'Wobbly', 'Zoom', 'Sunny', 'Frosty', 'Lava', 'Pixel'];
const LAST = ['Truck', 'Rider', 'Wheels', 'Crane', 'Driver', 'King', 'Queen', 'Boss', 'Fox', 'Bear', 'Tiger', 'Hawk', 'Kid', 'Pro', 'Racer', 'Jack', 'Max', 'Ace', 'Dash', 'Bolt', 'Hook', 'Gear', 'Tank', 'Monster'];
const PEOPLE = ['Minh', 'Linh', 'Tuan', 'An', 'Huy', 'Mai', 'Leo', 'Mia', 'Lucas', 'Sofia', 'Kenji', 'Ana', 'Omar', 'Lena', 'Noah', 'Yuki', 'Ivan', 'Chloe', 'Diego', 'Aisha', 'Ben', 'Zoe', 'Ravi', 'Emma'];
const COLORS = ['#ff6b74', '#ff8a1f', '#ffc61a', '#46d35c', '#2ee6c8', '#4aa8ff', '#7f96ff', '#c6a8ff', '#ff7fd0', '#a0e05a'];

function makeName(seed, i, used) {
  for (let k = 0; ; k++) {
    const r = (j) => hash(seed, i, k, j);
    let n;
    if (r(1) < 0.4) n = PEOPLE[(r(2) * PEOPLE.length) | 0] + (r(3) < 0.5 ? '_' : '') + (((r(4) * 98) | 0) + 1);
    else n = FIRST[(r(2) * FIRST.length) | 0] + LAST[(r(3) * LAST.length) | 0] + (r(4) < 0.35 ? String((r(5) * 99) | 0) : '');
    if (!used.has(n)) { used.add(n); return n; }
  }
}

let cache = null;
function bots(seed) {
  if (cache?.seed === seed) return cache.list;
  const used = new Set(), list = [];
  for (let i = 0; i < BOARD_SIZE - 1; i++) {
    const z = i / (BOARD_SIZE - 2);           // 0 = strongest, 1 = newest
    const a = hash(seed, i, 101), b = hash(seed, i, 202);
    const base = z > 0.85 ? 0 : Math.round(420 * Math.pow(1 - z, 2.4) * (0.75 + 0.5 * a));
    const rate = z > 0.85 ? 0.15 + 0.6 * b : 0.4 + 11 * Math.pow(1 - z, 1.6) * (0.6 + 0.8 * b);   // 1st places per active day
    const active = 0.45 + 0.45 * hash(seed, i, 303);   // share of days the bot plays
    list.push({ i, name: makeName(seed, i, used), color: COLORS[(hash(seed, i, 404) * COLORS.length) | 0], base, rate, active });
  }
  cache = { seed, list };
  return list;
}

function botTrophies(seed, b, days) {
  let t = b.base;
  const full = Math.floor(days);
  for (let d = 0; d <= full; d++) {
    if (hash(seed, b.i, d, 7) > b.active) continue;
    const today = b.rate * (0.3 + 1.4 * hash(seed, b.i, d, 9));
    t += d < full ? today : today * (days - full);
  }
  return Math.floor(t);
}

// Full board, best first. `me` = { name, trophies }. Ties: whoever got there first (the bot) stays ahead.
export function board(seed, start, me, now = Date.now()) {
  const days = Math.max(0, (now - start) / DAY);
  const rows = bots(seed).map((b) => ({ name: b.name, color: b.color, trophies: botTrophies(seed, b, days) }));
  rows.push({ name: me.name, color: '#ffe14d', trophies: me.trophies, me: true });
  rows.sort((x, y) => y.trophies - x.trophies || (x.me ? 1 : y.me ? -1 : 0));
  rows.forEach((r, k) => { r.rank = k + 1; });
  return rows;
}

export const rankOf = (rows) => rows.find((r) => r.me).rank;
