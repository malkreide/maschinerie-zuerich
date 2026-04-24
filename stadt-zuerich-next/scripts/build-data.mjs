// Orchestrator: führt die Pipeline aus, die der Stadt-Adapter vorgibt.
// Aufruf: node scripts/build-data.mjs [--force]
//
// Der Adapter definiert Reihenfolge & Inhalt der Pipeline — für andere
// Städte ist das also nur ein Austausch von scripts/adapters/<id>.mjs.

import { loadAdapter } from './adapters/index.mjs';

const FORCE = process.argv.includes('--force');

const adapter = await loadAdapter();
if (!Array.isArray(adapter.pipeline) || adapter.pipeline.length === 0) {
  console.error(`Adapter "${adapter.id}" definiert keine pipeline — nichts zu bauen.`);
  process.exit(1);
}
adapter.setForce?.(FORCE);

for (const [name, step] of adapter.pipeline) {
  console.log(`\n▶ ${name}${FORCE ? ' (force)' : ''}`);
  await step();
}
console.log('\n✓ build complete – Org-Chart-Datei ist aktualisiert (Pfad aus config/city.config.json)');
