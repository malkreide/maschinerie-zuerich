import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

// Plugin-Wrapper registriert i18n/request.ts im Build, damit die
// next-intl-Server-Runtime die Config beim SSR auflösen kann. Ohne
// Plugin warf der Server auf Vercel `Couldn't find next-intl config file`,
// weil Turbopack die Datei mangels statischem Import nicht bundelt.
// Edge-Runtime wird im Projekt nicht genutzt (keine `runtime = 'edge'`
// Exports) — der frühere `__dirname is not defined`-Fall ist damit
// nicht mehr relevant.
const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

// Content-Security-Policy — Defense-in-Depth gegen datengetriebenes XSS
// (Prozess-JSONs aus tessera-PRs sind Teil des Bedrohungsmodells, CLAUDE.md).
// Selbst wenn ein Injection-Vektor am JSON-LD-Escaping und an safeUrl()
// vorbeikäme, blockiert die CSP das Nachladen fremder Skripte/Requests.
//
// 'unsafe-inline' für script-src ist ein bewusster Kompromiss: die Seiten
// sind statisch vorgerendert (generateStaticParams), Nonces brauchen aber
// dynamisches Rendering pro Request. Inline bleibt damit erlaubt (Next-
// Hydration, JSON-LD, Theme-<style>), externes Nachladen nicht.
// 'unsafe-eval' nur im Dev-Modus (React Fast Refresh braucht eval).
//
// Externe Hosts:
//   img-src  *.basemaps.cartocdn.com — Leaflet-Kacheln (TerritoryMap)
//   connect-src tecdottir.herokuapp.com — Wassertemperatur (LiveClimateWidget)
const isDev = process.env.NODE_ENV === 'development';
function csp(frameAncestors: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://*.basemaps.cartocdn.com",
    "font-src 'self' data:",
    "connect-src 'self' https://tecdottir.herokuapp.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    `frame-ancestors ${frameAncestors}`,
  ].join('; ');
}

// Matcht jeden Pfad, dessen erstes oder zweites Segment NICHT exakt „embed"
// ist (Embed-Routen: /embed/* bzw. /<locale>/embed/*). Der frühere Ausdruck
// `(?!.*embed)` schloss jeden Pfad aus, der „embed" irgendwo enthielt.
const NON_EMBED_SOURCE = '/((?!(?:[^/]+/)?embed(?:/|$)).*)';

const config: NextConfig = {
  reactStrictMode: true,
  experimental: { optimizePackageImports: ['d3-hierarchy', 'd3-scale'] },
  // Für Docker: minimaler Runtime-Bundle unter `.next/standalone/`, der
  // nur die tatsächlich benötigten node_modules enthält. Der Runtime-Stage
  // im Dockerfile kopiert NUR diesen Ordner + `.next/static/` — der
  // Production-Image-Size bleibt damit unter 200 MB, ohne dass wir die
  // volle `node_modules/` (~500 MB) einbacken müssen.
  // Für Vercel/Netlify/etc. ist die Option harmlos (ignoriert).
  output: 'standalone',
  async headers() {
    return [
      {
        // Basis-Sicherheits-Header für alle Routen
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
        ],
      },
      {
        // Nicht-Embed-Routen: dürfen nirgends eingebettet werden
        // (X-Frame-Options für alte Browser, frame-ancestors als Standard).
        source: NON_EMBED_SOURCE,
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'Content-Security-Policy',
            value: csp("'none'"),
          },
        ],
      },
      {
        // Embed-Routen sind explizit zum Einbetten durch Dritte gedacht
        // (EmbedButton generiert iframe-Snippets) → frame-ancestors *.
        // Bewusste Entscheidung, kein Versehen: das Embed zeigt nur
        // öffentliche Visualisierungen, keine Formulare/Sessions.
        source: '/:locale/embed/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: csp('*'),
          },
        ],
      },
      {
        source: '/embed/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: csp('*'),
          },
        ],
      },
    ];
  },
};

export default withNextIntl(config);
