// RIFTBREAKERS — all canvas drawing: arena, entities, boss, HUD and screens.
// Neon purple / electric blue / blood-red palette. Every screen is drawn in code.

import { VIEW_W, VIEW_H, ARENA, ARENA_CX, ARENA_CY, ARENA_R, PALETTE, ENEMY_TYPES, ROSTER_TOTALS, RELICS, ABILITIES, BOSS, fmt } from './config.js';
import { relicDef } from './relics.js';

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function panel(ctx, x, y, w, h, title) {
  ctx.fillStyle = 'rgba(12, 6, 28, 0.88)';
  rr(ctx, x, y, w, h, 10); ctx.fill();
  ctx.strokeStyle = PALETTE.panelEdge; ctx.lineWidth = 1.5; ctx.stroke();
  if (title) {
    ctx.fillStyle = PALETTE.gold;
    ctx.font = 'bold 13px "Segoe UI", sans-serif';
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillText(title, x + 10, y + 8);
  }
}

function starfield(ctx, t, seedOffset) {
  ctx.fillStyle = PALETTE.bg;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  for (let i = 0; i < 110; i++) {
    const x = (i * 137.5 + seedOffset) % VIEW_W;
    const y = (i * 89.3 + seedOffset * 0.7) % VIEW_H;
    const tw = 0.4 + 0.6 * Math.abs(Math.sin(t * 0.7 + i));
    ctx.fillStyle = i % 5 === 0 ? `rgba(178, 132, 255, ${tw})` : `rgba(255,255,255,${tw * 0.7})`;
    const s = i % 7 === 0 ? 2.2 : 1.2;
    ctx.fillRect(x, y, s, s);
  }
}

export function drawArena(ctx, state, t) {
  starfield(ctx, t, 0);
  // Dimensional rift ring around the arena.
  const g = ctx.createRadialGradient(ARENA_CX, ARENA_CY, ARENA_R * 0.4, ARENA_CX, ARENA_CY, ARENA_R * 1.25);
  g.addColorStop(0, '#160b33');
  g.addColorStop(0.75, '#0d0620');
  g.addColorStop(1, '#070412');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(ARENA_CX, ARENA_CY, ARENA_R + 26, 0, Math.PI * 2); ctx.fill();
  // Arena floor grid.
  ctx.save();
  ctx.beginPath(); ctx.arc(ARENA_CX, ARENA_CY, ARENA_R, 0, Math.PI * 2); ctx.clip();
  ctx.strokeStyle = 'rgba(124, 58, 237, 0.22)';
  ctx.lineWidth = 1;
  for (let gx = ARENA_CX - ARENA_R; gx <= ARENA_CX + ARENA_R; gx += 44) {
    ctx.beginPath(); ctx.moveTo(gx, ARENA_CY - ARENA_R); ctx.lineTo(gx, ARENA_CY + ARENA_R); ctx.stroke();
  }
  for (let gy = ARENA_CY - ARENA_R; gy <= ARENA_CY + ARENA_R; gy += 44) {
    ctx.beginPath(); ctx.moveTo(ARENA_CX - ARENA_R, gy); ctx.lineTo(ARENA_CX + ARENA_R, gy); ctx.stroke();
  }
  // Floor cracks / energy veins.
  ctx.strokeStyle = 'rgba(34, 211, 238, 0.16)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 5; i++) {
    const a = i * 1.256 + 0.4;
    ctx.beginPath();
    ctx.moveTo(ARENA_CX, ARENA_CY);
    ctx.lineTo(ARENA_CX + Math.cos(a) * ARENA_R, ARENA_CY + Math.sin(a) * ARENA_R);
    ctx.stroke();
  }
  ctx.restore();
  // Glowing arena rim.
  ctx.strokeStyle = PALETTE.purple;
  ctx.lineWidth = 3;
  ctx.shadowColor = PALETTE.purple; ctx.shadowBlur = 18;
  ctx.beginPath(); ctx.arc(ARENA_CX, ARENA_CY, ARENA_R, 0, Math.PI * 2); ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(34, 211, 238, 0.5)';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(ARENA_CX, ARENA_CY, ARENA_R + 8, 0, Math.PI * 2); ctx.stroke();
}

function drawMech(ctx, x, y, aimAngle, scale, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  // Legs / thrusters.
  ctx.fillStyle = '#312e81';
  ctx.fillRect(-10, 6, 8, 12);
  ctx.fillRect(2, 6, 8, 12);
  ctx.fillStyle = '#22d3ee';
  ctx.beginPath(); ctx.moveTo(-6, 18); ctx.lineTo(-2, 26 + Math.sin(performance.now() / 90) * 3); ctx.lineTo(2, 18); ctx.closePath(); ctx.fill();
  // Body.
  ctx.fillStyle = color || '#4c1d95';
  ctx.beginPath(); ctx.arc(0, 0, 15, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#c084fc'; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = '#1e1b4b';
  ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fill();
  // Core.
  ctx.fillStyle = '#22d3ee';
  ctx.shadowColor = '#22d3ee'; ctx.shadowBlur = 10;
  ctx.beginPath(); ctx.arc(0, 0, 4.5, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;
  // Cannon toward aim.
  ctx.rotate(aimAngle);
  ctx.fillStyle = '#312e81';
  ctx.fillRect(8, -4, 20, 8);
  ctx.fillStyle = '#67e8f9';
  ctx.fillRect(24, -2.5, 7, 5);
  ctx.restore();
}

export function drawPlayer(ctx, p, t) {
  for (const a of p.afterimages) {
    ctx.globalAlpha = a.life * 0.5;
    drawMech(ctx, a.x, a.y, a.angle, 1, '#7c3aed');
  }
  ctx.globalAlpha = 1;
  if (p.invuln > 0 && Math.floor(t * 14) % 2 === 0) return;
  drawMech(ctx, p.x, p.y, Math.atan2(p.aimY, p.aimX), 1, '#4c1d95');
  // Aim reticle.
  ctx.strokeStyle = 'rgba(103, 232, 249, 0.8)';
  ctx.lineWidth = 1.5;
  const rx = p.x + p.aimX * 44, ry = p.y + p.aimY * 44;
  ctx.beginPath(); ctx.arc(rx, ry, 8, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(rx - 12, ry); ctx.lineTo(rx - 5, ry); ctx.moveTo(rx + 5, ry); ctx.lineTo(rx + 12, ry);
  ctx.moveTo(rx, ry - 12); ctx.lineTo(rx, ry - 5); ctx.moveTo(rx, ry + 5); ctx.lineTo(rx, ry + 12); ctx.stroke();
}

export function drawEnemy(ctx, e, t) {
  const def = ENEMY_TYPES[e.type];
  ctx.save();
  ctx.translate(e.x, e.y);
  if (e.flash > 0) ctx.filter = 'brightness(2.2)';
  ctx.fillStyle = def.color;
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 1.5;
  const r = e.radius;
  if (e.type === 'crawler') {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + e.wobble;
      const px = Math.cos(a) * r, py = Math.sin(a) * r;
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#1e1b4b';
    ctx.beginPath(); ctx.arc(0, 0, r * 0.45, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ff2b4e';
    ctx.beginPath(); ctx.arc(-4, -2, 2.5, 0, Math.PI * 2); ctx.arc(4, -2, 2.5, 0, Math.PI * 2); ctx.fill();
  } else if (e.type === 'archer') {
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#67e8f9'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, r + 3, -0.9, 0.9); ctx.stroke();
    ctx.fillStyle = '#0e7490';
    ctx.beginPath(); ctx.arc(0, 0, r * 0.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI * 2); ctx.fill();
  } else if (e.type === 'brute') {
    ctx.fillRect(-r, -r * 0.8, r * 2, r * 1.6);
    ctx.strokeRect(-r, -r * 0.8, r * 2, r * 1.6);
    ctx.fillStyle = '#431407';
    ctx.fillRect(-r * 0.6, -r * 0.4, r * 1.2, r * 0.8);
    ctx.fillStyle = '#ffedd5';
    ctx.beginPath(); ctx.arc(-6, -4, 3, 0, Math.PI * 2); ctx.arc(6, -4, 3, 0, Math.PI * 2); ctx.fill();
    if (e.chargeState === 'windup') {
      ctx.strokeStyle = '#ff2b4e'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, 0, r + 8, 0, Math.PI * 2); ctx.stroke();
    }
  } else if (e.type === 'drone') {
    ctx.beginPath(); ctx.arc(0, 0, r * 0.7, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillRect(-r - 6, -3, 8, 6);
    ctx.fillRect(r - 2, -3, 8, 6);
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(0, 0, 3.5, 0, Math.PI * 2); ctx.fill();
  } else if (e.type === 'stalker') {
    ctx.globalAlpha = 0.75 + 0.25 * Math.sin(t * 6 + e.wobble);
    ctx.beginPath();
    ctx.moveTo(0, -r); ctx.lineTo(r * 0.8, r * 0.6); ctx.lineTo(-r * 0.8, r * 0.6);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  } else if (e.type === 'guardian') {
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + 0.2;
      const px = Math.cos(a) * r, py = Math.sin(a) * r;
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#451a03';
    ctx.beginPath(); ctx.arc(0, 0, r * 0.55, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fde68a';
    ctx.beginPath(); ctx.arc(-7, -3, 4, 0, Math.PI * 2); ctx.arc(7, -3, 4, 0, Math.PI * 2); ctx.fill();
  }
  ctx.filter = 'none';
  ctx.restore();
  // HP bar for damaged / elite enemies.
  if (e.hp < e.maxHp) {
    const w = r * 2;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(e.x - w / 2, e.y - r - 10, w, 5);
    ctx.fillStyle = e.type === 'guardian' ? PALETTE.gold : PALETTE.red;
    ctx.fillRect(e.x - w / 2, e.y - r - 10, w * Math.max(0, e.hp / e.maxHp), 5);
  }
}

export function drawBoss(ctx, boss, t) {
  const { x, y } = boss;
  const r = boss.radius;
  ctx.save();
  ctx.translate(x, y);
  // Tentacles.
  for (const tn of boss.tentacles) {
    const sway = Math.sin(t * 1.4 + tn.phase) * 0.35;
    const a = tn.angle + sway;
    ctx.strokeStyle = '#7c3aed';
    ctx.lineWidth = 14;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(Math.cos(a) * tn.len * 0.6, Math.sin(a) * tn.len * 0.6 + 30, Math.cos(a) * tn.len, Math.sin(a) * tn.len + 50);
    ctx.stroke();
    ctx.fillStyle = '#e11d48';
    ctx.beginPath(); ctx.arc(Math.cos(a) * tn.len, Math.sin(a) * tn.len + 50, 8, 0, Math.PI * 2); ctx.fill();
  }
  // Floating armor plates.
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + t * 0.25;
    const px = Math.cos(a) * (r + 26), py = Math.sin(a) * (r + 26) * 0.8;
    ctx.fillStyle = '#312e81';
    ctx.strokeStyle = '#a78bfa'; ctx.lineWidth = 2;
    ctx.save(); ctx.translate(px, py); ctx.rotate(a + 0.5);
    ctx.fillRect(-16, -9, 32, 18); ctx.strokeRect(-16, -9, 32, 18);
    ctx.restore();
  }
  // Body.
  const bodyGrad = ctx.createRadialGradient(-20, -25, 10, 0, 0, r);
  bodyGrad.addColorStop(0, '#4c1d95');
  bodyGrad.addColorStop(0.7, '#2e1065');
  bodyGrad.addColorStop(1, '#150826');
  ctx.fillStyle = bodyGrad;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#b026ff'; ctx.lineWidth = 3; ctx.stroke();
  // Energy core (phase 2+ exposed).
  const coreR = boss.phase >= 1 ? 30 : 18;
  ctx.fillStyle = boss.phase >= 2 ? '#ff2b4e' : '#22d3ee';
  ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 26;
  ctx.beginPath(); ctx.arc(0, 14, coreR, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath(); ctx.arc(0, 14, coreR * 0.45, 0, Math.PI * 2); ctx.fill();
  // Crimson eyes.
  ctx.fillStyle = '#ff2b4e';
  ctx.shadowColor = '#ff2b4e'; ctx.shadowBlur = 14;
  ctx.beginPath(); ctx.ellipse(-34, -30, 13, 8, -0.2, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(34, -30, 13, 8, 0.2, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;
  // Energy cannon.
  ctx.fillStyle = '#1e1b4b';
  ctx.fillRect(-10, r - 12, 20, 34);
  ctx.fillStyle = '#67e8f9';
  ctx.beginPath(); ctx.arc(0, r + 24, 7, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  if (boss.flash > 0) {
    ctx.save();
    ctx.globalAlpha = boss.flash * 2.5;
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}

export function drawBullets(ctx, bullets) {
  for (const b of bullets) {
    ctx.save();
    if (b.friendly) {
      ctx.strokeStyle = 'rgba(103, 232, 249, 0.75)';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(b.x - b.vx * 0.03, b.y - b.vy * 0.03); ctx.lineTo(b.x, b.y); ctx.stroke();
      ctx.fillStyle = '#a5f3fc';
      ctx.shadowColor = '#22d3ee'; ctx.shadowBlur = 10;
    } else {
      ctx.fillStyle = '#ff2b4e';
      ctx.shadowColor = '#ff2b4e'; ctx.shadowBlur = 10;
    }
    ctx.beginPath(); ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}

export function drawParticles(ctx, particles) {
  for (const pt of particles) {
    ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
    ctx.fillStyle = pt.color;
    ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size * (0.5 + pt.life / pt.maxLife), 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

export function drawShards(ctx, shards, t) {
  for (const s of shards) {
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(t * 3 + s.x);
    ctx.fillStyle = '#67e8f9';
    ctx.shadowColor = '#22d3ee'; ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(0, -7); ctx.lineTo(5, 0); ctx.lineTo(0, 7); ctx.lineTo(-5, 0);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }
}

export function drawFloaters(ctx, floaters) {
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const f of floaters) {
    ctx.globalAlpha = Math.min(1, f.life * 1.6);
    ctx.font = 'bold 17px "Segoe UI", sans-serif';
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x, f.y - (1.1 - f.life) * 30);
  }
  ctx.globalAlpha = 1;
}

export function drawLasers(ctx, lasers) {
  for (const l of lasers) {
    const a = Math.min(1, l.life / (l.maxLife * 0.4));
    ctx.save();
    ctx.globalAlpha = a;
    ctx.strokeStyle = '#ff2b4e';
    ctx.lineWidth = l.width;
    ctx.shadowColor = '#ff2b4e'; ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.moveTo(l.x, l.y);
    ctx.lineTo(l.x + Math.cos(l.angle) * l.length, l.y + Math.sin(l.angle) * l.length);
    ctx.stroke();
    ctx.strokeStyle = '#fecdd3';
    ctx.lineWidth = l.width * 0.35;
    ctx.beginPath();
    ctx.moveTo(l.x, l.y);
    ctx.lineTo(l.x + Math.cos(l.angle) * l.length, l.y + Math.sin(l.angle) * l.length);
    ctx.stroke();
    ctx.restore();
  }
}

export function drawDangerCircles(ctx, circles) {
  for (const c of circles) {
    const p = 1 - c.life / c.maxLife;
    ctx.fillStyle = `rgba(255, 43, 78, ${0.14 + p * 0.2})`;
    ctx.beginPath(); ctx.arc(c.x, c.y, c.radius, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = `rgba(255, 43, 78, ${0.5 + p * 0.5})`;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(c.x, c.y, c.radius, 0, Math.PI * 2); ctx.stroke();
  }
}

export function drawChains(ctx, chains) {
  for (const c of chains) {
    ctx.strokeStyle = 'rgba(250, 204, 21, 0.95)';
    ctx.lineWidth = 2.5;
    ctx.shadowColor = '#facc15'; ctx.shadowBlur = 8;
    ctx.beginPath();
    const mx = (c.x1 + c.x2) / 2 + (Math.random() - 0.5) * 24;
    const my = (c.y1 + c.y2) / 2 + (Math.random() - 0.5) * 24;
    ctx.moveTo(c.x1, c.y1); ctx.lineTo(mx, my); ctx.lineTo(c.x2, c.y2);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }
}

function bar(ctx, x, y, w, h, frac, fill, bg) {
  ctx.fillStyle = bg || 'rgba(0,0,0,0.6)';
  rr(ctx, x, y, w, h, 4); ctx.fill();
  if (frac > 0) {
    ctx.fillStyle = fill;
    rr(ctx, x, y, Math.max(4, w * Math.min(1, frac)), h, 4); ctx.fill();
  }
}

export function drawHUD(ctx, state) {
  const p = state.player;
  // Top bar.
  ctx.fillStyle = 'rgba(10, 5, 24, 0.92)';
  ctx.fillRect(0, 0, VIEW_W, 62);
  ctx.strokeStyle = PALETTE.panelEdge; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, 62); ctx.lineTo(VIEW_W, 62); ctx.stroke();
  ctx.textBaseline = 'top';
  // Left: wave + enemies.
  ctx.textAlign = 'left';
  ctx.fillStyle = PALETTE.gold;
  ctx.font = 'bold 20px "Segoe UI", sans-serif';
  ctx.fillText(state.boss ? 'WAVE 10/10 — BOSS' : `WAVE ${String(state.wave).padStart(2, '0')}/10`, 14, 8);
  ctx.fillStyle = PALETTE.dim;
  ctx.font = '13px "Segoe UI", sans-serif';
  ctx.fillText(`${state.enemiesRemaining} ENEMIES REMAINING`, 14, 34);
  // Center: score / best / combo.
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.white;
  ctx.font = 'bold 26px "Segoe UI", sans-serif';
  ctx.fillText(fmt(state.score), VIEW_W / 2 - 60, 6);
  ctx.fillStyle = PALETTE.dim;
  ctx.font = '12px "Segoe UI", sans-serif';
  ctx.fillText(`BEST ${fmt(state.best)}`, VIEW_W / 2 - 60, 38);
  ctx.fillStyle = p.combo >= 10 ? PALETTE.gold : PALETTE.cyan;
  ctx.font = 'bold 24px "Segoe UI", sans-serif';
  ctx.fillText(`COMBO x${p.combo}`, VIEW_W / 2 + 130, 8);
  ctx.fillStyle = PALETTE.dim;
  ctx.font = '12px "Segoe UI", sans-serif';
  ctx.fillText(`${p.kills} KILLS`, VIEW_W / 2 + 130, 38);
  // Right: HP + time + shards.
  ctx.textAlign = 'right';
  ctx.fillStyle = PALETTE.white;
  ctx.font = 'bold 15px "Segoe UI", sans-serif';
  ctx.fillText(`HP ${Math.ceil(p.hp)}%`, VIEW_W - 14, 8);
  bar(ctx, VIEW_W - 214, 30, 200, 12, p.hp / p.maxHp, p.hp > 40 ? PALETTE.green : PALETTE.red);
  ctx.fillStyle = PALETTE.dim;
  ctx.font = '13px "Segoe UI", sans-serif';
  ctx.fillText(`TIME ${state.timeText}   ◆ ${p.shards}`, VIEW_W - 14, 46);

  // WIN / LOSE strips.
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(22, 101, 52, 0.9)';
  rr(ctx, 8, 70, 604, 26, 6); ctx.fill();
  ctx.fillStyle = '#dcfce7';
  ctx.font = 'bold 13px "Segoe UI", sans-serif';
  ctx.fillText('WIN: defeat VORAKH, the Void Sovereign', 18, 76);
  ctx.fillStyle = 'rgba(127, 29, 29, 0.9)';
  rr(ctx, 628, 70, 604, 26, 6); ctx.fill();
  ctx.fillStyle = '#fecdd3';
  ctx.fillText('LOSE: your HP reaches 0', 638, 76);

  // Boss HP bar (huge, segmented, red).
  if (state.boss) {
    const b = state.boss;
    const frac = Math.max(0, b.hp / b.maxHp);
    const phase = BOSS.phases[b.phase];
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 16px "Segoe UI", sans-serif';
    ctx.fillText(`${BOSS.name} — ${BOSS.title}   ·   PHASE ${b.phase + 1}/3 ${phase.name}   ·   ${Math.ceil(frac * 100)}%`, VIEW_W / 2, 104);
    const bw = 860, bx = (VIEW_W - bw) / 2, by = 126;
    bar(ctx, bx, by, bw, 16, frac, PALETTE.red);
    ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.lineWidth = 2;
    for (const s of [0.35, 0.7]) {
      ctx.beginPath(); ctx.moveTo(bx + bw * s, by); ctx.lineTo(bx + bw * s, by + 16); ctx.stroke();
    }
  }

  // Left panel: enemy roster + goals.
  panel(ctx, 8, 148, 152, 300, 'INCOMING');
  ctx.textAlign = 'left';
  ctx.font = '12px "Segoe UI", sans-serif';
  let ry = 172;
  for (const [type, total] of Object.entries(ROSTER_TOTALS)) {
    const def = ENEMY_TYPES[type];
    const left = state.rosterLeft[type] ?? total;
    ctx.fillStyle = def.color;
    ctx.beginPath(); ctx.arc(20, ry + 6, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = PALETTE.white;
    ctx.fillText(def.name.replace('Void ', 'V. ').replace('Rift ', 'R. '), 30, ry);
    ctx.fillStyle = left > 0 ? PALETTE.gold : PALETTE.dim;
    ctx.textAlign = 'right';
    ctx.fillText(`x${left}`, 150, ry);
    ctx.textAlign = 'left';
    ry += 24;
  }
  ctx.fillStyle = PALETTE.dim;
  ctx.font = '11px "Segoe UI", sans-serif';
  if (state.wave >= 10) {
    ctx.fillText('Vorakh is the final wave.', 18, ry + 6);
    ctx.fillText('Destroy him to win.', 18, ry + 20);
  } else {
    ctx.fillText('Next wave: more of', 18, ry + 6);
    ctx.fillText('everything, faster.', 18, ry + 20);
  }
  panel(ctx, 8, 458, 152, 118, 'GOALS');
  const goals = [
    [`Clear wave ${Math.min(state.wave, 10)}/10`, state.wave >= 10],
    [`Reach combo x25`, p.maxCombo >= 25],
    [`Collect 3 relics`, p.relics.length >= 3],
  ];
  ctx.font = '12px "Segoe UI", sans-serif';
  let gy = 482;
  for (const [label, done] of goals) {
    ctx.fillStyle = done ? PALETTE.green : PALETTE.white;
    ctx.fillText(done ? '☑' : '☐', 18, gy);
    ctx.fillStyle = PALETTE.white;
    ctx.fillText(label, 36, gy);
    gy += 22;
  }
  ctx.fillStyle = PALETTE.dim;
  ctx.font = '11px "Segoe UI", sans-serif';
  ctx.fillText(`Level ${p.level}  ·  XP ${p.xp}/${p.xpNext}`, 18, gy + 4);
  bar(ctx, 18, gy + 20, 132, 8, p.xp / p.xpNext, PALETTE.blue);

  // Right panel: relics held + tonight/run info.
  panel(ctx, VIEW_W - 160, 148, 152, 300, 'RELICS');
  ctx.font = '12px "Segoe UI", sans-serif';
  let yy = 172;
  if (p.relics.length === 0) {
    ctx.fillStyle = PALETTE.dim;
    ctx.fillText('None yet — level', VIEW_W - 150, yy);
    ctx.fillText('up to claim one.', VIEW_W - 150, yy + 16);
  }
  for (const id of p.relics) {
    const r = relicDef(id);
    if (!r) continue;
    ctx.fillStyle = PALETTE.gold;
    ctx.fillText(`${r.icon} ${r.name}`, VIEW_W - 150, yy);
    ctx.fillStyle = PALETTE.dim;
    ctx.font = '11px "Segoe UI", sans-serif';
    ctx.fillText(r.desc, VIEW_W - 150, yy + 15, 132);
    ctx.font = '12px "Segoe UI", sans-serif';
    yy += 40;
  }
  panel(ctx, VIEW_W - 160, 458, 152, 118, 'RUN');
  ctx.fillStyle = PALETTE.white;
  ctx.font = '12px "Segoe UI", sans-serif';
  ctx.fillText(`Wave ${state.wave} of 10`, VIEW_W - 150, 482);
  ctx.fillText(`Kills ${p.kills}`, VIEW_W - 150, 504);
  ctx.fillText(`Best combo x${p.maxCombo}`, VIEW_W - 150, 526);
  ctx.fillStyle = PALETTE.gold;
  ctx.font = '11px "Segoe UI", sans-serif';
  ctx.fillText(state.wave >= 10 ? 'Vorakh is here.' : 'Vorakh waits on', VIEW_W - 150, 548);
  ctx.fillText(state.wave >= 10 ? 'Mind the lasers!' : 'wave 10.', VIEW_W - 150, 562);

  // Bottom ability bar.
  panel(ctx, 170, 688, 900, 96, null);
  const ab = [
    { ...ABILITIES.nova, id: 'nova', cd: p.cooldowns.nova },
    { ...ABILITIES.dash, id: 'dash', cd: p.cooldowns.dash },
    { ...ABILITIES.overcharge, id: 'overcharge', cd: p.cooldowns.overcharge },
    { ...ABILITIES.bomb, id: 'bomb', cd: p.cooldowns.bomb },
  ];
  let ax = 186;
  for (const a of ab) {
    const ready = a.cd <= 0;
    ctx.fillStyle = ready ? 'rgba(124, 58, 237, 0.55)' : 'rgba(30, 20, 50, 0.8)';
    rr(ctx, ax, 700, 150, 60, 8); ctx.fill();
    ctx.strokeStyle = ready ? PALETTE.blue : '#3b2d5e'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.textAlign = 'left';
    ctx.fillStyle = ready ? PALETTE.white : PALETTE.dim;
    ctx.font = 'bold 13px "Segoe UI", sans-serif';
    ctx.fillText(`[${a.key}] ${a.name}`, ax + 8, 708);
    ctx.fillStyle = PALETTE.dim;
    ctx.font = '11px "Segoe UI", sans-serif';
    ctx.fillText(a.desc, ax + 8, 728);
    if (!ready) {
      ctx.fillStyle = PALETTE.gold;
      ctx.font = 'bold 12px "Segoe UI", sans-serif';
      ctx.fillText(`${a.cd.toFixed(1)}s`, ax + 8, 746);
    } else {
      bar(ctx, ax + 8, 746, 134, 6, 1, PALETTE.green);
    }
    ax += 158;
  }
  // Equipped relics slots.
  ctx.textAlign = 'left';
  ctx.fillStyle = PALETTE.gold;
  ctx.font = 'bold 12px "Segoe UI", sans-serif';
  ctx.fillText('EQUIPPED RELICS', 826, 700);
  ctx.font = '12px "Segoe UI", sans-serif';
  for (let i = 0; i < 2; i++) {
    const r = p.relics[i] ? relicDef(p.relics[i]) : null;
    ctx.fillStyle = r ? PALETTE.white : PALETTE.dim;
    ctx.fillText(r ? `${i + 1}  ${r.icon} ${r.name}` : `${i + 1}  — empty —`, 826, 720 + i * 20);
  }
  ctx.fillStyle = PALETTE.dim;
  ctx.font = '11px "Segoe UI", sans-serif';
  ctx.fillText('WASD move · mouse aim · hold CLICK fire · SPACE bomb · P pause · M sound · R restart', 186, 772);

  // Event banner.
  if (state.banner && state.banner.life > 0) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, state.banner.life);
    ctx.textAlign = 'center';
    ctx.font = 'bold 44px "Segoe UI", sans-serif';
    ctx.fillStyle = state.banner.color || PALETTE.gold;
    ctx.shadowColor = state.banner.color || PALETTE.gold;
    ctx.shadowBlur = 24;
    ctx.fillText(state.banner.text, VIEW_W / 2, state.banner.y || 300);
    ctx.shadowBlur = 0;
    if (state.banner.sub) {
      ctx.font = 'bold 19px "Segoe UI", sans-serif';
      ctx.fillStyle = PALETTE.white;
      ctx.fillText(state.banner.sub, VIEW_W / 2, (state.banner.y || 300) + 32);
    }
    ctx.restore();
  }
}

export function drawLevelUp(ctx, state) {
  ctx.fillStyle = 'rgba(5, 2, 14, 0.82)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.gold;
  ctx.font = 'bold 40px "Segoe UI", sans-serif';
  ctx.fillText('LEVEL UP — CHOOSE A RELIC', VIEW_W / 2, 200);
  ctx.fillStyle = PALETTE.dim;
  ctx.font = '16px "Segoe UI", sans-serif';
  ctx.fillText('Click a relic to equip it. Relics stack.', VIEW_W / 2, 236);
  let x = 220;
  for (const r of state.relicOffer) {
    panel(ctx, x, 280, 260, 190, null);
    ctx.fillStyle = PALETTE.gold;
    ctx.font = '40px "Segoe UI", sans-serif';
    ctx.fillText(r.icon, x + 130, 310);
    ctx.fillStyle = PALETTE.white;
    ctx.font = 'bold 19px "Segoe UI", sans-serif';
    ctx.fillText(r.name, x + 130, 370);
    ctx.fillStyle = PALETTE.dim;
    ctx.font = '14px "Segoe UI", sans-serif';
    ctx.fillText(r.desc, x + 130, 400, 230);
    x += 280;
  }
}

export function drawTitle(ctx, state, t) {
  starfield(ctx, t, 40);
  // Dimensional portal (top-right corner, clear of the title).
  const pg = ctx.createRadialGradient(1140, 110, 10, 1140, 110, 120);
  pg.addColorStop(0, '#e9d5ff');
  pg.addColorStop(0.4, '#b026ff');
  pg.addColorStop(1, 'rgba(124, 58, 237, 0)');
  ctx.fillStyle = pg;
  ctx.beginPath(); ctx.arc(1140, 110, 120, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#e9d5ff'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(1140, 110, 65 + Math.sin(t) * 5, 0, Math.PI * 2); ctx.stroke();
  // Alien ships streaming from the portal.
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2 + t * 0.05;
    const d = 90 + ((i * 47) % 260);
    const x = 1140 + Math.cos(a) * d * 1.2;
    const y = 110 + Math.sin(a) * d * 0.9;
    ctx.fillStyle = i % 3 === 0 ? '#c084fc' : i % 3 === 1 ? '#22d3ee' : '#f472b6';
    ctx.beginPath(); ctx.arc(x, y, 4 + (i % 3), 0, Math.PI * 2); ctx.fill();
  }
  // Vorakh shadow looming (lower-left, clear of the title).
  ctx.save();
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = '#150826';
  ctx.beginPath(); ctx.arc(150, 370, 95, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ff2b4e';
  ctx.beginPath(); ctx.ellipse(118, 348, 14, 8, -0.2, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(182, 348, 14, 8, 0.2, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  // Enemy silhouettes swarming the middle band so the screen reads as ACTION.
  const band = [
    { x: 330, y: 400, r: 22, c: '#c084fc', s: 6 }, { x: 470, y: 450, r: 16, c: '#22d3ee', s: 3 },
    { x: 760, y: 420, r: 18, c: '#f472b6', s: 4 }, { x: 900, y: 470, r: 24, c: '#fb923c', s: 5 },
    { x: 1040, y: 390, r: 15, c: '#c084fc', s: 3 }, { x: 220, y: 500, r: 14, c: '#22d3ee', s: 4 },
  ];
  for (const b of band) {
    ctx.save();
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = b.c;
    ctx.shadowColor = b.c; ctx.shadowBlur = 14;
    ctx.beginPath();
    for (let i = 0; i < b.s; i++) {
      const a = (i / b.s) * Math.PI * 2 - Math.PI / 2;
      const px = b.x + Math.cos(a) * b.r, py = b.y + Math.sin(a) * b.r;
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#0a0518';
    ctx.beginPath(); ctx.arc(b.x - 5, b.y - 2, 3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(b.x + 5, b.y - 2, 3, 0, Math.PI * 2); ctx.fill();
  }
  // Plasma streaks crossing the middle band.
  ctx.strokeStyle = 'rgba(34, 211, 238, 0.55)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(300, 430); ctx.lineTo(560, 380); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(700, 480); ctx.lineTo(980, 410); ctx.stroke();
  ctx.strokeStyle = 'rgba(255, 43, 78, 0.5)';
  ctx.beginPath(); ctx.moveTo(980, 500); ctx.lineTo(700, 440); ctx.stroke();
  // Explosions in the background.
  for (let i = 0; i < 6; i++) {
    const x = 120 + i * 190, y = 640 + Math.sin(t + i) * 12;
    const rg = ctx.createRadialGradient(x, y, 2, x, y, 46);
    rg.addColorStop(0, 'rgba(255, 209, 102, 0.8)');
    rg.addColorStop(0.5, 'rgba(255, 43, 78, 0.35)');
    rg.addColorStop(1, 'rgba(255, 43, 78, 0)');
    ctx.fillStyle = rg;
    ctx.beginPath(); ctx.arc(x, y, 46, 0, Math.PI * 2); ctx.fill();
  }
  // Hero mech.
  drawMech(ctx, VIEW_W / 2, 535, -0.5, 2.6, '#4c1d95');
  // Title.
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.gold;
  ctx.font = 'bold 22px "Segoe UI", sans-serif';
  ctx.fillText('TOP-DOWN ARENA SHOOTER  ·  BULLET HELL  ·  ROGUELITE', VIEW_W / 2, 96);
  ctx.font = 'bold 96px "Segoe UI", sans-serif';
  const tg = ctx.createLinearGradient(0, 110, 0, 220);
  tg.addColorStop(0, '#f0abfc');
  tg.addColorStop(0.5, '#b026ff');
  tg.addColorStop(1, '#22d3ee');
  ctx.fillStyle = tg;
  ctx.shadowColor = '#b026ff'; ctx.shadowBlur = 30;
  ctx.fillText('RIFTBREAKERS', VIEW_W / 2, 200);
  ctx.shadowBlur = 0;
  ctx.fillStyle = PALETTE.red;
  ctx.font = 'bold 30px "Segoe UI", sans-serif';
  ctx.fillText('LAST STAND OF THE VOID', VIEW_W / 2, 248);
  ctx.fillStyle = PALETTE.white;
  ctx.font = '17px "Segoe UI", sans-serif';
  ctx.fillText('Fight through a collapsing dimension. Tear through hundreds of aliens.', VIEW_W / 2, 286);
  ctx.fillText('Survive 10 waves. Destroy VORAKH, the Void Sovereign.', VIEW_W / 2, 310);
  // Buttons.
  ctx.fillStyle = PALETTE.gold;
  rr(ctx, VIEW_W / 2 - 150, 660, 300, 52, 10); ctx.fill();
  ctx.fillStyle = '#1a0b2e';
  ctx.font = 'bold 22px "Segoe UI", sans-serif';
  ctx.fillText('—  START GAME  —', VIEW_W / 2, 677);
  ctx.fillStyle = 'rgba(124, 58, 237, 0.4)';
  rr(ctx, VIEW_W / 2 - 150, 722, 300, 40, 10); ctx.fill();
  ctx.strokeStyle = PALETTE.purple; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.fillStyle = PALETTE.white;
  ctx.font = 'bold 16px "Segoe UI", sans-serif';
  ctx.fillText('HOW TO PLAY', VIEW_W / 2, 735);
  ctx.fillStyle = PALETTE.dim;
  ctx.font = '15px "Segoe UI", sans-serif';
  ctx.fillText(`BEST SCORE: ${fmt(state.best)}`, VIEW_W / 2, 786);
  ctx.fillStyle = '#7e6aa8';
  ctx.font = '14px "Segoe UI", sans-serif';
  ctx.fillText('WASD MOVE  |  MOUSE AIM  |  LEFT CLICK FIRE  |  SPACE DASH  |  Q / E / R ABILITIES', VIEW_W / 2, 820);
}

export function drawHowTo(ctx) {
  ctx.fillStyle = 'rgba(5, 2, 14, 0.94)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.gold;
  ctx.font = 'bold 36px "Segoe UI", sans-serif';
  ctx.fillText('HOW TO PLAY', VIEW_W / 2, 120);
  const lines = [
    ['MOVE', 'WASD or arrow keys — stay inside the arena ring.'],
    ['AIM + FIRE', 'Mouse aims. Hold LEFT CLICK to fire plasma bolts.'],
    ['DASH', 'SPACE teleports a short distance (Void Bomb on cooldown). E is Phase Dash.'],
    ['ABILITIES', 'Q Nova Blast · E Phase Dash · R Overcharge · SPACE Void Bomb.'],
    ['SHARDS', 'Kills drop energy shards. Collect them to level up and pick relics.'],
    ['WAVES', '10 waves. Wave 10 is VORAKH — 3 phases, lasers, missiles, portals.'],
    ['WIN', 'Destroy Vorakh.   LOSE: your HP reaches 0.'],
  ];
  ctx.textAlign = 'left';
  let y = 190;
  for (const [k, v] of lines) {
    ctx.fillStyle = PALETTE.cyan;
    ctx.font = 'bold 18px "Segoe UI", sans-serif';
    ctx.fillText(k, 330, y);
    ctx.fillStyle = PALETTE.white;
    ctx.font = '17px "Segoe UI", sans-serif';
    ctx.fillText(v, 470, y);
    y += 46;
  }
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.dim;
  ctx.font = '15px "Segoe UI", sans-serif';
  ctx.fillText('Click anywhere or press ENTER to go back.', VIEW_W / 2, 560);
}

export function drawVictory(ctx, state) {
  starfield(ctx, 2.2, 80);
  // Collapsing portal.
  const pg = ctx.createRadialGradient(VIEW_W / 2, 300, 10, VIEW_W / 2, 300, 260);
  pg.addColorStop(0, '#fef3c7');
  pg.addColorStop(0.4, '#b026ff');
  pg.addColorStop(1, 'rgba(124, 58, 237, 0)');
  ctx.fillStyle = pg;
  ctx.beginPath(); ctx.arc(VIEW_W / 2, 300, 260, 0, Math.PI * 2); ctx.fill();
  // Explosion fragments.
  for (let i = 0; i < 90; i++) {
    const a = (i / 90) * Math.PI * 2;
    const d = 60 + ((i * 53) % 300);
    const x = VIEW_W / 2 + Math.cos(a) * d, y = 300 + Math.sin(a) * d * 0.7;
    ctx.fillStyle = ['#ffd166', '#ff2b4e', '#b026ff', '#22d3ee', '#fff'][i % 5];
    ctx.save(); ctx.translate(x, y); ctx.rotate(i);
    ctx.fillRect(-4, -2, 8, 4);
    ctx.restore();
  }
  // Golden particles.
  for (let i = 0; i < 60; i++) {
    const x = (i * 211) % VIEW_W, y = (i * 137) % VIEW_H;
    ctx.fillStyle = 'rgba(255, 209, 102, 0.7)';
    ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI * 2); ctx.fill();
  }
  drawMech(ctx, VIEW_W / 2, 520, -0.4, 2.4, '#4c1d95');
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.gold;
  ctx.font = 'bold 72px "Segoe UI", sans-serif';
  ctx.shadowColor = PALETTE.gold; ctx.shadowBlur = 28;
  ctx.fillText('VICTORY!', VIEW_W / 2, 120);
  ctx.shadowBlur = 0;
  ctx.fillStyle = PALETTE.white;
  ctx.font = 'bold 26px "Segoe UI", sans-serif';
  ctx.fillText('VOID SOVEREIGN ELIMINATED', VIEW_W / 2, 162);
  // Stats table.
  panel(ctx, VIEW_W / 2 - 240, 580, 480, 168, null);
  const rows = [
    ['FINAL SCORE', fmt(state.score)],
    ['BEST SCORE', fmt(state.best)],
    ['MAX COMBO', `x${state.player.maxCombo}`],
    ['ENEMIES ELIMINATED', `${state.player.kills}`],
    ['BOSS DEFEATED', 'VORAKH'],
    ['SURVIVAL TIME', state.timeText],
  ];
  ctx.font = '16px "Segoe UI", sans-serif';
  let y = 600;
  for (const [k, v] of rows) {
    ctx.textAlign = 'left';
    ctx.fillStyle = PALETTE.dim;
    ctx.fillText(k, VIEW_W / 2 - 220, y);
    ctx.textAlign = 'right';
    ctx.fillStyle = PALETTE.white;
    ctx.font = 'bold 16px "Segoe UI", sans-serif';
    ctx.fillText(v, VIEW_W / 2 + 220, y);
    ctx.font = '16px "Segoe UI", sans-serif';
    y += 24;
  }
  // Medals.
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.gold;
  ctx.font = 'bold 16px "Segoe UI", sans-serif';
  ctx.fillText('★ S-RANK COMBAT    ★ VOID SLAYER    ★ UNBROKEN COMBO', VIEW_W / 2, 772);
  ctx.fillStyle = PALETTE.gold;
  rr(ctx, VIEW_W / 2 - 220, 792, 200, 44, 10); ctx.fill();
  ctx.fillStyle = '#1a0b2e';
  ctx.font = 'bold 18px "Segoe UI", sans-serif';
  ctx.fillText('PLAY AGAIN', VIEW_W / 2 - 120, 807);
  ctx.fillStyle = 'rgba(124, 58, 237, 0.4)';
  rr(ctx, VIEW_W / 2 + 20, 792, 200, 44, 10); ctx.fill();
  ctx.strokeStyle = PALETTE.purple; ctx.stroke();
  ctx.fillStyle = PALETTE.white;
  ctx.fillText('MAIN MENU', VIEW_W / 2 + 120, 807);
}

export function drawDefeat(ctx, state) {
  starfield(ctx, 5, 120);
  ctx.fillStyle = 'rgba(60, 5, 20, 0.55)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.red;
  ctx.font = 'bold 72px "Segoe UI", sans-serif';
  ctx.shadowColor = PALETTE.red; ctx.shadowBlur = 28;
  ctx.fillText('DEFEATED', VIEW_W / 2, 200);
  ctx.shadowBlur = 0;
  ctx.fillStyle = PALETTE.white;
  ctx.font = '20px "Segoe UI", sans-serif';
  ctx.fillText('The void claims another breaker. The rift remains open.', VIEW_W / 2, 248);
  panel(ctx, VIEW_W / 2 - 240, 300, 480, 150, null);
  const rows = [
    ['FINAL SCORE', fmt(state.score)],
    ['BEST SCORE', fmt(state.best)],
    ['WAVE REACHED', `${state.wave}/10`],
    ['ENEMIES ELIMINATED', `${state.player.kills}`],
    ['SURVIVAL TIME', state.timeText],
  ];
  ctx.font = '16px "Segoe UI", sans-serif';
  let y = 326;
  for (const [k, v] of rows) {
    ctx.textAlign = 'left';
    ctx.fillStyle = PALETTE.dim;
    ctx.fillText(k, VIEW_W / 2 - 220, y);
    ctx.textAlign = 'right';
    ctx.fillStyle = PALETTE.white;
    ctx.font = 'bold 16px "Segoe UI", sans-serif';
    ctx.fillText(v, VIEW_W / 2 + 220, y);
    ctx.font = '16px "Segoe UI", sans-serif';
    y += 24;
  }
  ctx.fillStyle = PALETTE.gold;
  rr(ctx, VIEW_W / 2 - 150, 490, 300, 52, 10); ctx.fill();
  ctx.fillStyle = '#1a0b2e';
  ctx.textAlign = 'center';
  ctx.font = 'bold 20px "Segoe UI", sans-serif';
  ctx.fillText('—  TRY AGAIN  —', VIEW_W / 2, 507);
  ctx.fillStyle = PALETTE.dim;
  ctx.font = '15px "Segoe UI", sans-serif';
  ctx.fillText('Press R or click to restart  ·  M for main menu', VIEW_W / 2, 570);
}

export function drawPaused(ctx) {
  ctx.fillStyle = 'rgba(5, 2, 14, 0.7)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.white;
  ctx.font = 'bold 48px "Segoe UI", sans-serif';
  ctx.fillText('PAUSED', VIEW_W / 2, 400);
  ctx.fillStyle = PALETTE.dim;
  ctx.font = '17px "Segoe UI", sans-serif';
  ctx.fillText('Press P to resume  ·  R to restart', VIEW_W / 2, 440);
}
