// Gemeinsame Darstellung eines Erfüllungs-Status (✓ / ✕ / ?) für Tabellen-
// zellen — genutzt von der Portfolio-Heatmap und der Belegmatrix (/belege).
//
// Barrierefreiheit (nicht verhandelbar): Farbe ist NIE die alleinige
// Information. Jede Zelle trägt zusätzlich ein Symbol und einen sr-only-Text;
// «unbekannt» hat eine eigene Schraffur (Textur statt nur Farbe) und wird nie
// als «nicht erfüllt» dargestellt.

import type { CSSProperties } from 'react';
import type { IndikatorStatus } from './bewertung';

export const STATUS_SYMBOL: Record<IndikatorStatus, string> = {
  erfuellt: '✓',
  'nicht-erfuellt': '✕',
  unbekannt: '?',
};

// Gezählte (Score-relevante) Indikatoren: voller Farb-Code.
export const STATUS_CELL: Record<IndikatorStatus, string> = {
  erfuellt: 'bg-green-100 text-green-900',
  'nicht-erfuellt': 'bg-amber-100 text-amber-900',
  unbekannt: 'text-[var(--color-mute)]',
};

// «unbekannt» bekommt zusätzlich eine diagonale Schraffur — als Textur, damit
// es auch ohne Farbwahrnehmung klar von «nicht erfüllt» unterscheidbar ist.
export const HATCH_STYLE: CSSProperties = {
  backgroundImage:
    'repeating-linear-gradient(45deg, var(--color-line) 0, var(--color-line) 1px, transparent 1px, transparent 5px)',
};
