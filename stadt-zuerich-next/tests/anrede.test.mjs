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
// Satzanfängen trennen; die bleiben Sache des Reviews. So rutschte
// «Verschiebe … sieh sofort» (Simulator.intro) durch #371.
//
// Italienisch (it) folgt seit 2026-11 der Form des Deutschen: Wo das Deutsche
// siezt, steht «Lei» (klein: «suo», «sua»); wo es den Infinitiv nutzt, der
// Infinitiv. Knopf- und Linkbeschriftungen bleiben im Imperativ («Cerca»,
// «Chiudi»), wie in italienischen Oberflächen üblich. Geprüft werden hier die
// Pronomen der tu-Form («Cerca la tua pratica», «Grazie per il tuo riscontro»).
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

// Italienisch: Pronomen der tu-Form (tu, ti, te, tuo, tua, tuoi, tue).
const TU = /(?<![\p{L}\d])(?:tu|ti|te|tuo|tua|tuoi|tue)(?![\p{L}\d])/iu;

test('Anrede: keine tu-Form in messages/it.json', () => {
  const texte = flatten(JSON.parse(readFileSync(path.join(messagesDir, 'it.json'), 'utf8')));
  const funde = [...texte]
    .filter(([, text]) => TU.test(text))
    .map(([key, text]) => `${key}: «${text.match(TU)[0]}» in «${text.slice(0, 60)}»`);
  assert.deepEqual(funde, [], `tu-Form statt Lei:\n  ${funde.join('\n  ')}`);
});

for (const locale of ['de', 'ls']) {
  test(`Anrede: keine Du- oder Ihr-Form in messages/${locale}.json`, () => {
    const texte = flatten(JSON.parse(readFileSync(path.join(messagesDir, `${locale}.json`), 'utf8')));
    const funde = [...texte]
      .filter(([, text]) => DU_IHR.test(text))
      .map(([key, text]) => `${key}: «${text.match(DU_IHR)[0]}» in «${text.slice(0, 60)}»`);
    assert.deepEqual(funde, [], `Du-/Ihr-Form statt Sie-Form:\n  ${funde.join('\n  ')}`);
  });
}
