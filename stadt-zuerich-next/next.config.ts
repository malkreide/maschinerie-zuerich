import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

const config: NextConfig = {
  reactStrictMode: true,
  experimental: {
    optimizePackageImports: ['d3-hierarchy', 'd3-scale'],
    // Node.js-Runtime für Middleware opt-in (war in 15.x experimental, in 16
    // stabil — Flag schadet nicht falls schon default, hilft aber falls nicht).
    nodeMiddleware: true,
  },
};

export default withNextIntl(config);
