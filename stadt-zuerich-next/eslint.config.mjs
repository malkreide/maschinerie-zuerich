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
      '*.tsbuildinfo',
      'next-env.d.ts',
    ],
  },
  ...nextCoreWebVitals,
  ...nextTypescript,
];

export default config;
