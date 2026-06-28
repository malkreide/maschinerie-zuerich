// Unit-Tests für die reine Ableitungs-Funktion lib/bewertung.ts.
//
// Lauf: node --experimental-strip-types --test tests/bewertung.test.mjs
// (npm run test:unit). lib/bewertung.ts hat nur type-only Imports, daher
// genügt Node-Type-Stripping ohne Pfad-Alias-Auflösung.
//
// Kernanspruch: gleicher Input → gleicher, reproduzierbarer Output; jeder
// Indikator ist berechnet ODER belegt ODER 'unbekannt' (nie geraten).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildBewertung } from '../lib/bewertung.ts';

/** i18n-Helfer für Fixtures. */
const alle = (s) => ({ de: s, en: s, fr: s, it: s, ls: s });

/** Voll abgedeckter, belegter Prozess. */
function prozessReich() {
  return {
    schema_version: '0.1.0',
    id: 'demo',
    lebenslage_ref: 'demo',
    city: 'zh',
    title: alle('Demo-Prozess'),
    target_audience: 'bevoelkerung',
    source_url: 'https://example.org',
    retrieved_at: '2026-01-01',
    disclaimer_key: 'Prozesse.disclaimer',
    preconditions: [alle('Voraussetzung 1'), alle('Voraussetzung 2')],
    actors: [
      { id: 'a', label: alle('Antragsteller'), type: 'antragsteller' },
      { id: 'b', label: alle('Behörde'), type: 'behoerde' },
    ],
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
      {
        step_id: 2,
        actor: 'b',
        label: alle('Bearbeitung'),
        depends_on: [1],
        type: 'prozess',
        documents: [
          { label: alle('Pflichtdok'), required: true },
          { label: alle('Optional'), required: false },
        ],
      },
    ],
    bewertung: {
      indikatoren: [
        {
          key: 'online-antrag',
          wert: true,
          source_url: 'https://example.org/portal',
          source_quote: 'Antrag online möglich',
          status: 'verifiziert',
          retrieved_at: '2026-01-01',
        },
        {
          key: 'online-bezahlung',
          wert: false,
          source_url: 'https://example.org/pay',
          source_quote: 'Bezahlung nur per Rechnung',
          status: 'verifiziert',
          retrieved_at: '2026-01-01',
        },
        {
          key: 'once-only',
          wert: true,
          source_url: 'https://example.org/once',
          source_quote: 'Bekannte Daten werden übernommen',
          status: 'verifiziert',
          retrieved_at: '2026-01-01',
        },
        {
          key: 'barrierefreiheit',
          wert: true,
          source_url: 'https://example.org/wcag',
          source_quote: 'Erfüllt WCAG 2.1 AA',
          status: 'verifiziert',
          retrieved_at: '2026-01-01',
        },
        {
          key: 'eid-moeglich',
          wert: true,
          source_url: 'https://example.org/eid',
          source_quote: 'Login mit eID möglich',
          status: 'verifiziert',
          retrieved_at: '2026-01-01',
        },
      ],
    },
  };
}

/** Minimaler Prozess: nur de, keine Belege. */
function prozessMinimal() {
  return {
    schema_version: '0.1.0',
    id: 'min',
    lebenslage_ref: 'min',
    city: 'zh',
    title: { de: 'Minimal' },
    target_audience: 'bevoelkerung',
    source_url: 'https://example.org',
    retrieved_at: '2026-01-01',
    disclaimer_key: 'Prozesse.disclaimer',
    steps: [{ step_id: 1, actor: 'x', label: { de: 'Schritt' }, depends_on: [] }],
  };
}

const byKey = (report, key) => report.indikatoren.find((i) => i.key === key);

test('Determinismus: gleicher Input → identischer Output', () => {
  const a = buildBewertung(prozessReich());
  const b = buildBewertung(prozessReich());
  assert.deepEqual(a, b);
  // Auch auf demselben Objekt zweimal aufgerufen — keine Mutation/Reihenfolge.
  const p = prozessReich();
  assert.deepEqual(buildBewertung(p), buildBewertung(p));
});

test('Belegte Digitalisierungs-Indikatoren: erfüllt / nicht erfüllt / unbekannt', () => {
  const r = buildBewertung(prozessReich());
  assert.equal(byKey(r, 'online-antrag').status, 'erfuellt');
  assert.equal(byKey(r, 'online-antrag').evidenz.art, 'beleg');
  assert.equal(byKey(r, 'online-antrag').evidenz.quote, 'Antrag online möglich');
  assert.equal(byKey(r, 'online-bezahlung').status, 'nicht-erfuellt');
  // Nicht belegt → unbekannt mit evidenz null (NICHT 'nicht-erfuellt').
  for (const key of ['statusverfolgung', 'medienbruchfrei', 'digital-abschliessbar']) {
    assert.equal(byKey(r, key).status, 'unbekannt', key);
    assert.equal(byKey(r, key).evidenz, null, key);
  }
});

test('eid-moeglich ist informativ und zählt NICHT in den Score', () => {
  const r = buildBewertung(prozessReich());
  const eid = byKey(r, 'eid-moeglich');
  assert.equal(eid.gezaehlt, false);
  assert.equal(eid.status, 'erfuellt'); // wert true
  // Digitalisierungs-Score sieht nur die 6 gezählten Indikatoren.
  assert.equal(r.score.digitalisierung.erfuellt, 2); // online-antrag + once-only
  assert.equal(r.score.digitalisierung.bekannt, 3); // + online-bezahlung
  assert.equal(r.score.digitalisierung.unbekannt, 3); // status/medienbruch/digital
  assert.equal(r.score.digitalisierung.prozent, 67);
});

test('Neue belegpflichtige Indikatoren (once-only, barrierefreiheit, alternativweg)', () => {
  const r = buildBewertung(prozessReich());
  assert.equal(byKey(r, 'once-only').status, 'erfuellt');
  assert.equal(byKey(r, 'once-only').kategorie, 'digitalisierung');
  const barr = byKey(r, 'barrierefreiheit');
  assert.equal(barr.status, 'erfuellt');
  assert.equal(barr.kategorie, 'nutzendenorientierung');
  assert.equal(barr.evidenz.quote, 'Erfüllt WCAG 2.1 AA');
  // Unbelegt → unbekannt, NICHT 'nicht-erfuellt'.
  assert.equal(byKey(r, 'nicht-digitaler-alternativweg').status, 'unbekannt');
  assert.equal(byKey(r, 'nicht-digitaler-alternativweg').evidenz, null);
});

test('Berechnete Nutzendenorientierung: Locale-Abdeckung & Zählungen', () => {
  const r = buildBewertung(prozessReich());
  const ls = byKey(r, 'leichte-sprache');
  assert.equal(ls.status, 'erfuellt');
  assert.equal(ls.evidenz.art, 'berechnet');
  assert.equal(ls.evidenz.zahl, 3); // Titel + 2 Schritte
  assert.equal(ls.evidenz.von, 3);
  assert.equal(byKey(r, 'mehrsprachigkeit').status, 'erfuellt');
  assert.equal(byKey(r, 'mehrsprachigkeit').evidenz.zahl, 3);
  assert.equal(byKey(r, 'voraussetzungen-genannt').status, 'erfuellt');
  assert.equal(byKey(r, 'voraussetzungen-genannt').evidenz.zahl, 2);
  assert.equal(byKey(r, 'fristen-kosten-verlinkt').status, 'erfuellt');
  assert.equal(byKey(r, 'fristen-kosten-verlinkt').evidenz.zahl, 1);
  // 4 berechnete + barrierefreiheit (belegt) erfüllt; alternativweg unbekannt
  // (zählt nicht in den Nenner) → 100 %.
  assert.equal(r.score.nutzendenorientierung.erfuellt, 5);
  assert.equal(r.score.nutzendenorientierung.bekannt, 5);
  assert.equal(r.score.nutzendenorientierung.unbekannt, 1);
  assert.equal(r.score.nutzendenorientierung.prozent, 100);
});

test('Kennzahlen aus dem Graphen', () => {
  const k = buildBewertung(prozessReich()).kennzahlen;
  assert.equal(k.schritte, 2);
  assert.equal(k.akteurswechsel, 1); // a -> b
  assert.equal(k.behoerden, 1);
  assert.equal(k.pflichtdokumente, 1); // required:false zählt nicht
  assert.equal(k.entscheidungspunkte, 0);
});

test('Gesamt-Score: Anteil erfüllter unter den bekannten, gerundet', () => {
  const r = buildBewertung(prozessReich());
  // gezählt: 6 digital + 6 nutzend = 12; erfüllt 7; bekannt 8; unbekannt 4.
  assert.equal(r.score.gesamt.erfuellt, 7);
  assert.equal(r.score.gesamt.bekannt, 8);
  assert.equal(r.score.gesamt.unbekannt, 4);
  assert.equal(r.score.gesamt.prozent, Math.round((100 * 7) / 8)); // 88
});

test('Minimaler Prozess: alles Belegpflichtige unbekannt, kein Digital-Score', () => {
  const r = buildBewertung(prozessMinimal());
  assert.equal(r.score.digitalisierung.bekannt, 0);
  assert.equal(r.score.digitalisierung.prozent, null); // kein Score statt 0
  assert.equal(r.score.digitalisierung.unbekannt, 6); // 6 gezählte Digital-Indikatoren
  // eid informativ + unbelegt → unbekannt, gezaehlt false.
  assert.equal(byKey(r, 'eid-moeglich').status, 'unbekannt');
  // Berechnete Nutzendenorientierungs-Indikatoren sind immer bestimmbar.
  for (const key of ['leichte-sprache', 'mehrsprachigkeit', 'voraussetzungen-genannt', 'fristen-kosten-verlinkt']) {
    assert.equal(byKey(r, key).status, 'nicht-erfuellt', key);
  }
  // Belegpflichtige Nutzendenorientierungs-Indikatoren unbelegt → unbekannt.
  for (const key of ['barrierefreiheit', 'nicht-digitaler-alternativweg']) {
    assert.equal(byKey(r, key).status, 'unbekannt', key);
  }
  // bekannt = 4 berechnete (alle nicht erfüllt); 2 belegpflichtige unbekannt.
  assert.equal(r.score.nutzendenorientierung.bekannt, 4);
  assert.equal(r.score.nutzendenorientierung.unbekannt, 2);
  assert.equal(r.score.nutzendenorientierung.prozent, 0);
});
