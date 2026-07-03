#!/usr/bin/env node
// Referenzen-Gate (CI, nur Pull Requests): prüft die im PR NEU hinzugefügten
// oder GEÄNDERTEN References der Prozessdaten live gegen ihre Quelle.
//
// Motivation (docs/branch-protection.md): `status: "verifiziert"` war bisher
// selbst-attestiert — kein Gate prüfte zum Merge-Zeitpunkt, ob der Deep-Link
// lebt und das source_quote wirklich wörtlich auf der Seite steht. Genau
// diese beiden Behauptungen trägt die Kardinalregel («Link, don't assert»).
//
// Was das Gate prüft — NUR für References, die sich gegenüber der PR-Basis
// unterscheiden (bestehende, unveränderte Belege werden nicht angefasst;
// Link-Rot in Bestandsdaten bleibt Sache des wöchentlichen link-rot.yml):
//
//   1. Liveness: HTTP-GET der source_url.
//        • 404 / 410 / 5xx  → FEHLER (toter Deep-Link im PR)
//        • 401 / 403 / 429  → WARNUNG (Bot-Schutz/Rate-Limit — umgebungs-
//          abhängig, kein Datenfehler; Taxonomie wie check-links.mjs)
//        • Netzfehler       → WARNUNG (Netzwerkpolicy, kein Datenfehler)
//   2. Verbatim: steht das source_quote (whitespace-normalisiert) wörtlich
//      im Text der Seite? Nur prüfbar, wenn die Seite lesbar war.
//        • nicht gefunden   → FEHLER (Zitat-Drift oder erfundenes Zitat)
//        • Seite liefert kaum Text (JS-SPA) → WARNUNG «nicht prüfbar»,
//          menschliches Review bleibt zuständig (extract-quotes.mjs ohne
//          --fetch rendert solche Seiten im Browser).
//
// Exit 1 bei mindestens einem FEHLER. Keine Escape-Hatches: wer einen toten
// Link oder ein driftendes Zitat mergen will, muss erst die Daten fixen.
//
// Aufruf:  node scripts/check-refs-gate.mjs [--base origin/main]
// In CI:   --base "origin/$GITHUB_BASE_REF" (siehe .github/workflows/ci.yml)

process.env.NODE_USE_ENV_PROXY ??= '1';

import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { htmlToText, normWs } from './lib/html-text.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(here, '..');           // stadt-zuerich-next/
const repoRoot = path.resolve(appRoot, '..');        // Repo-Wurzel

const argv = process.argv.slice(2);
const opt = (name, def) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : def;
};
const BASE = opt(
  '--base',
  process.env.GITHUB_BASE_REF ? `origin/${process.env.GITHUB_BASE_REF}` : 'origin/main',
);
const TIMEOUT = Number(opt('--timeout', '20000'));
const CONCURRENCY = 4;

const UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) ' +
  'Chrome/126.0 Safari/537.36 maschinerie-zuerich-refsgate/1.0';

// Unterhalb dieser Textlänge werten wir eine Seite als «nicht prüfbar»
// (JS-SPA, deren Inhalt erst clientseitig entsteht) statt als Zitat-Drift.
const MIN_PAGE_TEXT = 200;

function git(...args) {
  return execFileSync('git', args, { cwd: repoRoot, encoding: 'utf-8' });
}

// ── Geänderte Prozessdateien (gegen die Merge-Basis) ────────────────────────
let mergeBase;
try {
  mergeBase = git('merge-base', BASE, 'HEAD').trim();
} catch {
  console.error(`Basis '${BASE}' nicht gefunden — vorher 'git fetch origin <base>' ausführen.`);
  process.exit(2);
}

const changed = git('diff', '--name-status', `${mergeBase}..HEAD`, '--', 'stadt-zuerich-next/data/prozesse')
  .split('\n')
  .filter(Boolean)
  .map((l) => {
    const [status, ...rest] = l.split('\t');
    return { status: status[0], path: rest[rest.length - 1] };
  })
  .filter((f) => f.path.endsWith('.json') && f.status !== 'D');

if (!changed.length) {
  console.log(`✓ Keine geänderten Prozessdateien gegenüber ${BASE} — Referenzen-Gate übersprungen.`);
  process.exit(0);
}

// ── Neue/geänderte References einsammeln ────────────────────────────────────
function refKeyFields(r) {
  return {
    url: r.source_url ?? '',
    quote: typeof r.source_quote === 'string' ? normWs(r.source_quote) : '',
    status: r.status ?? '',
  };
}

const toCheck = []; // { file, reference_id, label, url, quote, reason }
for (const f of changed) {
  let current;
  try {
    current = JSON.parse(await readFile(path.join(repoRoot, f.path), 'utf-8'));
  } catch (err) {
    console.error(`${f.path}: JSON nicht lesbar (${err.message}) — validiert validate:prozesse.`);
    continue;
  }
  let baseRefs = new Map();
  if (f.status !== 'A') {
    try {
      const baseJson = JSON.parse(git('show', `${mergeBase}:${f.path}`));
      baseRefs = new Map((baseJson.references ?? []).map((r) => [r.reference_id, refKeyFields(r)]));
    } catch {
      // Basis-Version nicht lesbar (z. B. Rename) → alle References gelten als neu.
    }
  }
  for (const r of current.references ?? []) {
    const now = refKeyFields(r);
    const before = baseRefs.get(r.reference_id);
    const isNew = before === undefined;
    const isChanged = before && (before.url !== now.url || before.quote !== now.quote || before.status !== now.status);
    if (!isNew && !isChanged) continue;
    if (!now.url) continue; // fehlende/leere URL meldet validate:prozesse
    toCheck.push({
      file: f.path,
      reference_id: r.reference_id,
      label: r.label?.de ?? '',
      url: now.url,
      quote: now.quote,
      reason: isNew ? 'neu' : 'geändert',
    });
  }
}

if (!toCheck.length) {
  console.log(`✓ ${changed.length} Prozessdatei(en) geändert, aber keine neuen/geänderten References — Gate grün.`);
  process.exit(0);
}

// ── Live-Prüfung ────────────────────────────────────────────────────────────
const uniqueUrls = [...new Set(toCheck.map((r) => r.url))];
console.log(
  `Referenzen-Gate: ${toCheck.length} neue/geänderte Reference(s) in ${changed.length} Datei(en), ` +
    `${uniqueUrls.length} eindeutige URL(s), Basis ${BASE} (${mergeBase.slice(0, 10)}).`,
);

function classify(status) {
  if (status < 400) return 'ok';
  if (status === 404 || status === 410 || status >= 500) return 'tot';
  return 'blockiert';
}

async function fetchPage(url) {
  try {
    const res = await fetch(url, {
      headers: { 'user-agent': UA, 'accept-language': 'de-CH,de;q=0.9' },
      redirect: 'follow',
      signal: AbortSignal.timeout(TIMEOUT),
    });
    const html = await res.text();
    return { kind: classify(res.status), status: res.status, text: htmlToText(html) };
  } catch (err) {
    const reason = err.name === 'TimeoutError' ? 'Timeout' : err.message.split('\n')[0];
    return { kind: 'netzfehler', status: 0, text: '', reason };
  }
}

const pages = new Map();
{
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, uniqueUrls.length) }, async () => {
      while (i < uniqueUrls.length) {
        const url = uniqueUrls[i++];
        pages.set(url, await fetchPage(url));
      }
    }),
  );
}

// ── Auswertung ──────────────────────────────────────────────────────────────
const errors = [];
const warnings = [];

for (const r of toCheck) {
  const page = pages.get(r.url);
  const where = `${r.file} ref ${r.reference_id} (${r.reason}) «${r.label}»`;

  if (page.kind === 'tot') {
    errors.push(`${where}\n    toter Deep-Link [${page.status}]: ${r.url}`);
    continue;
  }
  if (page.kind === 'blockiert') {
    warnings.push(`${where}\n    Quelle blockiert diesen Client [${page.status}] — Liveness/Verbatim nicht prüfbar: ${r.url}`);
    continue;
  }
  if (page.kind === 'netzfehler') {
    warnings.push(`${where}\n    Netzfehler (${page.reason}) — Liveness/Verbatim nicht prüfbar: ${r.url}`);
    continue;
  }

  // Seite lesbar → Verbatim-Prüfung des source_quote.
  if (!r.quote) continue; // ohne Quote nichts zu prüfen (Grounding-Gate macht validate:prozesse)
  if (page.text.length < MIN_PAGE_TEXT) {
    warnings.push(`${where}\n    Seite liefert kaum Text (${page.text.length} Zeichen, JS-SPA?) — Verbatim nicht prüfbar: ${r.url}`);
    continue;
  }
  if (!normWs(page.text).includes(r.quote)) {
    errors.push(
      `${where}\n    source_quote NICHT wörtlich auf der Seite gefunden (Drift oder erfunden): ${r.url}\n` +
        `    Zitat: «${r.quote.slice(0, 160)}${r.quote.length > 160 ? '…' : ''}»`,
    );
  }
}

if (warnings.length) {
  console.log(`\n⚠ WARNUNGEN (${warnings.length}) — umgebungsabhängig, kippen das Gate nicht:`);
  for (const w of warnings) console.log(`  ⚠ ${w}`);
}

const checked = toCheck.length - warnings.length - errors.length;
if (errors.length) {
  console.error(`\n✗ FEHLER (${errors.length}):`);
  for (const e of errors) console.error(`  ✗ ${e}`);
  console.error(
    '\nTote Links korrigieren bzw. source_quote wörtlich von der Live-Seite übernehmen ' +
      '(Kandidaten: npm run extract:quotes -- --fetch --file <datei>).',
  );
  process.exit(1);
}
console.log(`\n✓ Referenzen-Gate grün: ${checked} Reference(s) live geprüft, ${warnings.length} nicht prüfbar (Warnung).`);
