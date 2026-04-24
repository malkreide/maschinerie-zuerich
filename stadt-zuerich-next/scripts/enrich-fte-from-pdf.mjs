// Überschreibt den FTE-Proxy mit Werten, die manuell aus Budget-/Rechnungs-
// PDFs extrahiert wurden (data/manual/fte-publiziert.json).
//
// Hintergrund: Stadt Zürich publiziert FTE pro Dienstabteilung NICHT
// flächendeckend in den Budget-/Rechnungs-PDFs. Recherche-Stand:
//   - Hauptbudget, Hauptrechnung: keine Stellenpläne (nur Narrative-Deltas)
//   - Globalbudgets/Globalbudget-Rechnung: nur ewz Netzbetrieb (PG2) +
//     Steueramt total geben echte FTE-Zeitreihen
//   - Anstalten: einzelne Stiftungen (PWG, SAW) geben VZS, aber andere nicht
//
// Ausserdem kein OGD-Datensatz im Open-Data-Katalog (geprüft mit personal,
// personalbestand, mitarbeitende, vollzeitaequivalente, stellen, lohn,
// anstellung, beschaeftigte).
//
// Workflow: dieses Skript LÄUFT NACH enrich-fte-proxy.mjs und ersetzt nur
// dort, wo wir verifizierte Werte haben. Restliche Einheiten behalten ihre
// Schätzung. Im 'fte'-Objekt wird 'quelle' gesetzt:
//   'pdf'        → publizierter Wert aus PDF
//   'schaetzung' → Proxy aus Personalaufwand

import { ORG_CHART_PATH, readJSON, writeJSON, log } from './_lib.mjs';

async function main() {
  const data      = await readJSON(ORG_CHART_PATH);
  const overrides = await readJSON('data/manual/fte-publiziert.json');

  let replaced = 0;
  // Index für schnellen Zugriff
  const byId = new Map([
    ...data.units.map(u => [u.id, u]),
    ...data.departments.map(d => [d.id, d]),
  ]);

  // Erst alle Schätzungen markieren
  for (const [, item] of byId) {
    if (item.fte && typeof item.fte === 'object' && !item.fte.quelle) {
      item.fte.quelle = 'schaetzung';
    }
  }

  for (const o of overrides.werte) {
    const item = byId.get(o.id);
    if (!item) {
      log(`  WARN: id '${o.id}' nicht in ${ORG_CHART_PATH} gefunden`);
      continue;
    }
    item.fte = {
      schaetzung: o.wert,
      einheit: o.einheit,
      jahr: o.jahr,
      quelle: 'pdf',
      quelleDetail: o.quelle,
      quelleUrl: o.url,
      phase: o.phase,
    };
    replaced++;
    log(`  ${o.id}: ${o.wert} ${o.einheit} ← ${o.quelle.split(',')[0]}`);
  }

  data._meta = data._meta || {};
  data._meta.fteOverridesAus = 'data/manual/fte-publiziert.json';
  data._meta.fteHinweis =
    'FTE-Werte sind primär Schätzungen (Personalaufwand / 130\'000 CHF). ' +
    `${replaced} Einheit(en) haben publizierte Werte aus Budget-/Rechnungs-PDFs.`;

  await writeJSON(ORG_CHART_PATH, data);
  log(`---\nreplaced ${replaced} FTE-Werte mit publizierten PDF-Daten`);
}

main().catch(err => { console.error(err); process.exit(1); });
