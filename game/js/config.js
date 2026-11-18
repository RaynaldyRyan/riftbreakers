// RIFTBREAKERS — tuning, enemy types, relics, waves and palette.
// All numbers come from the design spec (the user's own concept).

export const VIEW_W = 1240;
export const VIEW_H = 860;
export const ARENA = { x: 170, y: 108, w: 900, h: 560 }; // circular arena bounds (play field)
export const ARENA_CX = ARENA.x + ARENA.w / 2;
export const ARENA_CY = ARENA.y + ARENA.h / 2;
export const ARENA_R = 272;

export const PALETTE = {
  bg: '#070412',
  panel: '#120a26',
  panelEdge: '#3b1d6e',
  purple: '#b026ff',
  violet: '#7c3aed',
  blue: '#22d3ee',
  cyan: '#67e8f9',
  red: '#ff2b4e',
  crimson: '#e11d48',
  gold: '#ffd166',
  green: '#4ade80',
  white: '#f4f1ff',
  dim: '#9d8fc9',
};

export const BEST_SCORE = 250000;

// Enemy types: name, hp, speed, radius, score, color, behavior tag.
export const ENEMY_TYPES = {
  crawler: { name: 'Void Crawler', hp: 18, speed: 145, radius: 15, score: 100, color: '#c084fc', behavior: 'chase', desc: 'Fast melee attackers' },
  archer: { name: 'Rift Archer', hp: 26, speed: 95, radius: 16, score: 150, color: '#22d3ee', behavior: 'shoot', desc: 'Fire aimed energy arrows' },
  brute: { name: 'Iron Brute', hp: 120, speed: 62, radius: 26, score: 300, color: '#f97316', behavior: 'charge', desc: 'Heavy armored chargers' },
  drone: { name: 'Phantom Drone', hp: 22, speed: 120, radius: 13, score: 175, color: '#f472b6', behavior: 'strafe', desc: 'Flying projectile shooters' },
  stalker: { name: 'Void Stalker', hp: 45, speed: 110, radius: 17, score: 250, color: '#a78bfa', behavior: 'teleport', desc: 'Teleport behind the player' },
  guardian: { name: 'Rift Guardian', hp: 320, speed: 55, radius: 34, score: 800, color: '#ffd166', behavior: 'guardian', desc: 'Elite mini-bosses' },
};

// Total roster counts shown in the HUD (spec section 2).
export const ROSTER_TOTALS = { crawler: 35, archer: 20, brute: 12, drone: 18, stalker: 8, guardian: 3 };

// Wave compositions (waves 1-9; wave 10 is the Vorakh boss fight).
export const WAVES = [
  { crawler: 8 },
  { crawler: 10, archer: 3 },
  { crawler: 12, archer: 5, drone: 3 },
  { crawler: 10, archer: 6, drone: 5, brute: 2 },
  { crawler: 12, archer: 6, drone: 6, brute: 3, stalker: 2 },
  { crawler: 14, archer: 8, drone: 7, brute: 4, stalker: 3, guardian: 1 },
  { crawler: 12, archer: 8, drone: 8, brute: 5, stalker: 4, guardian: 1 },
  { crawler: 14, archer: 10, drone: 9, brute: 6, stalker: 4, guardian: 1 },
  { crawler: 16, archer: 10, drone: 10, brute: 6, stalker: 5, guardian: 2 },
  { boss: true },
];

export const RELICS = [
  { id: 'thunder', name: 'Thunder Core', desc: 'Bullets chain lightning between enemies', icon: '⚡' },
  { id: 'phantom', name: 'Phantom Engine', desc: 'Dash releases three explosive clones', icon: '👻' },
  { id: 'blood', name: 'Blood Protocol', desc: 'Restore 3% HP per 10 kills', icon: '♥' },
  { id: 'singularity', name: 'Singularity Lens', desc: 'Bullets pull enemies toward impact', icon: '◎' },
  { id: 'overdrive', name: 'Overdrive Reactor', desc: 'Increase fire rate by 60%', icon: '🔥' },
  { id: 'piercer', name: 'Void Piercer', desc: 'Projectiles penetrate 5 enemies', icon: '➶' },
];

export const ABILITIES = {
  nova: { key: 'Q', name: 'NOVA BLAST', desc: 'Radial explosion', cooldown: 14 },
  dash: { key: 'E', name: 'PHASE DASH', desc: 'Teleport dash', cooldown: 5 },
  overcharge: { key: 'R', name: 'OVERCHARGE', desc: '3x fire rate, 5s', cooldown: 18 },
  bomb: { key: 'SPACE', name: 'VOID BOMB', desc: 'Huge area damage', cooldown: 22 },
};

export const BOSS = {
  name: 'VORAKH',
  title: 'THE VOID SOVEREIGN',
  hp: 4200,
  radius: 92,
  phases: [
    { name: 'THE AWAKENING', from: 1.0, to: 0.7, event: 'THE SOVEREIGN HAS AWAKENED!' },
    { name: 'RIFT ANNIHILATION', from: 0.7, to: 0.35, event: 'REALITY IS BREAKING!' },
    { name: 'TOTAL COLLAPSE', from: 0.35, to: 0, event: 'FINAL PROTOCOL: EXTINCTION!' },
  ],
};

// Seeded PRNG (mulberry32) for deterministic screenshot staging.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
export function dist(ax, ay, bx, by) { const dx = bx - ax, dy = by - ay; return Math.sqrt(dx * dx + dy * dy); }
export function fmt(n) { return n.toLocaleString('en-US'); }
