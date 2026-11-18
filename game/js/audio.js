// RIFTBREAKERS — synthesized sound effects (WebAudio, no audio files).
// Every effect is an oscillator/noise burst built in code.

let ctx = null;
let master = null;
let muted = false;

export function ensureAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0.16;
    master.connect(ctx.destination);
  } catch (e) { ctx = null; }
}

export function setMuted(m) { muted = m; if (master) master.gain.value = m ? 0 : 0.16; }
export function isMuted() { return muted; }

function tone(freq, dur, type, vol, slideTo) {
  if (!ctx || muted) return;
  const t0 = ctx.currentTime;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type || 'square';
  o.frequency.setValueAtTime(freq, t0);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
  g.gain.setValueAtTime(vol || 0.5, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  o.connect(g); g.connect(master);
  o.start(t0); o.stop(t0 + dur + 0.02);
}

function noise(dur, vol, lowpass) {
  if (!ctx || muted) return;
  const t0 = ctx.currentTime;
  const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol || 0.5, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  let node = src;
  if (lowpass) {
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = lowpass;
    src.connect(f); node = f;
  }
  node.connect(g); g.connect(master);
  src.start(t0);
}

export const sfx = {
  shoot() { tone(880 + Math.random() * 120, 0.07, 'square', 0.12, 320); },
  hit() { tone(220, 0.06, 'triangle', 0.25, 140); },
  explode() { noise(0.35, 0.5, 900); tone(90, 0.3, 'sine', 0.5, 40); },
  bigExplode() { noise(0.7, 0.7, 600); tone(70, 0.6, 'sine', 0.7, 30); },
  shard() { tone(1320, 0.09, 'sine', 0.2, 1980); },
  levelup() { tone(523, 0.12, 'triangle', 0.3); setTimeout(() => tone(659, 0.12, 'triangle', 0.3), 90); setTimeout(() => tone(784, 0.2, 'triangle', 0.3), 180); },
  ability() { tone(440, 0.15, 'sawtooth', 0.25, 1100); },
  dash() { noise(0.12, 0.25, 3000); },
  hurt() { tone(160, 0.18, 'sawtooth', 0.4, 60); },
  bossRoar() { tone(55, 0.8, 'sawtooth', 0.5, 110); noise(0.6, 0.3, 400); },
  win() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.25, 'triangle', 0.35), i * 140)); },
  lose() { [392, 330, 262, 196].forEach((f, i) => setTimeout(() => tone(f, 0.3, 'triangle', 0.3), i * 160)); },
  click() { tone(660, 0.05, 'sine', 0.2); },
};
