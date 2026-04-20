// Orchestrator: ruft alle ETL-Schritte in der richtigen Reihenfolge auf.
// Aufruf: node scripts/build-data.mjs [--force]

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const FORCE = process.argv.includes('--force') ? ['--force'] : [];

const STEPS = [
  ['fetch-rpktool.mjs',       FORCE],
  ['enrich-from-rpktool.mjs', []],
  ['fetch-budget.mjs',        FORCE],
  ['enrich-budget.mjs',       []],
  ['enrich-fte-proxy.mjs',    []],
  ['enrich-fte-from-pdf.mjs', []],
];

function run(script, args) {
  return new Promise((ok, fail) => {
    const p = spawn(process.execPath, [resolve(HERE, script), ...args],
                    { stdio: 'inherit' });
    p.on('exit', code => code === 0 ? ok() : fail(new Error(`${script} exit ${code}`)));
  });
}

for (const [script, args] of STEPS) {
  console.log(`\n▶ ${script} ${args.join(' ')}`);
  await run(script, args);
}
console.log('\n✓ build complete – data.json ist aktualisiert');
