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

async function fetchLayer(layer) {
  const src = layer.source ?? {};
  if (!src.geojsonUrl) {
    console.warn(`- ${layer.id}: keine geojsonUrl konfiguriert → übersprungen (siehe ${src.datasetUrl ?? 'config'})`);
    return false;
  }
  if (src.verifiziert === false) {
    console.warn(`  ⚠ ${layer.id}: source.verifiziert=false — URL/typename ggf. gegen ${src.datasetUrl} prüfen.`);
  }
  let raw;
  try {
    const res = await fetch(src.geojsonUrl, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    raw = await res.json();
  } catch (err) {
    console.error(`✗ ${layer.id}: Abruf fehlgeschlagen — ${err.message}. (Allowlist/Netzwerk?)`);
    return false;
  }

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
