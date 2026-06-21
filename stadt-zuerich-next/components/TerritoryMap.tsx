'use client';

import { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css';
import 'leaflet-defaulticon-compatibility';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import { useTranslations, useLocale } from 'next-intl';
import DataQualityBadge from '@/components/DataQualityBadge';
import { routing } from '@/i18n/routing';

type GeoFeature = {
  type: string;
  geometry: { type: string; coordinates: [number, number] };
  properties: { id: string; name: string; department: string };
};

type I18nString = { de: string } & Partial<Record<string, string>>;
type VerfahrenRef = { city: string; id: string; slug: string; titel: I18nString };
type Zustaendigkeit = Record<string, VerfahrenRef[]>;

type LayerId = 'schools' | 'recycling' | 'playgrounds' | 'amtshaeuser';

/** Farbe + Emoji je Layer — für Marker, Cluster-Bubble und Legenden-Swatch.
 *  Farben sind so gewählt, dass weisse Cluster-Zahlen darauf WCAG-AA-konform
 *  lesbar sind (Kontrast >= 4.5:1 gegen Weiss). */
const LAYER_STYLE: Record<LayerId, { color: string; emoji: string }> = {
  schools: { color: '#1d4ed8', emoji: '🏫' }, // Blau
  recycling: { color: '#15803d', emoji: '♻️' }, // Grün
  playgrounds: { color: '#b45309', emoji: '🛝' }, // Amber
  amtshaeuser: { color: '#6d28d9', emoji: '🏛️' }, // Violett
};

/** HTML-escapen — Popup-Inhalt wird als String gebaut (markercluster bindPopup). */
function esc(s: string): string {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string,
  );
}

/** Popup-Texte, die der Clustering-Layer (ausserhalb des React-Baums) braucht. */
type PopupLabels = {
  popupTitle: string;
  linkToChart: string;
  verfahren: string;
  locale: string;
};

/**
 * Clustering-Layer auf Basis des stabilen Vanilla-Plugins leaflet.markercluster.
 * Bewusst nicht über JSX-<Marker> gelöst: bei >1000 Schul-Punkten wäre das
 * unbrauchbar langsam, und react-leaflet-cluster ist nicht auf react-leaflet v5
 * abgestimmt. Popups werden als (escapter) HTML-String gebaut; Links sind
 * locale-präfixierte Anchors (Deep-Link auf Verfahren bzw. Organigramm).
 */
function ClusteredMarkers({
  features,
  zustaendigkeit,
  labels,
  style,
}: {
  features: GeoFeature[];
  zustaendigkeit: Zustaendigkeit;
  labels: PopupLabels;
  style: { color: string; emoji: string };
}) {
  const map = useMap();

  useEffect(() => {
    // Farbiges Marker-Icon (Pin) je Layer.
    const icon = L.divIcon({
      className: 'tm-marker',
      html: `<span class="tm-pin" style="--tm-color:${style.color}"><span class="tm-pin-emoji" aria-hidden="true">${style.emoji}</span></span>`,
      iconSize: [28, 36],
      iconAnchor: [14, 36],
      popupAnchor: [0, -34],
    });

    const cluster = L.markerClusterGroup({
      chunkedLoading: true,
      maxClusterRadius: 60,
      showCoverageOnHover: false,
      // Cluster-Bubble in der Layer-Farbe statt Leaflet-Default.
      iconCreateFunction: (c) =>
        L.divIcon({
          className: 'tm-cluster-wrap',
          html: `<div class="tm-cluster" style="--tm-color:${style.color}">${c.getChildCount()}</div>`,
          iconSize: [38, 38],
        }),
    });

    for (const feature of features) {
      const [lng, lat] = feature.geometry.coordinates;
      if (typeof lat !== 'number' || typeof lng !== 'number') continue;
      const dept = feature.properties.department;
      const verfahren = zustaendigkeit[dept] ?? [];

      const verfahrenHtml = verfahren.length
        ? `<div class="tm-pop-section">${esc(labels.verfahren)}</div>
           <ul class="tm-pop-list">${verfahren
             .map((v) => {
               const titel = v.titel[labels.locale] ?? v.titel.de;
               const href = `/${labels.locale}/prozesse/${encodeURIComponent(v.city)}/${encodeURIComponent(v.id)}`;
               return `<li><a href="${href}">${esc(titel)}</a></li>`;
             })
             .join('')}</ul>`
        : '';

      const chartHref = `/${labels.locale}/?focus=${encodeURIComponent(dept)}`;
      const html = `<div class="tm-pop">
          <strong class="tm-pop-name">${esc(feature.properties.name)}</strong>
          <span class="tm-pop-dept">${esc(labels.popupTitle)}: ${esc(dept)}</span>
          ${verfahrenHtml}
          <a class="tm-pop-link" href="${chartHref}">${esc(labels.linkToChart)}</a>
        </div>`;

      L.marker([lat, lng], { icon }).bindPopup(html).addTo(cluster);
    }

    map.addLayer(cluster);
    return () => {
      map.removeLayer(cluster);
    };
  }, [map, features, zustaendigkeit, labels, style]);

  return null;
}

export default function TerritoryMap() {
  const t = useTranslations('Territory');
  const rawLocale = useLocale();
  // Defensive: nur bekannte Locales als URL-Prefix zulassen.
  const locale = (routing.locales as readonly string[]).includes(rawLocale) ? rawLocale : routing.defaultLocale;

  const [activeLayer, setActiveLayer] = useState<LayerId>('schools');
  const [features, setFeatures] = useState<GeoFeature[]>([]);
  const [zustaendigkeit, setZustaendigkeit] = useState<Zustaendigkeit>({});
  // Provenance der aktuell geladenen Layer (steuert das Datenqualitäts-Badge).
  const [meta, setMeta] = useState<{ demo: boolean; attribution?: string; stand?: string }>({ demo: true });

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/geo?layer=${activeLayer}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data && data.features) setFeatures(data.features);
        if (data && data._meta) {
          const stand = data._meta.sources?.find?.((s: { stand?: string }) => s.stand)?.stand;
          setMeta({ demo: Boolean(data._meta.demo), attribution: data._meta.attribution, stand });
          setZustaendigkeit((data._meta.zustaendigkeit as Zustaendigkeit) ?? {});
        }
      });
    return () => {
      cancelled = true;
    };
  }, [activeLayer]);

  // Stabil halten, damit der Clustering-Effekt nicht bei jedem Render neu baut.
  const labels: PopupLabels = useMemo(
    () => ({
      popupTitle: t('popupTitle'),
      linkToChart: t('linkToChart'),
      verfahren: t('verfahren'),
      locale,
    }),
    [t, locale],
  );

  const layerOptions: Array<{ id: LayerId; label: string }> = [
    { id: 'schools', label: t('layerSchools') },
    { id: 'recycling', label: t('layerRecycling') },
    { id: 'playgrounds', label: t('layerPlaygrounds') },
    { id: 'amtshaeuser', label: t('layerAmtshaeuser') },
  ];

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
          {layerOptions.map((opt) => (
            <label key={opt.id} className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="radio"
                name="layer"
                checked={activeLayer === opt.id}
                onChange={() => setActiveLayer(opt.id)}
                className="accent-[var(--color-accent)]"
              />
              <span
                aria-hidden="true"
                className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[11px] shrink-0"
                style={{ backgroundColor: LAYER_STYLE[opt.id].color }}
              >
                {LAYER_STYLE[opt.id].emoji}
              </span>
              {opt.label}
            </label>
          ))}
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
        <ClusteredMarkers
          features={features}
          zustaendigkeit={zustaendigkeit}
          labels={labels}
          style={LAYER_STYLE[activeLayer]}
        />
      </MapContainer>
    </div>
  );
}
