// Dünner Dispatcher: ruft `fetchStructure` des aktuellen Stadt-Adapters auf.
// Die eigentliche API-Logik (RPK für ZH) lebt in scripts/adapters/<id>.mjs.
//
// Name „fetch-rpktool" ist historisch (RPK = Rechnung Produktions Kosten),
// der Script selbst ist stadt-agnostisch. Aufruf: siehe package.json scripts.

import { loadAdapter } from './adapters/index.mjs';
import { log } from './_lib.mjs';

const force = process.argv.includes('--force');

async function main() {
  const adapter = await loadAdapter();
  if (typeof adapter.fetchStructure !== 'function') {
    log(`Adapter "${adapter.id}" implementiert fetchStructure nicht — übersprungen.`);
    return;
  }
  await adapter.fetchStructure({ force });
}

main().catch(err => { console.error(err); process.exit(1); });
