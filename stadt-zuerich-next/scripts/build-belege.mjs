#!/usr/bin/env node
// Generator für das deterministische Belege-Aggregat über ALLE Prozesse
// (Ebene 1 der Ansicht «Belege & Herkunft», docs/plan-belege-herkunft.md).
//
// Liest jede Prozessdatei unter data/prozesse/<city>/*.json, faltet die
// Belegkette via lib/belege.ts zu einem Stadt-Aggregat und schreibt
// data/belege/<city>.json — bit-identisch bei gleichem Input. Netzfrei: ob
// Links leben oder Zitate driften, misst der Wochenlauf (link-rot.yml).
//
// Modi:
//   node --experimental-strip-types scripts/build-belege.mjs
//       → schreibt/aktualisiert data/belege/<city>.json (npm run build:belege)
//   node --experimental-strip-types scripts/build-belege.mjs --check
//       → schreibt NICHTS, vergleicht nur das committete Artefakt gegen die
//         frische Ableitung; Exit 1 bei Drift (npm run check:belege, CI-Gate)
//
// Gleiches Muster wie scripts/build-portfolio.mjs.

import { readFile, readdir, stat, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildBelege, serializeBelege } from '../lib/belege.ts';
import { erkenneFassung } from './lib/gesetzesfassung.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, '..');
const PROZESSE_ROOT = path.join(projectRoot, 'data', 'prozesse');
const BELEGE_ROOT = path.join(projectRoot, 'data', 'belege');
const EBENEN_PATH = path.join(projectRoot, 'config', 'quellen-ebenen.json');

const isTTY = process.stdout.isTTY && !process.env.NO_COLOR;
const c = {
  red: (s) => (isTTY ? `\x1b[31m${s}\x1b[0m` : s),
  green: (s) => (isTTY ? `\x1b[32m${s}\x1b[0m` : s),
  yellow: (s) => (isTTY ? `\x1b[33m${s}\x1b[0m` : s),
  dim: (s) => (isTTY ? `\x1b[2m${s}\x1b[0m` : s),
};

/** Liest alle Prozesse je Stadt ein, gruppiert nach city. Defekte Dateien
 *  brechen den Lauf ab (das Artefakt soll vollständig sein, nicht still lückig). */
async function loadProzesseByCity() {
  const byCity = new Map();
  let cities;
  try {
    cities = await readdir(PROZESSE_ROOT);
  } catch (err) {
    if (err.code === 'ENOENT') return byCity;
    throw err;
  }
  for (const city of cities.sort()) {
    const cityDir = path.join(PROZESSE_ROOT, city);
    const st = await stat(cityDir).catch(() => null);
    if (!st?.isDirectory()) continue;
    const files = (await readdir(cityDir)).filter((f) => f.endsWith('.json')).sort();
    const list = [];
    for (const file of files) {
      list.push(JSON.parse(await readFile(path.join(cityDir, file), 'utf-8')));
    }
    if (list.length > 0) byCity.set(city, list);
  }
  return byCity;
}

/** Host-Regeln für eine Stadt: 'bund' global, 'stadt'/'kanton' je Stadt. */
function regelnFuer(cfg, city) {
  const s = cfg.staedte?.[city] ?? {};
  return { stadt: s.stadt ?? [], kanton: s.kanton ?? [], bund: cfg.bund ?? [] };
}

async function main() {
  const check = process.argv.includes('--check');
  const cfg = JSON.parse(await readFile(EBENEN_PATH, 'utf-8'));
  const byCity = await loadProzesseByCity();

  if (byCity.size === 0) {
    console.log(c.yellow('Keine Prozessdateien unter data/prozesse/*/ — nichts zu tun.'));
    return;
  }

  let drift = false;
  if (!check) await mkdir(BELEGE_ROOT, { recursive: true });

  for (const [city, prozesse] of byCity) {
    const belege = buildBelege(city, prozesse, {
      regeln: regelnFuer(cfg, city),
      istGesetzesfassung: (url) => erkenneFassung(url) !== null,
    });
    const serialized = serializeBelege(belege);
    const out = path.join(BELEGE_ROOT, `${city}.json`);
    const rel = path.relative(projectRoot, out);

    // Nicht eingeordnete Hosts sichtbar machen (kein Fehler: 'andere' ist eine
    // legitime Ebene, aber eine neue Quelle soll bewusst eingeordnet werden).
    const andere = [
      ...new Set(belege.prozesse.flatMap((z) => z.referenzen.filter((r) => r.ebene === 'andere').map((r) => r.host))),
    ].sort();
    if (andere.length > 0) {
      console.log(
        c.yellow(`⚠ ${city}: ${andere.length} Host(s) ohne Ebene → 'andere': ${andere.join(', ')}`) +
          c.dim(' (config/quellen-ebenen.json ergänzen, falls amtlich)'),
      );
    }

    if (check) {
      let current = null;
      try {
        current = await readFile(out, 'utf-8');
      } catch {
        current = null;
      }
      if (current === null) {
        console.error(c.red(`✗ ${rel} fehlt — bitte 'npm run build:belege' ausführen und committen.`));
        drift = true;
      } else if (current !== serialized) {
        console.error(c.red(`✗ ${rel} ist veraltet — 'npm run build:belege' ausführen und committen.`));
        drift = true;
      } else {
        console.log(c.green(`✓ ${rel} aktuell (${belege.summary.prozesse} Prozesse)`));
      }
    } else {
      await writeFile(out, serialized, 'utf-8');
      const s = belege.summary;
      console.log(
        c.green(`✓ ${rel} geschrieben`) +
          c.dim(
            ` — ${s.prozesse} Prozesse, ${s.referenzen} References, ${s.verifiziert} verifiziert, ${s.mitZitat} mit Zitat, ${s.hochrisiko} Hochrisiko`,
          ),
      );
    }
  }

  if (check && drift) {
    console.error('');
    console.error(c.red('Belege-Artefakt nicht synchron mit den Prozessdaten.'));
    process.exit(1);
  }
  console.log('');
  console.log(check ? c.green('✓ Belege-Artefakt aktuell.') : c.green('✓ Belege-Artefakt erzeugt.'));
}

main().catch((err) => {
  console.error(c.red(`build-belege fehlgeschlagen: ${err.message}`));
  process.exit(1);
});
