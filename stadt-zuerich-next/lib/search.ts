// Lebenslagen-Suche mit gewichtetem Score, locale-aware.
// Fehlt der angefragte Locale (null), fällt die Resolution auf 'de' zurück.

import type { Lebenslage, LebenslageLocale, LebenslageHit } from '@/types/stadt';

export function resolveContent(l: Lebenslage, locale: LebenslageLocale = 'de') {
  return l.i18n[locale] ?? l.i18n.de ?? null;
}

export function searchLebenslagen(
  q: string,
  all: Lebenslage[],
  locale: LebenslageLocale = 'de',
): LebenslageHit[] {
  if (!q.trim()) return [];
  const needle = q.trim().toLowerCase();
  const scored: { hit: LebenslageHit; score: number }[] = [];
  for (const l of all) {
    const c = resolveContent(l, locale);
    if (!c) continue;
    let score = 0;
    if (c.frage.toLowerCase().includes(needle)) score += 3;
    if (c.antwort?.toLowerCase().includes(needle)) score += 1;
    for (const w of c.stichworte) {
      const wl = w.toLowerCase();
      if (wl === needle) score += 5;
      else if (wl.includes(needle)) score += 2;
    }
    if (score) scored.push({ hit: { ...l, ...c }, score });
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, 6).map((x) => x.hit);
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
