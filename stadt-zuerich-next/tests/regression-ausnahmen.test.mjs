// Unit-Tests für die geprüften Ausnahmen des Regression-Guards
// (scripts/lib/regression-ausnahmen.mjs).
//
// Fixiert, dass eine Ausnahme nur den exakt erfassten Abdeckungs-Rückgang
// freigibt — nie Feld-Verluste, nie Beleg-Erosion, nie einen anderen Übergang.
//
// Lauf: node --experimental-strip-types --test tests/regression-ausnahmen.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { passendeAusnahme, validiereAusnahmen } from '../scripts/lib/regression-ausnahmen.mjs';

const DATEI = 'data/prozesse/zh/veranstaltung.json';
const ausnahme = {
  datei: DATEI,
  abdeckung: { de: { von: 49, auf: 48 }, ls: { von: 49, auf: 48 } },
  begruendung: 'Zwei doppelte Dokumente zu einem zusammengeführt',
  pr: 284,
};
const befund = (over = {}) => ({
  fieldLosses: [],
  covLosses: [
    { loc: 'de', base: 49, head: 48 },
    { loc: 'ls', base: 49, head: 48 },
  ],
  quoteLosses: [],
  quoteCountLoss: null,
  ...over,
});

test('exakter Übergang wird freigegeben', () => {
  assert.equal(passendeAusnahme(DATEI, befund(), [ausnahme]), ausnahme);
});

test('andere Datei greift nicht', () => {
  assert.equal(passendeAusnahme('data/prozesse/zh/kita-platz.json', befund(), [ausnahme]), null);
});

test('grösserer Rückgang greift nicht', () => {
  const b = befund({ covLosses: [{ loc: 'de', base: 49, head: 47 }, { loc: 'ls', base: 49, head: 48 }] });
  assert.equal(passendeAusnahme(DATEI, b, [ausnahme]), null);
});

test('nach dem Merge (neue Basis) greift der Eintrag nicht mehr', () => {
  const b = befund({ covLosses: [{ loc: 'de', base: 48, head: 47 }, { loc: 'ls', base: 48, head: 47 }] });
  assert.equal(passendeAusnahme(DATEI, b, [ausnahme]), null);
});

test('zusätzlicher Verlust in einer nicht erfassten Locale greift nicht', () => {
  const b = befund({
    covLosses: [...befund().covLosses, { loc: 'en', base: 39, head: 38 }],
  });
  assert.equal(passendeAusnahme(DATEI, b, [ausnahme]), null);
});

test('erfasste Locale ohne tatsächlichen Verlust greift nicht', () => {
  const b = befund({ covLosses: [{ loc: 'de', base: 49, head: 48 }] });
  assert.equal(passendeAusnahme(DATEI, b, [ausnahme]), null);
});

test('Feld-Verlust wird nie freigegeben', () => {
  const b = befund({ fieldLosses: [{ key: 'steps/3/label', loc: 'en', was: 'x' }] });
  assert.equal(passendeAusnahme(DATEI, b, [ausnahme]), null);
});

test('Beleg-Erosion wird nie freigegeben', () => {
  assert.equal(passendeAusnahme(DATEI, befund({ quoteLosses: [{ id: 1, was: 'x' }] }), [ausnahme]), null);
  assert.equal(passendeAusnahme(DATEI, befund({ quoteCountLoss: { base: 2, head: 1 } }), [ausnahme]), null);
});

test('Validierung: gültige Liste', () => {
  assert.deepEqual(validiereAusnahmen({ ausnahmen: [ausnahme] }), []);
  assert.deepEqual(validiereAusnahmen({ ausnahmen: [] }), []);
});

test('Validierung: Begründung, Pfad und Übergang sind Pflicht', () => {
  const fehler = validiereAusnahmen({
    ausnahmen: [{ datei: 'zh/x.json', abdeckung: { de: { von: 3, auf: 3 } }, begruendung: 'kurz' }],
  });
  assert.equal(fehler.length, 3);
  assert.ok(validiereAusnahmen({}).length > 0);
});
