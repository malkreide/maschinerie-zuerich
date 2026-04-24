// Lebenslagen-Suche, locale-aware, typo-tolerant, jargon-überbrückend.
//
// Zwei Tricks kombiniert:
//
//  1. Synonym-Cluster (config/synonyms/<locale>.json) — für jede Lebenslage
//     erweitern wir die indexierten Token um alle Cluster-Kollegen der
//     Begriffe, die schon in frage/antwort/stichworte stehen. Effekt:
//     wer "Hochzeit" tippt, landet bei der Lebenslage, die "heirat" in
//     stichworte führt, ohne dass irgendwer das Wort "Hochzeit" manuell
//     eingetragen hat.
//
//  2. Fuse.js (Bitap-Fuzzy-Search) — gewichtete Multi-Feld-Suche mit
//     Tippfehler-Toleranz. "Abfal" findet "abfall", "pas verliren" findet
//     die Pass-Lebenslage. Threshold ist so gewählt, dass Tippfehler
//     verziehen werden, aber komplett fremde Wörter nicht durchrutschen.
//
// Caching: Fuse-Index wird pro (Lebenslagen-Array, Locale) einmalig gebaut
// und in einer WeakMap zwischengespeichert. Zur Laufzeit (sowohl im Browser
// pro Keystroke als auch auf dem Server pro Request) läuft dann nur noch
// die eigentliche Suche — der Index-Aufbau amortisiert sich über viele
// Queries.

import Fuse, { type IFuseOptions } from 'fuse.js';
import type { Lebenslage, LebenslageLocale, LebenslageHit } from '@/types/stadt';
import synonymsDe from '@/config/synonyms/de.json';

// Maximale Anzahl Treffer — identisch zum Vorverhalten.
const MAX_HITS = 6;

// Fuse-Threshold: 0 = identisch, 1 = alles matcht. 0.35 ist so die Grenze,
// bei der 1–2 Tippfehler auf 6-Zeichen-Wörtern noch durchgehen, komplett
// andere Begriffe aber nicht mehr matchen. Empirisch getestet mit
// "Abfal"/"Hochzit"/"Pas verliren".
const FUSE_THRESHOLD = 0.35;

// ─── Synonym-Expansion ──────────────────────────────────────────────────────

type SynonymCluster = { concept?: string; terms: string[] };
type SynonymDict = { clusters: SynonymCluster[] };

// Welche Locales haben ein Dictionary? en/fr/it/ls später nachziehen.
// JSON-Imports in Next.js brauchen keinen expliziten Typ-Cast, wir bleiben
// aber sauber, damit TS die Shape prüft.
const SYNONYM_DICTS: Partial<Record<LebenslageLocale, SynonymDict>> = {
  de: synonymsDe as SynonymDict,
};

// Term → Set mit allen zugehörigen Cluster-Geschwistern (alle anderen
// Terme desselben Clusters). Ein Term darf in mehreren Clustern vorkommen,
// dann vereinigt das Set die Geschwister aus beiden.
type SynonymIndex = Map<string, Set<string>>;

function buildSynonymIndex(dict: SynonymDict | undefined): SynonymIndex {
  const idx: SynonymIndex = new Map();
  if (!dict) return idx;
  for (const cluster of dict.clusters) {
    const norm = cluster.terms.map((t) => t.toLowerCase().trim()).filter(Boolean);
    for (const term of norm) {
      let siblings = idx.get(term);
      if (!siblings) {
        siblings = new Set();
        idx.set(term, siblings);
      }
      for (const other of norm) {
        if (other !== term) siblings.add(other);
      }
    }
  }
  return idx;
}

// Zerlegt einen beliebigen Text in Wort-Tokens (unicode-aware, damit
// Umlaute nicht verloren gehen). Wir brauchen Tokens, damit die
// Cluster-Lookup nur auf ganze Wörter matcht — sonst würde "er" halt
// in "Steuer" matchen und Müll expandieren.
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^\p{L}\d]+/u)
    .filter((t) => t.length > 1);
}

// Für einen Content-Block: alle Synonyme aller enthaltenen Tokens einsammeln.
// Doppelte werden durch das Set automatisch verdichtet.
function expandSynonyms(
  corpus: readonly string[],
  synIdx: SynonymIndex,
): string[] {
  if (synIdx.size === 0) return [];
  const expanded = new Set<string>();
  for (const piece of corpus) {
    for (const token of tokenize(piece)) {
      const siblings = synIdx.get(token);
      if (siblings) for (const s of siblings) expanded.add(s);
    }
  }
  return Array.from(expanded);
}

// ─── Content-Resolver ───────────────────────────────────────────────────────

export function resolveContent(l: Lebenslage, locale: LebenslageLocale = 'de') {
  return l.i18n[locale] ?? l.i18n.de ?? null;
}

// ─── Fuse-Index-Aufbau ──────────────────────────────────────────────────────

// Ein Suchdokument = LebenslageHit plus das berechnete _synonyms-Feld,
// das Fuse neben frage/antwort/stichworte als eigene gewichtete Spalte
// durchsucht. Wir re-exponieren via `LebenslageHit`-Cast nach aussen,
// damit Callers das _synonyms-Feld nicht sehen müssen.
type SearchDoc = LebenslageHit & { _synonyms: string[] };

const FUSE_OPTIONS: IFuseOptions<SearchDoc> = {
  keys: [
    { name: 'frage', weight: 0.45 },
    { name: 'stichworte', weight: 0.30 },
    { name: '_synonyms', weight: 0.20 },
    { name: 'antwort', weight: 0.05 },
  ],
  threshold: FUSE_THRESHOLD,
  // Mit ignoreLocation findet Fuse das Match egal wo im String —
  // sonst würde "recycling" in "ERZ – Entsorgung + Recycling Zürich"
  // weit hinten landen und gegen ein früher gematchtes Wort verlieren.
  ignoreLocation: true,
  // Unter 2 Zeichen ist Fuzzy-Matching sinnlos (jeder Buchstabe matcht).
  minMatchCharLength: 2,
  includeScore: true,
};

function buildDocs(all: Lebenslage[], locale: LebenslageLocale): SearchDoc[] {
  const synIdx = buildSynonymIndex(
    SYNONYM_DICTS[locale] ?? SYNONYM_DICTS.de,
  );
  const docs: SearchDoc[] = [];
  for (const l of all) {
    const c = resolveContent(l, locale);
    if (!c) continue;
    const corpus = [c.frage, c.antwort ?? '', ...c.stichworte];
    docs.push({ ...l, ...c, _synonyms: expandSynonyms(corpus, synIdx) });
  }
  return docs;
}

// WeakMap-Cache: pro Lebenslagen-Array-Referenz pro Locale eine Fuse-Instanz.
// Das Lebenslagen-Array kommt bei uns aus loadStadtData() und ist stabil
// über die Lebenszeit des Prozesses (server) bzw. der Page-Navigation
// (client). Der Cache verhindert, dass wir bei jedem Keystroke den Index
// neu bauen.
const fuseCache = new WeakMap<Lebenslage[], Map<LebenslageLocale, Fuse<SearchDoc>>>();

function getFuse(all: Lebenslage[], locale: LebenslageLocale): Fuse<SearchDoc> {
  let byLocale = fuseCache.get(all);
  if (!byLocale) {
    byLocale = new Map();
    fuseCache.set(all, byLocale);
  }
  let fuse = byLocale.get(locale);
  if (!fuse) {
    fuse = new Fuse(buildDocs(all, locale), FUSE_OPTIONS);
    byLocale.set(locale, fuse);
  }
  return fuse;
}

// ─── Öffentliche API (signatur-kompatibel zur Vorversion) ───────────────────

export function searchLebenslagen(
  q: string,
  all: Lebenslage[],
  locale: LebenslageLocale = 'de',
): LebenslageHit[] {
  const needle = q.trim();
  if (!needle) return [];
  const fuse = getFuse(all, locale);
  const results = fuse.search(needle, { limit: MAX_HITS });
  // SearchDoc extends LebenslageHit — das _synonyms-Feld bleibt dabei,
  // schadet aber nicht und wird von den UI-Komponenten ignoriert.
  return results.map((r) => r.item);
}

// ─── Formatter (unverändert) ────────────────────────────────────────────────

export function fmtCHF(v: number | null | undefined): string {
  if (v == null) return '—';
  return new Intl.NumberFormat('de-CH', { maximumFractionDigits: 0 }).format(Math.round(v)) + ' CHF';
}

export function fmtNumber(v: number | null | undefined): string {
  if (v == null) return '—';
  return new Intl.NumberFormat('de-CH', { maximumFractionDigits: 0 }).format(Math.round(v));
}

export function fmtMio(v: number): string {
  if (v >= 1e9) return (v / 1e9).toFixed(2) + ' Mrd';
  if (v >= 1e7) return (v / 1e6).toFixed(0) + ' Mio';
  return (v / 1e6).toFixed(1) + ' Mio';
}
