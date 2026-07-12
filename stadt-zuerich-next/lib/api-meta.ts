// Gemeinsame Header/Metadaten für die offenen /api/v1/*-Endpunkte.
//
// Strategie (Open by Default, Standards, Sicherheit): Version, Lizenz,
// Attribution und Schema-Verweis gehören in jede Antwort — non-breaking über
// HTTP-Header statt Änderung des JSON-Bodys. Plus Caching (Cache-Control +
// ETag) und bewusst dokumentiertes, offenes CORS.

import { createHash } from 'node:crypto';
import { city } from '@/config/city.config';

export const API_VERSION = '1';
export const DATA_LICENSE = 'CC-BY-4.0';
// Attribution aus der City-Config; Fallback generisch aus dem Stadtnamen —
// vorher hart auf «Maschinerie der Stadt Zürich» codiert.
export const ATTRIBUTION = city.attribution ?? `Maschinerie ${city.name.de}`;

// Schema-Deep-Links: Forks mit eigenem repoRawUrl verlinken ihre Kopie;
// ohne Eintrag gilt das kanonische Upstream-Schema (stabile $id).
const REPO_RAW =
  city.repoRawUrl
  ?? 'https://raw.githubusercontent.com/malkreide/maschinerie-zuerich/main/stadt-zuerich-next';
export const MACHINERY_SCHEMA_URL = `${REPO_RAW}/schemas/opengov-machinery-schema.json`;
export const PROCESS_SCHEMA_URL = `${REPO_RAW}/schemas/opengov-process-schema.json`;

// CORS bewusst offen: Es sind reine Lesedaten ohne Schutzbedarf (Open Data).
// Dokumentiert statt unkommentiert — siehe openapi.json / data-catalog.json.
export const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, If-None-Match',
};

export function etagFor(body: string): string {
  return 'W/"' + createHash('sha1').update(body).digest('hex').slice(0, 16) + '"';
}

export function apiHeaders(opts: { etag: string; schemaUrl?: string }): Record<string, string> {
  const link = ['</openapi.json>; rel="service-desc"; type="application/json"'];
  if (opts.schemaUrl) {
    link.push(`<${opts.schemaUrl}>; rel="describedby"; type="application/schema+json"`);
  }
  return {
    ...CORS_HEADERS,
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'public, max-age=300, stale-while-revalidate=600',
    ETag: opts.etag,
    'X-Api-Version': API_VERSION,
    'X-Data-License': DATA_LICENSE,
    'X-Data-Attribution': ATTRIBUTION,
    Link: link.join(', '),
  };
}

/**
 * Standard-GET für die v1-Endpunkte: serialisiert den Payload einmal,
 * berechnet das ETag und beantwortet bedingte Requests (If-None-Match) mit
 * 304. Body-String wird für ETag und Response identisch verwendet.
 */
export function jsonApiResponse(request: Request, payload: unknown, schemaUrl?: string): Response {
  const body = JSON.stringify(payload);
  const etag = etagFor(body);
  const headers = apiHeaders({ etag, schemaUrl });
  if (request.headers.get('if-none-match') === etag) {
    return new Response(null, { status: 304, headers });
  }
  return new Response(body, { status: 200, headers });
}

export function apiError(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json; charset=utf-8' },
  });
}
