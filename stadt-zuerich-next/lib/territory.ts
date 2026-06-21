// Brücke Geo-Standort → zuständige Verfahren.
//
// Die Territory-Karte zeigt städtische Standorte; jedes Geo-Feature trägt einen
// Departements-Code (z. B. "SSD", "TED"). Diese Datei leitet — ausschliesslich
// aus vorhandenen Modelldaten — ab, welche modellierten Verfahren einem
// Departement zugeordnet sind, und schlägt so die Brücke vom Ort zum Prozess.
//
// Grundlage ist die bestehende einheit_ref-Brücke (actors[].einheit_ref →
// Prozesse, siehe lib/prozesse). Ein einheit_ref ist entweder eine Org-Einheit
// (deren parent ein Departement ist) oder direkt ein Departements-Code. Beide
// Fälle werden auf den Departements-Code aufgelöst und gruppiert.
//
// WICHTIG (Kardinalregel): hier entsteht keine bindende Aussage. Die Zuordnung
// spiegelt nur, welche unserer Modelle eine Stelle dieses Departements als
// Akteur führen — eine Aussage ÜBER unsere Darstellung, kein Rechtswert.

import { buildEinheitProzesseMap, type ProzessIndexEntry } from '@/lib/prozesse';
import { loadStadtData } from '@/lib/data';

/**
 * Departements-Code → Verfahren, an denen eine Einheit dieses Departements
 * beteiligt ist. Serialisierbares Plain-Object (für RSC/API-Auslieferung).
 */
export async function buildDepartmentProzesseMap(): Promise<Record<string, ProzessIndexEntry[]>> {
  const [einheitMap, data] = await Promise.all([buildEinheitProzesseMap(), loadStadtData()]);

  const deptIds = new Set(data.departments.map((d) => d.id));
  const unitParent = new Map(data.units.map((u) => [u.id, u.parent]));

  // einheit_ref auf seinen Departements-Code auflösen: direkter Code, sonst
  // über die parent-Kette der Einheit hochlaufen, bis ein Departement erreicht ist.
  function resolveDepartment(einheitRef: string): string | null {
    if (deptIds.has(einheitRef)) return einheitRef;
    let cur: string | undefined = unitParent.get(einheitRef);
    const seen = new Set<string>();
    while (cur && !deptIds.has(cur) && !seen.has(cur)) {
      seen.add(cur);
      cur = unitParent.get(cur);
    }
    return cur && deptIds.has(cur) ? cur : null;
  }

  const result: Record<string, ProzessIndexEntry[]> = {};
  for (const [einheitRef, prozesse] of Object.entries(einheitMap)) {
    const dept = resolveDepartment(einheitRef);
    if (!dept) continue;
    const bucket = (result[dept] ??= []);
    for (const p of prozesse) {
      if (!bucket.some((e) => e.id === p.id && e.city === p.city)) bucket.push(p);
    }
  }

  // Deterministische Reihenfolge für stabile Auslieferung.
  for (const key of Object.keys(result)) {
    result[key].sort((a, b) => a.id.localeCompare(b.id));
  }
  return result;
}
