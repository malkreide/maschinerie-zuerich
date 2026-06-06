// Server-seitige Geo-Hilfen für die Quartier-Ansicht.
//
// Berechnet reale, reproduzierbare Kennzahlen pro Stadtkreis ausschliesslich
// aus vorhandenen Daten — keine erfundenen Werte:
//   - Fläche je Kreis aus der Stadtkreis-Geometrie (sphärische Fläche)
//   - Anzahl Standorte je Kreis via Point-in-Polygon aus den ODZ-Geo-Snapshots
//
// Bewusst ohne Geo-Dependency (kein turf): die Polygone sind klein und wenige.

type Ring = number[][]; // [[lng,lat], ...]
type PolygonCoords = Ring[]; // [outer, hole1, ...]

export interface KreisFeature {
  type?: string;
  properties: { kname: string; knr: number };
  geometry: { type: string; coordinates: unknown };
}

/**
 * Heuristik: Sind die Kreisgrenzen die Platzhalter-Geometrie (gleich grosse
 * Rechtecke im Raster) statt echte Stadtkreise? Echte Kreise variieren stark
 * in der Fläche; der Platzhalter ist nahezu uniform.
 */
export function isPlaceholderGeometry(kreise: KreisFeature[]): boolean {
  if (kreise.length < 2) return false;
  const areas = kreise.map(featureAreaKm2).filter((a) => a > 0);
  if (areas.length < 2) return false;
  const max = Math.max(...areas);
  const min = Math.min(...areas);
  return max / min < 1.15;
}

const EARTH_RADIUS_KM = 6371.0088;
const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Sphärische Fläche eines Rings (km²), Vorzeichen ignoriert. */
function ringAreaKm2(ring: Ring): number {
  const n = ring.length;
  if (n < 3) return 0;
  let total = 0;
  for (let i = 0; i < n; i++) {
    const [lon1, lat1] = ring[i];
    const [lon2, lat2] = ring[(i + 1) % n];
    total += toRad(lon2 - lon1) * (2 + Math.sin(toRad(lat1)) + Math.sin(toRad(lat2)));
  }
  return Math.abs((total * EARTH_RADIUS_KM * EARTH_RADIUS_KM) / 2);
}

/** Polygon = äusserer Ring minus Löcher. */
function polygonAreaKm2(poly: PolygonCoords): number {
  if (!poly.length) return 0;
  let area = ringAreaKm2(poly[0]);
  for (let i = 1; i < poly.length; i++) area -= ringAreaKm2(poly[i]);
  return Math.max(0, area);
}

export function featureAreaKm2(feature: KreisFeature): number {
  const g = feature.geometry;
  if (g.type === 'Polygon') return polygonAreaKm2(g.coordinates as PolygonCoords);
  if (g.type === 'MultiPolygon') {
    return (g.coordinates as PolygonCoords[]).reduce((sum, p) => sum + polygonAreaKm2(p), 0);
  }
  return 0;
}

/** Ray-Casting: Punkt in einem einzelnen Ring? */
function pointInRing(lng: number, lat: number, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersect = yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/** Punkt in Polygon (äusserer Ring, nicht in Loch). */
function pointInPolygon(lng: number, lat: number, poly: PolygonCoords): boolean {
  if (!poly.length || !pointInRing(lng, lat, poly[0])) return false;
  for (let i = 1; i < poly.length; i++) {
    if (pointInRing(lng, lat, poly[i])) return false; // im Loch
  }
  return true;
}

export function pointInFeature(lng: number, lat: number, feature: KreisFeature): boolean {
  const g = feature.geometry;
  if (g.type === 'Polygon') return pointInPolygon(lng, lat, g.coordinates as PolygonCoords);
  if (g.type === 'MultiPolygon') {
    return (g.coordinates as PolygonCoords[]).some((p) => pointInPolygon(lng, lat, p));
  }
  return false;
}

type GeoPoint = { geometry?: { coordinates?: [number, number] } };

/**
 * Zählt Punkte (GeoJSON-Features mit Point-Geometrie) pro Kreis.
 * Gibt eine Map knr → Anzahl zurück.
 */
export function countPointsPerKreis(points: GeoPoint[], kreise: KreisFeature[]): Record<number, number> {
  const counts: Record<number, number> = {};
  for (const k of kreise) counts[k.properties.knr] = 0;
  for (const p of points) {
    const c = p.geometry?.coordinates;
    if (!Array.isArray(c) || c.length < 2) continue;
    const [lng, lat] = c;
    const k = kreise.find((kr) => pointInFeature(lng, lat, kr));
    if (k) counts[k.properties.knr]++;
  }
  return counts;
}
