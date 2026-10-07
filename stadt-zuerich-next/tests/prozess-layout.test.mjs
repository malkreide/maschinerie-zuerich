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
import { layoutProzess, kantenLabelSize, LAYOUT_CONSTANTS } from '../lib/prozess-layout.ts';

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

/** Beschriftungen der Vorwärts-Kanten in einer Sprache, wie die Prozess-Seite
 *  sie ans Layout reicht: Schlüssel `${von}->${nach}`, Fallback de. */
function kantenLabelsFuer(prozess, locale) {
  const labels = {};
  for (const s of prozess.steps) {
    for (const d of s.depends_on ?? []) {
      if (typeof d === 'number' || !d.condition) continue;
      const text = d.condition[locale] || d.condition.de;
      if (text) labels[`${d.step_id}->${s.step_id}`] = text;
    }
  }
  return labels;
}

const boxVonLabel = (l) => ({ x: l.x - l.width / 2, y: l.y - l.height / 2, w: l.width, h: l.height });

function assertLayoutSound(prozess, name, options) {
  const layout = layoutProzess(prozess, options);
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

  // Kanten-Beschriftungen: jede verlangte ist platziert, keine überdeckt
  // einen Knoten oder eine andere Beschriftung, keine ragt in die Spalte der
  // Swimlane-Namen oder aus der Zeichenfläche.
  const verlangt = Object.keys(options?.kantenLabels ?? {});
  assert.equal(layout.kantenLabels.length, verlangt.length, `${name}: jede Beschriftung ist platziert`);
  const labels = layout.kantenLabels.map((l) => ({ l, box: boxVonLabel(l) }));
  for (const { l, box } of labels) {
    const wer = `${name}: Beschriftung ${l.von}->${l.nach}`;
    assert.ok(box.w > 0 && box.h > 0, `${wer} hat eine Fläche`);
    assert.ok(box.x >= LAYOUT_CONSTANTS.LANE_LABEL_WIDTH, `${wer} ragt in die Spalte der Swimlane-Namen`);
    assert.ok(box.x + box.w <= layout.width && box.y >= 0 && box.y + box.h <= layout.height, `${wer} ragt aus der Zeichenfläche`);
    for (const { n, box: knoten } of boxes) {
      assert.ok(!overlaps(box, knoten), `${wer} überdeckt Schritt ${n.id}`);
    }
    // Sitzt unmittelbar vor ihrem Ziel, auf dessen Höhe.
    const ziel = boxes.find((b) => b.n.id === l.nach);
    assert.ok(ziel, `${wer}: Ziel existiert`);
    assert.equal(box.x + box.w, ziel.box.x - LAYOUT_CONSTANTS.LABEL_SIDE_TARGET, `${wer} endet vor der linken Kante des Ziels`);
    assert.ok(box.y < ziel.box.y + ziel.box.h && ziel.box.y < box.y + box.h, `${wer} liegt auf der Höhe des Ziels`);
  }
  for (let i = 0; i < labels.length; i++) {
    for (let j = i + 1; j < labels.length; j++) {
      assert.ok(
        !overlaps(labels[i].box, labels[j].box),
        `${name}: Beschriftungen ${labels[i].l.von}->${labels[i].l.nach} und ${labels[j].l.von}->${labels[j].l.nach} überlappen`
      );
    }
  }
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
  // Mit Kanten-Beschriftungen, in jeder Sprache: die Texte sind verschieden
  // lang, also verschiebt sich das Layout je Sprache.
  for (const locale of ['de', 'en', 'fr', 'it', 'ls']) {
    test(`layout: ${name} [${locale}] — Kanten-Beschriftungen überdecken nichts`, () => {
      const prozess = JSON.parse(readFileSync(file, 'utf8'));
      assertLayoutSound(prozess, `${name} [${locale}]`, { kantenLabels: kantenLabelsFuer(prozess, locale) });
    });
  }
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

// --- Kanten-Beschriftungen ---------------------------------------------------

/** Verzweigung 2 mit zwei Zielen 3 und 4 in derselben Bahn. */
const verzweigung = () => ({
  actors: [{ id: 'a' }],
  steps: [step(1, 'a', [], 'start'), step(2, 'a', [1], 'entscheidung'), step(3, 'a', [2]), step(4, 'a', [2])],
});

test('labels: ohne Beschriftungen bleibt das Layout unverändert', () => {
  const prozess = verzweigung();
  const ohne = layoutProzess(prozess);
  assert.deepEqual(layoutProzess(prozess, { kantenLabels: {} }), ohne);
  assert.deepEqual(ohne.kantenLabels, []);
  const mitteX = (n) => n.x + n.width / 2;
  assert.equal(mitteX(ohne.nodes[2]) - mitteX(ohne.nodes[1]), LAYOUT_CONSTANTS.COLUMN_W);
});

test('labels: kurze Beschriftung passt in die Standard-Lücke oder weitet sie nur minimal', () => {
  const prozess = verzweigung();
  const ohne = layoutProzess(prozess);
  const mit = assertLayoutSound(prozess, 'fixture', { kantenLabels: { '2->3': 'ja', '2->4': 'nein' } });
  assert.ok(mit.width - ohne.width <= 30, `«ja»/«nein» verbreitern den Graphen um ${mit.width - ohne.width}px`);
});

test('labels: lange Beschriftung bricht um und verbreitert nur die Lücke vor ihrer Zielspalte', () => {
  const prozess = verzweigung();
  const lang = 'Wegzug ins Ausland oder Ende vom Wochen-Aufenthalt';
  const ohne = layoutProzess(prozess);
  const mit = assertLayoutSound(prozess, 'fixture', { kantenLabels: { '2->3': lang } });
  const label = mit.kantenLabels[0];
  assert.ok(kantenLabelSize(lang).lines > 1, 'mehrzeilig');
  assert.ok(label.width <= 170, `Breite bleibt gedeckelt (${label.width})`);
  // Spalten 0 und 1 (vor der Verzweigung) stehen, wo sie ohne Beschriftung stünden.
  assert.equal(mit.nodes[0].x, ohne.nodes[0].x);
  assert.equal(mit.nodes[1].x, ohne.nodes[1].x);
  // Spalte 2 (die Ziele) rückt nach rechts.
  assert.ok(mit.nodes[2].x > ohne.nodes[2].x);
});

test('labels: zwei beschriftete Kanten ins selbe Ziel werden gestapelt', () => {
  const prozess = {
    actors: [{ id: 'a' }],
    steps: [
      step(1, 'a', [], 'start'),
      step(2, 'a', [1], 'entscheidung'),
      step(3, 'a', [1], 'entscheidung'),
      step(4, 'a', [2, 3], 'ende'),
    ],
  };
  const layout = assertLayoutSound(prozess, 'fixture', { kantenLabels: { '2->4': 'ja', '3->4': 'nein' } });
  const [a, b] = layout.kantenLabels;
  assert.equal(a.nach, b.nach);
  assert.ok(a.y + a.height / 2 <= b.y - b.height / 2, 'untereinander, ohne Überlappung');
});

test('labels: Beschriftung höher als ihr Zielknoten — übereinander liegende Ziele rücken auseinander', () => {
  const prozess = verzweigung();
  const satz = 'La personne détentrice est soumise à l’obligation d’éducation pratique et n’en est pas exemptée, sauf dans les cas prévus par le règlement cantonal en vigueur.';
  assert.ok(kantenLabelSize(satz).height > LAYOUT_CONSTANTS.NODE_H, 'Fixture ist höher als ein Knoten');
  const ohne = layoutProzess(prozess);
  const mit = assertLayoutSound(prozess, 'fixture', { kantenLabels: { '2->3': satz, '2->4': satz } });
  const abstand = (l) => l.nodes[3].y - l.nodes[2].y;
  assert.ok(abstand(mit) > abstand(ohne), 'gestapelte Ziele haben mehr Abstand');
  assert.ok(mit.lanes[0].height > ohne.lanes[0].height, 'die Swimlane wächst mit');
});

test('labels: Ziel in einer früheren Spalte als die Quelle', () => {
  // 4 hängt an 1 und an 3: über 1 liegt es in Spalte 1, die Kante von 3
  // (Spalte 2) läuft also zurück — und teilt sich die Zelle mit Schritt 2.
  const prozess = {
    actors: [{ id: 'a' }],
    steps: [step(1, 'a', [], 'start'), step(2, 'a', [1]), step(3, 'a', [2], 'entscheidung'), step(4, 'a', [1, 3])],
  };
  const layout = assertLayoutSound(prozess, 'fixture', { kantenLabels: { '3->4': 'zurück an den Anfang der Prüfung' } });
  assert.equal(layout.nodes[3].layer, 1);
  assert.equal(layout.nodes[2].layer, 2);
});

test('labels: Ziel in der ersten Spalte — Beschriftung bleibt rechts der Swimlane-Namen', () => {
  // Zyklus ohne Start-Schritt: Schritt 1 landet als Ersatz-Start in Spalte 0
  // und hat trotzdem eine eingehende, beschriftete Kante.
  const prozess = {
    actors: [{ id: 'a' }],
    steps: [step(1, 'a', [2]), step(2, 'a', [1], 'entscheidung')],
  };
  const layout = assertLayoutSound(prozess, 'fixture', { kantenLabels: { '2->1': 'noch einmal von vorn beginnen' } });
  assert.equal(layout.nodes[0].layer, 0);
  const label = layout.kantenLabels[0];
  assert.ok(label.x - label.width / 2 >= LAYOUT_CONSTANTS.LANE_LABEL_WIDTH + LAYOUT_CONSTANTS.LABEL_SIDE_SOURCE);
});

test('labels: Beschriftung für unbekannte Kante wird ignoriert', () => {
  const layout = layoutProzess(verzweigung(), { kantenLabels: { '9->3': 'x', '2->9': 'y', '2->3': '   ' } });
  assert.deepEqual(layout.kantenLabels, []);
});

test('kantenLabelSize: einzeilig, mehrzeilig, überlanges Wort', () => {
  const ja = kantenLabelSize('ja');
  assert.equal(ja.lines, 1);
  assert.ok(ja.width < 40, `«ja» ist schmal (${ja.width})`);
  assert.equal(ja.height, LAYOUT_CONSTANTS.LABEL_LINE_H + 2 * LAYOUT_CONSTANTS.LABEL_PAD_Y);

  const mittel = kantenLabelSize('persönlich (wenn es online nicht geht)');
  assert.ok(mittel.lines >= 2 && mittel.lines <= 3, `${mittel.lines} Zeilen`);

  const wort = kantenLabelSize('Donaudampfschifffahrtsgesellschaftskapitänsmützenabzeichen ja');
  assert.ok(wort.lines >= 3, 'überlanges Wort belegt mehrere Zeilen');
  assert.ok(wort.width <= 170, `Breite gedeckelt (${wort.width})`);

  assert.deepEqual(kantenLabelSize('   '), { width: 0, height: 0, lines: 0 });
});
