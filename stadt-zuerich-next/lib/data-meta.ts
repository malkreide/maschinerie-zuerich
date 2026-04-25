// Aufbereitung der `_meta`-Felder für die UI — primär für den Datenstand-Chip
// im Header. `budgetStand` hat die Form "2024 (GEMEINDERAT_BESCHLUSS)" oder
// nur "2024"; wir ziehen Jahr und Phase separat heraus, damit die UI sie
// unabhängig formatieren kann (Hauptlabel = Jahr, Tooltip = Jahr + Phase +
// Datum).

import type { DataMeta } from '@/types/stadt';

export interface DataStandInfo {
  /** Haupt-Jahreszahl des Budgets, z. B. "2024". Leer, wenn kein Budget-Stand gesetzt ist. */
  jahr: string;
  /** Phase-Text in Klammern, z. B. "GEMEINDERAT_BESCHLUSS". Leer, wenn nicht angegeben. */
  phase: string;
  /** Letzter Enrichment-/Stand-Datumsstring aus _meta, bevorzugt `angereichert`, Fallback `stand`. */
  stand: string;
}

// Format: "2024 (GEMEINDERAT_BESCHLUSS)" oder "2024" oder leer.
const BUDGET_RE = /^\s*(\d{4})(?:\s*\(\s*([^)]+?)\s*\))?/;

export function parseDataStand(meta: DataMeta | undefined): DataStandInfo {
  if (!meta) return { jahr: '', phase: '', stand: '' };
  const m = meta.budgetStand ? BUDGET_RE.exec(meta.budgetStand) : null;
  return {
    jahr: m?.[1] ?? '',
    phase: m?.[2] ?? '',
    stand: meta.angereichert || meta.stand || '',
  };
}
