import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

const config: NextConfig = {
  reactStrictMode: true,
  // transpilePackages zwingt Next, die Deps durch seinen eigenen Transformer zu
  // jagen — löst ESM/CJS-Interop-Probleme auf Vercels Edge-Runtime für Pakete,
  // die original als Node-ESM kompiliert wurden.
  transpilePackages: ['next-intl'],
  experimental: { optimizePackageImports: ['d3-hierarchy', 'd3-scale'] },
};

export default withNextIntl(config);
