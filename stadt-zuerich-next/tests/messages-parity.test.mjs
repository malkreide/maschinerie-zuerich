// Paritäts-Test der UI-Übersetzungen: jede Locale muss exakt die Key-Menge
// von de.json (Pflicht-Locale) tragen.
//
// Motivation: 14 fehlende Keys (GraphTable.*, Nav.climate/diversityToggle*,
// Detail.detailDiversity*) liessen den Screenreader-Fallback des Graphen in
// en/fr/it/ls rohe Key-Strings rendern — unbemerkt, weil nichts die Parität
// prüfte. Dieser Test macht fehlende (und verwaiste) Keys zum CI-Fehler;
// der Laufzeit-Fallback auf de (i18n/fallback.ts) bleibt als zweite Linie.
//
// Zusätzlich: ICU-Platzhalter einer Übersetzung müssen eine Teilmenge der
// Platzhalter des de-Originals sein — ein {tippfehler} würde zur Laufzeit
// mit «missing value» rendern.
//
// Lauf: node --experimental-strip-types --test tests/messages-parity.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const messagesDir = path.join(here, '..', 'messages');

const LOCALES = ['en', 'fr', 'it', 'ls'];

function load(locale) {
  return JSON.parse(readFileSync(path.join(messagesDir, `${locale}.json`), 'utf8'));
}

function flatten(obj, prefix = '', out = new Map()) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'object' && v !== null) flatten(v, key, out);
    else out.set(key, String(v));
  }
  return out;
}

function placeholders(msg) {
  // ICU-Argumente: {name} oder {name, plural|number|…}. Das Zeichen nach dem
  // Namen MUSS , oder } sein — sonst matchen wir Literal-Text in
  // Plural-Zweigen wie «=0 {no preconditions stated}» als Pseudo-Argument.
  return new Set([...msg.matchAll(/\{\s*([a-zA-Z0-9_]+)\s*[,}]/g)].map((m) => m[1]));
}

const de = flatten(load('de'));

for (const locale of LOCALES) {
  const loc = flatten(load(locale));

  test(`${locale}.json: keine fehlenden Keys gegenüber de.json`, () => {
    const missing = [...de.keys()].filter((k) => !loc.has(k));
    assert.deepEqual(missing, [], `${missing.length} Key(s) fehlen in ${locale}.json`);
  });

  test(`${locale}.json: keine verwaisten Keys (nicht in de.json)`, () => {
    const extra = [...loc.keys()].filter((k) => !de.has(k));
    assert.deepEqual(extra, [], `${extra.length} Key(s) existieren nur in ${locale}.json`);
  });

  test(`${locale}.json: ICU-Platzhalter sind Teilmenge des de-Originals`, () => {
    const problems = [];
    for (const [key, value] of loc) {
      if (!de.has(key)) continue;
      const dePh = placeholders(de.get(key));
      for (const ph of placeholders(value)) {
        // cityName/cityShortName werden von getT/useT immer injiziert.
        if (ph === 'cityName' || ph === 'cityShortName') continue;
        if (!dePh.has(ph)) problems.push(`${key}: {${ph}} existiert nicht im de-Original`);
      }
    }
    assert.deepEqual(problems, []);
  });
}
