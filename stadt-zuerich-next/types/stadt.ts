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
  fte?: Fte;
  odz?: Odz;
}

export interface Unit {
  id: string;
  parent: DepartmentId;
  name: string;
  kind: UnitKind;
  budget?: Budget;
  fte?: Fte;
  odz?: Odz;
  konflikt?: Konflikt;
}

export interface Beteiligung {
  id: string;
  name: string;
  verbunden: DepartmentId;
  budget?: Budget;
  fte?: Fte;
  odz?: Odz;
}

export interface Center {
  id: string;
  name: string;
  type: 'center';
  note?: string;
}

export interface Lebenslage {
  id: string;
  frage: string;
  stichworte: string[];
  zustaendig: string;          // unit-id oder dep-id
  antwort?: string;
}

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
}

export interface StadtData {
  _meta: DataMeta;
  center: Center;
  departments: Department[];
  units: Unit[];
  beteiligungen: Beteiligung[];
  lebenslagen?: Lebenslage[];  // optional, wird zur Laufzeit beigeladen
}
