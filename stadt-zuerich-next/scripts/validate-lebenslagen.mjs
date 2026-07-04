#!/usr/bin/env node
// Validiert data/<city>/lebenslagen.json gegen das Org-Chart und die
// Prozessdaten. War vorher als node -e-Heredoc direkt in .github/workflows/
// ci.yml eingebettet — zwei Wahrheiten (CI-Inline vs. Repo-Skripte), die
// auseinanderdriften konnten und lokal nicht ausführbar waren.
//
// Regeln (unverändert aus dem CI-Inline übernommen):
//   1. zustaendig verweist auf eine existierende ID im Org-Chart
//      (center/departments/units/beteiligungen).
//   2. i18n.de.frage und i18n.de.stichworte sind Pflicht.
//   3. zielgruppen (optional) stammen aus der bekannten Taxonomie.
//   4. prozesse[]-Slugs ('<city>/<id>') zeigen auf existierende Dateien
//      unter data/prozesse/.
//   5. Jede VORHANDENE (non-null) Locale ist vollständig (frage + stichworte)
//      — verhindert kaputte Teilübersetzungen. Fehlt eine Locale ganz, ist
//      das ok: die Suche fällt auf de zurück.
//
// Pfade kommen aus config/city.config.json (Single Source of Truth, wie bei
// validate-prozesse.mjs). Exit 0 = valide, 1 = Fehler.

import { readFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, '..');

const LOCALES = ['de', 'en', 'fr', 'it', 'ls'];
// Zielgruppen-Taxonomie — muss mit der UI-Filterung (Zielgruppen-Namespace
// in messages/) übereinstimmen.
const ZIELGRUPPEN = new Set([
  'einwohner', 'unternehmen', 'familie', 'alter', 'schule',
  'migration', 'mobilitaet', 'wohnen', 'gesundheit',
]);

async function loadJson(rel) {
  return JSON.parse(await readFile(path.join(projectRoot, rel), 'utf-8'));
}

const cfg = await loadJson('config/city.config.json');
if (!cfg.lebenslagenPath) {
  console.log(`Keine lebenslagenPath in city.config.json für '${cfg.id}' — nichts zu prüfen.`);
  process.exit(0);
}

const org = await loadJson(cfg.orgChartPath);
const leb = await loadJson(cfg.lebenslagenPath);

const ids = new Set(
  [
    org.center?.id,
    ...(org.departments ?? []).map((x) => x.id),
    ...(org.units ?? []).map((u) => u.id),
    ...(org.beteiligungen ?? []).map((b) => b.id),
  ].filter(Boolean),
);

const problems = [];
for (const e of leb.lebenslagen ?? []) {
  if (!ids.has(e.zustaendig)) problems.push(`${e.id}: unbekannte zustaendig ${e.zustaendig}`);
  if (!e.i18n?.de?.frage || !Array.isArray(e.i18n?.de?.stichworte)) {
    problems.push(`${e.id}: fehlt i18n.de.frage oder .stichworte`);
  }
  if (e.zielgruppen !== undefined) {
    if (!Array.isArray(e.zielgruppen) || e.zielgruppen.length === 0) {
      problems.push(`${e.id}: zielgruppen muss ein nicht-leeres Array sein`);
    } else {
      for (const z of e.zielgruppen) {
        if (!ZIELGRUPPEN.has(z)) problems.push(`${e.id}: unbekannte zielgruppe ${z}`);
      }
    }
  }
  if (e.prozesse !== undefined) {
    if (!Array.isArray(e.prozesse)) {
      problems.push(`${e.id}: prozesse muss ein Array sein`);
    } else {
      for (const slug of e.prozesse) {
        if (!/^[a-z0-9-]+\/[a-z0-9-]+$/.test(slug)) {
          problems.push(`${e.id}: ungueltiger prozess-slug ${slug}`);
          continue;
        }
        const file = path.join(projectRoot, 'data', 'prozesse', `${slug}.json`);
        // eslint-disable-next-line no-await-in-loop
        const exists = await access(file).then(() => true, () => false);
        if (!exists) problems.push(`${e.id}: prozess-referenz ohne Datei: ${slug}`);
      }
    }
  }
  for (const loc of LOCALES) {
    const c = e.i18n?.[loc];
    if (c == null) continue;
    if (typeof c.frage !== 'string' || !c.frage.trim()) problems.push(`${e.id}.${loc}: frage fehlt/leer`);
    if (!Array.isArray(c.stichworte) || c.stichworte.length === 0) problems.push(`${e.id}.${loc}: stichworte fehlen/leer`);
  }
}

if (problems.length) {
  console.error('Probleme:\n  ' + problems.join('\n  '));
  process.exit(1);
}

const counts = LOCALES
  .map((loc) => `${loc}:${(leb.lebenslagen ?? []).filter((e) => e.i18n?.[loc] != null).length}`)
  .join(' ');
console.log(
  `✓ Alle ${(leb.lebenslagen ?? []).length} Lebenslagen valide; Locale-Abdeckung ${counts} ` +
    `(${ids.size} bekannte IDs in org-chart)`,
);
