#!/usr/bin/env node
// Validiert public/openapi.json und public/data-catalog.json:
//  - beide sind gültiges JSON
//  - OpenAPI hat die erwarteten Pfade
//  - jeder Datensatz im Katalog hat id/title/license
//  - referenzierte schemaPath-Dateien existieren im Repo
//  - Katalog verweist auf die richtige OpenAPI-Datei
//
// Exit-Code: 0 = ok, 1 = Fehler.

import { readFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const problems = [];

async function loadJson(rel) {
  try {
    return JSON.parse(await readFile(path.join(root, rel), 'utf-8'));
  } catch (err) {
    problems.push(`${rel}: ungültiges JSON — ${err.message}`);
    return null;
  }
}

async function exists(rel) {
  try {
    await access(path.join(root, rel));
    return true;
  } catch {
    return false;
  }
}

const openapi = await loadJson('public/openapi.json');
const catalog = await loadJson('public/data-catalog.json');

if (openapi) {
  if (!/^3\./.test(openapi.openapi ?? '')) problems.push('openapi.json: openapi-Version fehlt/ungültig');
  for (const p of ['/api/v1/org', '/api/v1/prozesse']) {
    if (!openapi.paths?.[p]?.get) problems.push(`openapi.json: Pfad ${p} (GET) fehlt`);
  }
}

if (catalog) {
  const vocab = Object.keys(catalog.provenanceVocabulary ?? {});
  if (!Array.isArray(catalog.datasets) || catalog.datasets.length === 0) {
    problems.push('data-catalog.json: datasets fehlt/leer');
  } else {
    for (const d of catalog.datasets) {
      const tag = `data-catalog.json[${d.id ?? '?'}]`;
      if (!d.id) problems.push(`${tag}: id fehlt`);
      if (!d.title) problems.push(`${tag}: title fehlt`);
      if (!d.license) problems.push(`${tag}: license fehlt`);
      if (!d.provenance) problems.push(`${tag}: provenance fehlt`);
      else if (!vocab.includes(d.provenance)) problems.push(`${tag}: unbekannte provenance '${d.provenance}'`);
      if (d.schemaPath && !(await exists(d.schemaPath))) {
        problems.push(`${tag}: schemaPath '${d.schemaPath}' existiert nicht`);
      }
    }
  }
  if (catalog.api?.openapi !== '/openapi.json') {
    problems.push("data-catalog.json: api.openapi sollte '/openapi.json' sein");
  }
  if (!catalog.provenanceVocabulary || typeof catalog.provenanceVocabulary !== 'object') {
    problems.push('data-catalog.json: provenanceVocabulary fehlt');
  }
}

if (problems.length) {
  console.error('Katalog-/OpenAPI-Validierung fehlgeschlagen:\n  ' + problems.join('\n  '));
  process.exit(1);
}
console.log('✓ openapi.json und data-catalog.json sind gültig und konsistent.');
