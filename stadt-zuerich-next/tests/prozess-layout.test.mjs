// Unit-Tests für die reine Layout-Funktion lib/prozess-layout.ts.
//
// Lauf: node --experimental-strip-types --test tests/prozess-layout.test.mjs
// (npm run test:unit). lib/prozess-layout.ts hat nur type-only Imports, daher
// genügt Node-Type-Stripping ohne Pfad-Alias-Auflösung.
//
// Kernanspruch: Im Prozess-Graphen überdecken sich keine Knoten, und jeder
// Knoten liegt sichtbar in der Swimlane seines Akteurs — für jeden echten
// Prozess unter data/prozesse/ und für konstruierte Grenzfälle.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { layoutProzess, LAYOUT_CONSTANTS } from '../lib/prozess-layout.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(here, '..', 'data', 'prozesse');

/** Sichtbare Fläche eines Knotens: Rauten (um 45° gedreht) ragen um
 *  DIAMOND_PAD über ihre DOM-Box hinaus. */
function visibleBox(n, typ) {
  const pad = typ === 'entscheidung' ? LAYOUT_CONSTANTS.DIAMOND_PAD : 0;
  return { x: n.x - pad, y: n.y - pad, w: n.width + 2 * pad, h: n.height + 2 * pad };
}

const overlaps = (a, b) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

function assertLayoutSound(prozess, name) {
  const layout = layoutProzess(prozess);
  const typOf = new Map(prozess.steps.map((s) => [String(s.step_id), s.type]));
  assert.equal(layout.nodes.length, prozess.steps.length, `${name}: jeder Schritt hat eine Position`);

  const boxes = layout.nodes.map((n) => ({ n, box: visibleBox(n, typOf.get(n.id)) }));
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      assert.ok(
        !overlaps(boxes[i].box, boxes[j].box),
        `${name}: Schritt ${boxes[i].n.id} und ${boxes[j].n.id} überlappen`
      );
    }
  }

  for (const { n, box } of boxes) {
    const lane = layout.lanes[n.lane];
    assert.ok(lane, `${name}: Schritt ${n.id} hat eine Swimlane`);
    assert.ok(
      box.y >= lane.y && box.y + box.h <= lane.y + lane.height,
      `${name}: Schritt ${n.id} ragt aus seiner Swimlane (${box.y}–${box.y + box.h} vs. ${lane.y}–${lane.y + lane.height})`
    );
  }

  // Swimlanes lückenlos und ohne Überlappung untereinander.
  for (let i = 1; i < layout.lanes.length; i++) {
    const prev = layout.lanes[i - 1];
    assert.equal(layout.lanes[i].y, prev.y + prev.height, `${name}: Swimlane ${i} schliesst an ${i - 1} an`);
  }
  const last = layout.lanes.at(-1);
  if (last) assert.ok(layout.height >= last.y + last.height, `${name}: Gesamthöhe umfasst alle Swimlanes`);
  return layout;
}

const prozessDateien = readdirSync(dataDir, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .flatMap((d) =>
    readdirSync(path.join(dataDir, d.name))
      .filter((f) => f.endsWith('.json'))
      .map((f) => path.join(dataDir, d.name, f))
  );

test('es gibt Prozessdaten zum Prüfen', () => {
  assert.ok(prozessDateien.length > 0);
});

for (const file of prozessDateien) {
  const name = path.relative(dataDir, file);
  test(`layout: ${name} — keine Überlappung, Knoten in ihrer Swimlane`, () => {
    assertLayoutSound(JSON.parse(readFileSync(file, 'utf8')), name);
  });
}

/** Minimal-Prozess für Grenzfälle. */
const step = (step_id, actor, depends_on, type = 'prozess') => ({
  step_id,
  actor,
  depends_on,
  type,
  label: { de: `S${step_id}` },
});

test('layout: drei Rauten in derselben Zelle werden gestapelt und die Swimlane wächst', () => {
  const prozess = {
    actors: [{ id: 'a' }, { id: 'b' }],
    steps: [
      step(1, 'a', [], 'start'),
      step(2, 'a', [1], 'entscheidung'),
      step(3, 'a', [1], 'entscheidung'),
      step(4, 'a', [1], 'entscheidung'),
      step(5, 'b', [2, 3, 4], 'ende'),
    ],
  };
  const layout = assertLayoutSound(prozess, 'fixture');
  assert.ok(layout.lanes[0].height > LAYOUT_CONSTANTS.LANE_H, 'Swimlane mit Stapel ist höher als die Mindesthöhe');
  assert.equal(layout.lanes[1].height, LAYOUT_CONSTANTS.LANE_H, 'Swimlane ohne Stapel bleibt bei der Mindesthöhe');
});

test('layout: einzelne Raute und Rechteck derselben Bahn liegen auf einer Mittellinie', () => {
  const prozess = {
    actors: [{ id: 'a' }],
    steps: [step(1, 'a', [], 'start'), step(2, 'a', [1], 'entscheidung'), step(3, 'a', [2])],
  };
  const layout = assertLayoutSound(prozess, 'fixture');
  const mitte = (n) => n.y + n.height / 2;
  const [s1, s2, s3] = layout.nodes;
  assert.equal(mitte(s1), mitte(s2));
  assert.equal(mitte(s2), mitte(s3));
  const mitteX = (n) => n.x + n.width / 2;
  assert.equal(mitteX(s2) - mitteX(s1), LAYOUT_CONSTANTS.COLUMN_W, 'Spaltenmitten im festen Abstand');
});
