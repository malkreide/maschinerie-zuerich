import {
  jsonApiResponse,
  CORS_HEADERS,
  API_VERSION,
  DATA_LICENSE,
  ATTRIBUTION,
} from '@/lib/api-meta';

// Discovery-Index der offenen API. Verweist auf OpenAPI-Spec und Datenkatalog.
export async function GET(request: Request) {
  const index = {
    name: 'Maschinerie der Stadt Zürich – Open API',
    version: API_VERSION,
    license: DATA_LICENSE,
    attribution: ATTRIBUTION,
    documentation: {
      openapi: '/openapi.json',
      dataCatalog: '/data-catalog.json',
    },
    endpoints: [
      { path: '/api/v1/org', description: 'Organisationsstruktur (Departemente, Einheiten, Beteiligungen)' },
      { path: '/api/v1/prozesse', description: 'Index der Verwaltungsprozesse' },
    ],
  };
  return jsonApiResponse(request, index);
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
