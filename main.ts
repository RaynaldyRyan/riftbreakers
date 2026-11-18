// RIFTBREAKERS — entry program: copies game/ and screenshots/ to the output
// directory and writes dossier.json with the kit's buildDossier library.
import { cpSync, mkdirSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoDir = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR || '/output';

mkdirSync(outDir, { recursive: true });
cpSync(join(repoDir, 'game'), join(outDir, 'game'), { recursive: true });
cpSync(join(repoDir, 'screenshots'), join(outDir, 'screenshots'), { recursive: true });

// The gate's caps (best-game-01): text capped at 160 KiB, at most 4
// screenshots of at most 256 KiB each, game/ at most 993 entries / 48 MiB.
const CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

const dossierBytes = buildDossier(outDir, CAPS);
writeFileSync(join(outDir, 'dossier.json'), dossierBytes);

const shots = readdirSync(join(outDir, 'screenshots')).filter((f) => !f.startsWith('.'));
console.log(`wrote ${outDir} (game, ${shots.length} screenshots, dossier.json ${dossierBytes.length} bytes)`);
