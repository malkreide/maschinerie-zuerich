// Abruf und Einordnung einer URL für den Live-Link-Check
// (scripts/check-links.mjs --online).
//
// Zwei Befunde aus dem Wochenlauf vom 13.10.2026 haben die Einordnung
// geschärft:
//   • www.amicus.ch beantwortet HEAD mit einer Weiterleitungsschleife
//     (/Account/Login → /Error/Error → …), GET dagegen mit 200. Ein HEAD,
//     das scheitert (Fehlerstatus, Schleife, Timeout), entscheidet darum nie
//     allein — es folgt immer ein GET.
//   • www.eumzugch.ch hat keinen DNS-Eintrag (die Domain gibt es nicht). Das
//     lief monatelang als «Netzfehler, kein Datenfehler» mit. Unbekannte
//     Domains zählen jetzt als tot — aber nur, wenn ein öffentlicher
//     DNS-Resolver das bestätigt (siehe dnsBefundeEinordnen).

export function classify(status) {
  if (status < 400) return 'ok';
  if (status === 404 || status === 410 || status >= 500) return 'tot';
  return 'blockiert'; // 401/403/429 u. ä.: Quelle lebt, lehnt diesen Client ab
}

/** Kurzer Grund eines fetch-Fehlers: Timeout, Fehlercode (ENOTFOUND, …) oder Meldung. */
export function fehlerGrund(err) {
  if (err?.name === 'TimeoutError') return 'Timeout';
  return err?.cause?.code ?? err?.cause?.message ?? err?.message ?? 'Fehler';
}

/**
 * Ruft eine URL ab: HEAD, bei jedem Scheitern GET.
 * @returns {Promise<{ url: string, kind: 'ok'|'tot'|'blockiert'|'netzfehler', status: number, reason?: string }>}
 */
export async function probeUrl(url, { fetch: doFetch = fetch, headers = {}, timeoutMs = 15000 } = {}) {
  const init = (method) => ({ method, headers, redirect: 'follow', signal: AbortSignal.timeout(timeoutMs) });
  try {
    let res = null;
    try {
      res = await doFetch(url, init('HEAD'));
    } catch {
      // HEAD gescheitert (Schleife, Timeout, Abbruch) → GET entscheidet
    }
    // Manche Server beantworten HEAD nicht sauber (405/501) → GET-Fallback.
    if (!res || res.status >= 400) res = await doFetch(url, init('GET'));
    return { url, kind: classify(res.status), status: res.status };
  } catch (err) {
    return { url, kind: 'netzfehler', status: 0, reason: fehlerGrund(err) };
  }
}

// Öffentliche DNS-over-HTTPS-Resolver (JSON-API). Der zweite springt ein,
// wenn der erste nicht antwortet.
const DOH = ['https://dns.google/resolve', 'https://cloudflare-dns.com/dns-query'];

/**
 * Fragt öffentliche Resolver, ob es den Host gibt.
 * @returns {Promise<boolean|null>} true = NXDOMAIN bestätigt, false = Host
 *   existiert, null = keine Antwort (abgeschottete Umgebung)
 */
export async function domainUnbekannt(host, { fetch: doFetch = fetch, timeoutMs = 10000 } = {}) {
  for (const resolver of DOH) {
    try {
      const res = await doFetch(`${resolver}?name=${encodeURIComponent(host)}&type=A`, {
        headers: { accept: 'application/dns-json' },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!res.ok) continue;
      const { Status } = await res.json();
      if (Status === 3) return true; // NXDOMAIN
      if (Status === 0) return false;
    } catch {
      // nächster Resolver
    }
  }
  return null;
}

/**
 * Unbekannte Domain (ENOTFOUND) → tot, wenn ein öffentlicher Resolver
 * NXDOMAIN bestätigt. Lokales ENOTFOUND allein reicht nicht: In
 * abgeschotteten Umgebungen (Allowlist) scheitert DNS auch für Hosts, die
 * es gibt. Antwortet kein Resolver, bleibt es beim Netzfehler.
 */
export async function dnsBefundeEinordnen(results, opts = {}) {
  const pruefung = new Map(); // host -> Promise<boolean|null>
  return Promise.all(
    results.map(async (r) => {
      if (r.kind !== 'netzfehler' || r.reason !== 'ENOTFOUND') return r;
      const host = new URL(r.url).hostname;
      if (!pruefung.has(host)) pruefung.set(host, domainUnbekannt(host, opts));
      return (await pruefung.get(host)) ? { ...r, kind: 'tot', reason: 'Domain unbekannt (NXDOMAIN)' } : r;
    }),
  );
}
