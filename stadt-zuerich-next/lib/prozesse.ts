// Server-seitiger Loader für Verwaltungsprozesse (OpenGov-Process-Schema).
// Liest alle JSON-Dateien aus /data/prozesse/<city>/*.json, validiert minimal
// und gibt typisiert zurück. Wird von /prozesse-Routen in Server-Components
// aufgerufen.
//
// Architektur: loadAllProzesse() ist die EINZIGE I/O-Quelle (ein Verzeichnis-
// Walk); alle Index- und Map-Funktionen sind reine In-Memory-Ableitungen
// darauf. Vorher hielt jede der vier Abfragen ihren eigenen Walk samt
// dupliziertem Parse-/Validate-Boilerplate — jede Änderung an der Projektion
// musste vierfach nachgezogen werden.

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { dependsOnId, type Prozess, type OnlineReifegrad, type ProzessStatus } from '@/types/prozess';

const PROZESSE_ROOT_SEGMENTS = ['data', 'prozesse'] as const;

// Stabile Index-Projektion für Konsumenten (DetailPanel, Anliegen, Sitemap):
// Feldnamen bleiben deutsch, auch wenn der Datenvertrag englische Feldnamen
// nutzt — das Mapping passiert genau hier.
export interface ProzessIndexEntry {
  id: string;
  city: string;
  slug: string; // city/id, URL-safe
  titel: Prozess['title'];
  kurzbeschreibung?: Prozess['description'];
  version: string;
  onlineReifegrad?: OnlineReifegrad; // aus reife.onlineReifegrad, für Index-Badge
  status?: ProzessStatus;
  /** Anzahl Schritte — Komplexitäts-Hinweis im Index. */
  schritteCount?: number;
  /** true, wenn der Prozess den Hochrisiko-Disclaimer trägt
   *  (disclaimer_key === 'Prozesse.disclaimerHochrisiko') — Index-Badge. */
  hochrisiko?: boolean;
}

function prozessRoot(): string {
  return path.join(process.cwd(), ...PROZESSE_ROOT_SEGMENTS);
}

/** Der eine Verzeichnis-Walk: alle gültigen Prozesse aller Städte.
 *  Failed-soft: Fehler in einzelnen Dateien loggen, aber nicht werfen. */
async function walkProzesse(): Promise<Prozess[]> {
  const root = prozessRoot();
  let cities: string[];
  try {
    cities = await fs.readdir(root);
  } catch {
    return [];
  }

  const out: Prozess[] = [];
  for (const city of cities) {
    const cityDir = path.join(root, city);
    const stat = await fs.stat(cityDir).catch(() => null);
    if (!stat?.isDirectory()) continue;

    for (const file of await fs.readdir(cityDir)) {
      if (!file.endsWith('.json')) continue;
      try {
        const raw = await fs.readFile(path.join(cityDir, file), 'utf-8');
        const p = JSON.parse(raw) as Prozess;
        const errors = validateProzess(p);
        if (errors.length > 0) {
          console.warn(`[prozesse] ${city}/${file} skipped:`, errors);
          continue;
        }
        out.push(p);
      } catch (err) {
        console.warn(`[prozesse] cannot read ${city}/${file}:`, err);
      }
    }
  }
  return out;
}

// Im Production-/Build-Kontext ändern sich die Daten-Dateien nicht mehr —
// ein einziger Walk genügt für alle statisch generierten Seiten. Im Dev-Modus
// bewusst KEIN Cache, damit Daten-Edits ohne Neustart sichtbar bleiben.
let prodCache: Promise<Prozess[]> | null = null;
export function loadAllProzesse(): Promise<Prozess[]> {
  if (process.env.NODE_ENV !== 'production') return walkProzesse();
  return (prodCache ??= walkProzesse());
}

/** Volle Index-Projektion (mit Reife-/Hochrisiko-Badges). */
function toIndexEntry(p: Prozess): ProzessIndexEntry {
  return {
    id: p.id,
    city: p.city,
    slug: `${p.city}/${p.id}`,
    titel: p.title,
    kurzbeschreibung: p.description,
    version: p.schema_version,
    onlineReifegrad: p.reife?.onlineReifegrad,
    status: p.reife?.status,
    schritteCount: p.steps.length,
    hochrisiko: p.disclaimer_key === 'Prozesse.disclaimerHochrisiko',
  };
}

/** Leichte Projektion ohne Badge-Felder — für Maps, die als Props an
 *  Client-Components serialisiert werden (Payload klein halten). */
function toLightEntry(p: Prozess): ProzessIndexEntry {
  return {
    id: p.id,
    city: p.city,
    slug: `${p.city}/${p.id}`,
    titel: p.title,
    kurzbeschreibung: p.description,
    version: p.schema_version,
  };
}

/** Liefert eine flache Liste aller bekannten Prozesse (alle Städte). */
export async function listProzesse(): Promise<ProzessIndexEntry[]> {
  const entries = (await loadAllProzesse()).map(toIndexEntry);
  return entries.sort((a, b) => {
    if (a.city !== b.city) return a.city.localeCompare(b.city);
    return a.id.localeCompare(b.id);
  });
}

/** Lädt einen einzelnen Prozess by city + id. Gibt null zurück, wenn nicht
 *  gefunden oder ungültig. Bewusst als direkter Einzeldatei-Read (kein Walk). */
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
 *  vom Rendering fernzuhalten. Volle Vertrags-Validierung läuft im CI
 *  via ajv (validate:prozesse), nicht zur Render-Zeit (Performance). */
export function validateProzess(p: Prozess): string[] {
  const errs: string[] = [];
  if (!p.id || !p.schema_version || !p.city) errs.push('missing id/schema_version/city');
  if (!Array.isArray(p.steps) || p.steps.length === 0) errs.push('steps missing');
  if (errs.length) return errs;

  const actorIds = p.actors ? new Set(p.actors.map((a) => a.id)) : null;
  const stepIds = new Set(p.steps.map((s) => s.step_id));

  for (const s of p.steps) {
    if (actorIds && !actorIds.has(s.actor)) errs.push(`step ${s.step_id} references unknown actor ${s.actor}`);
    for (const d of s.depends_on ?? []) {
      if (!stepIds.has(dependsOnId(d))) errs.push(`step ${s.step_id}: depends_on ${dependsOnId(d)} unknown`);
    }
  }

  // Mindestens ein Start-Schritt (leeres depends_on).
  if (!p.steps.some((s) => (s.depends_on ?? []).length === 0)) errs.push('no start step');

  return errs;
}

/**
 * slug ("<city>/<id>") → ProzessIndexEntry. Auflösungstabelle für die
 * explizite Lebenslage→Prozess-Verknüpfung (lebenslage.prozesse[]).
 * Unbekannte Slugs erscheinen nicht in der Map und werden vom Aufrufer
 * still übersprungen — die referentielle Integrität sichert die CI.
 */
export async function buildProzessSlugMap(): Promise<Record<string, ProzessIndexEntry>> {
  const entries = await listProzesse();
  const map: Record<string, ProzessIndexEntry> = {};
  for (const e of entries) map[e.slug] = e;
  return map;
}

/**
 * slug ("<city>/<id>") → Liste der beteiligten Org-Einheiten (actors[].einheit_ref).
 * Grundlage für die N:M-Brücke Lebenslage ↔ Prozess ↔ Einheit(en): über die
 * verlinkten Prozesse einer Lebenslage lassen sich alle beteiligten Stellen
 * ableiten, nicht nur die primär zuständige.
 */
export async function buildProzessEinheitenMap(): Promise<Record<string, string[]>> {
  const map: Record<string, string[]> = {};
  for (const p of await loadAllProzesse()) {
    const units = Array.from(
      new Set((p.actors ?? []).map((a) => a.einheit_ref).filter((x): x is string => Boolean(x))),
    );
    map[`${p.city}/${p.id}`] = units;
  }
  return map;
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
  const map: Record<string, ProzessIndexEntry[]> = {};
  for (const p of await loadAllProzesse()) {
    const entry = toLightEntry(p);
    for (const a of p.actors ?? []) {
      if (!a.einheit_ref) continue;
      const bucket = (map[a.einheit_ref] ??= []);
      if (!bucket.some((e) => e.id === entry.id && e.city === entry.city)) {
        bucket.push(entry);
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
 * die eine gegebene Einheit referenzieren (über actors[].einheit_ref).
 * Wird im DetailPanel der Hauptansicht verwendet, um "Diese Stelle ist
 * an folgenden Verfahren beteiligt" anzuzeigen.
 */
export async function findProzesseForEinheit(einheitId: string): Promise<ProzessIndexEntry[]> {
  if (!einheitId) return [];
  const matches = (await loadAllProzesse())
    .filter((p) => (p.actors ?? []).some((a) => a.einheit_ref === einheitId))
    .map(toLightEntry);
  return matches.sort((a, b) => a.id.localeCompare(b.id));
}
