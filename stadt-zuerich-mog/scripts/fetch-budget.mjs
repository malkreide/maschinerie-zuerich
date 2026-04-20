// Holt Budget-/Rechnungs-Beträge pro Departement über /sachkonto2stellig.
// Ein Call pro Departement, Resultat liegt in data/raw/rpktool-budget-<DEP>.json.
//
// ENV:
//   BUDGET_JAHR        Default: aktuelles Jahr − 1
//   BUDGET_BETRAGSTYP  Default: GEMEINDERAT_BESCHLUSS
//                      (Optionen: STADTRAT_ANTRAG | GEMEINDERAT_BESCHLUSS | RECHNUNG)
//
// Quelle: data.stadt-zuerich.ch / fd_rpktool – API-Doku siehe
// https://opendatazurich.github.io/rpk-api/

import { fetchRpk, readJSON, log } from './_lib.mjs';

const JAHR        = Number(process.env.BUDGET_JAHR) || (new Date().getFullYear() - 1);
const BETRAGS_TYP = process.env.BUDGET_BETRAGSTYP    || 'GEMEINDERAT_BESCHLUSS';
const FORCE       = process.argv.includes('--force');

async function main() {
  const dep = await readJSON('data/raw/rpktool-departemente.json');
  log(`fetching budget – jahr=${JAHR}, betragsTyp=${BETRAGS_TYP}`);

  for (const d of dep.value) {
    const ep = `/sachkonto2stellig?departement=${d.key}&jahr=${JAHR}&betragsTyp=${BETRAGS_TYP}`;
    const cache = `data/raw/rpktool-budget-${d.kurzname.trim()}-${JAHR}-${BETRAGS_TYP}.json`;
    try {
      const r = await fetchRpk(ep, { cachePath: cache, force: FORCE });
      log(`  ${d.kurzname.padEnd(4)} ${(d.bezeichnung).padEnd(40)} → ${r.value.length} rows`);
    } catch (err) {
      log(`  ${d.kurzname} FEHLER: ${err.message.split('\n')[0]}`);
    }
  }
}

main().catch(err => { console.error(err); process.exit(1); });
