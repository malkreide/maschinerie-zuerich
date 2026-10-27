#!/usr/bin/env node
// Generator für den Wochenbefund (Ebene 2 der Ansicht «Belege & Herkunft»,
// docs/plan-belege-herkunft.md, Phase P3).
//
// Führt die Rohberichte des Wochenlaufs (.github/workflows/link-rot.yml)
//   --links <pfad>   scripts/check-links.mjs --online --befund-json <pfad>
//   --drift <pfad>   scripts/extract-quotes.mjs --fetch --drift-report --befund-json <pfad>
// mit dem aktuellen Stand der Prozessdaten (url + retrieved_at je Reference)
// zusammen und schreibt data/befunde/<city>.json — aber NUR, wenn sich der
// Inhalt gegenüber dem committeten Snapshot ändert (lib/befunde.ts,
// inhaltGleich). So entsteht ein Bot-PR nur bei neuem Befund (Entscheid E3).
//
// Schutz vor gestörten Läufen: Hat mehr als die Hälfte der URLs gar nicht
// geantwortet (Netz, Proxy), taugt das Ergebnis nicht als Befund — dann wird
// nichts geschrieben (Warnung, Exit 0).
//
// Modi:
//   node --experimental-strip-types scripts/build-befunde.mjs --links a.json --drift b.json [--city zh]
//       → npm run build:befunde -- --links … --drift …
//   node --experimental-strip-types scripts/build-befunde.mjs --validate
//       → npm run validate:befunde (CI: committete Snapshots gegen
//         schemas/befunde-schema.json)
//
// In GitHub Actions schreibt der Build-Modus `geaendert=true|false` nach
// $GITHUB_OUTPUT; der Workflow öffnet nur bei `true` einen PR.

import { appendFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { buildWochenbefund, inhaltGleich, netzfehlerAnteil, serializeWochenbefund } from '../lib/befunde.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, '..');
const BEFUNDE_ROOT = path.join(projectRoot, 'data', 'befunde');
const SCHEMA_PATH = path.join(projectRoot, 'schemas', 'befunde-schema.json');

/** Ab diesem Anteil unbeantworteter URLs gilt der Lauf als gestört. */
const MAX_NETZFEHLER_ANTEIL = 0.5;

const argv = process.argv.slice(2);
const opt = (name, def = null) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : def;
};

async function validator() {
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats.default ? addFormats.default(ajv) : addFormats(ajv);
  return ajv.compile(JSON.parse(await readFile(SCHEMA_PATH, 'utf-8')));
}

const fehlerText = (validate) =>
  (validate.errors ?? []).map((e) => `${e.instancePath || '/'} ${e.message}`).join('; ');

async function validateMode() {
  const validate = await validator();
  let files;
  try {
    files = (await readdir(BEFUNDE_ROOT)).filter((f) => f.endsWith('.json')).sort();
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
    files = [];
  }
  if (files.length === 0) {
    console.log('Noch kein Wochenbefund unter data/befunde/ — nichts zu prüfen.');
    return;
  }
  let fehler = 0;
  for (const file of files) {
    const rel = path.join('data', 'befunde', file);
    const data = JSON.parse(await readFile(path.join(BEFUNDE_ROOT, file), 'utf-8'));
    if (!validate(data)) {
      console.error(`✗ ${rel}: ${fehlerText(validate)}`);
      fehler++;
    } else if (`${data.city}.json` !== file) {
      console.error(`✗ ${rel}: city '${data.city}' passt nicht zum Dateinamen`);
      fehler++;
    } else {
      console.log(`✓ ${rel} gültig (${data.referenzen.length} References, erhoben ${data.erhoben_am})`);
    }
  }
  if (fehler > 0) process.exit(1);
}

/** Stand aller References einer Stadt: url + retrieved_at, wie in den Daten. */
async function referenzStaende(city) {
  const dir = path.join(projectRoot, 'data', 'prozesse', city);
  const out = [];
  for (const file of (await readdir(dir)).filter((f) => f.endsWith('.json')).sort()) {
    const p = JSON.parse(await readFile(path.join(dir, file), 'utf-8'));
    for (const r of p.references ?? []) {
      out.push({
        datei: `data/prozesse/${city}/${file}`,
        slug: `${p.city ?? city}/${p.id}`,
        reference_id: r.reference_id,
        url: r.source_url,
        retrieved_at: r.retrieved_at,
      });
    }
  }
  return out;
}

async function setOutput(geaendert) {
  if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `geaendert=${geaendert}\n`);
}

async function buildMode() {
  const city = opt('--city', 'zh');
  const linksPfad = opt('--links');
  const driftPfad = opt('--drift');
  if (!linksPfad || !driftPfad) {
    console.error('Aufruf: build-befunde.mjs --links <check-links.json> --drift <extract-quotes.json> [--city zh]');
    process.exit(2);
  }
  const links = JSON.parse(await readFile(path.resolve(linksPfad), 'utf-8')).ergebnisse;
  const drift = JSON.parse(await readFile(path.resolve(driftPfad), 'utf-8')).ergebnisse;

  const anteil = netzfehlerAnteil(links);
  if (anteil > MAX_NETZFEHLER_ANTEIL) {
    console.log(
      `⚠ ${Math.round(anteil * 100)} % der URLs ohne Antwort — Lauf gestört, kein Befund geschrieben.`,
    );
    await setOutput(false);
    return;
  }

  const env = process.env;
  const laufUrl =
    env.GITHUB_SERVER_URL && env.GITHUB_REPOSITORY && env.GITHUB_RUN_ID
      ? `${env.GITHUB_SERVER_URL}/${env.GITHUB_REPOSITORY}/actions/runs/${env.GITHUB_RUN_ID}`
      : null;
  const neu = buildWochenbefund({
    city,
    erhobenAm: opt('--erhoben-am', new Date().toISOString()),
    laufUrl,
    umgebung: env.GITHUB_ACTIONS === 'true' ? 'github-actions' : 'lokal',
    links,
    drift,
    referenzen: await referenzStaende(city),
  });

  const validate = await validator();
  if (!validate(neu)) {
    console.error(`✗ Erzeugter Befund verletzt das Schema: ${fehlerText(validate)}`);
    process.exit(1);
  }

  const out = path.join(BEFUNDE_ROOT, `${city}.json`);
  const rel = path.relative(projectRoot, out);
  let alt = null;
  try {
    alt = JSON.parse(await readFile(out, 'utf-8'));
  } catch {
    alt = null;
  }

  const zaehle = (feld, wert) => neu.referenzen.filter((r) => r[feld] === wert).length;
  const zusammenfassung =
    `${neu.referenzen.length} References · ${zaehle('erreichbar', 'tot')} tot · ` +
    `${zaehle('zitat', 'drift')} Zitat-Drift · ${zaehle('fassung', 'ueberholt')} überholte Fassung`;

  if (alt && inhaltGleich(alt, neu)) {
    console.log(`= ${rel} unverändert (${zusammenfassung}) — nichts geschrieben.`);
    await setOutput(false);
    return;
  }
  await mkdir(BEFUNDE_ROOT, { recursive: true });
  await writeFile(out, serializeWochenbefund(neu), 'utf-8');
  console.log(`✓ ${rel} geschrieben (${zusammenfassung}).`);
  await setOutput(true);
}

(argv.includes('--validate') ? validateMode() : buildMode()).catch((err) => {
  console.error(`build-befunde fehlgeschlagen: ${err.message}`);
  process.exit(1);
});
