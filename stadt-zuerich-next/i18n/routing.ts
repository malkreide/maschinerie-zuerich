import { defineRouting } from 'next-intl/routing';

// Sprachen der Stadtverwaltung Zürich + Leichte Sprache (LS).
// 'de' ist Default und braucht KEIN Prefix (URLs bleiben /, /steuerfranken, …).
// Andere Sprachen: /en, /fr, /it, /ls (immer mit Prefix).
//
// localeDetection: beim ersten Besuch wird der Accept-Language-Header
// ausgewertet. Ein englischer Browser, der https://.../ aufruft, wird
// auf /en weitergeleitet. Sobald die User:in einmal manuell eine Sprache
// wählt (via LanguageSwitcher), setzt next-intl das Cookie NEXT_LOCALE;
// danach gilt die Wahl persistent und überschreibt die Accept-Language-
// Heuristik. Bookmarks mit explizitem Prefix (/en/liste) werden nie
// umgeleitet.
export const routing = defineRouting({
  locales: ['de', 'en', 'fr', 'it', 'ls'] as const,
  defaultLocale: 'de',
  // 'always' statt 'as-needed': seit der Middleware wegen Vercel-Bugs
  // gelöscht wurde, gibt es keine Instanz mehr, die Default-Locale '/' →
  // '/de' umschreibt. Mit 'always' hat jedes Locale ein Prefix und wir
  // brauchen keine serverseitige Umschreibung.
  localePrefix: 'always',
  localeDetection: false,
});

export type Locale = (typeof routing.locales)[number];
