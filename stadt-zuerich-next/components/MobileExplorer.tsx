'use client';

// Mobile-Explorer: ersetzt auf kleinen Bildschirmen die (dort nicht
// bedienbare) Graph-Ansicht durch eine durchsuchbare, aufklappbare Liste mit
// Pfad zur Einheit, Kennzahlen und verwandten Prozessen. Native <details> für
// Expand/Collapse (eingebaute Tastatur-/Screenreader-Bedienung).

import { useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import type { StadtData, Department, Unit, Beteiligung, LebenslageLocale } from '@/types/stadt';
import { fmtCHF, fmtNumber, searchLebenslagen, resolveContent } from '@/lib/search';

export interface ExplorerRelatedProzess {
  id: string;
  city: string;
  titel: string;
}

type Props = {
  data: StadtData;
  relatedProzesse: Record<string, ExplorerRelatedProzess[]>;
};

export default function MobileExplorer({ data, relatedProzesse }: Props) {
  const t = useTranslations('Explorer');
  const locale = useLocale() as LebenslageLocale;
  const [q, setQ] = useState('');
  const norm = q.trim().toLowerCase();

  const depName = useMemo(() => {
    const m = new Map<string, string>();
    for (const d of data.departments) m.set(d.id, d.name);
    return m;
  }, [data.departments]);

  const unitsByDep = useMemo(() => {
    const m = new Map<string, Unit[]>();
    for (const u of data.units) {
      const arr = m.get(u.parent) ?? [];
      arr.push(u);
      m.set(u.parent, arr);
    }
    return m;
  }, [data.units]);

  const matches = (text: string) => text.toLowerCase().includes(norm);

  const results = useMemo(() => {
    if (!norm) return null;
    return {
      departments: data.departments.filter((d) => matches(d.name) || matches(d.id)),
      units: data.units.filter((u) => matches(u.name) || matches(u.id)),
      beteiligungen: data.beteiligungen.filter((b) => matches(b.name) || matches(b.id)),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [norm, data]);

  // Anliegen-Einstieg wie in der Desktop-Suche: dieselbe Fuzzy-Suche mit
  // Synonym-Expansion («Hund anmelden» → Steueramt). Vorher konnte Mobile
  // nur Org-Einheiten per Substring finden — der beworbene Lebenslagen-
  // Einstieg fehlte auf kleinen Bildschirmen komplett.
  const anliegen = useMemo(() => {
    if (!norm) return [];
    return searchLebenslagen(q, data.lebenslagen ?? [], locale)
      .map((l) => ({ l, c: resolveContent(l, locale) }))
      .filter((x): x is { l: (typeof x)['l']; c: NonNullable<(typeof x)['c']> } => x.c != null);
  }, [norm, q, data, locale]);

  const einheitById = useMemo(() => {
    const m = new Map<string, Department | Unit | Beteiligung>();
    for (const d of data.departments) m.set(d.id, d);
    for (const u of data.units) m.set(u.id, u);
    for (const b of data.beteiligungen) m.set(b.id, b);
    return m;
  }, [data]);

  const totalResults = results
    ? results.departments.length + results.units.length + results.beteiligungen.length + anliegen.length
    : 0;

  return (
    <div
      role="region"
      aria-label={t('regionLabel')}
      className="absolute top-14 inset-x-0 bottom-0 px-4 pt-3 pb-10 overflow-y-auto bg-[var(--color-bg)]"
    >
      <p className="text-[13px] text-[var(--color-mute)] mb-3">{t('intro')}</p>

      <div role="search" className="mb-3">
        <label htmlFor="mobile-explorer-q" className="sr-only">{t('searchLabel')}</label>
        <input
          id="mobile-explorer-q"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('searchPlaceholder')}
          className="w-full border border-[var(--color-line)] bg-[var(--color-panel)] text-[var(--color-ink)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
        />
      </div>

      {results ? (
        <div role="status" aria-live="polite">
          <p className="text-[12px] text-[var(--color-mute)] mb-2">
            {t('resultsCount', { count: totalResults, query: q.trim() })}
          </p>
          {totalResults === 0 && (
            <p className="text-[var(--color-mute)] text-sm">{t('noResults')}</p>
          )}
          {anliegen.length > 0 && (
            <div className="mb-3">
              <h3 className="text-[11px] uppercase tracking-wider text-[var(--color-mute)] mb-1.5">
                {t('anliegenHeading')}
              </h3>
              {anliegen.map(({ l, c }) => {
                const einheit = einheitById.get(l.zustaendig);
                return (
                  <details
                    key={`a-${l.id}`}
                    className="mb-1.5 rounded-lg border border-[var(--color-line)] bg-[var(--color-panel)]"
                  >
                    <summary className="cursor-pointer px-3 py-2 select-none">
                      <span className="text-sm text-[var(--color-ink)]">{c.frage}</span>
                      {einheit && (
                        <span className="block text-[11px] text-[var(--color-mute)]">
                          {t('anliegenZustaendig')}: {einheit.name}
                        </span>
                      )}
                    </summary>
                    <div className="px-3 pb-2">
                      <p className="text-[13px] text-[var(--color-ink)] mt-1 mb-2">{c.antwort}</p>
                      {einheit && (
                        <Facts item={einheit} related={relatedProzesse[einheit.id]} t={t} />
                      )}
                    </div>
                  </details>
                );
              })}
            </div>
          )}
          {results.departments.map((dep) => (
            <ItemCard
              key={`d-${dep.id}`}
              title={dep.name}
              path={t('department')}
              item={dep}
              related={relatedProzesse[dep.id]}
              t={t}
            />
          ))}
          {results.units.map((u) => (
            <ItemCard
              key={`u-${u.id}`}
              title={u.name}
              path={`${depName.get(u.parent) ?? u.parent} › ${u.name}`}
              item={u}
              related={relatedProzesse[u.id]}
              t={t}
            />
          ))}
          {results.beteiligungen.map((b) => (
            <ItemCard
              key={`b-${b.id}`}
              title={b.name}
              path={t('beteiligung')}
              item={b}
              related={relatedProzesse[b.id]}
              t={t}
            />
          ))}
        </div>
      ) : (
        <div>
          {data.departments.map((dep) => {
            const units = unitsByDep.get(dep.id) ?? [];
            return (
              <details key={dep.id} className="mb-1.5 rounded-lg border border-[var(--color-line)] bg-[var(--color-panel)]">
                <summary className="cursor-pointer px-3 py-2 text-sm font-semibold text-[var(--color-ink)] select-none">
                  {dep.name}
                  <span className="text-[var(--color-mute)] font-normal"> ({units.length})</span>
                </summary>
                <div className="px-3 pb-2">
                  <Facts item={dep} related={relatedProzesse[dep.id]} t={t} />
                  {units.map((u) => (
                    <ItemCard
                      key={u.id}
                      title={u.name}
                      path={`${dep.name} › ${u.name}`}
                      item={u}
                      related={relatedProzesse[u.id]}
                      t={t}
                      nested
                    />
                  ))}
                </div>
              </details>
            );
          })}
          {data.beteiligungen.length > 0 && (
            <details className="mb-1.5 rounded-lg border border-[var(--color-line)] bg-[var(--color-panel)]">
              <summary className="cursor-pointer px-3 py-2 text-sm font-semibold text-[var(--color-ink)] select-none">
                {t('beteiligungenHeading')}
                <span className="text-[var(--color-mute)] font-normal"> ({data.beteiligungen.length})</span>
              </summary>
              <div className="px-3 pb-2">
                {data.beteiligungen.map((b) => (
                  <ItemCard key={b.id} title={b.name} path={t('beteiligung')} item={b} related={relatedProzesse[b.id]} t={t} nested />
                ))}
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

type TFn = ReturnType<typeof useTranslations<'Explorer'>>;

function ItemCard({
  title, path, item, related, t, nested,
}: {
  title: string;
  path: string;
  item: Department | Unit | Beteiligung;
  related?: ExplorerRelatedProzess[];
  t: TFn;
  nested?: boolean;
}) {
  return (
    <details className={`rounded-lg border border-[var(--color-line)] bg-[var(--color-bg)] ${nested ? 'mt-1.5' : 'mb-1.5'}`}>
      <summary className="cursor-pointer px-3 py-2 select-none">
        <span className="text-sm text-[var(--color-ink)]">{title}</span>
        <span className="block text-[11px] text-[var(--color-mute)]">{path}</span>
      </summary>
      <div className="px-3 pb-2">
        <Facts item={item} related={related} t={t} />
      </div>
    </details>
  );
}

function Facts({
  item, related, t,
}: {
  item: Department | Unit | Beteiligung;
  related?: ExplorerRelatedProzess[];
  t: TFn;
}) {
  const rows: { k: string; v: string }[] = [];
  if ('vorsteher' in item && item.vorsteher) rows.push({ k: t('vorsteher'), v: item.vorsteher });
  rows.push({ k: t('id'), v: item.id });
  if (item.budget?.aufwand != null) rows.push({ k: t('budget'), v: fmtCHF(item.budget.aufwand) });
  if (item.budget?.nettoaufwand != null) rows.push({ k: t('netExpense'), v: fmtCHF(item.budget.nettoaufwand) });
  if (item.fte?.schaetzung != null) rows.push({ k: t('fte'), v: fmtNumber(item.fte.schaetzung) });

  return (
    <>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[12px] m-0">
        {rows.map((r, i) => (
          <span key={i} style={{ display: 'contents' }}>
            <dt className="text-[var(--color-mute)]">{r.k}</dt>
            <dd className="m-0 text-[var(--color-ink)] tabular-nums">{r.v}</dd>
          </span>
        ))}
      </dl>
      {related && related.length > 0 && (
        <div className="mt-2">
          <div className="text-[11px] uppercase tracking-wider text-[var(--color-mute)] mb-1">{t('relatedProcesses')}</div>
          <ul className="list-none m-0 p-0 flex flex-col gap-1">
            {related.map((p) => (
              <li key={`${p.city}/${p.id}`}>
                <Link
                  href={{ pathname: `/prozesse/${p.city}/${p.id}` }}
                  className="text-[12px] text-[var(--color-accent)] underline"
                >
                  {p.titel}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
