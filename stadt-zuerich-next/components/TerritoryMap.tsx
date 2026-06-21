'use client';

import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css';
import 'leaflet-defaulticon-compatibility';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import DataQualityBadge from '@/components/DataQualityBadge';

type GeoFeature = {
  type: string;
  geometry: { type: string; coordinates: [number, number] };
  properties: { id: string; name: string; department: string };
};

export default function TerritoryMap() {
  const t = useTranslations('Territory');
  const router = useRouter();
  const [activeLayer, setActiveLayer] = useState<'schools' | 'recycling' | 'playgrounds' | 'amtshaeuser'>('schools');
  const [features, setFeatures] = useState<GeoFeature[]>([]);
  // Provenance der aktuell geladenen Layer (steuert das Datenqualitäts-Badge).
  const [meta, setMeta] = useState<{ demo: boolean; attribution?: string; stand?: string }>({ demo: true });

  useEffect(() => {
    fetch(`/api/geo?layer=${activeLayer}`)
      .then(res => res.json())
      .then(data => {
        if (data && data.features) setFeatures(data.features);
        if (data && data._meta) {
          const stand = data._meta.sources?.find?.((s: { stand?: string }) => s.stand)?.stand;
          setMeta({ demo: Boolean(data._meta.demo), attribution: data._meta.attribution, stand });
        }
      });
  }, [activeLayer]);

  const handleJumpToGraph = (departmentId: string) => {
    router.push(`/?focus=${departmentId}`);
  };

  return (
    <div className="relative w-full h-[calc(100vh-3.5rem)] mt-14">
      {/* Control Panel overlay */}
      <div className="absolute top-4 right-4 z-[400] bg-white dark:bg-[var(--color-panel)] p-4 rounded-xl shadow-xl border border-[var(--color-line)] w-72">
        <h2 className="text-sm font-semibold mb-2">{t('title')}</h2>
        <p className="text-xs text-[var(--color-mute)] mb-2">{t('intro')}</p>
        <div className="mb-4">
          {meta.demo ? (
            <DataQualityBadge
              status="demo"
              hinweis="Zufällig generierte Standorte – keine echten Verwaltungsdaten. Mit `npm run data:fetch-geo` durch ODZ-Geodaten ersetzen."
            />
          ) : (
            <DataQualityBadge
              status="publiziert"
              quelle={meta.attribution ?? 'Open Data Zürich'}
              stand={meta.stand}
              hinweis="Echte Standortdaten aus Open Data Zürich."
            />
          )}
        </div>

        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input 
              type="radio" 
              name="layer" 
              checked={activeLayer === 'schools'} 
              onChange={() => setActiveLayer('schools')}
              className="accent-[var(--color-accent)]"
            />
            🏫 {t('layerSchools')}
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input 
              type="radio" 
              name="layer" 
              checked={activeLayer === 'recycling'} 
              onChange={() => setActiveLayer('recycling')}
              className="accent-[var(--color-accent)]"
            />
            ♻️ {t('layerRecycling')}
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input 
              type="radio" 
              name="layer" 
              checked={activeLayer === 'playgrounds'} 
              onChange={() => setActiveLayer('playgrounds')}
              className="accent-[var(--color-accent)]"
            />
            🛝 {t('layerPlaygrounds')}
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="radio"
              name="layer"
              checked={activeLayer === 'amtshaeuser'}
              onChange={() => setActiveLayer('amtshaeuser')}
              className="accent-[var(--color-accent)]"
            />
            🏛️ {t('layerAmtshaeuser')}
          </label>
        </div>
      </div>

      <MapContainer 
        center={[47.3769, 8.5417]} 
        zoom={12} 
        style={{ width: '100%', height: '100%' }}
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        />
        {features.map((feature) => (
          <Marker 
            key={feature.properties.id} 
            position={[feature.geometry.coordinates[1], feature.geometry.coordinates[0]]}
          >
            <Popup>
              <div className="text-sm">
                <strong className="block mb-1">{feature.properties.name}</strong>
                <span className="text-xs text-gray-500 block mb-2">
                  {t('popupTitle')}: {feature.properties.department}
                </span>
                <button 
                  onClick={() => handleJumpToGraph(feature.properties.department)}
                  className="bg-blue-50 text-blue-600 px-2 py-1 rounded text-xs border border-blue-200 hover:bg-blue-100 transition"
                >
                  {t('linkToChart')}
                </button>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
