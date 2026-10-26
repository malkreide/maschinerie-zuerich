// Unit-Tests für den Belege-Aggregator lib/belege.ts.
//
// Lauf: node --experimental-strip-types --test tests/belege.test.mjs
// (npm run test:unit). lib/belege.ts hat nur type-only Imports, daher genügt
// Node-Type-Stripping ohne Pfad-Alias-Auflösung.
//
// Kernansprüche:
//   - Kardinalregel: das Aggregat enthält weder Zitate noch Labels.
//   - reproduzierbar: Eingabe-Reihenfolge egal, Ausgabe bit-identisch.
//   - Staatsebene nur aus der Host-Liste, an der Domain-Grenze, nie geraten.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildBelege, serializeBelege, ebeneFuerHost, istAelterAls, QUELLEN_EBENEN } from '../lib/belege.ts';
import { erkenneFassung } from '../scripts/lib/gesetzesfassung.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const REGELN = {
  stadt: ['stadt-zuerich.ch'],
  kanton: ['zh.ch'],
  bund: ['admin.ch', 'ch.ch'],
};
const OPTS = { regeln: REGELN, istGesetzesfassung: (url) => erkenneFassung(url) !== null };

const FEDLEX_PDF =
  'https://fedlex.data.admin.ch/filestore/fedlex.data.admin.ch/eli/cc/24/233_245_233/20260701/de/pdf-a/fedlex-data-admin-ch-eli-cc-24-233_245_233-20260701-de-pdf-a-1.pdf#page=39';

const alle = (s) => ({ de: s, en: s, fr: s, it: s, ls: s });

function prozess(id, extra = {}) {
  return {
    schema_version: '0.1.0',
    id,
    lebenslage_ref: id,
    city: 'zh',
    title: alle(id),
    target_audience: 'bevoelkerung',
    source_url: 'https://www.stadt-zuerich.ch/',
    retrieved_at: '2026-01-01',
    disclaimer_key: 'Prozesse.disclaimer',
    steps: [{ step_id: 1, actor: 'a', label: alle('Start'), depends_on: [], type: 'start' }],
    ...extra,
  };
}

function ref(reference_id, extra = {}) {
  return {
    reference_id,
    label: alle(`Label ${reference_id}`),
    source_url: 'https://www.stadt-zuerich.ch/de/seite.html',
    source_quote: `Wörtliches Zitat Nummer ${reference_id} mit 30 Tagen Frist.`,
    retrieved_at: '2026-03-01',
    ...extra,
  };
}

const zeile = (b, id) => b.prozesse.find((z) => z.id === id);

test('ebeneFuerHost: Subdomains zählen, Vergleich an der Label-Grenze', () => {
  assert.equal(ebeneFuerHost('www.stadt-zuerich.ch', REGELN), 'stadt');
  assert.equal(ebeneFuerHost('stadt-zuerich.ch', REGELN), 'stadt');
  assert.equal(ebeneFuerHost('www.notes.zh.ch', REGELN), 'kanton');
  assert.equal(ebeneFuerHost('fedlex.data.admin.ch', REGELN), 'bund');
  assert.equal(ebeneFuerHost('WWW.ZH.CH', REGELN), 'kanton');
  // 'notzh.ch' endet auf 'zh.ch', ist aber KEINE Subdomain davon.
  assert.equal(ebeneFuerHost('notzh.ch', REGELN), 'andere');
  assert.equal(ebeneFuerHost('example.org', REGELN), 'andere');
});

test('ebeneFuerHost: bei mehreren Treffern gewinnt die längste Domain', () => {
  const regeln = { stadt: ['stadt.zh.ch'], kanton: ['zh.ch'], bund: [] };
  assert.equal(ebeneFuerHost('www.stadt.zh.ch', regeln), 'stadt');
  assert.equal(ebeneFuerHost('www.zh.ch', regeln), 'kanton');
});

test('Kardinalregel: weder Zitate noch Labels im Artefakt', () => {
  const p = prozess('a', { references: [ref(1), ref(2)] });
  const out = serializeBelege(buildBelege('zh', [p], OPTS));
  for (const r of p.references) {
    assert.ok(!out.includes(r.source_quote), 'source_quote darf nicht im Aggregat stehen');
    assert.ok(!out.includes(r.label.de), 'Label darf nicht im Aggregat stehen');
  }
});

test('Status: fehlender status gilt als verifiziert, leeres Zitat zählt nicht', () => {
  const p = prozess('a', {
    references: [
      ref(1),
      ref(2, { status: 'verifiziert' }),
      ref(3, { status: 'unverifiziert', source_quote: '   ' }),
    ],
  });
  const z = zeile(buildBelege('zh', [p], OPTS), 'a');
  assert.deepEqual(z.summe, { referenzen: 3, verifiziert: 2, mitZitat: 2, unverifiziert: 1 });
  assert.equal(z.referenzen[0].status, 'verifiziert');
  assert.equal(z.referenzen[2].status, 'unverifiziert');
  assert.equal(z.referenzen[2].mitZitat, false);
});

test('Host, Ebene und Gesetzesfassung je Reference', () => {
  const p = prozess('a', {
    references: [ref(1, { source_url: FEDLEX_PDF }), ref(2), ref(3, { source_url: 'https://example.org/x' })],
  });
  const [r1, r2, r3] = zeile(buildBelege('zh', [p], OPTS), 'a').referenzen;
  assert.equal(r1.host, 'fedlex.data.admin.ch');
  assert.equal(r1.ebene, 'bund');
  assert.equal(r1.gesetzesfassung, true);
  assert.equal(r2.ebene, 'stadt');
  assert.equal(r2.gesetzesfassung, false);
  assert.equal(r3.ebene, 'andere');
});

test('Abrufdaten: ältester/jüngster, null ohne References', () => {
  const p = prozess('a', {
    references: [ref(1, { retrieved_at: '2026-06-10' }), ref(2, { retrieved_at: '2026-02-01' }), ref(3, { retrieved_at: '2026-10-11' })],
  });
  const leer = prozess('b');
  const b = buildBelege('zh', [p, leer], OPTS);
  assert.deepEqual(zeile(b, 'a').abruf, { aeltester: '2026-02-01', juengster: '2026-10-11' });
  assert.deepEqual(zeile(b, 'b').abruf, { aeltester: null, juengster: null });
  assert.equal(zeile(b, 'b').summe.referenzen, 0);
});

test('Hochrisiko, Bewertungs-Belege, Quellen und Rechtsgrundlagen', () => {
  const p = prozess('a', {
    disclaimer_key: 'Prozesse.disclaimerHochrisiko',
    sources: [{ id: 'q1', title: 'Q', url: 'https://www.zh.ch/', retrieved_at: '2026-01-01' }],
    legal_basis: [{ label: 'PBG', url: 'https://www.zh.ch/pbg' }, { label: 'VRG', url: 'https://www.zh.ch/vrg' }],
    bewertung: {
      indikatoren: [
        { key: 'online-antrag', wert: true, source_url: 'https://x.ch', source_quote: 'Online', retrieved_at: '2026-01-01' },
        { key: 'online-bezahlung', wert: false, source_url: 'https://x.ch', status: 'unverifiziert', retrieved_at: '2026-01-01' },
      ],
    },
  });
  const b = buildBelege('zh', [p, prozess('b')], OPTS);
  const z = zeile(b, 'a');
  assert.equal(z.hochrisiko, true);
  assert.equal(zeile(b, 'b').hochrisiko, false);
  assert.deepEqual(z.bewertungsBelege, { gesamt: 2, verifiziert: 1 });
  assert.equal(z.quellen, 1);
  assert.equal(z.rechtsgrundlagen, 2);
  assert.equal(b.summary.hochrisiko, 1);
});

test('Determinismus: Eingabe-Reihenfolge egal, Eingabe unverändert', () => {
  const a = prozess('a', { references: [ref(2), ref(1)] });
  const c = prozess('c', { references: [ref(1, { source_url: FEDLEX_PDF })] });
  const vorher = JSON.stringify([a, c]);
  const s1 = serializeBelege(buildBelege('zh', [a, c], OPTS));
  const s2 = serializeBelege(buildBelege('zh', [c, a], OPTS));
  assert.equal(s1, s2);
  assert.equal(JSON.stringify([a, c]), vorher, 'Eingabe darf nicht mutiert werden');
  const b = JSON.parse(s1);
  assert.deepEqual(b.prozesse.map((z) => z.slug), ['zh/a', 'zh/c']);
  assert.deepEqual(b.prozesse[0].referenzen.map((r) => r.reference_id), [1, 2]);
  assert.ok(s1.endsWith('}\n'));
});

test('Summary: Ebenen in fester Reihenfolge, Summe = alle References', () => {
  const p = prozess('a', {
    references: [ref(1), ref(2, { source_url: 'https://www.zh.ch/x' }), ref(3, { source_url: FEDLEX_PDF }), ref(4, { source_url: 'https://example.org' })],
  });
  const b = buildBelege('zh', [p, prozess('b', { references: [ref(1)] })], OPTS);
  assert.deepEqual(Object.keys(b.summary.nachEbene), QUELLEN_EBENEN);
  assert.deepEqual(b.summary.nachEbene, { stadt: 2, kanton: 1, bund: 1, andere: 1 });
  assert.equal(b.summary.referenzen, 5);
  assert.equal(b.summary.prozesse, 2);
});

test('istAelterAls: Grenze bei 365 Tagen, unlesbares Datum nie alt', () => {
  const heute = new Date('2027-06-10T12:00:00Z');
  assert.equal(istAelterAls('2026-06-10', heute), true); // 365 Tage + 12 h
  assert.equal(istAelterAls('2026-06-11', heute), false); // 364 Tage + 12 h
  assert.equal(istAelterAls('2027-06-10', heute), false);
  assert.equal(istAelterAls('2026-06-10', heute, 400), false);
  assert.equal(istAelterAls('kein-datum', heute), false);
});

test('Echte Daten: nur erlaubte Felder je Reference, kein Zitat im Aggregat', async () => {
  const dir = path.join(root, 'data', 'prozesse', 'zh');
  const prozesse = [];
  for (const f of (await readdir(dir)).filter((f) => f.endsWith('.json'))) {
    prozesse.push(JSON.parse(await readFile(path.join(dir, f), 'utf-8')));
  }
  const cfg = JSON.parse(await readFile(path.join(root, 'config', 'quellen-ebenen.json'), 'utf-8'));
  const regeln = { stadt: cfg.staedte.zh.stadt, kanton: cfg.staedte.zh.kanton, bund: cfg.bund };
  const out = serializeBelege(buildBelege('zh', prozesse, { ...OPTS, regeln }));
  const erlaubt = ['reference_id', 'status', 'mitZitat', 'host', 'ebene', 'gesetzesfassung', 'retrieved_at'];
  for (const z of JSON.parse(out).prozesse) {
    for (const r of z.referenzen) assert.deepEqual(Object.keys(r), erlaubt);
  }
  for (const p of prozesse) {
    for (const r of p.references ?? []) {
      if (r.source_quote) assert.ok(!out.includes(r.source_quote), `${p.id} ref ${r.reference_id}: Zitat im Aggregat`);
    }
  }
});
