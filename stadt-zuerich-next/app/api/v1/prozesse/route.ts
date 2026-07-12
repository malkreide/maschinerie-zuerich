import { listProzesse } from '@/lib/prozesse';
import {
  jsonApiResponse,
  apiError,
  CORS_HEADERS,
  PROCESS_SCHEMA_URL,
} from '@/lib/api-meta';

// Offene API: Index der Verwaltungsprozesse (OpenGov-Process-Schema).
// Header tragen Version, Lizenz, Schema-Verweis, Cache-Control + ETag (304 bei
// If-None-Match); Body bleibt unverändert. Doku: /openapi.json, /data-catalog.json
export async function GET(request: Request) {
  try {
    const data = await listProzesse();
    return jsonApiResponse(request, data, PROCESS_SCHEMA_URL);
  } catch (error) {
    console.error('Fehler beim Laden der Prozesse:', error);
    return apiError(500, 'Internal Server Error');
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
