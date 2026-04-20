// Reichert data.json mit Referenzdaten aus der RPK-API an.
// Erwartet, dass scripts/fetch-rpktool.mjs vorher gelaufen ist (Cache liegt
// in data/raw/). Schreibt das Resultat zurück nach data.json.
//
// Pro Knoten wird ein Feld 'odz' angefügt:
//   { key, kurzname, bezeichnung, departementKurzname }
//
// Diskrepanzen (z. B. unsere Zuordnung != API-Zuordnung) werden als WARN
// geloggt – nicht stillschweigend überschrieben, weil unsere Strukturierung
// bewusst nach Bürger-Logik sortiert ist und von der RPK-Sicht abweichen kann.

import { readJSON, writeJSON, log } from './_lib.mjs';

async function main() {
  const data    = await readJSON('data.json');
  const depRaw  = await readJSON('data/raw/rpktool-departemente.json');
  const instRaw = await readJSON('data/raw/rpktool-institutionen.json');
  const map     = await readJSON('scripts/mapping/institution-mapping.json');

  // Index für schnellen Lookup. Kurznamen werden getrimmt – die API
  // liefert vereinzelt Trailing-Whitespace (z. B. "SG ").
  const norm = s => (s || '').trim();
  const instByKurzname = new Map(instRaw.value.map(i => [norm(i.kurzname), i]));
  const depByKurzname  = new Map(depRaw.value.map(d => [norm(d.kurzname), d]));

  let stats = { departments: 0, units: 0, missing: 0, conflicts: 0 };

  // Departemente
  for (const dep of data.departments) {
    const targetKurz = map.departments[dep.id];
    if (!targetKurz) continue;
    const odz = depByKurzname.get(targetKurz);
    if (!odz) {
      log(`  WARN dep ${dep.id} → kurzname '${targetKurz}' nicht in API gefunden`);
      stats.missing++;
      continue;
    }
    dep.odz = { key: odz.key, kurzname: odz.kurzname, bezeichnung: odz.bezeichnung };
    stats.departments++;
  }

  // Dienstabteilungen / Stäbe / verselbständigte Betriebe
  for (const u of data.units) {
    const targetKurz = map.units[u.id];
    if (targetKurz === undefined) {
      log(`  WARN unit ${u.id} fehlt im Mapping`);
      continue;
    }
    if (targetKurz === null) continue;

    const odz = instByKurzname.get(targetKurz);
    if (!odz) {
      log(`  WARN unit ${u.id} → kurzname '${targetKurz}' nicht in API gefunden`);
      stats.missing++;
      continue;
    }

    u.odz = {
      key: odz.key,
      kurzname: norm(odz.kurzname),
      bezeichnung: odz.bezeichnung,
      departementKurzname: norm(odz.departement?.kurzname),
    };
    stats.units++;

    // Konflikt-Erkennung: API-Departement vs. unser Departement.
    // Bei Abweichung: 'konflikt' als Feld speichern, damit das UI die
    // Bürger-vs-RPK-Sicht visualisieren kann (statt nur loggen).
    const ourDepKurz = map.departments[u.parent];
    const rpkDepKurz = norm(odz.departement?.kurzname);
    if (ourDepKurz && rpkDepKurz && ourDepKurz !== rpkDepKurz) {
      log(`  CONFLICT ${u.id}: unsere Zuordnung '${u.parent}' (${ourDepKurz}) ` +
          `↔ RPK-Zuordnung '${rpkDepKurz}' – manuell prüfen`);
      u.konflikt = {
        unsereZuordnung: u.parent,
        unsereKurzname:  ourDepKurz,
        rpkKurzname:     rpkDepKurz,
        rpkBezeichnung:  odz.departement?.bezeichnung,
      };
      stats.conflicts++;
    } else {
      delete u.konflikt; // sauber halten, falls Konflikt früher mal bestand
    }
  }

  // Meta-Update
  data._meta = data._meta || {};
  data._meta.angereichert = new Date().toISOString().slice(0, 10);
  data._meta.quelleEnrichment = 'data.stadt-zuerich.ch / fd_rpktool (rpkk-rs/v1)';

  await writeJSON('data.json', data);

  log('---');
  log(`enriched: ${stats.departments} departments, ${stats.units} units`);
  log(`missing:  ${stats.missing}`);
  log(`conflicts: ${stats.conflicts}`);
}

main().catch(err => { console.error(err); process.exit(1); });
