import { getTranslations } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import QuartierMap, { type KreisMetric } from '@/components/QuartierMap';
import DataQualityBadge from '@/components/DataQualityBadge';
import { loadStadtData } from '@/lib/data';
import { routing } from '@/i18n/routing';
import { featureAreaKm2, countPointsPerKreis, isPlaceholderGeometry, type KreisFeature } from '@/lib/quartier-geo';
import type { DataQualityStatus } from '@/components/DataQualityBadge';
import geoConfig from '@/config/geo-layers.json';
import { city } from '@/config/city.config';
import fs from 'fs';
import path from 'path';

type GeoLayer = { id: string; label: string };
const GEO = geoConfig as unknown as { city: string; layers: GeoLayer[] };

export default async function QuartierPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  const t = await getTranslations({ locale, namespace: 'Quartier' });

  await loadStadtData();

  // Amtliche Stadtkreis-Geometrie — Pfad aus der City-Config
  // (geo.stadtkreiseGeoJsonPath), vorher hart auf Zürich codiert.
  // Ohne konfigurierten Pfad rendert die Seite ohne Grenzen-Overlay.
  let geoJson: { type: string; features: KreisFeature[] } | null = null;
  const geoRelPath = city.geo?.stadtkreiseGeoJsonPath;
  if (geoRelPath) {
    try {
      const geoPath = path.join(process.cwd(), geoRelPath);
      geoJson = JSON.parse(fs.readFileSync(geoPath, 'utf8'));
    } catch (e) {
      console.error('Konnte Stadtkreis-GeoJSON nicht laden', e);
    }
  }

  const kreise = geoJson?.features ?? [];

  // Sind die Grenzen die Platzhalter-Rechtecke oder echte Stadtkreise?
  // Solange Platzhalter, sind Fläche UND Standort-Zählung nicht aussagekräftig.
  const placeholder = isPlaceholderGeometry(kreise);

  // Kennzahl 1: Fläche je Kreis — aus der Geometrie (real, sobald echte Grenzen).
  const areaValues: Record<string, number> = {};
  for (const k of kreise) areaValues[k.properties.knr] = Number(featureAreaKm2(k).toFixed(2));

  const metrics: KreisMetric[] = [
    { id: 'flaeche', label: t('metricArea'), unit: 'km²', decimals: 2, real: !placeholder, values: areaValues },
  ];

  // Kennzahl 2..n: Anzahl Standorte je Kreis aus den ODZ-Geo-Snapshots
  // (real, sobald sowohl echte Grenzen als auch ein Snapshot vorliegen).
  let anyLayerReal = false;
  for (const layer of GEO.layers) {
    let points: { geometry?: { coordinates?: [number, number] } }[] = [];
    let hasSnapshot = false;
    try {
      const file = path.join(process.cwd(), 'data/geo', GEO.city, `${layer.id}.geojson`);
      const snap = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (Array.isArray(snap.features)) {
        points = snap.features;
        hasSnapshot = true;
      }
    } catch {
      // kein Snapshot → Kennzahl bleibt leer/0
    }
    const real = hasSnapshot && !placeholder;
    if (real) anyLayerReal = true;
    const counts = countPointsPerKreis(points, kreise);
    const values: Record<string, number> = {};
    for (const k of kreise) values[k.properties.knr] = counts[k.properties.knr] ?? 0;
    metrics.push({ id: layer.id, label: layer.label, unit: t('unitLocations'), decimals: 0, real, values });
  }

  const badgeStatus: DataQualityStatus = placeholder ? 'demo' : anyLayerReal ? 'aggregiert' : 'publiziert';
  const badgeHinweis = placeholder
    ? 'Platzhalter-Stadtkreise (Raster). Für echte Werte die Datei public/data/stadtkreise.geojson durch die amtlichen Grenzen ersetzen: data.stadt-zuerich.ch/dataset/stadtkreise.'
    : anyLayerReal
      ? 'Fläche aus amtlicher Stadtkreis-Geometrie; Standorte aus Open Data Zürich (Point-in-Polygon).'
      : 'Fläche aus amtlicher Stadtkreis-Geometrie. Standortzahlen erscheinen, sobald die ODZ-Geodaten geladen sind (npm run data:fetch-geo).';

  return (
    <main className="absolute top-14 inset-x-0 bottom-0 p-4 pb-10 overflow-hidden flex flex-col bg-[var(--color-bg)]">
      <div className="max-w-4xl mx-auto w-full flex-1 flex flex-col">
        <h2 className="text-xl font-bold mb-2 text-[var(--color-ink)]">{t('title')}</h2>
        <p className="text-[13px] text-[var(--color-mute)] mb-2 max-w-2xl">
          {t('intro')}
        </p>
        <div className="mb-4">
          <DataQualityBadge
            status={badgeStatus}
            quelle="Stadtkreise (Open Data Zürich) + ODZ-Standorte"
            hinweis={badgeHinweis}
          />
        </div>

        <div className="flex-1 bg-[var(--color-panel)] rounded-xl border border-[var(--color-line)] shadow-sm overflow-hidden flex flex-col relative">
          {geoJson ? (
            <QuartierMap geoJson={geoJson} metrics={metrics} />
          ) : (
            <div className="flex items-center justify-center h-full text-[var(--color-mute)]">
              {t('noGeo')}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
