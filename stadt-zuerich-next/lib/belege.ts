// Belege-Aggregator: die Belegkette ALLER Prozesse einer Stadt (Ebene 1 der
// Ansicht «Belege & Herkunft», siehe docs/plan-belege-herkunft.md).
//
// Faltet die bindenden References, Bewertungs-Belege, Quellen und
// Rechtsgrundlagen jeder Prozessdatei zu EINEM deterministischen Aggregat.
// Gemessen wird hier nichts: ob ein Link lebt oder ein Zitat noch wörtlich auf
// der Seite steht, ist ein Netzbefund (Ebene 2) und gehört nicht hierher —
// sonst wäre das Artefakt nicht reproduzierbar und das CI-Drift-Gate (netzfrei)
// würde bei jeder Netzschwankung rot.
//
// Harte Prinzipien:
//   1. «Link, don't assert»: das Aggregat enthält weder Labels noch Zitate,
//      nur Status, Host, Datum. Texte bleiben in der Prozessdatei (Single
//      Source, regressionsgeschützt) und werden in der View dazugejoint.
//   2. Bit-Identität: gleicher Input → bit-identisches Artefakt
//      (serializeBelege). KEINE Zeitstempel, kein «Alter in Tagen» — das hinge
//      vom Erzeugungstag ab; das Alter rechnet die View beim Rendern.
//   3. Nichts raten: die Staatsebene einer Quelle kommt aus einer expliziten
//      Host-Liste (config/quellen-ebenen.json); unbekannte Hosts → 'andere'.
//
// Selbstständig gehalten (nur type-only Imports), exakt wie lib/portfolio.ts —
// damit die Funktion ohne Pfad-Alias-Auflösung testbar ist (node --test mit
// Type-Stripping). Die Erkennung von Gesetzes-PDFs lebt in
// scripts/lib/gesetzesfassung.mjs und wird als Funktion hereingereicht, statt
// sie hier zu duplizieren.

import type { Prozess } from '@/types/prozess';

/** Schema-Version des Aggregat-Artefakts (rein abgeleitet, unabhängig vom
 *  Prozess-Datenvertrag). MAJOR-Bump bei Strukturänderung des Artefakts. */
export const BELEGE_SCHEMA_VERSION = '1.0.0';

/** Staatsebene der Quelle eines Belegs. */
export type QuellenEbene = 'stadt' | 'kanton' | 'bund' | 'andere';

/** Feste Reihenfolge — bestimmt auch die Schlüssel-Reihenfolge in
 *  summary.nachEbene (Bit-Identität). */
export const QUELLEN_EBENEN: QuellenEbene[] = ['stadt', 'kanton', 'bund', 'andere'];

export type ReferenzStatus = 'verifiziert' | 'unverifiziert';

/** Host-Listen je Ebene, bereits für eine Stadt aufgelöst. Ein Eintrag deckt
 *  den Host selbst und alle Subdomains ab ('zh.ch' → 'www.zh.ch'). */
export interface QuellenRegeln {
  stadt: string[];
  kanton: string[];
  bund: string[];
}

/** Eine bindende Reference — bewusst ohne Label und ohne Zitat. */
export interface BelegReferenz {
  reference_id: number;
  status: ReferenzStatus;
  /** nicht-leeres source_quote vorhanden */
  mitZitat: boolean;
  /** Hostname der source_url, z. B. "www.stadt-zuerich.ch" */
  host: string;
  ebene: QuellenEbene;
  /** verlinkt das PDF einer Gesetzesfassung (fedlex/ZHlex) */
  gesetzesfassung: boolean;
  /** ISO-Datum des Abrufs */
  retrieved_at: string;
}

/** Eine Zeile = ein Prozess. */
export interface BelegZeile {
  slug: string; // city/id
  city: string;
  id: string;
  /** trägt den Hochrisiko-Disclaimer (validate:prozesse erzwingt, dass genau
   *  die gelisteten Hochrisiko-Fälle ihn tragen) */
  hochrisiko: boolean;
  referenzen: BelegReferenz[];
  summe: {
    referenzen: number;
    verifiziert: number;
    mitZitat: number;
    unverifiziert: number;
  };
  /** bewertung.indikatoren[] — gleiches Grounding-Gate wie References */
  bewertungsBelege: { gesamt: number; verifiziert: number };
  quellen: number;
  rechtsgrundlagen: number;
  /** ältester/jüngster retrieved_at über alle References; null ohne References */
  abruf: { aeltester: string | null; juengster: string | null };
}

export interface Belege {
  schema_version: string;
  city: string;
  /** Herkunfts-Hinweis: rein abgeleitet, nicht von Hand pflegen. */
  generator: string;
  prozesse: BelegZeile[];
  summary: {
    prozesse: number;
    referenzen: number;
    verifiziert: number;
    mitZitat: number;
    hochrisiko: number;
    /** References je Staatsebene der Quelle */
    nachEbene: Record<QuellenEbene, number>;
  };
}

export interface BelegeOptionen {
  regeln: QuellenRegeln;
  /** true, wenn die URL das PDF einer Gesetzesfassung verlinkt
   *  (im Generator: erkenneFassung aus scripts/lib/gesetzesfassung.mjs). */
  istGesetzesfassung: (url: string) => boolean;
}

const HOCHRISIKO_KEY = 'Prozesse.disclaimerHochrisiko';

/** true, wenn host gleich domain ist oder eine Subdomain davon. Vergleich an
 *  der Label-Grenze: 'notzh.ch' ist KEINE Subdomain von 'zh.ch'. */
function passtZuDomain(host: string, domain: string): boolean {
  const d = domain.toLowerCase();
  return host === d || host.endsWith(`.${d}`);
}

/** Staatsebene eines Hosts. Bei mehreren Treffern gewinnt die längste (also
 *  spezifischste) Domain; ohne Treffer → 'andere'. */
export function ebeneFuerHost(host: string, regeln: QuellenRegeln): QuellenEbene {
  const h = host.toLowerCase();
  let best: { ebene: QuellenEbene; laenge: number } | null = null;
  for (const ebene of ['stadt', 'kanton', 'bund'] as const) {
    for (const domain of regeln[ebene]) {
      if (passtZuDomain(h, domain) && (!best || domain.length > best.laenge)) {
        best = { ebene, laenge: domain.length };
      }
    }
  }
  return best?.ebene ?? 'andere';
}

const istVerifiziert = (status: string | undefined): boolean =>
  (status ?? 'verifiziert') === 'verifiziert';

const hatText = (s: string | undefined): boolean => typeof s === 'string' && s.trim() !== '';

function belegZeile(fallbackCity: string, p: Prozess, opts: BelegeOptionen): BelegZeile {
  const city = p.city ?? fallbackCity;
  // Stabile Reihenfolge nach reference_id; Eingabe wird nicht mutiert.
  const referenzen: BelegReferenz[] = [...(p.references ?? [])]
    .sort((a, b) => a.reference_id - b.reference_id)
    .map((r) => {
      // source_url ist via validate:prozesse als http(s)-URL garantiert; ein
      // Fehler hier soll den Lauf abbrechen statt still 'andere' zu liefern.
      const host = new URL(r.source_url).hostname.toLowerCase();
      return {
        reference_id: r.reference_id,
        status: istVerifiziert(r.status) ? 'verifiziert' : 'unverifiziert',
        mitZitat: hatText(r.source_quote),
        host,
        ebene: ebeneFuerHost(host, opts.regeln),
        gesetzesfassung: opts.istGesetzesfassung(r.source_url),
        retrieved_at: r.retrieved_at,
      };
    });

  const verifiziert = referenzen.filter((r) => r.status === 'verifiziert').length;
  const daten = referenzen.map((r) => r.retrieved_at).sort();
  const indikatoren = p.bewertung?.indikatoren ?? [];

  return {
    slug: `${city}/${p.id}`,
    city,
    id: p.id,
    hochrisiko: p.disclaimer_key === HOCHRISIKO_KEY,
    referenzen,
    summe: {
      referenzen: referenzen.length,
      verifiziert,
      mitZitat: referenzen.filter((r) => r.mitZitat).length,
      unverifiziert: referenzen.length - verifiziert,
    },
    bewertungsBelege: {
      gesamt: indikatoren.length,
      verifiziert: indikatoren.filter((i) => istVerifiziert(i.status)).length,
    },
    quellen: p.sources?.length ?? 0,
    rechtsgrundlagen: p.legal_basis?.length ?? 0,
    abruf: {
      aeltester: daten[0] ?? null,
      juengster: daten[daten.length - 1] ?? null,
    },
  };
}

/** Faltet die Prozesse einer Stadt zur Belegkette. Rein, deterministisch:
 *  gleicher Input → gleiches Ergebnis (Zeilen nach slug, References nach
 *  reference_id sortiert). */
export function buildBelege(city: string, prozesse: Prozess[], opts: BelegeOptionen): Belege {
  const zeilen = prozesse
    .map((p) => belegZeile(city, p, opts))
    .sort((a, b) => a.slug.localeCompare(b.slug));

  const nachEbene = Object.fromEntries(QUELLEN_EBENEN.map((e) => [e, 0])) as Record<QuellenEbene, number>;
  for (const z of zeilen) for (const r of z.referenzen) nachEbene[r.ebene]++;

  const summe = (f: (z: BelegZeile) => number) => zeilen.reduce((n, z) => n + f(z), 0);

  return {
    schema_version: BELEGE_SCHEMA_VERSION,
    city,
    generator: 'lib/belege.ts/buildBelege',
    prozesse: zeilen,
    summary: {
      prozesse: zeilen.length,
      referenzen: summe((z) => z.summe.referenzen),
      verifiziert: summe((z) => z.summe.verifiziert),
      mitZitat: summe((z) => z.summe.mitZitat),
      hochrisiko: zeilen.filter((z) => z.hochrisiko).length,
      nachEbene,
    },
  };
}

/** Kanonische Serialisierung — die EINE Stelle, die das Dateiformat festlegt
 *  (2-Space-Indent + abschliessender Newline). Generator UND Drift-Check nutzen
 *  ausschliesslich diese Funktion. */
export function serializeBelege(belege: Belege): string {
  return JSON.stringify(belege, null, 2) + '\n';
}
