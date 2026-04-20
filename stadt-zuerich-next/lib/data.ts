// Server-seitiger Daten-Loader. Liest data.json + lebenslagen.json
// direkt aus dem Public-Verzeichnis. Wird in Server-Components für die
// initial-render aufgerufen.

import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { StadtData, Lebenslage } from '@/types/stadt';

export async function loadStadtData(): Promise<StadtData> {
  const root = process.cwd();
  const dataPath = path.join(root, 'data.json');
  const lebPath  = path.join(root, 'data', 'manual', 'lebenslagen.json');

  const data = JSON.parse(await fs.readFile(dataPath, 'utf-8')) as StadtData;
  try {
    const leb = JSON.parse(await fs.readFile(lebPath, 'utf-8')) as { lebenslagen: Lebenslage[] };
    data.lebenslagen = leb.lebenslagen;
  } catch {
    data.lebenslagen = [];
  }
  return data;
}
