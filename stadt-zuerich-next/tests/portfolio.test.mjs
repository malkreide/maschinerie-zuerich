// Unit-Tests für den Portfolio-Aggregator lib/portfolio.ts.
//
// Lauf: node --experimental-strip-types --test tests/portfolio.test.mjs
// (npm run test:unit). Beide Libs haben nur type-only Imports, daher genügt
// Node-Type-Stripping ohne Pfad-Alias-Auflösung.
//
// Kernansprüche:
//   - alle Prozesse rein → ein Aggregat raus, reproduzierbar (bit-identisch).
//   - «unbekannt» ist eine eigene Kategorie, nie als 0/«nicht erfüllt» kaschiert.
//   - Prozesse ohne Belege werden TRANSPARENT (belegLuecke) ausgewiesen,
//     nicht still weggelassen.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildBewertung } from '../lib/bewertung.ts';
import { buildPortfolio, serializePortfolio } from '../lib/portfolio.ts';

/** i18n-Helfer für Fixtures. */
const alle = (s) => ({ de: s, en: s, fr: s, it: s, ls: s });

/** Reicher, voll belegter Prozess (Digitalisierung belegt + Nutzend voll). */
function prozessReich(id = 'reich') {
  return {
    schema_version: '0.1.0',
    id,
    lebenslage_ref: id,
    city: 'zh',
    title: alle('Reich'),
    target_audience: 'bevoelkerung',
    source_url: 'https://example.org',
    retrieved_at: '2026-01-01',
    disclaimer_key: 'Prozesse.disclaimer',
    preconditions: [alle('V1')],
    references: [
      {
        reference_id: 1,
        label: alle('Gebühr'),
        source_url: 'https://example.org/q',
        source_quote: 'Zitat',
        retrieved_at: '2026-01-01',
      },
    ],
    steps: [
      { step_id: 1, actor: 'a', label: alle('Start'), depends_on: [], type: 'start' },
      { step_id: 2, actor: 'b', label: alle('Ende'), depends_on: [1] },
    ],
    bewertung: {
      indikatoren: [
        {
          key: 'online-antrag',
          wert: true,
          source_url: 'https://example.org/portal',
          source_quote: 'Antrag online möglich',
          retrieved_at: '2026-01-01',
        },
      ],
    },
  };
}

/** Minimaler Prozess: nur de, KEINE Belege → Digitalisierung komplett unbekannt. */
function prozessMinimal(id = 'minimal') {
  return {
    schema_version: '0.1.0',
    id,
    lebenslage_ref: id,
    city: 'zh',
    title: { de: 'Minimal' },
    target_audience: 'bevoelkerung',
    source_url: 'https://example.org',
    retrieved_at: '2026-01-01',
    disclaimer_key: 'Prozesse.disclaimer',
    steps: [{ step_id: 1, actor: 'x', label: { de: 'Schritt' }, depends_on: [] }],
  };
}

const toInput = (p) => ({ city: p.city, id: p.id, report: buildBewertung(p) });
const rowBySlug = (pf, slug) => pf.prozesse.find((r) => r.slug === slug);
const colSum = (pf, key) => pf.summary.proIndikator.find((s) => s.key === key);

test('Determinismus: gleicher Input → identisches Aggregat und identische Bytes', () => {
  const inputsA = [prozessReich(), prozessMinimal()].map(toInput);
  const inputsB = [prozessReich(), prozessMinimal()].map(toInput);
  const a = buildPortfolio('zh', inputsA);
  const b = buildPortfolio('zh', inputsB);
  assert.deepEqual(a, b);
  // Bit-Identität der Serialisierung (für aussagekräftige Diffs).
  assert.equal(serializePortfolio(a), serializePortfolio(b));
  // Abschliessender Newline gehört zum kanonischen Format.
  assert.ok(serializePortfolio(a).endsWith('}\n'));
});

test('Zeilen-Reihenfolge ist stabil, unabhängig von der Eingabe-Reihenfolge', () => {
  const r = prozessReich();
  const m = prozessMinimal();
  const vorwaerts = serializePortfolio(buildPortfolio('zh', [r, m].map(toInput)));
  const rueckwaerts = serializePortfolio(buildPortfolio('zh', [m, r].map(toInput)));
  assert.equal(vorwaerts, rueckwaerts);
});

test('Spalten = stabile Indikator-Reihenfolge aus buildBewertung', () => {
  const pf = buildPortfolio('zh', [prozessReich()].map(toInput));
  assert.deepEqual(
    pf.spalten.map((s) => s.key),
    [
      'online-antrag',
      'online-bezahlung',
      'statusverfolgung',
      'medienbruchfrei',
      'digital-abschliessbar',
      'once-only',
      'eid-moeglich',
      'leichte-sprache',
      'mehrsprachigkeit',
      'voraussetzungen-genannt',
      'fristen-kosten-verlinkt',
      'barrierefreiheit',
      'nicht-digitaler-alternativweg',
    ],
  );
  // eid-moeglich ist informativ → gezaehlt: false, der Rest gezaehlt: true.
  assert.equal(pf.spalten.find((s) => s.key === 'eid-moeglich').gezaehlt, false);
  assert.equal(pf.spalten.find((s) => s.key === 'online-antrag').gezaehlt, true);
});

test('«unbekannt» bleibt eigene Kategorie — nie 0 oder «nicht erfüllt»', () => {
  const pf = buildPortfolio('zh', [prozessMinimal()].map(toInput));
  const row = rowBySlug(pf, 'zh/minimal');
  // Alle belegpflichtigen Digital-Indikatoren ohne Beleg → unbekannt.
  for (const key of ['online-antrag', 'online-bezahlung', 'statusverfolgung', 'medienbruchfrei', 'digital-abschliessbar', 'once-only']) {
    assert.equal(row.zellen.find((z) => z.key === key).status, 'unbekannt', key);
  }
  // Score: kein Digital-Score (prozent null), unbekannt separat gezählt — NICHT 0.
  assert.equal(row.score.digitalisierung.prozent, null);
  assert.equal(row.score.digitalisierung.unbekannt, 6);
  assert.equal(row.score.digitalisierung.erfuellt, 0);
});

test('Transparenz: Prozess ohne Belege wird ausgewiesen, nicht weggelassen', () => {
  const pf = buildPortfolio('zh', [prozessReich(), prozessMinimal()].map(toInput));
  // Beide Prozesse erscheinen (keiner still gefiltert).
  assert.equal(pf.prozesse.length, 2);
  assert.equal(pf.summary.prozesse, 2);
  // Der belegfreie Prozess trägt belegLuecke; der belegte nicht.
  assert.equal(rowBySlug(pf, 'zh/minimal').belegLuecke, true);
  assert.equal(rowBySlug(pf, 'zh/reich').belegLuecke, false);
  assert.equal(pf.summary.ohneBeleg, 1);
  assert.equal(pf.summary.mitBeleg, 1);
});

test('Spalten-Summen: erfüllt + nichtErfüllt + unbekannt = Prozesszahl', () => {
  const pf = buildPortfolio('zh', [prozessReich(), prozessMinimal()].map(toInput));
  for (const s of pf.summary.proIndikator) {
    assert.equal(
      s.erfuellt + s.nichtErfuellt + s.unbekannt,
      pf.summary.prozesse,
      `Summe für ${s.key}`,
    );
  }
  // online-antrag: reich belegt true → 1 erfüllt, minimal unbekannt → 1 unbekannt.
  const oa = colSum(pf, 'online-antrag');
  assert.deepEqual({ e: oa.erfuellt, n: oa.nichtErfuellt, u: oa.unbekannt }, { e: 1, n: 0, u: 1 });
  // fristen-kosten-verlinkt: reich hat Reference (erfüllt), minimal nicht.
  const fk = colSum(pf, 'fristen-kosten-verlinkt');
  assert.deepEqual({ e: fk.erfuellt, n: fk.nichtErfuellt, u: fk.unbekannt }, { e: 1, n: 1, u: 0 });
});

test('Leeres Portfolio (keine Prozesse) bleibt wohlgeformt', () => {
  const pf = buildPortfolio('zh', []);
  assert.equal(pf.prozesse.length, 0);
  assert.equal(pf.spalten.length, 0);
  assert.equal(pf.summary.prozesse, 0);
  assert.ok(serializePortfolio(pf).endsWith('}\n'));
});
