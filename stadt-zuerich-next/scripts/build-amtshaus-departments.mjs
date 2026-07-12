#!/usr/bin/env node
// Baut die belegte Zuordnung Amtshaus (poi_id) → zuständiges Departement und
// schreibt sie nach data/geo/zh/amtshaeuser-departments.json. Konsumiert wird
// die Datei von scripts/fetch-geo.mjs (source.departmentOverride).
//
// Quelle ist AUSSCHLIESSLICH der ODZ-Datensatz geo_amtshaus selbst, kreuz-
// referenziert gegen unsere kanonische Org-Chart (data/zh/org-chart.json).
// Auflösungs-Priorität pro Standort:
//   1. Feld `www` mit Departements-Slug (z.B. /ssd, /hbd, /sd, /stadtpolizei)
//   2. Feld `dep` als Klartext — ABER NICHT der generische Eigentümer-Default
//      'Hochbaudepartement (HBD)' (HBD = Immobilien als Gebäudeverwalter)
//   3. Feld `da` (Dienstabteilung) gegen Org-Chart-Einheitsnamen — ohne die
//      generischen Datenpfleger/Facility-Werte (siehe MAINTAINER_DA)
//   4. erste Zeile von `postadresse` gegen Org-Chart-Einheitsnamen
// Ohne Treffer bleibt department=null → fetch-geo nutzt den Layer-Default (BUG,
// allgemeine Verwaltung) und es wird KEIN Verfahren behauptet (Kardinalregel).
//
// Voraussetzung: data/ogd.stadt-zuerich.ch erreichbar (Netzwerk-Allowlist).

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { XMLParser } from 'fast-xml-parser';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const today = new Date().toISOString().slice(0, 10);

// www-Slug → Departements-Code (ODZ-Standort-Website).
const SLUG_MAP = {
  '/hbd': 'HBD', '/ssd': 'SSD', '/gud': 'GUD', '/sd': 'SD', '/prd': 'PRD',
  '/fd': 'FD', '/ted': 'TED', '/dib': 'DIB', '/sid': 'SiD', '/stadtpolizei': 'SiD',
};
// dep-Klartext → Code. 'Hochbaudepartement (HBD)' fehlt bewusst (Eigentümer-Default).
const DEP_MAP = {
  'Präsidialdepartement (PRD)': 'PRD',
  'Finanzdepartement (FD)': 'FD',
  'Sozialdepartement (SD)': 'SD',
  'Gesundheits- und Umweltdepartement (GUD)': 'GUD',
  'Tiefbau- und Entsorgungsdepartement (TED)': 'TED',
  'Sicherheitsdepartement (SiD)': 'SiD',
  'Schul- und Sportdepartement (SSD)': 'SSD',
  'Departement der Industriellen Betriebe (DIB)': 'DIB',
};
// `da`-Werte, die NICHT die ansässige Stelle, sondern den Datenpfleger/Gebäude-
// verwalter benennen — als Signal ignorieren (analog dep=HBD).
const MAINTAINER_DA = new Set([
  'Immobilien Stadt Zürich',
  'Liegenschaften Stadt Zürich',
  'Departementssekretariat',
]);

// Belegte Zweitquellen für Standorte, die im ODZ-Datensatz nur den Eigentümer/
// Datenpfleger nennen. Greift NUR, wenn die ODZ-Felder kein Signal liefern.
// Jede Zuordnung nennt ihre externe (aber amtliche) Quelle. Standorte mit
// widersprüchlicher/unklarer Quellenlage bleiben bewusst offen (department=null).
const MANUAL_OVERRIDE = {
  // Amtshaus II (Beatenplatz 1): Sitz der Feuerpolizei / Schutz und Rettung (SiD).
  ah003: {
    department: 'SiD',
    quelle: 'https://www.stadt-zuerich.ch/content/dam/web/de/politik-verwaltung/stadtverwaltung/sid/plan_standorte_schutz_und_rettung.pdf',
    hinweis: 'Schutz und Rettung Zürich (Feuerpolizei) am Beatenplatz 1 — Standortplan SiD',
  },
  // Verwaltungszentrum Werd (Werdstrasse 75): Sitz des Sozialdepartements (SD) seit 2004.
  ah014: {
    department: 'SD',
    quelle: 'https://stored-data.stadt-zuerich.ch/internet/mm/home/mm_04/12_04/mm_08.html',
    hinweis: 'Umzug des Sozialdepartements ins Verwaltungszentrum Werd (Medienmitteilung 2004)',
  },
  // Amtshaus V (Werdmühleplatz 3): Sitz des Tiefbauamts (TED). Das Tiefbauamt
  // führt diese Adresse als eigene Postadresse; der frühere «Industrielle
  // Betriebe»-Treffer war ein künftiges Hochbau-Projekt, nicht die aktuelle
  // Belegung.
  ah012: {
    department: 'TED',
    quelle: 'https://www.stadt-zuerich.ch/misc/de/standards-stadtraeume/service/kontakt.html',
    hinweis: 'Tiefbauamt, Werdmühleplatz 3, Amtshaus V (Kontakt-/Postadresse des Tiefbauamts, TED)',
  },
};

function datasetIdFromUrl(u) {
  const m = /\/dataset\/([^/?#]+)/.exec(u || '');
  return m ? m[1] : null;
}

async function fetchAmtshausFeatures() {
  const id = 'geo_amtshaus';
  const api = `https://data.stadt-zuerich.ch/api/3/action/package_show?id=${encodeURIComponent(id)}`;
  const pkg = await (await fetch(api, { headers: { Accept: 'application/json' } })).json();
  const resources = pkg?.result?.resources ?? [];
  const wfsRes = resources.find((r) => /wfs/i.test(r.format || '') || /\/wfs\//i.test(r.url || ''));
  if (!wfsRes?.url) throw new Error('keine WFS-Ressource im CKAN-Datensatz geo_amtshaus');
  const wfsBase = wfsRes.url.split('?')[0];

  const capsXml = await (await fetch(`${wfsBase}?service=WFS&version=1.1.0&request=GetCapabilities`)).text();
  const caps = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true }).parse(capsXml);
  let fts = caps?.WFS_Capabilities?.FeatureTypeList?.FeatureType ?? [];
  if (!Array.isArray(fts)) fts = [fts];
  const names = fts.map((f) => String(f?.Name ?? '')).filter(Boolean);
  const tn = names.find((n) => /_view$/i.test(n)) || names[0];
  if (!tn) throw new Error('keine FeatureType im WFS-GetCapabilities');

  const formats = ['application/vnd.geo+json', 'application/json', 'GeoJSON', 'geojson'];
  for (const of of formats) {
    const url = `${wfsBase}?service=WFS&version=1.1.0&request=GetFeature&typename=${encodeURIComponent(tn)}&outputFormat=${encodeURIComponent(of)}`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) continue;
    const text = await res.text();
    if (text.trimStart().startsWith('<')) continue;
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed.features)) return parsed.features;
  }
  throw new Error('kein outputFormat lieferte GeoJSON');
}

const org = JSON.parse(await readFile(path.join(root, 'data/zh/org-chart.json'), 'utf-8'));
const deptIds = new Set(org.departments.map((d) => d.id));
// Org-Chart-Einheitsname (lowercase) → Departements-Code (parent).
const unitNameToDept = new Map();
for (const u of org.units) {
  if (u.parent && deptIds.has(u.parent)) unitNameToDept.set(String(u.name).toLowerCase(), u.parent);
}

function matchUnit(value) {
  if (!value) return null;
  const v = String(value).toLowerCase().trim();
  if (!v) return null;
  return unitNameToDept.get(v) ?? null;
}

function resolve(p) {
  const www = (p.www || '').toLowerCase();
  // 1. www-Slug
  const slug = Object.keys(SLUG_MAP).find((s) => www.endsWith(s));
  if (slug) return { department: SLUG_MAP[slug], beleg: `ODZ-Feld www=${p.www}` };
  // 2. dep (ohne HBD-Eigentümer-Default)
  if (DEP_MAP[p.dep]) return { department: DEP_MAP[p.dep], beleg: `ODZ-Feld dep=${p.dep}` };
  // 3. da (Dienstabteilung) gegen Org-Chart, ohne generische Datenpfleger
  if (p.da && !MAINTAINER_DA.has(p.da)) {
    const dept = matchUnit(p.da);
    if (dept) return { department: dept, beleg: `ODZ-Feld da=${p.da} → Org-Chart-Einheit → ${dept}` };
  }
  // 4. erste Zeile der postadresse gegen Org-Chart
  if (p.postadresse) {
    const firstLine = String(p.postadresse).split(/<br\s*\/?>(?:\s*)?/i)[0];
    const dept = matchUnit(firstLine);
    if (dept) return { department: dept, beleg: `ODZ-Feld postadresse="${firstLine}" → Org-Chart-Einheit → ${dept}` };
  }
  return {
    department: null,
    beleg: 'kein eindeutiges ODZ-Signal (nur Eigentümer/Datenpfleger) → allgemein',
  };
}

const features = await fetchAmtshausFeatures();
const entries = {};
for (const f of features) {
  const p = f.properties;
  let { department, beleg } = resolve(p);
  // Belegte Zweitquelle nur greifen lassen, wenn ODZ kein Signal liefert.
  if (!department && MANUAL_OVERRIDE[p.poi_id]) {
    const mo = MANUAL_OVERRIDE[p.poi_id];
    department = mo.department;
    beleg = `Zweitquelle (amtlich, ausserhalb ODZ): ${mo.hinweis} — ${mo.quelle}`;
  }
  entries[p.poi_id] = { name: p.name, department, beleg };
}

const doc = {
  _meta: {
    _doc: [
      'Belegte, reviewte Zuordnung Amtshaus (poi_id) → zuständiges Departement.',
      'Füllt Follow-up #2 (Klick-Detail → Verfahren) für den Amtshäuser-Layer.',
      '',
      'Generiert von scripts/build-amtshaus-departments.mjs. Quelle ist',
      'ausschliesslich der ODZ-Datensatz geo_amtshaus, kreuzreferenziert gegen',
      'die kanonische Org-Chart (data/zh/org-chart.json). Priorität: www-Slug,',
      'dann dep (ohne Eigentümer-Default HBD), dann da/postadresse gegen',
      'Org-Chart-Einheitsnamen (ohne generische Datenpfleger wie',
      '"Immobilien Stadt Zürich"). Für einzelne Standorte ohne ODZ-Signal greift',
      'eine belegte Zweitquelle (MANUAL_OVERRIDE, amtliche Standortangaben',
      'ausserhalb des ODZ-Datensatzes). Ohne Treffer bleibt department=null und',
      'der Layer-Default (BUG) greift — KEINE Verfahrens-Behauptung (Kardinalregel).',
      '',
      'Aktualisieren mit: npm run data:build-amtshaus-departments',
      'Danach npm run data:fetch-geo, um den Snapshot neu zu schreiben.',
    ],
    quelle: 'Open Data Zürich – geo_amtshaus (poi_amtshaus_view) + data/zh/org-chart.json',
    datasetUrl: 'https://data.stadt-zuerich.ch/dataset/geo_amtshaus',
    lizenz: 'CC-BY',
    stand: today,
    keyField: 'poi_id',
  },
  entries,
};

await writeFile(
  path.join(root, 'data/geo/zh/amtshaeuser-departments.json'),
  JSON.stringify(doc, null, 2) + '\n',
);

const mapped = Object.values(entries).filter((x) => x.department).length;
console.log(`✓ amtshaeuser-departments.json: ${mapped}/${Object.keys(entries).length} Standorte belegt zugeordnet.`);
for (const [k, v] of Object.entries(entries)) {
  console.log(`  ${k}  ${v.department ?? '—'}  (${v.name})`);
}
