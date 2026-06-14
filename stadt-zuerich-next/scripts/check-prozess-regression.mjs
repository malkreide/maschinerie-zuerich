#!/usr/bin/env node
// Regression-Guard für handgepflegte Prozessdaten.
//
// Zweck: verhindert, dass ein PR an einer BEREITS bestehenden Prozessdatei
// (data/prozesse/<city>/<id>.json) handgepflegte mehrsprachige Texte
// (i18n-Locales de/en/fr/it/ls) oder description-Blöcke von "befüllt" auf
// "leer/fehlend" zurücksetzt.
//
// Hintergrund: automatisierte Extraktoren (z. B. tessera) schreiben Prozess-
// JSONs strukturell neu — oft nur mit de-Text und leeren en/fr/it. Ein
// ungeprüfter Merge würde reichere Handdaten durch die ärmere Extraktion
// ersetzen (Übersetzungs-/Beschreibungs-Regression). Dieser Check vergleicht
// jede Prozessdatei feldweise UND in der Gesamtabdeckung gegen die Basis-
// Version und schlägt fehl, wenn belegte lokalisierte Texte verloren gehen.
//
// Zwei sich ergänzende Signale, damit der Check sowohl präzise als auch robust
// gegen ein komplettes Umschreiben der Struktur ist:
//   1. Feld-genau (über stabile Schlüssel step_id / reference_id / actor.id):
//      dasselbe Feld existiert in beiden Versionen, aber eine zuvor nicht-leere
//      Locale ist jetzt leer/entfernt  →  exakter Fehlerzeiger.
//   2. Abdeckungs-Zählung pro Locale über die ganze Datei: sinkt die Zahl der
//      nicht-leeren Texte einer Locale, ist das eine Regression — auch wenn der
//      Extraktor die Struktur (step_ids) komplett neu vergeben hat und die
//      Feld-Schlüssel deshalb nicht mehr zusammenpassen.
//
// Basis-Ref-Auflösung: BASE_REF, sonst origin/$GITHUB_BASE_REF, sonst
// origin/main. Lässt sich die Basis nicht auflösen (z. B. fehlende Historie),
// wird mit Warnung übersprungen statt fälschlich blockiert.
//
// Bewusste Reduktion gewünscht? `ALLOW_PROZESS_SHRINK=1` setzt den Check auf
// reine Warnung herab (Escape-Hatch für seltene, beabsichtigte Streichungen).
//
// Exit-Code: 0 = keine Regression. 1 = Regression gefunden.

import { readFile, readdir, stat } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, '..');
const repoRoot = path.resolve(projectRoot, '..');
const PROZESSE_ROOT = path.join(projectRoot, 'data', 'prozesse');

const LOCALES = ['de', 'en', 'fr', 'it', 'ls'];
const ALLOW_SHRINK = process.env.ALLOW_PROZESS_SHRINK === '1';

// --- Colors ---------------------------------------------------------------
const isTTY = process.stdout.isTTY && !process.env.NO_COLOR;
const col = {
  red: (s) => (isTTY ? `\x1b[31m${s}\x1b[0m` : s),
  green: (s) => (isTTY ? `\x1b[32m${s}\x1b[0m` : s),
  yellow: (s) => (isTTY ? `\x1b[33m${s}\x1b[0m` : s),
  dim: (s) => (isTTY ? `\x1b[2m${s}\x1b[0m` : s),
};

// --- Basis-Ref ------------------------------------------------------------
function resolveBaseRef() {
  if (process.env.BASE_REF) return process.env.BASE_REF;
  if (process.env.GITHUB_BASE_REF) return `origin/${process.env.GITHUB_BASE_REF}`;
  return 'origin/main';
}

function refExists(ref) {
  try {
    execFileSync('git', ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`], {
      cwd: repoRoot,
      stdio: ['ignore', 'ignore', 'ignore'],
    });
    return true;
  } catch {
    return false;
  }
}

// Inhalt einer Datei in der Basis-Version holen; null, wenn dort (noch) nicht
// vorhanden (neue Datei → keine Regression möglich).
function baseContent(ref, gitPath) {
  try {
    return execFileSync('git', ['show', `${ref}:${gitPath}`], {
      cwd: repoRoot,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
      maxBuffer: 32 * 1024 * 1024,
    });
  } catch {
    return null;
  }
}

// --- i18n-Erkennung -------------------------------------------------------
// Ein i18n-Map ist ein Objekt, dessen Schlüssel ausschliesslich aus den
// bekannten Locales stammen und dessen Werte Strings sind (leere Strings
// eingeschlossen — genau die schreibt der Extraktor).
function isI18nMap(o) {
  if (!o || typeof o !== 'object' || Array.isArray(o)) return false;
  const keys = Object.keys(o);
  if (keys.length === 0) return false;
  return keys.every((k) => LOCALES.includes(k) && typeof o[k] === 'string');
}

function nonEmptyLocales(o) {
  const out = {};
  for (const loc of LOCALES) {
    if (typeof o[loc] === 'string' && o[loc].trim() !== '') out[loc] = o[loc];
  }
  return out;
}

// Stabiler Array-Element-Schlüssel: bevorzugt fachliche IDs, damit das
// Hinzufügen/Entfernen von Schritten die Zuordnung der übrigen nicht
// verschiebt.
function arrayKey(el, index) {
  if (el && typeof el === 'object' && !Array.isArray(el)) {
    if ('step_id' in el) return `step_id=${el.step_id}`;
    if ('reference_id' in el) return `reference_id=${el.reference_id}`;
    if ('id' in el) return `id=${el.id}`;
  }
  return `${index}`;
}

// Sammelt alle i18n-Maps der Datei als Map<stabilerPfad, {locale: text}>
// (nur nicht-leere Locales).
function collectI18n(node, parts, out) {
  if (node == null) return;
  if (isI18nMap(node)) {
    out.set(parts.join('/'), nonEmptyLocales(node));
    return;
  }
  if (Array.isArray(node)) {
    node.forEach((el, i) => collectI18n(el, [...parts, arrayKey(el, i)], out));
    return;
  }
  if (typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) collectI18n(v, [...parts, k], out);
  }
}

function localeCoverage(i18nMap) {
  const cov = Object.fromEntries(LOCALES.map((l) => [l, 0]));
  for (const locales of i18nMap.values()) {
    for (const loc of Object.keys(locales)) cov[loc] += 1;
  }
  return cov;
}

// --- Vergleich ------------------------------------------------------------
function compare(baseData, headData) {
  const baseMap = new Map();
  const headMap = new Map();
  collectI18n(baseData, [], baseMap);
  collectI18n(headData, [], headMap);

  // 1. Feld-genaue Verluste (Feld in beiden Versionen vorhanden).
  const fieldLosses = [];
  for (const [key, baseLoc] of baseMap) {
    const headLoc = headMap.get(key);
    if (!headLoc) continue; // Feld fehlt ganz → Signal 2 (Abdeckung) fängt das.
    for (const loc of Object.keys(baseLoc)) {
      if (!(loc in headLoc)) {
        fieldLosses.push({ key, loc, was: baseLoc[loc] });
      }
    }
  }

  // 2. Abdeckungs-Regression pro Locale (robust gegen Struktur-Umbau).
  const baseCov = localeCoverage(baseMap);
  const headCov = localeCoverage(headMap);
  const covLosses = [];
  for (const loc of LOCALES) {
    if (headCov[loc] < baseCov[loc]) {
      covLosses.push({ loc, base: baseCov[loc], head: headCov[loc] });
    }
  }

  return { fieldLosses, covLosses, baseCov, headCov };
}

// --- Dateien finden -------------------------------------------------------
async function listProzessFiles() {
  const files = [];
  let cities;
  try {
    cities = await readdir(PROZESSE_ROOT);
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
  for (const city of cities) {
    const cityDir = path.join(PROZESSE_ROOT, city);
    const st = await stat(cityDir).catch(() => null);
    if (!st?.isDirectory()) continue;
    for (const e of await readdir(cityDir)) {
      if (e.endsWith('.json')) files.push({ abs: path.join(cityDir, e) });
    }
  }
  return files;
}

// --- Main -----------------------------------------------------------------
async function main() {
  const baseRef = resolveBaseRef();
  if (!refExists(baseRef)) {
    console.log(
      col.yellow(
        `⚠ Basis-Ref '${baseRef}' nicht auflösbar — Regression-Check übersprungen.`,
      ),
    );
    console.log(
      col.dim(
        '  (In CI: actions/checkout mit fetch-depth: 0 und git fetch origin <base>.)',
      ),
    );
    return;
  }

  const files = await listProzessFiles();
  let regressionFiles = 0;

  for (const { abs } of files) {
    const gitPath = path.relative(repoRoot, abs).split(path.sep).join('/');
    const rel = path.relative(projectRoot, abs);

    const baseRaw = baseContent(baseRef, gitPath);
    if (baseRaw == null) {
      console.log(col.dim(`· ${rel}: neu (keine Basis) — übersprungen`));
      continue;
    }

    let baseData;
    let headData;
    try {
      baseData = JSON.parse(baseRaw);
    } catch (err) {
      console.log(col.dim(`· ${rel}: Basis nicht parsbar (${err.message}) — übersprungen`));
      continue;
    }
    try {
      headData = JSON.parse(await readFile(abs, 'utf-8'));
    } catch (err) {
      // Defekte Head-JSON ist Sache von validate-prozesse; hier nicht doppelt
      // melden, nur überspringen.
      console.log(col.dim(`· ${rel}: Head nicht parsbar (${err.message}) — übersprungen`));
      continue;
    }

    const { fieldLosses, covLosses, baseCov, headCov } = compare(baseData, headData);

    if (fieldLosses.length === 0 && covLosses.length === 0) {
      console.log(col.green(`✓ ${rel}`));
      continue;
    }

    regressionFiles++;
    const tag = ALLOW_SHRINK ? col.yellow('⚠') : col.red('✗');
    console.error(`${tag} ${rel}: i18n-/description-Regression gegen ${baseRef}`);

    for (const { key, loc, was } of fieldLosses) {
      console.error(
        col.red(
          `  - Feld '${key}': ${loc}-Text verloren (war: "${was.slice(0, 60)}${was.length > 60 ? '…' : ''}")`,
        ),
      );
    }
    for (const { loc, base, head } of covLosses) {
      console.error(
        col.red(`  - Abdeckung ${loc}: ${base} → ${head} belegte Texte (−${base - head})`),
      );
    }
    console.error(
      col.dim(
        `    Abdeckung gesamt: ${LOCALES.map((l) => `${l} ${baseCov[l]}→${headCov[l]}`).join(', ')}`,
      ),
    );
  }

  console.log('');
  if (regressionFiles === 0) {
    console.log(`${files.length} Datei(en) gegen ${baseRef} geprüft. ${col.green('✓ Keine Regression.')}`);
    return;
  }

  if (ALLOW_SHRINK) {
    console.log(
      col.yellow(
        `${regressionFiles} Datei(en) mit Reduktion — durch ALLOW_PROZESS_SHRINK=1 nur Warnung.`,
      ),
    );
    return;
  }

  console.error(
    col.red(
      `\n${regressionFiles} Datei(en) verlieren handgepflegte Texte gegenüber ${baseRef}.`,
    ),
  );
  console.error(
    col.dim(
      'Handdaten (Übersetzungen/description) dürfen nicht durch ärmere Extraktion ersetzt\n' +
        'werden. Vorhandene Felder feldweise mergen statt überschreiben. Ist die Reduktion\n' +
        'wirklich beabsichtigt, den Check mit ALLOW_PROZESS_SHRINK=1 als Warnung fahren.',
    ),
  );
  process.exit(1);
}

main().catch((err) => {
  console.error(col.red(`check-prozess-regression failed: ${err.message}`));
  process.exit(1);
});
