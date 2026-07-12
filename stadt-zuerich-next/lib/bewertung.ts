// Prozess-Bewertung: reine, deterministische Ableitung von Einzelindikatoren
// zu DIGITALISIERUNG und NUTZENDENORIENTIERUNG aus einem bereits modellierten
// Prozess — Schwester von lib/kompass.ts.
//
// Harte Prinzipien (siehe Task / CLAUDE.md):
//   1. KEINE LLM-Note. Jeder Indikator ist ENTWEDER deterministisch aus dem
//      Prozess-Graphen BERECHNET (art: 'berechnet') ODER aus der Quelle BELEGT
//      (art: 'beleg', mit source_quote + URL wie eine Reference). Ein Indikator
//      ohne Beleg/Ableitung wird NICHT geraten, sondern als 'unbekannt'
//      geflaggt.
//   2. «Link, don't assert»: die Bewertung beschreibt STRUKTUR/EIGENSCHAFTEN,
//      nie bindende Werte (Fristen/Gebühren). Es entsteht hier keine Zahl, die
//      als Rechtswert gelesen werden könnte.
//   3. Der aggregierte Score ist eine transparente, deterministische Funktion
//      der Einzelindikatoren (Anteil erfüllter unter den BEKANNTEN, gezählten
//      Indikatoren). 'unbekannt' zählt nicht als 0, sondern wird separat
//      ausgewiesen.
//
// Selbstständig gehalten (nur type-only Imports), damit die Funktion ohne
// Pfad-Alias-Auflösung testbar ist (node --test mit Type-Stripping).

import type {
  Prozess,
  ProzessLocale,
  BewertungIndikatorKey,
} from '@/types/prozess';

export type IndikatorKategorie = 'digitalisierung' | 'nutzendenorientierung';
export type IndikatorStatus = 'erfuellt' | 'nicht-erfuellt' | 'unbekannt';

/** Evidenz eines Indikators: entweder aus dem Graphen berechnet (mit Zähl-
 *  Werten fürs Rendering) oder aus der Quelle belegt (Zitat + Link). */
export type IndikatorEvidenz =
  | { art: 'berechnet'; zahl: number; von?: number }
  | {
      art: 'beleg';
      quote?: string;
      url: string;
      retrieved_at: string;
      unverifiziert: boolean;
    };

export interface IndikatorResult {
  /** Stabiler Key (i18n + React-key). */
  key: string;
  kategorie: IndikatorKategorie;
  status: IndikatorStatus;
  /** Zählt dieser Indikator in den Score? Informative (z.B. eid-noetig) nicht. */
  gezaehlt: boolean;
  /** null nur bei 'unbekannt' ohne jede Information. */
  evidenz: IndikatorEvidenz | null;
}

export interface KategorieScore {
  /** Anzahl erfüllter, gezählter Indikatoren. */
  erfuellt: number;
  /** Bekannte, gezählte Indikatoren (erfüllt + nicht erfüllt). */
  bekannt: number;
  /** Gezählte Indikatoren mit Status 'unbekannt'. */
  unbekannt: number;
  /** Anteil erfüllter unter den BEKANNTEN, gerundet auf Prozent. null, wenn
   *  nichts bekannt ist (dann gibt es bewusst keinen Score). */
  prozent: number | null;
}

/** Rein berechnete Kennzahlen (keine Pass/Fail-Schwelle, daher kein Score-
 *  Beitrag) — Komplexitäts-Hinweise aus dem Graphen. */
export interface Kennzahlen {
  schritte: number;
  akteurswechsel: number;
  behoerden: number;
  pflichtdokumente: number;
  entscheidungspunkte: number;
}

export interface BewertungReport {
  indikatoren: IndikatorResult[];
  kennzahlen: Kennzahlen;
  score: {
    digitalisierung: KategorieScore;
    nutzendenorientierung: KategorieScore;
    gesamt: KategorieScore;
  };
}

/** Gezählte, belegpflichtige Digitalisierungs-Indikatoren in fester Reihenfolge.
 *  'wert: true' im Beleg = nutzendenfreundliche Ausprägung = 'erfuellt'. */
const DIGITAL_SCORED: BewertungIndikatorKey[] = [
  'online-antrag',
  'online-bezahlung',
  'statusverfolgung',
  'medienbruchfrei',
  'digital-abschliessbar',
  'once-only',
];

/** Informative belegpflichtige Indikatoren (zählen NICHT in den Score). */
const DIGITAL_INFO: BewertungIndikatorKey[] = ['eid-moeglich'];

/** Belegpflichtige Nutzendenorientierungs-Indikatoren (zählen in den Score).
 *  Nicht aus dem Graphen ableitbar (z.B. WCAG-Konformität, analoger
 *  Alternativweg) — daher belegt oder 'unbekannt'. */
const NUTZEND_BELEGT: BewertungIndikatorKey[] = [
  'barrierefreiheit',
  'nicht-digitaler-alternativweg',
];

/** Hat der i18n-String eine eigene, nicht-leere Fassung in dieser Locale?
 *  (Fallback auf 'de' zählt NICHT als Abdeckung.) */
function hatLocale(
  s: { [k in ProzessLocale]?: string } | undefined,
  locale: ProzessLocale,
): boolean {
  return Boolean(s && typeof s[locale] === 'string' && s[locale]!.trim() !== '');
}

/** Abdeckung einer Locale über Titel + alle Schritt-Labels: wie viele der
 *  (1 + N) Slots eine eigene Fassung haben. Voll abgedeckt = alle. */
function localeAbdeckung(
  p: Prozess,
  locale: ProzessLocale,
): { zahl: number; von: number; voll: boolean } {
  const slots = [p.title, ...p.steps.map((s) => s.label)];
  const von = slots.length;
  let zahl = 0;
  for (const s of slots) if (hatLocale(s, locale)) zahl++;
  return { zahl, von, voll: von > 0 && zahl === von };
}

/** Akteurswechsel: gerichtete depends_on-Kanten, bei denen sich der handelnde
 *  Akteur ändert — ein Proxy für Behördengänge/Übergaben (rein strukturell). */
function akteurswechsel(p: Prozess): number {
  const actorById = new Map(p.steps.map((s) => [s.step_id, s.actor]));
  let count = 0;
  for (const s of p.steps) {
    for (const d of s.depends_on ?? []) {
      const vonId = typeof d === 'number' ? d : d.step_id;
      const vonActor = actorById.get(vonId);
      if (vonActor !== undefined && vonActor !== s.actor) count++;
    }
  }
  return count;
}

function kennzahlen(p: Prozess): Kennzahlen {
  let pflichtdokumente = 0;
  let entscheidungspunkte = 0;
  for (const s of p.steps) {
    if (s.type === 'entscheidung') entscheidungspunkte++;
    for (const d of s.documents ?? []) {
      // Schema-Default von documents[].required ist true — alles ausser
      // explizit required:false zählt als Pflicht (wie in lib/kompass.ts).
      if (d.required !== false) pflichtdokumente++;
    }
  }
  return {
    schritte: p.steps.length,
    akteurswechsel: akteurswechsel(p),
    behoerden: (p.actors ?? []).filter((a) => a.type === 'behoerde').length,
    pflichtdokumente,
    entscheidungspunkte,
  };
}

/** Belegter Indikator → IndikatorResult (oder 'unbekannt'). */
function belegterIndikator(
  p: Prozess,
  key: BewertungIndikatorKey,
  kategorie: IndikatorKategorie,
  gezaehlt: boolean,
): IndikatorResult {
  const beleg = (p.bewertung?.indikatoren ?? []).find((i) => i.key === key);
  if (!beleg) {
    return { key, kategorie, status: 'unbekannt', gezaehlt, evidenz: null };
  }
  return {
    key,
    kategorie,
    status: beleg.wert ? 'erfuellt' : 'nicht-erfuellt',
    gezaehlt,
    evidenz: {
      art: 'beleg',
      quote: beleg.source_quote,
      url: beleg.source_url,
      retrieved_at: beleg.retrieved_at,
      unverifiziert: beleg.status === 'unverifiziert',
    },
  };
}

function berechneterIndikator(
  key: string,
  erfuellt: boolean,
  zahl: number,
  von?: number,
): IndikatorResult {
  return {
    key,
    kategorie: 'nutzendenorientierung',
    status: erfuellt ? 'erfuellt' : 'nicht-erfuellt',
    gezaehlt: true,
    evidenz: { art: 'berechnet', zahl, ...(von !== undefined ? { von } : {}) },
  };
}

function scoreFor(indikatoren: IndikatorResult[]): KategorieScore {
  const gezaehlt = indikatoren.filter((i) => i.gezaehlt);
  const erfuellt = gezaehlt.filter((i) => i.status === 'erfuellt').length;
  const nichtErfuellt = gezaehlt.filter((i) => i.status === 'nicht-erfuellt').length;
  const unbekannt = gezaehlt.filter((i) => i.status === 'unbekannt').length;
  const bekannt = erfuellt + nichtErfuellt;
  return {
    erfuellt,
    bekannt,
    unbekannt,
    prozent: bekannt > 0 ? Math.round((100 * erfuellt) / bekannt) : null,
  };
}

/** Reine Ableitung: gleicher Prozess → gleicher, reproduzierbarer Report. */
export function buildBewertung(p: Prozess): BewertungReport {
  // --- DIGITALISIERUNG (belegpflichtig) ---
  const digital: IndikatorResult[] = [
    ...DIGITAL_SCORED.map((k) => belegterIndikator(p, k, 'digitalisierung', true)),
    ...DIGITAL_INFO.map((k) => belegterIndikator(p, k, 'digitalisierung', false)),
  ];

  // --- NUTZENDENORIENTIERUNG (berechnet + belegpflichtig) ---
  const ls = localeAbdeckung(p, 'ls');
  const en = localeAbdeckung(p, 'en');
  const fr = localeAbdeckung(p, 'fr');
  const it = localeAbdeckung(p, 'it');
  const mehrsprachigVoll = [en, fr, it].filter((x) => x.voll).length;

  const nutzend: IndikatorResult[] = [
    berechneterIndikator('leichte-sprache', ls.voll, ls.zahl, ls.von),
    berechneterIndikator('mehrsprachigkeit', mehrsprachigVoll === 3, mehrsprachigVoll, 3),
    berechneterIndikator(
      'voraussetzungen-genannt',
      (p.preconditions?.length ?? 0) > 0,
      p.preconditions?.length ?? 0,
    ),
    berechneterIndikator(
      'fristen-kosten-verlinkt',
      (p.references?.length ?? 0) > 0,
      p.references?.length ?? 0,
    ),
    ...NUTZEND_BELEGT.map((k) => belegterIndikator(p, k, 'nutzendenorientierung', true)),
  ];

  const indikatoren = [...digital, ...nutzend];

  return {
    indikatoren,
    kennzahlen: kennzahlen(p),
    score: {
      digitalisierung: scoreFor(digital),
      nutzendenorientierung: scoreFor(nutzend),
      gesamt: scoreFor(indikatoren),
    },
  };
}
