// Sitemap für alle Locale × Route-Kombinationen.
// Jeder Eintrag bekommt <xhtml:link rel="alternate" hreflang="..."> für
// die anderen Sprachvarianten → Google versteht Canonical pro Sprache.
//
// ENV: NEXT_PUBLIC_SITE_URL — Basis-URL des Deployments (z. B.
// 'https://maschinerie-zuerich.vercel.app'). Fällt auf Vercel-Default zurück,
// falls nicht gesetzt; für lokales dev-build ohne Domain ist das
// unerheblich, weil die Sitemap ohnehin erst in Produktion relevant ist.

import type { MetadataRoute } from 'next';
import { routing, type Locale } from '@/i18n/routing';

const BASE_URL = (process.env.NEXT_PUBLIC_SITE_URL
                  ?? 'https://maschinerie-zuerich.vercel.app').replace(/\/$/, '');

const ROUTES = ['', '/steuerfranken', '/liste', '/anliegen'] as const;

// BCP 47 Language Codes für hreflang. Leichte Sprache mit 'de-x-ls'
// (private use subtag) — technisch valide, von Suchmaschinen ignoriert,
// aber nicht fehlerhaft.
const HREFLANG: Record<Locale, string> = {
  de: 'de-CH',
  en: 'en',
  fr: 'fr-CH',
  it: 'it-CH',
  ls: 'de-x-ls',
};

function urlFor(locale: Locale, path: string): string {
  const prefix = locale === routing.defaultLocale ? '' : `/${locale}`;
  return `${BASE_URL}${prefix}${path}`;
}

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return routing.locales.flatMap((locale) =>
    ROUTES.map((path) => ({
      url: urlFor(locale, path),
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: path === '' ? 1 : 0.7,
      alternates: {
        languages: {
          ...Object.fromEntries(routing.locales.map((l) => [HREFLANG[l], urlFor(l, path)])),
          // x-default signalisiert Google: wenn kein Sprachmatch, diese URL nutzen.
          'x-default': urlFor(routing.defaultLocale, path),
        },
      },
    })),
  );
}
