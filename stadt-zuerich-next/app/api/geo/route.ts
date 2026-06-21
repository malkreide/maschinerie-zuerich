import { NextResponse } from 'next/server';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import geoConfig from '@/config/geo-layers.json';
import { buildDepartmentProzesseMap } from '@/lib/territory';

// Liefert die Geo-Layer der Territory-Ansicht als GeoJSON.
//
// Bevorzugt echte ODZ-Snapshots aus data/geo/<city>/<id>.geojson (erzeugt via
// `npm run data:fetch-geo`). Fehlt ein Snapshot, fällt der Layer auf zufällige
// Demo-Punkte zurück. `_meta.demo` ist nur dann true, wenn mindestens ein
// ausgelieferter Layer Demodaten enthält — das Frontend zeigt entsprechend
// das "Demodaten"- oder "Publiziert"-Badge.

type Layer = {
  id: string;
  department: string;
  namePrefix: string;
  demoCount: number;
  label: string;
  source?: { title?: string; datasetUrl?: string };
};

const CFG = geoConfig as unknown as {
  city: string;
  license: string;
  attribution: string;
  layers: Layer[];
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

type Feature = {
  type: 'Feature';
  geometry: { type: 'Point'; coordinates: [number, number] };
  properties: { id: string; name: string; department: string };
};

function randomZrhCoord(): [number, number] {
  const lat = 47.35 + Math.random() * 0.06;
  const lng = 8.48 + Math.random() * 0.1;
  return [lng, lat];
}

function demoFeatures(layer: Layer): Feature[] {
  return Array.from({ length: layer.demoCount }).map((_, i) => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: randomZrhCoord() },
    properties: { id: `${layer.id}-${i}`, name: `${layer.namePrefix} ${i + 1}`, department: layer.department },
  }));
}

async function loadSnapshot(
  layerId: string,
): Promise<{ features: Feature[]; meta: Record<string, unknown> } | null> {
  const file = path.join(process.cwd(), 'data/geo', CFG.city, `${layerId}.geojson`);
  try {
    const raw = await fs.readFile(file, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.features)) return null;
    return { features: parsed.features as Feature[], meta: parsed._meta ?? {} };
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const requested = searchParams.get('layer');
  const layers = requested ? CFG.layers.filter((l) => l.id === requested) : CFG.layers;

  let features: Feature[] = [];
  let anyDemo = false;
  const sources: Array<Record<string, unknown>> = [];

  for (const layer of layers) {
    const snap = await loadSnapshot(layer.id);
    if (snap) {
      features = features.concat(snap.features);
      sources.push({ layer: layer.id, ...snap.meta });
    } else {
      features = features.concat(demoFeatures(layer));
      anyDemo = true;
      sources.push({
        layer: layer.id,
        demo: true,
        datasetUrl: layer.source?.datasetUrl ?? null,
        hinweis: 'Kein ODZ-Snapshot vorhanden — Demodaten. Mit `npm run data:fetch-geo` aktualisieren.',
      });
    }
  }

  // Zuständigkeits-Brücke: pro vorkommendem Departement die modellierten
  // Verfahren (actors[].einheit_ref → Departement). Nur die tatsächlich
  // ausgelieferten Departemente einbetten, damit die Antwort schlank bleibt.
  const departmentsPresent = new Set(features.map((f) => f.properties.department));
  const fullMap = await buildDepartmentProzesseMap();
  const zustaendigkeit: Record<string, Array<{ city: string; id: string; slug: string; titel: unknown }>> = {};
  for (const dept of departmentsPresent) {
    const procs = fullMap[dept];
    if (procs?.length) {
      zustaendigkeit[dept] = procs.map((p) => ({
        city: p.city,
        id: p.id,
        slug: p.slug,
        titel: p.titel,
      }));
    }
  }

  return NextResponse.json(
    {
      type: 'FeatureCollection',
      _meta: {
        demo: anyDemo,
        license: CFG.license,
        attribution: CFG.attribution,
        hinweis: anyDemo
          ? 'Mindestens ein Layer zeigt zufällige Demodaten, keine echten Verwaltungsstandorte. Vor Produktiveinsatz ODZ-Snapshot erzeugen.'
          : 'Echte Standortdaten aus Open Data Zürich.',
        sources,
        // Departements-Code → zuständige Verfahren (für das Popup-Detail).
        zustaendigkeit,
      },
      features,
    },
    { status: 200, headers: corsHeaders },
  );
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
