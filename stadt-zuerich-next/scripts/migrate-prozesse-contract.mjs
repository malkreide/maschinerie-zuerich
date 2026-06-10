#!/usr/bin/env node
// Migration: Schema-Generation 2 → kanonischer Prozess-Datenvertrag
// (docs/process-data-contract.md im Repo-Root, schema_version 0.1.0).
//
// Läuft NICHT über _migrate-lib.mjs, weil der Vertrag das Versionsfeld
// selbst umbenennt (version → schema_version) und Dateien umbenannt werden
// (id == lebenslage_ref). Einmalige Struktur-Migration:
//
//   - Feldnamen → Vertrag: titel→title, kurzbeschreibung→description,
//     voraussetzungen→preconditions, zielgruppe→target_audience,
//     rechtsgrundlagen→legal_basis, quellen→sources, akteure→actors,
//     schritte→steps, referenzen→references (mit Integer-IDs)
//   - flow-Kanten → steps[].depends_on (Objekt-Variante mit condition bei
//     Bedingungs-Kanten); Kanten AUS typ-'loop'-Schritten werden zu
//     loops_back_to (Rendering-Hinweis, nicht Teil des DAG)
//   - String-Schritt-IDs → Integer step_id (Dateireihenfolge, 1-basiert)
//   - source_url/retrieved_at (Prozess) = erste Quelle
//   - id == lebenslage_ref: Prozess-IDs und Dateinamen werden auf die
//     Lebenslage-ID umbenannt; data/<city>/lebenslagen.json wird angepasst
//
// Usage:
//   node scripts/migrate-prozesse-contract.mjs          # Dry-Run
//   node scripts/migrate-prozesse-contract.mjs --write  # tatsächlich schreiben

import { readFile, readdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, '..');
const PROZESSE_ROOT = path.join(projectRoot, 'data', 'prozesse');

const WRITE = process.argv.includes('--write') || process.argv.includes('-w');
const SCHEMA_VERSION = '0.1.0';

const asI18n = (s) => (typeof s === 'string' ? { de: s } : s);

function transform(p) {
  const out = {};
  out.$schema = p.$schema;
  out.schema_version = SCHEMA_VERSION;
  // id == lebenslage_ref (Vertrag) — Dateiname wird unten mit umbenannt.
  out.id = p.lebenslage_ref;
  out.lebenslage_ref = p.lebenslage_ref;
  out.city = p.city;
  out.title = asI18n(p.titel);
  if (p.kurzbeschreibung) out.description = asI18n(p.kurzbeschreibung);
  out.target_audience = p.zielgruppe;
  if (p.voraussetzungen) out.preconditions = p.voraussetzungen.map(asI18n);

  // Quellen: erste Quelle wird primäre source_url/retrieved_at des Prozesses.
  const quellen = p.quellen ?? [];
  out.source_url = quellen[0]?.url;
  out.retrieved_at = quellen[0]?.abgerufen;
  out.disclaimer_key = p.disclaimer_key ?? 'Prozesse.disclaimer';

  // Referenzen: String-IDs → Integer reference_id (Listenreihenfolge).
  const refIdByString = new Map();
  if (p.referenzen?.length) {
    out.references = p.referenzen.map((r, i) => {
      refIdByString.set(r.id, i + 1);
      return {
        reference_id: i + 1,
        label: asI18n(r.label),
        source_url: r.url,
        source_quote: r.zitat ?? '',
        status: r.status,
        retrieved_at: r.abgerufen,
      };
    });
  }

  if (p.akteure) {
    out.actors = p.akteure.map((a) => ({
      id: a.id,
      label: asI18n(a.label),
      type: a.typ,
      ...(a.einheit_ref ? { einheit_ref: a.einheit_ref } : {}),
    }));
  }

  // Schritte: String-IDs → Integer step_id (Dateireihenfolge, 1-basiert).
  const stepIdByString = new Map(p.schritte.map((s, i) => [s.id, i + 1]));
  const loopStepIds = new Set(p.schritte.filter((s) => s.typ === 'loop').map((s) => s.id));

  // flow → depends_on / loops_back_to
  const dependsOnByStep = new Map(); // string id → DependsOn[]
  const loopsBackByStep = new Map(); // string id → number[]
  for (const f of p.flow ?? []) {
    if (loopStepIds.has(f.von)) {
      // Rücksprung-Kante: Rendering-Hinweis am loop-Schritt, NICHT im DAG —
      // ausser sie zeigt "vorwärts" (loop-Schritt hat auch reguläre Folge).
      // Heuristik: Kante aus einem loop-Schritt gilt als Rücksprung, wenn das
      // Ziel in der Dateireihenfolge VOR dem loop-Schritt steht.
      const vonIdx = stepIdByString.get(f.von);
      const nachIdx = stepIdByString.get(f.nach);
      if (nachIdx < vonIdx) {
        const list = loopsBackByStep.get(f.von) ?? [];
        list.push(nachIdx);
        loopsBackByStep.set(f.von, list);
        continue;
      }
    }
    const condition = f.label ? asI18n(f.label) : (f.bedingung ? { de: f.bedingung } : undefined);
    const dep = condition
      ? { step_id: stepIdByString.get(f.von), condition }
      : stepIdByString.get(f.von);
    const list = dependsOnByStep.get(f.nach) ?? [];
    list.push(dep);
    dependsOnByStep.set(f.nach, list);
  }

  out.steps = p.schritte.map((s) => {
    const step = {
      step_id: stepIdByString.get(s.id),
      actor: s.akteur,
      label: asI18n(s.label),
      depends_on: dependsOnByStep.get(s.id) ?? [],
    };
    if (s.referenzen?.length) {
      step.reference_ids = s.referenzen.map((rid) => refIdByString.get(rid));
    }
    if (s.typ) step.type = s.typ;
    if (s.beschreibung) step.description = asI18n(s.beschreibung);
    if (s.unterlagen?.length) {
      step.documents = s.unterlagen.map((u) => ({
        label: asI18n(u.label),
        ...(u.url ? { url: u.url } : {}),
        ...(u.pflicht !== undefined ? { required: u.pflicht } : {}),
      }));
    }
    if (s.quelle) step.source_id = s.quelle;
    const back = loopsBackByStep.get(s.id);
    if (back?.length) step.loops_back_to = back;
    return step;
  });

  if (p.rechtsgrundlagen) {
    out.legal_basis = p.rechtsgrundlagen.map((r) => ({
      label: r.bezeichnung,
      ...(r.url ? { url: r.url } : {}),
    }));
  }
  if (quellen.length) {
    out.sources = quellen.map((q) => ({
      id: q.id,
      title: q.titel,
      url: q.url,
      retrieved_at: q.abgerufen,
    }));
  }
  if (p.reife) out.reife = p.reife;
  if (p.meta) out.meta = p.meta;
  return out;
}

const cities = await readdir(PROZESSE_ROOT);
let migrated = 0;
for (const city of cities) {
  const cityDir = path.join(PROZESSE_ROOT, city);
  let files;
  try { files = (await readdir(cityDir)).filter((f) => f.endsWith('.json')); }
  catch { continue; }

  const slugRenames = new Map(); // alter slug → neuer slug
  for (const file of files) {
    const abs = path.join(cityDir, file);
    const p = JSON.parse(await readFile(abs, 'utf-8'));
    if (p.schema_version) { console.log(`  skip ${city}/${file} (bereits Vertrag)`); continue; }
    const out = transform(p);
    const newFile = `${out.id}.json`;
    slugRenames.set(`${city}/${p.id}`, `${city}/${out.id}`);
    console.log(`${WRITE ? '✓' : '~'} ${city}/${file}${newFile !== file ? ` → ${city}/${newFile}` : ''}`);
    if (WRITE) {
      await writeFile(abs, JSON.stringify(out, null, 2) + '\n');
      if (newFile !== file) await rename(abs, path.join(cityDir, newFile));
    }
    migrated++;
  }

  // Lebenslagen-Verlinkung an neue Slugs anpassen.
  const lebFile = path.join(projectRoot, 'data', city, 'lebenslagen.json');
  try {
    const leb = JSON.parse(await readFile(lebFile, 'utf-8'));
    let changed = false;
    for (const l of leb.lebenslagen ?? []) {
      if (!l.prozesse) continue;
      const mapped = l.prozesse.map((slug) => slugRenames.get(slug) ?? slug);
      if (JSON.stringify(mapped) !== JSON.stringify(l.prozesse)) {
        l.prozesse = mapped;
        changed = true;
      }
    }
    if (changed) {
      console.log(`${WRITE ? '✓' : '~'} data/${city}/lebenslagen.json (prozesse[]-Slugs)`);
      if (WRITE) await writeFile(lebFile, JSON.stringify(leb, null, 2) + '\n');
    }
  } catch { /* Stadt ohne Lebenslagen-Datei */ }
}
console.log(`\n${migrated} migriert${WRITE ? '' : ' (Dry-Run — mit --write anwenden)'}`);
