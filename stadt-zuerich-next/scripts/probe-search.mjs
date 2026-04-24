// One-off probe: Lebenslagen-Suche mit realen Queries aus dem User-Briefing.
// Nicht Teil der Build-Pipeline — läuft über `node scripts/probe-search.mjs`
// und druckt die Top-3-Treffer pro Query. Dient als Regression-Check, bevor
// man an Fuse-Threshold oder Synonym-Cluster schraubt.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import Fuse from 'fuse.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');

const leb = JSON.parse(
  readFileSync(resolve(ROOT, 'data/zh/lebenslagen.json'), 'utf8'),
);
const syn = JSON.parse(
  readFileSync(resolve(ROOT, 'config/synonyms/de.json'), 'utf8'),
);

// ─── Replik der lib/search.ts-Logik (ESM-Fassung für Node) ──────────────────

function buildSynonymIndex(dict) {
  const idx = new Map();
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
  const expanded = new Set();
  for (const piece of corpus) {
    for (const token of tokenize(piece)) {
      const siblings = synIdx.get(token);
      if (siblings) for (const s of siblings) expanded.add(s);
    }
  }
  return Array.from(expanded);
}

const synIdx = buildSynonymIndex(syn);

const docs = [];
for (const l of leb.lebenslagen) {
  const c = l.i18n.de;
  if (!c) continue;
  const corpus = [c.frage, c.antwort ?? '', ...c.stichworte];
  docs.push({ ...l, ...c, _synonyms: expandSynonyms(corpus, synIdx) });
}

const fuse = new Fuse(docs, {
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

// ─── Probes ─────────────────────────────────────────────────────────────────

const probes = [
  // Jargon → Alltagssprache (der eigentliche Use-Case)
  { q: 'Abfall',       expect: 'abfall' },
  { q: 'Müll',         expect: 'abfall' },
  { q: 'Kehricht',     expect: 'abfall' },
  { q: 'Entsorgung',   expect: 'abfall' },
  { q: 'Hochzeit',     expect: 'heiraten' },
  { q: 'Trauung',      expect: 'heiraten' },
  { q: 'Scheidung',    expect: 'heiraten' },
  { q: 'Krippe',       expect: 'kita-platz' },
  { q: 'Chindsgi',     expect: 'schule-anmelden' },
  { q: 'Rente',        expect: 'ahv-zusatz' },
  { q: 'Krankenhaus',  expect: 'spital' },
  { q: 'Badi',         expect: 'sportplatz' },
  { q: 'Ruhestörung',  expect: 'umwelt' },

  // Typos
  { q: 'Abfal',        expect: 'abfall' },
  { q: 'Hochzit',      expect: 'heiraten' },
  { q: 'Reisepas',     expect: 'pass-id' },
  { q: 'Umzuk',        expect: 'umzug-melden' },

  // Kontrolle: leere Queries / Unsinn → keine Treffer
  { q: '',             expect: null },
  { q: 'xyzqwerty',    expect: null },
];

let pass = 0;
let fail = 0;
console.log('Query                    │ Top-3 Treffer');
console.log('─────────────────────────┼──────────────────────────────────────');
for (const { q, expect } of probes) {
  if (!q) continue;
  const results = fuse.search(q, { limit: 3 });
  const ids = results.map((r) => r.item.id);
  const matched =
    expect === null ? ids.length === 0 : ids[0] === expect;
  const icon = matched ? '✓' : '✗';
  if (matched) pass++;
  else fail++;
  console.log(
    `${icon} ${q.padEnd(22)} │ ${ids.slice(0, 3).join(', ') || '(keine)'}`,
  );
}
console.log('─────────────────────────┴──────────────────────────────────────');
console.log(`${pass}/${pass + fail} Probes bestanden.`);
process.exit(fail ? 1 : 0);
