#!/usr/bin/env node
// Bundle-Budget-Gate für die Startseite (CI, nach `next build`).
//
// Motivation (Lösungsanalyse P3): Cytoscape lag monatelang unbemerkt im
// Initial-Bundle der Startseite — auch für Mobile, wo der Graph nie rendert.
// Nichts hätte eine Wiederholung gemeldet. Dieses Gate misst die
// tatsächlich im HTML referenzierten Script-Chunks (First-Load JS) der
// Startseite und schlägt fehl, wenn das Budget überschritten wird.
//
// Messmethode: Produktions-Server kurz starten, /de abrufen, alle
// <script src="/_next/…">-Chunks aus dem HTML ziehen und ihre Dateigrössen
// (unkomprimiert, .next/static/…) summieren. Bewusst über den laufenden
// Server statt über Build-Manifeste — die Manifest-Formate wechseln mit
// Next-/Turbopack-Versionen, das ausgelieferte HTML lügt nicht.
//
// Budget via BUNDLE_BUDGET_KB übersteuerbar (Default unten, mit Luft über
// dem Ist-Wert — das Gate soll Regressionen der Grössenordnung «Cytoscape
// rutscht zurück ins Initial-Bundle» fangen, nicht jedes Kilobyte).
//
// Aufruf: node scripts/check-bundle-budget.mjs   (nach `npm run build`)

import { spawn } from 'node:child_process';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

const PORT = Number(process.env.BUNDLE_CHECK_PORT ?? 3457);
const BUDGET_KB = Number(process.env.BUNDLE_BUDGET_KB ?? 900);
const ROUTE = '/de';

function startServer() {
  // detached: eigene Prozessgruppe. `npx` spawnt `next-server` als Enkel —
  // ein SIGTERM nur an den Wrapper liesse den Server (und damit unsere
  // stderr-Pipe) weiterleben, und der Check hinge bis zum Workflow-Timeout.
  const child = spawn('npx', ['next', 'start', '-p', String(PORT)], {
    cwd: root,
    stdio: ['ignore', 'ignore', 'pipe'],
    detached: true,
    env: { ...process.env, NODE_ENV: 'production' },
  });
  child.stderr.on('data', (d) => process.stderr.write(d));
  return child;
}

function stopServer(child) {
  // Ganze Prozessgruppe beenden (negatives PID), nicht nur den Wrapper.
  try {
    process.kill(-child.pid, 'SIGTERM');
  } catch {
    child.kill('SIGTERM');
  }
}

async function waitForServer(timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://localhost:${PORT}${ROUTE}`, {
        signal: AbortSignal.timeout(3000),
      });
      if (res.ok) return res;
    } catch {
      // Server noch nicht bereit
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Server auf Port ${PORT} nicht erreichbar (Build vorhanden? npm run build)`);
}

const server = startServer();
let failed = false;
try {
  const res = await waitForServer();
  const html = await res.text();

  // Alle Script-Chunks, die die Seite initial lädt.
  const srcs = [...html.matchAll(/<script[^>]+src="(\/_next\/[^"]+\.js)[^"]*"/g)]
    .map((m) => m[1]);
  const unique = [...new Set(srcs)];
  if (unique.length === 0) {
    throw new Error('Keine /_next-Script-Tags im HTML gefunden — Messmethode prüfen.');
  }

  const sized = [];
  let total = 0;
  for (const src of unique) {
    const file = path.join(root, '.next', src.replace(/^\/_next\//, ''));
    const st = await stat(file).catch(() => null);
    if (!st) {
      console.warn(`⚠ Chunk nicht auf Disk gefunden (übersprungen): ${src}`);
      continue;
    }
    total += st.size;
    sized.push({ src, kb: st.size / 1024 });
  }
  sized.sort((a, b) => b.kb - a.kb);

  const totalKb = Math.round(total / 1024);
  console.log(`First-Load JS von ${ROUTE}: ${totalKb} KB unkomprimiert (${unique.length} Chunks), Budget ${BUDGET_KB} KB.`);
  for (const { src, kb } of sized.slice(0, 8)) {
    console.log(`  ${String(Math.round(kb)).padStart(5)} KB  ${src}`);
  }

  if (totalKb > BUDGET_KB) {
    console.error(
      `\n✗ Budget überschritten (${totalKb} KB > ${BUDGET_KB} KB). Ist eine schwere ` +
        'Abhängigkeit (Cytoscape, Leaflet, …) ins Initial-Bundle gerutscht? ' +
        'Lazy-Loading via next/dynamic prüfen (GraphLoader/TreemapLoader-Muster).',
    );
    failed = true;
  } else {
    console.log('✓ Bundle-Budget eingehalten.');
  }
} catch (err) {
  console.error(`✗ ${err.message}`);
  failed = true;
} finally {
  stopServer(server);
}
// Expliziter Exit: verlässt den Prozess auch dann, wenn eine verwaiste
// Server-Pipe die Event-Loop sonst offen halten würde.
process.exit(failed ? 1 : 0);
