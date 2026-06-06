#!/usr/bin/env node
// Link-Checker für alle URLs in den offenen Daten.
//
// CI-Modus (Standard): rein STRUKTURELL — prüft, dass jede URL wohlgeformt und
// absolut (https) ist. Kein Netzwerk, damit der Check auch in abgeschotteten
// Umgebungen (Allowlist) verlässlich läuft.
//
// Online-Modus (CHECK_LINKS_ONLINE=1): zusätzlich HEAD/GET je eindeutiger URL
// mit Timeout — meldet tote Links als WARNUNG (kein CI-Fehler), da die
// Erreichbarkeit von der Netzwerkpolicy abhängt.

import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

async function listFiles() {
  const files = [
    'public/data-catalog.json',
    'public/openapi.json',
    'config/geo-layers.json',
    'config/city.config.json',
    'data/zh/org-chart.json',
    'schemas/opengov-machinery-schema.json',
    'schemas/opengov-process-schema.json',
  ];
  for (const f of await readdir(path.join(root, 'data/prozesse/zh'))) {
    if (f.endsWith('.json')) files.push('data/prozesse/zh/' + f);
  }
  return files;
}

const URL_RE = /https?:\/\/[^\s"'<>)\]]+/g;

const errors = [];
const occurrences = []; // { url, file }

for (const rel of await listFiles()) {
  let text;
  try {
    text = await readFile(path.join(root, rel), 'utf-8');
  } catch {
    continue;
  }
  for (const raw of text.match(URL_RE) ?? []) {
    const url = raw.replace(/[.,]+$/, ''); // evtl. Satzzeichen am Ende abschneiden
    occurrences.push({ url, file: rel });
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      errors.push(`${rel}: ungültige URL '${url}'`);
      continue;
    }
    // json-schema.org-Kennungen sind kanonische Spec-Identifier (offiziell
    // http://), keine abrufbaren Links — von der https-Pflicht ausgenommen.
    if (parsed.protocol !== 'https:' && parsed.hostname !== 'json-schema.org') {
      errors.push(`${rel}: nicht-https URL '${url}'`);
    }
    if (!parsed.hostname) {
      errors.push(`${rel}: URL ohne Host '${url}'`);
    }
  }
}

const unique = [...new Set(occurrences.map((o) => o.url))];
const hosts = [...new Set(unique.map((u) => new URL(u).hostname))].sort();

console.log(`Geprüft: ${occurrences.length} URL-Vorkommen, ${unique.length} eindeutig, ${hosts.length} Hosts.`);
console.log('Hosts: ' + hosts.join(', '));

if (errors.length) {
  console.error('\nStrukturfehler:\n  ' + errors.join('\n  '));
  process.exit(1);
}
console.log('✓ Alle URLs strukturell gültig (absolut, https).');

if (process.env.CHECK_LINKS_ONLINE === '1') {
  console.log('\nOnline-Check (advisory) …');
  let dead = 0;
  for (const url of unique) {
    try {
      const ctrl = AbortSignal.timeout(10000);
      let res = await fetch(url, { method: 'HEAD', signal: ctrl, redirect: 'follow' });
      if (res.status >= 400) {
        // manche Server lehnen HEAD ab → GET-Fallback
        res = await fetch(url, { method: 'GET', signal: AbortSignal.timeout(10000), redirect: 'follow' });
      }
      if (res.status >= 400) {
        dead++;
        console.warn(`  ⚠ ${res.status} ${url}`);
      }
    } catch (err) {
      dead++;
      console.warn(`  ⚠ ${url} — ${err.message}`);
    }
  }
  console.log(dead === 0 ? '✓ Alle Links erreichbar.' : `⚠ ${dead} Link(s) nicht erreichbar (advisory).`);
}
