// Unit-Tests für den Fassungs-Abgleich (scripts/lib/gesetzesfassung.mjs) im
// Zitat-Drift-Bericht. Netzfrei: fedlex-SPARQL und ZHlex-Weiterleitung sind
// durch ein fetch-Double ersetzt.
//
// Anlass: steuern Ref. 2 (StG ZH, ZHlex-Nachtrag) und heiraten Ref. 1/2
// (ZGB, fedlex-Fassung) verlinken versionierte PDFs. Ein neuer Gesetzesstand
// lässt den alten Link leben — nur dieser Abgleich bemerkt ihn.
//
// Lauf: node --experimental-strip-types --test tests/gesetzesfassung.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { erkenneFassung, fassungsSchluessel, pruefeFassung } from '../scripts/lib/gesetzesfassung.mjs';

const ZGB_PDF =
  'https://fedlex.data.admin.ch/filestore/fedlex.data.admin.ch/eli/cc/24/233_245_233/20260701/de/pdf-a/fedlex-data-admin-ch-eli-cc-24-233_245_233-20260701-de-pdf-a-1.pdf#page=39';
const STG_PDF =
  'https://www.notes.zh.ch/appl/zhlex_r.nsf/WebView/A1B72A220CD6E747C1258DC4002A921E/$File/631.1_8.6.97_132.pdf';

const sparqlAntwort = (zeilen) =>
  new Response(
    JSON.stringify({ results: { bindings: zeilen.map(([date, url]) => ({ date: { value: date }, url: { value: url } })) } }),
    { headers: { 'content-type': 'application/sparql-results+json' } },
  );

function weiterleitung(ziel) {
  const res = new Response('<html></html>', { headers: { 'content-type': 'text/html' } });
  Object.defineProperty(res, 'url', { value: ziel });
  return res;
}

test('erkenneFassung: fedlex-PDF mit Seitenanker und ZHlex-PDF', () => {
  assert.deepEqual(erkenneFassung(ZGB_PDF), {
    quelle: 'fedlex',
    eli: 'eli/cc/24/233_245_233',
    datum: '2026-07-01',
    sprache: 'de',
  });
  assert.deepEqual(erkenneFassung(STG_PDF), { quelle: 'zhlex', ls: '631.1', nachtrag: 132 });
  assert.equal(erkenneFassung('https://www.stadt-zuerich.ch/de/lebenslagen.html'), null);
  assert.equal(erkenneFassung('https://www.fedlex.admin.ch/eli/cc/24/233_245_233/de'), null);
});

test('fedlex: verlinkte Fassung ist die geltende → aktuell; künftige Fassung zählt nicht', async () => {
  const f = erkenneFassung(ZGB_PDF);
  let anfragen = 0;
  const fetch = async (url, init) => {
    anfragen++;
    assert.equal(url, 'https://fedlex.data.admin.ch/sparqlendpoint');
    assert.match(String(init.body), /eli%2Fcc%2F24%2F233_245_233/);
    return sparqlAntwort([
      ['2027-01-01', 'https://…/20270101/de/pdf-a/x-20270101-de-pdf-a-1.pdf'],
      ['2026-07-01', 'https://…/20260701/de/pdf-a/x-20260701-de-pdf-a-1.pdf'],
      ['2026-01-01', 'https://…/20260101/de/pdf-a/x-20260101-de-pdf-a-2.pdf'],
    ]);
  };
  const cache = new Map();
  assert.deepEqual(await pruefeFassung(f, { fetch, heute: '2026-10-12', cache }), { status: 'aktuell' });
  // Zweite Reference auf dasselbe Gesetz (heiraten Ref. 2): keine zweite Abfrage.
  await pruefeFassung(erkenneFassung(ZGB_PDF.replace('#page=39', '#page=41')), { fetch, heute: '2026-10-12', cache });
  assert.equal(anfragen, 1);
});

test('fedlex: neuere geltende Fassung → veraltet mit neuer PDF-URL', async () => {
  const fetch = async () =>
    sparqlAntwort([
      ['2027-01-01', 'https://fedlex/neu-20270101.pdf'],
      ['2026-07-01', 'https://fedlex/alt-20260701.pdf'],
    ]);
  const b = await pruefeFassung(erkenneFassung(ZGB_PDF), { fetch, heute: '2027-02-01' });
  assert.deepEqual(b, {
    status: 'veraltet',
    verlinkt: 'Fassung vom 2026-07-01',
    aktuell: 'Fassung vom 2027-01-01',
    neu: 'https://fedlex/neu-20270101.pdf',
  });
});

test('ZHlex: Weiterleitung auf den aktuellen Nachtrag entscheidet', async () => {
  const f = erkenneFassung(STG_PDF);
  const aktuell = async (url) => {
    assert.equal(url, 'http://www.zhlex.zh.ch/Erlass.html?Open&Ordnr=631.1');
    return weiterleitung('https://www.zh.ch/de/…/zhlex-ls/erlass-631_1-1997_06_08-1999_01_01-132.html');
  };
  assert.deepEqual(await pruefeFassung(f, { fetch: aktuell }), { status: 'aktuell' });

  const neuer = async () => weiterleitung('https://www.zh.ch/de/…/zhlex-ls/erlass-631_1-1997_06_08-2027_01_01-135.html');
  const b = await pruefeFassung(f, { fetch: neuer });
  assert.equal(b.status, 'veraltet');
  assert.equal(b.verlinkt, 'Nachtrag 132');
  assert.equal(b.aktuell, 'Nachtrag 135');
});

test('ZHlex: kleinere Nachtragsnummer gilt ebenfalls als andere Fassung (Nummern nicht monoton)', async () => {
  const fetch = async () => weiterleitung('https://www.zh.ch/de/…/erlass-631_1-1997_06_08-1999_01_01-127.html');
  assert.equal((await pruefeFassung(erkenneFassung(STG_PDF), { fetch })).status, 'veraltet');
});

test('Quelle nicht erreichbar → nicht prüfbar statt Fehlalarm', async () => {
  const kaputt = async () => new Response('', { status: 503 });
  assert.deepEqual(await pruefeFassung(erkenneFassung(ZGB_PDF), { fetch: kaputt, heute: '2026-10-12' }), {
    status: 'nicht-pruefbar',
    grund: 'SPARQL 503',
  });
  const netz = async () => {
    throw new Error('fetch failed');
  };
  assert.equal((await pruefeFassung(erkenneFassung(STG_PDF), { fetch: netz })).status, 'nicht-pruefbar');
});

test('fassungsSchluessel: je Erlass und Sprache', () => {
  assert.equal(fassungsSchluessel(erkenneFassung(ZGB_PDF)), 'fedlex:eli/cc/24/233_245_233:de');
  assert.equal(fassungsSchluessel(erkenneFassung(STG_PDF)), 'zhlex:631.1');
});
