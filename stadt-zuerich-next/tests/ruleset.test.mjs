// Ruleset für main (.github/rulesets/main.json) passt zu .github/workflows/ci.yml.
//
// Pflicht-Checks werden über den Job-Namen gematcht. Wird ein Job in ci.yml
// umbenannt, trifft der alte Name nie mehr ein, und jeder Merge bleibt
// blockiert. Kommt ein Job neu dazu, ist er nicht Pflicht, bis ihn jemand
// ins Ruleset einträgt, und ein roter Lauf liesse sich trotzdem mergen.
// Dieser Test fängt beides in der CI ab. Die Einstellungen auf GitHub selbst
// sieht er nicht: Nach jeder Änderung an main.json muss das Ruleset in den
// Repo-Settings neu importiert werden (docs/branch-protection.md).
//
// Lauf: node --experimental-strip-types --test tests/ruleset.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const GITHUB_ACTIONS_APP_ID = 15368;

// CI-Jobs, die bewusst kein Pflicht-Check sind. Jeder Eintrag braucht eine
// Begründung im Kommentar.
const NICHT_PFLICHT = new Set([]);

const ruleset = JSON.parse(
  await readFile(new URL('../../.github/rulesets/main.json', import.meta.url), 'utf8'),
);
const ciYml = await readFile(new URL('../../.github/workflows/ci.yml', import.meta.url), 'utf8');

/** Anzeigenamen der Jobs (`name:` direkt unter dem Job-Schlüssel), sonst der Schlüssel. */
function jobNamen(yml) {
  const zeilen = yml.slice(yml.search(/^jobs:\s*$/m)).split('\n').slice(1);
  const namen = [];
  let offen = null;
  for (const zeile of zeilen) {
    if (/^\S/.test(zeile)) break;
    const job = zeile.match(/^ {2}([A-Za-z0-9_-]+):\s*$/);
    if (job) {
      if (offen) namen.push(offen);
      offen = job[1];
      continue;
    }
    const name = zeile.match(/^ {4}name:\s*(.+?)\s*$/);
    if (name && offen !== null) {
      namen.push(name[1].replace(/^(['"])(.*)\1$/, '$2'));
      offen = null;
    }
  }
  if (offen) namen.push(offen);
  return namen;
}

function regel(typ) {
  return ruleset.rules.find((r) => r.type === typ);
}

const pflicht = regel('required_status_checks').parameters.required_status_checks;
const jobs = jobNamen(ciYml);

test('ci.yml-Parser findet die Jobs', () => {
  assert.ok(jobs.length >= 7, `nur ${jobs.length} Jobs gefunden: ${jobs.join(', ')}`);
  assert.ok(jobs.every((j) => j.length > 0));
});

test('jeder Pflicht-Check heisst wie ein Job in ci.yml', () => {
  const fehlend = pflicht.map((c) => c.context).filter((c) => !jobs.includes(c));
  assert.deepEqual(fehlend, [], 'Pflicht-Check ohne Job: blockiert jeden Merge auf main');
});

test('jeder Job in ci.yml ist Pflicht-Check oder bewusst ausgenommen', () => {
  const kontexte = new Set(pflicht.map((c) => c.context));
  const offen = jobs.filter((j) => !kontexte.has(j) && !NICHT_PFLICHT.has(j));
  assert.deepEqual(offen, [], 'Job ist kein Pflicht-Check: in main.json eintragen oder in NICHT_PFLICHT begründen');
});

test('Pflicht-Checks kommen nur von GitHub Actions', () => {
  // Ohne integration_id könnte jedes Token mit Status-Schreibrecht einen
  // gleichnamigen grünen Status setzen.
  const fremd = pflicht.filter((c) => c.integration_id !== GITHUB_ACTIONS_APP_ID).map((c) => c.context);
  assert.deepEqual(fremd, []);
});

test('main: kein Bypass, kein Force-Push, kein Löschen, nur per PR', () => {
  assert.equal(ruleset.enforcement, 'active');
  assert.deepEqual(ruleset.conditions.ref_name.include, ['~DEFAULT_BRANCH']);
  assert.deepEqual(ruleset.bypass_actors, []);
  assert.ok(regel('deletion'), 'Löschen von main nicht gesperrt');
  assert.ok(regel('non_fast_forward'), 'Force-Push auf main nicht gesperrt');
  assert.ok(regel('pull_request'), 'Direkt-Push auf main nicht gesperrt');
  assert.equal(regel('required_status_checks').parameters.strict_required_status_checks_policy, true);
});
