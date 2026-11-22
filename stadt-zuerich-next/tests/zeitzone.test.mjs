// Zeitzone der Stadt für next-intl (config/city.config.json → timeZone).
//
// Anlass: Ohne Zeitzone meldete next-intl beim Server-Rendering
// ENVIRONMENT_FALLBACK — Server (Docker/Vercel, meist UTC) und Browser
// (Ortszeit) hätten Datum/Uhrzeit verschieden formatiert. Ein Tippfehler im
// Namen (z. B. «Europe/Zürich») fiele erst zur Laufzeit als RangeError auf;
// dieser Test fängt ihn in der CI.
//
// Lauf: node --experimental-strip-types --test tests/zeitzone.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const config = JSON.parse(await readFile(new URL('../config/city.config.json', import.meta.url), 'utf8'));

function istGueltigeZeitzone(tz) {
  try {
    new Intl.DateTimeFormat('de-CH', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

test('city.config.json setzt eine gültige IANA-Zeitzone', () => {
  assert.equal(typeof config.timeZone, 'string', 'timeZone fehlt — next-intl fiele auf UTC zurück');
  assert.ok(istGueltigeZeitzone(config.timeZone), `keine gültige IANA-Zeitzone: ${config.timeZone}`);
});

test('Die Prüfung erkennt ungültige Namen', () => {
  assert.equal(istGueltigeZeitzone('Europe/Zurich'), true);
  assert.equal(istGueltigeZeitzone('Europe/Zürich'), false);
  assert.equal(istGueltigeZeitzone('MEZ'), false);
});
