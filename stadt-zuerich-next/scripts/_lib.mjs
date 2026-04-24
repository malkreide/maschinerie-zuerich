// Geteilte Helfer für ETL-Skripte: HTTP-Fetch mit Cache, JSON-IO, Logging.
// Bewusst stdlib-only (Node 20+ hat globales fetch) – kein npm install nötig.

import { promises as fs } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(fileURLToPath(import.meta.url), '..', '..');

// Pfad der Org-Chart-JSON relativ zum Projekt-Root, aus city.config.json
// gelesen — so teilen sich ETL-Skripte und der Runtime-Loader (lib/data.ts)
// exakt denselben Pfad. Top-level-await ist in ESM okay und wird beim ersten
// Import aufgelöst.
const _cityCfgPath = resolve(ROOT, 'config', 'city.config.json');
const _cityCfg = JSON.parse(await fs.readFile(_cityCfgPath, 'utf8'));
export const ORG_CHART_PATH = _cityCfg.orgChartPath;

// data.stadt-zuerich.ch hat den API-Key in den Open-Data-Metadaten publiziert.
// Override via Umgebungsvariable möglich, falls die Stadt den Key rotiert.
export const RPK_API_BASE = 'https://api.stadt-zuerich.ch/rpkk-rs/v1';
export const RPK_API_KEY  = process.env.RPK_API_KEY
  || 'vopVcmhIMkeUCf8gQjk1GgU2wK+fKihAdlCl0WKJ';

export function log(...args) {
  const ts = new Date().toISOString().slice(11, 19);
  console.log(`[${ts}]`, ...args);
}

export async function readJSON(path) {
  const txt = await fs.readFile(resolve(ROOT, path), 'utf8');
  return JSON.parse(txt);
}

export async function writeJSON(path, data) {
  const full = resolve(ROOT, path);
  await fs.mkdir(dirname(full), { recursive: true });
  await fs.writeFile(full, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

// Fetch mit api-key-Header und einfachem Disk-Cache.
// Fehler werfen früh – jeder Caller entscheidet, ob er das fängt.
export async function fetchRpk(endpoint, { cachePath, force = false } = {}) {
  if (cachePath && !force) {
    try {
      const cached = await readJSON(cachePath);
      log(`cache hit ${endpoint} → ${cachePath}`);
      return cached;
    } catch { /* kein Cache, weiter zu fetch */ }
  }

  const url = `${RPK_API_BASE}${endpoint}`;
  log(`GET ${url}`);
  const res = await fetch(url, { headers: { 'api-key': RPK_API_KEY } });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`RPK ${endpoint} → HTTP ${res.status}\n${body.slice(0, 400)}`);
  }
  const data = await res.json();
  if (cachePath) await writeJSON(cachePath, data);
  return data;
}
