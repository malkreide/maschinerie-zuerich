// Wochenbefund: Ebene 2 der Ansicht «Belege & Herkunft»
// (docs/plan-belege-herkunft.md, Phase P3). Das gemessene Ergebnis des
// Wochenlaufs (.github/workflows/link-rot.yml) je bindender Reference: Ist der
// Link erreichbar, steht das Zitat noch wörtlich auf der Seite, gilt die
// verlinkte Gesetzesfassung noch?
//
// Anders als das Belege-Aggregat (lib/belege.ts) ist das ein SNAPSHOT mit
// Zeitstempel — gemessen, nicht abgeleitet. Er kommt per Bot-PR nach main,
// den ein Mensch merged (Entscheid E3), und wird nur neu geschrieben, wenn
// sich der Inhalt ändert (inhaltGleich).
//
// Ein Befund beschreibt genau EINE Fassung einer Reference (url +
// retrieved_at). Wurde die Reference seither geändert, gilt er nicht mehr
// (befundLeser → null): die View zeigt dann «nicht erhoben» statt eines
// veralteten Urteils. «blockiert» und «netzfehler» sind Umgebungsbefunde,
// nie Datenfehler — sie werden nie als «tot» dargestellt.
//
// Selbstständig gehalten (keine Imports), damit die Funktionen ohne
// Pfad-Alias-Auflösung testbar sind (node --test mit Type-Stripping) und im
// Generator-Skript wie in Next-Code laufen.

/** Schema-Version des Snapshots (schemas/befunde-schema.json). MAJOR-Bump
 *  bei Strukturänderung. */
export const BEFUNDE_SCHEMA_VERSION = '1.0.0';

export type Erreichbarkeit = 'ok' | 'tot' | 'blockiert' | 'netzfehler';
export type ZitatBefund = 'woertlich' | 'drift' | 'nicht-pruefbar';
export type FassungBefund = 'aktuell' | 'ueberholt' | 'nicht-pruefbar' | 'nicht-anwendbar';
export type Umgebung = 'github-actions' | 'lokal';

/** Befund zu genau einer Fassung einer Reference. */
export interface ReferenzBefund {
  slug: string; // city/id
  reference_id: number;
  /** geprüfte source_url */
  url: string;
  /** retrieved_at der Reference zum Zeitpunkt der Prüfung */
  retrieved_at: string;
  erreichbar: Erreichbarkeit;
  /** HTTP-Status; null, wenn keine Antwort kam (Netzfehler) */
  http_status: number | null;
  zitat: ZitatBefund;
  fassung: FassungBefund;
}

export interface Wochenbefund {
  schema_version: string;
  city: string;
  /** ISO-Zeitpunkt des Laufs, der den aktuellen Stand festgestellt hat */
  erhoben_am: string;
  /** Link auf den GitHub-Actions-Lauf (Nachvollziehbarkeit) */
  lauf_url: string | null;
  /** Prüfumgebung; einzelne Behörden sperren GitHub-IPs, darum ist
   *  «blockiert» ein Umgebungs-, kein Datenbefund. */
  umgebung: Umgebung;
  referenzen: ReferenzBefund[];
}

/** Rohergebnis je URL aus scripts/check-links.mjs --befund-json. */
export interface LinkErgebnis {
  url: string;
  kind: Erreichbarkeit;
  status: number;
}

/** Rohergebnis je Reference aus scripts/extract-quotes.mjs --befund-json. */
export interface DriftErgebnis {
  datei: string;
  reference_id: number;
  url: string;
  zitat: ZitatBefund;
  fassung: FassungBefund;
}

/** Stand einer Reference in den Prozessdaten zum Zeitpunkt der Prüfung. */
export interface ReferenzStand {
  datei: string; // data/prozesse/<city>/<id>.json — wie im Drift-Bericht
  slug: string;
  reference_id: number;
  url: string;
  retrieved_at: string;
}

export interface WochenbefundEingabe {
  city: string;
  erhobenAm: string;
  laufUrl: string | null;
  umgebung: Umgebung;
  links: LinkErgebnis[];
  drift: DriftErgebnis[];
  referenzen: ReferenzStand[];
}

const schluessel = (slug: string, referenceId: number) => `${slug}#${referenceId}`;

/** Führt Link- und Drift-Bericht je Reference zusammen. Nur vollständig
 *  geprüfte References kommen in den Befund (Link UND Zitat geprüft, und der
 *  Drift-Bericht hat dieselbe URL geprüft) — Fehlendes bleibt «nicht erhoben»,
 *  statt geraten zu werden. Rein und deterministisch (sortiert). */
export function buildWochenbefund(e: WochenbefundEingabe): Wochenbefund {
  const linkByUrl = new Map(e.links.map((l) => [l.url, l]));
  const driftByDatei = new Map(e.drift.map((d) => [`${d.datei}#${d.reference_id}`, d]));

  const referenzen: ReferenzBefund[] = [];
  for (const r of e.referenzen) {
    const l = linkByUrl.get(r.url);
    const d = driftByDatei.get(`${r.datei}#${r.reference_id}`);
    if (!l || !d || d.url !== r.url) continue;
    referenzen.push({
      slug: r.slug,
      reference_id: r.reference_id,
      url: r.url,
      retrieved_at: r.retrieved_at,
      erreichbar: l.kind,
      http_status: l.status > 0 ? l.status : null,
      zitat: d.zitat,
      fassung: d.fassung,
    });
  }
  referenzen.sort((a, b) => a.slug.localeCompare(b.slug) || a.reference_id - b.reference_id);

  return {
    schema_version: BEFUNDE_SCHEMA_VERSION,
    city: e.city,
    erhoben_am: e.erhobenAm,
    lauf_url: e.laufUrl,
    umgebung: e.umgebung,
    referenzen,
  };
}

/** Inhaltlich gleich = gleiche Befunde, unabhängig davon, wann, wo und in
 *  welchem Lauf sie erhoben wurden. Nur bei Ungleichheit wird der Snapshot
 *  neu geschrieben (und ein Bot-PR geöffnet). */
export function inhaltGleich(a: Wochenbefund, b: Wochenbefund): boolean {
  const kern = (w: Wochenbefund) => JSON.stringify([w.schema_version, w.city, w.referenzen]);
  return kern(a) === kern(b);
}

/** Anteil der URLs ohne Antwort. Ein hoher Anteil heisst: der Lauf selbst
 *  war gestört (Netz, Proxy) — sein Ergebnis taugt nicht als Befund. */
export function netzfehlerAnteil(links: LinkErgebnis[]): number {
  if (links.length === 0) return 1;
  return links.filter((l) => l.kind === 'netzfehler').length / links.length;
}

/** Liefert eine Lesefunktion: Befund zu einer Reference, aber nur, wenn er
 *  für genau diese Fassung (url + retrieved_at) erhoben wurde; sonst null. */
export function befundLeser(w: Wochenbefund | null) {
  const index = new Map((w?.referenzen ?? []).map((r) => [schluessel(r.slug, r.reference_id), r]));
  return (ref: { slug: string; reference_id: number; url: string; retrieved_at: string }): ReferenzBefund | null => {
    const b = index.get(schluessel(ref.slug, ref.reference_id));
    if (!b || b.url !== ref.url || b.retrieved_at !== ref.retrieved_at) return null;
    return b;
  };
}

/** Zählung über eine Menge von References (eine Zeile der Belegmatrix oder
 *  alle). Ohne gültigen Befund zählt eine Reference als «offen», nie als ok;
 *  «blockiert»/«netzfehler» ebenfalls offen, nie tot (linkGesperrt ist die
 *  Teilmenge davon, die geantwortet bzw. es versucht hat). */
export interface BefundZaehlung {
  referenzen: number;
  linkOk: number;
  linkTot: number;
  linkOffen: number;
  linkGesperrt: number;
  zitatWoertlich: number;
  zitatDrift: number;
  zitatOffen: number;
  gesetze: number;
  fassungAktuell: number;
  fassungUeberholt: number;
  fassungOffen: number;
}

export function zaehleBefunde(refs: { gesetzesfassung: boolean; befund: ReferenzBefund | null }[]): BefundZaehlung {
  const z: BefundZaehlung = {
    referenzen: 0,
    linkOk: 0,
    linkTot: 0,
    linkOffen: 0,
    linkGesperrt: 0,
    zitatWoertlich: 0,
    zitatDrift: 0,
    zitatOffen: 0,
    gesetze: 0,
    fassungAktuell: 0,
    fassungUeberholt: 0,
    fassungOffen: 0,
  };
  for (const { gesetzesfassung, befund: b } of refs) {
    z.referenzen++;
    if (b?.erreichbar === 'ok') z.linkOk++;
    else if (b?.erreichbar === 'tot') z.linkTot++;
    else {
      z.linkOffen++;
      if (b) z.linkGesperrt++;
    }
    if (b?.zitat === 'woertlich') z.zitatWoertlich++;
    else if (b?.zitat === 'drift') z.zitatDrift++;
    else z.zitatOffen++;
    if (gesetzesfassung) {
      z.gesetze++;
      if (b?.fassung === 'aktuell') z.fassungAktuell++;
      else if (b?.fassung === 'ueberholt') z.fassungUeberholt++;
      else z.fassungOffen++;
    }
  }
  return z;
}

/** Kanonische Serialisierung (2-Space-Indent + Newline). */
export function serializeWochenbefund(w: Wochenbefund): string {
  return JSON.stringify(w, null, 2) + '\n';
}
