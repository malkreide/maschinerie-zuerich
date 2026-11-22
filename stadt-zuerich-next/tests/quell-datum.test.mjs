// Unit-Tests für lib/quell-datum.ts — Datum aus externer Quelle anzeigen.
//
// Anlass: ParlamentsGeschaefte formatierte mit
// `new Date(item.datum).toLocaleDateString('de-CH')` — fest auf Deutsch
// (auch in en/fr/it) und in der Zeitzone des Browsers.
//
// Lauf: node --experimental-strip-types --test tests/quell-datum.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatQuellDatum } from '../lib/quell-datum.ts';

test('ISO-Datum je Sprache, Monat ausgeschrieben', () => {
  assert.equal(formatQuellDatum('2026-11-10', 'de-CH'), '10. November 2026');
  assert.equal(formatQuellDatum('2026-11-10', 'fr-CH'), '10 novembre 2026');
  assert.equal(formatQuellDatum('2026-11-10', 'it-CH'), '10 novembre 2026');
  assert.equal(formatQuellDatum('2026-11-10', 'en'), 'November 10, 2026');
});

test('Kalendertag der Quelle bleibt — keine Zeitzonen-Verschiebung', () => {
  // Der bisherige Weg zeigt westlich von Greenwich den Vortag:
  const alt = new Date('2026-11-10').toLocaleDateString('de-CH', { timeZone: 'America/New_York' });
  assert.equal(alt, '9.11.2026');
  // Der neue nicht, auch nicht mit Uhrzeit (mit oder ohne Zone) dahinter:
  for (const roh of ['2026-11-10', '2026-11-10T00:00:00', '2026-11-10T23:30:00', '2026-11-10T23:30:00+01:00', '2026-11-10 08:00']) {
    assert.equal(formatQuellDatum(roh, 'de-CH'), '10. November 2026', roh);
  }
});

test('Anderes Format wird unverändert gezeigt statt falsch geparst', () => {
  // new Date('10.11.2026') wäre der 11. Oktober.
  assert.equal(formatQuellDatum('10.11.2026', 'de-CH'), '10.11.2026');
  assert.equal(formatQuellDatum('November 2026', 'de-CH'), 'November 2026');
  assert.equal(formatQuellDatum('  2026-11-10 ', 'de-CH'), '10. November 2026');
});

test('Ungültiger Kalendertag wird nicht verschoben', () => {
  assert.equal(formatQuellDatum('2026-02-30', 'de-CH'), '2026-02-30');
  assert.equal(formatQuellDatum('2026-13-01', 'de-CH'), '2026-13-01');
});

test('Kein Datum → null (Oberfläche zeigt nichts)', () => {
  for (const roh of ['', '   ', undefined, null, 20261110, {}]) {
    assert.equal(formatQuellDatum(roh, 'de-CH'), null, String(roh));
  }
});
