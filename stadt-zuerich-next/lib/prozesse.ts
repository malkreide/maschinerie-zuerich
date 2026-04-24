// Server-seitiger Loader für Verwaltungsprozesse (OpenGov-Process-Schema).
// Liest alle JSON-Dateien aus /data/prozesse/<city>/*.json, validiert minimal
// und gibt typisiert zurück. Wird von /prozesse-Routen in Server-Components
// aufgerufen.

import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { Prozess, Schritt } from '@/types/prozess';

const PROZESSE_ROOT_SEGMENTS = ['data', 'prozesse'] as const;

export interface ProzessIndexEntry {
  id: string;
  city: string;
  slug: string; // city/id, URL-safe
  titel: Prozess['titel'];
  kurzbeschreibung?: Prozess['kurzbeschreibung'];
  version: string;
}

function prozessRoot(): string {
  return path.join(process.cwd(), ...PROZESSE_ROOT_SEGMENTS);
}

/** Liefert eine flache Liste aller bekannten Prozesse (alle Städte).
 *  Failed-soft: Fehler in einzelnen Dateien loggen, aber nicht werfen. */
export async function listProzesse(): Promise<ProzessIndexEntry[]> {
  const root = prozessRoot();
  let cities: string[];
  try {
    cities = await fs.readdir(root);
  } catch {
    return [];
  }

  const entries: ProzessIndexEntry[] = [];
  for (const city of cities) {
    const cityDir = path.join(root, city);
    const stat = await fs.stat(cityDir).catch(() => null);
    if (!stat?.isDirectory()) continue;

    const files = await fs.readdir(cityDir);
    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      try {
        const raw = await fs.readFile(path.join(cityDir, file), 'utf-8');
        const p = JSON.parse(raw) as Prozess;
        const errors = validateProzess(p);
        if (errors.length > 0) {
          console.warn(`[prozesse] ${city}/${file} skipped:`, errors);
          continue;
        }
        entries.push({
          id: p.id,
          city: p.city,
          slug: `${p.city}/${p.id}`,
          titel: p.titel,
          kurzbeschreibung: p.kurzbeschreibung,
          version: p.version,
        });
      } catch (err) {
        console.warn(`[prozesse] cannot read ${city}/${file}:`, err);
      }
    }
  }
  return entries.sort((a, b) => {
    if (a.city !== b.city) return a.city.localeCompare(b.city);
    return a.id.localeCompare(b.id);
  });
}

/** Lädt einen einzelnen Prozess by city + id. Gibt null zurück, wenn nicht gefunden
 *  oder ungültig. */
export async function loadProzess(city: string, id: string): Promise<Prozess | null> {
  // Defensives Path-Handling: verhindere Directory-Traversal, auch wenn diese
  // Werte i.d.R. aus generateStaticParams kommen.
  if (!/^[a-z0-9-]+$/.test(city) || !/^[a-z0-9-]+$/.test(id)) return null;
  const file = path.join(prozessRoot(), city, `${id}.json`);
  try {
    const raw = await fs.readFile(file, 'utf-8');
    const p = JSON.parse(raw) as Prozess;
    const errors = validateProzess(p);
    if (errors.length > 0) {
      console.warn(`[prozesse] ${city}/${id} invalid:`, errors);
      return null;
    }
    return p;
  } catch {
    return null;
  }
}

/** Minimale strukturelle Validierung — genug, um kaputte Graphen (tote Referenzen)
 *  vom Rendering fernzuhalten. Volle JSON-Schema-Validierung läuft im CI
 *  via ajv, nicht zur Render-Zeit (Performance). */
export function validateProzess(p: Prozess): string[] {
  const errs: string[] = [];
  if (!p.id || !p.version || !p.city) errs.push('missing id/version/city');
  if (!Array.isArray(p.akteure) || p.akteure.length === 0) errs.push('akteure missing');
  if (!Array.isArray(p.schritte) || p.schritte.length === 0) errs.push('schritte missing');
  if (!Array.isArray(p.flow)) errs.push('flow missing');
  if (errs.length) return errs;

  const akteurIds = new Set(p.akteure.map((a) => a.id));
  const schrittIds = new Set(p.schritte.map((s) => s.id));

  for (const s of p.schritte) {
    if (!akteurIds.has(s.akteur)) errs.push(`schritt ${s.id} references unknown akteur ${s.akteur}`);
  }
  for (const f of p.flow) {
    if (!schrittIds.has(f.von)) errs.push(`flow ${f.von}->${f.nach}: unknown 'von'`);
    if (!schrittIds.has(f.nach)) errs.push(`flow ${f.von}->${f.nach}: unknown 'nach'`);
  }

  // Warnung (nicht Fehler): genau ein Start-Knoten empfohlen.
  const starts = p.schritte.filter((s: Schritt) => s.typ === 'start');
  if (starts.length === 0) errs.push('no start node');

  return errs;
}

/** Für generateStaticParams in app/[locale]/prozesse/[city]/[id]/page.tsx */
export async function listProzessParams(): Promise<Array<{ city: string; id: string }>> {
  const entries = await listProzesse();
  return entries.map((e) => ({ city: e.city, id: e.id }));
}

/**
 * Baut die komplette einheit_ref → Prozesse-Map in einem Durchlauf —
 * effizienter als findProzesseForEinheit pro Einheit, wenn man den
 * kompletten invertierten Index braucht (z. B. zum Vorberechnen im
 * Server-Component und anschliessenden Übergeben an den DetailPanel).
 * Ergebnis ist als Plain-Object serialisierbar (wichtig für RSC → Client-
 * Component Prop-Passing).
 */
export async function buildEinheitProzesseMap(): Promise<Record<string, ProzessIndexEntry[]>> {
  const root = prozessRoot();
  let cities: string[];
  try { cities = await fs.readdir(root); } catch { return {}; }
  const map: Record<string, ProzessIndexEntry[]> = {};
  for (const city of cities) {
    const cityDir = path.join(root, city);
    const st = await fs.stat(cityDir).catch(() => null);
    if (!st?.isDirectory()) continue;
    for (const file of await fs.readdir(cityDir)) {
      if (!file.endsWith('.json')) continue;
      try {
        const raw = await fs.readFile(path.join(cityDir, file), 'utf-8');
        const p = JSON.parse(raw) as Prozess;
        if (validateProzess(p).length > 0) continue;
        const entry: ProzessIndexEntry = {
          id: p.id,
          city: p.city,
          slug: `${p.city}/${p.id}`,
          titel: p.titel,
          kurzbeschreibung: p.kurzbeschreibung,
          version: p.version,
        };
        for (const a of p.akteure ?? []) {
          if (!a.einheit_ref) continue;
          const bucket = map[a.einheit_ref] ??= [];
          if (!bucket.some((e) => e.id === entry.id && e.city === entry.city)) {
            bucket.push(entry);
          }
        }
      } catch {
        // skip file silently
      }
    }
  }
  // Deterministische Reihenfolge für stabile Snapshot-Tests.
  for (const key of Object.keys(map)) {
    map[key].sort((a, b) => a.id.localeCompare(b.id));
  }
  return map;
}

/**
 * Reverse-Lookup für die Org-Chart-Brücke: gibt alle Prozesse zurück,
 * die eine gegebene Einheit referenzieren (über akteure[].einheit_ref).
 * Wird im DetailPanel der Hauptansicht verwendet, um "Diese Stelle ist
 * an folgenden Verfahren beteiligt" anzuzeigen.
 *
 * Implementiert naiv: lädt alle Prozesse und filtert. Für unsere Grössen-
 * ordnung (<100 Prozesse) unproblematisch. Falls irgendwann nötig, könnte
 * der Loader einen invertierten Index im Speicher halten.
 */
export async function findProzesseForEinheit(einheitId: string): Promise<ProzessIndexEntry[]> {
  if (!einheitId) return [];
  const root = prozessRoot();
  let cities: string[];
  try {
    cities = await fs.readdir(root);
  } catch {
    return [];
  }

  const matches: ProzessIndexEntry[] = [];
  for (const city of cities) {
    const cityDir = path.join(root, city);
    const st = await fs.stat(cityDir).catch(() => null);
    if (!st?.isDirectory()) continue;

    for (const file of await fs.readdir(cityDir)) {
      if (!file.endsWith('.json')) continue;
      try {
        const raw = await fs.readFile(path.join(cityDir, file), 'utf-8');
        const p = JSON.parse(raw) as Prozess;
        if (validateProzess(p).length > 0) continue;
        if ((p.akteure ?? []).some((a) => a.einheit_ref === einheitId)) {
          matches.push({
            id: p.id,
            city: p.city,
            slug: `${p.city}/${p.id}`,
            titel: p.titel,
            kurzbeschreibung: p.kurzbeschreibung,
            version: p.version,
          });
        }
      } catch {
        // skip file silently
      }
    }
  }
  return matches.sort((a, b) => a.id.localeCompare(b.id));
}
