// Verhältnismässigkeit: 120 Mio CHF sind für die meisten Bürger:innen abstrakt.
// Dieser Helper rechnet einen CHF-Betrag in zwei greifbarere Grössen um:
//   • Pro-Kopf:  amount / Einwohnerzahl  → "≈ 270 CHF / Einwohner"
//   • Anteil:    amount / Stadt-Total    → "1.4 % des Gesamtbudgets"
//
// `computeTotalAufwand` liefert den Bezugswert für die Anteils-Anzeige.
// Wir summieren bewusst auf Unit-Ebene und nicht auf Department-Ebene:
// Department-Aufwände sind in den Daten teils nur aggregiert oder fehlen,
// die Treemap rechnet ebenfalls aus Unit-Werten — so bleibt die Anteils-
// Berechnung konsistent zwischen Treemap-Tooltip und Detail-Panel.

import type { StadtData } from '@/types/stadt';

export interface BudgetContext {
  /** Gesamtsumme `aufwand` aller Units, in CHF. 0 wenn keine Daten. */
  totalAufwand: number;
  /** Bevölkerungszahl aus city.config; undefined wenn nicht gepflegt. */
  population: number | undefined;
}

export function computeTotalAufwand(data: StadtData): number {
  let total = 0;
  for (const u of data.units) {
    const a = u.budget?.aufwand;
    if (typeof a === 'number' && a > 0) total += a;
  }
  return total;
}

/**
 * Stadt-weiter Netto-Aufwand (Aufwand minus Ertrag) — Bezugswert für die
 * Anteils-Anzeige beim Nettoaufwand. Im Gegensatz zum Brutto-Aufwand kann
 * der Netto-Wert pro Einheit auch negativ sein (Ertrags-Überschuss); wir
 * summieren trotzdem alle Einheiten, weil das die ehrlichste Bezugsgrösse
 * ist: Stadt-Netto = Summe über alle Einheits-Netto-Werte.
 */
export function computeTotalNettoaufwand(data: StadtData): number {
  let total = 0;
  for (const u of data.units) {
    const n = u.budget?.nettoaufwand;
    if (typeof n === 'number') total += n;
  }
  return total;
}

// ─── Formatter ──────────────────────────────────────────────────────────────

// Schweizer Tausender-Trennung mit Apostroph, ohne Bruchstellen — passt zum
// bereits etablierten `fmtCHF`. Lokale Locale ('de-CH') liefert auch
// Apostrophe; explizit gesetzt, damit das Format unabhängig vom Browser ist.
const CH = new Intl.NumberFormat('de-CH', { maximumFractionDigits: 0 });

/**
 * Formatiert einen CHF-Betrag pro Einwohner. Liefert null, wenn die
 * Bevölkerungszahl fehlt oder der Betrag null/undefined ist — die UI
 * rendert in diesem Fall einfach keine Pro-Kopf-Zeile.
 */
export function perCapitaCHF(
  amount: number | null | undefined,
  population: number | undefined,
): string | null {
  if (amount == null || !population || population <= 0) return null;
  const v = amount / population;
  // Sehr kleine Beträge (< 1 CHF/Einwohner) werden gerundet zu 0 und
  // vermitteln den falschen Eindruck "kostet nichts". Wir geben in dem
  // Fall lieber eine explizite Untergrenze aus.
  if (v > 0 && v < 1) return '< 1 CHF';
  if (v < 0 && v > -1) return '> -1 CHF';
  return `${CH.format(Math.round(v))} CHF`;
}

/**
 * Formatiert den Anteil eines Betrags am Gesamt-Aufwand als Prozent. Liefert
 * null, wenn kein Total bekannt ist oder der Anteil 0 % beträgt — wir
 * vermeiden eine "0.0 %"-Zeile, die den Eindruck erwecken würde, der Posten
 * sei vernachlässigbar, wo er einfach keine Daten hat.
 */
export function budgetSharePercent(
  amount: number | null | undefined,
  total: number,
): string | null {
  if (amount == null || total <= 0) return null;
  const p = (amount / total) * 100;
  if (p > 0 && p < 0.1) return '< 0.1';
  return p.toFixed(1);
}
