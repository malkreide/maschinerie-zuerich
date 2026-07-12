// Privacy-by-design-Normalisierung für Nulltreffer-Suchbegriffe.
//
// Zweck (Strategie: "kein Treffer" als Backlog-Signal, ohne Personendaten):
// Wenn eine Suche keine Lebenslage findet, ist der (anonymisierte) Begriff
// ein wertvolles Signal dafür, welche Anliegen in der App fehlen. Damit das
// datenschutzkonform bleibt, läuft jeder Begriff durch diese Funktion:
//
//  - keine Speicherung von IP, User-Agent, Session — nur der Begriff selbst
//  - Begriffe, die wie Personendaten aussehen, werden VERWORFEN (null):
//    E-Mail-Adressen, lange Ziffernfolgen (Telefon/AHV/Fallnummern)
//  - zu kurze (Rauschen) und zu lange (vermutlich eingefügte PII) Eingaben
//    werden ebenfalls verworfen
//
// Reine Funktion ohne Seiteneffekte — bewusst getrennt von der Route, damit
// sie unabhängig testbar ist (siehe scripts/probe-search-miss.mjs).

export const MISS_MIN_LEN = 3;
export const MISS_MAX_LEN = 60;

// Ab 5 Ziffern insgesamt → vermutlich Telefon-, AHV- oder Fallnummer.
// Gesamtzahl statt zusammenhängender Lauf, damit auch getrennte Formate wie
// "756.1234.5678.97" (AHV) oder "079 123 45 67" greifen. Alltagsbegriffe wie
// "tempo 30" oder "kreis 12" haben < 5 Ziffern und bleiben erhalten.
const MAX_DIGITS = 5;

/**
 * Normalisiert einen Such-Begriff für anonymes Nulltreffer-Logging.
 * Gibt den bereinigten Begriff zurück oder `null`, wenn er verworfen werden
 * soll (zu kurz/lang oder potenziell personenbezogen).
 */
export function normalizeMissQuery(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;

  // Unicode normalisieren, Whitespace verdichten, klein schreiben.
  let q = raw.normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase();
  // Satzzeichen an den Rändern entfernen (z.B. "«pass»" → "pass").
  q = q.replace(/^[^\p{L}\d]+|[^\p{L}\d]+$/gu, '');

  if (q.length < MISS_MIN_LEN || q.length > MISS_MAX_LEN) return null;
  if (q.includes('@')) return null; // E-Mail-Adressen
  if ((q.match(/\d/g)?.length ?? 0) >= MAX_DIGITS) return null; // PII-Verdacht

  return q;
}
