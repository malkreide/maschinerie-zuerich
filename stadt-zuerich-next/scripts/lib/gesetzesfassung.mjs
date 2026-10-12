// Fassungs-Abgleich für Gesetzes-PDFs — Teil von
// `extract-quotes.mjs --drift-report` (wöchentlich im Link-Rot-Workflow).
//
// Warum: Belege auf Bundes- und Kantonsrecht verlinken das PDF EINER Fassung
// (fedlex: Konsolidierungsdatum im Pfad, ZHlex: Nachtragsnummer im
// Dateinamen). Ändert das Gesetz, bleibt der alte Link erreichbar und das
// Zitat steht weiter wörtlich darin — Link-Rot und Zitat-Drift melden nichts,
// die Maschinerie zeigt aber still auf einen überholten Stand. Dieser
// Abgleich fragt die amtliche Quelle nach der aktuell geltenden Fassung.
// Er schreibt nie in die Daten; ein Mensch prüft das Zitat in der neuen
// Fassung und setzt den Link neu.

const FEDLEX_PDF =
  /^https:\/\/fedlex\.data\.admin\.ch\/filestore\/fedlex\.data\.admin\.ch\/(eli\/[a-z]+\/[^/]+\/[^/]+)\/(\d{8})\/([a-z]{2})\/pdf-a\//;
// …/zhlex_r.nsf/WebView/<docid>/$File/631.1_8.6.97_132.pdf
const ZHLEX_PDF = /^https:\/\/www\.notes\.zh\.ch\/appl\/zhlex_r\.nsf\/WebView\/[^/]+\/\$File\/([\d.]+)_[^/]*_(\d+)\.pdf/;

const SPRACHE = { de: 'DEU', fr: 'FRA', it: 'ITA', en: 'ENG', rm: 'ROH' };
const isoDatum = (yyyymmdd) => `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;

/**
 * Welche Fassung verlinkt die URL?
 * @returns {{ quelle: 'fedlex', eli: string, datum: string, sprache: string }
 *   | { quelle: 'zhlex', ls: string, nachtrag: number } | null}
 */
export function erkenneFassung(url) {
  const f = FEDLEX_PDF.exec(url ?? '');
  if (f) return { quelle: 'fedlex', eli: f[1], datum: isoDatum(f[2]), sprache: f[3] };
  const z = ZHLEX_PDF.exec(url ?? '');
  if (z) return { quelle: 'zhlex', ls: z[1], nachtrag: Number(z[2]) };
  return null;
}

/** Schlüssel, unter dem eine Abfrage für mehrere References gilt. */
export const fassungsSchluessel = (f) => (f.quelle === 'fedlex' ? `fedlex:${f.eli}:${f.sprache}` : `zhlex:${f.ls}`);

/**
 * Aktuell geltende fedlex-Fassung (jüngstes dateApplicability ≤ heute) samt
 * PDF-A-URL, über den offiziellen SPARQL-Endpunkt.
 */
export async function aktuelleFedlexFassung(f, { fetch: doFetch = fetch, heute, headers = {} } = {}) {
  const query = `PREFIX jolux: <http://data.legilux.public.lu/resource/ontology/jolux#>
SELECT ?date ?url WHERE {
  ?cons jolux:isMemberOf <https://fedlex.data.admin.ch/${f.eli}> ;
        jolux:dateApplicability ?date ;
        jolux:isRealizedBy ?expr .
  ?expr jolux:language <http://publications.europa.eu/resource/authority/language/${SPRACHE[f.sprache] ?? 'DEU'}> ;
        jolux:isEmbodiedBy ?manif .
  ?manif jolux:isExemplifiedBy ?url .
  FILTER(CONTAINS(STR(?url), "/pdf-a/"))
} ORDER BY DESC(?date)`;
  const res = await doFetch('https://fedlex.data.admin.ch/sparqlendpoint', {
    method: 'POST',
    headers: { ...headers, 'content-type': 'application/x-www-form-urlencoded', accept: 'application/sparql-results+json' },
    body: new URLSearchParams({ query }),
  });
  if (!res.ok) throw new Error(`SPARQL ${res.status}`);
  const rows = (await res.json()).results.bindings.map((b) => ({ datum: b.date.value.slice(0, 10), url: b.url.value }));
  const gueltig = rows.find((r) => r.datum <= heute);
  if (!gueltig) throw new Error('keine geltende Fassung gefunden');
  return gueltig;
}

/**
 * Aktuelle ZHlex-Fassung: Die alte ZHlex-Adresse leitet immer auf die Seite
 * des aktuellen Nachtrags weiter (…/erlass-631_1-…-132.html).
 */
export async function aktuelleZhlexFassung(f, { fetch: doFetch = fetch, headers = {} } = {}) {
  const url = `http://www.zhlex.zh.ch/Erlass.html?Open&Ordnr=${f.ls}`;
  const res = await doFetch(url, { headers, redirect: 'follow' });
  if (!res.ok) throw new Error(`ZHlex ${res.status}`);
  const m = /-(\d+)\.html(?:$|[?#])/.exec(res.url);
  if (!m) throw new Error(`Nachtrag nicht erkennbar: ${res.url}`);
  return { nachtrag: Number(m[1]), url: res.url };
}

/**
 * Vergleicht die verlinkte mit der aktuellen Fassung. `opts.cache` (Map)
 * teilt die Abfrage der aktuellen Fassung zwischen References desselben
 * Erlasses.
 * @returns {Promise<{ status: 'aktuell' }
 *   | { status: 'veraltet', verlinkt: string, aktuell: string, neu: string }
 *   | { status: 'nicht-pruefbar', grund: string }>}
 */
export async function pruefeFassung(f, opts = {}) {
  const key = fassungsSchluessel(f);
  const abfrage = () => (f.quelle === 'fedlex' ? aktuelleFedlexFassung(f, opts) : aktuelleZhlexFassung(f, opts));
  if (opts.cache && !opts.cache.has(key)) opts.cache.set(key, abfrage());
  try {
    const a = await (opts.cache ? opts.cache.get(key) : abfrage());
    if (f.quelle === 'fedlex') {
      return a.datum === f.datum
        ? { status: 'aktuell' }
        : { status: 'veraltet', verlinkt: `Fassung vom ${f.datum}`, aktuell: `Fassung vom ${a.datum}`, neu: a.url };
    }
    // Nachtragsnummern steigen nicht streng mit der Zeit (ZHlex-Historie:
    // 127 gilt nach 131) — darum nur auf Gleichheit prüfen.
    return a.nachtrag === f.nachtrag
      ? { status: 'aktuell' }
      : { status: 'veraltet', verlinkt: `Nachtrag ${f.nachtrag}`, aktuell: `Nachtrag ${a.nachtrag}`, neu: a.url };
  } catch (err) {
    return { status: 'nicht-pruefbar', grund: err.message.split('\n')[0] };
  }
}
