#!/usr/bin/env node
// Template-Migration: OpenGov-Process-Schema v1.x → v2.0.
//
// STATUS: PLATZHALTER. Das Schema ist aktuell auf v1 (erste Zeile von
// baubewilligung-ordentlich.json: "version": "0.1.0"). Eine v2 wird es
// erst geben, wenn wir eine breaking change am Schema einführen.
//
// Dann: die transform()-Funktion unten ausfüllen, npm-Script eintragen
// (`migrate:schema:v2`), erst `npm run migrate:schema:v2` für Dry-Run,
// dann `npm run migrate:schema:v2 -- --write`, dann `npm run validate:prozesse`,
// dann Schema-Datei auf v2 anheben, commit.
//
// Für spätere Migrationen: diese Datei kopieren nach
// `migrate-prozesse-schema-v3.mjs` etc.
//
// Usage:
//   node scripts/migrate-prozesse-schema-v2.mjs          # Dry-Run
//   node scripts/migrate-prozesse-schema-v2.mjs --write  # tatsächlich schreiben
//   node scripts/migrate-prozesse-schema-v2.mjs -w -v    # schreiben + verbose

import { runMigration } from './_migrate-lib.mjs';

/**
 * Transformiert ein v1-Prozess-Objekt in ein v2-Prozess-Objekt.
 * Muss rein sein (keine I/O). `runMigration` setzt die neue version danach
 * selbst — wir sollen uns hier nicht um das Versionsfeld kümmern.
 *
 * @param {object} p  Prozess-Objekt (v1), bereits geklont — darf mutiert werden.
 * @param {{city: string, file: string}} ctx
 * @returns {object} Prozess-Objekt (v2).
 */
function transform(p /*, ctx */) {
  // -----------------------------------------------------------------------
  // BEISPIEL-MIGRATIONEN (auskommentiert — hier echte Transformationen rein):
  // -----------------------------------------------------------------------

  // BSP 1: Feld umbenennen — 'dauer_est' → 'dauer'
  //
  // for (const s of p.schritte ?? []) {
  //   if (s.dauer_est !== undefined) {
  //     s.dauer = s.dauer_est;
  //     delete s.dauer_est;
  //   }
  // }

  // BSP 2: Neuer Pflicht-Default — 'meta.lizenz' wird default 'CC-BY-4.0'
  //
  // p.meta = p.meta ?? {};
  // if (!p.meta.lizenz) p.meta.lizenz = 'CC-BY-4.0';

  // BSP 3: Enum-Wert splitten — 'behoerde' wird aufgeteilt in
  //                             'behoerde-kommunal' | 'behoerde-kantonal' | 'behoerde-bund'
  //
  // const govLevelByAkteurId = {
  //   'amt-baubewilligungen': 'behoerde-kommunal',
  //   'hochbauamt':            'behoerde-kommunal',
  //   'kanton':                'behoerde-kantonal',
  // };
  // for (const a of p.akteure ?? []) {
  //   if (a.typ === 'behoerde') {
  //     a.typ = govLevelByAkteurId[a.id] ?? 'behoerde-kommunal';
  //   }
  // }

  // BSP 4: Array-Felder umstrukturieren — 'quellen[].abgerufen' als ISO-Date
  //        strikt erzwingen, Altformate ('01.04.2026') konvertieren.
  //
  // for (const q of p.quellen ?? []) {
  //   if (typeof q.abgerufen === 'string' && /^\d{2}\.\d{2}\.\d{4}$/.test(q.abgerufen)) {
  //     const [d, m, y] = q.abgerufen.split('.');
  //     q.abgerufen = `${y}-${m}-${d}`;
  //   }
  // }

  // BSP 5: Neuer optionaler Block 'barrierefreiheit' mit Default — nur setzen,
  //        wenn nicht schon vorhanden.
  //
  // if (!p.barrierefreiheit) {
  //   p.barrierefreiheit = { rollstuhlgaengig: null, gebaerdensprache: null };
  // }

  return p;
}

runMigration({
  title: 'OpenGov-Process-Schema v1 → v2 (TEMPLATE — no-op until transform() is filled)',
  // fromVersion='1.' matcht bewusst KEINE der heutigen 0.x-Dateien →
  // Template bleibt dormant, verhindert versehentliches --write, das sonst
  // einfach nur die Version auf 2.0.0 bumpen würde.
  //
  // Wenn das Schema tatsächlich auf v2 bumpt:
  //   - fromVersion auf die Quell-MAJOR setzen (typisch '1.')
  //   - transform() ausfüllen
  //   - schemas/opengov-process-schema.json auf v2-Struktur heben
  //   - `npm run migrate:schema:v2 -- --write`
  //   - `npm run validate:prozesse` zur Bestätigung
  fromVersion: '1.',
  toVersion:   '2.0.0',
  transform,
});
