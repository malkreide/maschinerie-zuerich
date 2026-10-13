// Unit-Tests für die Erkennung von Basisadressen (scripts/lib/basis-urls.mjs),
// die der Live-Link-Check nicht abruft.
//
// Anlass: Wochenlauf vom 13.10.2026 meldete `repoRawUrl` als «tot» (404) und
// `baseUrl` der RPKK-API als «blockiert» (403) — beides Präfixe, keine Links.
//
// Lauf: node --experimental-strip-types --test tests/basis-urls.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BASIS_URL_KEY, zaehleBasisUrls } from '../scripts/lib/basis-urls.mjs';

test('Basis-Schlüssel: baseUrl, …BaseUrl, …RawUrl — nicht aber gewöhnliche URL-Felder', () => {
  for (const k of ['baseUrl', 'apiBaseUrl', 'repoRawUrl']) assert.match(k, BASIS_URL_KEY);
  for (const k of ['url', 'source_url', 'datasetUrl', 'homepageUrl', 'licenseUrl', 'externalSearchUrlTemplate', 'base']) {
    assert.doesNotMatch(k, BASIS_URL_KEY);
  }
});

test('zaehleBasisUrls findet verschachtelte Basisadressen (Ausschnitt city.config.json)', () => {
  const config = {
    repoRawUrl: 'https://raw.githubusercontent.com/malkreide/maschinerie-zuerich/main/stadt-zuerich-next',
    datenquellen: [{ id: 'rpkk', baseUrl: 'https://api.stadt-zuerich.ch/rpkk-rs/v1', homepageUrl: 'https://www.stadt-zuerich.ch/' }],
  };
  assert.deepEqual(
    [...zaehleBasisUrls(config)],
    [
      ['https://raw.githubusercontent.com/malkreide/maschinerie-zuerich/main/stadt-zuerich-next', 1],
      ['https://api.stadt-zuerich.ch/rpkk-rs/v1', 1],
    ],
  );
});

test('Werte, die keine URL sind, und Nicht-String-Werte werden ignoriert', () => {
  assert.equal(zaehleBasisUrls({ baseUrl: '/relativ', repoRawUrl: null, x: { baseUrl: 42 } }).size, 0);
});
