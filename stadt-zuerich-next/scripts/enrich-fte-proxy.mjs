// Schätzt FTE pro Einheit aus dem Personalaufwand (HRM2-Sachkonto 30).
//
// Es gibt im OGD-Katalog der Stadt Zürich keinen Datensatz mit FTE pro
// Dienstabteilung. Gefunden wurden nur stadtweite Beschäftigtenstatistiken
// (BFS, alle Firmen) – nichts verwaltungs-internes.
//
// Pragma: FTE_proxy = Personalaufwand / vollkosten_pro_fte
//
// 'vollkosten' = Bruttolohn + Soz.versicherung + PK-Beiträge etc., also der
// gesamte Personalaufwand pro durchschnittliches FTE. Referenz aus
// Stadt-Zürich-Geschäftsberichten der letzten Jahre: ~130'000 CHF/FTE
// (gemittelt über Verwaltung, Lehrpersonen, Industriebetriebe).
//
// ENV:
//   FTE_VOLLKOSTEN  Default: 130000
//
// Schreibt pro Einheit:
//   fte: { schaetzung: <number>, methode: 'personalaufwand/vollkosten',
//          vollkostenProFte: <number>, jahr: <yyyy>, typ: <…> }

import { promises as fs } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT, ORG_CHART_PATH, readJSON, writeJSON, log } from './_lib.mjs';

const VOLLKOSTEN  = Number(process.env.FTE_VOLLKOSTEN) || 130000;
const JAHR        = Number(process.env.BUDGET_JAHR) || (new Date().getFullYear() - 1);
const BETRAGS_TYP = process.env.BUDGET_BETRAGSTYP    || 'GEMEINDERAT_BESCHLUSS';

async function loadAllRows() {
  const dir = resolve(ROOT, 'data/raw');
  const files = await fs.readdir(dir);
  const rel = files.filter(f => f.startsWith('rpktool-budget-') &&
                                 f.endsWith(`-${JAHR}-${BETRAGS_TYP}.json`));
  if (!rel.length) throw new Error(
    `Keine Budget-Caches gefunden für ${JAHR}/${BETRAGS_TYP} – ` +
    `zuerst 'node scripts/fetch-budget.mjs' laufen lassen.`);
  const all = [];
  for (const f of rel) {
    const j = await readJSON(`data/raw/${f}`);
    for (const r of j.value) all.push(r);
  }
  return all;
}

async function main() {
  const data = await readJSON(ORG_CHART_PATH);
  const rows = await loadAllRows();

  // Personalaufwand pro Institution: nur Sachkonto "30"
  const persByInst = new Map();
  for (const r of rows) {
    if (String(r.sachkonto) !== '30') continue;
    const v = Number(r.betrag);
    if (!Number.isFinite(v)) continue;
    persByInst.set(r.institution, (persByInst.get(r.institution) || 0) + v);
  }
  log(`personalaufwand für ${persByInst.size} Institutionen geladen`);

  const meta = { jahr: JAHR, typ: BETRAGS_TYP, methode: 'personalaufwand/vollkosten',
                 vollkostenProFte: VOLLKOSTEN };
  let written = 0;

  const apply = item => {
    const key = item.odz?.key;
    if (!key) return;
    const pers = persByInst.get(key);
    if (!Number.isFinite(pers) || pers <= 0) return;
    item.fte = { ...meta, schaetzung: Math.round(pers / VOLLKOSTEN), personalaufwand: Math.round(pers) };
    written++;
  };
  data.units.forEach(apply);

  // Departement-Aggregat (analog zu enrich-budget.mjs).
  // Wird unten von enrich-fte-from-pdf.mjs überschrieben, falls publizierte
  // Werte vorliegen — der Aggregat-Wert dient als Fallback.
  for (const dep of data.departments) {
    const matches = data.units.filter(u =>
      u.odz?.departementKurzname === dep.odz?.kurzname && u.fte && u.fte.personalaufwand);
    if (!matches.length) {
      delete dep.fte;
      continue;
    }
    const persSum = matches.reduce((s, u) => s + u.fte.personalaufwand, 0);
    dep.fte = { ...meta,
                schaetzung: Math.round(persSum / VOLLKOSTEN),
                personalaufwand: persSum,
                _aggregiertAus: matches.length };
    written++;
  }

  data._meta = data._meta || {};
  data._meta.fteHinweis = `FTE sind Schätzungen aus Personalaufwand / ${VOLLKOSTEN} CHF — kein direkter OGD-Datensatz verfügbar.`;

  await writeJSON(ORG_CHART_PATH, data);
  log(`enriched FTE-Schätzung auf ${written} items → ${ORG_CHART_PATH}`);
}

main().catch(err => { console.error(err); process.exit(1); });
