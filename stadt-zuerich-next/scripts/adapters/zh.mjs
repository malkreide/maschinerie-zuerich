// Zürich-Adapter für den DataSourceAdapter-Kontrakt (siehe index.mjs).
// Wrappt die RPK-API (fd_rpktool) von Open Data Zürich.
//
// Andere Städte schreiben ein analoges <city>.mjs mit ihren eigenen Calls.
// Diese Datei bleibt Single-Source-of-Truth für alles ZH-spezifische auf
// der Fetch-Seite.

import { fetchRpk, readJSON, log } from '../_lib.mjs';

/** /departemente + /institutionen → data/raw/ */
async function fetchStructure({ force = false } = {}) {
  log('fetching RPK structural data', force ? '(force)' : '(cached if available)');

  const dep = await fetchRpk('/departemente', {
    cachePath: 'data/raw/rpktool-departemente.json', force,
  });
  log(`  departemente: ${dep.value.length}`);

  const inst = await fetchRpk('/institutionen', {
    cachePath: 'data/raw/rpktool-institutionen.json', force,
  });
  log(`  institutionen: ${inst.value.length}`);

  // Sanity-Check: jede Institution muss ein departement haben.
  const orphan = inst.value.filter(i => !i.departement?.kurzname);
  if (orphan.length) log(`  WARN: ${orphan.length} Institutionen ohne Departement`);
}

/** /sachkonto2stellig pro Departement → data/raw/ */
async function fetchBudget({
  force = false,
  jahr = Number(process.env.BUDGET_JAHR) || (new Date().getFullYear() - 1),
  betragstyp = process.env.BUDGET_BETRAGSTYP || 'GEMEINDERAT_BESCHLUSS',
} = {}) {
  const dep = await readJSON('data/raw/rpktool-departemente.json');
  log(`fetching budget – jahr=${jahr}, betragsTyp=${betragstyp}`);

  for (const d of dep.value) {
    const ep = `/sachkonto2stellig?departement=${d.key}&jahr=${jahr}&betragsTyp=${betragstyp}`;
    const cache = `data/raw/rpktool-budget-${d.kurzname.trim()}-${jahr}-${betragstyp}.json`;
    try {
      const r = await fetchRpk(ep, { cachePath: cache, force });
      log(`  ${d.kurzname.padEnd(4)} ${(d.bezeichnung).padEnd(40)} → ${r.value.length} rows`);
    } catch (err) {
      log(`  ${d.kurzname} FEHLER: ${err.message.split('\n')[0]}`);
    }
  }
}

/** Spawn-Helfer für die Enrich-Schritte. Die bestehenden enrich-*.mjs
 *  bleiben eigenständige Scripts — der Adapter sagt dem Orchestrator nur,
 *  welche und in welcher Reihenfolge. Neue Städte tauschen diese Liste gegen
 *  ihre eigenen aus (oder lassen sie leer, wenn sie die org-chart.json
 *  manuell pflegen). */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));

function runScript(script) {
  return new Promise((ok, fail) => {
    const p = spawn(process.execPath, [resolve(HERE, '..', script)], { stdio: 'inherit' });
    p.on('exit', code => code === 0 ? ok() : fail(new Error(`${script} exit ${code}`)));
  });
}

/** Build-Pipeline: Reihenfolge der Schritte für `npm run data:fetch`.
 *  Force-Flag wird durch den Orchestrator via setter `setForce` durchgereicht. */
let _force = false;
function setForce(v) { _force = !!v; }

const pipeline = [
  ['fetch:structure',  () => fetchStructure({ force: _force })],
  ['enrich:structure', () => runScript('enrich-from-rpktool.mjs')],
  ['fetch:budget',     () => fetchBudget({ force: _force })],
  ['enrich:budget',    () => runScript('enrich-budget.mjs')],
  ['enrich:fte',       () => runScript('enrich-fte-proxy.mjs')],
  ['enrich:fte-pdf',   () => runScript('enrich-fte-from-pdf.mjs')],
];

export default {
  id: 'zh',
  fetchStructure,
  fetchBudget,
  pipeline,
  setForce,
};
