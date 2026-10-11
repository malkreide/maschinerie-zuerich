// Zitat-Drift-Prüfung für Bestandsdaten — Kern von
// `extract-quotes.mjs --drift-report` (wöchentlich im Link-Rot-Workflow).
//
// Warum: Das Referenzen-Gate (check-refs-gate.mjs) prüft nur References, die
// ein PR neu hinzufügt oder ändert. Der Link-Rot-Lauf prüft nur, ob eine URL
// antwortet. Formuliert eine Quellseite um, steht ein bestehendes
// source_quote nicht mehr wörtlich dort — und niemand merkt es. Genau diese
// Lücke schliesst der Drift-Bericht: er prüft ALLE References wörtlich und
// zeigt bei Abweichung den ähnlichsten Satz der Seite, damit ein Mensch das
// Zitat neu setzen kann. Er schreibt nie in die Daten.

import { normWs } from './html-text.mjs';

// Unterhalb dieser Textlänge gilt eine Seite als «nicht prüfbar» (JS-SPA),
// gleiche Schwelle wie im Referenzen-Gate.
export const MIN_PAGE_TEXT = 200;

// Seiten, die ihren Inhalt erst per JavaScript laden, liefern statt des
// Inhalts einen Hinweistext (z. B. fedlex). Das ist keine Drift.
const JS_HINWEIS = /javascript-fähigen Browser|enable JavaScript|JavaScript (?:aktivieren|einschalten)/i;

const woerter = (s) => new Set(s.toLowerCase().match(/[a-zäöüéèàâçß0-9]{3,}/g) ?? []);

/**
 * Satz der Seite mit dem grössten Anteil an Wörtern des Zitats.
 * @returns {{ satz: string, anteil: number }} anteil 0…1 (1 = alle Zitatwörter kommen vor)
 */
export function aehnlichsterSatz(pageText, quote) {
  const qw = woerter(quote);
  if (!qw.size) return { satz: '', anteil: 0 };
  let best = { satz: '', anteil: 0 };
  for (const satz of normWs(pageText).split(/(?<=[.!?])\s+/)) {
    const sw = woerter(satz);
    let treffer = 0;
    for (const w of qw) if (sw.has(w)) treffer++;
    const anteil = treffer / qw.size;
    if (anteil > best.anteil || (anteil === best.anteil && best.satz && satz.length < best.satz.length)) {
      best = { satz, anteil };
    }
  }
  return best;
}

/**
 * Prüft ein source_quote gegen den Seitentext.
 * @returns {{ status: 'woertlich' }
 *   | { status: 'ohne-zitat' }
 *   | { status: 'nicht-pruefbar', grund: string }
 *   | { status: 'drift', aehnlich: string, anteil: number }}
 */
export function pruefeZitat(pageText, quote) {
  const q = normWs(quote ?? '');
  if (!q) return { status: 'ohne-zitat' };
  const text = normWs(pageText ?? '');
  if (text.includes(q)) return { status: 'woertlich' };
  if (text.length < MIN_PAGE_TEXT) {
    return { status: 'nicht-pruefbar', grund: `Seite liefert kaum Text (${text.length} Zeichen, JS-SPA?)` };
  }
  if (JS_HINWEIS.test(text)) {
    return { status: 'nicht-pruefbar', grund: 'Seite lädt ihren Inhalt per JavaScript' };
  }
  const { satz, anteil } = aehnlichsterSatz(text, q);
  return { status: 'drift', aehnlich: satz, anteil };
}
