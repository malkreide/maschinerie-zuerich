// Portfolio-Aggregator: das BIG PICTURE über ALLE Prozesse einer Stadt.
//
// Faltet die pro-Prozess-Indikatoren aus lib/bewertung.ts (Single Source) zu
// EINEM deterministischen Aggregat zusammen — Grundlage der Heatmap
// «Prozesse × Dimensionen». Diese Datei DUPLIZIERT keine Ableitungslogik:
// sie konsumiert ausschliesslich fertige BewertungReport-Objekte.
//
// Harte Prinzipien (siehe Task / CLAUDE.md):
//   1. Es wird nur gezeigt, was die Einzel-Indikatoren BELEGT/ABGELEITET haben.
//      «unbekannt» ist eine eigene, sichtbare Kategorie — NIE als 0 oder als
//      «nicht erfüllt» kaschiert. Prozesse ohne Belege werden NICHT still
//      weggelassen, sondern transparent mit Abdeckungslücke ausgewiesen.
//   2. «Link, don't assert»: hier entsteht keine bindende Zahl. Das Aggregat
//      ist eine transparente, reproduzierbare Funktion der belegten/berechneten
//      Indikatoren (identisch zur Logik in lib/bewertung.ts).
//   3. Bit-Identität: gleicher Input → bit-identisches Artefakt (serializePortfolio),
//      damit Diffs aussagekräftig bleiben. KEINE Zeitstempel/Zufallswerte.
//
// Selbstständig gehalten (nur type-only Imports), exakt wie lib/bewertung.ts —
// damit die Funktion ohne Pfad-Alias-Auflösung testbar ist (node --test mit
// Type-Stripping) und in Next-Code wie im Node-Generator-Skript läuft.

import type {
  BewertungReport,
  IndikatorKategorie,
  IndikatorStatus,
  KategorieScore,
} from './bewertung';

/** Schema-Version des Aggregat-Artefakts (unabhängig vom Prozess-Datenvertrag,
 *  weil rein abgeleitet). MAJOR-Bump bei Strukturänderung des Artefakts. */
export const PORTFOLIO_SCHEMA_VERSION = '1.0.0';

/** Spaltendefinition der Heatmap: ein Indikator (= eine Spalte), stabile
 *  Reihenfolge = Zell-Reihenfolge je Zeile. */
export interface PortfolioSpalte {
  key: string;
  kategorie: IndikatorKategorie;
  /** Zählt dieser Indikator in den Dimensions-Score? Informative (eid-noetig)
   *  nicht — sie werden in der Heatmap neutral (ja/nein) dargestellt. */
  gezaehlt: boolean;
}

/** Eine Zelle: Status eines Indikators für genau einen Prozess. */
export interface PortfolioZelle {
  key: string;
  status: IndikatorStatus;
}

/** Eine Zeile = ein Prozess. Bewusst OHNE Titel/Locale-Texte: die bleiben in
 *  der Prozessdatei (Single Source, regressionsgeschützt) und werden in der
 *  View über den Prozess-Index dazugejoint. */
export interface PortfolioZeile {
  slug: string; // city/id
  city: string;
  id: string;
  zellen: PortfolioZelle[];
  score: {
    digitalisierung: KategorieScore;
    nutzendenorientierung: KategorieScore;
    gesamt: KategorieScore;
  };
  /** Gezählte Indikatoren mit Status «unbekannt» (Abdeckungslücke, sichtbar). */
  unbekannt: number;
  /** true, wenn KEIN einziger belegter Digitalisierungs-Indikator vorliegt —
   *  der Prozess ist mangels Belegen nicht voll abgedeckt (Transparenz). */
  belegLuecke: boolean;
}

/** Aggregat pro Indikator über alle Prozesse (Spalten-Summen der Heatmap). */
export interface PortfolioIndikatorSumme {
  key: string;
  erfuellt: number;
  nichtErfuellt: number;
  unbekannt: number;
}

export interface Portfolio {
  schema_version: string;
  city: string;
  /** Herkunfts-Hinweis: rein abgeleitet, nicht von Hand pflegen. */
  generator: string;
  spalten: PortfolioSpalte[];
  prozesse: PortfolioZeile[];
  summary: {
    prozesse: number;
    /** Prozesse mit mindestens einem belegten Digitalisierungs-Indikator. */
    mitBeleg: number;
    /** Prozesse ohne jeden belegten Digitalisierungs-Indikator (Lücke). */
    ohneBeleg: number;
    proIndikator: PortfolioIndikatorSumme[];
  };
}

/** Eingabe je Prozess: identifizierende Felder + sein fertiger BewertungReport
 *  (aus buildBewertung). Die Komposition (Prozess laden → buildBewertung →
 *  hier hinein) macht der Aufrufer (Generator-Skript bzw. View). */
export interface PortfolioInput {
  city: string;
  id: string;
  report: BewertungReport;
}

/** Ein leerer Default-Score (für den theoretischen Fall ohne Prozesse). */
const LEER_SCORE: KategorieScore = { erfuellt: 0, bekannt: 0, unbekannt: 0, prozent: null };

/** Faltet die pro-Prozess-Reports zu einem Stadt-Portfolio. Rein, deterministisch:
 *  gleicher Input → gleiches Ergebnis (Zeilen + Spalten stabil sortiert). */
export function buildPortfolio(city: string, inputs: PortfolioInput[]): Portfolio {
  // Stabile Zeilen-Reihenfolge: nach slug (city/id). Eingabe wird nicht mutiert.
  const sortiert = [...inputs].sort((a, b) =>
    `${a.city}/${a.id}`.localeCompare(`${b.city}/${b.id}`),
  );

  // Spaltendefinition aus der (deterministischen) Indikator-Reihenfolge von
  // buildBewertung. Alle Prozesse teilen dieselbe Struktur; die erste Zeile
  // genügt als Referenz. Ohne Prozesse: leere Spalten.
  const spalten: PortfolioSpalte[] = (sortiert[0]?.report.indikatoren ?? []).map((i) => ({
    key: i.key,
    kategorie: i.kategorie,
    gezaehlt: i.gezaehlt,
  }));

  const prozesse: PortfolioZeile[] = sortiert.map((input) => {
    const r = input.report;
    const zellen: PortfolioZelle[] = r.indikatoren.map((i) => ({ key: i.key, status: i.status }));
    // Belegt = Digitalisierungs-Indikator mit Evidenz-Art 'beleg'. Fehlt jeder,
    // ist der Prozess digitalisierungsseitig unbelegt (Abdeckungslücke).
    const belegAnzahl = r.indikatoren.filter(
      (i) => i.kategorie === 'digitalisierung' && i.evidenz?.art === 'beleg',
    ).length;
    return {
      slug: `${input.city}/${input.id}`,
      city: input.city,
      id: input.id,
      zellen,
      score: {
        digitalisierung: r.score.digitalisierung,
        nutzendenorientierung: r.score.nutzendenorientierung,
        gesamt: r.score.gesamt,
      },
      unbekannt: r.score.gesamt.unbekannt,
      belegLuecke: belegAnzahl === 0,
    };
  });

  // Spalten-Summen: je Indikator über alle Prozesse zählen.
  const proIndikator: PortfolioIndikatorSumme[] = spalten.map((s) => {
    let erfuellt = 0;
    let nichtErfuellt = 0;
    let unbekannt = 0;
    for (const p of prozesse) {
      const z = p.zellen.find((c) => c.key === s.key);
      if (!z) continue;
      if (z.status === 'erfuellt') erfuellt++;
      else if (z.status === 'nicht-erfuellt') nichtErfuellt++;
      else unbekannt++;
    }
    return { key: s.key, erfuellt, nichtErfuellt, unbekannt };
  });

  const ohneBeleg = prozesse.filter((p) => p.belegLuecke).length;

  return {
    schema_version: PORTFOLIO_SCHEMA_VERSION,
    city,
    generator: 'lib/portfolio.ts/buildPortfolio',
    spalten,
    prozesse,
    summary: {
      prozesse: prozesse.length,
      mitBeleg: prozesse.length - ohneBeleg,
      ohneBeleg,
      proIndikator,
    },
  };
}

/** Kanonische Serialisierung — die EINE Stelle, die das Dateiformat festlegt.
 *  2-Space-Indent + abschliessender Newline. Da buildPortfolio alle Objekte in
 *  fester Schlüssel-Reihenfolge baut, ist die Ausgabe bit-identisch bei
 *  gleichem Input. Generator UND Drift-Check nutzen ausschliesslich diese
 *  Funktion, damit Schreiben und Prüfen nie auseinanderlaufen. */
export function serializePortfolio(portfolio: Portfolio): string {
  return JSON.stringify(portfolio, null, 2) + '\n';
}

// LEER_SCORE wird exportiert, damit Konsumenten einen neutralen Default haben,
// falls eine Stadt (noch) keine Prozesse hat.
export { LEER_SCORE };
