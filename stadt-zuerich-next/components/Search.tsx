'use client';

import { useId, useMemo, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Link, usePathname, useRouter, getPathname } from '@/i18n/navigation';
import type { Lebenslage } from '@/types/stadt';
import type { Locale } from '@/i18n/routing';
import { searchLebenslagen } from '@/lib/search';

export default function Search({ lebenslagen }: { lebenslagen: Lebenslage[] }) {
  const t = useTranslations('Search');
  const locale = useLocale() as Locale;
  const [q, setQ] = useState('');
  const id = useId();
  const router = useRouter();
  const pathname = usePathname();

  const matches = useMemo(() => searchLebenslagen(q, lebenslagen), [q, lebenslagen]);

  if (pathname === '/liste' || pathname === '/anliegen') return null;

  function jump(unitId: string) {
    setQ('');
    router.push({ pathname: '/', query: { focus: unitId } });
  }

  // Form-action muss locale-bewusste URL haben, damit Browser ohne JS auf
  // /anliegen mit korrektem Prefix landet.
  const formAction = getPathname({ href: '/anliegen', locale });

  return (
    <div
      role="search"
      className="fixed top-[64px] left-3 z-[9] bg-[var(--color-panel)] p-1.5 rounded-lg shadow flex flex-col gap-1 min-w-[320px] max-w-[380px]"
    >
      <form method="get" action={formAction} className="contents">
        <label htmlFor={id} className="sr-only">{t('label')}</label>
        <input
          id={id}
          name="q"
          type="search"
          autoComplete="off"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Escape') { setQ(''); e.currentTarget.blur(); } }}
          placeholder={t('placeholder')}
          className="border border-[var(--color-line)] bg-transparent text-[var(--color-ink)] px-2 py-1.5 rounded text-[13px] w-full focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
          aria-describedby={`${id}-help`}
        />
        <span id={`${id}-help`} className="sr-only">{t('help')}</span>
        <button type="submit" className="sr-only">{t('submit')}</button>
      </form>
      {matches.length > 0 && (
        <div role="listbox" aria-label={t('suggestionsListLabel')}
             className="max-h-[340px] overflow-y-auto border-t border-[var(--color-line)] pt-1 mt-0.5">
          <div className="text-[10px] uppercase text-[var(--color-mute)] tracking-wider px-1.5 pt-1.5 pb-0.5 font-semibold">
            {t('suggestionsTitle')}
          </div>
          {matches.map((l) => (
            <button
              key={l.id}
              type="button"
              role="option"
              onClick={() => jump(l.zustaendig)}
              className="block w-full text-left px-2 py-1.5 rounded mb-0.5 border border-transparent hover:bg-[var(--color-bg)] hover:border-[var(--color-line)] cursor-pointer"
            >
              <div className="text-[13px] text-[var(--color-ink)]">{l.frage}</div>
              <div className="text-[11px] text-[var(--color-accent)] mt-0.5">→ {l.zustaendig}</div>
            </button>
          ))}
          {q.trim() && (
            <Link
              href={{ pathname: '/anliegen', query: { q } }}
              onClick={() => setQ('')}
              className="block px-2 py-1.5 mt-1 text-[11px] text-[var(--color-mute)] hover:text-[var(--color-accent)] no-underline border-t border-[var(--color-line)]"
            >
              {t('showAll')}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
