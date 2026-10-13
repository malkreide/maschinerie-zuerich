// Unit-Tests für die URL-Diagnose (scripts/lib/url-diagnose.mjs), die der
// manuelle Workflow url-diagnose.yml ausführt. Netzfrei: fetch, DNS und TLS
// sind durch Doubles ersetzt.
//
// Anlass: Die Netzfehler vom 13.10.2026 (amicus.ch: HEAD-Schleife,
// eumzugch.ch: NXDOMAIN) liessen sich nur auf einem Runner mit offenem Netz
// klären. Der Workflow ersetzt die dafür angelegten Probe-Branches.
//
// Lauf: node --experimental-strip-types --test tests/url-diagnose.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_URLS, berichtMarkdown, diagnose, parseUrls, verfolgeWeiterleitungen } from '../scripts/lib/url-diagnose.mjs';

test('parseUrls: trennt an Leerzeichen, Komma und Zeilenumbruch, entfernt Doppelte', () => {
  assert.deepEqual(parseUrls('https://a.ch/, https://b.ch/x\nhttp://c.ch https://a.ch/'), {
    urls: ['https://a.ch/', 'https://b.ch/x', 'http://c.ch'],
    abgelehnt: [],
  });
});

test('parseUrls: lehnt alles ab, was keine http(s)-URL ist (auch Shell-Syntax)', () => {
  const { urls, abgelehnt } = parseUrls(
    'https://ok.ch/ $(id) `whoami` ;rm file:///etc/passwd javascript:alert(1) https://x.ch/"; ftp://y.ch/',
  );
  assert.deepEqual(urls, ['https://ok.ch/']);
  assert.ok(abgelehnt.includes('$(id)'));
  assert.ok(abgelehnt.includes('`whoami`'));
  assert.ok(abgelehnt.includes('file:///etc/passwd'));
  assert.ok(abgelehnt.includes('https://x.ch/";'));
  assert.ok(abgelehnt.includes('ftp://y.ch/'));
  assert.deepEqual(parseUrls(''), { urls: [], abgelehnt: [] });
});

test(`parseUrls: höchstens ${MAX_URLS} URLs`, () => {
  const viele = Array.from({ length: MAX_URLS + 2 }, (_, i) => `https://h${i}.ch/`).join(' ');
  const { urls, abgelehnt } = parseUrls(viele);
  assert.equal(urls.length, MAX_URLS);
  assert.equal(abgelehnt.length, 2);
});

const antwort = (status, location) =>
  new Response(status >= 300 && status < 400 ? null : 'x', { status, headers: location ? { location } : {} });

test('verfolgeWeiterleitungen: erkennt die HEAD-Schleife von amicus.ch', async () => {
  const fetch = async (url, init) => {
    assert.equal(init.redirect, 'manual');
    if (url === 'https://www.amicus.ch/') return antwort(302, '/Account/Login');
    if (url === 'https://www.amicus.ch/Account/Login') return antwort(302, '/Error/Error');
    return antwort(302, '/Account/Login');
  };
  const k = await verfolgeWeiterleitungen('https://www.amicus.ch/', { method: 'HEAD', fetch });
  assert.equal(k.ende, 'schleife');
  assert.deepEqual(
    k.spruenge.map((s) => s.url),
    ['https://www.amicus.ch/', 'https://www.amicus.ch/Account/Login', 'https://www.amicus.ch/Error/Error'],
  );
});

test('verfolgeWeiterleitungen: endet beim ersten Nicht-3xx; Netzfehler mit Code', async () => {
  const fetch = async (url) => (url.endsWith('/eumzugngx/') ? antwort(200) : antwort(301, '/eumzugngx/'));
  const k = await verfolgeWeiterleitungen('https://www.eumzug.swiss/', { fetch });
  assert.equal(k.ende, 'ok');
  assert.deepEqual(k.spruenge.at(-1), { url: 'https://www.eumzug.swiss/eumzugngx/', status: 200 });

  const kaputt = async () => {
    throw Object.assign(new TypeError('fetch failed'), { cause: { code: 'ENOTFOUND' } });
  };
  const f = await verfolgeWeiterleitungen('https://www.eumzugch.ch/', { fetch: kaputt });
  assert.equal(f.ende, 'fehler');
  assert.equal(f.grund, 'ENOTFOUND');
});

test('diagnose: unbekannte Domain wird als tot eingeordnet, Bericht nennt NXDOMAIN', async () => {
  const fetch = async () => {
    throw Object.assign(new TypeError('fetch failed'), { cause: { code: 'ENOTFOUND' } });
  };
  const b = await diagnose('https://www.eumzugch.ch/', {
    fetch,
    dnsLokal: async () => ({ a: 'ENOTFOUND', aaaa: 'ENOTFOUND', cname: 'ENOTFOUND' }),
    domainUnbekannt: async () => true,
    zertifikat: async () => ({ gueltig: false, fehler: 'ENOTFOUND' }),
  });
  assert.equal(b.einordnung.kind, 'tot');
  assert.equal(b.einordnung.reason, 'Domain unbekannt (NXDOMAIN)');
  const md = berichtMarkdown([b], ['$(id)']);
  assert.match(md, /### https:\/\/www\.eumzugch\.ch\//);
  assert.match(md, /NXDOMAIN \(Domain existiert nicht\)/);
  assert.match(md, /Zertifikat:\*\* Fehler: ENOTFOUND/);
  assert.match(md, /Abgelehnte Eingaben.*`\$\(id\)`/);
});
