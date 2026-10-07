// Unit-Tests für den Konsistenz-Lint Leichte Sprache
// (scripts/lib/ls-consistency.mjs).
//
// Der Lint warnt, wenn das ls-Label einer Reference ein anderes Thema
// (Kosten, Frist) trägt als ihr deutsches Label. Die Fixtures unter
// «VERTAUSCHT» sind wörtlich die Fälle, die in den Daten standen und von Hand
// gefunden werden mussten — sie fixieren, dass der Lint sie heute meldet.
// «PASSEND» sind korrekte Paare aus den Daten, an denen er still bleiben muss.
//
// Lauf: node --experimental-strip-types --test tests/ls-consistency.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findLsThemeDrift, lintLsConsistency } from '../scripts/lib/ls-consistency.mjs';

// [de, ls, erwartete Abweichungen]
const VERTAUSCHT = [
  // parkplatz Ref 2 (vor #266)
  [
    'Gültigkeitsdauer der Anwohnerparkkarte',
    'Bei Rueckgabe bekommen Sie Geld zurueck fuer ganze Monate.',
    [{ thema: 'Kosten', nurIn: 'ls' }],
  ],
  // umzug-melden Ref 1 (vor #266) — beide Richtungen schlagen an
  [
    'Allfällige Gebühren bei der An-/Ummeldung (insb. Bewilligungsnachführung für ausländische Staatsangehörige)',
    'Frist für die Anmeldung beim Zuzug',
    [{ thema: 'Kosten', nurIn: 'de' }, { thema: 'Frist', nurIn: 'ls' }],
  ],
  // fundsache Ref 3 (vor #264)
  [
    'Berechtigte Gegenstände für den Express-Service',
    'Wenn Sie eine Sache abholen, kostet das Geld.',
    [{ thema: 'Kosten', nurIn: 'ls' }],
  ],
  // fundsache Ref 2 (vor #264)
  [
    'Express-Zuschlag zusätzlich zur normalen Gebühr',
    'Ab wann Sie am nächsten Tag im Fundbüro nachfragen können.',
    [{ thema: 'Kosten', nurIn: 'de' }],
  ],
];

// [de, ls]
const PASSEND = [
  // Kosten in freier Umschreibung
  ['Gebühr für den offiziellen Abfallsack (vorgezogene Entsorgungsgebühr)', 'Was der offizielle Abfall-Sack kostet'],
  ['Gebühr und Versand', 'Das kostet etwas. Und es wird verschickt.'],
  ['Express-Zuschlag zusätzlich zur normalen Gebühr', 'Die Express-Suche kostet extra Geld.'],
  ['Jährliche Hundesteuer (anteilige Rückerstattung bei unterjähriger Abmeldung)', 'Dass Sie jedes Jahr Hunde-Steuer zahlen'],
  ['Verrechnung angebrochener Monate bei Rueckgabe', 'Bei Rückgabe bekommen Sie Geld zurück für ganze Monate.'],
  ['Allfällige Gebühren bei der An-/Ummeldung', 'Was die Anmeldung kosten kann'],
  // Frist in freier Umschreibung
  ['Frist für die Anmeldung bei Zuzug oder Neuanschaffung (kantonale Vorgabe)', 'Wie schnell Sie den Hund anmelden müssen'],
  ['Rekursfrist für den Rekurs an den Bezirksrat', 'Wie viel Zeit Sie haben, um sich zu beschweren'],
  ['Gültigkeitsdauer von Pass und Identitätskarte (Erwachsene und Kinder unterschiedlich)', 'Wie lange Pass und Identitäts-Karte gültig sind'],
  ['Produktions- und Zustellzeit nach der Erfassung', 'Wie lange Sie auf den Ausweis warten'],
  ['Früheste Meldemöglichkeit vor Einzug bei Umzug innerhalb der Stadt', 'Wann Sie den Umzug frühestens melden können'],
  ['Empfohlene Vorlaufzeit für Bewilligungsgesuche (je nach Anlassgrösse)', 'So früh sollten Sie das Gesuch schicken: Das hängt von der Grösse vom Fest ab'],
  // Beide Themen in einem Label
  ['Zahlungsfristen sowie Verzugs- und Vergütungszins', 'Bis wann Sie zahlen müssen und was bei Verspätung gilt'],
  // Weder Kosten noch Frist
  ['Erforderliche Dokumente für die Anmeldung', 'Was Sie für die Anmeldung brauchen'],
  ['Persönliche Beratung an den VBZ-Stellen', 'Beratung an einer VBZ-Stelle'],
  // «Zahl» als Nomen ist kein Kosten-Signal
  ['Erwartete Teilnehmerzahl', 'Die Zahl der Gäste'],
];

for (const [de, ls, erwartet] of VERTAUSCHT) {
  test(`meldet: «${ls.slice(0, 40)}» an «${de.slice(0, 40)}»`, () => {
    assert.deepEqual(findLsThemeDrift(de, ls), erwartet);
  });
}

for (const [de, ls] of PASSEND) {
  test(`still: «${ls.slice(0, 40)}» an «${de.slice(0, 40)}»`, () => {
    assert.deepEqual(findLsThemeDrift(de, ls), []);
  });
}

test('fehlendes oder leeres ls ist kein Befund', () => {
  assert.deepEqual(findLsThemeDrift('Gebühr für die Abholung', undefined), []);
  assert.deepEqual(findLsThemeDrift('Gebühr für die Abholung', ''), []);
  assert.deepEqual(findLsThemeDrift(undefined, 'Das kostet Geld.'), []);
});

test('lintLsConsistency: eine Warnung je Reference, mit reference_id und beiden Texten', () => {
  const prozess = {
    references: [
      { reference_id: 1, label: { de: 'Allfällige Gebühren bei der An-/Ummeldung', ls: 'Frist für die Anmeldung beim Zuzug' } },
      { reference_id: 2, label: { de: 'Gesetzliche Meldefrist nach Einzug', ls: 'Wie viel Zeit Sie für die Meldung haben' } },
      { reference_id: 3, label: { de: 'Gebühr für die Abmeldebestätigung' } },
    ],
  };
  const warnings = lintLsConsistency(prozess);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /reference 1\.label/);
  assert.match(warnings[0], /de nennt «Kosten», ls nicht/);
  assert.match(warnings[0], /ls nennt «Frist», de nicht/);
  assert.match(warnings[0], /Frist für die Anmeldung beim Zuzug/);
});

test('lintLsConsistency: Prozess ohne References liefert nichts', () => {
  assert.deepEqual(lintLsConsistency({}), []);
});

test('geprüft werden nur References, nicht Schritte', () => {
  const prozess = {
    steps: [{ step_id: 1, label: { de: 'Lebensunterhalt nicht gedeckt', ls: 'Ihr Geld reicht nicht zum Leben' } }],
  };
  assert.deepEqual(lintLsConsistency(prozess), []);
});
