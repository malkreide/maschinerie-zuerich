// Holt Strukturdaten von der Finanzdaten-API (rpkk-rs/v1) und cached sie
// nach data/raw/. Quelle: data.stadt-zuerich.ch → fd_rpktool
//
//   /departemente   → 10 Departemente (BUG + 9 städtische)
//   /institutionen  → ~113 Institutionen mit departement-Referenz
//
// Aufruf: node scripts/fetch-rpktool.mjs [--force]
//   --force  ignoriert vorhandenen Cache und holt neu

import { fetchRpk, log } from './_lib.mjs';

const force = process.argv.includes('--force');

async function main() {
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

main().catch(err => { console.error(err); process.exit(1); });
