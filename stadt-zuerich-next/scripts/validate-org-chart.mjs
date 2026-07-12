#!/usr/bin/env node
// Validiert die Org-Chart-JSON(s) gegen schemas/opengov-machinery-schema.json.
//
// Hintergrund: Bislang prüfte die CI nur JSON-Syntax und Lebenslagen-IDs.
// Das opengov-machinery-schema.json existierte, wurde aber nie erzwungen —
// Schema und Daten konnten auseinanderlaufen (z.B. _meta.stand als reines
// Datum vs. date-time, fehlendes top-level "organization"). Dieser Job
// schliesst die Lücke: Schema-Verstösse brechen die CI ab.
//
// Mehrere Städte: Pfade kommen aus config/city.config.json (Single Source
// of Truth, identisch zu validate-prozesse.mjs / loadStadtData).
//
// Exit-Code: 0 = ok, 1 = Schema-Verstoss, 2 = Skript-Absturz.

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, '..');
const SCHEMA_PATH = path.join(projectRoot, 'schemas', 'opengov-machinery-schema.json');
const CITY_CONFIG_PATH = path.join(projectRoot, 'config', 'city.config.json');

const isTTY = process.stdout.isTTY && !process.env.NO_COLOR;
const c = {
  red: (s) => (isTTY ? `\x1b[31m${s}\x1b[0m` : s),
  green: (s) => (isTTY ? `\x1b[32m${s}\x1b[0m` : s),
  yellow: (s) => (isTTY ? `\x1b[33m${s}\x1b[0m` : s),
};

async function loadJson(file) {
  return JSON.parse(await readFile(file, 'utf-8'));
}

function formatAjvError(err) {
  const loc = err.instancePath || '/';
  return `${loc}: ${err.message}${err.params ? ' ' + JSON.stringify(err.params) : ''}`;
}

async function orgChartPaths() {
  // Aktuell führt city.config.json genau eine Stadt (ZH). Sobald
  // scaffold:city weitere Städte anlegt, kann hier über eine Liste
  // iteriert werden — die Struktur ist pro Stadt identisch.
  const cfg = JSON.parse(await readFile(CITY_CONFIG_PATH, 'utf-8'));
  return [{ city: cfg.id, abs: path.join(projectRoot, cfg.orgChartPath) }];
}

async function main() {
  const schema = await loadJson(SCHEMA_PATH);
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats.default ? addFormats.default(ajv) : addFormats(ajv);
  const validate = ajv.compile(schema);

  const files = await orgChartPaths();
  let anyError = false;

  for (const { city, abs } of files) {
    const rel = path.relative(projectRoot, abs);
    let data;
    try {
      data = await loadJson(abs);
    } catch (err) {
      console.error(c.red(`✗ ${rel}: invalid JSON — ${err.message}`));
      anyError = true;
      continue;
    }

    if (validate(data)) {
      const counts = `${data.departments?.length ?? 0} Departemente, ${data.units?.length ?? 0} Units, ${data.beteiligungen?.length ?? 0} Beteiligungen`;
      console.log(c.green(`✓ ${rel} (${city}) — schema-konform: ${counts}`));
    } else {
      console.error(c.red(`✗ ${rel} (${city}): schema violations`));
      for (const err of validate.errors ?? []) {
        console.error(c.red(`  - ${formatAjvError(err)}`));
      }
      anyError = true;
    }
  }

  if (anyError) {
    console.error(c.red('\nOrg-Chart-Validierung fehlgeschlagen.'));
    process.exit(1);
  }
  console.log(c.green('\nAlle Org-Chart-Dateien sind schema-konform.'));
}

main().catch((err) => {
  console.error(c.red(`validate-org-chart crashed: ${err.stack ?? err}`));
  process.exit(2);
});
