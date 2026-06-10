// Pure Layout-Funktion für Prozess-Graphen.
// Approach: topologisches Layering per BFS von den Start-Schritten (leeres
// depends_on) aus — alle Knoten auf derselben "Tiefe" landen in einer
// vertikalen Spalte. Die Swimlane (y-Achse) ergibt sich aus dem Akteur.
// loops_back_to (Rücksprung-Hinweise) beeinflusst das Layering nicht.
//
// Absichtlich ohne dagre/elkjs: Für unsere überschaubaren Graphen (≤30 Knoten)
// ist das völlig ausreichend und spart eine Dependency. Falls nötig können
// einzelne Prozesse später Hand-Positionen im Schema erhalten (Feld TBD).

import { dependsOnId, type Prozess } from '@/types/prozess';

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
const LANE_H = 140;     // vertikaler Abstand Swimlane zu Swimlane
const LANE_PADDING_TOP = 30;
const LANE_LABEL_WIDTH = 220;

/** Berechnet Positionen für alle Schritte. Swimlane-Reihenfolge = Reihenfolge
 *  in Prozess.actors (das ist bewusst – Autor:in bestimmt das Layout-Ranking);
 *  ohne actors-Tabelle: Reihenfolge des ersten Auftretens in steps. */
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
      const from = dependsOnId(d);
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

  // Pro (layer, lane) Bucket zählen, damit mehrere Knoten in derselben Zelle
  // nicht überlappen — sie werden vertikal gestaffelt in der Swimlane.
  const buckets: Record<string, number> = {};

  const nodes: LayoutNode[] = prozess.steps.map((s) => {
    const layer = depth[s.step_id];
    const lane = laneOf[s.actor] ?? 0;
    const bucketKey = `${layer}::${lane}`;
    const idxInBucket = buckets[bucketKey] ?? 0;
    buckets[bucketKey] = idxInBucket + 1;

    const laneTop = LANE_PADDING_TOP + lane * LANE_H + LANE_LABEL_WIDTH * 0; // label ist links, nicht oben
    const x = LANE_LABEL_WIDTH + 40 + layer * COLUMN_W;
    const y = laneTop + idxInBucket * (NODE_H + 16) + (LANE_H - NODE_H) / 2 - idxInBucket * (NODE_H + 16) / 2;

    return {
      id: String(s.step_id),
      x,
      y,
      width: NODE_W,
      height: NODE_H,
      akteurId: s.actor,
      layer,
      lane,
    };
  });

  const lanes: LayoutLane[] = akteure.map((id, i) => ({
    akteurId: id,
    y: LANE_PADDING_TOP + i * LANE_H,
    height: LANE_H,
    labelY: LANE_PADDING_TOP + i * LANE_H + LANE_H / 2,
  }));

  const width = LANE_LABEL_WIDTH + 40 + (maxD + 1) * COLUMN_W + 40;
  const height = LANE_PADDING_TOP + akteure.length * LANE_H + 40;

  return { nodes, lanes, width, height };
}

export const LAYOUT_CONSTANTS = {
  COLUMN_W,
  NODE_W,
  NODE_H,
  LANE_H,
  LANE_PADDING_TOP,
  LANE_LABEL_WIDTH,
} as const;
