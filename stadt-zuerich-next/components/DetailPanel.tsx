'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { Link, usePathname, useRouter } from '@/i18n/navigation';
import type { StadtData, Department, Unit, Beteiligung, Fte, Budget } from '@/types/stadt';
import { fmtCHF, fmtNumber } from '@/lib/search';
import {
  computeTotalAufwand,
  computeTotalNettoaufwand,
  perCapitaCHF,
  budgetSharePercent,
} from '@/lib/budget-context';
import { city, externalSearchUrl } from '@/config/city.config';

type T = ReturnType<typeof useTranslations<'Detail'>>;

/** Vorberechnetes, server-seitig aufgelöstes Prozess-Bündel pro Einheit.
 *  Bewusst mit bereits resolvtem titel: DetailPanel ist client-seitig,
 *  i18n-Auflösung passiert im Server-Component (page.tsx). */
export interface RelatedProzess {
  id: string;
  city: string;
  titel: string;
}

export default function DetailPanel({
  data,
  relatedProzesse,
}: {
  data: StadtData;
  relatedProzesse?: Record<string, RelatedProzess[]>;
}) {
  const t = useTranslations('Detail');
  const tType = useTranslations('Type');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedId = searchParams.get('focus');

  // Totale über alle Units einmal pro Daten-Snapshot berechnen — Basis für
  // die Anteils-Anzeige (separat für Brutto-Aufwand und Netto-Aufwand,
  // damit "Anteil Gesamtbudget" jeweils gegen das passende Total läuft).
  // Stabil, solange `data` per Referenz unverändert bleibt (typischer Fall:
  // nur die URL-Query ändert sich).
  const totalAufwand = useMemo(() => computeTotalAufwand(data), [data]);
  const totalNetto   = useMemo(() => computeTotalNettoaufwand(data), [data]);
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
  if (item.budget) rows.push(...budgetRows(item.budget, t, totalAufwand, totalNetto, population));
  if (item.fte)    rows.push(...fteRows(item.fte, t));
  if (item.odz)    rows.push({ k: t('ogdKey'), v: `${item.odz.kurzname} · key ${item.odz.key}` });
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

  return (
    <aside
      role="region"
      aria-label={t('ariaLabel')}
      aria-live="polite"
      className="fixed bottom-3 right-3 z-[9] w-[320px] bg-[var(--color-panel)] px-4 py-3.5 rounded-lg shadow text-[13px] leading-snug"
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
      <RelatedProzesseSection
        selectedId={selectedId}
        relatedProzesse={relatedProzesse}
        t={t}
      />
      <div className="mt-2.5">
        <a
          href={item.odz?.kurzname ? externalSearchUrl(item.name) : city.homepageUrl}
          target="_blank" rel="noopener"
          className="text-[var(--color-accent)] no-underline hover:underline"
        >
          {city.domain} ↗
        </a>
      </div>
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
  totalNetto: number,
  population: number | undefined,
): Row[] {
  const phase = ({
    GEMEINDERAT_BESCHLUSS: t('phaseBudget'),
    STADTRAT_ANTRAG: t('phaseProposal'),
    RECHNUNG: t('phaseAccount'),
  } as Record<string, string>)[b.typ] ?? b.typ;
  const rows: Row[] = [{ k: `${phase} ${b.jahr}`, v: '' }];
  rows.push({ k: `  ${t('expense')}`,    v: fmtCHF(b.aufwand) });
  // Aux-Zeilen direkt unter dem Bezugswert: Pro-Kopf und Anteil. Beide
  // werden nur gerendert, wenn die nötige Bezugsgrösse vorhanden und die
  // berechnete Zahl aussagekräftig ist (sonst würde "0 CHF/Einwohner" oder
  // "0.0 %" einen vernachlässigbaren Posten suggerieren, wo eigentlich
  // Daten fehlen). `↳` macht visuell klar, dass die Zeilen sich auf den
  // jeweils darüberstehenden Betrag beziehen.
  rows.push(...auxBudgetRows(b.aufwand, t, totalAufwand, population));
  rows.push({ k: `  ${t('income')}`,     v: fmtCHF(b.ertrag) });
  rows.push({ k: `  ${t('netExpense')}`, v: fmtCHF(b.nettoaufwand) });
  rows.push(...auxBudgetRows(b.nettoaufwand, t, totalNetto, population));
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
 * `nettoaufwand` (Bezug = totalNetto). Liefert leeres Array, wenn weder
 * Pro-Kopf- noch Anteils-Zahl darstellbar sind.
 */
function auxBudgetRows(
  amount: number | null | undefined,
  t: T,
  total: number,
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
  const sh = budgetSharePercent(amount, total);
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
          <span title={f.quelleDetail} className="text-[#16a085] text-[11px] cursor-help">{t('ftePublished')}</span>
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
