#!/usr/bin/env node
// Holt die echten Stadtkreis-Grenzen (Polygone) von Open Data Zürich und
// schreibt sie nach public/data/stadtkreise.geojson — mit den Properties
// kname/knr, wie sie die Quartier-Ansicht (QuartierMap / lib/quartier-geo)
// erwartet. Ersetzt die Platzhalter-Rechtecke; danach erkennt die Ansicht
// echte Grenzen automatisch (isPlaceholderGeometry) und zeigt reale Fläche +
// Standort-Zählung (Point-in-Polygon gegen die Geo-Snapshots).
//
// Wie fetch-geo.mjs: Das echte GeoJSON kommt über den WFS-Dienst (die
// 'geodaten/download'-Seite ist eine SPA und liefert HTML). Voraussetzung:
// data/ogd.stadt-zuerich.ch erreichbar (lokal i. d. R. problemlos; in
// abgeschotteten CI-/Sandbox-Umgebungen blockiert die Allowlist den Abruf).

import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { XMLParser } from 'fast-xml-parser';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const DATASET_URL = 'https://data.stadt-zuerich.ch/dataset/geo_stadtkreise';
const OUT = path.join(root, 'public/data/stadtkreise.geojson');

function datasetIdFromUrl(u) {
  const m = /\/dataset\/([^/?#]+)/.exec(u || '');
  return m ? m[1] : null;
}

async function fetchFirstFeatureCollection(urls) {
  for (const u of urls) {
    try {
      const res = await fetch(u, { headers: { Accept: 'application/json' } });
      if (!res.ok) continue;
      const text = await res.text();
      if (text.trimStart().startsWith('<')) continue;
      const parsed = JSON.parse(text);
      if (parsed && Array.isArray(parsed.features)) return { fc: parsed, url: u };
    } catch {
      // nächste URL
    }
  }
  return null;
}

async function resolveWfs(datasetUrl) {
  const id = datasetIdFromUrl(datasetUrl);
  if (!id) throw new Error('keine datasetUrl');
  const api = `https://data.stadt-zuerich.ch/api/3/action/package_show?id=${encodeURIComponent(id)}`;
  const pkg = await (await fetch(api, { headers: { Accept: 'application/json' } })).json();
  const resources = pkg?.result?.resources ?? [];
  const wfsRes = resources.find((r) => /wfs/i.test(r.format || '') || /\/wfs\//i.test(r.url || ''));
  if (!wfsRes?.url) throw new Error('keine WFS-Ressource im CKAN-Datensatz');
  const wfsBase = wfsRes.url.split('?')[0];

  const capsXml = await (await fetch(`${wfsBase}?service=WFS&version=1.1.0&request=GetCapabilities`)).text();
  const caps = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true }).parse(capsXml);
  let fts = caps?.WFS_Capabilities?.FeatureTypeList?.FeatureType ?? [];
  if (!Array.isArray(fts)) fts = [fts];
  const names = fts.map((f) => String(f?.Name ?? '')).filter(Boolean);
  // Geometrie-Layer der Kreise: bevorzugt _view, sonst ein 'kreis'-Name ohne
  // _att (Sachdaten), sonst der erste Nicht-_att-Typ.
  const typeName =
    names.find((n) => /_view$/i.test(n)) ??
    names.find((n) => /kreis/i.test(n) && !/_att$/i.test(n)) ??
    names.find((n) => !/_att$/i.test(n)) ??
    names[0];
  if (!typeName) throw new Error('keine FeatureType im WFS-GetCapabilities');

  const fromCaps = [...capsXml.matchAll(/<(?:\w+:)?Value>([^<]*json[^<]*)<\/(?:\w+:)?Value>/gi)].map(
    (m) => m[1].trim(),
  );
  const formats = [
    ...new Set([...fromCaps, 'application/vnd.geo+json', 'application/json', 'GeoJSON', 'geojson']),
  ];
  return { wfsBase, typeName, formats };
}

const toInt = (v) => {
  const n = parseInt(String(v ?? ''), 10);
  return Number.isFinite(n) ? n : null;
};

// Property-Mapping tolerant gegenüber ODZ-Schreibweisen.
function pickKnr(p = {}) {
  for (const k of ['knr', 'kreis', 'kreisnummer', 'nummer', 'name', 'kname']) {
    const n = toInt(p[k]);
    if (n != null && n >= 1 && n <= 20) return n;
  }
  return null;
}
function pickKname(p = {}, knr) {
  for (const k of ['kname', 'bezeichnung', 'name', 'kreis']) {
    const v = p[k];
    if (typeof v === 'string' && v.trim() && !/^\d+$/.test(v.trim())) return v.trim();
  }
  return knr != null ? `Kreis ${knr}` : null;
}

function firstCoord(coords) {
  let c = coords;
  while (Array.isArray(c) && Array.isArray(c[0])) c = c[0];
  return Array.isArray(c) ? c : null;
}

const { wfsBase, typeName, formats } = await resolveWfs(DATASET_URL);
const urls = formats.map(
  (of) =>
    `${wfsBase}?service=WFS&version=1.1.0&request=GetFeature&typename=${encodeURIComponent(typeName)}&outputFormat=${encodeURIComponent(of)}`,
);
const hit = await fetchFirstFeatureCollection(urls);
if (!hit) {
  console.error('✗ Stadtkreise: kein GeoJSON erhalten (typeName/outputFormat prüfen).');
  process.exit(1);
}
console.log(`↳ Stadtkreise: Quelle ${hit.url}`);

let lvWarned = false;
const features = [];
for (const f of hit.fc.features) {
  if (!f.geometry) continue;
  const c0 = firstCoord(f.geometry.coordinates);
  if (!lvWarned && c0 && (Math.abs(c0[0]) > 180 || Math.abs(c0[1]) > 90)) {
    console.warn('  ⚠ Koordinaten sehen nach LV95 aus — Reprojektion auf WGS84 nötig.');
    lvWarned = true;
  }
  const knr = pickKnr(f.properties);
  features.push({ type: 'Feature', properties: { kname: pickKname(f.properties, knr), knr }, geometry: f.geometry });
}
features.sort((a, b) => (a.properties.knr ?? 0) - (b.properties.knr ?? 0));

if (features.length === 0) {
  console.error('✗ Stadtkreise: keine Polygon-Features gefunden — vermutlich falscher typeName.');
  process.exit(1);
}

const out = {
  type: 'FeatureCollection',
  _meta: {
    quelle: 'Open Data Zürich – Stadtkreise',
    datasetUrl: DATASET_URL,
    lizenz: 'CC-BY',
    stand: new Date().toISOString().slice(0, 10),
  },
  features,
};
await mkdir(path.dirname(OUT), { recursive: true });
await writeFile(OUT, JSON.stringify(out, null, 2) + '\n');
console.log(`✓ ${features.length} Stadtkreise → public/data/stadtkreise.geojson`);
if (features.some((f) => f.properties.knr == null)) {
  console.warn('  ⚠ Einige Kreise ohne erkannte knr — Property-Namen der Quelle prüfen.');
}
