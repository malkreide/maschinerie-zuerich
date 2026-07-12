'use client';

import { useMemo, useState, useRef, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import * as d3Geo from 'd3-geo';
import type { KreisFeature } from '@/lib/quartier-geo';
const { geoMercator, geoPath } = d3Geo;

type Feature = KreisFeature;

type GeoJson = {
  type?: string;
  features: Feature[];
};

/** Eine reale, je Stadtkreis berechnete Kennzahl. */
export interface KreisMetric {
  id: string;
  label: string;
  unit: string;
  decimals: number;
  real: boolean; // false = (noch) keine Quelldaten (z. B. Geo-Snapshot fehlt)
  values: Record<string, number>; // knr -> Wert
}

export default function QuartierMap({
  geoJson,
  metrics,
}: {
  geoJson: GeoJson;
  metrics: KreisMetric[];
}) {
  const t = useTranslations('Quartier');
  const [selectedId, setSelectedId] = useState<string>(metrics[0]?.id ?? '');
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  const metric = metrics.find((m) => m.id === selectedId) ?? metrics[0];
  const values = metric?.values ?? {};
  const max = Math.max(0, ...Object.values(values));

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const pathGenerator = useMemo(() => {
    const projection = geoMercator().fitSize(
      [dimensions.width, dimensions.height],
      geoJson as unknown as d3Geo.ExtendedFeatureCollection,
    );
    return geoPath().projection(projection);
  }, [dimensions, geoJson]);

  // Farbskala relativ zum Maximum der aktuellen Kennzahl (Richtung Zürich-Blau).
  function getColor(value: number) {
    if (!value || max <= 0) return '#e2e8f0';
    const intensity = Math.min(1, value / max);
    const r = Math.round(255 - (255 - 14) * intensity);
    const g = Math.round(255 - (255 - 165) * intensity);
    const b = Math.round(255 - (255 - 233) * intensity);
    return `rgb(${r},${g},${b})`;
  }

  const fmt = (v: number) => v.toLocaleString('de-CH', { maximumFractionDigits: metric?.decimals ?? 0 });

  const [hovered, setHovered] = useState<Feature | null>(null);

  return (
    <div className="flex-1 flex flex-col h-full relative">
      <div className="p-3 border-b border-[var(--color-line)] bg-white/50 flex items-center justify-between z-10">
        <div className="flex items-center gap-2">
          <label htmlFor="metric-select" className="text-sm font-semibold text-[var(--color-ink)]">
            {t('selectLabel')}
          </label>
          <select
            id="metric-select"
            className="text-sm border border-[var(--color-line)] rounded px-2 py-1 bg-white"
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
          >
            {metrics.map((m) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex-1 relative" ref={containerRef}>
        <svg width={dimensions.width} height={dimensions.height} className="block absolute inset-0">
          {geoJson.features.map((feature, i) => {
            const knr = feature.properties.knr;
            const value = values[knr.toString()] || 0;
            return (
              <path
                key={i}
                // @ts-expect-error d3-geo types are complex
                d={pathGenerator(feature) || ''}
                fill={getColor(value)}
                stroke="#fff"
                strokeWidth={1.5}
                className="transition-colors duration-300 hover:opacity-80 cursor-pointer"
                onMouseEnter={() => setHovered(feature)}
                onMouseLeave={() => setHovered(null)}
              />
            );
          })}
        </svg>

        {metric && !metric.real && (
          <div className="absolute bottom-3 left-3 right-3 bg-amber-50 text-amber-800 border border-amber-200 rounded px-3 py-2 text-xs pointer-events-none">
            {t('noData')}
          </div>
        )}

        {hovered && (
          <div className="absolute top-4 right-4 bg-white p-3 rounded-lg shadow-lg border border-[var(--color-line)] pointer-events-none">
            <h4 className="font-bold text-sm m-0 mb-1">{hovered.properties.kname}</h4>
            <div className="text-xs text-[var(--color-mute)]">
              {t('tooltipValue', {
                value: fmt(values[hovered.properties.knr.toString()] || 0),
                unit: metric?.unit ?? '',
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
