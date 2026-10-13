// Basisadressen in Konfigurationsdateien (check-links.mjs).
//
// Manche URLs sind keine Links, sondern Präfixe, an die die App Pfade hängt:
// der API-Endpunkt (`baseUrl`) oder die Raw-Adresse des Repos (`repoRawUrl`).
// Abgerufen liefern sie systembedingt 404/403 — der Live-Link-Check meldete
// sie Woche für Woche als «tot» bzw. «blockiert», ohne dass etwas kaputt war.
// Erkannt werden sie am JSON-Schlüssel, nicht an der URL: so bleibt dieselbe
// Adresse prüfpflichtig, sobald sie irgendwo als normaler Link steht.

/** Schlüssel, deren Wert eine Basisadresse ist: baseUrl, …BaseUrl, …RawUrl. */
export const BASIS_URL_KEY = /^(?:baseUrl|\w+BaseUrl|\w+RawUrl)$/;

/**
 * Zählt die Basisadressen in einem geparsten JSON-Dokument.
 * @returns {Map<string, number>} URL → Anzahl Vorkommen unter Basis-Schlüsseln
 */
export function zaehleBasisUrls(doc, out = new Map()) {
  const walk = (node) => {
    if (Array.isArray(node)) {
      node.forEach(walk);
    } else if (node && typeof node === 'object') {
      for (const [k, v] of Object.entries(node)) {
        if (typeof v === 'string' && BASIS_URL_KEY.test(k) && /^https?:\/\//.test(v)) {
          out.set(v, (out.get(v) ?? 0) + 1);
        } else {
          walk(v);
        }
      }
    }
  };
  walk(doc);
  return out;
}
