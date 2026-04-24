// Geteilte Helfer für ETL-Skripte: HTTP-Fetch mit Cache, JSON-IO, Logging.
// Bewusst stdlib-only (Node 20+ hat globales fetch) – kein npm install nötig.

import { promises as fs } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(fileURLToPath(import.meta.url), '..', '..');

// `.env.local` automatisch laden, damit Devs nicht jedes Mal `export …` vor
// den npm-Script-Aufruf setzen müssen. `loadEnvFile` existiert ab Node 21
// (optional-chain, damit ältere Runtimes nicht crashen). Fehlt die Datei,
// wirft die Funktion — dann fallen wir still auf existierende process.env
// zurück (in CI kommen die Keys aus Plattform-Secrets, nicht aus Dateien).
try {
  process.loadEnvFile?.(resolve(ROOT, '.env.local'));
} catch { /* keine .env.local — ok */ }

// Pfad der Org-Chart-JSON + API-Settings aus city.config.json gelesen — so
// teilen sich ETL-Skripte und der Runtime-Loader (lib/data.ts) exakt denselben
// Pfad, und die API-URL ist kein Zürich-Hardcode mehr. Top-level-await ist in
// ESM okay und wird beim ersten Import aufgelöst.
const _cityCfgPath = resolve(ROOT, 'config', 'city.config.json');
const _cityCfg = JSON.parse(await fs.readFile(_cityCfgPath, 'utf8'));
export const CITY_CONFIG = _cityCfg;
export const ORG_CHART_PATH = _cityCfg.orgChartPath;

// RPK-API-Settings. baseUrl steht in city.config.json, der Key NICHT —
// der wird aus der Env-Variable gelesen, deren Name in apiKeyEnv steht.
// `.env.local` ist gitignored; in CI hinterlegt man das Secret als
// Plattform-Variable. Andere Städte setzen eigene dataSources-Einträge
// und adressieren sie über ihren Adapter unter scripts/adapters/<id>.mjs.
const _rpk = _cityCfg.dataSources?.rpk;
export const RPK_API_BASE = _rpk?.baseUrl ?? '';
export const RPK_API_KEY  = _rpk?.apiKeyEnv ? (process.env[_rpk.apiKeyEnv] ?? '') : '';

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

  if (!RPK_API_BASE) {
    throw new Error(
      'dataSources.rpk.baseUrl fehlt in config/city.config.json — RPK-Fetch nicht möglich.'
    );
  }
  if (!RPK_API_KEY) {
    const envName = _rpk?.apiKeyEnv ?? 'RPK_API_KEY';
    throw new Error(
      `Environment-Variable ${envName} nicht gesetzt. ` +
      `Leg die Datei .env.local im Projekt-Root an (siehe .env.example).`
    );
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
