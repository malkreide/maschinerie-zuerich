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

// Ermittelt die echte GeoJSON-Datei-URL. Reihenfolge:
//  1) expliziter Direkt-Link (source.geojsonUrl, wenn er auf .json zeigt)
//  2) Auflösung über die CKAN-API von data.stadt-zuerich.ch (package_show) —
//     bevorzugt eine echte .json-Datei (WGS84), keine WFS/WMS-Services.
async function resolveGeojsonUrl(src) {
  if (src.geojsonUrl && /\.json(\?|$)/i.test(src.geojsonUrl)) return src.geojsonUrl;
  const id = datasetIdFromUrl(src.datasetUrl);
  if (!id) return src.geojsonUrl ?? null;
  const api = `https://data.stadt-zuerich.ch/api/3/action/package_show?id=${encodeURIComponent(id)}`;
  const res = await fetch(api, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`CKAN HTTP ${res.status}`);
  const j = await res.json();
  const resources = j?.result?.resources ?? [];
  const isFile = (r) => /\.json(\?|$)/i.test(r.url || '') && !/\b(wfs|wms|wmts)\b/i.test(r.url || '');
  const pick =
    resources.find((r) => /geojson/i.test(r.format || '') && isFile(r)) ??
    resources.find((r) => isFile(r) && /geojson|json/i.test(r.format || '')) ??
    resources.find((r) => isFile(r));
  if (!pick) throw new Error('keine GeoJSON-Ressource im CKAN-Datensatz gefunden');
  return pick.url;
}

async function fetchLayer(layer) {
  const src = layer.source ?? {};
  if (!src.datasetUrl && !src.geojsonUrl) {
    console.warn(`- ${layer.id}: weder datasetUrl noch geojsonUrl konfiguriert → übersprungen`);
    return false;
  }
  let raw;
  let url;
  try {
    url = await resolveGeojsonUrl(src);
    if (!url) throw new Error('keine GeoJSON-URL ermittelbar');
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    if (text.trimStart().startsWith('<')) throw new Error('HTML statt JSON erhalten — falsche URL/Ressource');
    raw = JSON.parse(text);
  } catch (err) {
    console.error(`✗ ${layer.id}: Abruf fehlgeschlagen — ${err.message}`);
    return false;
  }
  console.log(`  ↳ ${layer.id}: Quelle ${url}`);

  const inFeatures = Array.isArray(raw.features) ? raw.features : [];
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
