// Unit-Tests für die GitHub-Actions-Annotations
// (scripts/lib/gh-annotations.mjs).
//
// Validator-Warnungen zitieren Prozessdaten — beliebigen Text. Falsches
// Escaping würde eine Meldung abschneiden oder GitHub ein fremdes
// Workflow-Kommando unterschieben; diese Tests fixieren das Format.
//
// Lauf: node --experimental-strip-types --test tests/gh-annotations.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ghAnnotation, inGitHubActions } from '../scripts/lib/gh-annotations.mjs';

test('Warnung mit Datei und Titel', () => {
  assert.equal(
    ghAnnotation('warning', 'step 3 vom Start aus unerreichbar', {
      file: 'stadt-zuerich-next/data/prozesse/zh/parkplatz.json',
      title: 'validate:prozesse',
    }),
    '::warning file=stadt-zuerich-next/data/prozesse/zh/parkplatz.json,title=validate%3Aprozesse::step 3 vom Start aus unerreichbar',
  );
});

test('ohne Properties', () => {
  assert.equal(ghAnnotation('notice', 'Hinweis'), '::notice::Hinweis');
});

test('Windows-Pfad wird zu Forward-Slashes', () => {
  assert.match(
    ghAnnotation('warning', 'x', { file: 'stadt-zuerich-next\\data\\prozesse\\zh\\oev.json' }),
    /^::warning file=stadt-zuerich-next\/data\/prozesse\/zh\/oev\.json::x$/,
  );
});

test('Meldung: %, Zeilenumbrüche werden escaped; «:» und «,» bleiben lesbar', () => {
  assert.equal(
    ghAnnotation('warning', 'de: "50 % Rabatt, sofort"\nzweite Zeile\r'),
    '::warning::de: "50 %25 Rabatt, sofort"%0Azweite Zeile%0D',
  );
});

test('Meldung kann kein zweites Workflow-Kommando einschleusen', () => {
  const line = ghAnnotation('warning', 'harmlos\n::error::gefälscht');
  assert.equal(line.split('\n').length, 1);
  assert.equal(line, '::warning::harmlos%0A::error::gefälscht');
});

test('Property-Werte: «:» und «,» werden escaped', () => {
  assert.equal(
    ghAnnotation('warning', 'x', { file: 'a,b:c.json', title: 'T: 1, 2' }),
    '::warning file=a%2Cb%3Ac.json,title=T%3A 1%2C 2::x',
  );
});

test('inGitHubActions liest GITHUB_ACTIONS', () => {
  assert.equal(inGitHubActions({ GITHUB_ACTIONS: 'true' }), true);
  assert.equal(inGitHubActions({ GITHUB_ACTIONS: 'false' }), false);
  assert.equal(inGitHubActions({}), false);
});
