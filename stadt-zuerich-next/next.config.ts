import type { NextConfig } from 'next';

// Kein createNextIntlPlugin-Wrapper: das Plugin injiziert Runtime-Code,
// der auf Vercels Edge-Runtime zu `__dirname is not defined` führte.
// Statt via Plugin holen wir Messages in Server-Components über einen
// eigenen Helper (lib/i18n-server.ts) und reichen sie an den
// NextIntlClientProvider explizit als Props durch.

const config: NextConfig = {
  reactStrictMode: true,
  experimental: { optimizePackageImports: ['d3-hierarchy', 'd3-scale'] },
};

export default config;
