// Index-Route für Verwaltungsprozesse. Listet alle Prozesse aller Städte
// nach dem OpenGov-Process-Schema. Server-rendered, keine JS nötig für den
// Index — React Flow kommt erst auf der Detail-Seite zum Zug.

import type { Metadata } from 'next';
import { Link } from '@/i18n/navigation';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { routing, type Locale } from '@/i18n/routing';
import { getT } from '@/lib/i18n-server';
import { listProzesse } from '@/lib/prozesse';
import { resolveI18n, type ProzessLocale } from '@/types/prozess';

export async function generateMetadata({
  params,
}: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const tApp = getT(locale as Locale, 'App');
  const t    = getT(locale as Locale, 'Prozesse');
  return { title: `${t('title')} · ${tApp('title')}`, description: t('intro') };
}

export default async function ProzesseIndex({
  params,
}: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = getT(locale as Locale, 'Prozesse');
  const lebLocale = locale as ProzessLocale;
  const entries = await listProzesse();

  // Gruppiere nach Stadt
  const byCity = entries.reduce<Record<string, typeof entries>>((acc, e) => {
    (acc[e.city] = acc[e.city] ?? []).push(e);
    return acc;
  }, {});
  const cityKeys = Object.keys(byCity).sort();

  return (
    <main
      className="absolute top-14 inset-x-0 bottom-0 px-6 pt-4 pb-10 overflow-y-auto bg-[var(--color-bg)]"
      aria-labelledby="prozesse-heading"
    >
      <h2 id="prozesse-heading" className="text-lg font-semibold mb-1">{t('title')}</h2>
      <p className="text-[13px] text-[var(--color-mute)] mb-5 max-w-[70ch]">{t('intro')}</p>

      {entries.length === 0 && (
        <p className="text-[var(--color-mute)] max-w-[70ch]">{t('empty')}</p>
      )}

      {cityKeys.map((city) => (
        <section key={city} aria-labelledby={`city-${city}`} className="mb-8">
          <h3
            id={`city-${city}`}
            className="text-sm font-semibold uppercase tracking-wider text-[var(--color-mute)] mb-3"
          >
            {t('city', { city: city.toUpperCase() })}
          </h3>
          <ul className="grid gap-3 max-w-[70ch] list-none m-0 p-0">
            {byCity[city].map((e) => (
              <li
                key={e.slug}
                className="bg-[var(--color-panel)] rounded-lg shadow border border-[var(--color-line)]"
              >
                <Link
                  href={{ pathname: `/prozesse/${e.city}/${e.id}` }}
                  className="block p-4 no-underline text-[var(--color-ink)] hover:bg-[var(--color-bg)] rounded-lg"
                >
                  <div className="font-semibold text-base mb-1 flex items-center gap-2 flex-wrap">
                    {resolveI18n(e.titel, lebLocale)}
                    {e.hochrisiko && (
                      <span className="text-[11px] font-normal px-2 py-0.5 rounded-full border border-red-300 bg-red-50 text-red-800">
                        <span aria-hidden="true">⚠ </span>{t('disclaimerHochrisikoLabel')}
                      </span>
                    )}
                  </div>
                  {e.kurzbeschreibung && (
                    <p className="text-sm text-[var(--color-mute)] m-0">
                      {resolveI18n(e.kurzbeschreibung, lebLocale)}
                    </p>
                  )}
                  <div className="text-[11px] text-[var(--color-mute)] mt-2 flex flex-wrap items-center gap-2">
                    <span>v{e.version}</span>
                    {typeof e.schritteCount === 'number' && (
                      <span className="px-2 py-0.5 rounded-full border border-[var(--color-line)] bg-[var(--color-bg)]">
                        {t('schritteAnzahl', { count: e.schritteCount })}
                      </span>
                    )}
                    {e.onlineReifegrad && (
                      <span className="px-2 py-0.5 rounded-full border border-[var(--color-line)] bg-[var(--color-bg)]">
                        {t('reifegradLabel')}: {t(`reifegrad.${e.onlineReifegrad}`)}
                      </span>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
