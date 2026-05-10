// Aggregiert die per Departement gecachten /sachkonto2stellig-Daten zu
// 'aufwand' / 'ertrag' pro Institution und schreibt sie in die Org-Chart-
// Datei (Pfad aus city.config.json).
//
// HRM2-Konvention:
//   Sachkonto 30…39 = Aufwand
//   Sachkonto 40…49 = Ertrag
//
// Geschrieben wird auf Departement- und Unit-Ebene jeweils:
//   budget: { jahr, typ, aufwand, ertrag, nettoaufwand }

import { promises as fs } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT, ORG_CHART_PATH, readJSON, writeJSON, log } from './_lib.mjs';

const RECENT_JAHR = Number(process.env.BUDGET_JAHR) || (new Date().getFullYear() - 1);
const BETRAGS_TYP = process.env.BUDGET_BETRAGSTYP    || 'RECHNUNG';

async function loadAllRows() {
  const dir = resolve(ROOT, 'data/raw');
  const files = await fs.readdir(dir);
  
  const rel = files.filter(f => f.startsWith(`rpktool-budget-`) &&
                                 f.endsWith(`-${BETRAGS_TYP}.json`));
  if (!rel.length) {
    throw new Error(`Keine Budget-Caches in data/raw/ für typ=${BETRAGS_TYP}`);
  }
  const all = [];
  for (const f of rel) {
    const match = f.match(/rpktool-budget-.*?-(20\d\d)-/);
    if (!match) continue;
    const jahr = Number(match[1]);
    const j = await readJSON(`data/raw/${f}`);
    for (const r of j.value) {
      all.push({ ...r, _jahr: jahr });
    }
  }
  return all;
}

function aggregateByInstitution(rows) {
  // institution-key -> Map(jahr -> { aufwand, ertrag })
  const agg = new Map();
  for (const r of rows) {
    const inst = r.institution;
    const jahr = r._jahr;
    const sk   = String(r.sachkonto);
    const val  = Number(r.betrag);
    if (!Number.isFinite(val)) continue;
    
    if (!agg.has(inst)) agg.set(inst, new Map());
    const instAgg = agg.get(inst);
    if (!instAgg.has(jahr)) instAgg.set(jahr, { aufwand: 0, ertrag: 0 });
    
    const bucket = instAgg.get(jahr);
    if (sk.startsWith('3'))      bucket.aufwand += val;
    else if (sk.startsWith('4')) bucket.ertrag  += val;
  }
  return agg;
}

async function main() {
  const data = await readJSON(ORG_CHART_PATH);
  const rows = await loadAllRows();
  log(`loaded ${rows.length} sachkonto2stellig rows from cache`);

  const agg = aggregateByInstitution(rows);
  log(`aggregated to ${agg.size} institutions`);

  const apply = (item) => {
    const key = item.odz?.key;
    if (!key) return;
    const instAgg = agg.get(key);
    if (!instAgg) return;
    
    const history = [];
    for (const [jahr, v] of instAgg.entries()) {
      history.push({
        jahr,
        typ: BETRAGS_TYP,
        aufwand: Math.round(v.aufwand),
        ertrag:  Math.round(v.ertrag),
        nettoaufwand: Math.round(v.aufwand - v.ertrag),
      });
    }
    history.sort((a, b) => a.jahr - b.jahr);
    
    if (history.length > 0) {
      item.budgetHistory = history;
      // Get the most recent one for 'budget'
      item.budget = history[history.length - 1];
    }
  };

  data.departments.forEach(apply);
  data.units.forEach(apply);

  // Departement-Aggregat
  for (const dep of data.departments) {
    const matches = data.units.filter(u => u.odz?.departementKurzname === dep.odz?.kurzname && u.budgetHistory);
    if (!matches.length) {
      delete dep.budget;
      delete dep.budgetHistory;
      continue;
    }
    
    const depHistoryMap = new Map();
    for (const u of matches) {
      for (const h of u.budgetHistory) {
        if (!depHistoryMap.has(h.jahr)) {
          depHistoryMap.set(h.jahr, { aufwand: 0, ertrag: 0, nettoaufwand: 0, _aggregiertAus: 0 });
        }
        const b = depHistoryMap.get(h.jahr);
        b.aufwand += h.aufwand;
        b.ertrag += h.ertrag;
        b.nettoaufwand += h.nettoaufwand;
        b._aggregiertAus++;
      }
    }
    
    const depHistory = Array.from(depHistoryMap.entries()).map(([jahr, b]) => ({
      jahr,
      typ: BETRAGS_TYP,
      aufwand: b.aufwand,
      ertrag: b.ertrag,
      nettoaufwand: b.nettoaufwand,
      _aggregiertAus: b._aggregiertAus,
    })).sort((a, b) => a.jahr - b.jahr);
    
    dep.budgetHistory = depHistory;
    if (depHistory.length > 0) {
      dep.budget = depHistory[depHistory.length - 1];
    }
  }

  data._meta = data._meta || {};
  data._meta.budgetStand = `${RECENT_JAHR} (${BETRAGS_TYP})`;

  await writeJSON(ORG_CHART_PATH, data);
  log(`enriched budget history → ${ORG_CHART_PATH}`);
}

main().catch(err => { console.error(err); process.exit(1); });
