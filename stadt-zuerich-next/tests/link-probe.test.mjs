// Unit-Tests für Abruf und Einordnung im Live-Link-Check
// (scripts/lib/link-probe.mjs). Netzfrei: fetch ist durch ein Double ersetzt.
//
// Anlass: Wochenlauf vom 13.10.2026 meldete zwei «Netzfehler, kein
// Datenfehler». www.amicus.ch lebt (HEAD läuft in eine Weiterleitungs-
// schleife, GET liefert 200); www.eumzugch.ch gibt es nicht (kein
// DNS-Eintrag) — das war ein Datenfehler.
//
// Lauf: node --experimental-strip-types --test tests/link-probe.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classify, dnsBefundeEinordnen, domainUnbekannt, fehlerGrund, probeUrl } from '../scripts/lib/link-probe.mjs';

const fetchFehler = (cause) => Object.assign(new TypeError('fetch failed'), { cause });

test('HEAD scheitert an einer Weiterleitungsschleife → GET entscheidet (amicus.ch)', async () => {
  const methoden = [];
  const fetch = async (url, init) => {
    methoden.push(init.method);
    if (init.method === 'HEAD') throw fetchFehler(new Error('redirect count exceeded'));
    return new Response('', { status: 200 });
  };
  assert.deepEqual(await probeUrl('https://www.amicus.ch/', { fetch }), {
    url: 'https://www.amicus.ch/',
    kind: 'ok',
    status: 200,
  });
  assert.deepEqual(methoden, ['HEAD', 'GET']);
});

test('HEAD mit Fehlerstatus → GET; HEAD ok → kein GET', async () => {
  const methoden = [];
  const fetch405 = async (url, init) => {
    methoden.push(init.method);
    return new Response('', { status: init.method === 'HEAD' ? 405 : 200 });
  };
  assert.equal((await probeUrl('https://x.ch/', { fetch: fetch405 })).kind, 'ok');
  assert.deepEqual(methoden, ['HEAD', 'GET']);

  let aufrufe = 0;
  const fetchOk = async () => (aufrufe++, new Response('', { status: 200 }));
  await probeUrl('https://x.ch/', { fetch: fetchOk });
  assert.equal(aufrufe, 1);
});

test('Scheitert auch GET → Netzfehler mit Fehlercode statt «fetch failed»', async () => {
  const fetch = async () => {
    throw fetchFehler(Object.assign(new Error('getaddrinfo ENOTFOUND www.eumzugch.ch'), { code: 'ENOTFOUND' }));
  };
  assert.deepEqual(await probeUrl('https://www.eumzugch.ch/', { fetch }), {
    url: 'https://www.eumzugch.ch/',
    kind: 'netzfehler',
    status: 0,
    reason: 'ENOTFOUND',
  });
  assert.equal(fehlerGrund(Object.assign(new Error('x'), { name: 'TimeoutError' })), 'Timeout');
  assert.equal(fehlerGrund(fetchFehler(new Error('redirect count exceeded'))), 'redirect count exceeded');
});

const doh = (status) => async (url) => {
  assert.match(url, /^https:\/\/(dns\.google|cloudflare-dns\.com)\//);
  return new Response(JSON.stringify({ Status: status }), { headers: { 'content-type': 'application/dns-json' } });
};

test('Unbekannte Domain zählt als tot, wenn ein öffentlicher Resolver NXDOMAIN bestätigt (eumzugch.ch)', async () => {
  const anfragen = [];
  const fetch = async (url, init) => (anfragen.push(url), doh(3)(url, init));
  const ergebnis = await dnsBefundeEinordnen(
    [
      { url: 'https://www.stadt-zuerich.ch/', kind: 'ok', status: 200 },
      { url: 'https://www.eumzugch.ch/', kind: 'netzfehler', status: 0, reason: 'ENOTFOUND' },
      { url: 'https://www.eumzugch.ch/abmelden', kind: 'netzfehler', status: 0, reason: 'ENOTFOUND' },
      { url: 'https://langsam.ch/', kind: 'netzfehler', status: 0, reason: 'Timeout' },
    ],
    { fetch },
  );
  assert.deepEqual(ergebnis[1], {
    url: 'https://www.eumzugch.ch/',
    kind: 'tot',
    status: 0,
    reason: 'Domain unbekannt (NXDOMAIN)',
  });
  assert.equal(ergebnis[2].kind, 'tot');
  assert.equal(ergebnis[3].kind, 'netzfehler', 'Timeout bleibt umgebungsabhängig');
  assert.equal(anfragen.length, 1, 'eine Abfrage je Host');
  assert.match(anfragen[0], /name=www\.eumzugch\.ch/);
});

test('Resolver kennt den Host oder ist nicht erreichbar → bleibt Netzfehler (abgeschottete Umgebung)', async () => {
  const r = [{ url: 'https://www.zh.ch/', kind: 'netzfehler', status: 0, reason: 'ENOTFOUND' }];
  assert.deepEqual(await dnsBefundeEinordnen(r, { fetch: doh(0) }), r);
  const gesperrt = async () => {
    throw fetchFehler(Object.assign(new Error('getaddrinfo ENOTFOUND dns.google'), { code: 'ENOTFOUND' }));
  };
  assert.deepEqual(await dnsBefundeEinordnen(r, { fetch: gesperrt }), r);
});

test('domainUnbekannt: zweiter Resolver springt ein', async () => {
  const fetch = async (url) =>
    url.startsWith('https://dns.google/') ? new Response('', { status: 503 }) : doh(3)(url);
  assert.equal(await domainUnbekannt('www.eumzugch.ch', { fetch }), true);
});

test('classify: Statusklassen unverändert', () => {
  assert.equal(classify(200), 'ok');
  assert.equal(classify(302), 'ok');
  assert.equal(classify(404), 'tot');
  assert.equal(classify(503), 'tot');
  assert.equal(classify(403), 'blockiert');
  assert.equal(classify(429), 'blockiert');
});
