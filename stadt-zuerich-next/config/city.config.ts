// Zentrale Stadt-/Tenant-Konfiguration. Alles, was beim Fork für eine
// andere Stadt (Bern, Basel, …) angepasst werden muss, lebt in der
// begleitenden city.config.json.
//
// Trennung .json ↔ .ts hat einen Grund: das JSON wird sowohl vom TypeScript-
// Code (Komponenten, Server-Routen) als auch vom Node-.mjs-Code (CI-Skripte
// wie validate-prozesse.mjs) gelesen. Pures JSON ist die einzige Form, die
// beide Welten ohne Build-Umweg teilen können. Dieser TS-Wrapper gibt dem
// JSON Typen und kleine Hilfs-Funktionen (URL-Builder etc.), die wir nicht
// in JSON ausdrücken können.

import cfg from './city.config.json';
import type { Locale } from '@/i18n/routing';

export interface CityConfig {
  /** Maschinenlesbare ID, Kleinbuchstaben + Ziffern + '-'. Wird als
   *  URL-Segment (/prozesse/<id>/…) und Dateipfad-Segment genutzt.
   *  Ändern = Breaking URL-Change. */
  id: string;
  /** Vollständiger Anzeigename pro Locale (z. B. 'Stadt Zürich',
   *  'City of Zurich'). Wird via ICU-Template {cityName} in die
   *  i18n-Strings eingespeist. */
  name: Record<Locale, string>;
  /** Kürzere Form ohne "Stadt/City/…"-Präfix, für Fliesstext wie
   *  "in {shortName}". */
  shortName: Record<Locale, string>;
  /** Offizielle Domain der Stadt (ohne Protokoll/Pfad). */
  domain: string;
  /** Template für eine externe Suche auf der Stadt-Website. `{q}` wird
   *  mit URL-kodiertem Suchbegriff ersetzt (siehe externalSearchUrl()). */
  externalSearchUrlTemplate: string;
  /** Fallback-Link, wenn kein sinnvoller Suchbegriff verfügbar ist. */
  homepageUrl: string;
  /** Pfad zur Org-Chart-JSON relativ zum Projekt-Root. Wird von
   *  loadStadtData() gelesen. Aktuell 'data.json'; ein Folge-Commit
   *  zieht das Mapping auf 'data/<id>/org-chart.json' um. */
  orgChartPath: string;
}

export const city: CityConfig = cfg as CityConfig;

/** Baut die URL für "auf Stadt-Website suchen" aus dem Template.
 *  Kapselt die URL-Kodierung, damit Aufrufer das Rohstring übergeben. */
export function externalSearchUrl(query: string): string {
  return city.externalSearchUrlTemplate.replace('{q}', encodeURIComponent(query));
}
