// Öffentliche Roadmap: zeigt kuratierte GitHub-Issues (Feedback + Strategie)
// statusbasiert. Server-rendered, funktioniert ohne JS. Datenschutzschonend —
// keine Autor:innen, keine Issue-Bodies (siehe lib/roadmap.ts).

import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { routing, type Locale } from '@/i18n/routing';
import { getT } from '@/lib/i18n-server';
import { fetchRoadmap, ROADMAP_STATUS_ORDER } from '@/lib/roadmap';
import { FEEDBACK_CATEGORIES } from '@/lib/feedback';

const KNOWN_CATEGORIES = new Set<string>(FEEDBACK_CATEGORIES);

// ISR: passt zum 5-Minuten-Cache des GitHub-Fetches.
export const revalidate = 300;

const REPO_ISSUES_URL = `https://github.com/${process.env.ROADMAP_GITHUB_REPO ?? 'malkreide/maschinerie-zuerich'}/issues`;

export async function generateMetadata({
  params,
}: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const tApp = getT(locale as Locale, 'App');
  const t = getT(locale as Locale, 'Roadmap');
  return { title: `${t('title')} · ${tApp('title')}`, description: t('intro') };
}

export default async function RoadmapPage({
  params,
}: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = getT(locale as Locale, 'Roadmap');
  const tCat = getT(locale as Locale, 'Feedback');

  const items = await fetchRoadmap();

  return (
    <main
      className="absolute top-14 inset-x-0 bottom-0 px-6 pt-4 pb-10 overflow-y-auto bg-[var(--color-bg)]"
      aria-labelledby="roadmap-heading"
    >
      <h2 id="roadmap-heading" className="text-lg font-semibold mb-1">{t('title')}</h2>
      <p className="text-[13px] text-[var(--color-mute)] mb-5 max-w-[70ch]">{t('intro')}</p>

      {items === null && (
        <p className="text-[var(--color-mute)] max-w-[70ch]">
          {t('unavailable')}{' '}
          <a href={REPO_ISSUES_URL} target="_blank" rel="noopener noreferrer" className="text-[var(--color-accent)] underline">
            {t('viewOnGithub')}
          </a>
        </p>
      )}

      {items !== null && items.length === 0 && (
        <p className="text-[var(--color-mute)] max-w-[70ch]">
          {t('empty')}{' '}
          <a href={REPO_ISSUES_URL} target="_blank" rel="noopener noreferrer" className="text-[var(--color-accent)] underline">
            {t('viewOnGithub')}
          </a>
        </p>
      )}

      {items !== null && items.length > 0 && (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4 max-w-[1200px]">
          {ROADMAP_STATUS_ORDER.map((status) => {
            const col = items.filter((i) => i.status === status);
            return (
              <section key={status} aria-labelledby={`col-${status}`}>
                <h3
                  id={`col-${status}`}
                  className="text-sm font-semibold uppercase tracking-wider text-[var(--color-mute)] mb-3 flex items-center gap-2"
                >
                  {t(`status.${status}`)}
                  <span className="text-[11px] font-normal bg-[var(--color-panel)] border border-[var(--color-line)] rounded-full px-1.5">
                    {col.length}
                  </span>
                </h3>
                {col.length === 0 ? (
                  <p className="text-[12px] text-[var(--color-mute)]">{t('columnEmpty')}</p>
                ) : (
                  <ul className="grid gap-2 list-none m-0 p-0">
                    {col.map((item) => (
                      <li
                        key={item.number}
                        className="bg-[var(--color-panel)] rounded-lg border border-[var(--color-line)] p-3"
                      >
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[13px] text-[var(--color-ink)] no-underline hover:text-[var(--color-accent)] font-medium leading-snug"
                        >
                          {item.title}
                        </a>
                        <div className="mt-1.5 flex flex-wrap gap-1.5 items-center text-[10px]">
                          {item.category && (
                            <span className="px-1.5 py-0.5 rounded-full bg-[var(--color-bg)] border border-[var(--color-line)] text-[var(--color-mute)]">
                              {KNOWN_CATEGORIES.has(item.category) ? tCat(`category.${item.category}`) : item.category}
                            </span>
                          )}
                          {item.lang && (
                            <span className="px-1.5 py-0.5 rounded-full bg-[var(--color-bg)] border border-[var(--color-line)] text-[var(--color-mute)] uppercase">
                              {item.lang}
                            </span>
                          )}
                          <span className="text-[var(--color-mute)]">#{item.number}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}

      {items !== null && items.length > 0 && (
        <p className="mt-6 text-[12px] text-[var(--color-mute)]">
          <a href={REPO_ISSUES_URL} target="_blank" rel="noopener noreferrer" className="text-[var(--color-accent)] underline">
            {t('viewOnGithub')}
          </a>
        </p>
      )}
    </main>
  );
}
