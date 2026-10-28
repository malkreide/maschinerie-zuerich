// Unit-Tests für das Änderungsprotokoll lib/aenderungen.ts.
//
// Lauf: node --experimental-strip-types --test tests/aenderungen.test.mjs
// (npm run test:unit). lib/aenderungen.ts hat keine Imports.
//
// Kernansprüche:
//   - datensparsam: nur Betreff, Datum, Links — kein Body, keine Personen.
//   - Kardinalregel: ein Betreff mit bindendem Wert erscheint nicht.
//   - nichts raten: Prozesse nur bei exaktem Scope-Treffer.
// Die Betreffe stammen aus der echten Historie von data/prozesse.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { artVon, mapCommitToEintrag } from '../lib/aenderungen.ts';
import { findBindingValue } from '../scripts/lib/binding-values.mjs';

const REPO = 'https://github.com/malkreide/maschinerie-zuerich';
const SLUGS = new Set(['zh/umzug-melden', 'zh/parkplatz', 'zh/veranstaltung', 'zh/kita-platz']);
const OPTS = { repoUrl: REPO, prozessSlugs: SLUGS, istBindend: (t) => findBindingValue(t) !== null };

function commit(message, extra = {}) {
  return {
    sha: 'c68187e1234567890abcdef',
    html_url: `${REPO}/commit/c68187e1234567890abcdef`,
    commit: {
      message,
      committer: { date: '2026-10-09T12:12:19Z' },
      author: { name: 'Jemand', email: 'jemand@example.org' },
    },
    author: { login: 'jemand' },
    parents: [{ sha: 'a' }],
    ...extra,
  };
}

test('Squash-Commit: Typ, Scope, Prozess, Titel, PR-Link', () => {
  const e = mapCommitToEintrag(
    commit('fix(umzug-melden): Unterlagen für die persönliche Meldung nachführen, Heimatschein streichen (#332)'),
    OPTS,
  );
  assert.deepEqual(e, {
    sha: 'c68187e',
    datum: '2026-10-09',
    typ: 'fix',
    bereich: 'umzug-melden',
    prozesse: ['zh/umzug-melden'],
    titel: 'Unterlagen für die persönliche Meldung nachführen, Heimatschein streichen',
    pr: 332,
    url: `${REPO}/pull/332`,
  });
});

test('mehrere Prozesse im Scope; allgemeiner Scope ohne Zuordnung', () => {
  const zwei = mapCommitToEintrag(
    commit('fix(parkplatz, veranstaltung): Rechtsmittel-Zweig neutral statt unbelegtem Statthalteramt (#289)'),
    OPTS,
  );
  assert.deepEqual(zwei.prozesse, ['zh/parkplatz', 'zh/veranstaltung']);
  const allgemein = mapCommitToEintrag(commit('fix(prozesse): vier gedriftete Zitate auf den Live-Wortlaut setzen (#330)'), OPTS);
  assert.equal(allgemein.bereich, 'prozesse');
  assert.deepEqual(allgemein.prozesse, []);
  const ls = mapCommitToEintrag(commit('fix(ls): Anrede in Leichter Sprache auf «Sie» vereinheitlichen (#280)'), OPTS);
  assert.deepEqual(ls.prozesse, []);
});

test('zusammengesetzter Kopf: der erste Teil zählt', () => {
  const e = mapCommitToEintrag(
    commit('fix(umzug-melden) + feat(ci): gedriftete Zitate erneuern, wöchentlicher Zitat-Drift-Bericht (#293)'),
    OPTS,
  );
  assert.equal(e.typ, 'fix');
  assert.deepEqual(e.prozesse, ['zh/umzug-melden']);
  assert.equal(e.titel, 'gedriftete Zitate erneuern, wöchentlicher Zitat-Drift-Bericht');
});

test('ohne Conventional-Kopf und ohne PR: sonstiges, Commit-Link', () => {
  const e = mapCommitToEintrag(commit('Prozessdaten aktualisiert'), OPTS);
  assert.equal(e.typ, 'sonstiges');
  assert.equal(e.bereich, null);
  assert.equal(e.titel, 'Prozessdaten aktualisiert');
  assert.equal(e.pr, null);
  assert.equal(e.url, `${REPO}/commit/c68187e1234567890abcdef`);
  // Unbekannter Typ zählt ebenfalls als sonstiges.
  assert.equal(mapCommitToEintrag(commit('wip(kita-platz): Entwurf'), OPTS).typ, 'sonstiges');
});

test('Kardinalregel: Betreff mit bindendem Wert erscheint nicht', () => {
  const e = mapCommitToEintrag(commit('fix(parkplatz): Jahresgebühr auf 300 Franken korrigieren (#999)'), OPTS);
  assert.equal(e.titel, null);
  assert.equal(e.url, `${REPO}/pull/999`); // der Weg zur Quelle bleibt
  const frist = mapCommitToEintrag(commit('fix(umzug-melden): Meldefrist innert vierzehn Tagen (#998)'), OPTS);
  assert.equal(frist.titel, null);
});

test('Datensparsam: weder Body noch Personen im Eintrag', () => {
  const e = mapCommitToEintrag(
    commit('feat(kita-platz): Folgen eines tieferen SBU belegen (#287)\n\nCo-Authored-By: Jemand <jemand@example.org>'),
    OPTS,
  );
  const s = JSON.stringify(e);
  for (const verboten of ['Jemand', 'jemand', 'example.org', 'Co-Authored']) assert.ok(!s.includes(verboten), verboten);
  assert.deepEqual(Object.keys(e), ['sha', 'datum', 'typ', 'bereich', 'prozesse', 'titel', 'pr', 'url']);
});

test('Merge-Commits und leere Betreffe fallen weg', () => {
  assert.equal(mapCommitToEintrag(commit('Merge pull request #93 from x/y', { parents: [{}, {}] }), OPTS), null);
  assert.equal(mapCommitToEintrag(commit('   '), OPTS), null);
});

test('artVon: Anzeige-Kategorien', () => {
  assert.equal(artVon('feat'), 'ergaenzung');
  assert.equal(artVon('fix'), 'korrektur');
  assert.equal(artVon('i18n'), 'uebersetzung');
  assert.equal(artVon('docs'), 'dokumentation');
  assert.equal(artVon('chore'), 'wartung');
  assert.equal(artVon('sonstiges'), 'aenderung');
});
