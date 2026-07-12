import { loadStadtData } from '@/lib/data';
import {
  jsonApiResponse,
  apiError,
  CORS_HEADERS,
  MACHINERY_SCHEMA_URL,
} from '@/lib/api-meta';

// Offene API: Organisationsstruktur (OpenGov-Machinery-Schema).
// Header tragen Version, Lizenz, Schema-Verweis, Cache-Control + ETag (304 bei
// If-None-Match); Body bleibt unverändert. Doku: /openapi.json, /data-catalog.json
export async function GET(request: Request) {
  try {
    const data = await loadStadtData();
    return jsonApiResponse(request, data, MACHINERY_SCHEMA_URL);
  } catch (error) {
    console.error('Fehler beim Laden der Strukturdaten:', error);
    return apiError(500, 'Internal Server Error');
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
