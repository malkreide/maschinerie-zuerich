// Typen für data.json — Output der ETL-Pipeline.
// Quelle: stadt-zuerich.ch (Struktur), data.stadt-zuerich.ch (RPK-API),
// Budget-/Rechnungs-PDFs (manuelle Anreicherung).

export type DepartmentId = string;
export type UnitKind = 'unit' | 'staff' | 'extern';

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
}

export interface Konflikt {
  unsereZuordnung: string;
  unsereKurzname: string;
  rpkKurzname: string;
  rpkBezeichnung?: string;
}

export interface Department {
  id: DepartmentId;
  name: string;
  vorsteher: string;
  budget?: Budget;
  budgetHistory?: Budget[];
  fte?: Fte;
  odz?: Odz;
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
}

export interface Beteiligung {
  id: string;
  name: string;
  verbunden: DepartmentId;
  budget?: Budget;
  budgetHistory?: Budget[];
  fte?: Fte;
  odz?: Odz;
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

export interface Lebenslage {
  id: string;
  zustaendig: string;            // unit-id oder dep-id
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

export interface StadtData {
  _meta: DataMeta;
  center: Center;
  departments: Department[];
  units: Unit[];
  beteiligungen: Beteiligung[];
  lebenslagen?: Lebenslage[];  // optional, wird zur Laufzeit beigeladen
}
