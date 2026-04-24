#!/usr/bin/env node
// Validiert alle Prozess-JSONs unter data/prozesse/<city>/*.json
// gegen schemas/opengov-process-schema.json.
//
// Zwei Stufen:
//   1. Formale Validierung via ajv (JSON-Schema draft-07) — inkl. Format-
//      Checks für uri/date. Schlägt bei Pflichtfeldern, falschen Typen,
//      ungültigen Enums an.
//   2. Semantische Validierung — das Schema kann keine Referenzen prüfen:
//      - Schritt.akteur muss in akteure[].id existieren
//      - Flow.von/nach muss in schritte[].id existieren
//      - Jeder Knoten sollte vom Start aus erreichbar sein (Warnung)
//      - Schritt.quelle (falls gesetzt) muss in quellen[].id existieren
//      - Bei Entscheidungs-Schritten sollte mindestens eine ausgehende Flow-
//        Kante eine bedingung tragen
//
// Exit-Code: 0 = alles gut. 1 = Fehler. Warnungen stehen auf stderr, brechen
// aber nicht ab.

import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, '..');
const SCHEMA_PATH = path.join(projectRoot, 'schemas', 'opengov-process-schema.json');
const PROZESSE_ROOT = path.join(projectRoot, 'data', 'prozesse');

// --- Colors ---------------------------------------------------------------
const isTTY = process.stdout.isTTY && !process.env.NO_COLOR;
const c = {
  red:   (s) => isTTY ? `\x1b[31m${s}\x1b[0m` : s,
  green: (s) => isTTY ? `\x1b[32m${s}\x1b[0m` : s,
  yellow:(s) => isTTY ? `\x1b[33m${s}\x1b[0m` : s,
  dim:   (s) => isTTY ? `\x1b[2m${s}\x1b[0m` : s,
};

// --- Helpers --------------------------------------------------------------

async function loadJson(file) {
  return JSON.parse(await readFile(file, 'utf-8'));
}

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
    const entries = await readdir(cityDir);
    for (const e of entries) {
      if (e.endsWith('.json')) {
        files.push({ city, file: e, abs: path.join(cityDir, e) });
      }
    }
  }
  return files;
}

function formatAjvError(err) {
  const loc = err.instancePath || '/';
  return `${loc}: ${err.message}${err.params ? ' ' + JSON.stringify(err.params) : ''}`;
}

function semanticCheck(prozess) {
  const errors = [];
  const warnings = [];

  const akteurIds = new Set((prozess.akteure ?? []).map((a) => a.id));
  const schrittIds = new Set((prozess.schritte ?? []).map((s) => s.id));
  const quellenIds = new Set((prozess.quellen ?? []).map((q) => q.id));

  // Schritt-Referenzen
  for (const s of prozess.schritte ?? []) {
    if (!akteurIds.has(s.akteur)) {
      errors.push(`schritt '${s.id}' references unknown akteur '${s.akteur}'`);
    }
    if (s.quelle !== undefined && !quellenIds.has(s.quelle)) {
      errors.push(`schritt '${s.id}' references unknown quelle '${s.quelle}'`);
    }
  }

  // Flow-Referenzen
  for (const f of prozess.flow ?? []) {
    if (!schrittIds.has(f.von)) errors.push(`flow '${f.von}' -> '${f.nach}': unknown 'von'`);
    if (!schrittIds.has(f.nach)) errors.push(`flow '${f.von}' -> '${f.nach}': unknown 'nach'`);
  }

  // Erreichbarkeit vom Start aus (Warnung, kein Fehler)
  const starts = (prozess.schritte ?? []).filter((s) => s.typ === 'start').map((s) => s.id);
  if (starts.length === 0) {
    warnings.push('no start node');
  } else if (starts.length > 1) {
    warnings.push(`multiple start nodes: ${starts.join(', ')}`);
  }
  if (starts.length > 0) {
    const adj = new Map();
    for (const s of prozess.schritte) adj.set(s.id, []);
    for (const f of prozess.flow ?? []) {
      if (adj.has(f.von)) adj.get(f.von).push(f.nach);
    }
    const seen = new Set();
    const queue = [...starts];
    while (queue.length) {
      const cur = queue.shift();
      if (seen.has(cur)) continue;
      seen.add(cur);
      for (const nxt of adj.get(cur) ?? []) queue.push(nxt);
    }
    for (const s of prozess.schritte) {
      if (!seen.has(s.id)) warnings.push(`schritt '${s.id}' unreachable from start`);
    }
  }

  // Entscheidungs-Knoten: mindestens eine ausgehende Kante mit 'bedingung'
  for (const s of prozess.schritte ?? []) {
    if (s.typ !== 'entscheidung') continue;
    const out = (prozess.flow ?? []).filter((f) => f.von === s.id);
    if (out.length < 2) {
      warnings.push(`entscheidung '${s.id}' has ${out.length} outgoing edge(s) — decisions usually have ≥2`);
    }
    if (!out.some((f) => f.bedingung)) {
      warnings.push(`entscheidung '${s.id}' has no edge with 'bedingung' label`);
    }
  }

  // Ende-Knoten: keine ausgehenden Kanten
  for (const s of prozess.schritte ?? []) {
    if (s.typ !== 'ende') continue;
    const out = (prozess.flow ?? []).filter((f) => f.von === s.id);
    if (out.length > 0) errors.push(`ende-node '${s.id}' must not have outgoing edges`);
  }

  // Start-Knoten: keine eingehenden Kanten (Warnung — Loops zurück zum Start sind selten sinnvoll)
  for (const s of prozess.schritte ?? []) {
    if (s.typ !== 'start') continue;
    const incoming = (prozess.flow ?? []).filter((f) => f.nach === s.id);
    if (incoming.length > 0) warnings.push(`start-node '${s.id}' has ${incoming.length} incoming edge(s)`);
  }

  return { errors, warnings };
}

// --- Main ----------------------------------------------------------------

async function main() {
  const schema = await loadJson(SCHEMA_PATH);
  // Draft-07. ajv v8 braucht explizit die Draft-Angabe via $schema oder
  // addSchema. Unser Schema hat $schema draft-07, also reicht new Ajv().
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats.default ? addFormats.default(ajv) : addFormats(ajv);
  const validate = ajv.compile(schema);

  const files = await listProzessFiles();
  if (files.length === 0) {
    console.log(c.yellow('No prozess files found under data/prozesse/*/'));
    return;
  }

  let anyError = false;
  let anyWarn = false;

  for (const { city, file, abs } of files) {
    const rel = path.relative(projectRoot, abs);
    let data;
    try {
      data = await loadJson(abs);
    } catch (err) {
      console.error(c.red(`✗ ${rel}: invalid JSON — ${err.message}`));
      anyError = true;
      continue;
    }

    const schemaOk = validate(data);
    const { errors: semErrors, warnings } = semanticCheck(data);

    if (schemaOk && semErrors.length === 0 && warnings.length === 0) {
      console.log(c.green(`✓ ${rel}`));
      continue;
    }

    if (!schemaOk) {
      console.error(c.red(`✗ ${rel}: schema violations`));
      for (const err of validate.errors ?? []) {
        console.error(c.red(`  - ${formatAjvError(err)}`));
      }
      anyError = true;
    }
    if (semErrors.length > 0) {
      console.error(c.red(`✗ ${rel}: semantic errors`));
      for (const e of semErrors) console.error(c.red(`  - ${e}`));
      anyError = true;
    }
    if (warnings.length > 0) {
      console.error(c.yellow(`⚠ ${rel}: warnings`));
      for (const w of warnings) console.error(c.yellow(`  - ${w}`));
      anyWarn = true;
      if (schemaOk && semErrors.length === 0) {
        console.log(c.dim(`  (${city}/${file} passes schema + semantic — warnings only)`));
      }
    }
  }

  const summary = `${files.length} file(s) checked.`;
  if (anyError) {
    console.error(c.red(`\n${summary} ✗ Errors found.`));
    process.exit(1);
  }
  if (anyWarn) {
    console.error(c.yellow(`\n${summary} ⚠ Warnings only — ok.`));
  } else {
    console.log(c.green(`\n${summary} ✓ All good.`));
  }
}

main().catch((err) => {
  console.error(c.red(`validate-prozesse crashed: ${err.stack ?? err}`));
  process.exit(2);
});
