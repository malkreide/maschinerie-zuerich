// Geprüfte Ausnahmen für den Prozess-Regression-Guard
// (scripts/check-prozess-regression.mjs).
//
// Warum: manche Reduktionen sind gewollt — z. B. zwei inhaltlich doppelte
// Dokument-Einträge werden zu einem zusammengeführt. Der Guard zählt dann
// einen Text weniger, obwohl nichts verloren geht. Die Umgebungs-Escape-Hatch
// ALLOW_PROZESS_SHRINK ist in der CI bewusst nicht gesetzt; statt sie per
// Workflow zu injizieren, wird jede einzelne Reduktion hier im Repo erfasst
// und durch CODEOWNERS-Review freigegeben (config/regression-ausnahmen.json).
//
// Eng gefasst, damit eine Ausnahme nichts anderes durchwinkt:
//   • gilt nur für die Abdeckungs-Zählung, nie für Feld-Verluste (ein zuvor
//     belegtes Feld verliert eine Locale) und nie für source_quote-Erosion;
//   • gilt pro Datei und Locale nur für den exakten Übergang «von → auf».
//     Nach dem Merge ist «von» nicht mehr die Basis — der Eintrag greift
//     ab dann nie wieder und kann entfernt werden;
//   • alle Verluste der Datei müssen abgedeckt sein, und jede im Eintrag
//     genannte Locale muss genau so eintreten — sonst greift er nicht.

/**
 * @typedef {{ von: number, auf: number }} Uebergang
 * @typedef {{ datei: string, abdeckung: Record<string, Uebergang>, begruendung: string, pr?: number }} Ausnahme
 */

/** Prüft die Struktur der Ausnahmeliste; liefert Fehlertexte (leer = ok). */
export function validiereAusnahmen(doc) {
  const fehler = [];
  const liste = doc?.ausnahmen;
  if (!Array.isArray(liste)) return ['«ausnahmen» muss ein Array sein'];
  liste.forEach((a, i) => {
    const wo = `ausnahmen[${i}]`;
    if (typeof a?.datei !== 'string' || !a.datei.startsWith('data/prozesse/')) {
      fehler.push(`${wo}.datei: Pfad relativ zu stadt-zuerich-next, beginnend mit data/prozesse/`);
    }
    if (typeof a?.begruendung !== 'string' || a.begruendung.trim().length < 20) {
      fehler.push(`${wo}.begruendung: Pflicht, mindestens 20 Zeichen`);
    }
    const ab = a?.abdeckung;
    if (!ab || typeof ab !== 'object' || Object.keys(ab).length === 0) {
      fehler.push(`${wo}.abdeckung: mindestens eine Locale`);
      return;
    }
    for (const [loc, u] of Object.entries(ab)) {
      if (!Number.isInteger(u?.von) || !Number.isInteger(u?.auf) || !(u.auf < u.von) || u.auf < 0) {
        fehler.push(`${wo}.abdeckung.${loc}: { von, auf } ganze Zahlen mit auf < von`);
      }
    }
  });
  return fehler;
}

/**
 * Sucht die Ausnahme, die die Regression einer Datei vollständig abdeckt.
 * @param {string} datei  Pfad relativ zu stadt-zuerich-next (data/prozesse/…)
 * @param {{ fieldLosses: unknown[], covLosses: {loc: string, base: number, head: number}[],
 *           quoteLosses: unknown[], quoteCountLoss: unknown }} befund
 * @param {Ausnahme[]} ausnahmen
 * @returns {Ausnahme | null}
 */
export function passendeAusnahme(datei, befund, ausnahmen) {
  if (befund.fieldLosses.length || befund.quoteLosses.length || befund.quoteCountLoss) return null;
  if (!befund.covLosses.length) return null;
  const verluste = new Map(befund.covLosses.map((c) => [c.loc, c]));
  for (const a of ausnahmen) {
    if (a.datei !== datei) continue;
    const locs = Object.keys(a.abdeckung);
    if (locs.length !== verluste.size) continue;
    const deckt = locs.every((loc) => {
      const v = verluste.get(loc);
      return v && v.base === a.abdeckung[loc].von && v.head === a.abdeckung[loc].auf;
    });
    if (deckt) return a;
  }
  return null;
}
