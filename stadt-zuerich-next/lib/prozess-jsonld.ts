// Mapping: OpenGov-Process-Schema → schema.org GovernmentService (JSON-LD).
//
// Warum separates Mapping statt Schema.org direkt als Source-of-Truth:
// schema.org beschreibt einen Behördendienst als Entität (Name, Beschreibung,
// Zuständigkeit, Anbieter), NICHT den Schritt-für-Schritt-Flow, der für die
// Visualisierung der „Maschinerie" nötig ist. Unser Schema geht tiefer
// (Akteure, Entscheidungsknoten, Dauern). Das JSON-LD hier ist eine
// Projektion, keine Ersetzung — für Google/Bing als Discovery-Signal,
// damit eine Prozessseite als GovernmentService erkannt wird.

import type { Prozess, ProzessLocale } from '@/types/prozess';
import { resolveI18n } from '@/types/prozess';
import type { Locale } from '@/i18n/routing';
import { city as cityConfig } from '@/config/city.config';

/** BCP-47-Tags konsistent mit sitemap.ts/hreflang. Leichte Sprache hat
 *  keinen offiziellen Code, `de-x-ls` (Private-Use-Subtag) ist im Projekt
 *  die gewählte Konvention. */
const LOCALE_TO_BCP47: Record<ProzessLocale, string> = {
  de: 'de-CH',
  en: 'en',
  fr: 'fr-CH',
  it: 'it-CH',
  ls: 'de-x-ls',
};

/** Baut einen multilingualen String-Array im schema.org-Stil:
 *  [{ "@value": "...", "@language": "de-CH" }, ...]. Wenn nur die
 *  Default-Locale (= 'de' bei uns) existiert, geben wir einen
 *  einfachen String zurück — kompakter und JSON-LD-konform. */
function mlString(
  s: Parameters<typeof resolveI18n>[0],
): string | Array<{ '@value': string; '@language': string }> | undefined {
  if (s === undefined) return undefined;
  if (typeof s === 'string') return s;
  const entries = (['de', 'en', 'fr', 'it', 'ls'] as const)
    .filter((k) => s[k])
    .map((k) => ({ '@value': s[k] as string, '@language': LOCALE_TO_BCP47[k] }));
  if (entries.length === 1) return entries[0]['@value'];
  return entries;
}

/** Hauptfunktion: Prozess → GovernmentService-LD.
 *  `canonicalUrl` ist die absolute URL der Detailseite (wird für
 *  `mainEntityOfPage` gebraucht). Wir übergeben sie explizit, weil die
 *  App sonst nichts von ihrer öffentlichen Host-URL weiss. */
export function prozessToJsonLd(prozess: Prozess, opts: {
  locale: Locale;
  canonicalUrl: string;
}): Record<string, unknown> {
  const { locale, canonicalUrl } = opts;
  const loc = locale as ProzessLocale;

  // Provider = alle Akteure mit typ 'behoerde' oder 'fachstelle'.
  // schema.org kennt GovernmentOrganization als Unter-Typ von Organization.
  const providers = prozess.akteure
    .filter((a) => a.typ === 'behoerde' || a.typ === 'fachstelle')
    .map((a) => ({
      '@type': 'GovernmentOrganization',
      name: resolveI18n(a.label, loc),
    }));

  // Rechtsgrundlage mit URL → termsOfService. schema.org erlaubt hier
  // genau ein URL-Feld, also nehmen wir die erste mit URL.
  const termsOfService = prozess.rechtsgrundlagen?.find((r) => r.url)?.url;

  // Kosten: schema.org GovernmentService kennt `feesAndCommissionsSpecification`
  // als Text. Wir aggregieren Kosten aus allen Schritten.
  const kostenTotal = prozess.schritte
    .map((s) => s.kosten_chf)
    .filter((k): k is NonNullable<typeof k> => k !== undefined);
  let feesText: string | undefined;
  if (kostenTotal.length > 0) {
    const min = kostenTotal.reduce((acc, k) => acc + (k.min ?? 0), 0);
    const max = kostenTotal.reduce((acc, k) => acc + (k.max ?? k.min ?? 0), 0);
    feesText = min === max ? `CHF ${min}` : `CHF ${min}–${max}`;
  }

  // Zielgruppe: wer ist der Antragsteller? Nehmen wir das Label des
  // ersten Akteurs mit typ 'antragsteller'.
  const antragsteller = prozess.akteure.find((a) => a.typ === 'antragsteller');

  // areaServed = die Stadt. AdministrativeArea mit Name aus city.config
  // (locale-korrekt, kein Hardcode).
  const cityName = cityConfig.name[loc] ?? cityConfig.name.de;

  const ld: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'GovernmentService',
    '@id': canonicalUrl,
    name: mlString(prozess.titel),
    description: mlString(prozess.kurzbeschreibung),
    serviceType: 'CivicService',
    areaServed: {
      '@type': 'AdministrativeArea',
      name: cityName,
    },
    jurisdiction: {
      '@type': 'AdministrativeArea',
      name: cityName,
    },
    mainEntityOfPage: canonicalUrl,
    inLanguage: (['de', 'en', 'fr', 'it'] as const)
      .filter((k) => (typeof prozess.titel === 'object' ? prozess.titel[k] : k === 'de'))
      .map((k) => LOCALE_TO_BCP47[k]),
  };

  if (providers.length === 1) ld.provider = providers[0];
  else if (providers.length > 1) ld.provider = providers;

  if (termsOfService) ld.termsOfService = termsOfService;
  if (feesText) ld.feesAndCommissionsSpecification = feesText;
  if (antragsteller) {
    ld.audience = {
      '@type': 'Audience',
      audienceType: resolveI18n(antragsteller.label, loc),
    };
  }

  // Lizenz aus meta (CC-BY-4.0 default). schema.org: `license` als URL.
  const lizenz = prozess.meta?.lizenz;
  if (lizenz === 'CC-BY-4.0') {
    ld.license = 'https://creativecommons.org/licenses/by/4.0/';
  } else if (lizenz?.startsWith('http')) {
    ld.license = lizenz;
  }

  // dateModified: schema.org nimmt ISO-8601.
  if (prozess.meta?.aktualisiert) ld.dateModified = prozess.meta.aktualisiert;
  if (prozess.meta?.erstellt)     ld.dateCreated  = prozess.meta.erstellt;

  return ld;
}
