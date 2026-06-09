#!/usr/bin/env node
// ETL für die Geo-Layer der Territory-Ansicht.
//
// Lädt je Layer (config/geo-layers.json) das GeoJSON von Open Data Zürich,
// normalisiert die Features auf { id, name, department } + Punkt-Geometrie und
// schreibt einen committe-baren Snapshot nach data/geo/<city>/<id>.geojson mit
// Provenance (_meta: Quelle, Lizenz, Stand). /api/geo liefert dann echte Daten.
//
// Voraussetzung: Die Stadt-Zürich-Hosts müssen erreichbar sein (Netzwerk-
// Allowlist). In abgeschotteten CI-/Sandbox-Umgebungen schlägt der Abruf
// bewusst fehl — die Route fällt dann weiter auf Demo-Punkte zurück.
//
// CRS-Hinweis: ODZ-WFS liefert teils LV95 (EPSG:2056) statt WGS84. GeoJSON
// verlangt WGS84 [lng, lat]. Das Skript erkennt LV95-artige Werte und warnt;
// eine Reprojektion (proj4) muss bei Bedarf ergänzt werden.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { XMLParser } from 'fast-xml-parser';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

const cfg = JSON.parse(await readFile(path.join(root, 'config/geo-layers.json'), 'utf-8'));
const outDir = path.join(root, 'data/geo', cfg.city);
const today = new Date().toISOString().slice(0, 10);

/** Repräsentativen [lng, lat]-Punkt aus beliebiger GeoJSON-Geometrie ziehen. */
function representativePoint(geom) {
  if (!geom) return null;
  if (geom.type === 'Point') return geom.coordinates;
  // Polygone/Linien: erstes Koordinatenpaar tief ausgraben.
  let c = geom.coordinates;
  while (Array.isArray(c) && Array.isArray(c[0])) c = c[0];
  return Array.isArray(c) && c.length >= 2 ? c : null;
}

function looksLikeLV95([x, y]) {
  return Math.abs(x) > 180 || Math.abs(y) > 90; // WGS84 liegt in diesen Grenzen
}

function datasetIdFromUrl(u) {
  const m = /\/dataset\/([^/?#]+)/.exec(u || '');
  return m ? m[1] : null;
}

// Liefert die erste URL aus der Liste, die eine echte GeoJSON-FeatureCollection
// zurückgibt (probiert outputFormat-Varianten durch). HTML/XML-Fehlerseiten
// werden übersprungen.
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

// Ermittelt WFS-Basis, alle Geometrie-typeNames und outputFormat-Kandidaten.
// Hintergrund: Die ODZ-'geodaten/download'-Links sind eine SPA (liefern HTML);
// echtes GeoJSON kommt nur über den WFS. Manche Datensätze (z. B. Schulanlagen)
// haben MEHRERE Geometrie-Views (Kindergarten, Hort, Volksschule …) — die
// werden alle kombiniert. typeName/outputFormat stammen aus GetCapabilities.
async function resolveWfs(src) {
  const id = datasetIdFromUrl(src.datasetUrl);
  if (!id) throw new Error('keine datasetUrl konfiguriert');
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
  // Alle Geometrie-Views (enden auf _view) kombinieren; sonst den ersten Typ.
  const views = names.filter((n) => /_view$/i.test(n));
  const typeNames = views.length ? views : names.slice(0, 1);
  if (!typeNames.length) throw new Error('keine FeatureType im WFS-GetCapabilities');

  // Unterstützte JSON-Ausgabeformate direkt aus den Capabilities lesen — ODZ
  // nutzt 'application/vnd.geo+json'. Plus Fallback-Schreibweisen anderer Dienste.
  const fromCaps = [...capsXml.matchAll(/<(?:\w+:)?Value>([^<]*json[^<]*)<\/(?:\w+:)?Value>/gi)].map(
    (m) => m[1].trim(),
  );
  const formats = [
    ...new Set([...fromCaps, 'application/vnd.geo+json', 'application/json', 'GeoJSON', 'geojson']),
  ];
  return { wfsBase, typeNames, formats };
}

async function fetchLayer(layer) {
  const src = layer.source ?? {};
  if (!src.datasetUrl && !src.geojsonUrl) {
    console.warn(`- ${layer.id}: weder datasetUrl noch geojsonUrl konfiguriert → übersprungen`);
    return false;
  }
  let inFeatures = [];
  const usedSources = [];
  try {
    if (src.geojsonUrl) {
      const hit = await fetchFirstFeatureCollection([src.geojsonUrl]);
      if (!hit) throw new Error('geojsonUrl-Override lieferte keine FeatureCollection');
      inFeatures = hit.fc.features;
      usedSources.push(src.geojsonUrl);
    } else {
      const { wfsBase, typeNames, formats } = await resolveWfs(src);
      for (const tn of typeNames) {
        const urls = formats.map(
          (of) =>
            `${wfsBase}?service=WFS&version=1.1.0&request=GetFeature&typename=${encodeURIComponent(tn)}&outputFormat=${encodeURIComponent(of)}`,
        );
        const hit = await fetchFirstFeatureCollection(urls);
        if (hit) {
          inFeatures = inFeatures.concat(hit.fc.features);
          usedSources.push(tn);
        }
      }
      if (!inFeatures.length) throw new Error('kein typeName lieferte Features');
    }
  } catch (err) {
    console.error(`✗ ${layer.id}: Abruf fehlgeschlagen — ${err.message}`);
    return false;
  }
  console.log(`  ↳ ${layer.id}: ${usedSources.length} Quelle(n) — ${usedSources.join(', ')}`);

  let crsWarned = false;
  const features = [];
  for (let i = 0; i < inFeatures.length; i++) {
    const f = inFeatures[i];
    const pt = representativePoint(f.geometry);
    if (!pt) continue;
    if (!crsWarned && looksLikeLV95(pt)) {
      console.warn(`  ⚠ ${layer.id}: Koordinaten sehen nach LV95 aus — Reprojektion auf WGS84 nötig.`);
      crsWarned = true;
    }
    const name = f.properties?.[src.nameField] ?? f.properties?.name ?? `${layer.namePrefix} ${i + 1}`;
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [pt[0], pt[1]] },
      properties: { id: `${layer.id}-${i}`, name: String(name), department: layer.department },
    });
  }

  const out = {
    type: 'FeatureCollection',
    _meta: {
      demo: false,
      layer: layer.id,
      quelle: src.title ?? layer.label,
      datasetUrl: src.datasetUrl ?? null,
      lizenz: cfg.license,
      attribution: cfg.attribution,
      stand: today,
    },
    features,
  };
  await mkdir(outDir, { recursive: true });
  await writeFile(path.join(outDir, `${layer.id}.geojson`), JSON.stringify(out, null, 2) + '\n');
  console.log(`✓ ${layer.id}: ${features.length} Features → data/geo/${cfg.city}/${layer.id}.geojson`);
  return true;
}

let ok = 0;
for (const layer of cfg.layers) {
  if (await fetchLayer(layer)) ok++;
}
console.log(`\n${ok}/${cfg.layers.length} Layer aktualisiert.`);
if (ok === 0) {
  console.error('Kein Layer konnte geladen werden — /api/geo bleibt im Demo-Modus.');
  process.exit(1);
}
