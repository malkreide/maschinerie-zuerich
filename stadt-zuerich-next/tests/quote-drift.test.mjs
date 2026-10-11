// Unit-Tests für die Zitat-Drift-Prüfung (scripts/lib/quote-drift.mjs).
//
// Die Fixtures sind wörtlich die Fälle aus der Live-Prüfung vom 11.10.2026:
// umzug-melden Ref. 2 stand nach einer Umformulierung der Seite nicht mehr
// wörtlich dort, der Wert (14 Tage) blieb gleich. Genau das soll der Bericht
// als Drift melden — samt dem neuen Satz als Vorschlag.
//
// Lauf: node --experimental-strip-types --test tests/quote-drift.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aehnlichsterSatz, pruefeZitat } from '../scripts/lib/quote-drift.mjs';

const SEITE =
  'Seite vorlesen Zuzug aus dem Ausland in die Stadt Zürich Sie sind aus dem Ausland nach Zürich gezogen? ' +
  'Für die Anmeldung ist eine persönliche Vorsprache beim Personenmeldeamt Zürich Süd erforderlich. ' +
  'Termin vereinbaren Den Zuzug in die Stadt Zürich müssen Sie innerhalb von 14 Tagen beim Personenmeldeamt melden. ' +
  'Für die Anmeldung eines Zuzugs aus dem Ausland benötigen Sie einen Termin. ' +
  'Bei Familienanmeldungen müssen alle Familienmitglieder persönlich zum Termin erscheinen.';

test('wörtliches Zitat (whitespace-normalisiert) ist kein Befund', () => {
  const q = 'Den Zuzug in die Stadt Zürich müssen Sie\n innerhalb von 14 Tagen beim Personenmeldeamt melden.';
  assert.deepEqual(pruefeZitat(SEITE, q), { status: 'woertlich' });
});

test('umformulierte Seite: Drift mit dem neuen Satz als Vorschlag', () => {
  const alt = 'Sie müssen sich innerhalb von 14 Tagen bei der Stadt Zürich anmelden (Meldepflicht).';
  const b = pruefeZitat(SEITE, alt);
  assert.equal(b.status, 'drift');
  assert.match(b.aehnlich, /^Termin vereinbaren Den Zuzug in die Stadt Zürich müssen Sie innerhalb von 14 Tagen/);
  assert.ok(b.anteil >= 0.5, `anteil ${b.anteil}`);
});

test('Seite mit JavaScript-Hinweis ist nicht prüfbar statt Drift (fedlex)', () => {
  const fedlex =
    'Fedlex DE: Vielen Dank, dass Sie sie die Website des Bundesrechts aufgerufen haben; sie ist nur mit einem ' +
    'Javascript-fähigen Browser verfügbar. Um diese Website optimal nutzen zu können, empfehlen wir Ihnen, ' +
    'einen aktuellen Browser zu verwenden. '.repeat(2);
  const b = pruefeZitat(fedlex, 'Die Ehe kann von zwei Personen eingegangen werden.');
  assert.equal(b.status, 'nicht-pruefbar');
});

test('Seite mit kaum Text ist nicht prüfbar', () => {
  assert.equal(pruefeZitat('Laden …', 'irgendein Zitat').status, 'nicht-pruefbar');
});

test('Reference ohne Zitat wird nicht bewertet', () => {
  assert.deepEqual(pruefeZitat(SEITE, ''), { status: 'ohne-zitat' });
  assert.deepEqual(pruefeZitat(SEITE, undefined), { status: 'ohne-zitat' });
});

test('aehnlichsterSatz: ohne gemeinsame Wörter Anteil 0', () => {
  assert.equal(aehnlichsterSatz(SEITE, 'Hundesteuer Rückerstattung Juni').anteil, 0);
});
