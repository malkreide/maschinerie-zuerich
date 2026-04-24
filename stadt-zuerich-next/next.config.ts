import type { NextConfig } from 'next';

// Kein createNextIntlPlugin-Wrapper: das Plugin injiziert Runtime-Code,
// der auf Vercels Edge-Runtime zu `__dirname is not defined` führte.
// Statt via Plugin holen wir Messages in Server-Components über einen
// eigenen Helper (lib/i18n-server.ts) und reichen sie an den
// NextIntlClientProvider explizit als Props durch.

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

export default config;
