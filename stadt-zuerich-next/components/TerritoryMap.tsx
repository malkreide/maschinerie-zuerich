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
import { useSearchParams } from 'next/navigation';
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

type LayerId =
  | 'schools'
  | 'recycling'
  | 'playgrounds'
  | 'amtshaeuser'
  | 'health'
  | 'police'
  | 'recyclinghof';
const LAYER_IDS: LayerId[] = [
  'schools',
  'recycling',
  'playgrounds',
  'amtshaeuser',
  'health',
  'police',
  'recyclinghof',
];

/** i18n-Key je Layer für die Checkbox-Beschriftung. */
const LAYER_LABEL_KEY: Record<LayerId, string> = {
  schools: 'layerSchools',
  recycling: 'layerRecycling',
  playgrounds: 'layerPlaygrounds',
  amtshaeuser: 'layerAmtshaeuser',
  health: 'layerHealth',
  police: 'layerPolice',
  recyclinghof: 'layerRecyclinghof',
};

/** Pro Layer gecachte Daten (verhindert erneutes Laden beim Ein-/Ausblenden). */
type LayerData = {
  features: GeoFeature[];
  zustaendigkeit: Zustaendigkeit;
  demo: boolean;
  attribution?: string;
  stand?: string;
};

/** Farbe + Emoji je Layer — für Marker, Cluster-Bubble und Legenden-Swatch.
 *  Farben sind so gewählt, dass weisse Cluster-Zahlen darauf WCAG-AA-konform
 *  lesbar sind (Kontrast >= 4.5:1 gegen Weiss). */
const LAYER_STYLE: Record<LayerId, { color: string; emoji: string }> = {
  schools: { color: '#1d4ed8', emoji: '🏫' }, // Blau
  recycling: { color: '#15803d', emoji: '♻️' }, // Grün
  playgrounds: { color: '#b45309', emoji: '🛝' }, // Amber
  amtshaeuser: { color: '#6d28d9', emoji: '🏛️' }, // Violett
  health: { color: '#be123c', emoji: '🏥' }, // Rosé/Rot
  police: { color: '#0f766e', emoji: '🚓' }, // Teal
  recyclinghof: { color: '#4d7c0f', emoji: '🗑️' }, // Olivgrün
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
 * abgestimmt. Pro sichtbarem Layer wird eine eigene Cluster-Gruppe in der
 * Layer-Farbe gerendert, sodass mehrere Layer gleichzeitig unterscheidbar sind.
 * Popups sind (escapter) HTML-String mit locale-präfixierten Anchor-Deep-Links.
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

  // Mehrfachauswahl: mehrere Layer gleichzeitig sichtbar (durch Farbcodierung
  // unterscheidbar). Start-Layer aus dem ?layer=-Query (Deep-Link aus dem
  // DetailPanel einer Einheit), sonst die Schulanlagen.
  const searchParams = useSearchParams();
  const [activeLayers, setActiveLayers] = useState<Set<LayerId>>(() => {
    const requested = searchParams.get('layer');
    const initial: LayerId = LAYER_IDS.includes(requested as LayerId)
      ? (requested as LayerId)
      : 'schools';
    return new Set<LayerId>([initial]);
  });
  const [layerData, setLayerData] = useState<Partial<Record<LayerId, LayerData>>>({});
  // Handy: Panel startet zugeklappt (Titel, Datenqualität, Knopf), sonst
  // deckt es den grössten Teil der Karte ab. Ab sm immer offen (sm:block).
  const [panelOffen, setPanelOffen] = useState(false);

  // Aktive Layer laden (gecacht — bereits geladene werden nicht erneut geholt).
  useEffect(() => {
    let cancelled = false;
    for (const layer of activeLayers) {
      if (layerData[layer]) continue;
      fetch(`/api/geo?layer=${layer}`)
        .then((res) => res.json())
        .then((data) => {
          if (cancelled || !data?._meta) return;
          const stand = data._meta.sources?.find?.((s: { stand?: string }) => s.stand)?.stand;
          setLayerData((prev) => ({
            ...prev,
            [layer]: {
              features: (data.features as GeoFeature[]) ?? [],
              zustaendigkeit: (data._meta.zustaendigkeit as Zustaendigkeit) ?? {},
              demo: Boolean(data._meta.demo),
              attribution: data._meta.attribution,
              stand,
            },
          }));
        })
        .catch(() => {
          /* Netzwerkfehler ignorieren — Layer bleibt einfach leer. */
        });
    }
    return () => {
      cancelled = true;
    };
  }, [activeLayers, layerData]);

  const toggleLayer = (layer: LayerId) => {
    setActiveLayers((prev) => {
      const next = new Set(prev);
      if (next.has(layer)) next.delete(layer);
      else next.add(layer);
      return next;
    });
  };

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

  // Datenqualitäts-Badge über alle SICHTBAREN Layer aggregieren.
  const shownData = LAYER_IDS.filter((l) => activeLayers.has(l))
    .map((l) => layerData[l])
    .filter((d): d is LayerData => Boolean(d));
  const anyDemo = shownData.some((d) => d.demo);
  const publishedSample = shownData.find((d) => !d.demo);

  return (
    // isolate: Leaflet stapelt seine Ebenen mit z-index 200–1000, die
    // Kartenebene (.leaflet-map-pane, z-index 400 plus transform) bildet einen
    // eigenen Stapelkontext. Ohne Isolation konkurrierte sie auf Seitenebene
    // und übermalte das globale Suchfeld (Search.tsx) und das Panel unten. Mit
    // isolate bleibt die Karte darunter, wie in app/globals.css beschrieben.
    <div className="relative isolate w-full h-[calc(100vh-3.5rem)] mt-14">
      {/* Control Panel overlay. z-[1000] wie die Leaflet-Controls, damit es
          über den Kartenebenen liegt. Auf dem Handy reicht das Suchfeld über
          die ganze Breite (bis 110px): Panel darunter, wie die Werkzeugleiste
          in GraphView (top-[124px] sm:top-[64px]). bg-[var(--color-panel)]
          statt bg-white dark:…: dark: folgt in Tailwind v4 dem System-Theme,
          nicht dem Theme-Schalter der App (html.dark). */}
      <section
        aria-labelledby="territory-titel"
        className={`absolute top-[68px] sm:top-4 right-4 z-[1000] bg-[var(--color-panel)] p-3 sm:p-4 rounded-xl shadow-xl border border-[var(--color-line)] ${panelOffen ? 'w-72' : 'w-auto max-w-[calc(100vw-2rem)]'} sm:w-72`}
      >
        <div className="flex items-center justify-between gap-3 mb-2">
          <h2 id="territory-titel" className="text-sm font-semibold">{t('title')}</h2>
          <button
            type="button"
            className="sm:hidden text-xs px-2 py-1 rounded border border-[var(--color-line)] text-[var(--color-ink)]"
            aria-expanded={panelOffen}
            aria-controls="territory-intro territory-ebenen"
            onClick={() => setPanelOffen((o) => !o)}
          >
            {t('toggleLayers', { count: activeLayers.size })} <span aria-hidden="true">{panelOffen ? '▴' : '▾'}</span>
          </button>
        </div>
        <p id="territory-intro" className={`${panelOffen ? 'block' : 'hidden'} sm:block text-xs text-[var(--color-mute)] mb-2`}>{t('intro')}</p>
        {/* Datenqualität bleibt auch zugeklappt sichtbar: Ob die Marker
            Demodaten zeigen, darf nicht hinter einem Klick liegen. */}
        <div className={panelOffen ? 'mb-4' : 'sm:mb-4'}>
          {shownData.length === 0 ? (
            <DataQualityBadge status="demo" hinweis={t('noLayer')} kompakt={!panelOffen} />
          ) : anyDemo ? (
            <DataQualityBadge
              kompakt={!panelOffen}
              status="demo"
              hinweis="Mindestens ein sichtbarer Layer zeigt zufällig generierte Standorte – keine echten Verwaltungsdaten. Mit `npm run data:fetch-geo` durch ODZ-Geodaten ersetzen."
            />
          ) : (
            <DataQualityBadge
              kompakt={!panelOffen}
              status="publiziert"
              quelle={publishedSample?.attribution ?? 'Open Data Zürich'}
              stand={publishedSample?.stand}
              hinweis="Echte Standortdaten aus Open Data Zürich."
            />
          )}
        </div>

        <fieldset id="territory-ebenen" className={`${panelOffen ? 'block' : 'hidden'} sm:block space-y-2`}>
          <legend className="sr-only">{t('title')}</legend>
          {LAYER_IDS.map((id) => (
            <label key={id} className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={activeLayers.has(id)}
                onChange={() => toggleLayer(id)}
                className="accent-[var(--color-accent)]"
              />
              <span
                aria-hidden="true"
                className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[11px] shrink-0"
                style={{ backgroundColor: LAYER_STYLE[id].color }}
              >
                {LAYER_STYLE[id].emoji}
              </span>
              {t(LAYER_LABEL_KEY[id] as Parameters<typeof t>[0])}
            </label>
          ))}
        </fieldset>
      </section>

      <MapContainer
        center={[47.3769, 8.5417]}
        zoom={12}
        style={{ width: '100%', height: '100%' }}
        zoomControl={false}
      >
        {/* OpenStreetMap-Standardkacheln: ohne Schlüssel (CARTO liefert ohne
            Schlüssel nur noch ein Wasserzeichen, Stand 2026-11). Nutzung nach
            der OSM Tile Usage Policy: Attribution sichtbar, Referer kommt
            über die Referrer-Policy (nur die Domain), moderate Last. Bei
            viel Verkehr auf einen eigenen Anbieter wechseln. */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />
        {LAYER_IDS.filter((l) => activeLayers.has(l)).map((l) => {
          const d = layerData[l];
          if (!d) return null;
          return (
            <ClusteredMarkers
              key={l}
              features={d.features}
              zustaendigkeit={d.zustaendigkeit}
              labels={labels}
              style={LAYER_STYLE[l]}
            />
          );
        })}
      </MapContainer>
    </div>
  );
}
