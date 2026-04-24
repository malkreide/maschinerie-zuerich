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
  /** Pfad zur Org-Chart-JSON relativ zum Projekt-Root. Konvention:
   *  'data/<id>/org-chart.json'. loadStadtData() und das
   *  validate-prozesse-Skript lesen beide hier. */
  orgChartPath: string;
  /** Pfad zur Lebenslagen-/Anliegen-JSON (Bürger-Anliegen → Unit-Mapping).
   *  Konvention: 'data/<id>/lebenslagen.json'. */
  lebenslagenPath: string;
  /** Datenquellen der Stadt. Die ETL-Skripte unter scripts/adapters/<id>.mjs
   *  lesen diesen Block, um an ihre APIs anzudocken. Welche Keys erwartet
   *  werden, hängt vom Adapter ab — ZH braucht 'rpk', andere Städte
   *  ergänzen eigene Einträge. */
  dataSources: {
    rpk?: {
      baseUrl: string;
      /** Name der Environment-Variable, aus der der API-Key gelesen wird.
       *  Keys NIE in die Config selbst schreiben — die Datei wird committed.
       *  Lokal: `.env.local` (gitignored). CI: Secret der Plattform. */
      apiKeyEnv: string;
    };
    [key: string]: unknown;
  };
  /** Farb-Theme der Stadt. Wird vom Root-Layout als CSS-Variablen injiziert
   *  (siehe themeCssVars()) und zusätzlich direkt von Komponenten gelesen,
   *  die einen JS-Array oder Cytoscape-Stylesheet brauchen. */
  theme: CityTheme;
}

/** City-spezifisches Farb-Theme. Alle Werte sind CSS-Farb-Strings (Hex,
 *  rgb(), etc.). Die Dark-Mode-Overrides für Hintergrund/Panel/Ink/Mute/Line
 *  leben weiterhin in globals.css — das hier ist Stadt-Branding, nicht
 *  Theme-Modus. */
export interface CityTheme {
  /** Primärfarbe der UI (Header, aktive Tabs, Link-Akzente). */
  accent: string;
  /** Farb-Mapping pro Knotentyp im Graphen. Keys matchen die 'type'-Werte
   *  aus types/stadt.ts + zwei Sonderrollen aus Legend.tsx. */
  nodeType: {
    stadtpraesidium: string;
    stadtrat: string;
    department: string;
    unit: string;
    staff: string;
    extern: string;
    beteiligung: string;
  };
  /** Warn-Farbe für Konflikte (Bürger- vs. RPK-Zuordnung). */
  konflikt: string;
  /** Palette für die Treemap — Departemente werden per d3.scaleOrdinal
   *  zyklisch gemappt. */
  departmentPalette: string[];
}

export const city: CityConfig = cfg as CityConfig;

/** Baut die URL für "auf Stadt-Website suchen" aus dem Template.
 *  Kapselt die URL-Kodierung, damit Aufrufer das Rohstring übergeben. */
export function externalSearchUrl(query: string): string {
  return city.externalSearchUrlTemplate.replace('{q}', encodeURIComponent(query));
}

/** Baut den `<style>`-Inhalt mit den theme-CSS-Variablen, die das Layout
 *  als Inline-Stylesheet in den `<head>` setzt. Damit gelten die Stadt-
 *  Farben noch vor dem ersten Paint — kein Flash-of-Wrong-Brand. */
export function themeCssVars(): string {
  const t = city.theme;
  return [
    `:root {`,
    `  --color-accent: ${t.accent};`,
    `  --color-node-stadtpraesidium: ${t.nodeType.stadtpraesidium};`,
    `  --color-node-stadtrat: ${t.nodeType.stadtrat};`,
    `  --color-node-department: ${t.nodeType.department};`,
    `  --color-node-unit: ${t.nodeType.unit};`,
    `  --color-node-staff: ${t.nodeType.staff};`,
    `  --color-node-extern: ${t.nodeType.extern};`,
    `  --color-node-beteiligung: ${t.nodeType.beteiligung};`,
    `  --color-konflikt: ${t.konflikt};`,
    `}`,
  ].join('\n');
}
