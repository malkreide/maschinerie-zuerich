'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import LanguageSwitcher from './LanguageSwitcher';

const ROUTES = [
  { href: '/',              key: 'graph' },
  { href: '/steuerfranken', key: 'tax' },
  { href: '/prozesse',      key: 'prozesse' },
  { href: '/liste',         key: 'list' },
] as const;

const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export default function Header() {
  const t = useTranslations('App');
  const tNav = useTranslations('Nav');
  const pathname = usePathname();
  const [dark, setDark] = useState<boolean | null>(null);

  useEffect(() => {
    // Sync mit der vom Server gesetzten <html class="dark">. Die Rule
    // react-hooks/set-state-in-effect warnt hier zu Recht im Allgemeinen,
    // aber bei reiner DOM-Hydration nach SSR ist das der empfohlene Weg.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDark(document.documentElement.classList.contains('dark'));
  }, []);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    document.cookie =
      `mog-theme=${next ? 'dark' : 'light'}; path=/; max-age=${COOKIE_MAX_AGE}; samesite=lax`;
  }

  return (
    <header className="fixed inset-x-0 top-0 h-14 z-10 flex items-center px-4
                       bg-[var(--color-accent)] text-white">
      <h1 className="text-base font-semibold m-0">{t('title')}</h1>
      <span className="ml-3 text-xs opacity-85 hidden sm:inline">{t('subtitle')}</span>
      <span className="flex-1" />
      <nav role="tablist" aria-label={tNav('graph')} className="flex gap-1 mr-3">
        {ROUTES.map((r) => {
          // Sub-Routen (z.B. /prozesse/zh/...) aktivieren den übergeordneten
          // Tab, damit der Navigationszustand auch in der Detail-Seite stimmt.
          const active =
            pathname === r.href ||
            (r.href !== '/' && pathname.startsWith(r.href + '/'));
          return (
            <Link
              key={r.href}
              href={r.href}
              role="tab"
              aria-selected={active}
              prefetch
              className={
                'px-3.5 py-1.5 rounded-md text-xs border border-white/20 no-underline ' +
                (active
                  ? 'bg-white text-[var(--color-accent)] font-semibold'
                  : 'bg-white/10 hover:bg-white/20 text-white')
              }
            >
              {tNav(r.key)}
            </Link>
          );
        })}
      </nav>
      <LanguageSwitcher />
      <button
        type="button"
        aria-pressed={dark ?? false}
        aria-label={dark ? tNav('darkOff') : tNav('darkOn')}
        onClick={toggleTheme}
        className="px-2.5 py-1.5 rounded-md text-xs border border-white/20 bg-white/10 hover:bg-white/20"
      >
        {dark === null ? tNav('darkLabelLoading') : dark ? tNav('darkLabelLight') : tNav('darkLabelDark')}
      </button>
    </header>
  );
}
