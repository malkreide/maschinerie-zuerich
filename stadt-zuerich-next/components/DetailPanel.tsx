'use client';

import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { usePathname, useRouter } from '@/i18n/navigation';
import type { StadtData, Department, Unit, Beteiligung, Fte, Budget } from '@/types/stadt';
import { fmtCHF, fmtNumber } from '@/lib/search';

type T = ReturnType<typeof useTranslations<'Detail'>>;

export default function DetailPanel({ data }: { data: StadtData }) {
  const t = useTranslations('Detail');
  const tType = useTranslations('Type');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedId = searchParams.get('focus');

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
  if (item.budget) rows.push(...budgetRows(item.budget, t));
  if (item.fte)    rows.push(...fteRows(item.fte, t));
  if (item.odz)    rows.push({ k: t('ogdKey'), v: `${item.odz.kurzname} · key ${item.odz.key}` });
  if ('konflikt' in item && item.konflikt) {
    rows.push({
      k: <span className="text-[#e67e22]">{t('conflictLabel')}</span>,
      v: (
        <span className="text-[#e67e22]">
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
      <div className="mt-2.5">
        <a
          href={item.odz?.kurzname
            ? `https://www.stadt-zuerich.ch/de.html?q=${encodeURIComponent(item.name)}`
            : 'https://www.stadt-zuerich.ch/'}
          target="_blank" rel="noopener"
          className="text-[var(--color-accent)] no-underline hover:underline"
        >
          stadt-zuerich.ch ↗
        </a>
      </div>
    </aside>
  );
}

function findItem(data: StadtData, id: string): Department | Unit | Beteiligung | null {
  return data.departments.find((d) => d.id === id)
    ?? data.units.find((u) => u.id === id)
    ?? data.beteiligungen.find((b) => b.id === id)
    ?? null;
}

type Row = { k: React.ReactNode; v: React.ReactNode };

function budgetRows(b: Budget, t: T): Row[] {
  const phase = ({
    GEMEINDERAT_BESCHLUSS: t('phaseBudget'),
    STADTRAT_ANTRAG: t('phaseProposal'),
    RECHNUNG: t('phaseAccount'),
  } as Record<string, string>)[b.typ] ?? b.typ;
  const rows: Row[] = [{ k: `${phase} ${b.jahr}`, v: '' }];
  rows.push({ k: `  ${t('expense')}`,    v: fmtCHF(b.aufwand) });
  rows.push({ k: `  ${t('income')}`,     v: fmtCHF(b.ertrag) });
  rows.push({ k: `  ${t('netExpense')}`, v: fmtCHF(b.nettoaufwand) });
  if (b._aggregiertAus)
    rows.push({
      k: `  ${t('budgetYear')}`,
      v: <em className="text-[var(--color-mute)]">{t('aggregatedFrom', { n: b._aggregiertAus })}</em>,
    });
  return rows;
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
