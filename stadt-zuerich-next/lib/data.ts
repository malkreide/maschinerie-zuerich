// Server-seitiger Daten-Loader. Liest Org-Chart + Lebenslagen-JSON vom
// Disk. Der Pfad der Org-Chart-Datei kommt aus config/city.config.json
// (orgChartPath) — so bleibt die Datei-Struktur ein Fork-Detail der
// jeweiligen Stadt und wird nicht im Code fixiert.

import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { StadtData, Lebenslage } from '@/types/stadt';
import { city } from '@/config/city.config';

export async function loadStadtData(): Promise<StadtData> {
  const root = process.cwd();
  const dataPath = path.join(root, city.orgChartPath);
  const lebPath  = path.join(root, city.lebenslagenPath);

  const data = JSON.parse(await fs.readFile(dataPath, 'utf-8')) as StadtData;
  try {
    const leb = JSON.parse(await fs.readFile(lebPath, 'utf-8')) as { lebenslagen: Lebenslage[] };
    data.lebenslagen = leb.lebenslagen;
  } catch {
    data.lebenslagen = [];
  }
  return data;
}
