// Typen zur OpenGov-Process-Schema (siehe /schemas/opengov-process-schema.json).
// Halte diese Datei synchron mit dem JSON-Schema — die Source of Truth fürs Tooling
// ist das JSON-Schema, diese Typen sind ein bequemer TS-Mirror.

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

export type DauerEinheit =
  | 'minuten'
  | 'stunden'
  | 'arbeitstage'
  | 'kalendertage'
  | 'wochen'
  | 'monate';

export interface Dauer {
  min: number;
  max: number;
  einheit: DauerEinheit;
  typ?: 'bearbeitung' | 'durchlauf';
  anmerkung?: I18nString;
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
  dauer_est?: Dauer;
  kosten_chf?: {
    min?: number;
    max?: number;
    anmerkung?: I18nString;
  };
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
  url?: string;
  abgerufen?: string;
}

export interface Prozess {
  id: string;
  version: string;
  city: string;
  titel: I18nString;
  kurzbeschreibung?: I18nString;
  rechtsgrundlagen?: Rechtsgrundlage[];
  quellen?: Quelle[];
  akteure: Akteur[];
  schritte: Schritt[];
  flow: FlowKante[];
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
