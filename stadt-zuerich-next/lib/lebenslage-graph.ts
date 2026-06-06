// N:M-Brücke Lebenslage ↔ Prozess ↔ Einheit(en).
//
// Leitet aus dem bestehenden Graphen ab, welche Einheiten eine Lebenslage
// betreffen (primär zuständige + alle Stellen aus den verlinkten Prozessen)
// und — umgekehrt — welche Lebenslagen eine Einheit betreffen. Rein abgeleitet,
// kein zusätzliches Datenfeld.

import type { Lebenslage } from '@/types/stadt';

/**
 * Alle an einer Lebenslage beteiligten Einheiten: primär zuständige Stelle
 * (zustaendig) plus alle Einheiten aus den verlinkten Prozessen
 * (akteure[].einheit_ref). Reihenfolge: zustaendig zuerst.
 */
export function involvedUnits(
  l: Lebenslage,
  prozessEinheiten: Record<string, string[]>,
): string[] {
  const ordered: string[] = [];
  const seen = new Set<string>();
  const add = (u?: string) => {
    if (u && !seen.has(u)) {
      seen.add(u);
      ordered.push(u);
    }
  };
  add(l.zustaendig);
  for (const slug of l.prozesse ?? []) for (const u of prozessEinheiten[slug] ?? []) add(u);
  return ordered;
}

/** unitId → Lebenslagen, die diese Einheit betreffen (N:M-Reverse). */
export function buildEinheitLebenslagenMap(
  lebenslagen: Lebenslage[],
  prozessEinheiten: Record<string, string[]>,
): Record<string, Lebenslage[]> {
  const map: Record<string, Lebenslage[]> = {};
  for (const l of lebenslagen) {
    for (const u of involvedUnits(l, prozessEinheiten)) {
      (map[u] ??= []).push(l);
    }
  }
  return map;
}
