// RIFTBREAKERS — game loop, input, combat, waves, boss AI and shot staging.
// The player mech fights 10 waves in a circular arena; wave 10 is VORAKH.

import { VIEW_W, VIEW_H, ARENA_CX, ARENA_CY, ARENA_R, PALETTE, ENEMY_TYPES, ROSTER_TOTALS, WAVES, ABILITIES, BOSS, BEST_SCORE, mulberry32, clamp, dist, fmt } from './config.js';
import { makePlayer, makeEnemy, makeBoss, makeBullet, makeParticle, makeShard, makeFloater, makeLaser, makeDangerCircle, updateEnemy } from './entities.js';
import { hasRelic, rollRelicOffer, applyRelic, fireRateOf, pierceOf, chainLightning, singularityPull, phantomClones } from './relics.js';
import { drawArena, drawPlayer, drawEnemy, drawBoss, drawBullets, drawParticles, drawShards, drawFloaters, drawLasers, drawDangerCircles, drawChains, drawHUD, drawLevelUp, drawTitle, drawHowTo, drawVictory, drawDefeat, drawPaused } from './render.js';
import { ensureAudio, setMuted, isMuted, sfx } from './audio.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

function loadBest() {
  try { const v = parseInt(localStorage.getItem('riftbreakers_best') || '0', 10); return Math.max(BEST_SCORE, v || 0); }
  catch (e) { return BEST_SCORE; }
}
function saveBest(v) {
  try { localStorage.setItem('riftbreakers_best', String(v)); } catch (e) { /* storage unavailable */ }
}

const state = {
  screen: 'title',
  player: makePlayer(),
  enemies: [], bullets: [], ebullets: [], particles: [], shards: [],
  floaters: [], lasers: [], dangers: [], chains: [], clones: [],
  boss: null, wave: 0, score: 0, best: loadBest(),
  time: 0, timeText: '00:00', spawnQueue: [], spawnTimer: 0,
  wavePause: 0, banner: null, relicOffer: null,
  enemiesRemaining: 0, rosterLeft: { ...ROSTER_TOTALS },
  shake: 0, flash: 0, over: false, shotMode: null, t: 0,
};

const keys = {};
const mouse = { x: VIEW_W / 2, y: VIEW_H / 2, down: false };

function setBanner(text, sub, color, life) {
  state.banner = { text, sub: sub || '', color: color || PALETTE.gold, life: life || 2.4, maxLife: life || 2.4 };
}

function burst(x, y, color, n, speed) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = (0.3 + Math.random() * 0.7) * (speed || 220);
    state.particles.push(makeParticle(x, y, Math.cos(a) * s, Math.sin(a) * s, 0.4 + Math.random() * 0.5, 2 + Math.random() * 3.5, color));
  }
}

function startGame() {
  state.player = makePlayer();
  state.enemies = []; state.bullets = []; state.ebullets = [];
  state.particles = []; state.shards = []; state.floaters = [];
  state.lasers = []; state.dangers = []; state.chains = []; state.clones = [];
  state.boss = null; state.wave = 0; state.score = 0;
  state.time = 0; state.timeText = '00:00';
  state.rosterLeft = { ...ROSTER_TOTALS };
  state.screen = 'playing';
  nextWave();
  setBanner('WAVE 1', 'The rift is opening — hold the line!', PALETTE.cyan, 2.2);
}

function nextWave() {
  state.wave++;
  if (state.wave > 10) return;
  const comp = WAVES[state.wave - 1];
  state.spawnQueue = [];
  if (comp.boss) {
    state.boss = makeBoss();
    setBanner('VORAKH — THE VOID SOVEREIGN', 'THE SOVEREIGN HAS AWAKENED!', PALETTE.red, 3);
    sfx.bossRoar();
    state.enemiesRemaining = 1;
    return;
  }
  for (const [type, n] of Object.entries(comp)) {
    for (let i = 0; i < n; i++) state.spawnQueue.push(type);
  }
  // Shuffle the queue.
  for (let i = state.spawnQueue.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [state.spawnQueue[i], state.spawnQueue[j]] = [state.spawnQueue[j], state.spawnQueue[i]];
  }
  state.spawnTimer = 0.5;
  state.enemiesRemaining = state.spawnQueue.length;
}

function spawnFromQueue(dt) {
  if (!state.spawnQueue.length) return;
  state.spawnTimer -= dt;
  if (state.spawnTimer > 0) return;
  state.spawnTimer = 0.45;
  const type = state.spawnQueue.shift();
  const a = Math.random() * Math.PI * 2;
  const d = ARENA_R - 30;
  state.enemies.push(makeEnemy(type, ARENA_CX + Math.cos(a) * d, ARENA_CY + Math.sin(a) * d));
}

function damageEnemy(e, dmg, kx, ky) {
  e.hp -= dmg;
  e.flash = 0.1;
  if (kx || ky) { e.pullX += (kx || 0) * 30; e.pullY += (ky || 0) * 30; }
  if (e.hp <= 0) killEnemy(e);
}

function killEnemy(e) {
  const p = state.player;
  const idx = state.enemies.indexOf(e);
  if (idx >= 0) state.enemies.splice(idx, 1);
  p.kills++;
  p.combo = Math.min(99, p.combo + 1);
  p.comboTimer = 2.5;
  p.maxCombo = Math.max(p.maxCombo, p.combo);
  const gained = e.score * p.combo;
  state.score += gained;
  state.floaters.push(makeFloater(e.x, e.y - 20, `+${fmt(gained)}`, '#ffd166'));
  burst(e.x, e.y, ENEMY_TYPES[e.type].color, 16, 260);
  sfx.explode();
  if (e.type === 'guardian') { state.shake = Math.max(state.shake, 10); burst(e.x, e.y, '#ffd166', 24, 320); }
  // Shards.
  const nShards = e.type === 'guardian' ? 6 : e.type === 'brute' ? 3 : 2;
  for (let i = 0; i < nShards; i++) state.shards.push(makeShard(e.x, e.y));
  // Blood Protocol: heal every 10 kills.
  if (hasRelic(p, 'blood') && p.kills % 10 === 0) {
    p.hp = Math.min(p.maxHp, p.hp + 3);
    state.floaters.push(makeFloater(p.x, p.y - 30, '+3 HP', '#4ade80'));
  }
  if (p.combo === 25) setBanner('UNSTOPPABLE! 25 KILL STREAK!', '', PALETTE.gold, 2);
  state.rosterLeft[e.type] = Math.max(0, (state.rosterLeft[e.type] ?? 0) - 1);
}

function damagePlayer(dmg) {
  const p = state.player;
  if (p.invuln > 0 || state.screen !== 'playing') return;
  p.hp -= dmg;
  p.invuln = 0.5;
  p.combo = 1;
  state.shake = Math.max(state.shake, 8);
  state.flash = 0.25;
  burst(p.x, p.y, '#ff2b4e', 12, 240);
  sfx.hurt();
  if (p.hp <= 0) {
    p.hp = 0;
    state.screen = 'defeat';
    state.best = Math.max(state.best, state.score);
    saveBest(state.best);
    burst(p.x, p.y, '#ff2b4e', 60, 380);
    sfx.lose();
  }
}

function firePlayerBullet() {
  const p = state.player;
  const rate = fireRateOf(p);
  const spread = hasRelic(p, 'thunder') ? 0.06 : 0;
  const n = p.overcharge > 0 ? 3 : 1;
  for (let i = 0; i < n; i++) {
    const a = Math.atan2(p.aimY, p.aimX) + (i - (n - 1) / 2) * 0.14 + (Math.random() - 0.5) * spread;
    state.bullets.push(makeBullet(p.x + Math.cos(a) * 22, p.y + Math.sin(a) * 22, Math.cos(a) * 640, Math.sin(a) * 640, true, pierceOf(p)));
  }
  sfx.shoot();
}

function useAbility(id) {
  const p = state.player;
  if (state.screen !== 'playing' || p.cooldowns[id] > 0) return;
  const def = ABILITIES[id];
  p.cooldowns[id] = def.cooldown;
  if (id === 'nova') {
    sfx.ability();
    state.shake = Math.max(state.shake, 12);
    burst(p.x, p.y, '#b026ff', 40, 420);
    for (const e of [...state.enemies]) {
      if (dist(e.x, e.y, p.x, p.y) < 280) damageEnemy(e, 90, 0, 0);
    }
    if (state.boss && dist(state.boss.x, state.boss.y, p.x, p.y) < 340) damageBoss(60);
    state.floaters.push(makeFloater(p.x, p.y - 40, 'NOVA BLAST!', '#b026ff'));
  } else if (id === 'dash') {
    sfx.dash();
    const dx = (keys['KeyD'] ? 1 : 0) - (keys['KeyA'] ? 1 : 0);
    const dy = (keys['KeyS'] ? 1 : 0) - (keys['KeyW'] ? 1 : 0);
    let mx = dx, my = dy;
    if (!mx && !my) { mx = p.aimX; my = p.aimY; }
    const m = Math.hypot(mx, my) || 1;
    for (let i = 1; i <= 4; i++) {
      p.afterimages.push({ x: p.x + (mx / m) * 36 * i, y: p.y + (my / m) * 36 * i, angle: Math.atan2(p.aimY, p.aimX), life: 0.5 });
    }
    p.x = clamp(p.x + (mx / m) * 150, ARENA_CX - ARENA_R + 20, ARENA_CX + ARENA_R - 20);
    p.y = clamp(p.y + (my / m) * 150, ARENA_CY - ARENA_R + 20, ARENA_CY + ARENA_R - 20);
    p.invuln = Math.max(p.invuln, 0.3);
    if (hasRelic(p, 'phantom')) {
      for (const c of phantomClones(p)) state.clones.push(c);
    }
  } else if (id === 'overcharge') {
    sfx.ability();
    p.overcharge = 5;
    state.floaters.push(makeFloater(p.x, p.y - 40, 'OVERCHARGE!', '#facc15'));
  } else if (id === 'bomb') {
    sfx.bigExplode();
    state.shake = Math.max(state.shake, 16);
    state.flash = 0.3;
    burst(p.x, p.y, '#22d3ee', 60, 520);
    for (const e of [...state.enemies]) {
      if (dist(e.x, e.y, p.x, p.y) < 420) damageEnemy(e, 160, 0, 0);
    }
    if (state.boss && dist(state.boss.x, state.boss.y, p.x, p.y) < 460) damageBoss(120);
    state.ebullets = state.ebullets.filter((b) => dist(b.x, b.y, p.x, p.y) > 420);
    state.floaters.push(makeFloater(p.x, p.y - 40, 'VOID BOMB!', '#22d3ee'));
  }
}

function damageBoss(dmg) {
  const b = state.boss;
  if (!b) return;
  b.hp -= dmg;
  b.flash = 0.1;
  const frac = b.hp / b.maxHp;
  const newPhase = frac > 0.7 ? 0 : frac > 0.35 ? 1 : 2;
  if (newPhase !== b.phase) {
    b.phase = newPhase;
    setBanner(BOSS.phases[newPhase].event, `PHASE ${newPhase + 1}/3 — ${BOSS.phases[newPhase].name}`, PALETTE.red, 2.6);
    sfx.bossRoar();
    state.shake = Math.max(state.shake, 12);
  }
  if (b.hp <= 0) {
    b.hp = 0;
    state.score += 5000 * state.player.combo;
    state.boss = null;
    state.screen = 'victory';
    state.best = Math.max(state.best, state.score);
    saveBest(state.best);
    burst(ARENA_CX, ARENA_CY - 150, '#ffd166', 90, 480);
    burst(ARENA_CX, ARENA_CY - 150, '#ff2b4e', 60, 420);
    setBanner('VOID SOVEREIGN DESTROYED!', '', PALETTE.gold, 2);
    sfx.win();
  }
}

function bossAttacks(b, dt) {
  const p = state.player;
  b.phaseTimer += dt;
  b.shootTimer -= dt;
  b.summonTimer -= dt;
  b.slamTimer -= dt;
  b.missileTimer -= dt;
  const dx = p.x - b.x, dy = p.y - b.y;
  const d = Math.max(1, Math.hypot(dx, dy));
  // Drift slowly toward the arena center-top.
  b.drift += dt;
  b.x = ARENA_CX + Math.sin(b.drift * 0.4) * 90;
  b.y = ARENA_CY - 150 + Math.sin(b.drift * 0.6) * 30;
  if (b.shootTimer <= 0) {
    b.shootTimer = b.phase === 2 ? 1.0 : b.phase === 1 ? 1.4 : 1.8;
    const n = b.phase === 2 ? 14 : b.phase === 1 ? 10 : 8;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + b.phaseTimer;
      state.ebullets.push(makeBullet(b.x, b.y + 20, Math.cos(a) * 200, Math.sin(a) * 200, false, 0));
    }
    sfx.shoot();
  }
  if (b.summonTimer <= 0) {
    b.summonTimer = b.phase === 2 ? 7 : 9;
    const type = b.phase === 2 ? 'guardian' : b.phase === 1 ? 'drone' : 'crawler';
    const n = b.phase === 2 ? 1 : 3;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      state.enemies.push(makeEnemy(type, b.x + Math.cos(a) * 140, b.y + Math.sin(a) * 140));
    }
    state.enemiesRemaining += n;
  }
  if (b.slamTimer <= 0) {
    b.slamTimer = 4.5;
    state.dangers.push(makeDangerCircle(p.x, p.y, 70, 0.9));
  }
  if (b.phase >= 1) {
    b.laserTimer -= dt;
    if (b.laserTimer <= 0) {
      b.laserTimer = b.phase === 2 ? 2.2 : 3.2;
      const nLasers = b.phase === 2 ? 2 : 1;
      for (let i = 0; i < nLasers; i++) {
        const a = Math.atan2(dy, dx) + (i - (nLasers - 1) / 2) * 0.5;
        state.lasers.push(makeLaser(b.x, b.y + 24, a, 700, 14, 0.9));
      }
    }
  }
  if (b.phase >= 1 && b.missileTimer <= 0) {
    b.missileTimer = b.phase === 2 ? 1.6 : 2.4;
    const m = makeBullet(b.x, b.y + 20, (dx / d) * 220, (dy / d) * 220, false, 0);
    m.homing = true;
    m.radius = 8;
    state.ebullets.push(m);
  }
}

function pointSegDist(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  const l2 = dx * dx + dy * dy || 1;
  let t = ((px - x1) * dx + (py - y1) * dy) / l2;
  t = clamp(t, 0, 1);
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

function update(dt) {
  const p = state.player;
  state.t += dt;
  if (state.screen !== 'playing') return;
  state.time += dt;
  const mm = String(Math.floor(state.time / 60)).padStart(2, '0');
  const ss = String(Math.floor(state.time % 60)).padStart(2, '0');
  state.timeText = `${mm}:${ss}`;
  if (state.banner) state.banner.life -= dt;
  state.shake = Math.max(0, state.shake - dt * 26);
  state.flash = Math.max(0, state.flash - dt * 1.4);

  // Movement.
  const mx = (keys['KeyD'] || keys['ArrowRight'] ? 1 : 0) - (keys['KeyA'] || keys['ArrowLeft'] ? 1 : 0);
  const my = (keys['KeyS'] || keys['ArrowDown'] ? 1 : 0) - (keys['KeyW'] || keys['ArrowUp'] ? 1 : 0);
  const ml = Math.hypot(mx, my) || 1;
  p.x += (mx / ml) * p.speed * dt * (mx || my ? 1 : 0);
  p.y += (my / ml) * p.speed * dt * (mx || my ? 1 : 0);
  const cd = dist(p.x, p.y, ARENA_CX, ARENA_CY);
  if (cd > ARENA_R - p.radius) {
    const s = (ARENA_R - p.radius) / cd;
    p.x = ARENA_CX + (p.x - ARENA_CX) * s;
    p.y = ARENA_CY + (p.y - ARENA_CY) * s;
  }
  // Aim.
  const ax = mouse.x - p.x, ay = mouse.y - p.y;
  const al = Math.hypot(ax, ay) || 1;
  p.aimX = ax / al; p.aimY = ay / al;
  // Timers.
  p.invuln = Math.max(0, p.invuln - dt);
  p.overcharge = Math.max(0, p.overcharge - dt);
  p.comboTimer -= dt;
  if (p.comboTimer <= 0) p.combo = 1;
  for (const k of Object.keys(p.cooldowns)) p.cooldowns[k] = Math.max(0, p.cooldowns[k] - dt);
  for (const a of p.afterimages) a.life -= dt * 2;
  p.afterimages = p.afterimages.filter((a) => a.life > 0);
  // Fire.
  p.fireTimer -= dt;
  if (mouse.down && p.fireTimer <= 0) {
    p.fireTimer = 1 / fireRateOf(p);
    firePlayerBullet();
  }
  // Spawning + waves.
  spawnFromQueue(dt);
  state.enemiesRemaining = state.spawnQueue.length + state.enemies.length + (state.boss ? 1 : 0);
  if (!state.spawnQueue.length && !state.enemies.length && !state.boss && state.wave > 0 && state.wave < 10) {
    state.wavePause += dt;
    if (state.wavePause > 1.6) {
      state.wavePause = 0;
      nextWave();
      if (state.wave <= 10) setBanner(`WAVE ${state.wave}`, state.wave === 10 ? 'VORAKH awaits…' : 'They keep coming!', PALETTE.cyan, 1.8);
    }
  } else state.wavePause = 0;
  // Enemies.
  const intents = [];
  for (const e of [...state.enemies]) updateEnemy(e, p, dt, state.t, intents);
  for (const it of intents) {
    if (it.kind === 'enemyShot') state.ebullets.push(makeBullet(it.x, it.y, it.vx, it.vy, false, 0));
    else if (it.kind === 'danger') state.dangers.push(makeDangerCircle(it.x, it.y, it.radius, it.life));
    else if (it.kind === 'teleport') {
      burst(it.e.x, it.e.y, '#a78bfa', 10, 160);
      it.e.x = clamp(it.x, ARENA_CX - ARENA_R + 20, ARENA_CX + ARENA_R - 20);
      it.e.y = clamp(it.y, ARENA_CY - ARENA_R + 20, ARENA_CY + ARENA_R - 20);
      burst(it.e.x, it.e.y, '#a78bfa', 10, 160);
    }
  }
  // Boss.
  if (state.boss) {
    state.boss.flash = Math.max(0, state.boss.flash - dt);
    bossAttacks(state.boss, dt);
  }
  // Bullets.
  for (const b of [...state.bullets]) {
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    if (b.life <= 0 || dist(b.x, b.y, ARENA_CX, ARENA_CY) > ARENA_R + 40) {
      state.bullets.splice(state.bullets.indexOf(b), 1);
      continue;
    }
    let consumed = false;
    for (const e of [...state.enemies]) {
      if (b.hitSet.has(e)) continue;
      if (dist(b.x, b.y, e.x, e.y) < e.radius + b.radius) {
        b.hitSet.add(e);
        damageEnemy(e, 12, b.vx / 640, b.vy / 640);
        burst(b.x, b.y, '#67e8f9', 4, 140);
        sfx.hit();
        if (hasRelic(p, 'thunder')) {
          for (const c of chainLightning(state, e, 10)) state.chains.push(c);
        }
        if (hasRelic(p, 'singularity')) singularityPull(state, b.x, b.y, 160);
        if (b.hitSet.size > b.pierce) { consumed = true; break; }
      }
    }
    if (!consumed && state.boss && dist(b.x, b.y, state.boss.x, state.boss.y) < state.boss.radius + b.radius) {
      damageBoss(12);
      burst(b.x, b.y, '#67e8f9', 4, 140);
      consumed = true;
    }
    if (consumed) state.bullets.splice(state.bullets.indexOf(b), 1);
  }
  // Enemy bullets (incl. homing missiles).
  for (const b of [...state.ebullets]) {
    if (b.homing) {
      const a = Math.atan2(p.y - b.y, p.x - b.x);
      const cur = Math.atan2(b.vy, b.vx);
      let diff = a - cur;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const na = cur + clamp(diff, -2.4 * dt, 2.4 * dt);
      const sp = Math.hypot(b.vx, b.vy);
      b.vx = Math.cos(na) * sp; b.vy = Math.sin(na) * sp;
    }
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    if (b.life <= 0 || dist(b.x, b.y, ARENA_CX, ARENA_CY) > ARENA_R + 60) {
      state.ebullets.splice(state.ebullets.indexOf(b), 1);
      continue;
    }
    if (dist(b.x, b.y, p.x, p.y) < p.radius + b.radius) {
      state.ebullets.splice(state.ebullets.indexOf(b), 1);
      damagePlayer(b.homing ? 14 : 9);
    }
  }
  // Contact damage.
  for (const e of [...state.enemies]) {
    if (dist(e.x, e.y, p.x, p.y) < e.radius + p.radius - 2) {
      damagePlayer(e.type === 'brute' ? 16 : e.type === 'guardian' ? 20 : 10);
      if (e.type !== 'guardian' && e.type !== 'brute') damageEnemy(e, 8, 0, 0);
    }
  }
  if (state.boss && dist(state.boss.x, state.boss.y, p.x, p.y) < state.boss.radius + p.radius) damagePlayer(18);
  // Lasers damage.
  for (const l of state.lasers) {
    const x2 = l.x + Math.cos(l.angle) * l.length, y2 = l.y + Math.sin(l.angle) * l.length;
    if (pointSegDist(p.x, p.y, l.x, l.y, x2, y2) < l.width / 2 + p.radius * 0.6) damagePlayer(12);
  }
  // Danger circles resolve.
  for (const c of [...state.dangers]) {
    c.life -= dt;
    if (c.life <= 0) {
      state.dangers.splice(state.dangers.indexOf(c), 1);
      burst(c.x, c.y, '#ff2b4e', 18, 300);
      if (dist(p.x, p.y, c.x, c.y) < c.radius) damagePlayer(18);
    }
  }
  // Phantom clones explode.
  for (const c of [...state.clones]) {
    c.life -= dt;
    if (c.life <= 0) {
      state.clones.splice(state.clones.indexOf(c), 1);
      burst(c.x, c.y, '#b026ff', 20, 320);
      for (const e of [...state.enemies]) {
        if (dist(e.x, e.y, c.x, c.y) < c.radius) damageEnemy(e, 70, 0, 0);
      }
    }
  }
  // Shards.
  for (const s of [...state.shards]) {
    s.life -= dt;
    const d = dist(s.x, s.y, p.x, p.y);
    if (d < 130) {
      s.x += ((p.x - s.x) / (d || 1)) * 340 * dt;
      s.y += ((p.y - s.y) / (d || 1)) * 340 * dt;
    } else {
      s.x += s.vx * dt; s.y += s.vy * dt;
      s.vx *= 0.92; s.vy *= 0.92;
    }
    if (d < p.radius + 10) {
      state.shards.splice(state.shards.indexOf(s), 1);
      p.shards++;
      p.xp++;
      state.score += 25;
      sfx.shard();
      if (p.xp >= p.xpNext) {
        p.xp -= p.xpNext;
        p.level++;
        p.xpNext = 12 + p.level * 6;
        state.relicOffer = rollRelicOffer(p);
        state.screen = 'levelup';
        sfx.levelup();
      }
    } else if (s.life <= 0) state.shards.splice(state.shards.indexOf(s), 1);
  }
  // Particles / floaters / lasers / chains.
  for (const pt of [...state.particles]) {
    pt.x += pt.vx * dt; pt.y += pt.vy * dt;
    pt.vx *= 0.94; pt.vy *= 0.94; pt.life -= dt;
    if (pt.life <= 0) state.particles.splice(state.particles.indexOf(pt), 1);
  }
  for (const f of [...state.floaters]) {
    f.life -= dt;
    if (f.life <= 0) state.floaters.splice(state.floaters.indexOf(f), 1);
  }
  for (const l of [...state.lasers]) {
    l.life -= dt;
    if (l.life <= 0) state.lasers.splice(state.lasers.indexOf(l), 1);
  }
  for (const c of [...state.chains]) {
    c.life -= dt;
    if (c.life <= 0) state.chains.splice(state.chains.indexOf(c), 1);
  }
}

function render() {
  ctx.save();
  if (state.shake > 0) {
    ctx.translate((Math.random() - 0.5) * state.shake, (Math.random() - 0.5) * state.shake);
  }
  const t = state.t;
  if (state.screen === 'title') { drawTitle(ctx, state, t); }
  else if (state.screen === 'howto') { drawHowTo(ctx); }
  else if (state.screen === 'victory') { drawVictory(ctx, state); }
  else if (state.screen === 'defeat') { drawDefeat(ctx, state); }
  else {
    drawArena(ctx, state, t);
    drawDangerCircles(ctx, state.dangers);
    drawShards(ctx, state.shards, t);
    if (state.boss) drawBoss(ctx, state.boss, t);
    for (const e of state.enemies) drawEnemy(ctx, e, t);
    drawPlayer(ctx, state.player, t);
    drawBullets(ctx, [...state.bullets, ...state.ebullets]);
    drawChains(ctx, state.chains);
    drawLasers(ctx, state.lasers);
    drawParticles(ctx, state.particles);
    drawFloaters(ctx, state.floaters);
    drawHUD(ctx, state);
    if (state.screen === 'levelup') drawLevelUp(ctx, state);
    if (state.screen === 'paused') drawPaused(ctx);
  }
  ctx.restore();
  if (state.flash > 0) {
    ctx.fillStyle = `rgba(255, 43, 78, ${state.flash * 0.5})`;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }
}

// ---------- deterministic shot staging ----------
function stageShot(scene, seed) {
  const rng = mulberry32(seed || 7);
  state.shotMode = scene;
  state.t = 1.2;
  if (scene === 'title') {
    state.screen = 'title';
    state.best = 250000;
    return;
  }
  if (scene === 'win') {
    state.screen = 'victory';
    state.score = 384750;
    state.best = 384750;
    state.timeText = '12:48';
    state.player.maxCombo = 89;
    state.player.kills = 347;
    return;
  }
  // Play + boss: build a frozen mid-action state.
  state.screen = 'playing';
  const p = state.player;
  p.relics = scene === 'boss' ? ['thunder', 'phantom', 'blood', 'singularity'] : ['thunder', 'phantom'];
  p.cooldowns = { nova: 0, dash: 0, overcharge: 3.2, bomb: 0 };
  if (scene === 'play') {
    state.wave = 8;
    state.score = 128450;
    state.best = 250000;
    state.timeText = '07:32';
    p.hp = 78; p.combo = 24; p.maxCombo = 24; p.kills = 186; p.shards = 42; p.level = 6; p.xp = 8; p.xpNext = 48;
    p.x = ARENA_CX + 40; p.y = ARENA_CY + 30;
    p.aimX = 0.7; p.aimY = -0.7;
    state.enemiesRemaining = 42;
    state.rosterLeft = { crawler: 14, archer: 9, brute: 6, drone: 8, stalker: 3, guardian: 2 };
    // ~32 enemies in a ring around the player.
    const types = ['crawler', 'crawler', 'crawler', 'archer', 'drone', 'brute', 'stalker', 'drone', 'crawler', 'archer', 'guardian'];
    for (let i = 0; i < 32; i++) {
      const a = (i / 32) * Math.PI * 2 + rng() * 0.2;
      const d = 110 + rng() * 150;
      const e = makeEnemy(types[i % types.length], ARENA_CX + Math.cos(a) * d, ARENA_CY + Math.sin(a) * d);
      if (i % 5 === 0) e.hp = e.maxHp * 0.5;
      state.enemies.push(e);
    }
    // Plasma bolts with trails.
    for (let i = 0; i < 14; i++) {
      const a = -0.7 + (rng() - 0.5) * 1.6;
      state.bullets.push(makeBullet(p.x + Math.cos(a) * (30 + rng() * 200), p.y + Math.sin(a) * (30 + rng() * 200), Math.cos(a) * 640, Math.sin(a) * 640, true, 0));
    }
    // Homing missiles inbound.
    for (let i = 0; i < 5; i++) {
      const a = rng() * Math.PI * 2;
      const m = makeBullet(p.x + Math.cos(a) * (180 + rng() * 90), p.y + Math.sin(a) * (180 + rng() * 90), -Math.cos(a) * 220, -Math.sin(a) * 220, false, 0);
      m.homing = true; m.radius = 8;
      state.ebullets.push(m);
    }
    // Lightning chains.
    for (let i = 0; i < 4; i++) {
      const e1 = state.enemies[i * 6], e2 = state.enemies[i * 6 + 3];
      state.chains.push({ x1: e1.x, y1: e1.y, x2: e2.x, y2: e2.y, life: 0.18 });
    }
    // Shards + explosions + danger circles.
    for (let i = 0; i < 12; i++) {
      const a = rng() * Math.PI * 2, d = 60 + rng() * 200;
      state.shards.push({ x: ARENA_CX + Math.cos(a) * d, y: ARENA_CY + Math.sin(a) * d, vx: 0, vy: 0, life: 9 });
    }
    for (let i = 0; i < 3; i++) {
      const a = rng() * Math.PI * 2;
      burst(ARENA_CX + Math.cos(a) * 150, ARENA_CY + Math.sin(a) * 150, ['#ffd166', '#ff2b4e', '#b026ff'][i], 18, 260);
    }
    for (let i = 0; i < 3; i++) {
      const a = rng() * Math.PI * 2;
      state.dangers.push(makeDangerCircle(ARENA_CX + Math.cos(a) * 170, ARENA_CY + Math.sin(a) * 170, 46, 0.5));
    }
    state.floaters.push(makeFloater(p.x + 60, p.y - 60, '+2,400', '#ffd166'));
    setBanner('UNSTOPPABLE! 25 KILL STREAK!', '', PALETTE.gold, 99);
    state.banner.y = 255;
  } else if (scene === 'boss') {
    state.wave = 10;
    state.score = 245800;
    state.best = 250000;
    state.timeText = '11:05';
    p.hp = 42; p.combo = 67; p.maxCombo = 67; p.kills = 312; p.shards = 88; p.level = 9; p.xp = 20; p.xpNext = 66;
    p.x = ARENA_CX + 150; p.y = ARENA_CY + 170;
    p.aimX = -0.6; p.aimY = -0.8;
    state.enemiesRemaining = 16;
    state.rosterLeft = { crawler: 0, archer: 2, brute: 1, drone: 8, stalker: 2, guardian: 3 };
    state.boss = makeBoss();
    state.boss.hp = state.boss.maxHp * 0.28;
    state.boss.phase = 2;
    // Big and centered low: the boss fills ~35% of the screen without
    // clipping the HUD — tentacles stay inside the arena ring.
    state.boss.radius = 118;
    state.boss.x = ARENA_CX; state.boss.y = ARENA_CY - 60;
    // Drones around the boss.
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      state.enemies.push(makeEnemy(i % 3 === 0 ? 'guardian' : 'drone', state.boss.x + Math.cos(a) * 210, state.boss.y + Math.sin(a) * 150));
    }
    // Rotating lasers crossing the arena.
    state.lasers.push(makeLaser(state.boss.x, state.boss.y + 24, 0.5, 700, 14, 0.9));
    state.lasers.push(makeLaser(state.boss.x, state.boss.y + 24, 2.4, 700, 12, 0.9));
    // Missiles + plasma crossing.
    for (let i = 0; i < 7; i++) {
      const a = rng() * Math.PI * 2;
      const m = makeBullet(p.x + Math.cos(a) * (150 + rng() * 120), p.y + Math.sin(a) * (150 + rng() * 120), -Math.cos(a) * 220, -Math.sin(a) * 220, false, 0);
      m.homing = true; m.radius = 8;
      state.ebullets.push(m);
    }
    for (let i = 0; i < 12; i++) {
      const a = Math.atan2(state.boss.y - p.y, state.boss.x - p.x) + (rng() - 0.5) * 0.8;
      state.bullets.push(makeBullet(p.x + Math.cos(a) * (30 + rng() * 220), p.y + Math.sin(a) * (30 + rng() * 220), Math.cos(a) * 640, Math.sin(a) * 640, true, 0));
    }
    for (let i = 0; i < 3; i++) {
      burst(ARENA_CX + (rng() - 0.5) * 300, ARENA_CY + (rng() - 0.5) * 300, ['#ffd166', '#ff2b4e', '#22d3ee'][i], 22, 300);
    }
    for (let i = 0; i < 8; i++) {
      const a = rng() * Math.PI * 2, d = 80 + rng() * 180;
      state.shards.push({ x: ARENA_CX + Math.cos(a) * d, y: ARENA_CY + Math.sin(a) * d, vx: 0, vy: 0, life: 9 });
    }
    state.floaters.push(makeFloater(state.boss.x + 170, state.boss.y - 40, 'CRIT! -840', '#ff2b4e'));
    setBanner('REALITY COLLAPSE — SURVIVE!', '', PALETTE.red, 99);
    state.banner.y = 600;
  }
}

// ---------- input ----------
function inRect(x, y, rx, ry, rw, rh) { return x >= rx && x <= rx + rw && y >= ry && y <= ry + rh; }

canvas.addEventListener('mousemove', (ev) => {
  const r = canvas.getBoundingClientRect();
  mouse.x = (ev.clientX - r.left) * (VIEW_W / r.width);
  mouse.y = (ev.clientY - r.top) * (VIEW_H / r.height);
});
canvas.addEventListener('mousedown', (ev) => {
  ensureAudio();
  if (ev.button !== 0) return;
  mouse.down = true;
  handleClick(mouse.x, mouse.y);
});
window.addEventListener('mouseup', () => { mouse.down = false; });
window.addEventListener('blur', () => { mouse.down = false; });

function handleClick(x, y) {
  if (state.screen === 'title') {
    if (inRect(x, y, VIEW_W / 2 - 150, 660, 300, 52)) { sfx.click(); startGame(); }
    else if (inRect(x, y, VIEW_W / 2 - 150, 722, 300, 40)) { sfx.click(); state.screen = 'howto'; }
  } else if (state.screen === 'howto') {
    state.screen = 'title';
  } else if (state.screen === 'levelup') {
    let cx = 220;
    for (let i = 0; i < state.relicOffer.length; i++) {
      if (inRect(x, y, cx, 280, 260, 190)) {
        const bonus = applyRelic(state.player, state.relicOffer[i]);
        state.score += bonus;
        sfx.levelup();
        state.screen = 'playing';
        break;
      }
      cx += 280;
    }
  } else if (state.screen === 'victory') {
    if (inRect(x, y, VIEW_W / 2 - 220, 792, 200, 44)) { sfx.click(); startGame(); }
    else if (inRect(x, y, VIEW_W / 2 + 20, 792, 200, 44)) { sfx.click(); state.screen = 'title'; }
  } else if (state.screen === 'defeat') {
    if (inRect(x, y, VIEW_W / 2 - 150, 490, 300, 52)) { sfx.click(); startGame(); }
  }
}

window.addEventListener('keydown', (ev) => {
  keys[ev.code] = true;
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(ev.code)) ev.preventDefault();
  ensureAudio();
  if (ev.code === 'KeyM') setMuted(!isMuted());
  if (ev.code === 'Enter' && state.screen === 'title') startGame();
  if (ev.code === 'Enter' && state.screen === 'howto') state.screen = 'title';
  if (ev.code === 'KeyP' && (state.screen === 'playing' || state.screen === 'paused')) {
    state.screen = state.screen === 'playing' ? 'paused' : 'playing';
  }
  // R restarts from any non-playing screen; during play R is OVERCHARGE (spec).
  // Return right after restarting so the same press cannot also fire overcharge.
  if (ev.code === 'KeyR' && state.screen !== 'playing') { startGame(); return; }
  if (state.screen === 'levelup' && ['Digit1', 'Digit2', 'Digit3'].includes(ev.code)) {
    const i = parseInt(ev.code.slice(-1), 10) - 1;
    if (state.relicOffer[i]) {
      state.score += applyRelic(state.player, state.relicOffer[i]);
      state.screen = 'playing';
    }
  }
  if (state.screen !== 'playing') return;
  if (ev.code === 'KeyQ') useAbility('nova');
  if (ev.code === 'KeyE') useAbility('dash');
  if (ev.code === 'KeyR') useAbility('overcharge');
  if (ev.code === 'Space') useAbility('bomb');
});
window.addEventListener('keyup', (ev) => { keys[ev.code] = false; });

// Expose state for play-testing.
window.__game = state;
window.__startGame = startGame;

// Boot: shot scenes or the live game.
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
if (shot) {
  stageShot(shot, parseInt(params.get('seed') || '7', 10));
  render();
  window.__shotReady = true;
} else {
  let last = performance.now();
  function loop(now) {
    const dt = Math.min(1 / 30, (now - last) / 1000);
    last = now;
    update(dt);
    render();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}
