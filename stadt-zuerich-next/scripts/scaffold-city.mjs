#!/usr/bin/env node
// Scaffold-Helfer für „Fork für neue Stadt".
//
// Erzeugt die Skelett-Dateien, die für eine neue Stadt im Repo liegen
// müssen — ohne existierende Dateien zu überschreiben oder zu löschen.
// Der Fork-Ablauf bleibt damit sicher und nachvollziehbar:
//
//   1. `node scripts/scaffold-city.mjs ge "Genève" "Genf"`
//   2. PORTING.md für die restlichen Schritte (Config umstellen, alte
//      ZH-Dateien aufräumen, i18n-Strings prüfen).
//
// Args:
//   <city-id>        ISO-ähnliche Kleinbuchstaben-Kennung, z.B. 'ge'
//   <city-name>      Vollständiger Name in der Default-Sprache
//                    der Stadt (FR für Genf, DE für Zürich, ...)
//   [short-name]     Kurzform ohne „Ville de "/„Stadt "/etc.;
//                    optional, default = <city-name>
//
// Erzeugt:
//   config/city.config.<id>.json   — Vorlage zum Umbennen auf city.config.json
//   scripts/adapters/<id>.mjs       — Adapter-Stub mit TODO-Kommentaren
//   data/<id>/org-chart.json        — Minimaler valider StadtData
//   data/<id>/lebenslagen.json      — Leere Lebenslagen
//   data/prozesse/<id>/.gitkeep
//   public/brand/<id>-logo.svg      — Kopie des abstrakten ZH-Glyphs
//                                     (ersetzen oder löschen)

import { promises as fs, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(import.meta.url), '..', '..');
const args = process.argv.slice(2);

if (args.length < 2 || args[0] === '--help' || args[0] === '-h') {
  console.error('Usage: node scripts/scaffold-city.mjs <id> <name> [short-name]');
  console.error('Beispiel: node scripts/scaffold-city.mjs ge "Genève" "Genf"');
  process.exit(1);
}

const [id, name, shortName = name] = args;

if (!/^[a-z]{2,}$/.test(id)) {
  console.error(`ID "${id}" ungültig — erwartet: kleinbuchstaben, ≥2 Zeichen.`);
  process.exit(1);
}

console.log(`▶ Scaffolding city "${id}" (${name})…`);

async function writeIfAbsent(relPath, content) {
  const abs = resolve(ROOT, relPath);
  if (existsSync(abs)) {
    console.log(`  ⚠ existiert bereits, übersprungen: ${relPath}`);
    return;
  }
  await fs.mkdir(dirname(abs), { recursive: true });
  await fs.writeFile(abs, content, 'utf8');
  console.log(`  ✓ ${relPath}`);
}

// ─── 1. Config-Vorlage ──────────────────────────────────────────────────────
// Wir schreiben NICHT direkt nach city.config.json — das würde die ZH-Config
// überschreiben. User benennt um, wenn alles andere passt.
const configTemplate = {
  id,
  name: { de: name, en: name, fr: name, it: name, ls: name },
  shortName: { de: shortName, en: shortName, fr: shortName, it: shortName, ls: shortName },
  domain: `TODO-${id}.example`,
  externalSearchUrlTemplate: `https://TODO-${id}.example/?q={q}`,
  homepageUrl: `https://TODO-${id}.example/`,
  orgChartPath: `data/${id}/org-chart.json`,
  lebenslagenPath: `data/${id}/lebenslagen.json`,
  brand: {
    logoPath: `/brand/${id}-logo.svg`,
    logoAlt: {
      de: 'Org-Graph-Glyph (kein offizielles Wappen)',
      en: 'Org-graph glyph (not the official coat of arms)',
      fr: "Symbole d'organigramme (pas les armoiries officielles)",
      it: "Simbolo dell'organigramma (non lo stemma ufficiale)",
      ls: 'Org-Graph-Glyph (nüd s offizielle Wappen)',
    },
  },
  dataSources: {
    // Beispiel-Block — ersetzen durch die tatsächlichen Datenquellen der Stadt.
    // Jeder Key adressiert einen Adapter-Teil: scripts/adapters/<id>.mjs
    // kann ihn lesen.
    // rpk: {
    //   baseUrl: "https://api.<id>.example/v1",
    //   apiKeyEnv: `${id.toUpperCase()}_API_KEY`
    // }
  },
  theme: {
    accent: '#1f3a8a',
    nodeType: {
      stadtpraesidium: '#7a1f2b',
      stadtrat: '#c0392b',
      department: '#e67e22',
      unit: '#3b6ea5',
      staff: '#8b5cf6',
      extern: '#16a085',
      beteiligung: '#f1c40f',
    },
    konflikt: '#e67e22',
    departmentPalette: [
      '#c0392b', '#e67e22', '#f1c40f', '#16a085', '#3b6ea5',
      '#8b5cf6', '#7a1f2b', '#2c7a7b', '#d35400',
    ],
  },
};

await writeIfAbsent(
  `config/city.config.${id}.json`,
  JSON.stringify(configTemplate, null, 2) + '\n',
);

// ─── 2. Adapter-Stub ────────────────────────────────────────────────────────
const adapterStub = `// Adapter für ${name} (${id}) — Kontrakt siehe scripts/adapters/index.mjs.
//
// TODO: Implementiere fetchStructure() und (optional) fetchBudget(), die die
// Open-Data-Endpunkte der Stadt aufrufen und ihre Rohantworten unter
// data/raw/… cachen. Orientier dich an scripts/adapters/zh.mjs für ein
// konkretes Beispiel (Zürich RPK-API).
//
// Wenn die Stadt keine maschinenlesbare API anbietet, pflege
// data/${id}/org-chart.json von Hand und lass fetch*-Methoden weg —
// pipeline kann dann leer sein (\`npm run data:fetch\` ist dann ein No-Op).

import { log } from '../_lib.mjs';

async function fetchStructure({ force = false } = {}) {
  log('TODO: implementiere fetchStructure für ${name}', force ? '(force)' : '');
  throw new Error('fetchStructure noch nicht implementiert für ${id}');
}

const pipeline = [
  // ['fetch:structure', () => fetchStructure({ force: _force })],
  // ['enrich:structure', () => runScript('enrich-<irgendwas>.mjs')],
];

let _force = false;
function setForce(v) { _force = !!v; }

export default {
  id: '${id}',
  fetchStructure,
  pipeline,
  setForce,
};
`;
await writeIfAbsent(`scripts/adapters/${id}.mjs`, adapterStub);

// ─── 3. Minimaler Org-Chart ─────────────────────────────────────────────────
const orgChartSkeleton = {
  stadtrat: [],
  departments: [
    {
      id: 'DEP-TODO',
      name: `Beispiel-Departement (${name})`,
      head: 'TODO',
      color: '#e67e22',
    },
  ],
  units: [],
  beteiligungen: [],
  extern: [],
  lebenslagen: [],
};
await writeIfAbsent(
  `data/${id}/org-chart.json`,
  JSON.stringify(orgChartSkeleton, null, 2) + '\n',
);

// ─── 4. Lebenslagen ─────────────────────────────────────────────────────────
await writeIfAbsent(
  `data/${id}/lebenslagen.json`,
  JSON.stringify({ lebenslagen: [] }, null, 2) + '\n',
);

// ─── 5. Prozesse-Ordner ─────────────────────────────────────────────────────
await writeIfAbsent(`data/prozesse/${id}/.gitkeep`, '');

// ─── 6. Brand-Glyph ─────────────────────────────────────────────────────────
// Kopie des abstrakten ZH-Glyphs, damit der Header nicht leer aussieht.
// Das ist BEWUSST kein Wappen — unterschreibt keinen offiziellen Auftritt.
const zhLogo = await fs.readFile(resolve(ROOT, 'public/brand/zh-logo.svg'), 'utf8')
  .catch(() => null);
if (zhLogo) {
  await writeIfAbsent(`public/brand/${id}-logo.svg`, zhLogo);
}

console.log('\n✓ Scaffold komplett. Nächste Schritte siehe PORTING.md:');
console.log(`  1. Prüfe config/city.config.${id}.json — ersetze TODO-Werte.`);
console.log(`  2. Wenn's passt: mv config/city.config.${id}.json config/city.config.json`);
console.log(`  3. Räume alte Stadt-Dateien auf: data/zh/, scripts/adapters/zh.mjs, public/brand/zh-logo.svg, data/prozesse/zh/.`);
console.log('  4. npm run typecheck && npm run validate:prozesse && npm run build');
