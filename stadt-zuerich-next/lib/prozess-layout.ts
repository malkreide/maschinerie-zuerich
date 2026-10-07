// Pure Layout-Funktion für Prozess-Graphen.
// Approach: topologisches Layering per BFS von den Start-Schritten (leeres
// depends_on) aus — alle Knoten auf derselben "Tiefe" landen in einer
// vertikalen Spalte. Die Swimlane (y-Achse) ergibt sich aus dem Akteur.
// loops_back_to (Rücksprung-Hinweise) beeinflusst das Layering nicht.
//
// Absichtlich ohne dagre/elkjs: Für unsere überschaubaren Graphen (≤30 Knoten)
// ist das völlig ausreichend und spart eine Dependency. Falls nötig können
// einzelne Prozesse später Hand-Positionen im Schema erhalten (Feld TBD).

// Nur type-only Imports: so lässt sich das Modul ohne Pfad-Alias-Auflösung
// direkt unter Node testen (tests/prozess-layout.test.mjs).
import type { Prozess, SchrittTyp } from '@/types/prozess';

export interface LayoutNode {
  /** String(step_id) — React-Flow-Node-IDs sind Strings. */
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  akteurId: string;
  layer: number;
  lane: number;
}

export interface LayoutLane {
  akteurId: string;
  y: number;
  height: number;
  labelY: number;
}

export interface Layout {
  nodes: LayoutNode[];
  lanes: LayoutLane[];
  width: number;
  height: number;
}

const COLUMN_W = 240;   // horizontaler Abstand Layer zu Layer
const NODE_W = 200;
const NODE_H = 80;
const LANE_H = 140;     // Mindesthöhe einer Swimlane
const LANE_PADDING_TOP = 30;
const LANE_LABEL_WIDTH = 220;
const LANE_PAD_V = 20;  // vertikaler Innenabstand der Swimlane
const NODE_GAP = 24;    // vertikaler Abstand gestapelter Knoten derselben Zelle

// Entscheidungs-Knoten sind 140×140 und um 45° gedreht (ProzessNodes.tsx):
// sichtbar belegen sie √2·140 ≈ 198 px in Breite und Höhe. DIAMOND_PAD ist
// der Überstand der Raute über ihre ungedrehte Box auf jeder Seite.
const DIAMOND_SIZE = 140;
const DIAMOND_PAD = 30;
// Rechteck-Knoten zeigen Label (max. 2 Zeilen) plus je Beleg eine Zeile
// (ProzessNodes.tsx, MetaRow kürzt einzeilig). Ab dem zweiten Beleg wächst
// der Knoten um REF_LINE_H je Beleg, damit nichts über den Rahmen läuft.
const REF_LINE_H = 18;

/** DOM-Grösse (width/height, wie React Flow sie misst) und sichtbarer
 *  Platzbedarf (pad = Überstand pro Seite) je Schritt-Typ. */
function nodeBox(step: { type?: SchrittTyp; reference_ids?: number[] }): { w: number; h: number; pad: number } {
  if (step.type === 'entscheidung') return { w: DIAMOND_SIZE, h: DIAMOND_SIZE, pad: DIAMOND_PAD };
  const refs = step.reference_ids?.length ?? 0;
  return { w: NODE_W, h: NODE_H + Math.max(0, refs - 1) * REF_LINE_H, pad: 0 };
}

/** Berechnet Positionen für alle Schritte. Swimlane-Reihenfolge = Reihenfolge
 *  in Prozess.actors (das ist bewusst – Autor:in bestimmt das Layout-Ranking);
 *  ohne actors-Tabelle: Reihenfolge des ersten Auftretens in steps.
 *
 *  Garantie (tests/prozess-layout.test.mjs): Die sichtbaren Flächen zweier
 *  Knoten überlappen nie, und jeder Knoten liegt innerhalb seiner Swimlane.
 *  Dafür wächst eine Swimlane mit dem höchsten Knoten-Stapel einer ihrer
 *  Zellen (layer × lane); gestapelte Knoten werden in der Bahn zentriert. */
export function layoutProzess(prozess: Prozess): Layout {
  const akteure: string[] = prozess.actors
    ? prozess.actors.map((a) => a.id)
    : [...new Set(prozess.steps.map((s) => s.actor))];
  const laneOf: Record<string, number> = Object.fromEntries(akteure.map((id, i) => [id, i]));

  // Vorwärts-Adjazenz aus depends_on (Vorgänger → Nachfolger).
  const out: Record<number, number[]> = {};
  for (const s of prozess.steps) out[s.step_id] = out[s.step_id] ?? [];
  for (const s of prozess.steps) {
    for (const d of s.depends_on ?? []) {
      const from = typeof d === 'number' ? d : d.step_id;
      (out[from] = out[from] ?? []).push(s.step_id);
    }
  }

  const starts = prozess.steps
    .filter((s) => (s.depends_on ?? []).length === 0)
    .map((s) => s.step_id);
  if (starts.length === 0 && prozess.steps[0]) starts.push(prozess.steps[0].step_id);
  if (starts.length === 0) {
    return { nodes: [], lanes: [], width: 0, height: 0 };
  }

  // BFS-Tiefen: Knoten erhält seine MINIMALE Distanz zu einem Start.
  const depth: Record<number, number> = {};
  const queue: number[] = [];
  for (const s of starts) {
    depth[s] = 0;
    queue.push(s);
  }
  while (queue.length) {
    const cur = queue.shift()!;
    const d = depth[cur];
    for (const nxt of out[cur] ?? []) {
      if (depth[nxt] === undefined) {
        depth[nxt] = d + 1;
        queue.push(nxt);
      }
    }
  }
  // Unerreichbare Knoten ans Ende hängen
  let maxD = 0;
  for (const d of Object.values(depth)) if (d > maxD) maxD = d;
  for (const s of prozess.steps) {
    if (depth[s.step_id] === undefined) depth[s.step_id] = maxD + 1;
  }
  maxD = Math.max(maxD, ...Object.values(depth));

  // Zellen (layer × lane) mit ihren Knoten in Schritt-Reihenfolge. Die Höhe
  // einer Zelle ist die Summe der sichtbaren Knotenhöhen plus Abstände; die
  // Swimlane ist so hoch wie ihre höchste Zelle (mindestens LANE_H).
  const cells = new Map<string, Prozess['steps']>();
  const cellKey = (layer: number, lane: number) => `${layer}::${lane}`;
  for (const s of prozess.steps) {
    const key = cellKey(depth[s.step_id], laneOf[s.actor] ?? 0);
    const list = cells.get(key) ?? [];
    list.push(s);
    cells.set(key, list);
  }
  const stackHeight = (steps: Prozess['steps']) =>
    steps.reduce((sum, s) => {
      const b = nodeBox(s);
      return sum + b.h + 2 * b.pad;
    }, 0) + Math.max(0, steps.length - 1) * NODE_GAP;

  const laneHeights = akteure.map(() => LANE_H);
  for (const [key, steps] of cells) {
    const lane = Number(key.split('::')[1]);
    if (lane >= laneHeights.length) continue;
    laneHeights[lane] = Math.max(laneHeights[lane], stackHeight(steps) + 2 * LANE_PAD_V);
  }
  const laneTops: number[] = [];
  let acc = LANE_PADDING_TOP;
  for (const h of laneHeights) {
    laneTops.push(acc);
    acc += h;
  }

  const nodes: LayoutNode[] = [];
  for (const [key, steps] of cells) {
    const [layer, lane] = key.split('::').map(Number);
    const laneTop = laneTops[lane] ?? LANE_PADDING_TOP;
    const laneH = laneHeights[lane] ?? LANE_H;
    // Stapel in der Bahn vertikal zentrieren — ein einzelner Knoten sitzt
    // so mittig, Rechtecke und Rauten derselben Bahn auf einer Linie.
    let cursor = laneTop + (laneH - stackHeight(steps)) / 2;
    for (const s of steps) {
      const b = nodeBox(s);
      nodes.push({
        id: String(s.step_id),
        // Rauten um ihren Überstand einrücken: ihr Mittelpunkt liegt dann auf
        // derselben x-Achse wie der eines Rechtecks derselben Spalte.
        x: LANE_LABEL_WIDTH + 40 + layer * COLUMN_W + (NODE_W - b.w) / 2,
        y: cursor + b.pad,
        width: b.w,
        height: b.h,
        akteurId: s.actor,
        layer,
        lane,
      });
      cursor += b.h + 2 * b.pad + NODE_GAP;
    }
  }
  // Reihenfolge wie in prozess.steps (stabil für Konsumenten und Tests).
  const order = new Map(prozess.steps.map((s, i) => [String(s.step_id), i]));
  nodes.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));

  const lanes: LayoutLane[] = akteure.map((id, i) => ({
    akteurId: id,
    y: laneTops[i],
    height: laneHeights[i],
    labelY: laneTops[i] + laneHeights[i] / 2,
  }));

  const width = LANE_LABEL_WIDTH + 40 + (maxD + 1) * COLUMN_W + 40;
  const height = acc + 40;

  return { nodes, lanes, width, height };
}

export const LAYOUT_CONSTANTS = {
  COLUMN_W,
  NODE_W,
  NODE_H,
  LANE_H,
  LANE_PADDING_TOP,
  LANE_LABEL_WIDTH,
  LANE_PAD_V,
  NODE_GAP,
  DIAMOND_SIZE,
  DIAMOND_PAD,
  REF_LINE_H,
} as const;
