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
};

export default withNextIntl(config);
