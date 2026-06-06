// Flat-ESLint-Config (ESLint 9+). Ersatz für das in Next.js 16 entfernte
// 'next lint'-Kommando. eslint-config-next 16 exportiert native
// Flat-Config-Arrays, deshalb keine FlatCompat-Brücke mehr nötig.
//
// Aktive Presets:
//  - core-web-vitals: Next-spezifische Rules inkl. img-, font-, head-
//    Best-Practices, React-Hooks, jsx-a11y
//  - typescript: TypeScript-spezifische Rules via typescript-eslint

import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

const config = [
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'data/raw/**',
      'scripts/**',       // ETL-Skripte sind Node-CLI, nicht Teil der App
      'fetch_colors.js',  // Einmaliger Node-CLI-Helfer (Farben scrapen), nicht Teil der App
      'tests/**',         // Playwright-E2E/a11y — eigene Toolchain, nicht Teil der App
      'playwright.config.ts',
      'playwright-report/**',
      'test-results/**',
      '*.tsbuildinfo',
      'next-env.d.ts',
    ],
  },
  ...nextCoreWebVitals,
  ...nextTypescript,
];

export default config;
