// Probe: Lebenslagen-Suche mit realen Queries — jetzt pro Locale.
// Nicht Teil der Build-Pipeline — läuft über `node scripts/probe-search.mjs`
// und druckt die Top-3-Treffer pro Query. Dient als Regression-Check, bevor
// man an Fuse-Threshold, Synonym-Cluster oder Übersetzungen schraubt.
//
// Pro Locale wird der Index aus i18n[locale] gebaut (Fallback auf de, falls
// eine Locale fehlt). Synonym-Cluster gibt es vorerst nur für de; für
// en/fr/it/ls trägt die Trefferqualität allein die übersetzte frage/stichworte
// — genau das wollen wir hier messen.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import Fuse from 'fuse.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');

const leb = JSON.parse(
  readFileSync(resolve(ROOT, 'data/zh/lebenslagen.json'), 'utf8'),
);
const synDe = JSON.parse(
  readFileSync(resolve(ROOT, 'config/synonyms/de.json'), 'utf8'),
);

// Synonym-Dictionaries pro Locale. en/fr/it/ls später nachziehen.
const SYNONYMS = { de: synDe };

// ─── Replik der lib/search.ts-Logik (ESM-Fassung für Node) ──────────────────

function buildSynonymIndex(dict) {
  const idx = new Map();
  if (!dict) return idx;
  for (const cluster of dict.clusters) {
    const norm = cluster.terms.map((t) => t.toLowerCase().trim()).filter(Boolean);
    for (const term of norm) {
      let siblings = idx.get(term);
      if (!siblings) {
        siblings = new Set();
        idx.set(term, siblings);
      }
      for (const other of norm) if (other !== term) siblings.add(other);
    }
  }
  return idx;
}

function tokenize(text) {
  return text.toLowerCase().split(/[^\p{L}\d]+/u).filter((t) => t.length > 1);
}

function expandSynonyms(corpus, synIdx) {
  if (synIdx.size === 0) return [];
  const expanded = new Set();
  for (const piece of corpus) {
    for (const token of tokenize(piece)) {
      const siblings = synIdx.get(token);
      if (siblings) for (const s of siblings) expanded.add(s);
    }
  }
  return Array.from(expanded);
}

function buildFuse(locale) {
  const synIdx = buildSynonymIndex(SYNONYMS[locale]);
  const docs = [];
  for (const l of leb.lebenslagen) {
    const c = l.i18n[locale] ?? l.i18n.de;
    if (!c) continue;
    const corpus = [c.frage, c.antwort ?? '', ...c.stichworte];
    docs.push({ ...l, ...c, _synonyms: expandSynonyms(corpus, synIdx) });
  }
  return new Fuse(docs, {
    keys: [
      { name: 'frage', weight: 0.45 },
      { name: 'stichworte', weight: 0.30 },
      { name: '_synonyms', weight: 0.20 },
      { name: 'antwort', weight: 0.05 },
    ],
    threshold: 0.35,
    ignoreLocation: true,
    minMatchCharLength: 2,
    includeScore: true,
  });
}

// ─── Probes pro Locale ───────────────────────────────────────────────────────

const PROBES = {
  de: [
    // Jargon → Alltagssprache (der eigentliche Use-Case)
    { q: 'Abfall', expect: 'abfall' },
    { q: 'Müll', expect: 'abfall' },
    { q: 'Kehricht', expect: 'abfall' },
    { q: 'Entsorgung', expect: 'abfall' },
    { q: 'Hochzeit', expect: 'heiraten' },
    { q: 'Trauung', expect: 'heiraten' },
    { q: 'Krippe', expect: 'kita-platz' },
    { q: 'Rente', expect: 'ahv-zusatz' },
    { q: 'Krankenhaus', expect: 'spital' },
    { q: 'Badi', expect: 'sportplatz' },
    // Typos
    { q: 'Abfal', expect: 'abfall' },
    { q: 'Hochzit', expect: 'heiraten' },
    { q: 'Reisepas', expect: 'pass-id' },
    { q: 'Umzuk', expect: 'umzug-melden' },
    // Kontrolle: Unsinn → keine Treffer
    { q: 'xyzqwerty', expect: null },
  ],
  en: [
    { q: 'dog tax', expect: 'hund-anmelden' },
    { q: 'passport', expect: 'pass-id' },
    { q: 'marriage', expect: 'heiraten' },
    { q: 'waste', expect: 'abfall' },
    { q: 'recycling', expect: 'abfall' },
    { q: 'hospital', expect: 'spital' },
    { q: 'social assistance', expect: 'sozialhilfe' },
    { q: 'parking permit', expect: 'parkplatz' },
    { q: 'tax return', expect: 'steuern' },
    // Typo
    { q: 'passport', expect: 'pass-id' },
    { q: 'xyzqwerty', expect: null },
  ],
  fr: [
    { q: 'passeport', expect: 'pass-id' },
    { q: 'mariage', expect: 'heiraten' },
    { q: 'déchets', expect: 'abfall' },
    { q: 'impôts', expect: 'steuern' },
    { q: 'hôpital', expect: 'spital' },
    { q: 'aide sociale', expect: 'sozialhilfe' },
    { q: 'pompiers', expect: 'feuerwehr' },
    { q: 'déménagement', expect: 'umzug-melden' },
    { q: 'xyzqwerty', expect: null },
  ],
  it: [
    { q: 'passaporto', expect: 'pass-id' },
    { q: 'matrimonio', expect: 'heiraten' },
    { q: 'rifiuti', expect: 'abfall' },
    { q: 'imposte', expect: 'steuern' },
    { q: 'ospedale', expect: 'spital' },
    { q: 'aiuto sociale', expect: 'sozialhilfe' },
    { q: 'pompieri', expect: 'feuerwehr' },
    { q: 'trasloco', expect: 'umzug-melden' },
    { q: 'xyzqwerty', expect: null },
  ],
  ls: [
    { q: 'hund', expect: 'hund-anmelden' },
    { q: 'müll', expect: 'abfall' },
    { q: 'sozial-hilfe', expect: 'sozialhilfe' },
    { q: 'parkkarte', expect: 'parkplatz' },
    { q: 'pass', expect: 'pass-id' },
    { q: 'xyzqwerty', expect: null },
  ],
};

let totalPass = 0;
let totalFail = 0;

for (const locale of Object.keys(PROBES)) {
  const fuse = buildFuse(locale);
  let pass = 0;
  let fail = 0;
  console.log(`\n[${locale}]  Query                  │ Top-3 Treffer`);
  console.log('     ─────────────────────────┼──────────────────────────────────');
  for (const { q, expect } of PROBES[locale]) {
    if (!q) continue;
    const results = fuse.search(q, { limit: 3 });
    const ids = results.map((r) => r.item.id);
    const matched = expect === null ? ids.length === 0 : ids[0] === expect;
    const icon = matched ? '✓' : '✗';
    if (matched) pass++;
    else fail++;
    const note = matched ? '' : `  (erwartet: ${expect ?? '(keine)'})`;
    console.log(`  ${icon}  ${q.padEnd(22)} │ ${ids.slice(0, 3).join(', ') || '(keine)'}${note}`);
  }
  console.log(`     ${pass}/${pass + fail} Probes bestanden für [${locale}].`);
  totalPass += pass;
  totalFail += fail;
}

console.log(`\n═══ Gesamt: ${totalPass}/${totalPass + totalFail} Probes bestanden. ═══`);
process.exit(totalFail ? 1 : 0);
