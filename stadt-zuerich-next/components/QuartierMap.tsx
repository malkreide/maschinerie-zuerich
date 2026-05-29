'use client';

import { useMemo, useState, useRef, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import * as d3Geo from 'd3-geo';
const { geoMercator, geoPath } = d3Geo;

type Feature = {
  type: string;
  properties: { kname: string; knr: number };
  geometry: { type: string; coordinates: number[][][] };
};

type GeoJson = {
  type: string;
  features: Feature[];
};

export default function QuartierMap({
  geoJson,
  mockData
}: {
  geoJson: GeoJson;
  mockData: Record<string, Record<string, number>>;
}) {
  const t = useTranslations('Quartier');
  const [selectedDept, setSelectedDept] = useState<string>('Tiefbauamt');
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  const depts = Object.keys(mockData);
  const currentData = mockData[selectedDept] || {};

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height
        });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const pathGenerator = useMemo(() => {
    // We fit the projection to the container dimensions and geoJson
    const projection = geoMercator().fitSize([dimensions.width, dimensions.height], geoJson as unknown as d3Geo.ExtendedFeatureCollection);
    return geoPath().projection(projection);
  }, [dimensions, geoJson]);

  // Color scale
  function getColor(share: number) {
    if (!share) return '#e2e8f0'; // bg-slate-200
    // Simple color scale based on share (0 to 0.2 mostly)
    // We use a blues scale for now. Or accent color.
    const intensity = Math.min(1, share / 0.15); // cap at 15%
    const r = Math.round(255 - (255 - 14) * intensity);
    const g = Math.round(255 - (255 - 165) * intensity);
    const b = Math.round(255 - (255 - 233) * intensity);
    return `rgb(${r},${g},${b})`; // Towards Zurich Blue #0ea5e9
  }

  const [hovered, setHovered] = useState<Feature | null>(null);

  return (
    <div className="flex-1 flex flex-col h-full relative">
      <div className="p-3 border-b border-[var(--color-line)] bg-white/50 flex items-center justify-between z-10">
        <div className="flex items-center gap-2">
          <label htmlFor="dept-select" className="text-sm font-semibold text-[var(--color-ink)]">
            {t('selectLabel')}
          </label>
          <select
            id="dept-select"
            className="text-sm border border-[var(--color-line)] rounded px-2 py-1 bg-white"
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
          >
            {depts.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex-1 relative" ref={containerRef}>
        <svg width={dimensions.width} height={dimensions.height} className="block absolute inset-0">
          {geoJson.features.map((feature, i) => {
            const knr = feature.properties.knr;
            const share = currentData[knr.toString()] || 0;
            return (
              <path
                key={i}
                // @ts-expect-error d3-geo types are complex
                d={pathGenerator(feature) || ''}
                fill={getColor(share)}
                stroke="#fff"
                strokeWidth={1.5}
                className="transition-colors duration-300 hover:opacity-80 cursor-pointer"
                onMouseEnter={() => setHovered(feature)}
                onMouseLeave={() => setHovered(null)}
              />
            );
          })}
        </svg>

        {hovered && (
          <div className="absolute top-4 right-4 bg-white p-3 rounded-lg shadow-lg border border-[var(--color-line)] pointer-events-none">
            <h4 className="font-bold text-sm m-0 mb-1">{hovered.properties.kname}</h4>
            <div className="text-xs text-[var(--color-mute)]">
              {t('budgetShare', { share: ((currentData[hovered.properties.knr.toString()] || 0) * 100).toFixed(1) })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
