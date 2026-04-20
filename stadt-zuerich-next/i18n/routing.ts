import { defineRouting } from 'next-intl/routing';

// Sprachen der Stadtverwaltung Zürich + Leichte Sprache (LS).
// 'de' ist Default und braucht KEIN Prefix (URLs bleiben /, /steuerfranken, …).
// Andere Sprachen: /en, /fr, /it, /ls (immer mit Prefix).
export const routing = defineRouting({
  locales: ['de', 'en', 'fr', 'it', 'ls'] as const,
  defaultLocale: 'de',
  localePrefix: 'as-needed',
});

export type Locale = (typeof routing.locales)[number];
