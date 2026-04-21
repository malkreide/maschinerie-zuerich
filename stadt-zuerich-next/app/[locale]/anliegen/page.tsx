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
import { getT } from '@/lib/i18n-server';
import type { Department, Unit, Beteiligung, StadtData, LebenslageLocale } from '@/types/stadt';

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
  searchParams: Promise<{ q?: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  const { q = '' } = await searchParams;
  const data = await loadStadtData();
  const lebLocale = locale as LebenslageLocale;
  const matches = q.trim() ? searchLebenslagen(q, data.lebenslagen ?? [], lebLocale) : [];
  const t       = getT(locale as Locale, 'Anliegen');
  const tSearch = getT(locale as Locale, 'Search');

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

      {q && matches.length === 0 && (
        <p className="text-[var(--color-mute)] max-w-[70ch]">{t('noResults', { query: q })}</p>
      )}

      {matches.length > 0 && (
        <>
          <p className="text-xs text-[var(--color-mute)] mb-3 max-w-[70ch]">
            {t('resultsCount', { count: matches.length, query: q })}
          </p>
          <ul className="grid gap-3 max-w-[70ch] list-none m-0 p-0">
            {matches.map((l) => {
              const item = findItem(data, l.zustaendig);
              return (
                <li key={l.id} className="bg-[var(--color-panel)] rounded-lg shadow border border-[var(--color-line)]">
                  <Link
                    href={{ pathname: '/', query: { focus: l.zustaendig } }}
                    className="block p-4 no-underline text-[var(--color-ink)] hover:bg-[var(--color-bg)] rounded-lg"
                  >
                    <div className="font-semibold text-base mb-1">{l.frage}</div>
                    {l.antwort && (
                      <p className="text-sm text-[var(--color-mute)] m-0 mb-2">{l.antwort}</p>
                    )}
                    <div className="text-[13px] text-[var(--color-accent)]">
                      → {item?.name ?? l.zustaendig}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {!q && data.lebenslagen && data.lebenslagen.length > 0 && (
        <section aria-labelledby="popular-heading" className="max-w-[70ch]">
          <h3 id="popular-heading"
              className="text-sm font-semibold uppercase tracking-wider text-[var(--color-mute)] mb-3">
            {t('popularHeading')}
          </h3>
          <ul className="grid gap-2 list-none m-0 p-0">
            {data.lebenslagen.slice(0, 8).map((l) => {
              const c = resolveContent(l, lebLocale);
              if (!c) return null;
              return (
                <li key={l.id}>
                  <Link
                    href={{ pathname: '/anliegen', query: { q: c.stichworte[0] ?? c.frage } }}
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

function findItem(data: StadtData, id: string): Department | Unit | Beteiligung | null {
  return data.departments.find((d) => d.id === id)
    ?? data.units.find((u) => u.id === id)
    ?? data.beteiligungen.find((b) => b.id === id)
    ?? null;
}
