// Dünner Dispatcher: ruft `fetchBudget` des aktuellen Stadt-Adapters auf.
// Jahr + Betragstyp werden per ENV gesteuert; der Adapter interpretiert
// diese (nicht jede Stadt unterscheidet zwischen STADTRAT_ANTRAG /
// GEMEINDERAT_BESCHLUSS / RECHNUNG, Bern etc. kennen andere Phasen).
//
//   BUDGET_JAHR        Default: aktuelles Jahr − 1
//   BUDGET_BETRAGSTYP  Default im ZH-Adapter: GEMEINDERAT_BESCHLUSS

import { loadAdapter } from './adapters/index.mjs';
import { log } from './_lib.mjs';

const force = process.argv.includes('--force');

async function main() {
  const adapter = await loadAdapter();
  if (typeof adapter.fetchBudget !== 'function') {
    log(`Adapter "${adapter.id}" implementiert fetchBudget nicht — übersprungen.`);
    return;
  }
  await adapter.fetchBudget({
    force,
    jahr: Number(process.env.BUDGET_JAHR) || undefined,
    betragstyp: process.env.BUDGET_BETRAGSTYP || undefined,
  });
}

main().catch(err => { console.error(err); process.exit(1); });
