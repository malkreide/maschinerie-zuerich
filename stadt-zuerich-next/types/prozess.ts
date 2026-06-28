// Typen zum kanonischen Prozess-Datenvertrag (docs/process-data-contract.md
// im Repo-Root; JSON-Schema: /schemas/opengov-process-schema.json).
// Halte diese Datei synchron mit dem JSON-Schema — die Source of Truth fürs
// Tooling ist das JSON-Schema, diese Typen sind ein bequemer TS-Mirror.
//
// Konvention: Feldnamen englisch (Vertrag), Inhalte/Enum-Werte deutsch (eCH).
// Kardinalregel: bindende Werte (Fristen, Gebühren) leben NUR in Reference
// (Label + Deep-Link + wörtliches source_quote) — es gibt bewusst keine
// Felder für Dauern oder Kosten als Zahl.

export type ProzessLocale = 'de' | 'en' | 'fr' | 'it' | 'ls';

/** Ein i18n-String: Objekt mit mindestens 'de'. 'ls' = Leichte Sprache
 *  (entspricht 'leichte_sprache' im tessera-Entwurf). Fehlende Locales
 *  bedeuten "Übersetzung ausstehend" — Fallback auf 'de', nie maschinell
 *  raten. */
export type I18nString = { de: string } & Partial<Record<ProzessLocale, string>>;

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

export type TargetAudience = 'bevoelkerung' | 'wirtschaft' | 'behoerden';

/** Vorgänger-Beziehung: nackte step_id oder Objekt-Variante mit
 *  Bedingungs-Label (additive Erweiterung; auf step_id reduzierbar). */
export type DependsOn = number | { step_id: number; condition?: I18nString };

/** Liefert die step_id einer DependsOn-Angabe (beide Varianten). */
export function dependsOnId(d: DependsOn): number {
  return typeof d === 'number' ? d : d.step_id;
}

/** Liefert das Bedingungs-Label einer DependsOn-Angabe, falls vorhanden. */
export function dependsOnCondition(d: DependsOn): I18nString | undefined {
  return typeof d === 'number' ? undefined : d.condition;
}

export interface Reference {
  reference_id: number;
  /** Ohne die Zahl als behaupteten Fakt — die steht nur im source_quote. */
  label: I18nString;
  /** Deep-Link auf die exakte Stelle der amtlichen Quelle. */
  source_url: string;
  /** Wörtliche Belegstelle. Pflicht (nicht-leer) bei status 'verifiziert'. */
  source_quote?: string;
  status?: 'verifiziert' | 'unverifiziert';
  retrieved_at: string;
}

export interface Document {
  label: I18nString;
  url?: string;
  required?: boolean;
}

/** Erweiterung: Akteurs-Tabelle (Swimlanes, Org-Chart-Brücke). */
export interface Actor {
  id: string;
  label: I18nString;
  type: AkteurTyp;
  /** Optionale Verknüpfung in die Organisations-Hierarchie (org-chart.json). */
  einheit_ref?: string;
}

export interface Step {
  /** Eindeutig je Prozess. */
  step_id: number;
  /** Referenziert actors[].id, falls actors vorhanden — bestimmt die Swimlane. */
  actor: string;
  label: I18nString;
  /** Vorgänger; leer = Start-Schritt. Graph über depends_on ist ein DAG. */
  depends_on: DependsOn[];
  /** Verweise auf references[].reference_id. */
  reference_ids?: number[];
  /** Erweiterung: Render-Hint. */
  type?: SchrittTyp;
  description?: I18nString;
  documents?: Document[];
  /** Erweiterung: Verweis auf sources[].id. */
  source_id?: string;
  /** Erweiterung: Rücksprung-Hinweis fürs Rendering (nur an type 'loop').
   *  NICHT Teil des DAG. */
  loops_back_to?: number[];
}

export interface LegalBasis {
  label: string;
  url?: string;
}

export interface Source {
  id: string;
  title: string;
  url: string;
  retrieved_at: string;
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

/** Erweiterung (experimentell): Digitale Reife & Vereinfachungspotenzial.
 *  Unverändert aus Schema-Generation 1/2; Normalisierung folgt später. */
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

/** Belegpflichtige Bewertungs-Indikator-Keys. Diese Eigenschaften lassen sich
 *  NICHT aus dem Graphen ableiten und brauchen einen Quellenbeleg (wie eine
 *  Reference). Graph-ableitbare Indikatoren leben in lib/bewertung.ts, nicht
 *  hier. */
export type BewertungIndikatorKey =
  | 'online-antrag'
  | 'online-bezahlung'
  | 'statusverfolgung'
  | 'medienbruchfrei'
  | 'digital-abschliessbar'
  | 'eid-noetig';

/** Ein belegter Bewertungs-Indikator — Eigenschaft (wert) + Beleg
 *  (source_quote + Link), exakt wie eine Reference. KEIN bindender Wert. */
export interface BewertungIndikator {
  key: BewertungIndikatorKey;
  /** Belegte Ausprägung der Eigenschaft (true = trifft zu). */
  wert: boolean;
  source_url: string;
  /** Wörtliche Belegstelle. Pflicht (nicht-leer) bei status 'verifiziert'. */
  source_quote?: string;
  status?: 'verifiziert' | 'unverifiziert';
  retrieved_at: string;
}

/** Erweiterung (additiv, optional): belegte Bewertungs-Indikatoren. Nur was
 *  nicht aus dem Graphen ableitbar ist, wird hier mit Beleg hinterlegt. */
export interface Bewertung {
  indikatoren?: BewertungIndikator[];
}

export interface Prozess {
  schema_version: string;
  /** = lebenslage_ref (CI-geprüft). */
  id: string;
  lebenslage_ref: string;
  /** Erweiterung: Stadt-Kennung — Dateiablage + URL-Slug <city>/<id>. */
  city: string;
  title: I18nString;
  /** Erweiterung: Kurzbeschreibung. */
  description?: I18nString;
  /** Primäre Zielgruppe nach eCH-0073. */
  target_audience: TargetAudience;
  preconditions?: I18nString[];
  steps: Step[];
  references?: Reference[];
  /** Primäre amtliche Quelle + Abrufdatum (Disclaimer-Anzeige). */
  source_url: string;
  retrieved_at: string;
  /** i18n-Key des Inoffiziell-Hinweises, z.B. 'Prozesse.disclaimer'. */
  disclaimer_key: string;
  actors?: Actor[];
  legal_basis?: LegalBasis[];
  sources?: Source[];
  reife?: Reife;
  /** Erweiterung: belegte Bewertungs-Indikatoren (Digitalisierung). */
  bewertung?: Bewertung;
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
  return s[locale] ?? s.de;
}
