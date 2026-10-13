#!/usr/bin/env node
// Link-Checker für alle URLs in den offenen Daten.
//
// STRUKTUR-Modus (Standard): rein strukturell — prüft, dass jede URL
// wohlgeformt und absolut (https) ist. Kein Netzwerk, damit der Check auch in
// abgeschotteten Umgebungen (Allowlist) verlässlich als CI-Gate läuft.
//
// LIVE-HTTP-Modus (--online | CHECK_LINKS_ONLINE=1): ruft zusätzlich jede
// eindeutige URL real ab (HEAD; scheitert es, GET) und meldet Link-Rot. Die
// Befunde werden kategorisiert, weil „nicht erreichbar" je nach Aufrufer
// Verschiedenes heisst:
//
//   • tot       → 404 / 410 / 5xx: die Seite gibt es so nicht mehr. Ebenso
//                 eine unbekannte Domain, sofern ein öffentlicher DNS-
//                 Resolver NXDOMAIN bestätigt. Echtes Link-Rot, das in den
//                 Daten korrigiert gehört.
//   • blockiert → 401 / 403 / 429: Quelle antwortet, lehnt aber diesen Client
//                 ab (Bot-Schutz, Rate-Limit, IP-Sperre). Hängt von der
//                 Umgebung ab, ist KEIN Datenfehler.
//   • Netzfehler→ Timeout / Verbindung verweigert: aus dieser Umgebung
//                 nicht erreichbar (Netzwerkpolicy). Ebenfalls umgebungs-
//                 abhängig, kein Datenfehler.
//
// Nicht abgerufen werden Spec-Kennungen (json-schema.org) und Basisadressen:
// URLs, die nur unter `baseUrl`/`…BaseUrl`/`…RawUrl` stehen, sind Präfixe für
// die App, keine Links (scripts/lib/basis-urls.mjs). Strukturell geprüft
// werden sie weiterhin.
//
// Exit-Verhalten im Live-Modus:
//   • advisory (Standard): meldet alles, Exit 0 — die Erreichbarkeit hängt von
//     der Netzwerkpolicy ab und soll den Build nicht kippen.
//   • --strict | CHECK_LINKS_STRICT=1: Exit 1, sobald ein echt TOTER Link
//     (404/410/5xx) gefunden wird. Blockiert/Netzfehler kippen NIE, weil sie
//     IP-/policy-abhängig sind (z. B. gov-Sites, die GitHub-Actions-IPs sperren).
//
// Hinweis: Der Check sieht nur den HTTP-Status. Viele amtliche Seiten sind
// JavaScript-SPAs, die auch bei verschobenem Inhalt ein 200 liefern
// („soft 404"). Ein grüner Live-Check garantiert also Erreichbarkeit, nicht
// inhaltliche Richtigkeit der Belegstelle.

import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { zaehleBasisUrls } from './lib/basis-urls.mjs';
import { LINKCHECK_HEADERS, dnsBefundeEinordnen, probeUrl } from './lib/link-probe.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

const args = new Set(process.argv.slice(2));
const ONLINE = args.has('--online') || process.env.CHECK_LINKS_ONLINE === '1';
const STRICT = args.has('--strict') || process.env.CHECK_LINKS_STRICT === '1';

const HTTP_TIMEOUT_MS = 15000;
const CONCURRENCY = 6;

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
const filesByUrl = new Map(); // url -> Set(file)
const basisVorkommen = new Map(); // url -> Anzahl Vorkommen unter Basis-Schlüsseln

for (const rel of await listFiles()) {
  let text;
  try {
    text = await readFile(path.join(root, rel), 'utf-8');
  } catch {
    continue;
  }
  try {
    zaehleBasisUrls(JSON.parse(text), basisVorkommen);
  } catch {
    // kein gültiges JSON → keine Basisadressen; Struktur meldet validate:*
  }
  for (const raw of text.match(URL_RE) ?? []) {
    const url = raw.replace(/[.,]+$/, ''); // evtl. Satzzeichen am Ende abschneiden
    occurrences.push({ url, file: rel });
    if (!filesByUrl.has(url)) filesByUrl.set(url, new Set());
    filesByUrl.get(url).add(rel);
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

if (!ONLINE) {
  // Hinweis auf den Live-Modus, ohne ihn zu erzwingen.
  console.log('\n(Live-HTTP-Check übersprungen — mit `npm run check:links:online` oder --online aktivieren.)');
  process.exit(0);
}

// ── Live-HTTP-Check ────────────────────────────────────────────────────────

// Spec-Identifier sind keine abrufbaren Seiten → aus dem Live-Check nehmen.
const SKIP_HOSTS = new Set(['json-schema.org']);
// Basisadressen (API-Endpunkt, Repo-Präfix) sind keine Links: abgerufen
// liefern sie systembedingt 404/403. Übersprungen nur, wenn die URL AUSSCHLIESS-
// LICH unter einem Basis-Schlüssel steht (scripts/lib/basis-urls.mjs).
const vorkommen = new Map();
for (const o of occurrences) vorkommen.set(o.url, (vorkommen.get(o.url) ?? 0) + 1);
const nurBasis = (u) => (basisVorkommen.get(u) ?? 0) >= (vorkommen.get(u) ?? 0);
const basisUebersprungen = unique.filter((u) => !SKIP_HOSTS.has(new URL(u).hostname) && nurBasis(u));
const toCheck = unique.filter((u) => !SKIP_HOSTS.has(new URL(u).hostname) && !nurBasis(u));
if (basisUebersprungen.length) {
  console.log(`\nBasisadressen (kein Link, nicht abgerufen): ${basisUebersprungen.join(', ')}`);
}

const probe = (url) =>
  probeUrl(url, { headers: LINKCHECK_HEADERS, timeoutMs: HTTP_TIMEOUT_MS });

// Einfacher Nebenläufigkeits-Pool, höflich gegenüber den Quellen.
async function runPool(items, worker, size) {
  const out = [];
  let i = 0;
  const runners = Array.from({ length: Math.min(size, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await worker(items[idx]);
    }
  });
  await Promise.all(runners);
  return out;
}

console.log(`\nLive-HTTP-Check (${toCheck.length} URLs, ${CONCURRENCY} parallel, Timeout ${HTTP_TIMEOUT_MS / 1000}s) …`);

const results = await dnsBefundeEinordnen(await runPool(toCheck, probe, CONCURRENCY));

const byKind = { tot: [], blockiert: [], netzfehler: [] };
for (const r of results) {
  if (r.kind !== 'ok') byKind[r.kind].push(r);
}

const fmtFiles = (url) => [...(filesByUrl.get(url) ?? [])].join(', ');

function report(kind, title) {
  const list = byKind[kind];
  if (!list.length) return;
  console.log(`\n${title} (${list.length}):`);
  for (const r of list.sort((a, b) => a.url.localeCompare(b.url))) {
    const code = r.status ? r.status : (r.reason ?? 'Fehler');
    console.log(`  ${kind === 'tot' ? '✗' : '⚠'} [${code}] ${r.url}`);
    console.log(`      ↳ ${fmtFiles(r.url)}`);
  }
}

report('tot', '✗ TOT — echtes Link-Rot, bitte in den Daten korrigieren');
report('blockiert', '⚠ BLOCKIERT — Quelle lehnt diesen Client ab (Bot-Schutz/Rate-Limit), kein Datenfehler');
report('netzfehler', '⚠ NETZFEHLER — aus dieser Umgebung nicht erreichbar (Netzwerkpolicy), kein Datenfehler');

const okCount = results.length - byKind.tot.length - byKind.blockiert.length - byKind.netzfehler.length;
console.log(
  `\nLive-Ergebnis: ${okCount} ok · ${byKind.tot.length} tot · ` +
    `${byKind.blockiert.length} blockiert · ${byKind.netzfehler.length} netzfehler`,
);

if (byKind.tot.length > 0) {
  if (STRICT) {
    console.error(`\n✗ ${byKind.tot.length} toter Link/Links (strict) — Exit 1.`);
    process.exit(1);
  }
  console.log('\n(advisory — mit --strict bzw. CHECK_LINKS_STRICT=1 würden tote Links den Lauf rot machen.)');
} else {
  console.log('\n✓ Keine toten Links gefunden.');
}
