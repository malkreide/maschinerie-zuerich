// Server-renderbare semantische <details>-Hierarchie für Screenreader und
// Tastatur-Navigation. Kein 'use client' — pure HTML, kein State.

import { useTranslations } from 'next-intl';
import type { StadtData, Department, Unit, Beteiligung, Fte } from '@/types/stadt';
import { fmtCHF, fmtNumber } from '@/lib/search';

export default function ListView({ data }: { data: StadtData }) {
  const t = useTranslations('List');
  return (
    <main
      id="list-view"
      tabIndex={-1}
      role="region"
      aria-label={t('ariaLabel')}
      className="liste absolute top-14 inset-x-0 bottom-0 px-6 pt-4 pb-10 overflow-y-auto bg-[var(--color-bg)]"
    >
      <h2 className="text-lg font-semibold m-0 mb-1">{t('title')}</h2>
      <p className="text-[13px] text-[var(--color-mute)] mb-4 max-w-[70ch]">{t('intro')}</p>

      {data.departments.map((dep) => (
        <DepDetail key={dep.id} dep={dep} units={data.units.filter((u) => u.parent === dep.id)} />
      ))}

      {data.beteiligungen.length > 0 && (
        <details className="dep">
          <summary>
            {t('beteiligungenHeading')}{' '}
            <span className="text-[var(--color-mute)] text-[13px]">({data.beteiligungen.length})</span>
          </summary>
          <div className="units">
            {data.beteiligungen.map((b) => <BetDetail key={b.id} b={b} />)}
          </div>
        </details>
      )}
    </main>
  );
}

function DepDetail({ dep, units }: { dep: Department; units: Unit[] }) {
  const extras: string[] = [dep.id];
  if (dep.budget?.aufwand)   extras.push(Math.round(dep.budget.aufwand / 1e6) + ' Mio CHF');
  if (dep.fte?.schaetzung)   extras.push(fmtNumber(dep.fte.schaetzung) + ' FTE');
  return (
    <details className="dep">
      <summary>
        {dep.name}{' '}
        <span className="text-[var(--color-mute)] text-[13px]">({extras.join(', ')})</span>
      </summary>
      <Meta dep={dep} />
      {units.length > 0 && (
        <div className="units">
          {units.map((u) => <UnitDetail key={u.id} unit={u} />)}
        </div>
      )}
    </details>
  );
}

function UnitDetail({ unit }: { unit: Unit }) {
  const extras: string[] = [];
  if (unit.budget?.aufwand) extras.push(Math.round(unit.budget.aufwand / 1e6) + ' Mio');
  if (unit.fte?.schaetzung) extras.push(fmtNumber(unit.fte.schaetzung) + ' FTE');
  return (
    <details className="unit">
      <summary>
        {unit.name}
        {extras.length > 0 && (
          <span className="text-[var(--color-mute)] text-xs"> ({extras.join(' · ')})</span>
        )}
      </summary>
      <Meta unit={unit} />
    </details>
  );
}

function BetDetail({ b }: { b: Beteiligung }) {
  return (
    <details className="unit">
      <summary>{b.name}</summary>
      <Meta beteiligung={b} />
    </details>
  );
}

function Meta({
  dep, unit, beteiligung,
}: {
  dep?: Department;
  unit?: Unit;
  beteiligung?: Beteiligung;
}) {
  const t = useTranslations('Detail');
  const item = dep ?? unit ?? beteiligung!;
  const rows: { k: React.ReactNode; v: React.ReactNode }[] = [];
  if ('vorsteher' in item && item.vorsteher) rows.push({ k: t('vorsteher'), v: item.vorsteher });
  if (item.odz)
    rows.push({ k: t('ogdKey'), v: `${item.odz.kurzname} (key ${item.odz.key})` });
  if (item.budget?.aufwand != null) {
    rows.push({ k: t('expense'), v: fmtCHF(item.budget.aufwand) });
    if (item.budget.ertrag != null) rows.push({ k: t('income'), v: fmtCHF(item.budget.ertrag) });
    if (item.budget.nettoaufwand != null)
      rows.push({ k: t('netExpense'), v: <strong>{fmtCHF(item.budget.nettoaufwand)}</strong> });
    rows.push({ k: t('budgetYear'), v: `${item.budget.jahr} (${item.budget.typ})` });
  }
  if (item.fte) rows.push({ k: t('fte'), v: fteLabel(item.fte, t) });
  if ('konflikt' in item && item.konflikt) {
    rows.push({
      k: <span className="konflikt">{t('conflictLabel')}</span>,
      v: (
        <span className="konflikt">
          {t('conflictCitizen')}: {item.konflikt.unsereZuordnung}, {t('conflictRpk')}:{' '}
          {item.konflikt.rpkBezeichnung || item.konflikt.rpkKurzname}
        </span>
      ),
    });
  }
  if (rows.length === 0) return null;
  return (
    <dl className="meta">
      {rows.map((r, i) => (
        <span key={i} style={{ display: 'contents' }}>
          <dt>{r.k}</dt>
          <dd>{r.v}</dd>
        </span>
      ))}
    </dl>
  );
}

function fteLabel(f: Fte, t: ReturnType<typeof useTranslations<'Detail'>>): string {
  const v = fmtNumber(f.schaetzung);
  if (f.quelle === 'pdf') {
    return t('fteUnitPublished', { value: v, einheit: f.einheit ?? t('fteUnitFallback') });
  }
  return t('fteEstimateText', { value: v, amount: fmtNumber(f.vollkostenProFte ?? 130000) });
}
