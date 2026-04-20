'use client';

// Client-Wrapper mit next/dynamic: TreemapView nutzt window-Metriken
// (ResizeObserver) und muss ohnehin client-side rendern. Durch ssr:false
// wird kein SSR-Placeholder erzeugt — reduziert HTML-Grösse leicht und
// verschiebt d3-hierarchy/d3-scale in einen separaten Chunk.
//
// Next.js verbietet dynamic + ssr:false in Server-Components, deshalb
// dieser schlanke Wrapper. Die Seite /steuerfranken bleibt Server-Component
// und reicht nur die Daten durch.

import dynamic from 'next/dynamic';
import type { StadtData } from '@/types/stadt';

const TreemapView = dynamic(() => import('./TreemapView'), {
  ssr: false,
  loading: () => (
    <main
      aria-busy="true"
      className="absolute top-14 inset-x-0 bottom-0 flex items-center justify-center"
    >
      <div className="text-sm text-[var(--color-mute)]">…</div>
    </main>
  ),
});

export default function TreemapLoader({ data }: { data: StadtData }) {
  return <TreemapView data={data} />;
}
