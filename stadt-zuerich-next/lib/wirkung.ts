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

export interface KlimaDept {
  id: string;
  name: string;
  co2Score: number;
  budgetShare: number;
}

export interface KlimaAggregat {
  abgedeckt: number;
  total: number;
  departments: KlimaDept[]; // nach co2Score absteigend
  hotspots: number; // co2Score >= 60
  avgBudgetSharePct: number;
}

export interface WirkungReport {
  prozesseCount: number;
  klima: KlimaAggregat | null;
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
      titel: p.title,
      schritte: p.steps?.length ?? 0,
      akteure: (p.actors ?? [])?.length ?? 0,
      entscheidungen: (p.steps ?? []).filter((s) => s.type === 'entscheidung').length,
      medienbrueche: r?.medienbrueche?.length ?? 0,
    });
  }
  komplexitaet.sort((a, b) => b.schritte - a.schritte || a.id.localeCompare(b.id));

  const data = await loadStadtData();

  // Klima-Aggregat je Departement (verknüpft mit dem Netto-Null-Stadtziel).
  // co2Score ist eine indikative Schätzung — Provenance: geschätzt.
  const depts = data.departments ?? [];
  const withK = depts.filter((d) => d.klima && typeof d.klima.co2Score === 'number');
  const klima: KlimaAggregat | null =
    withK.length === 0
      ? null
      : {
          abgedeckt: withK.length,
          total: depts.length,
          departments: withK
            .map((d) => ({
              id: d.id,
              name: d.name,
              co2Score: d.klima!.co2Score ?? 0,
              budgetShare: d.klima!.budgetShare ?? 0,
            }))
            .sort((a, b) => b.co2Score - a.co2Score),
          hotspots: withK.filter((d) => (d.klima!.co2Score ?? 0) >= 60).length,
          avgBudgetSharePct: Math.round(
            (withK.reduce((s, d) => s + (d.klima!.budgetShare ?? 0), 0) / withK.length) * 100,
          ),
        };

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
    klima,
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
