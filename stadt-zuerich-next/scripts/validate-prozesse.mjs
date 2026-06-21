#!/usr/bin/env node
// Validiert alle Prozess-JSONs unter data/prozesse/<city>/*.json gegen den
// kanonischen Prozess-Datenvertrag (docs/process-data-contract.md im
// Repo-Root; JSON-Schema: schemas/opengov-process-schema.json).
//
// Drei Stufen:
//   1. Formale Validierung via ajv (JSON-Schema draft-07) — inkl. Format-
//      Checks für uri/date. Schlägt bei Pflichtfeldern, falschen Typen,
//      ungültigen Enums an.
//   2. Semantische Validierung — das Schema kann keine Referenzen prüfen:
//      - id == lebenslage_ref (Vertrag)
//      - step_id eindeutig; depends_on verweist nur auf existierende
//        step_ids; kein Selbstbezug; mindestens ein Start-Schritt
//        (leeres depends_on); Graph über depends_on ist azyklisch (DAG)
//      - loops_back_to nur an type-'loop'-Schritten, nur auf existierende
//        step_ids (fliesst NICHT in den DAG-Check ein)
//      - reference_id eindeutig; reference_ids verweisen auf existierende
//        references
//      - Grounding-Gate: Reference mit status 'verifiziert' (oder ohne
//        status) braucht ein nicht-leeres source_quote (Fehler); status
//        'unverifiziert' mit leerem source_quote ist eine Warnung
//      - Kardinalregel-Lint: Zahl + bindende Einheit (CHF, Fr., Franken,
//        %, Tag(e), Woche(n), Monat(e), Jahr(e)) in gerenderten Texten
//        ist ein FEHLER — bindende Werte nur als Reference
//      - steps[].actor referenziert actors[].id (falls actors vorhanden);
//        steps[].source_id referenziert sources[].id
//   3. Cross-Reference gegen Stadt-Daten:
//      - actors[].einheit_ref existiert im Org-Chart der Stadt
//      - lebenslage_ref existiert in data/<city>/lebenslagen.json und die
//        Lebenslage verlinkt zurück (prozesse[] enthält '<city>/<id>')
//      - Städte ohne Daten überspringen die Checks mit Warnung
//
// Exit-Code: 0 = alles gut. 1 = Fehler. Warnungen stehen auf stderr, brechen
// aber nicht ab.

import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, '..');
const SCHEMA_PATH = path.join(projectRoot, 'schemas', 'opengov-process-schema.json');
const PROZESSE_ROOT = path.join(projectRoot, 'data', 'prozesse');
const CITY_CONFIG_PATH = path.join(projectRoot, 'config', 'city.config.json');

// Mapping city → Pfade der Stadt-Daten. Single Source of Truth ist
// config/city.config.json, damit TS-Code (loadStadtData) und dieses
// Node-Skript exakt dieselben Pfade benutzen.
async function loadCityDataPaths() {
  const cfg = JSON.parse(await readFile(CITY_CONFIG_PATH, 'utf-8'));
  return {
    [cfg.id]: {
      orgChart: path.join(projectRoot, cfg.orgChartPath),
      lebenslagen: cfg.lebenslagenPath ? path.join(projectRoot, cfg.lebenslagenPath) : null,
    },
  };
}

// --- Colors ---------------------------------------------------------------
const isTTY = process.stdout.isTTY && !process.env.NO_COLOR;
const c = {
  red:   (s) => isTTY ? `\x1b[31m${s}\x1b[0m` : s,
  green: (s) => isTTY ? `\x1b[32m${s}\x1b[0m` : s,
  yellow:(s) => isTTY ? `\x1b[33m${s}\x1b[0m` : s,
  dim:   (s) => isTTY ? `\x1b[2m${s}\x1b[0m` : s,
};

// --- Helpers --------------------------------------------------------------

async function loadJson(file) {
  return JSON.parse(await readFile(file, 'utf-8'));
}

async function listProzessFiles() {
  const files = [];
  let cities;
  try {
    cities = await readdir(PROZESSE_ROOT);
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
  for (const city of cities) {
    const cityDir = path.join(PROZESSE_ROOT, city);
    const st = await stat(cityDir).catch(() => null);
    if (!st?.isDirectory()) continue;
    const entries = await readdir(cityDir);
    for (const e of entries) {
      if (e.endsWith('.json')) {
        files.push({ city, file: e, abs: path.join(cityDir, e) });
      }
    }
  }
  return files;
}

function formatAjvError(err) {
  const loc = err.instancePath || '/';
  return `${loc}: ${err.message}${err.params ? ' ' + JSON.stringify(err.params) : ''}`;
}

const depId = (d) => (typeof d === 'number' ? d : d.step_id);
const depCondition = (d) => (typeof d === 'number' ? undefined : d.condition);

// Cache: city → Set of known unit IDs (oder null wenn kein Mapping).
const cityIdsCache = new Map();
async function loadCityIds(city, cityDataPaths) {
  if (cityIdsCache.has(city)) return cityIdsCache.get(city);
  const file = cityDataPaths[city]?.orgChart;
  if (!file) {
    cityIdsCache.set(city, null);
    return null;
  }
  try {
    const data = await loadJson(file);
    const ids = new Set([
      ...(data.departments ?? []).map((d) => d.id),
      ...(data.units ?? []).map((u) => u.id),
      ...(data.beteiligungen ?? []).map((b) => b.id),
    ]);
    cityIdsCache.set(city, ids);
    return ids;
  } catch {
    cityIdsCache.set(city, null);
    return null;
  }
}

// Cache: city → Map lebenslageId → Set der verlinkten Prozess-Slugs
// (oder null, wenn die Stadt keine Lebenslagen-Datei hat).
const cityLebenslagenCache = new Map();
async function loadCityLebenslagen(city, cityDataPaths) {
  if (cityLebenslagenCache.has(city)) return cityLebenslagenCache.get(city);
  const file = cityDataPaths[city]?.lebenslagen;
  if (!file) {
    cityLebenslagenCache.set(city, null);
    return null;
  }
  try {
    const data = await loadJson(file);
    const map = new Map(
      (data.lebenslagen ?? []).map((l) => [l.id, new Set(l.prozesse ?? [])]),
    );
    cityLebenslagenCache.set(city, map);
    return map;
  } catch {
    cityLebenslagenCache.set(city, null);
    return null;
  }
}

// --- Hochrisiko-Rechtsfälle -------------------------------------------------
// Kanonische Liste der Hochrisiko-Fälle pro Stadt (CLAUDE.md, Abschnitt
// «Hochrisiko-Rechtsfälle»). Diese tragen verpflichtend den sichtbaren
// Hochrisiko-Disclaimer; der Key darf nur an ihnen stehen.
const HIGH_RISK_KEY = 'Prozesse.disclaimerHochrisiko';
const HIGH_RISK_IDS = {
  zh: new Set(['baugesuch', 'sozialhilfe', 'veranstaltung']),
};

// --- Kardinalregel-Lint -----------------------------------------------------
// Bindende Werte (Zahl + Einheit) dürfen NUR im source_quote einer Reference
// stehen.
const BINDING_VALUE_RE =
  /(\d[\d'’.,\s–-]*\s*(CHF|Fr\.|Franken|%|Tag(e|en)?|Woche(n)?|Monat(e|en)?|Jahr(e|en)?|Arbeitstag(e|en)?|Kalendertag(e|en)?)\b)|((CHF|Fr\.)\s*\d)|(\d\s*%)/i;

function* i18nValues(s) {
  if (s == null) return;
  if (typeof s === 'string') { yield ['', s]; return; }
  for (const [loc, v] of Object.entries(s)) {
    if (typeof v === 'string') yield [`.${loc}`, v];
  }
}

function lintBindingValues(prozess) {
  const errors = [];
  const check = (where, s) => {
    for (const [suffix, v] of i18nValues(s)) {
      if (BINDING_VALUE_RE.test(v)) {
        errors.push(`Kardinalregel: bindender Wert im Klartext (${where}${suffix}): "${v.slice(0, 80)}" — gehört als Reference (Label + Link + source_quote), nicht ins Label`);
      }
    }
  };
  check('title', prozess.title);
  check('description', prozess.description);
  for (const s of prozess.steps ?? []) {
    check(`step ${s.step_id}.label`, s.label);
    check(`step ${s.step_id}.description`, s.description);
    for (const d of s.depends_on ?? []) check(`step ${s.step_id}.depends_on.condition`, depCondition(d));
    for (const u of s.documents ?? []) check(`step ${s.step_id}.documents[].label`, u.label);
  }
  for (const v of prozess.preconditions ?? []) check('preconditions[]', v);
  for (const r of prozess.references ?? []) check(`reference ${r.reference_id}.label`, r.label);
  const reife = prozess.reife;
  if (reife) {
    check('reife.onceOnlyPotenzial', reife.onceOnlyPotenzial);
    for (const v of reife.nutzergruppen ?? []) check('reife.nutzergruppen[]', v);
    for (const v of reife.painPoints ?? []) check('reife.painPoints[]', v);
    for (const v of reife.improvementIdeas ?? []) check('reife.improvementIdeas[]', v);
    for (const k of reife.wirkungKpi ?? []) {
      check('reife.wirkungKpi[].label', k.label);
      if (typeof k.wert === 'string' && BINDING_VALUE_RE.test(k.wert)) {
        errors.push(`Kardinalregel: bindender Wert in reife.wirkungKpi.wert: "${k.wert.slice(0, 80)}"`);
      }
    }
  }
  return errors;
}

function semanticCheck(prozess) {
  const errors = [];
  const warnings = [];

  // Vertrag: id == lebenslage_ref
  if (prozess.id !== prozess.lebenslage_ref) {
    errors.push(`id '${prozess.id}' != lebenslage_ref '${prozess.lebenslage_ref}' — der Vertrag fordert Gleichheit`);
  }

  const stepIds = new Set((prozess.steps ?? []).map((s) => s.step_id));
  if (stepIds.size !== (prozess.steps ?? []).length) {
    errors.push('steps[].step_id not unique');
  }

  const refIds = new Set((prozess.references ?? []).map((r) => r.reference_id));
  if (refIds.size !== (prozess.references ?? []).length) {
    errors.push('references[].reference_id not unique');
  }

  const actorIds = prozess.actors ? new Set(prozess.actors.map((a) => a.id)) : null;
  const sourceIds = new Set((prozess.sources ?? []).map((q) => q.id));

  let startCount = 0;
  for (const s of prozess.steps ?? []) {
    if ((s.depends_on ?? []).length === 0) startCount++;
    for (const d of s.depends_on ?? []) {
      const id = depId(d);
      if (!stepIds.has(id)) errors.push(`step ${s.step_id}: depends_on ${id} unbekannt`);
      if (id === s.step_id) errors.push(`step ${s.step_id}: Selbstbezug in depends_on`);
    }
    for (const rid of s.reference_ids ?? []) {
      if (!refIds.has(rid)) errors.push(`step ${s.step_id}: reference_id ${rid} unbekannt`);
    }
    if (actorIds && !actorIds.has(s.actor)) {
      errors.push(`step ${s.step_id}: actor '${s.actor}' nicht in actors[]`);
    }
    if (s.source_id !== undefined && !sourceIds.has(s.source_id)) {
      errors.push(`step ${s.step_id}: source_id '${s.source_id}' nicht in sources[]`);
    }
    if (s.loops_back_to) {
      if (s.type !== 'loop') {
        errors.push(`step ${s.step_id}: loops_back_to nur an Schritten mit type 'loop' erlaubt`);
      }
      for (const id of s.loops_back_to) {
        if (!stepIds.has(id)) errors.push(`step ${s.step_id}: loops_back_to ${id} unbekannt`);
      }
    }
  }
  if (startCount === 0) errors.push('kein Start-Schritt (leeres depends_on)');

  // DAG-Check über depends_on (loops_back_to fliesst nicht ein).
  {
    const preds = new Map(
      (prozess.steps ?? []).map((s) => [s.step_id, (s.depends_on ?? []).map(depId)]),
    );
    const state = new Map(); // 0 = unbesucht, 1 = im Stack, 2 = fertig
    const cycles = [];
    const dfs = (n) => {
      state.set(n, 1);
      for (const m of preds.get(n) ?? []) {
        const st = state.get(m) ?? 0;
        if (st === 1) cycles.push(`${n} -> ${m}`);
        else if (st === 0) dfs(m);
      }
      state.set(n, 2);
    };
    for (const id of preds.keys()) if ((state.get(id) ?? 0) === 0) dfs(id);
    if (cycles.length > 0) {
      errors.push(`Zyklus in depends_on (${cycles.join('; ')}) — der Graph muss ein DAG sein; Rücksprünge gehören in loops_back_to`);
    }
  }

  // Erreichbarkeit von den Start-Schritten aus (Warnung).
  {
    const succ = new Map((prozess.steps ?? []).map((s) => [s.step_id, []]));
    for (const s of prozess.steps ?? []) {
      for (const d of s.depends_on ?? []) succ.get(depId(d))?.push(s.step_id);
    }
    const seen = new Set();
    const queue = (prozess.steps ?? []).filter((s) => (s.depends_on ?? []).length === 0).map((s) => s.step_id);
    while (queue.length) {
      const cur = queue.shift();
      if (seen.has(cur)) continue;
      seen.add(cur);
      for (const nxt of succ.get(cur) ?? []) queue.push(nxt);
    }
    for (const s of prozess.steps ?? []) {
      if (!seen.has(s.step_id)) warnings.push(`step ${s.step_id} vom Start aus unerreichbar`);
    }
  }

  // Grounding-Gate: verifizierte References brauchen ein wörtliches Zitat.
  for (const r of prozess.references ?? []) {
    const quote = (r.source_quote ?? '').trim();
    const status = r.status ?? 'verifiziert';
    if (status === 'verifiziert' && quote === '') {
      errors.push(`reference ${r.reference_id}: status 'verifiziert' ohne source_quote — wörtliche Belegstelle ist Pflicht (Grounding-Gate)`);
    }
    if (status === 'unverifiziert' && quote === '') {
      warnings.push(`reference ${r.reference_id}: unverifiziert ohne source_quote — Belegstelle nachtragen (siehe docs/process-data-contract.md)`);
    }
  }

  // Kardinalregel-Lint (Fehler)
  errors.push(...lintBindingValues(prozess));

  // Hochrisiko-Disclaimer-Gate (CLAUDE.md): definierte Hochrisiko-Rechtsfälle
  // MÜSSEN den sichtbaren Hochrisiko-Disclaimer tragen (disclaimer_key
  // 'Prozesse.disclaimerHochrisiko'); umgekehrt darf dieser Key nur an genau
  // diesen Fällen stehen, damit die rote UI-Hervorhebung nicht verwässert.
  const hrSet = HIGH_RISK_IDS[prozess.city];
  if (hrSet) {
    const isHR = prozess.disclaimer_key === HIGH_RISK_KEY;
    const shouldHR = hrSet.has(prozess.id);
    if (shouldHR && !isHR) {
      errors.push(`Hochrisiko-Fall '${prozess.id}' ohne disclaimer_key '${HIGH_RISK_KEY}' — der sichtbare Hochrisiko-Disclaimer ist Pflicht (CLAUDE.md)`);
    }
    if (!shouldHR && isHR) {
      errors.push(`disclaimer_key '${HIGH_RISK_KEY}' an '${prozess.id}', das nicht als Hochrisiko-Fall gelistet ist — HIGH_RISK_IDS in validate-prozesse.mjs und CLAUDE.md abgleichen`);
    }
  }

  return { errors, warnings };
}

// --- Main ----------------------------------------------------------------

async function main() {
  const schema = await loadJson(SCHEMA_PATH);
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats.default ? addFormats.default(ajv) : addFormats(ajv);
  const validate = ajv.compile(schema);

  const cityDataPaths = await loadCityDataPaths();

  const files = await listProzessFiles();
  if (files.length === 0) {
    console.log(c.yellow('No prozess files found under data/prozesse/*/'));
    return;
  }

  let anyError = false;
  let anyWarn = false;

  for (const { city, file, abs } of files) {
    const rel = path.relative(projectRoot, abs);
    let data;
    try {
      data = await loadJson(abs);
    } catch (err) {
      console.error(c.red(`✗ ${rel}: invalid JSON — ${err.message}`));
      anyError = true;
      continue;
    }

    const schemaOk = validate(data);
    const { errors: semErrors, warnings } = semanticCheck(data);

    // Dateiname muss der ID entsprechen (URL-Slug <city>/<id>).
    if (file !== `${data.id}.json`) {
      semErrors.push(`Dateiname '${file}' != '${data.id}.json' (id)`);
    }

    // Cross-Checks gegen Stadt-Daten — nur bei formal gültigen Dateien.
    const refErrors = [];
    if (schemaOk) {
      const cityIds = await loadCityIds(city, cityDataPaths);
      if (cityIds === null) {
        const refs = (data.actors ?? []).filter((a) => a.einheit_ref);
        if (refs.length > 0) {
          warnings.push(`${refs.length} einheit_ref(s) present but no org-chart data available for city '${city}' — skipping cross-check`);
        }
      } else {
        for (const a of data.actors ?? []) {
          if (a.einheit_ref && !cityIds.has(a.einheit_ref)) {
            refErrors.push(`actor '${a.id}'.einheit_ref '${a.einheit_ref}' not found in org-chart for city '${city}'`);
          }
        }
      }

      // Lebenslagen-Brücke: lebenslage_ref muss existieren und die
      // Lebenslage muss auf diesen Prozess zurückverlinken (bidirektional).
      const lebenslagen = await loadCityLebenslagen(city, cityDataPaths);
      if (lebenslagen === null) {
        if (data.lebenslage_ref) {
          warnings.push(`lebenslage_ref '${data.lebenslage_ref}' present but no lebenslagen data for city '${city}' — skipping cross-check`);
        }
      } else if (data.lebenslage_ref) {
        const slugs = lebenslagen.get(data.lebenslage_ref);
        if (!slugs) {
          refErrors.push(`lebenslage_ref '${data.lebenslage_ref}' not found in lebenslagen for city '${city}'`);
        } else if (!slugs.has(`${city}/${data.id}`)) {
          refErrors.push(`lebenslage '${data.lebenslage_ref}' does not link back to '${city}/${data.id}' (prozesse[])`);
        }
      }
    }

    const hasError = !schemaOk || semErrors.length > 0 || refErrors.length > 0;
    if (!hasError && warnings.length === 0) {
      console.log(c.green(`✓ ${rel}`));
      continue;
    }

    if (!schemaOk) {
      console.error(c.red(`✗ ${rel}: schema violations`));
      for (const err of validate.errors ?? []) {
        console.error(c.red(`  - ${formatAjvError(err)}`));
      }
      anyError = true;
    }
    if (semErrors.length > 0) {
      console.error(c.red(`✗ ${rel}: semantic errors`));
      for (const e of semErrors) console.error(c.red(`  - ${e}`));
      anyError = true;
    }
    if (refErrors.length > 0) {
      console.error(c.red(`✗ ${rel}: cross-reference errors`));
      for (const e of refErrors) console.error(c.red(`  - ${e}`));
      anyError = true;
    }
    if (warnings.length > 0) {
      anyWarn = true;
      console.error(c.yellow(`⚠ ${rel}: warnings`));
      for (const w of warnings) console.error(c.yellow(`  - ${w}`));
      if (!hasError) {
        console.log(c.dim(`  (${rel} passes schema + semantic — warnings only)`));
      }
    }
  }

  console.log('');
  if (anyError) {
    console.log(`${files.length} file(s) checked. ${c.red('✗ Errors found.')}`);
    process.exit(1);
  }
  console.log(`${files.length} file(s) checked. ${anyWarn ? c.yellow('⚠ Warnings only — ok.') : c.green('✓ All valid.')}`);
}

main().catch((err) => {
  console.error(c.red(`validate-prozesse failed: ${err.message}`));
  process.exit(1);
});
