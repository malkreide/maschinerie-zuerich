// Aggregiert die per Departement gecachten /sachkonto2stellig-Daten zu
// 'aufwand' / 'ertrag' pro Institution und schreibt sie in data.json.
//
// HRM2-Konvention:
//   Sachkonto 30…39 = Aufwand
//   Sachkonto 40…49 = Ertrag
//
// Geschrieben wird auf Departement- und Unit-Ebene jeweils:
//   budget: { jahr, typ, aufwand, ertrag, nettoaufwand }

import { promises as fs } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT, readJSON, writeJSON, log } from './_lib.mjs';

const JAHR        = Number(process.env.BUDGET_JAHR) || (new Date().getFullYear() - 1);
const BETRAGS_TYP = process.env.BUDGET_BETRAGSTYP    || 'GEMEINDERAT_BESCHLUSS';

async function loadAllRows() {
  const dir = resolve(ROOT, 'data/raw');
  const files = await fs.readdir(dir);
  const rel = files.filter(f => f.startsWith(`rpktool-budget-`) &&
                                 f.endsWith(`-${JAHR}-${BETRAGS_TYP}.json`));
  if (!rel.length) {
    throw new Error(`Keine Budget-Caches in data/raw/ für jahr=${JAHR}, ` +
                    `typ=${BETRAGS_TYP} – zuerst 'node scripts/fetch-budget.mjs' laufen lassen.`);
  }
  const all = [];
  for (const f of rel) {
    const j = await readJSON(`data/raw/${f}`);
    for (const r of j.value) all.push(r);
  }
  return all;
}

function aggregateByInstitution(rows) {
  // institution-key (string, z. B. "1505") → { aufwand, ertrag }
  const agg = new Map();
  for (const r of rows) {
    const inst = r.institution;
    const sk   = String(r.sachkonto);
    const val  = Number(r.betrag);
    if (!Number.isFinite(val)) continue;
    if (!agg.has(inst)) agg.set(inst, { aufwand: 0, ertrag: 0 });
    const bucket = agg.get(inst);
    if (sk.startsWith('3'))      bucket.aufwand += val;
    else if (sk.startsWith('4')) bucket.ertrag  += val;
  }
  return agg;
}

async function main() {
  const data = await readJSON('data.json');
  const rows = await loadAllRows();
  log(`loaded ${rows.length} sachkonto2stellig rows from cache`);

  const agg = aggregateByInstitution(rows);
  log(`aggregated to ${agg.size} institutions`);

  const meta = { jahr: JAHR, typ: BETRAGS_TYP };
  let written = 0;

  const apply = (item) => {
    const key = item.odz?.key;
    if (!key) return;
    const v = agg.get(key);
    if (!v) return;
    item.budget = {
      ...meta,
      aufwand: Math.round(v.aufwand),
      ertrag:  Math.round(v.ertrag),
      nettoaufwand: Math.round(v.aufwand - v.ertrag),
    };
    written++;
  };

  data.departments.forEach(apply);
  data.units.forEach(apply);

  // Departement-Aggregat aus Units, falls API kein direktes Departement-Total liefert.
  // Wir summieren über alle Units, deren odz.departementKurzname zum Departement passt.
  // Bestehende Aggregate werden überschrieben — sonst altert der Wert, wenn neue
  // Units ins Modell aufgenommen werden.
  for (const dep of data.departments) {
    const matches = data.units.filter(u => u.odz?.departementKurzname === dep.odz?.kurzname && u.budget);
    if (!matches.length) {
      delete dep.budget;
      continue;
    }
    dep.budget = {
      ...meta,
      aufwand: matches.reduce((s, u) => s + u.budget.aufwand, 0),
      ertrag:  matches.reduce((s, u) => s + u.budget.ertrag,  0),
      nettoaufwand: matches.reduce((s, u) => s + u.budget.nettoaufwand, 0),
      _aggregiertAus: matches.length,
    };
    written++;
  }

  data._meta = data._meta || {};
  data._meta.budgetStand = `${JAHR} (${BETRAGS_TYP})`;

  await writeJSON('data.json', data);
  log(`enriched budget on ${written} items → data.json`);
}

main().catch(err => { console.error(err); process.exit(1); });
