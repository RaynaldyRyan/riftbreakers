// RIFTBREAKERS — relic upgrades: choice offers and combat effects.
// Relics stack; each one visibly changes how the mech fights.

import { RELICS } from './config.js';

export function hasRelic(player, id) {
  return player.relics.includes(id);
}

// Offer 3 random relics the player does not own yet (or repeats as +shards).
export function rollRelicOffer(player, rng) {
  const pool = RELICS.filter((r) => !player.relics.includes(r.id));
  const shuffled = pool.slice();
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor((rng || Math.random)() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const offer = shuffled.slice(0, 3);
  while (offer.length < 3) offer.push({ id: 'shards', name: 'Energy Cache', desc: '+500 score and +25 HP', icon: '◆' });
  return offer;
}

export function applyRelic(player, relic) {
  if (relic.id === 'shards') { player.hp = Math.min(player.maxHp, player.hp + 25); return 500; }
  player.relics.push(relic.id);
  return 0;
}

export function fireRateOf(player) {
  let rate = player.fireRate;
  if (hasRelic(player, 'overdrive')) rate *= 1.6;
  if (player.overcharge > 0) rate *= 3;
  return rate;
}

export function pierceOf(player) {
  return hasRelic(player, 'piercer') ? 5 : 0;
}

// Thunder Core: chain lightning from a hit enemy to nearby enemies.
export function chainLightning(state, fromEnemy, damage) {
  const chains = [];
  let current = fromEnemy;
  const hit = new Set([fromEnemy]);
  for (let i = 0; i < 3; i++) {
    let best = null, bestD = 170;
    for (const e of state.enemies) {
      if (hit.has(e)) continue;
      const d = Math.hypot(e.x - current.x, e.y - current.y);
      if (d < bestD) { bestD = d; best = e; }
    }
    if (!best) break;
    hit.add(best);
    chains.push({ x1: current.x, y1: current.y, x2: best.x, y2: best.y, life: 0.18 });
    best.hp -= damage;
    best.flash = 0.12;
    current = best;
  }
  return chains;
}

// Singularity Lens: pull enemies toward a bullet impact point.
export function singularityPull(state, x, y, strength) {
  for (const e of state.enemies) {
    const d = Math.hypot(e.x - x, e.y - y);
    if (d < 190 && d > 1) {
      e.pullX += ((x - e.x) / d) * strength;
      e.pullY += ((y - e.y) / d) * strength;
    }
  }
}

// Phantom Engine: dash leaves explosive clones behind.
export function phantomClones(player) {
  return player.afterimages.slice(0, 3).map((a) => ({ x: a.x, y: a.y, life: 0.5, radius: 70 }));
}

export function relicDef(id) {
  return RELICS.find((r) => r.id === id);
}
