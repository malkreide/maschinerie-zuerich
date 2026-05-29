'use client';

import dynamic from 'next/dynamic';

const TerritoryMap = dynamic(
  () => import('@/components/TerritoryMap'),
  { ssr: false } // Leaflet won't run on the server
);

export default function TerritoryPage() {
  return (
    <main>
      <TerritoryMap />
    </main>
  );
}
