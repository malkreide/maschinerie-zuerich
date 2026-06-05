#!/usr/bin/env node
// EINMALIGES Merge-Skript (nicht Teil der Build-Pipeline).
// Ergänzt jede Lebenslage in data/zh/lebenslagen.json um zielgruppen[].
// Taxonomie siehe types/stadt.ts (ZIELGRUPPEN). Erlaubte Werte:
//   einwohner, unternehmen, familie, alter, schule, migration,
//   mobilitaet, wohnen, gesundheit

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const FILE = resolve(HERE, '..', 'data/zh/lebenslagen.json');

const ZG = {
  'hund-anmelden': ['einwohner'],
  'pass-id': ['einwohner'],
  'umzug-melden': ['einwohner', 'wohnen'],
  'heiraten': ['einwohner', 'familie'],
  'schule-anmelden': ['familie', 'schule'],
  'kita-platz': ['familie', 'schule'],
  'musikschule': ['familie', 'schule'],
  'sportplatz': ['einwohner', 'familie'],
  'sozialhilfe': ['einwohner'],
  'ahv-zusatz': ['alter'],
  'kesb': ['familie'],
  'asyl': ['migration'],
  'berufslehre': ['schule'],
  'baugesuch': ['wohnen', 'unternehmen'],
  'stadtwohnung': ['wohnen'],
  'steuern': ['einwohner', 'unternehmen'],
  'strom': ['einwohner', 'wohnen'],
  'wasser': ['einwohner', 'wohnen'],
  'abfall': ['einwohner', 'wohnen'],
  'stadtreinigung': ['einwohner'],
  'öv': ['einwohner', 'mobilitaet'],
  'pflegeheim': ['alter', 'gesundheit'],
  'spital': ['gesundheit'],
  'schul-arzt': ['schule', 'gesundheit', 'familie'],
  'umwelt': ['einwohner', 'unternehmen'],
  'polizei': ['einwohner'],
  'feuerwehr': ['einwohner'],
  'parkbusse': ['mobilitaet'],
  'parkplatz': ['mobilitaet', 'wohnen'],
  'betreibung': ['einwohner', 'unternehmen'],
  'stadtarchiv': ['einwohner'],
  'statistik': ['einwohner', 'unternehmen'],
};

const data = JSON.parse(readFileSync(FILE, 'utf8'));
const missing = [];
data.lebenslagen = data.lebenslagen.map((e) => {
  const zielgruppen = ZG[e.id];
  if (!zielgruppen) {
    missing.push(e.id);
    return e;
  }
  // Reihenfolge: id, zustaendig, zielgruppen, i18n (übrige Felder erhalten).
  const { id, zustaendig, i18n, ...rest } = e;
  return { id, zustaendig, zielgruppen, ...rest, i18n };
});

if (missing.length) {
  console.error('FEHLT zielgruppen für:', missing.join(', '));
  process.exit(1);
}

writeFileSync(FILE, JSON.stringify(data, null, 2) + '\n', 'utf8');
console.log(`✓ ${data.lebenslagen.length} Lebenslagen mit zielgruppen[] versehen.`);
