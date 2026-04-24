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
import { listProzesse } from '@/lib/prozesse';

const BASE_URL = (process.env.NEXT_PUBLIC_SITE_URL
                  ?? 'https://maschinerie-zuerich.vercel.app').replace(/\/$/, '');

const ROUTES = ['', '/steuerfranken', '/liste', '/anliegen', '/prozesse'] as const;

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

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const prozesse = await listProzesse();
  const prozessPaths = prozesse.map((p) => `/prozesse/${p.city}/${p.id}`);

  const allPaths: string[] = [...ROUTES, ...prozessPaths];

  return routing.locales.flatMap((locale) =>
    allPaths.map((path) => ({
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
