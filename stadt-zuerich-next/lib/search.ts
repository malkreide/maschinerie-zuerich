// Lebenslagen-Suche mit gewichtetem Score (gleiche Logik wie Prototyp).

import type { Lebenslage } from '@/types/stadt';

export function searchLebenslagen(q: string, all: Lebenslage[]): Lebenslage[] {
  if (!q.trim()) return [];
  const needle = q.trim().toLowerCase();
  const scored: { l: Lebenslage; score: number }[] = [];
  for (const l of all) {
    let score = 0;
    if (l.frage.toLowerCase().includes(needle)) score += 3;
    if (l.antwort?.toLowerCase().includes(needle)) score += 1;
    for (const w of l.stichworte) {
      const wl = w.toLowerCase();
      if (wl === needle) score += 5;
      else if (wl.includes(needle)) score += 2;
    }
    if (score) scored.push({ l, score });
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, 6).map((x) => x.l);
}

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
