'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { Link, usePathname, useRouter } from '@/i18n/navigation';
import type { StadtData, Department, Unit, Beteiligung, Fte, Budget } from '@/types/stadt';
import { fmtCHF, fmtNumber } from '@/lib/search';
import {
  computeTotalAufwand,
  perCapitaCHF,
  budgetSharePercent,
} from '@/lib/budget-context';
import { city, externalSearchUrl } from '@/config/city.config';
import geoLayers from '@/config/geo-layers.json';
import ParlamentsGeschaefte from './ParlamentsGeschaefte';
import MicroFeedback from './MicroFeedback';

// Einheit-ID → Territory-Layer-ID: erlaubt den Deep-Link «Standorte auf der
// Karte» im Detail einer Dienstabteilung, die einen publizierten Geo-Layer hat
// (Quelle: config/geo-layers.json, Feld `unit`).
const UNIT_LAYER: Record<string, string> = Object.fromEntries(
  (geoLayers.layers as Array<{ id: string; unit?: string }>)
    .filter((l) => l.unit)
    .map((l) => [l.unit as string, l.id]),
);

type T = ReturnType<typeof useTranslations<'Detail'>>;

// Deutsche Anzeige-Labels für die Beteiligungs-Klassifikation. Der Org-Chart-
// Inhalt (Namen, Departemente) ist durchgängig deutsch; nur die Zeilen-Labels
// werden via i18n übersetzt — gleiche Konvention wie beim restlichen Panel.
const RECHTSFORM_DE: Record<string, string> = {
  ag: 'AG',
  stiftung: 'Stiftung',
  genossenschaft: 'Genossenschaft',
  'oeffentlich-rechtlich': 'Öffentlich-rechtlich',
  verein: 'Verein',
};
const BETEILIGUNGSART_DE: Record<string, string> = {
  strategisch: 'Strategisch',
  finanziell: 'Finanziell',
};
const SEKTOR_DE: Record<string, string> = {
  energie: 'Energie',
  verkehr: 'Verkehr',
  finanzen: 'Finanzen',
  wohnen: 'Wohnen',
  kultur: 'Kultur',
  soziales: 'Soziales',
  freizeit: 'Freizeit',
  gesundheit: 'Gesundheit',
};

/** Vorberechnetes, server-seitig aufgelöstes Prozess-Bündel pro Einheit.
 *  Bewusst mit bereits resolvtem titel: DetailPanel ist client-seitig,
 *  i18n-Auflösung passiert im Server-Component (page.tsx). */
export interface RelatedProzess {
  id: string;
  city: string;
  titel: string;
}

/** Vorberechnete Lebenslage-Referenz pro Einheit (N:M-Reverse). `term` ist der
 *  Suchbegriff für den Sprung in die Anliegen-Suche. */
export interface RelatedLebenslage {
  id: string;
  frage: string;
  term: string;
}

type BudgetNumericalKeys = 'aufwand' | 'ertrag' | 'nettoaufwand';

function Sparkline({ data, dataKey }: { data?: Budget[]; dataKey: BudgetNumericalKeys }) {
  if (!data || data.length < 2) return null;
  const w = 40, h = 16;
  const vals = data.map(d => (d[dataKey] as number) || 0);
  const max = Math.max(...vals);
  const min = Math.min(...vals);
  const range = max - min || 1;
  const step = w / (data.length - 1);
  
  const pts = vals.map((val, i) => {
    const x = i * step;
    const y = h - ((val - min) / range) * h;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={w} height={h} className="inline-block align-middle ml-2 opacity-60 overflow-visible" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      {/* Title for hover to show the start and end year growth */}
      <title>
        Trend {data[0].jahr} ({fmtCHF(data[0][dataKey] as number)}) bis {data[data.length-1].jahr} ({fmtCHF(data[data.length-1][dataKey] as number)})
      </title>
    </svg>
  );
}

export default function DetailPanel({
  data,
  relatedProzesse,
  relatedLebenslagen,
}: {
  data: StadtData;
  relatedProzesse?: Record<string, RelatedProzess[]>;
  relatedLebenslagen?: Record<string, RelatedLebenslage[]>;
}) {
  const t = useTranslations('Detail');
  const tType = useTranslations('Type');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedId = searchParams.get('focus');

  // Total über alle Units einmal pro Daten-Snapshot berechnen — Basis für
  // die Anteils-Anzeige beim Brutto-Aufwand. Stabil, solange `data` per
  // Referenz unverändert bleibt (typischer Fall: nur die URL-Query ändert
  // sich).
  const totalAufwand = useMemo(() => computeTotalAufwand(data), [data]);
  const population = city.population;

  function close() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('focus');
    const qs = params.toString();
    router.replace((qs ? `${pathname}?${qs}` : pathname) as Parameters<typeof router.replace>[0], { scroll: false });
  }

  if (!selectedId) return null;
  const item = findItem(data, selectedId);
  if (!item) return null;

  const isDep = 'vorsteher' in item;
  const kind = isDep ? 'department'
              : 'verbunden' in item ? 'beteiligung'
              : (item as Unit).kind;

  const rows: { k: React.ReactNode; v: React.ReactNode }[] = [];
  if ('vorsteher' in item && item.vorsteher) rows.push({ k: t('vorsteher'), v: item.vorsteher });
  if ('parent' in item && item.parent) {
    const dep = data.departments.find((d) => d.id === item.parent);
    if (dep) rows.push({ k: t('department'), v: dep.name });
  }
  if (item.budget) rows.push(...budgetRows(item.budget, t, totalAufwand, population, item.budgetHistory));
  if (item.fte)    rows.push(...fteRows(item.fte, t));
  if ('diversity' in item && item.diversity) rows.push(...diversityRows(item.diversity as { womenInManagement: number; menInManagement: number }, t));
  if (item.odz)    rows.push({ k: t('ogdKey'), v: `${item.odz.kurzname} · key ${item.odz.key}` });
  if ('verbunden' in item) {
    const b = item as Beteiligung;
    if (b.rechtsform)      rows.push({ k: t('rechtsform'), v: RECHTSFORM_DE[b.rechtsform] ?? b.rechtsform });
    if (b.beteiligungsart) rows.push({ k: t('beteiligungsart'), v: BETEILIGUNGSART_DE[b.beteiligungsart] ?? b.beteiligungsart });
    if (b.sektor)          rows.push({ k: t('sektor'), v: SEKTOR_DE[b.sektor] ?? b.sektor });
  }
  if ('konflikt' in item && item.konflikt) {
    rows.push({
      k: <span className="text-[var(--color-konflikt)]">{t('conflictLabel')}</span>,
      v: (
        <span className="text-[var(--color-konflikt)]">
          {t('conflictCitizen')}: {item.konflikt.unsereZuordnung}<br />
          {t('conflictRpk')}: {item.konflikt.rpkBezeichnung || item.konflikt.rpkKurzname}
        </span>
      ),
    });
  }

  // Verwaltungsunabhängigkeit: die Einheit ist einem Departement/BUG nur zur
  // Gruppierung zugeordnet, ihm aber nicht unterstellt. Die tatsächliche
  // Wahl/Aufsicht bzw. fachlich-politische Verknüpfung steht in relationships.
  for (const rel of (data.relationships ?? []).filter((r) => r.to === selectedId)) {
    const fromName = findItem(data, rel.from)?.name ?? rel.from;
    rows.push({
      k: <span className="text-[var(--color-konflikt)]">{t('independentLabel')}</span>,
      v: (
        <span className="text-[var(--color-konflikt)]">
          {rel.type === 'wahl_und_aufsicht'
            ? t('independentOversight', { from: fromName })
            : t('independentLink', { from: fromName })}
        </span>
      ),
    });
  }

  // Standorte-Deep-Link: hat die Einheit einen publizierten Geo-Layer, in die
  // Territory-Karte mit genau diesem Layer springen.
  const layerId = 'parent' in item ? UNIT_LAYER[item.id] : undefined;
  if (layerId) {
    rows.push({
      k: t('locations'),
      v: (
        <Link
          href={`/territory?layer=${layerId}`}
          className="text-[var(--color-accent)] underline underline-offset-2"
        >
          {t('locationsLink')}
        </Link>
      ),
    });
  }

  return (
    <aside
      role="region"
      aria-label={t('ariaLabel')}
      aria-live="polite"
      className="fixed bottom-3 right-3 z-[9] w-[calc(100vw-24px)] sm:w-[320px] bg-[var(--color-panel)] px-4 py-3.5 rounded-lg shadow text-[13px] leading-snug"
    >
      <button
        onClick={close}
        aria-label={t('close')}
        className="absolute top-2 right-2.5 bg-transparent border-0 text-[var(--color-mute)] cursor-pointer text-base"
      >×</button>
      <h3 className="m-0 mb-1 text-[15px] font-semibold">{item.name}</h3>
      <div className="text-xs text-[var(--color-mute)] mb-2">
        {tType(kind as Parameters<typeof tType>[0])}
        {isDep && ` · ${t('abbreviation')}: ${item.id}`}
      </div>
      {rows.map((r, i) => (
        <div key={i} className="flex justify-between gap-3 py-0.5 border-b border-dashed border-[var(--color-line)] last:border-0">
          <span className="text-[var(--color-mute)]">{r.k}</span>
          <span className="text-right">{r.v}</span>
        </div>
      ))}
      {'verbunden' in item && (item as Beteiligung).zweck && (
        <p className="mt-2 mb-0 text-[var(--color-mute)] text-[12px] leading-snug">
          {(item as Beteiligung).zweck}
          {(item as Beteiligung).quelle && (
            <>
              {' · '}
              <a
                href={(item as Beteiligung).quelle}
                target="_blank"
                rel="noopener"
                className="text-[var(--color-accent)] no-underline hover:underline"
              >
                {t('participationSource')} ↗
              </a>
            </>
          )}
        </p>
      )}
      <RelatedProzesseSection
        selectedId={selectedId}
        relatedProzesse={relatedProzesse}
        t={t}
      />
      <RelatedLebenslagenSection
        selectedId={selectedId}
        relatedLebenslagen={relatedLebenslagen}
        t={t}
      />
      <ParlamentsGeschaefte departmentName={item.name} />
      <div className="mt-2.5">
        <a
          href={item.odz?.kurzname ? externalSearchUrl(item.name) : city.homepageUrl}
          target="_blank" rel="noopener"
          className="text-[var(--color-accent)] no-underline hover:underline"
        >
          {city.domain} ↗
        </a>
      </div>
      <MicroFeedback contextId={item.id} contextName={item.name} />
    </aside>
  );
}

/** Brücke vom Org-Chart zu Prozessen: wenn die fokussierte Einheit in
 *  data/prozesse/<city>/*.json via akteure[].einheit_ref referenziert wird,
 *  listen wir diese Verfahren mit Link zur Detail-Ansicht. */
function RelatedProzesseSection({
  selectedId,
  relatedProzesse,
  t,
}: {
  selectedId: string;
  relatedProzesse?: Record<string, RelatedProzess[]>;
  t: T;
}) {
  const list = relatedProzesse?.[selectedId];
  if (!list || list.length === 0) return null;
  return (
    <div className="mt-3 pt-2.5 border-t border-[var(--color-line)]">
      <div className="text-[var(--color-mute)] text-[11px] uppercase tracking-wider mb-1.5">
        {t('relatedProzesseHeading')}
      </div>
      <ul className="space-y-1">
        {list.map((p) => (
          <li key={`${p.city}-${p.id}`}>
            <Link
              href={{ pathname: `/prozesse/${p.city}/${p.id}` }}
              className="text-[var(--color-accent)] no-underline hover:underline"
            >
              {p.titel} →
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** N:M-Reverse: Anliegen/Lebenslagen, die diese Einheit betreffen — direkt
 *  (zuständig) oder über ein verlinktes Verfahren. Link führt in die
 *  Anliegen-Suche. */
function RelatedLebenslagenSection({
  selectedId,
  relatedLebenslagen,
  t,
}: {
  selectedId: string;
  relatedLebenslagen?: Record<string, RelatedLebenslage[]>;
  t: T;
}) {
  const list = relatedLebenslagen?.[selectedId];
  if (!list || list.length === 0) return null;
  return (
    <div className="mt-3 pt-2.5 border-t border-[var(--color-line)]">
      <div className="text-[var(--color-mute)] text-[11px] uppercase tracking-wider mb-1.5">
        {t('relatedLebenslagenHeading')}
      </div>
      <ul className="space-y-1">
        {list.map((l) => (
          <li key={l.id}>
            <Link
              href={{ pathname: '/anliegen', query: { q: l.term } }}
              className="text-[var(--color-accent)] no-underline hover:underline"
            >
              {l.frage} →
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function findItem(data: StadtData, id: string): Department | Unit | Beteiligung | null {
  return data.departments.find((d) => d.id === id)
    ?? data.units.find((u) => u.id === id)
    ?? data.beteiligungen.find((b) => b.id === id)
    ?? null;
}

type Row = { k: React.ReactNode; v: React.ReactNode };

function budgetRows(
  b: Budget,
  t: T,
  totalAufwand: number,
  population: number | undefined,
  history?: Budget[]
): Row[] {
  const phase = ({
    GEMEINDERAT_BESCHLUSS: t('phaseBudget'),
    STADTRAT_ANTRAG: t('phaseProposal'),
    RECHNUNG: t('phaseAccount'),
  } as Record<string, string>)[b.typ] ?? b.typ;
  const rows: Row[] = [{ k: `${phase} ${b.jahr}`, v: '' }];
  
  const trendAufwand = history ? <Sparkline data={history} dataKey="aufwand" /> : null;
  const trendErtrag = history ? <Sparkline data={history} dataKey="ertrag" /> : null;
  const trendNetto = history ? <Sparkline data={history} dataKey="nettoaufwand" /> : null;

  rows.push({ k: `  ${t('expense')}`,    v: <span className="flex items-center justify-end">{fmtCHF(b.aufwand)}{trendAufwand}</span> });
  // Aux-Zeilen direkt unter dem Bezugswert: Pro-Kopf und Anteil. Beide
  // werden nur gerendert, wenn die nötige Bezugsgrösse vorhanden und die
  // berechnete Zahl aussagekräftig ist (sonst würde "0 CHF/Einwohner" oder
  // "0.0 %" einen vernachlässigbaren Posten suggerieren, wo eigentlich
  // Daten fehlen). `↳` macht visuell klar, dass die Zeilen sich auf den
  // jeweils darüberstehenden Betrag beziehen.
  rows.push(...auxBudgetRows(b.aufwand, t, totalAufwand, population));
  rows.push({ k: `  ${t('income')}`,     v: <span className="flex items-center justify-end">{fmtCHF(b.ertrag)}{trendErtrag}</span> });
  rows.push({ k: `  ${t('netExpense')}`, v: <span className="flex items-center justify-end">{fmtCHF(b.nettoaufwand)}{trendNetto}</span> });
  // Beim Netto nur Pro-Kopf, kein Anteil: das Stadt-weite Netto liegt nahe
  // bei null (Steuern zählen als Ertrag), ein Prozentwert dazu wäre absurd.
  rows.push(...auxBudgetRows(b.nettoaufwand, t, undefined, population));
  if (b._aggregiertAus)
    rows.push({
      k: `  ${t('budgetYear')}`,
      v: <em className="text-[var(--color-mute)]">{t('aggregatedFrom', { n: b._aggregiertAus })}</em>,
    });
  return rows;
}

/**
 * Pro-Kopf- und Anteils-Zeilen für einen einzelnen CHF-Betrag. Wird zweimal
 * aufgerufen: einmal nach `aufwand` (Bezug = totalAufwand), einmal nach
 * `nettoaufwand` (ohne Bezugsgrösse — dann entfällt die Anteils-Zeile).
 * Liefert leeres Array, wenn weder Pro-Kopf- noch Anteils-Zahl darstellbar
 * sind.
 */
function auxBudgetRows(
  amount: number | null | undefined,
  t: T,
  total: number | undefined,
  population: number | undefined,
): Row[] {
  const out: Row[] = [];
  const pc = perCapitaCHF(amount, population);
  if (pc) {
    out.push({
      k: <span title={t('perCapitaTitle')}>{'    ↳ '}{t('perCapitaLabel')}</span>,
      v: <span className="text-[var(--color-mute)]">{t('perCapitaValue', { value: pc })}</span>,
    });
  }
  const sh = total != null ? budgetSharePercent(amount, total) : null;
  if (sh) {
    out.push({
      k: <span title={t('budgetShareTitle')}>{'    ↳ '}{t('budgetShareLabel')}</span>,
      v: <span className="text-[var(--color-mute)]">{t('budgetShareValue', { percent: sh })}</span>,
    });
  }
  return out;
}

function fteRows(f: Fte, t: T): Row[] {
  if (f.quelle === 'pdf') {
    return [{
      k: `${f.einheit ?? t('fteUnitFallback')} (${f.jahr ?? '?'})`,
      v: (
        <span>
          <strong>{fmtNumber(f.schaetzung)}</strong>{' '}
          {/* Status-Var statt fixem Hex: greift Light/Dark und ist
              WCAG-AA-getestet. Das ✓ kommt aus dem i18n-String — Doppel-
              Codierung Farbe + Form. */}
          <span title={f.quelleDetail} className="text-[var(--color-status-positive)] text-[11px] cursor-help">{t('ftePublished')}</span>
        </span>
      ),
    }];
  }
  return [{
    k: t('fte'),
    v: (
      <span>
        ~{fmtNumber(f.schaetzung)}{' '}
        <span title={t('fteEstimateTitle', { amount: fmtNumber(f.vollkostenProFte ?? 130000) })}
              className="text-[var(--color-mute)] text-[11px] cursor-help">{t('fteEstimate')}</span>
      </span>
    ),
  }];
}

function diversityRows(d: { womenInManagement: number; menInManagement: number }, t: T): Row[] {
  return [
    { k: <span title={t('detailDiversityDesc')}>{t('detailDiversity')}</span>, v: '' },
    { k: `  ↳ ${t('detailDiversityWomen')}`, v: <span className="text-[#d946ef] font-semibold">{d.womenInManagement} %</span> },
    { k: `  ↳ ${t('detailDiversityMen')}`, v: <span className="text-[#0ea5e9] font-semibold">{d.menInManagement} %</span> },
  ];
}
