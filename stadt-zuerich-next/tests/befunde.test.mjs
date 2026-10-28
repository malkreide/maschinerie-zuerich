// Unit-Tests für das Wochenbefund-Modell lib/befunde.ts.
//
// Lauf: node --experimental-strip-types --test tests/befunde.test.mjs
// (npm run test:unit). lib/befunde.ts hat keine Imports.
//
// Kernansprüche:
//   - nur vollständig geprüfte References kommen in den Befund, nichts geraten.
//   - ein Befund gilt nur für die geprüfte Fassung (url + retrieved_at).
//   - Zeitpunkt/Umgebung des Laufs ändern den Inhalt nicht (kein Bot-PR-Rauschen).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  befundLeser,
  buildWochenbefund,
  inhaltGleich,
  netzfehlerAnteil,
  serializeWochenbefund,
  zaehleBefunde,
} from '../lib/befunde.ts';

const U1 = 'https://www.stadt-zuerich.ch/a.html';
const U2 = 'https://www.ch.ch/b/';

function eingabe(extra = {}) {
  return {
    city: 'zh',
    erhobenAm: '2026-11-02T06:30:00.000Z',
    laufUrl: 'https://github.com/malkreide/maschinerie-zuerich/actions/runs/1',
    umgebung: 'github-actions',
    links: [
      { url: U1, kind: 'ok', status: 200 },
      { url: U2, kind: 'tot', status: 404 },
    ],
    drift: [
      { datei: 'data/prozesse/zh/b.json', reference_id: 1, url: U2, zitat: 'drift', fassung: 'nicht-anwendbar' },
      { datei: 'data/prozesse/zh/a.json', reference_id: 1, url: U1, zitat: 'woertlich', fassung: 'aktuell' },
    ],
    referenzen: [
      { datei: 'data/prozesse/zh/b.json', slug: 'zh/b', reference_id: 1, url: U2, retrieved_at: '2026-06-10' },
      { datei: 'data/prozesse/zh/a.json', slug: 'zh/a', reference_id: 1, url: U1, retrieved_at: '2026-06-10' },
    ],
    ...extra,
  };
}

test('führt Link- und Drift-Bericht je Reference zusammen, sortiert', () => {
  const w = buildWochenbefund(eingabe());
  assert.deepEqual(w.referenzen.map((r) => r.slug), ['zh/a', 'zh/b']);
  assert.deepEqual(w.referenzen[1], {
    slug: 'zh/b',
    reference_id: 1,
    url: U2,
    retrieved_at: '2026-06-10',
    erreichbar: 'tot',
    http_status: 404,
    zitat: 'drift',
    fassung: 'nicht-anwendbar',
  });
  assert.equal(w.umgebung, 'github-actions');
});

test('unvollständig geprüfte References fehlen statt geraten zu werden', () => {
  const e = eingabe();
  e.referenzen.push({ datei: 'data/prozesse/zh/c.json', slug: 'zh/c', reference_id: 1, url: 'https://x.ch/', retrieved_at: '2026-06-10' });
  // Drift-Bericht hat für a eine andere URL geprüft → a fällt ebenfalls weg.
  e.drift[1] = { ...e.drift[1], url: 'https://anders.ch/' };
  const w = buildWochenbefund(e);
  assert.deepEqual(w.referenzen.map((r) => r.slug), ['zh/b']);
});

test('Netzfehler ohne Antwort: http_status null', () => {
  const w = buildWochenbefund(eingabe({ links: [{ url: U1, kind: 'netzfehler', status: 0 }, { url: U2, kind: 'ok', status: 200 }] }));
  assert.equal(w.referenzen.find((r) => r.slug === 'zh/a').http_status, null);
});

test('inhaltGleich ignoriert Zeitpunkt, Lauf und Umgebung', () => {
  const a = buildWochenbefund(eingabe());
  const b = buildWochenbefund(eingabe({ erhobenAm: '2026-11-09T06:30:00.000Z', laufUrl: null, umgebung: 'lokal' }));
  assert.equal(inhaltGleich(a, b), true);
  const c = buildWochenbefund(eingabe({ links: [{ url: U1, kind: 'ok', status: 200 }, { url: U2, kind: 'ok', status: 200 }] }));
  assert.equal(inhaltGleich(a, c), false);
});

test('befundLeser: gilt nur für dieselbe URL und dasselbe Abrufdatum', () => {
  const lies = befundLeser(buildWochenbefund(eingabe()));
  assert.equal(lies({ slug: 'zh/a', reference_id: 1, url: U1, retrieved_at: '2026-06-10' })?.zitat, 'woertlich');
  // Reference wurde seither neu belegt → alter Befund gilt nicht mehr.
  assert.equal(lies({ slug: 'zh/a', reference_id: 1, url: U1, retrieved_at: '2026-11-05' }), null);
  // Link wurde seither korrigiert → «tot» gilt nicht mehr für den neuen Link.
  assert.equal(lies({ slug: 'zh/b', reference_id: 1, url: 'https://www.ch.ch/neu/', retrieved_at: '2026-06-10' }), null);
  assert.equal(lies({ slug: 'zh/x', reference_id: 1, url: U1, retrieved_at: '2026-06-10' }), null);
  assert.equal(befundLeser(null)({ slug: 'zh/a', reference_id: 1, url: U1, retrieved_at: '2026-06-10' }), null);
});

test('netzfehlerAnteil: leerer Lauf gilt als vollständig gestört', () => {
  assert.equal(netzfehlerAnteil([]), 1);
  assert.equal(netzfehlerAnteil([{ url: U1, kind: 'netzfehler', status: 0 }, { url: U2, kind: 'ok', status: 200 }]), 0.5);
});

test('zaehleBefunde: ohne Befund offen, gesperrt nie tot', () => {
  const b = (erreichbar, zitat, fassung = 'nicht-anwendbar') => ({
    slug: 'zh/a', reference_id: 1, url: U1, retrieved_at: '2026-06-10', erreichbar, http_status: 200, zitat, fassung,
  });
  const z = zaehleBefunde([
    { gesetzesfassung: false, befund: b('ok', 'woertlich') },
    { gesetzesfassung: false, befund: b('tot', 'nicht-pruefbar') },
    { gesetzesfassung: true, befund: b('blockiert', 'drift', 'ueberholt') },
    { gesetzesfassung: true, befund: null },
  ]);
  assert.deepEqual(z, {
    referenzen: 4,
    linkOk: 1, linkTot: 1, linkOffen: 2, linkGesperrt: 1,
    zitatWoertlich: 1, zitatDrift: 1, zitatOffen: 2,
    gesetze: 2, fassungAktuell: 0, fassungUeberholt: 1, fassungOffen: 1,
  });
});

test('Kardinalregel: kein Zitat, kein Seitentext im Snapshot', () => {
  const out = serializeWochenbefund(buildWochenbefund(eingabe()));
  for (const verboten of ['source_quote', 'aehnlich', 'label']) assert.ok(!out.includes(verboten));
  assert.ok(out.endsWith('}\n'));
});
