// Server-Route für die Lebenslagen-Suche. Funktioniert komplett ohne JS:
// - <form action="/anliegen"> in der Header-Suchleiste submittet hierher
// - Trefferliste wird server-rendered, jeder Treffer ist ein <Link> zur
//   Maschinerie mit ?focus=<unit-id>

import type { Metadata } from 'next';
import { Link } from '@/i18n/navigation';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { routing, type Locale } from '@/i18n/routing';
import { loadStadtData } from '@/lib/data';
import { searchLebenslagen, resolveContent } from '@/lib/search';
import { buildProzessSlugMap, buildProzessEinheitenMap } from '@/lib/prozesse';
import { involvedUnits } from '@/lib/lebenslage-graph';
import { resolveI18n, type ProzessLocale } from '@/types/prozess';
import { getT } from '@/lib/i18n-server';
import { ZIELGRUPPEN } from '@/types/stadt';
import type { Department, Unit, Beteiligung, StadtData, LebenslageLocale, Zielgruppe, Lebenslage } from '@/types/stadt';

export async function generateMetadata({
  params,
}: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const tApp = getT(locale as Locale, 'App');
  const t    = getT(locale as Locale, 'Anliegen');
  return { title: `${t('title')} · ${tApp('title')}`, description: t('intro') };
}

export default async function AnliegenPage({
  params, searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; zg?: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  const { q = '', zg: zgRaw } = await searchParams;
  const data = await loadStadtData();
  const lebLocale = locale as LebenslageLocale;
  const allLeb = data.lebenslagen ?? [];
  // Auflösungstabelle für die explizite Lebenslage→Verfahren-Verknüpfung.
  const prozessMap = await buildProzessSlugMap();
  // N:M: alle an einer Lebenslage beteiligten Einheiten (über die Verfahren).
  const prozessEinheiten = await buildProzessEinheitenMap();

  // Aktiver Zielgruppen-Filter (nur gültige Taxonomie-Werte zählen).
  const zg = (ZIELGRUPPEN as readonly string[]).includes(zgRaw ?? '')
    ? (zgRaw as Zielgruppe)
    : undefined;
  const inZg = (l: Lebenslage) => !zg || (l.zielgruppen?.includes(zg) ?? false);

  const matches = (q.trim() ? searchLebenslagen(q, allLeb, lebLocale) : []).filter(inZg);
  // Browse-/Fallback-Liste: bei aktivem Filter die ganze Zielgruppe, sonst Top-8.
  const browse = allLeb.filter(inZg).slice(0, zg ? 50 : 8);
  const t       = getT(locale as Locale, 'Anliegen');
  const tSearch = getT(locale as Locale, 'Search');
  const tZg     = getT(locale as Locale, 'Zielgruppen');
  const tProz   = getT(locale as Locale, 'Prozesse');

  const formAction = `/${locale}/anliegen`;

  return (
    <main
      className="absolute top-14 inset-x-0 bottom-0 px-6 pt-4 pb-10 overflow-y-auto bg-[var(--color-bg)]"
      aria-labelledby="anliegen-heading"
    >
      <h2 id="anliegen-heading" className="text-lg font-semibold mb-1">{t('title')}</h2>
      <p className="text-[13px] text-[var(--color-mute)] mb-5 max-w-[70ch]">{t('intro')}</p>

      <form method="get" action={formAction} className="mb-6 flex gap-2 max-w-[70ch]">
        <label htmlFor="q-server" className="sr-only">{tSearch('label')}</label>
        <input
          id="q-server"
          name="q"
          type="search"
          defaultValue={q}
          autoFocus
          placeholder={t('placeholder')}
          className="flex-1 border border-[var(--color-line)] bg-[var(--color-panel)] text-[var(--color-ink)] px-3 py-2 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
        />
        <button
          type="submit"
          className="px-4 py-2 bg-[var(--color-accent)] text-white rounded text-sm font-semibold hover:opacity-90"
        >
          {tSearch('submit')}
        </button>
      </form>

      {allLeb.length > 0 && (
        <nav aria-label={tZg('filterLabel')} className="mb-6 flex flex-wrap gap-2 max-w-[70ch]">
          <Link
            href={{ pathname: '/anliegen', query: q ? { q } : {} }}
            aria-current={!zg ? 'true' : undefined}
            className={chipClass(!zg)}
          >
            {tZg('all')}
          </Link>
          {ZIELGRUPPEN.map((tag) => (
            <Link
              key={tag}
              href={{ pathname: '/anliegen', query: q ? { q, zg: tag } : { zg: tag } }}
              aria-current={zg === tag ? 'true' : undefined}
              className={chipClass(zg === tag)}
            >
              {tZg(tag)}
            </Link>
          ))}
        </nav>
      )}

      {q && matches.length === 0 && (
        <>
          <p className="text-[var(--color-mute)] max-w-[70ch] mb-4">{t('noResults', { query: q })}</p>
          {browse.length > 0 && (
            <section aria-labelledby="noresults-fallback-heading" className="max-w-[70ch]">
              <h3
                id="noresults-fallback-heading"
                className="text-sm font-semibold uppercase tracking-wider text-[var(--color-mute)] mb-3"
              >
                {t('noResultsFallbackHeading')}
              </h3>
              <ul className="grid gap-2 list-none m-0 p-0">
                {browse.map((l) => {
                  const c = resolveContent(l, lebLocale);
                  if (!c) return null;
                  const term = c.stichworte[0] ?? c.frage;
                  return (
                    <li key={l.id}>
                      <Link
                        href={{ pathname: '/anliegen', query: zg ? { q: term, zg } : { q: term } }}
                        className="block px-3 py-2 bg-[var(--color-panel)] border border-[var(--color-line)] rounded text-[var(--color-ink)] no-underline hover:bg-[var(--color-bg)] text-sm"
                      >
                        {c.frage}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </>
      )}

      {matches.length > 0 && (
        <>
          <p className="text-xs text-[var(--color-mute)] mb-3 max-w-[70ch]">
            {t('resultsCount', { count: matches.length, query: q })}
          </p>
          <ul className="grid gap-3 max-w-[70ch] list-none m-0 p-0">
            {matches.map((l) => {
              const item = findItem(data, l.zustaendig);
              // Explizit verknüpfte, tatsächlich vorhandene Verfahren.
              const linkedProz = (l.prozesse ?? [])
                .map((slug) => prozessMap[slug])
                .filter((p): p is NonNullable<typeof p> => Boolean(p));
              // Weitere beteiligte Stellen (aus den verlinkten Verfahren),
              // ohne die bereits angezeigte primär zuständige Stelle.
              const weitereStellen = involvedUnits(l, prozessEinheiten)
                .filter((u) => u !== l.zustaendig)
                .map((u) => ({ id: u, item: findItem(data, u) }))
                .filter((x) => x.item);
              return (
                <li key={l.id} className="bg-[var(--color-panel)] rounded-lg shadow border border-[var(--color-line)]">
                  <Link
                    href={{ pathname: '/', query: { focus: l.zustaendig } }}
                    className="block p-4 no-underline text-[var(--color-ink)] hover:bg-[var(--color-bg)] rounded-t-lg"
                  >
                    <div className="font-semibold text-base mb-1">{l.frage}</div>
                    {l.antwort && (
                      <p className="text-sm text-[var(--color-mute)] m-0 mb-2">{l.antwort}</p>
                    )}
                    <div className="text-[13px] text-[var(--color-accent)]">
                      → {item?.name ?? l.zustaendig}
                    </div>
                  </Link>
                  {linkedProz.length > 0 && (
                    <div className="px-4 pb-3 flex flex-wrap gap-2">
                      {linkedProz.map((pe) => (
                        <Link
                          key={pe.slug}
                          href={{ pathname: `/prozesse/${pe.city}/${pe.id}` }}
                          className="inline-flex items-center gap-1 text-[12px] px-2 py-1 rounded-full border border-[var(--color-accent)] text-[var(--color-accent)] no-underline hover:bg-[var(--color-accent)] hover:text-white transition-colors"
                        >
                          <span aria-hidden>⚙</span>
                          {t('relatedProcess')}: {resolveI18n(pe.titel, locale as ProzessLocale)}
                          {pe.hochrisiko && (
                            <span
                              className="ml-1 px-1.5 rounded-full border border-red-300 bg-red-50 text-red-800"
                              title={tProz('disclaimerHochrisikoLabel')}
                            >
                              <span aria-hidden>⚠</span>
                              <span className="sr-only">{tProz('disclaimerHochrisikoLabel')}</span>
                            </span>
                          )}
                        </Link>
                      ))}
                    </div>
                  )}
                  {weitereStellen.length > 0 && (
                    <div className="px-4 pb-3 flex flex-wrap items-center gap-2">
                      <span className="text-[12px] text-[var(--color-mute)]">{t('weitereStellen')}:</span>
                      {weitereStellen.map(({ id, item: u }) => (
                        <Link
                          key={id}
                          href={{ pathname: '/', query: { focus: id } }}
                          className="inline-block text-[12px] px-2 py-1 rounded-full border border-[var(--color-line)] bg-[var(--color-bg)] text-[var(--color-ink)] no-underline hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition-colors"
                        >
                          {u!.name}
                        </Link>
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}

      {!q && browse.length > 0 && (
        <section aria-labelledby="popular-heading" className="max-w-[70ch]">
          <h3 id="popular-heading"
              className="text-sm font-semibold uppercase tracking-wider text-[var(--color-mute)] mb-3">
            {zg ? tZg(zg) : t('popularHeading')}
          </h3>
          <ul className="grid gap-2 list-none m-0 p-0">
            {browse.map((l) => {
              const c = resolveContent(l, lebLocale);
              if (!c) return null;
              const term = c.stichworte[0] ?? c.frage;
              return (
                <li key={l.id}>
                  <Link
                    href={{ pathname: '/anliegen', query: zg ? { q: term, zg } : { q: term } }}
                    className="block px-3 py-2 bg-[var(--color-panel)] border border-[var(--color-line)] rounded text-[var(--color-ink)] no-underline hover:bg-[var(--color-bg)] text-sm"
                  >
                    {c.frage}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </main>
  );
}

// Tailwind-Klassen für die Zielgruppen-Filter-Chips.
function chipClass(active: boolean): string {
  return [
    'inline-block px-3 py-1 rounded-full text-[13px] no-underline border transition-colors',
    active
      ? 'bg-[var(--color-accent)] text-white border-[var(--color-accent)]'
      : 'bg-[var(--color-panel)] text-[var(--color-ink)] border-[var(--color-line)] hover:bg-[var(--color-bg)]',
  ].join(' ');
}

function findItem(data: StadtData, id: string): Department | Unit | Beteiligung | null {
  return data.departments.find((d) => d.id === id)
    ?? data.units.find((u) => u.id === id)
    ?? data.beteiligungen.find((b) => b.id === id)
    ?? null;
}
