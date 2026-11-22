// Anrede in den deutschsprachigen UI-Texten: durchgehend Sie-Form.
//
// Bis 2026-11 duzte das Onboarding («Suche dein Anliegen», «siehst du»,
// «dein Geld»), der Suchhinweis fragte «Meintest du …?», die Suchhilfe
// sprach mit «Tippt …» eine Gruppe an — der Rest der Oberfläche siezt
// («Wählen Sie eine Kategorie», «Danke für Ihr Feedback!»). Leichte Sprache
// (ls) siezt ohnehin.
//
// Geprüft werden die Pronomen der Du- und Ihr-Form. Imperative («Tippe»,
// «Erkunde») lassen sich per Muster nicht sicher von Substantiven und
// Satzanfängen trennen; die bleiben Sache des Reviews.
//
// Lauf: node --experimental-strip-types --test tests/anrede.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const messagesDir = path.join(here, '..', 'messages');

// Wortgrenzen per Lookaround: \b kennt in JS-Regex ohne Unicode-Wortklasse
// keine Umlaute.
const DU_IHR = /(?<![\p{L}\d])(?:du|dich|dir|dein\p{L}*|euch|euer|eure\p{L}*)(?![\p{L}\d])/iu;

function flatten(obj, prefix = '', out = new Map()) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'object' && v !== null) flatten(v, key, out);
    else out.set(key, String(v));
  }
  return out;
}

for (const locale of ['de', 'ls']) {
  test(`Anrede: keine Du- oder Ihr-Form in messages/${locale}.json`, () => {
    const texte = flatten(JSON.parse(readFileSync(path.join(messagesDir, `${locale}.json`), 'utf8')));
    const funde = [...texte]
      .filter(([, text]) => DU_IHR.test(text))
      .map(([key, text]) => `${key}: «${text.match(DU_IHR)[0]}» in «${text.slice(0, 60)}»`);
    assert.deepEqual(funde, [], `Du-/Ihr-Form statt Sie-Form:\n  ${funde.join('\n  ')}`);
  });
}
