// Server-renderbare semantische <details>-Hierarchie für Screenreader und
// Tastatur-Navigation. Kein 'use client' — pure HTML, kein State.

import type { StadtData, Department, Unit, Beteiligung, Fte } from '@/types/stadt';
import type { Locale } from '@/i18n/routing';
import { getT } from '@/lib/i18n-server';
import { fmtCHF, fmtNumber } from '@/lib/search';
import {
  computeTotalAufwand,
  computeTotalNettoaufwand,
  perCapitaCHF,
  budgetSharePercent,
} from '@/lib/budget-context';
import { city } from '@/config/city.config';

type TFn = ReturnType<typeof getT>;

export default function ListView({ data, locale }: { data: StadtData; locale: Locale }) {
  const t = getT(locale, 'List');
  const tDetail = getT(locale, 'Detail');
  // Bezugswerte für Pro-Kopf- und Anteils-Zeilen. Auf Server-Seite einmalig
  // berechnet — die ganze Liste ist statisch und wird pro Render erneut
  // erzeugt, daher reicht ein lokaler const. Brutto und Netto getrennt,
  // damit die Anteile gegen die jeweils passende Bezugsgrösse laufen.
  const totalAufwand = computeTotalAufwand(data);
  const totalNetto   = computeTotalNettoaufwand(data);
  const population = city.population;

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
        <DepDetail
          key={dep.id}
          dep={dep}
          units={data.units.filter((u) => u.parent === dep.id)}
          tDetail={tDetail}
          tList={t}
          totalAufwand={totalAufwand}
          totalNetto={totalNetto}
          population={population}
        />
      ))}

      {data.beteiligungen.length > 0 && (
        <details className="dep">
          <summary>
            {t('beteiligungenHeading')}{' '}
            <span className="text-[var(--color-mute)] text-[13px]">({data.beteiligungen.length})</span>
          </summary>
          <div className="units">
            {data.beteiligungen.map((b) => (
              <BetDetail
                key={b.id}
                b={b}
                tDetail={tDetail}
                totalAufwand={totalAufwand}
                totalNetto={totalNetto}
                population={population}
              />
            ))}
          </div>
        </details>
      )}
    </main>
  );
}

function DepDetail({
  dep, units, tDetail, tList, totalAufwand, totalNetto, population,
}: {
  dep: Department;
  units: Unit[];
  tDetail: TFn;
  tList: TFn;
  totalAufwand: number;
  totalNetto: number;
  population: number | undefined;
}) {
  const extras: string[] = [dep.id];
  if (dep.budget?.aufwand) extras.push(Math.round(dep.budget.aufwand / 1e6) + ' Mio CHF');
  if (dep.fte?.schaetzung) extras.push(fmtNumber(dep.fte.schaetzung) + ' FTE');
  // Ein Amt gilt als "ohne Budgetdaten", wenn weder das Departement selbst
  // noch eine seiner Einheiten einen Aufwand ausweist. Dieser Status wird
  // sonst stumm geschluckt — der Hinweis macht ihn sichtbar.
  const hasAnyBudget =
    dep.budget?.aufwand != null || units.some((u) => u.budget?.aufwand != null);
  return (
    <details className="dep">
      <summary>
        {dep.name}{' '}
        <span className="text-[var(--color-mute)] text-[13px]">({extras.join(', ')})</span>
      </summary>
      <Meta
        dep={dep}
        tDetail={tDetail}
        totalAufwand={totalAufwand}
        totalNetto={totalNetto}
        population={population}
      />
      {!hasAnyBudget && (
        <p className="text-[12px] text-[var(--color-mute)] italic m-0 mt-1">
          {tList('noBudget')}
        </p>
      )}
      {units.length > 0 ? (
        <div className="units">
          {units.map((u) => (
            <UnitDetail
              key={u.id}
              unit={u}
              tDetail={tDetail}
              totalAufwand={totalAufwand}
              totalNetto={totalNetto}
              population={population}
            />
          ))}
        </div>
      ) : (
        <p className="text-[12px] text-[var(--color-mute)] italic m-0 mt-1">
          {tList('noUnits')}
        </p>
      )}
    </details>
  );
}

function UnitDetail({
  unit, tDetail, totalAufwand, totalNetto, population,
}: {
  unit: Unit;
  tDetail: TFn;
  totalAufwand: number;
  totalNetto: number;
  population: number | undefined;
}) {
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
      <Meta
        unit={unit}
        tDetail={tDetail}
        totalAufwand={totalAufwand}
        totalNetto={totalNetto}
        population={population}
      />
    </details>
  );
}

function BetDetail({
  b, tDetail, totalAufwand, totalNetto, population,
}: {
  b: Beteiligung;
  tDetail: TFn;
  totalAufwand: number;
  totalNetto: number;
  population: number | undefined;
}) {
  return (
    <details className="unit">
      <summary>{b.name}</summary>
      <Meta
        beteiligung={b}
        tDetail={tDetail}
        totalAufwand={totalAufwand}
        totalNetto={totalNetto}
        population={population}
      />
    </details>
  );
}

function Meta({
  dep, unit, beteiligung, tDetail, totalAufwand, totalNetto, population,
}: {
  dep?: Department;
  unit?: Unit;
  beteiligung?: Beteiligung;
  tDetail: TFn;
  totalAufwand: number;
  totalNetto: number;
  population: number | undefined;
}) {
  const item = dep ?? unit ?? beteiligung!;
  const t = tDetail;
  const rows: { k: React.ReactNode; v: React.ReactNode }[] = [];
  if ('vorsteher' in item && item.vorsteher) rows.push({ k: t('vorsteher'), v: item.vorsteher });
  if (item.odz)
    rows.push({ k: t('ogdKey'), v: `${item.odz.kurzname} (key ${item.odz.key})` });
  if (item.budget?.aufwand != null) {
    rows.push({ k: t('expense'), v: fmtCHF(item.budget.aufwand) });
    // Aux-Zeilen direkt nach Aufwand: Pro-Kopf und Anteil am Gesamt-Aufwand.
    pushAuxBudgetRows(rows, item.budget.aufwand, t, totalAufwand, population);
    if (item.budget.ertrag != null) rows.push({ k: t('income'), v: fmtCHF(item.budget.ertrag) });
    if (item.budget.nettoaufwand != null) {
      rows.push({ k: t('netExpense'), v: <strong>{fmtCHF(item.budget.nettoaufwand)}</strong> });
      // Aux-Zeilen für den Netto-Wert — relevant, weil das die Zahl ist, die
      // Steuerzahlende effektiv tragen (Aufwand minus Ertrag).
      pushAuxBudgetRows(rows, item.budget.nettoaufwand, t, totalNetto, population);
    }
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

function fteLabel(f: Fte, t: TFn): string {
  const v = fmtNumber(f.schaetzung);
  if (f.quelle === 'pdf') {
    return t('fteUnitPublished', { value: v, einheit: f.einheit ?? t('fteUnitFallback') });
  }
  return t('fteEstimateText', { value: v, amount: fmtNumber(f.vollkostenProFte ?? 130000) });
}

/**
 * Mutiert die Row-Liste um Pro-Kopf- und Anteils-Zeilen zu einem CHF-Betrag.
 * Aufrufer übergibt den passenden Stadt-Total (Brutto- oder Netto-Aufwand).
 * In-place-Push spart eine Konkatenation pro Item bei der grossen Liste.
 */
function pushAuxBudgetRows(
  rows: { k: React.ReactNode; v: React.ReactNode }[],
  amount: number | null | undefined,
  t: TFn,
  total: number,
  population: number | undefined,
): void {
  const pc = perCapitaCHF(amount, population);
  if (pc) {
    rows.push({
      k: <span title={t('perCapitaTitle')} className="text-[var(--color-mute)]">↳ {t('perCapitaLabel')}</span>,
      v: <span className="text-[var(--color-mute)]">{t('perCapitaValue', { value: pc })}</span>,
    });
  }
  const sh = budgetSharePercent(amount, total);
  if (sh) {
    rows.push({
      k: <span title={t('budgetShareTitle')} className="text-[var(--color-mute)]">↳ {t('budgetShareLabel')}</span>,
      v: <span className="text-[var(--color-mute)]">{t('budgetShareValue', { percent: sh })}</span>,
    });
  }
}
