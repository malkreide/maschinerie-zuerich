// Server-seitiger Aggregator für das Wirkungs-/Reife-Dashboard.
//
// Leitet Kennzahlen AUSSCHLIESSLICH aus vorhandenen Daten ab (Prozesse,
// Lebenslagen, Org-Chart) — kein User-Tracking, keine Telemetrie. Damit
// erfüllt das Dashboard die strategische Forderung nach Evaluation/rollierender
// Planung, ohne den Privacy-by-design-Ansatz zu verletzen.

import { listProzesse, loadProzess } from '@/lib/prozesse';
import { loadStadtData } from '@/lib/data';
import type {
  Prozess,
  OnlineReifegrad,
  Medienbruch,
  ProzessStatus,
  I18nString,
} from '@/types/prozess';
import type { LebenslageLocale } from '@/types/stadt';

const REIFEGRAD_ORDER: OnlineReifegrad[] = ['offline', 'teil-digital', 'digital', 'end-to-end'];
const STATUS_ORDER: ProzessStatus[] = ['beobachtet', 'validiert', 'vorgeschlagen', 'in-umsetzung', 'umgesetzt'];
const LOCALES: LebenslageLocale[] = ['de', 'en', 'fr', 'it', 'ls'];

export interface KomplexitaetRow {
  id: string;
  city: string;
  titel: I18nString;
  schritte: number;
  akteure: number;
  entscheidungen: number;
  medienbrueche: number;
}

export interface Count<T extends string> {
  key: T;
  count: number;
}

export interface WirkungReport {
  prozesseCount: number;
  reifegrad: Count<OnlineReifegrad>[];
  status: Count<ProzessStatus>[];
  medienbruecheGesamt: number;
  medienbruecheTop: Count<Medienbruch>[];
  onceOnlyCount: number;
  improvementGesamt: number;
  painPointsGesamt: number;
  komplexitaet: KomplexitaetRow[];
  lebenslagenTotal: number;
  lebenslagenMitProzess: number;
  abdeckungProzent: number;
  sprachabdeckung: { locale: LebenslageLocale; count: number; prozent: number }[];
}

export async function buildWirkungReport(): Promise<WirkungReport> {
  const index = await listProzesse();
  const loaded = await Promise.all(index.map((e) => loadProzess(e.city, e.id)));
  const prozesse = loaded.filter((p): p is Prozess => p !== null);

  const reifegradCounts: Record<string, number> = {};
  const statusCounts: Record<string, number> = {};
  const medienbruchCounts: Record<string, number> = {};
  let medienbruecheGesamt = 0;
  let onceOnlyCount = 0;
  let improvementGesamt = 0;
  let painPointsGesamt = 0;
  const komplexitaet: KomplexitaetRow[] = [];

  for (const p of prozesse) {
    const r = p.reife;
    if (r?.onlineReifegrad) reifegradCounts[r.onlineReifegrad] = (reifegradCounts[r.onlineReifegrad] ?? 0) + 1;
    if (r?.status) statusCounts[r.status] = (statusCounts[r.status] ?? 0) + 1;
    for (const m of r?.medienbrueche ?? []) {
      medienbruchCounts[m] = (medienbruchCounts[m] ?? 0) + 1;
      medienbruecheGesamt++;
    }
    if (r?.onceOnlyPotenzial) onceOnlyCount++;
    improvementGesamt += r?.improvementIdeas?.length ?? 0;
    painPointsGesamt += r?.painPoints?.length ?? 0;

    komplexitaet.push({
      id: p.id,
      city: p.city,
      titel: p.titel,
      schritte: p.schritte?.length ?? 0,
      akteure: p.akteure?.length ?? 0,
      entscheidungen: (p.schritte ?? []).filter((s) => s.typ === 'entscheidung').length,
      medienbrueche: r?.medienbrueche?.length ?? 0,
    });
  }
  komplexitaet.sort((a, b) => b.schritte - a.schritte || a.id.localeCompare(b.id));

  const data = await loadStadtData();
  const lebenslagen = data.lebenslagen ?? [];
  const lebenslagenTotal = lebenslagen.length;
  const lebenslagenMitProzess = lebenslagen.filter((l) => (l.prozesse?.length ?? 0) > 0).length;
  const abdeckungProzent = lebenslagenTotal ? Math.round((lebenslagenMitProzess / lebenslagenTotal) * 100) : 0;

  const sprachabdeckung = LOCALES.map((locale) => {
    const count = lebenslagen.filter((l) => l.i18n?.[locale]?.frage).length;
    return { locale, count, prozent: lebenslagenTotal ? Math.round((count / lebenslagenTotal) * 100) : 0 };
  });

  return {
    prozesseCount: prozesse.length,
    reifegrad: REIFEGRAD_ORDER.map((key) => ({ key, count: reifegradCounts[key] ?? 0 })),
    status: STATUS_ORDER.map((key) => ({ key, count: statusCounts[key] ?? 0 })),
    medienbruecheGesamt,
    medienbruecheTop: (Object.entries(medienbruchCounts) as [Medienbruch, number][])
      .map(([key, count]) => ({ key, count }))
      .sort((a, b) => b.count - a.count),
    onceOnlyCount,
    improvementGesamt,
    painPointsGesamt,
    komplexitaet,
    lebenslagenTotal,
    lebenslagenMitProzess,
    abdeckungProzent,
    sprachabdeckung,
  };
}
