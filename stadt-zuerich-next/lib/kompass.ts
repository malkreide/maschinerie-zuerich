// Prozess-Kompass: reine Ableitung einer strukturellen Diagnose aus einem
// bereits modellierten Prozess.
//
// Inspiriert vom «Kita-Kompass» (Avenir Suisse), der drei systemische
// Schwachstellen diagnostiziert: unklare Zuständigkeitsverteilung,
// bürokratische Überregulierung, ineffiziente Finanzierung. Diese drei
// Achsen bilden wir generisch über JEDEN Prozess ab — ausschliesslich aus
// vorhandenen, quellenbelegten Modelldaten.
//
// WICHTIG (Kardinalregel): hier entsteht KEIN bewerteter Index und KEINE
// bindende Zahl (Frist/Gebühr). Es werden nur strukturelle Merkmale des
// Modells gezählt (z.B. Anzahl beteiligter Behörden, Pflichtdokumente) —
// das sind Aussagen ÜBER unsere Darstellung, keine behaupteten Rechtswerte.

import type { Prozess, Actor, I18nString, Medienbruch } from '@/types/prozess';

export interface KompassReport {
  // Achse 1 — Zuständigkeit (Governance / geteilte Verantwortung)
  behoerden: Actor[];
  /** Akteure vom Typ 'gericht' (Rekurs-/Beschwerdeinstanz). */
  rekursinstanzen: Actor[];
  /** Akteure vom Typ 'fachstelle'. */
  fachstellen: Actor[];
  /** true, wenn mehr als eine Behörde beteiligt ist. */
  geteilteZustaendigkeit: boolean;

  // Achse 2 — Aufwand für Bürger:innen (Bürokratie)
  pflichtdokumente: number;
  medienbrueche: Medienbruch[];
  entscheidungspunkte: number;

  // Achse 3 — Vereinfachungs-Potenzial
  onceOnlyPotenzial?: I18nString;
  verbesserungenCount: number;
  painPointsCount: number;
}

export function buildKompass(p: Prozess): KompassReport {
  const actors = p.actors ?? [];
  const behoerden = actors.filter((a) => a.type === 'behoerde');
  const rekursinstanzen = actors.filter((a) => a.type === 'gericht');
  const fachstellen = actors.filter((a) => a.type === 'fachstelle');

  let pflichtdokumente = 0;
  let entscheidungspunkte = 0;
  for (const s of p.steps ?? []) {
    if (s.type === 'entscheidung') entscheidungspunkte++;
    for (const d of s.documents ?? []) {
      if (d.required) pflichtdokumente++;
    }
  }

  return {
    behoerden,
    rekursinstanzen,
    fachstellen,
    geteilteZustaendigkeit: behoerden.length >= 2,
    pflichtdokumente,
    medienbrueche: p.reife?.medienbrueche ?? [],
    entscheidungspunkte,
    onceOnlyPotenzial: p.reife?.onceOnlyPotenzial,
    verbesserungenCount: p.reife?.improvementIdeas?.length ?? 0,
    painPointsCount: p.reife?.painPoints?.length ?? 0,
  };
}

/** Enthält der Report überhaupt diagnostizierbaren Inhalt? Steuert, ob der
 *  Kompass gerendert wird (sonst kein leeres Gerüst zeigen). */
export function kompassHatInhalt(k: KompassReport): boolean {
  return (
    k.behoerden.length > 0 ||
    k.rekursinstanzen.length > 0 ||
    k.fachstellen.length > 0 ||
    k.pflichtdokumente > 0 ||
    k.medienbrueche.length > 0 ||
    Boolean(k.onceOnlyPotenzial) ||
    k.verbesserungenCount > 0
  );
}
