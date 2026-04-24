// DataSourceAdapter — die Stelle, an der eine Stadt ihre eigenen Datenquellen
// ans Projekt andockt. Alles, was HTTP-Endpunkte/Feldnamen kennt, lebt in
// einem Adapter unter `scripts/adapters/<cityId>.mjs`. Die generischen
// Entry-Point-Scripts (fetch-struct, fetch-budget, build-data) wissen
// absichtlich nichts über einzelne Städte — sie laden den Adapter für die
// in config/city.config.json gesetzte `id` und rufen dessen Methoden.
//
// So schaut der Kontrakt aus (TypeScript-ähnliche JSDoc, damit es auch ohne
// Build-Step lesbar ist):
//
//   /**
//    * @typedef {Object} DataSourceAdapter
//    * @property {string} id
//    *   Stadt-ID, muss mit city.config.json.id übereinstimmen.
//    *
//    * @property {(opts: { force?: boolean }) => Promise<void>} [fetchStructure]
//    *   Holt die strukturelle Org-Hierarchie (Departemente, Einheiten) vom
//    *   API der Stadt und cacht die Rohantwort unter data/raw/… .
//    *   Optional — wenn die Stadt keine strukturierte API anbietet, weglassen
//    *   und die org-chart.json von Hand pflegen.
//    *
//    * @property {(opts: { force?: boolean, jahr?: number, betragstyp?: string })
//    *            => Promise<void>} [fetchBudget]
//    *   Holt Budget-/Rechnungszahlen pro Organisationseinheit und cacht sie.
//    *   Optional.
//    *
//    * @property {Array<[string, () => Promise<void>]>} [pipeline]
//    *   Reihenfolge der Schritte, die `build-data.mjs` ausführt. Jeder Eintrag
//    *   ist ein [Anzeigename, Ausführungs-Funktion]-Paar. Die Funktion
//    *   bekommt kein Objekt — Force-Flag etc. werden über Closures im
//    *   Adapter selbst gebunden (siehe zh.mjs).
//    */
//
// Adding a new city:
//   1. Lege scripts/adapters/<cityId>.mjs mit den Methoden oben an.
//   2. Setze `id` in config/city.config.json auf <cityId>.
//   3. Ergänze data/<cityId>/org-chart.json + lebenslagen.json.
//   4. `npm run data:fetch` zieht die Daten über deinen Adapter.

import { CITY_CONFIG } from '../_lib.mjs';

/** Lädt den Adapter für die aktuell konfigurierte Stadt.
 *  Dynamic-Import, damit nicht-benutzte Adapter nicht geladen werden
 *  (spart Startup-Zeit und vermeidet, dass ein kaputter Fremdstadt-Adapter
 *  die ZH-Pipeline bricht). */
export async function loadAdapter(cityId = CITY_CONFIG.id) {
  let mod;
  try {
    mod = await import(`./${cityId}.mjs`);
  } catch (err) {
    throw new Error(
      `Kein Adapter für city.id="${cityId}" gefunden.\n` +
      `Erwarteter Pfad: scripts/adapters/${cityId}.mjs\n` +
      `Siehe scripts/adapters/index.mjs für den Kontrakt.\n` +
      `Ursache: ${err.message}`
    );
  }
  const adapter = mod.default ?? mod;
  if (adapter.id && adapter.id !== cityId) {
    throw new Error(
      `Adapter-ID-Konflikt: city.config.json sagt "${cityId}", ` +
      `scripts/adapters/${cityId}.mjs meldet sich als "${adapter.id}".`
    );
  }
  return adapter;
}
