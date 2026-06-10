// Typen zur OpenGov-Process-Schema, Generation 2 (siehe
// /schemas/opengov-process-schema.json; kanonische Fassung:
// docs/process-data-contract.md im Repo-Root).
// Halte diese Datei synchron mit dem JSON-Schema — die Source of Truth fürs Tooling
// ist das JSON-Schema, diese Typen sind ein bequemer TS-Mirror.
//
// Kardinalregel: bindende Werte (Fristen, Gebühren) leben NUR in Referenz
// (Label + Deep-Link + wörtliches Zitat) — es gibt bewusst keine Felder für
// Dauern oder Kosten als Zahl.

export type ProzessLocale = 'de' | 'en' | 'fr' | 'it' | 'ls';

/** Ein i18n-String: entweder ein einzelner String (Fallback-Sprache) oder
 *  ein Objekt mit mindestens 'de'. */
export type I18nString = string | ({ de: string } & Partial<Record<ProzessLocale, string>>);

export type SchrittTyp =
  | 'start'
  | 'input'
  | 'prozess'
  | 'entscheidung'
  | 'loop'
  | 'warten'
  | 'ende';

export type AkteurTyp =
  | 'antragsteller'
  | 'behoerde'
  | 'fachstelle'
  | 'gericht'
  | 'dritte';

export type Zielgruppe = 'bevoelkerung' | 'wirtschaft' | 'behoerden';

export interface Referenz {
  id: string;
  /** Ohne die Zahl als behaupteten Fakt — die steht nur im Zitat. */
  label: I18nString;
  /** Deep-Link auf die exakte Stelle der amtlichen Quelle. */
  url: string;
  /** Wörtliche Belegstelle. Pflicht (nicht-leer) bei status 'verifiziert'. */
  zitat?: string;
  status?: 'verifiziert' | 'unverifiziert';
  abgerufen: string;
}

export interface Unterlage {
  label: I18nString;
  url?: string;
  pflicht?: boolean;
}

export interface Akteur {
  id: string;
  label: I18nString;
  typ: AkteurTyp;
  /** Optionale Verknüpfung in die bestehende Organisations-Hierarchie (data.json). */
  einheit_ref?: string;
}

export interface Schritt {
  id: string;
  typ: SchrittTyp;
  /** ID aus Prozess.akteure — bestimmt die Swimlane. */
  akteur: string;
  label: I18nString;
  beschreibung?: I18nString;
  /** IDs aus Prozess.referenzen — bindende Werte dieses Schritts. */
  referenzen?: string[];
  unterlagen?: Unterlage[];
  quelle?: string;
}

export interface FlowKante {
  von: string;
  nach: string;
  /** Bei Entscheidungs-Schritten: 'ja' / 'nein' / etc. */
  bedingung?: string;
  label?: I18nString;
}

export interface Rechtsgrundlage {
  bezeichnung: string;
  url?: string;
}

export interface Quelle {
  id: string;
  titel: string;
  url: string;
  abgerufen: string;
}

export type OnlineReifegrad = 'offline' | 'teil-digital' | 'digital' | 'end-to-end';

export type Medienbruch =
  | 'drucken'
  | 'post'
  | 'persoenliches-erscheinen'
  | 'separate-zahlung'
  | 'erneute-dateneingabe'
  | 'unterschrift-handschriftlich';

export type ProzessStatus =
  | 'beobachtet'
  | 'validiert'
  | 'vorgeschlagen'
  | 'in-umsetzung'
  | 'umgesetzt';

export interface WirkungKpi {
  label: I18nString;
  wert?: string;
}

/** Digitale Reife & Vereinfachungspotenzial eines Prozesses (optional). */
export interface Reife {
  onlineReifegrad?: OnlineReifegrad;
  medienbrueche?: Medienbruch[];
  onceOnlyPotenzial?: I18nString;
  nutzergruppen?: I18nString[];
  painPoints?: I18nString[];
  improvementIdeas?: I18nString[];
  status?: ProzessStatus;
  wirkungKpi?: WirkungKpi[];
}

export interface Prozess {
  id: string;
  version: string;
  city: string;
  titel: I18nString;
  kurzbeschreibung?: I18nString;
  /** ID der Lebenslage in data/<city>/lebenslagen.json. */
  lebenslage_ref: string;
  /** Primäre Zielgruppe nach eCH-0073. */
  zielgruppe: Zielgruppe;
  voraussetzungen?: I18nString[];
  rechtsgrundlagen?: Rechtsgrundlage[];
  quellen: Quelle[];
  referenzen?: Referenz[];
  akteure: Akteur[];
  schritte: Schritt[];
  flow: FlowKante[];
  reife?: Reife;
  /** i18n-Key des Inoffiziell-Hinweises. Default: 'Prozesse.disclaimer'. */
  disclaimer_key?: string;
  meta?: {
    erstellt?: string;
    aktualisiert?: string;
    maintainer?: string;
    lizenz?: string;
  };
}

/** Hilfsfunktion: i18n-String auf aktuelle Locale auflösen (mit Fallback auf 'de'). */
export function resolveI18n(s: I18nString | undefined, locale: ProzessLocale): string {
  if (s === undefined) return '';
  if (typeof s === 'string') return s;
  return s[locale] ?? s.de;
}
