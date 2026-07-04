'use client';

// Client-Wrapper mit next/dynamic für die Cytoscape-Hauptansicht — gleiches
// Muster wie TreemapLoader. Cytoscape + fcose sind die mit Abstand schwersten
// Client-Abhängigkeiten der App; ohne diesen Wrapper landeten sie im
// Initial-Bundle der Startseite — auch auf Mobile, wo der Graph per
// `hidden sm:block` gar nie sichtbar wird und stattdessen der
// MobileExplorer rendert.
//
// Next.js verbietet dynamic + ssr:false in Server-Components, deshalb
// dieser schlanke Wrapper. Die Startseite bleibt Server-Component und
// reicht nur die Daten durch.

import dynamic from 'next/dynamic';
import type { StadtData } from '@/types/stadt';
import type { Locale } from '@/i18n/routing';

const GraphView = dynamic(() => import('./GraphView'), {
  ssr: false,
  loading: () => (
    <div
      aria-busy="true"
      className="absolute inset-0 flex items-center justify-center"
    >
      <div className="text-sm text-[var(--color-mute)]">…</div>
    </div>
  ),
});

export default function GraphLoader({
  data,
  locale,
}: {
  data: StadtData;
  locale: Locale;
}) {
  return <GraphView data={data} locale={locale} />;
}
