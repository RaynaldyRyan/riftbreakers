// RIFTBREAKERS — entity factories and enemy behavior.
// Player, enemies, bullets, particles, shards, floaters, lasers and the boss.

import { ENEMY_TYPES, BOSS, ARENA_CX, ARENA_CY, ARENA_R, clamp, dist } from './config.js';

export function makePlayer() {
  return {
    x: ARENA_CX, y: ARENA_CY + 60, vx: 0, vy: 0, radius: 17,
    hp: 100, maxHp: 100, speed: 265, fireTimer: 0, fireRate: 7.5,
    aimX: 1, aimY: 0, dashTimer: 0, dashCd: 0, overcharge: 0,
    invuln: 0, shards: 0, level: 1, xp: 0, xpNext: 12,
    kills: 0, combo: 1, comboTimer: 0, maxCombo: 1,
    relics: [], cooldowns: { nova: 0, dash: 0, overcharge: 0, bomb: 0 },
    afterimages: [],
  };
}

export function makeEnemy(type, x, y) {
  const def = ENEMY_TYPES[type];
  return {
    type, x, y, vx: 0, vy: 0, radius: def.radius,
    hp: def.hp, maxHp: def.hp, speed: def.speed, score: def.score,
    shootTimer: 1 + Math.random() * 1.5, chargeState: 'idle', chargeTimer: 0,
    teleportTimer: 2 + Math.random() * 2, flash: 0, wobble: Math.random() * Math.PI * 2,
    pullX: 0, pullY: 0,
  };
}

export function makeBoss() {
  return {
    x: ARENA_CX, y: ARENA_CY - 150, radius: BOSS.radius,
    hp: BOSS.hp, maxHp: BOSS.hp, phase: 0, phaseTimer: 0,
    shootTimer: 1.2, summonTimer: 6, slamTimer: 4, laserAngle: 0,
    laserTimer: 3, missileTimer: 2.5, flash: 0, drift: 0,
    tentacles: [0, 1, 2, 3].map((i) => ({ angle: (i / 4) * Math.PI * 2, len: 120, phase: i * 1.3 })),
  };
}

export function makeBullet(x, y, vx, vy, friendly, pierce) {
  return { x, y, vx, vy, friendly, pierce: pierce || 0, hitSet: new Set(), life: 2.2, radius: friendly ? 5 : 6 };
}

export function makeParticle(x, y, vx, vy, life, size, color) {
  return { x, y, vx, vy, life, maxLife: life, size, color };
}

export function makeShard(x, y) {
  const a = Math.random() * Math.PI * 2;
  return { x, y, vx: Math.cos(a) * 60, vy: Math.sin(a) * 60, life: 9, magnet: false };
}

export function makeFloater(x, y, text, color) {
  return { x, y, text, color: color || '#ffd166', life: 1.1 };
}

export function makeLaser(x, y, angle, length, width, life) {
  return { x, y, angle, length, width, life, maxLife: life };
}

export function makeDangerCircle(x, y, radius, life) {
  return { x, y, radius, life, maxLife: life };
}

// Enemy AI: steer each enemy by its behavior tag. Returns 'shoot' intents via out.
export function updateEnemy(e, p, dt, t, out) {
  const dx = p.x - e.x, dy = p.y - e.y;
  const d = Math.max(1, dist(e.x, e.y, p.x, p.y));
  const nx = dx / d, ny = dy / d;
  e.flash = Math.max(0, e.flash - dt);
  e.wobble += dt * 3;
  // Singularity Lens pull decays.
  e.x += e.pullX * dt; e.y += e.pullY * dt;
  e.pullX *= 0.86; e.pullY *= 0.86;

  if (e.type === 'crawler') {
    e.x += nx * e.speed * dt; e.y += ny * e.speed * dt;
  } else if (e.type === 'archer') {
    // Keep distance, strafe, fire aimed arrows.
    const want = 260;
    const radial = d > want + 30 ? 1 : d < want - 30 ? -1 : 0;
    const strafe = Math.sin(e.wobble) * 0.7;
    e.x += (nx * radial + -ny * strafe) * e.speed * dt;
    e.y += (ny * radial + nx * strafe) * e.speed * dt;
    e.shootTimer -= dt;
    if (e.shootTimer <= 0 && d < 520) {
      e.shootTimer = 2.2 + Math.random() * 0.8;
      out.push({ kind: 'enemyShot', x: e.x, y: e.y, vx: nx * 300, vy: ny * 300 });
    }
  } else if (e.type === 'brute') {
    if (e.chargeState === 'idle') {
      e.x += nx * e.speed * dt; e.y += ny * e.speed * dt;
      e.chargeTimer += dt;
      if (e.chargeTimer > 2.4 && d < 420) { e.chargeState = 'windup'; e.chargeTimer = 0; out.push({ kind: 'danger', x: p.x, y: p.y, radius: 46, life: 0.6 }); }
    } else if (e.chargeState === 'windup') {
      e.chargeTimer += dt;
      if (e.chargeTimer > 0.6) { e.chargeState = 'charging'; e.chargeTimer = 0; e.vx = nx * 520; e.vy = ny * 520; }
    } else {
      e.x += e.vx * dt; e.y += e.vy * dt;
      e.chargeTimer += dt;
      if (e.chargeTimer > 0.55) { e.chargeState = 'idle'; e.chargeTimer = 0; }
    }
  } else if (e.type === 'drone') {
    // Orbit the player and shoot.
    const orbit = 230;
    const tx = p.x + Math.cos(e.wobble * 0.6) * orbit;
    const ty = p.y + Math.sin(e.wobble * 0.6) * orbit;
    e.x += (tx - e.x) * Math.min(1, dt * 2.2);
    e.y += (ty - e.y) * Math.min(1, dt * 2.2);
    e.shootTimer -= dt;
    if (e.shootTimer <= 0 && d < 480) {
      e.shootTimer = 2.6 + Math.random();
      out.push({ kind: 'enemyShot', x: e.x, y: e.y, vx: nx * 260, vy: ny * 260 });
    }
  } else if (e.type === 'stalker') {
    e.teleportTimer -= dt;
    if (e.teleportTimer <= 0) {
      e.teleportTimer = 3 + Math.random() * 2;
      out.push({ kind: 'teleport', e, x: p.x - p.aimX * 70, y: p.y - p.aimY * 70 });
    } else {
      e.x += nx * e.speed * dt; e.y += ny * e.speed * dt;
    }
  } else if (e.type === 'guardian') {
    e.x += nx * e.speed * dt; e.y += ny * e.speed * dt;
    e.shootTimer -= dt;
    if (e.shootTimer <= 0 && d < 560) {
      e.shootTimer = 1.8;
      for (let i = -1; i <= 1; i++) {
        const a = Math.atan2(ny, nx) + i * 0.28;
        out.push({ kind: 'enemyShot', x: e.x, y: e.y, vx: Math.cos(a) * 280, vy: Math.sin(a) * 280 });
      }
    }
  }
  // Keep enemies inside the arena circle.
  const cd = dist(e.x, e.y, ARENA_CX, ARENA_CY);
  const maxD = ARENA_R - e.radius;
  if (cd > maxD) {
    const s = maxD / cd;
    e.x = ARENA_CX + (e.x - ARENA_CX) * s;
    e.y = ARENA_CY + (e.y - ARENA_CY) * s;
  }
  e.x = clamp(e.x, ARENA_CX - ARENA_R, ARENA_CX + ARENA_R);
  e.y = clamp(e.y, ARENA_CY - ARENA_R, ARENA_CY + ARENA_R);
}
