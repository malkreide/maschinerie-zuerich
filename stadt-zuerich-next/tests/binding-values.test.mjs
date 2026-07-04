// Unit-Tests für den Kardinalregel-Lint (scripts/lib/binding-values.mjs).
//
// Der Lint ist die maschinelle Durchsetzung von «Link, don't assert»: bindende
// Werte (Fristen, Gebühren, Quoten) dürfen nie in gerenderten Texten stehen.
// Diese Tests fixieren die Erkennungsmuster — insbesondere die in der
// Lösungsanalyse gefundenen blinden Flecken (ausgeschriebene Zahlwörter,
// «500.–»-Notation), damit sie nicht stillschweigend wieder aufgehen.
//
// Lauf: node --experimental-strip-types --test tests/binding-values.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findBindingValue } from '../scripts/lib/binding-values.mjs';

const BINDING = [
  // Ziffern + Einheit (klassisch)
  'Die Frist beträgt 30 Tage.',
  'Gebühr: CHF 50',
  'Fr. 120 pro Jahr',
  'Rekursfrist von 10 Arbeitstagen',
  'ca. 2.5 % der Bausumme',
  '20 Prozent Anzahlung',
  // Ausgeschriebene Zahlwörter (vorher blinder Fleck)
  'innert zehn Tagen melden',
  'Der Pass ist fünf Jahre gültig.',
  'innerhalb von dreissig Tagen',
  'gilt ein Jahr',
  'zwei Wochen Vorlauf',
  'hundert Franken Depot',
  // Schweizer Preisnotation (vorher blinder Fleck)
  'Kostet 500.–',
  'Gebühr 50.- pro Bewilligung',
  'Preis: 1200.— inkl. MWST',
];

const HARMLOS = [
  'Hund anmelden / Hundesteuer',
  'Sie bringen viele Papiere',
  'Das Amt prüft: Sind alle Bau-Regeln eingehalten?',
  'Einsprachen behandeln',
  'Die Kosten hängen von der Bausumme ab',        // Wert ohne Zahl → ok
  'Sie zahlen die Gebühr',                        // kein Betrag
  'einmal pro Jahr aktualisiert',                 // «einmal» ist kein Zahlwort-Betrag
  'Formular A4 ausfüllen',                        // Zahl ohne bindende Einheit
  'Schritt 3 von 7',                              // Zählung, keine Frist
  'Meilenstein 2026: Ausbau',                     // Jahreszahl ohne Einheit
];

for (const text of BINDING) {
  test(`erkennt bindenden Wert: "${text}"`, () => {
    assert.notEqual(findBindingValue(text), null, `nicht erkannt: "${text}"`);
  });
}

for (const text of HARMLOS) {
  test(`kein False Positive: "${text}"`, () => {
    assert.equal(findBindingValue(text), null, `fälschlich geflaggt: "${text}"`);
  });
}

test('leere/fehlende Eingaben sind kein Treffer', () => {
  assert.equal(findBindingValue(''), null);
  assert.equal(findBindingValue(undefined), null);
  assert.equal(findBindingValue(null), null);
});
