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

/** Platzierte Beschriftung einer Vorwärts-Kante (Bedingung an einer
 *  Verzweigung). x/y ist der MITTELPUNKT der Box in Graph-Koordinaten. */
export interface LayoutKantenLabel {
  /** String(step_id) von Quelle und Ziel. */
  von: string;
  nach: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Layout {
  nodes: LayoutNode[];
  lanes: LayoutLane[];
  /** Leer, wenn layoutProzess ohne Kanten-Beschriftungen aufgerufen wurde. */
  kantenLabels: LayoutKantenLabel[];
  width: number;
  height: number;
}

export interface LayoutOptions {
  /** Bereits i18n-aufgelöste Beschriftungen der Vorwärts-Kanten, Schlüssel
   *  `${von}->${nach}` (step_ids). Sind sie gesetzt, reserviert das Layout
   *  vor dem Zielknoten Platz für sie und liefert ihre Position mit. */
  kantenLabels?: Record<string, string>;
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

// --- Kanten-Beschriftungen --------------------------------------------------
// Eine Beschriftung sitzt unmittelbar VOR ihrem Zielknoten, vertikal auf
// dessen Mitte: jede Kante läuft waagrecht von links ins Ziel (Target-Handle
// links), dort ist die Zuordnung eindeutig. Die Lücke vor der Zielspalte wird
// so breit wie die breiteste Beschriftung, die in diese Spalte führt.
//
// Die Box-Grösse wird aus der Zeichenzahl GESCHÄTZT (kein DOM auf dem Server)
// und im Client als feste Breite gesetzt (ProzessFlow.tsx). Die Schätzung ist
// bewusst grosszügig: lieber eine etwas zu breite Box als ein unerwarteter
// Zeilenumbruch, der die Box höher macht als reserviert.
const COLUMN_GAP = COLUMN_W - NODE_W; // Lücke zwischen zwei Spalten ohne Beschriftung
const LABEL_CHAR_W = 6.3;          // mittlere Zeichenbreite bei 11px, aufgerundet
const LABEL_LINE_H = 14;
const LABEL_PAD_X = 5;
const LABEL_PAD_Y = 2;
const LABEL_TEXT_MAX_W = 110;      // ab hier wird umbrochen
const LABEL_TEXT_HARD_MAX_W = 160; // Obergrenze, wenn ein einzelnes Wort länger ist
const LABEL_SIDE_TARGET = 18;      // Abstand zum Ziel — lässt die Pfeilspitze frei
const LABEL_SIDE_SOURCE = 8;       // Abstand zur Spalte davor
const LABEL_STACK_GAP = 4;         // zwischen mehreren Beschriftungen desselben Ziels

/** Geschätzte Box einer Kanten-Beschriftung (inkl. Innenabstand). */
export function kantenLabelSize(text: string): { width: number; height: number; lines: number } {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return { width: 0, height: 0, lines: 0 };
  const full = words.join(' ').length * LABEL_CHAR_W;
  let textW: number;
  let lines = 1;
  if (full <= LABEL_TEXT_MAX_W) {
    textW = Math.ceil(full);
  } else {
    const longest = Math.max(...words.map((w) => w.length)) * LABEL_CHAR_W;
    textW = Math.ceil(Math.min(LABEL_TEXT_HARD_MAX_W, Math.max(LABEL_TEXT_MAX_W, longest)));
    const cap = Math.max(1, Math.floor(textW / LABEL_CHAR_W));
    // Greedy-Umbruch nur an Leerzeichen. Der Browser bricht zusätzlich an
    // Bindestrichen — er braucht also höchstens so viele Zeilen wie hier.
    let used = 0;
    for (const w of words) {
      if (used > 0 && used + 1 + w.length <= cap) {
        used += 1 + w.length;
        continue;
      }
      if (used > 0) lines++;
      // Überlanges Wort: wird im Client hart umbrochen (overflow-wrap).
      lines += Math.ceil(w.length / cap) - 1;
      used = w.length % cap || cap;
    }
  }
  return {
    width: textW + 2 * LABEL_PAD_X,
    height: lines * LABEL_LINE_H + 2 * LABEL_PAD_Y,
    lines,
  };
}

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
 *  Zellen (layer × lane); gestapelte Knoten werden in der Bahn zentriert.
 *
 *  Mit options.kantenLabels gilt zusätzlich: Keine Kanten-Beschriftung
 *  überlappt einen Knoten oder eine andere Beschriftung. Sie sitzen in der
 *  Lücke vor der Zielspalte, die dafür bei Bedarf breiter wird; ein Knoten
 *  mit hoher Beschriftung belegt im Stapel entsprechend mehr Höhe. */
export function layoutProzess(prozess: Prozess, options: LayoutOptions = {}): Layout {
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
    return { nodes: [], lanes: [], kantenLabels: [], width: 0, height: 0 };
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

  // Beschriftungen je Zielknoten (in Schritt-Reihenfolge der Quellen). Nur
  // Kanten, deren beide Enden existieren und die einen Text tragen.
  const stepIds = new Set(prozess.steps.map((s) => s.step_id));
  const labelsInto = new Map<number, { von: number; width: number; height: number }[]>();
  for (const s of prozess.steps) {
    for (const d of s.depends_on ?? []) {
      const from = typeof d === 'number' ? d : d.step_id;
      const text = options.kantenLabels?.[`${from}->${s.step_id}`];
      if (!text || !stepIds.has(from)) continue;
      const size = kantenLabelSize(text);
      if (size.lines === 0) continue;
      const list = labelsInto.get(s.step_id) ?? [];
      list.push({ von: from, width: size.width, height: size.height });
      labelsInto.set(s.step_id, list);
    }
  }
  const labelStackHeight = (stepId: number) => {
    const list = labelsInto.get(stepId) ?? [];
    return list.reduce((sum, l) => sum + l.height, 0) + Math.max(0, list.length - 1) * LABEL_STACK_GAP;
  };

  // Höhe, die ein Knoten im Stapel belegt: seine sichtbare Höhe — oder die
  // seiner Beschriftung(en), falls die höher sind. So stossen Beschriftungen
  // übereinander liegender Ziele nie aneinander.
  const slotHeight = (s: Prozess['steps'][number]) => {
    const b = nodeBox(s);
    return Math.max(b.h + 2 * b.pad, labelStackHeight(s.step_id));
  };
  const stackHeight = (steps: Prozess['steps']) =>
    steps.reduce((sum, s) => sum + slotHeight(s), 0) + Math.max(0, steps.length - 1) * NODE_GAP;

  // Spalten-Positionen: vor jeder Spalte eine Lücke, die die breiteste dorthin
  // führende Beschriftung aufnimmt (mindestens COLUMN_GAP).
  const gapBefore: number[] = Array.from({ length: maxD + 1 }, () => COLUMN_GAP);
  for (const [stepId, list] of labelsInto) {
    const layer = depth[stepId];
    const need = Math.max(...list.map((l) => l.width)) + LABEL_SIDE_TARGET + LABEL_SIDE_SOURCE;
    gapBefore[layer] = Math.max(gapBefore[layer], need);
  }
  const columnX: number[] = [];
  let colAcc = LANE_LABEL_WIDTH;
  for (let layer = 0; layer <= maxD; layer++) {
    colAcc += gapBefore[layer];
    columnX.push(colAcc);
    colAcc += NODE_W;
  }

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
  const kantenLabels: LayoutKantenLabel[] = [];
  for (const [key, steps] of cells) {
    const [layer, lane] = key.split('::').map(Number);
    const laneTop = laneTops[lane] ?? LANE_PADDING_TOP;
    const laneH = laneHeights[lane] ?? LANE_H;
    // Stapel in der Bahn vertikal zentrieren — ein einzelner Knoten sitzt
    // so mittig, Rechtecke und Rauten derselben Bahn auf einer Linie.
    let cursor = laneTop + (laneH - stackHeight(steps)) / 2;
    for (const s of steps) {
      const b = nodeBox(s);
      const slot = slotHeight(s);
      const visibleH = b.h + 2 * b.pad;
      // Knoten in seinem Slot zentrieren (Slot > Knoten nur bei hoher Beschriftung).
      const top = cursor + (slot - visibleH) / 2;
      const x = columnX[layer] + (NODE_W - b.w) / 2;
      nodes.push({
        id: String(s.step_id),
        // Rauten um ihren Überstand einrücken: ihr Mittelpunkt liegt dann auf
        // derselben x-Achse wie der eines Rechtecks derselben Spalte.
        x,
        y: top + b.pad,
        width: b.w,
        height: b.h,
        akteurId: s.actor,
        layer,
        lane,
      });

      // Beschriftungen der Kanten in diesen Knoten: rechtsbündig vor seiner
      // sichtbaren linken Kante, als Stapel auf seiner Mittellinie.
      const list = labelsInto.get(s.step_id) ?? [];
      const right = x - b.pad - LABEL_SIDE_TARGET;
      let labelTop = cursor + slot / 2 - labelStackHeight(s.step_id) / 2;
      for (const l of list) {
        kantenLabels.push({
          von: String(l.von),
          nach: String(s.step_id),
          x: right - l.width / 2,
          y: labelTop + l.height / 2,
          width: l.width,
          height: l.height,
        });
        labelTop += l.height + LABEL_STACK_GAP;
      }
      cursor += slot + NODE_GAP;
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

  const width = columnX[maxD] + NODE_W + COLUMN_GAP + 40;
  const height = acc + 40;

  return { nodes, lanes, kantenLabels, width, height };
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
  COLUMN_GAP,
  LABEL_LINE_H,
  LABEL_PAD_X,
  LABEL_PAD_Y,
  LABEL_SIDE_TARGET,
  LABEL_SIDE_SOURCE,
} as const;
