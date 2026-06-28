#!/usr/bin/env node
// Generator für das deterministische Portfolio-Aggregat über ALLE Prozesse.
//
// Liest jede Prozessdatei unter data/prozesse/<city>/*.json, leitet die
// Bewertungs-Indikatoren über die EINE Single Source (lib/bewertung.ts) ab,
// faltet sie via lib/portfolio.ts zu einem Stadt-Aggregat und schreibt
// data/portfolio/<city>.json — bit-identisch bei gleichem Input.
//
// Modi:
//   node --experimental-strip-types scripts/build-portfolio.mjs
//       → schreibt/aktualisiert data/portfolio/<city>.json (npm run build:portfolio)
//   node --experimental-strip-types scripts/build-portfolio.mjs --check
//       → schreibt NICHTS, vergleicht nur das committete Artefakt gegen die
//         frische Ableitung; Exit 1 bei Drift (npm run check:portfolio, CI-Gate)
//
// Läuft unter --experimental-strip-types, damit die TS-Libs ohne Build-Schritt
// importierbar sind (.ts-Endung Pflicht; @/-Type-Imports werden gestrippt).
// Exakt dasselbe Muster wie tests/bewertung.test.mjs.

import { readFile, readdir, stat, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildBewertung } from '../lib/bewertung.ts';
import { buildPortfolio, serializePortfolio } from '../lib/portfolio.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, '..');
const PROZESSE_ROOT = path.join(projectRoot, 'data', 'prozesse');
const PORTFOLIO_ROOT = path.join(projectRoot, 'data', 'portfolio');

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
      const abs = path.join(cityDir, file);
      const p = JSON.parse(await readFile(abs, 'utf-8'));
      list.push(p);
    }
    if (list.length > 0) byCity.set(city, list);
  }
  return byCity;
}

function portfolioForCity(city, prozesse) {
  const inputs = prozesse.map((p) => ({
    city: p.city ?? city,
    id: p.id,
    report: buildBewertung(p),
  }));
  return buildPortfolio(city, inputs);
}

async function main() {
  const check = process.argv.includes('--check');
  const byCity = await loadProzesseByCity();

  if (byCity.size === 0) {
    console.log(c.yellow('Keine Prozessdateien unter data/prozesse/*/ — nichts zu tun.'));
    return;
  }

  let drift = false;
  if (!check) await mkdir(PORTFOLIO_ROOT, { recursive: true });

  for (const [city, prozesse] of byCity) {
    const portfolio = portfolioForCity(city, prozesse);
    const serialized = serializePortfolio(portfolio);
    const out = path.join(PORTFOLIO_ROOT, `${city}.json`);
    const rel = path.relative(projectRoot, out);

    if (check) {
      let current = null;
      try {
        current = await readFile(out, 'utf-8');
      } catch {
        current = null;
      }
      if (current === null) {
        console.error(c.red(`✗ ${rel} fehlt — bitte 'npm run build:portfolio' ausführen und committen.`));
        drift = true;
      } else if (current !== serialized) {
        console.error(c.red(`✗ ${rel} ist veraltet — 'npm run build:portfolio' ausführen und committen.`));
        drift = true;
      } else {
        console.log(c.green(`✓ ${rel} aktuell (${portfolio.summary.prozesse} Prozesse)`));
      }
    } else {
      await writeFile(out, serialized, 'utf-8');
      const luecken = portfolio.summary.ohneBeleg;
      console.log(
        c.green(`✓ ${rel} geschrieben`) +
          c.dim(
            ` — ${portfolio.summary.prozesse} Prozesse, ${portfolio.summary.mitBeleg} mit Beleg, ${luecken} ohne belegte Digitalisierungs-Indikatoren`,
          ),
      );
    }
  }

  if (check && drift) {
    console.error('');
    console.error(c.red('Portfolio-Artefakt nicht synchron mit den Prozessdaten.'));
    process.exit(1);
  }
  console.log('');
  console.log(check ? c.green('✓ Portfolio-Artefakt aktuell.') : c.green('✓ Portfolio-Artefakt erzeugt.'));
}

main().catch((err) => {
  console.error(c.red(`build-portfolio fehlgeschlagen: ${err.message}`));
  process.exit(1);
});
