#!/usr/bin/env node
// Validiert alle Prozess-JSONs unter data/prozesse/<city>/*.json
// gegen schemas/opengov-process-schema.json.
//
// Drei Stufen:
//   1. Formale Validierung via ajv (JSON-Schema draft-07) — inkl. Format-
//      Checks für uri/date. Schlägt bei Pflichtfeldern, falschen Typen,
//      ungültigen Enums an.
//   2. Semantische Validierung — das Schema kann keine Referenzen prüfen:
//      - Schritt.akteur muss in akteure[].id existieren
//      - Flow.von/nach muss in schritte[].id existieren, kein Selbstbezug
//      - Jeder Knoten sollte vom Start aus erreichbar sein (Warnung)
//      - Schritt.quelle (falls gesetzt) muss in quellen[].id existieren
//      - Bei Entscheidungs-Schritten sollte mindestens eine ausgehende Flow-
//        Kante eine bedingung tragen
//      - Generation 2 (docs/process-data-contract.md im Repo-Root):
//        - schritte[].id und referenzen[].id eindeutig
//        - schritte[].referenzen verweisen auf existierende referenzen
//        - Grounding-Gate: Referenz mit status 'verifiziert' (oder ohne
//          status) braucht ein nicht-leeres zitat (Fehler); status
//          'unverifiziert' mit leerem zitat ist eine Warnung
//        - Azyklisch bis auf Rücksprünge: ohne die Kanten, die von
//          typ='loop'-Schritten ausgehen, muss der Graph ein DAG sein
//        - Kardinalregel-Lint: Zahl + bindende Einheit (CHF, Fr., Franken,
//          %, Tag(e), Woche(n), Monat(e), Jahr(e)) in Schritt-Labels,
//          Beschreibungen, Flow-Labels, Voraussetzungen, Referenz-Labels
//        oder KPI-Werten ist ein FEHLER — bindende Werte nur als Referenz
//        - lebenslage_ref muss in data/<city>/lebenslagen.json existieren
//          und die Lebenslage muss zurückverlinken (prozesse[] enthält
//          '<city>/<id>')
//   3. Cross-Reference gegen Org-Chart-JSON (Org-Chart-Brücke):
//      - akteure[].einheit_ref muss als ID einer Unit/Department/Beteiligung
//        in der Stadt-spezifischen Org-Chart-JSON existieren
//      - Mapping city → Pfad lebt in config/city.config.json. Aktuell ist
//        nur ZH konfiguriert. Andere Städte überspringen den Check mit
//        einer Warnung, bis ihre eigene Konfiguration ergänzt wurde.
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

// Mapping city → Pfad der zugehörigen Org-Chart-JSON. Single Source of Truth
// ist config/city.config.json, damit TS-Code (loadStadtData) und dieses
// Node-Skript exakt denselben Pfad benutzen. Aktuell ist nur eine Stadt
// konfiguriert; Multi-City kommt mit einer späteren Config-Erweiterung.
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

// --- Kardinalregel-Lint -----------------------------------------------------
// Bindende Werte (Zahl + Einheit) dürfen NUR im 'zitat' einer Referenz stehen.
// Muss zur Heuristik in migrate-prozesse-schema-v2.mjs passen.
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
        errors.push(`Kardinalregel: bindender Wert im Klartext (${where}${suffix}): "${v.slice(0, 80)}" — gehört als Referenz (Label + Link + Zitat), nicht ins Label`);
      }
    }
  };
  check('titel', prozess.titel);
  check('kurzbeschreibung', prozess.kurzbeschreibung);
  for (const s of prozess.schritte ?? []) {
    check(`schritt '${s.id}'.label`, s.label);
    check(`schritt '${s.id}'.beschreibung`, s.beschreibung);
    for (const u of s.unterlagen ?? []) check(`schritt '${s.id}'.unterlagen[].label`, u.label);
  }
  for (const f of prozess.flow ?? []) check(`flow '${f.von}'->'${f.nach}'.label`, f.label);
  for (const v of prozess.voraussetzungen ?? []) check('voraussetzungen[]', v);
  for (const r of prozess.referenzen ?? []) check(`referenz '${r.id}'.label`, r.label);
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

  const akteurIds = new Set((prozess.akteure ?? []).map((a) => a.id));
  const schrittIds = new Set((prozess.schritte ?? []).map((s) => s.id));
  const quellenIds = new Set((prozess.quellen ?? []).map((q) => q.id));
  const referenzIds = new Set((prozess.referenzen ?? []).map((r) => r.id));

  // Eindeutigkeit der IDs
  if (schrittIds.size !== (prozess.schritte ?? []).length) {
    errors.push('schritte[].id not unique');
  }
  if (referenzIds.size !== (prozess.referenzen ?? []).length) {
    errors.push('referenzen[].id not unique');
  }

  // Schritt-Referenzen
  for (const s of prozess.schritte ?? []) {
    if (!akteurIds.has(s.akteur)) {
      errors.push(`schritt '${s.id}' references unknown akteur '${s.akteur}'`);
    }
    if (s.quelle !== undefined && !quellenIds.has(s.quelle)) {
      errors.push(`schritt '${s.id}' references unknown quelle '${s.quelle}'`);
    }
    for (const refId of s.referenzen ?? []) {
      if (!referenzIds.has(refId)) {
        errors.push(`schritt '${s.id}' references unknown referenz '${refId}'`);
      }
    }
  }

  // Grounding-Gate: verifizierte Referenzen brauchen ein wörtliches Zitat.
  for (const r of prozess.referenzen ?? []) {
    const zitat = (r.zitat ?? '').trim();
    const status = r.status ?? 'verifiziert';
    if (status === 'verifiziert' && zitat === '') {
      errors.push(`referenz '${r.id}': status 'verifiziert' ohne zitat — wörtliche Belegstelle ist Pflicht (Grounding-Gate)`);
    }
    if (status === 'unverifiziert' && zitat === '') {
      warnings.push(`referenz '${r.id}': unverifiziert ohne zitat — Belegstelle nachtragen (siehe docs/process-data-contract.md)`);
    }
  }

  // Flow-Referenzen
  for (const f of prozess.flow ?? []) {
    if (!schrittIds.has(f.von)) errors.push(`flow '${f.von}' -> '${f.nach}': unknown 'von'`);
    if (!schrittIds.has(f.nach)) errors.push(`flow '${f.von}' -> '${f.nach}': unknown 'nach'`);
    if (f.von === f.nach) errors.push(`flow '${f.von}' -> '${f.nach}': self-loop not allowed`);
  }

  // Azyklisch bis auf Rücksprünge: ohne die Kanten, die von typ='loop'-
  // Schritten ausgehen, muss der Graph ein DAG sein. Rücksprünge
  // (Nachbesserung) sind nur über explizit markierte loop-Schritte erlaubt.
  {
    const loopIds = new Set(
      (prozess.schritte ?? []).filter((s) => s.typ === 'loop').map((s) => s.id),
    );
    const adj = new Map((prozess.schritte ?? []).map((s) => [s.id, []]));
    for (const f of prozess.flow ?? []) {
      if (loopIds.has(f.von)) continue;
      if (adj.has(f.von) && adj.has(f.nach)) adj.get(f.von).push(f.nach);
    }
    const state = new Map(); // 0 = unbesucht, 1 = im Stack, 2 = fertig
    const cycleAt = [];
    const dfs = (n) => {
      state.set(n, 1);
      for (const m of adj.get(n) ?? []) {
        const st = state.get(m) ?? 0;
        if (st === 1) cycleAt.push(`${n} -> ${m}`);
        else if (st === 0) dfs(m);
      }
      state.set(n, 2);
    };
    for (const id of adj.keys()) if ((state.get(id) ?? 0) === 0) dfs(id);
    if (cycleAt.length > 0) {
      errors.push(`graph has cycle(s) outside loop-steps (${cycleAt.join('; ')}) — Rücksprünge nur via typ 'loop'`);
    }
  }

  // Kardinalregel-Lint (Fehler)
  errors.push(...lintBindingValues(prozess));

  // Erreichbarkeit vom Start aus (Warnung, kein Fehler)
  const starts = (prozess.schritte ?? []).filter((s) => s.typ === 'start').map((s) => s.id);
  if (starts.length === 0) {
    warnings.push('no start node');
  } else if (starts.length > 1) {
    warnings.push(`multiple start nodes: ${starts.join(', ')}`);
  }
  if (starts.length > 0) {
    const adj = new Map();
    for (const s of prozess.schritte) adj.set(s.id, []);
    for (const f of prozess.flow ?? []) {
      if (adj.has(f.von)) adj.get(f.von).push(f.nach);
    }
    const seen = new Set();
    const queue = [...starts];
    while (queue.length) {
      const cur = queue.shift();
      if (seen.has(cur)) continue;
      seen.add(cur);
      for (const nxt of adj.get(cur) ?? []) queue.push(nxt);
    }
    for (const s of prozess.schritte) {
      if (!seen.has(s.id)) warnings.push(`schritt '${s.id}' unreachable from start`);
    }
  }

  // Entscheidungs-Knoten: mindestens eine ausgehende Kante mit 'bedingung'
  for (const s of prozess.schritte ?? []) {
    if (s.typ !== 'entscheidung') continue;
    const out = (prozess.flow ?? []).filter((f) => f.von === s.id);
    if (out.length < 2) {
      warnings.push(`entscheidung '${s.id}' has ${out.length} outgoing edge(s) — decisions usually have ≥2`);
    }
    if (!out.some((f) => f.bedingung)) {
      warnings.push(`entscheidung '${s.id}' has no edge with 'bedingung' label`);
    }
  }

  // Ende-Knoten: keine ausgehenden Kanten
  for (const s of prozess.schritte ?? []) {
    if (s.typ !== 'ende') continue;
    const out = (prozess.flow ?? []).filter((f) => f.von === s.id);
    if (out.length > 0) errors.push(`ende-node '${s.id}' must not have outgoing edges`);
  }

  // Start-Knoten: keine eingehenden Kanten (Warnung — Loops zurück zum Start sind selten sinnvoll)
  for (const s of prozess.schritte ?? []) {
    if (s.typ !== 'start') continue;
    const incoming = (prozess.flow ?? []).filter((f) => f.nach === s.id);
    if (incoming.length > 0) warnings.push(`start-node '${s.id}' has ${incoming.length} incoming edge(s)`);
  }

  return { errors, warnings };
}

// --- Main ----------------------------------------------------------------

async function main() {
  const schema = await loadJson(SCHEMA_PATH);
  // Draft-07. ajv v8 braucht explizit die Draft-Angabe via $schema oder
  // addSchema. Unser Schema hat $schema draft-07, also reicht new Ajv().
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

    // Cross-Check gegen Org-Chart der Stadt (einheit_ref → data.json).
    // Nur bei formal gültigen Dateien, sonst ist akteure evtl. unbrauchbar.
    const refErrors = [];
    if (schemaOk) {
      const cityIds = await loadCityIds(city, cityDataPaths);
      if (cityIds === null) {
        const refs = (data.akteure ?? []).filter((a) => a.einheit_ref);
        if (refs.length > 0) {
          warnings.push(`${refs.length} einheit_ref(s) present but no org-chart data available for city '${city}' — skipping cross-check`);
        }
      } else {
        for (const a of data.akteure ?? []) {
          if (a.einheit_ref && !cityIds.has(a.einheit_ref)) {
            refErrors.push(`akteur '${a.id}'.einheit_ref '${a.einheit_ref}' not found in org-chart for city '${city}'`);
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
      console.error(c.red(`✗ ${rel}: einheit_ref errors`));
      for (const e of refErrors) console.error(c.red(`  - ${e}`));
      anyError = true;
    }
    if (warnings.length > 0) {
      console.error(c.yellow(`⚠ ${rel}: warnings`));
      for (const w of warnings) console.error(c.yellow(`  - ${w}`));
      anyWarn = true;
      if (!hasError) {
        console.log(c.dim(`  (${city}/${file} passes schema + semantic — warnings only)`));
      }
    }
  }

  const summary = `${files.length} file(s) checked.`;
  if (anyError) {
    console.error(c.red(`\n${summary} ✗ Errors found.`));
    process.exit(1);
  }
  if (anyWarn) {
    console.error(c.yellow(`\n${summary} ⚠ Warnings only — ok.`));
  } else {
    console.log(c.green(`\n${summary} ✓ All good.`));
  }
}

main().catch((err) => {
  console.error(c.red(`validate-prozesse crashed: ${err.stack ?? err}`));
  process.exit(2);
});
