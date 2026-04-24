// Wiederverwendbare Migration-Plumbing für OpenGov-Process-Schema.
// Jede konkrete Migration (migrate-prozesse-schema-v2.mjs, -v3.mjs, ...)
// importiert runMigration() und liefert nur die transform()-Funktion.
//
// Features:
//   - Default Dry-Run: zeigt an, was sich ändern würde, schreibt aber nichts.
//     --write (oder -w) aktiviert tatsächliches Schreiben.
//   - Version-Guard: überspringt Dateien, die nicht auf der erwarteten
//     Source-Version sind (mit Warnung, kein Fehler — idempotent).
//   - Atomare Writes (write-temp + rename) — bei Abbruch bleibt das Original
//     intakt.
//   - Diff-Log: zeigt pro Datei die geänderten Top-Level-Keys.
//   - Exit 1 bei Fehlern (JSON parse / transform-Ausnahmen).

import { readFile, readdir, rename, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, '..');
const PROZESSE_ROOT = path.join(projectRoot, 'data', 'prozesse');

const isTTY = process.stdout.isTTY && !process.env.NO_COLOR;
const c = {
  red:    (s) => isTTY ? `\x1b[31m${s}\x1b[0m` : s,
  green:  (s) => isTTY ? `\x1b[32m${s}\x1b[0m` : s,
  yellow: (s) => isTTY ? `\x1b[33m${s}\x1b[0m` : s,
  cyan:   (s) => isTTY ? `\x1b[36m${s}\x1b[0m` : s,
  dim:    (s) => isTTY ? `\x1b[2m${s}\x1b[0m` : s,
};

async function walkProzessFiles() {
  const out = [];
  let cities;
  try { cities = await readdir(PROZESSE_ROOT); }
  catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
  for (const city of cities) {
    const cityDir = path.join(PROZESSE_ROOT, city);
    const st = await stat(cityDir).catch(() => null);
    if (!st?.isDirectory()) continue;
    for (const file of await readdir(cityDir)) {
      if (file.endsWith('.json')) out.push({ city, file, abs: path.join(cityDir, file) });
    }
  }
  return out;
}

/** Prüft, ob ein SemVer-String in den erwarteten Bereich fällt.
 *  Akzeptiert: exakter String ODER MAJOR-Prefix ('1.' matcht '1.0.0', '1.2.7').
 *  Wir brauchen keine volle semver-Vergleichslogik — Migrationen laufen
 *  immer MAJOR-weise. */
function versionMatches(version, pattern) {
  if (!version) return false;
  if (version === pattern) return true;
  if (pattern.endsWith('.')) return version.startsWith(pattern);
  // fallback: Major-Prefix
  const [patMajor] = pattern.split('.');
  const [verMajor] = version.split('.');
  return patMajor === verMajor;
}

/** Liefert die geänderten Top-Level-Keys zwischen zwei Objekten.
 *  Für Diff-Log — nicht für Semantik. */
function changedKeys(before, after) {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const changed = [];
  for (const k of keys) {
    if (JSON.stringify(before[k]) !== JSON.stringify(after[k])) changed.push(k);
  }
  return changed;
}

/**
 * Führt eine Migration über alle Prozess-JSONs aus.
 *
 * @param {Object} opts
 * @param {string} opts.fromVersion  SemVer oder Major-Prefix ('1.' oder '1.0.0'), der als Ausgangslage erwartet wird.
 * @param {string} opts.toVersion    Ziel-SemVer-String, der im Ergebnis gesetzt wird.
 * @param {(prozess: object, ctx: {city: string, file: string}) => object} opts.transform
 *   Reine Funktion: nimmt das Prozess-Objekt, gibt ein neues (migriertes) Objekt zurück.
 *   Muss die neue Version NICHT selbst setzen — runMigration kümmert sich darum.
 * @param {string} opts.title        Menschlich lesbarer Name der Migration für Log-Output.
 */
export async function runMigration({ fromVersion, toVersion, transform, title }) {
  const args = process.argv.slice(2);
  const write = args.includes('--write') || args.includes('-w');
  const verbose = args.includes('--verbose') || args.includes('-v');

  console.log(c.cyan(`Migration: ${title}`));
  console.log(c.dim(`  from: ${fromVersion}  →  to: ${toVersion}`));
  console.log(c.dim(`  mode: ${write ? 'WRITE (files will be modified)' : 'dry-run (no files written — use --write to apply)'}`));
  console.log('');

  const files = await walkProzessFiles();
  if (files.length === 0) {
    console.log(c.yellow('No prozess files found.'));
    return;
  }

  let migrated = 0;
  let skipped = 0;
  let errors = 0;

  for (const { city, file, abs } of files) {
    const rel = path.relative(projectRoot, abs);
    let raw, before;
    try {
      raw = await readFile(abs, 'utf-8');
      before = JSON.parse(raw);
    } catch (err) {
      console.error(c.red(`✗ ${rel}: ${err.message}`));
      errors++;
      continue;
    }

    if (!versionMatches(before.version, fromVersion)) {
      console.log(c.dim(`  skip ${rel} (version=${before.version}, expected ${fromVersion})`));
      skipped++;
      continue;
    }

    let after;
    try {
      after = transform(structuredClone(before), { city, file });
    } catch (err) {
      console.error(c.red(`✗ ${rel}: transform failed — ${err.message}`));
      errors++;
      continue;
    }

    after.version = toVersion;
    const changes = changedKeys(before, after);
    if (changes.length === 0) {
      console.log(c.dim(`  no-op ${rel} (no content change)`));
      skipped++;
      continue;
    }

    console.log(`${write ? c.green('✓') : c.yellow('~')} ${rel}  ${c.dim(`[${changes.join(', ')}]`)}`);
    if (verbose) {
      console.log(c.dim(`    before.version=${before.version}  after.version=${after.version}`));
    }

    if (write) {
      // Formatter: 2-space JSON + trailing newline (matches repo convention).
      const serialized = JSON.stringify(after, null, 2) + '\n';
      const tmp = abs + '.migrate.tmp';
      await writeFile(tmp, serialized, 'utf-8');
      await rename(tmp, abs);
    }
    migrated++;
  }

  console.log('');
  const summary = `${files.length} scanned · ${c.green(migrated + ' migrated')} · ${skipped} skipped · ${errors ? c.red(errors + ' errors') : '0 errors'}`;
  console.log(summary);

  if (!write && migrated > 0) {
    console.log(c.yellow(`\nDry-run: nothing written. Re-run with --write to apply.`));
  }
  if (errors > 0) process.exit(1);
}
