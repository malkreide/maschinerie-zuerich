// Typen für data.json — Output der ETL-Pipeline.
// Quelle: stadt-zuerich.ch (Struktur), data.stadt-zuerich.ch (RPK-API),
// Budget-/Rechnungs-PDFs (manuelle Anreicherung).

export type DepartmentId = string;
export type UnitKind = 'unit' | 'staff' | 'extern' | 'committee' | 'spezial';

export interface Budget {
  jahr: number;
  typ: string;                 // GEMEINDERAT_BESCHLUSS | STADTRAT_ANTRAG | RECHNUNG
  aufwand: number;
  ertrag: number;
  nettoaufwand: number;
  _aggregiertAus?: number;
}

export interface Fte {
  schaetzung: number;
  einheit?: string;            // 'Stellenwerte (STW)' | 'Mitarbeitende' | undefined (Proxy)
  jahr?: number;
  typ?: string;
  methode?: string;
  vollkostenProFte?: number;
  personalaufwand?: number;
  quelle?: 'pdf' | 'schaetzung';
  quelleDetail?: string;
  quelleUrl?: string;
  phase?: string;
  _aggregiertAus?: number;
}

export interface Odz {
  key: string;
  kurzname: string;
  bezeichnung: string;
  departementKurzname?: string;
  keys?: string[];             // gesetzt, wenn die Einheit mehrere RPK-Institutionen aggregiert
}

export interface Konflikt {
  unsereZuordnung: string;
  unsereKurzname: string;
  rpkKurzname: string;
  rpkBezeichnung?: string;
}

export interface KlimaImpact {
  co2Score?: number; // -100 (gut, netto-positiv) bis +100 (hoher Ausstoss)
  budgetShare?: number; // Anteil Klima-Investitionen 0-1
}

export interface FederationLink {
  targetId: string;
  targetUrl: string; // URL of the external data.json or target UI
  label: string;
}

export interface Department {
  id: DepartmentId;
  name: string;
  vorsteher: string;
  budget?: Budget;
  budgetHistory?: Budget[];
  fte?: Fte;
  odz?: Odz;
  klima?: KlimaImpact;
  federationLinks?: FederationLink[];
}

export interface Unit {
  id: string;
  parent: DepartmentId;
  name: string;
  kind: UnitKind;
  budget?: Budget;
  budgetHistory?: Budget[];
  fte?: Fte;
  odz?: Odz;
  konflikt?: Konflikt;
  klima?: KlimaImpact;
  federationLinks?: FederationLink[];
}

// Klassifikation öffentlicher Beteiligungen (Transparenz / Open Data).
// Kategorial gehalten — bewusst keine exakten Eigentumsanteile, die offline
// nicht verlässlich belegbar wären. In der CI gegen das Schema validiert.
export const BETEILIGUNG_RECHTSFORMEN = [
  'ag',
  'stiftung',
  'genossenschaft',
  'oeffentlich-rechtlich',
  'verein',
] as const;
export type BeteiligungRechtsform = (typeof BETEILIGUNG_RECHTSFORMEN)[number];

// strategisch = öffentlicher Auftrag/Steuerungsinteresse; finanziell = primär Kapitalanlage.
export const BETEILIGUNGS_ARTEN = ['strategisch', 'finanziell'] as const;
export type BeteiligungsArt = (typeof BETEILIGUNGS_ARTEN)[number];

export const BETEILIGUNG_SEKTOREN = [
  'energie',
  'verkehr',
  'finanzen',
  'wohnen',
  'kultur',
  'soziales',
  'freizeit',
  'gesundheit',
] as const;
export type BeteiligungSektor = (typeof BETEILIGUNG_SEKTOREN)[number];

// Maschinenlesbares Provenance-Vokabular (deckungsgleich mit dem Datenkatalog
// und der DataQualityBadge-Taxonomie). Macht die Datenherkunft pro Datensatz
// auswertbar.
export const PROVENANCE = [
  'publiziert',
  'aggregiert',
  'geschaetzt',
  'manuell',
  'api',
  'pdf',
  'demo',
] as const;
export type Provenance = (typeof PROVENANCE)[number];

export interface Beteiligung {
  id: string;
  name: string;
  verbunden: DepartmentId;
  budget?: Budget;
  budgetHistory?: Budget[];
  fte?: Fte;
  odz?: Odz;
  // Klassifikation (optional, additiv):
  rechtsform?: BeteiligungRechtsform;
  beteiligungsart?: BeteiligungsArt;
  sektor?: BeteiligungSektor;
  zweck?: string;       // Kurzbeschreibung des Zwecks (de)
  quelle?: string;      // Beleg-URL (z. B. Beteiligungsbericht)
  stand?: string;       // Datenstand (Jahr oder ISO-Datum)
  provenance?: Provenance; // maschinenlesbare Datenherkunft
}

export interface Center {
  id: string;
  name: string;
  type: 'center';
  note?: string;
}

// Lokalisierbarer Content einer Lebenslage. Schlüssel wie bisher:
// frage = Kurz-Frage, stichworte = Suchbegriffe, antwort = Kurzerklärung.
export interface LebenslageContent {
  frage: string;
  stichworte: string[];
  antwort?: string;
}

export type LebenslageLocale = 'de' | 'en' | 'fr' | 'it' | 'ls';

// Zielgruppen-Taxonomie für die Lebenslagen-Filterung. Bewusst klein und
// stabil gehalten; die Labels pro Locale liegen im Messages-Namespace
// "Zielgruppen". Wird in der CI gegen die Daten validiert.
export const ZIELGRUPPEN = [
  'einwohner',
  'unternehmen',
  'familie',
  'alter',
  'schule',
  'migration',
  'mobilitaet',
  'wohnen',
  'gesundheit',
] as const;

export type Zielgruppe = (typeof ZIELGRUPPEN)[number];

export interface Lebenslage {
  id: string;
  zustaendig: string;            // unit-id oder dep-id
  zielgruppen?: Zielgruppe[];    // optionale Tags für die Filterung
  // Explizite Verknüpfung zu modellierten Verfahren (OpenGov-Process-Schema).
  // Slug-Form "<city>/<id>", z. B. "zh/parkplatz". Referentielle
  // Integrität wird in der CI gegen data/prozesse/** geprüft.
  prozesse?: string[];
  i18n: Partial<Record<LebenslageLocale, LebenslageContent | null>>;
}

// Resultat der Suche: Lebenslage + aufgelöster Content in gewünschtem Locale
// (mit Fallback auf de). Callers können .frage/.stichworte/.antwort direkt lesen.
export type LebenslageHit = Lebenslage & LebenslageContent;

export interface DataMeta {
  schemaVersion: number;
  stand: string;
  quellen: string[];
  hinweise: string[];
  angereichert?: string;
  quelleEnrichment?: string;
  budgetStand?: string;
  fteHinweis?: string;
  fteOverridesAus?: string;
  // Stadt-weite Eckwerte aus dem Geschäftsbericht / Rechnung. Gepflegt aus
  // dem Pressetext, solange die per-Departement-Werte in `departments`/`units`
  // noch aus einem älteren Budget-Stand stammen — die UI kann damit eine
  // ehrliche "Stadtweit 2025: X Mio Aufwand" anzeigen, auch wenn die Detail-
  // Aggregation summe(units) noch dem letzten API-Refresh entspricht.
  gesamtstadt?: GesamtstadtSummary;
}

export interface GesamtstadtSummary {
  jahr: number;
  phase: 'RECHNUNG' | 'BUDGET' | 'GEMEINDERAT_BESCHLUSS';
  aufwand: number;
  ertrag: number;
  /** Positiv = Aufwandüberschuss (Verlust), negativ = Ertragsüberschuss (Gewinn). */
  aufwandueberschuss: number;
  quelle: string;
  quelleUrl: string;
  kontext?: string;
  kontextUrl?: string;
  hinweis?: string;
}

export interface OrganizationMeta {
  id: string;
  name: string;
  type: 'city' | 'canton' | 'federal' | 'other';
  parentOrganizationId?: string;
  parentOrganizationUrl?: string;
  logoUrl?: string;
  primaryColor?: string;
}

export interface StadtData {
  _meta: DataMeta;
  organization?: OrganizationMeta; // Added to support federation
  center: Center;
  departments: Department[];
  units: Unit[];
  beteiligungen: Beteiligung[];
  lebenslagen?: Lebenslage[];  // optional, wird zur Laufzeit beigeladen
}
