'use client';

import { useTransition } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';
import { useSearchParams } from 'next/navigation';
import { routing, type Locale } from '@/i18n/routing';

const LANG_LABELS: Record<Locale, string> = {
  de: 'DE',
  en: 'EN',
  fr: 'FR',
  it: 'IT',
  ls: 'LS', // Leichte Sprache
};

const LANG_FULL: Record<Locale, string> = {
  de: 'Deutsch',
  en: 'English',
  fr: 'Français',
  it: 'Italiano',
  ls: 'Leichte Sprache',
};

export default function LanguageSwitcher() {
  const t = useTranslations('Nav');
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const params = useSearchParams();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const queryString = params.toString();
  const targetPath = queryString
    ? // pathname kommt locale-frei zurück; useRouter.replace fügt Prefix automatisch
      ((pathname + '?' + queryString) as Parameters<typeof router.replace>[0])
    : (pathname as Parameters<typeof router.replace>[0]);

  return (
    <label className="flex items-center gap-1 mr-2">
      <span className="sr-only">{t('language')}</span>
      <select
        aria-label={t('language')}
        value={locale}
        disabled={isPending}
        onChange={(e) => {
          const next = e.target.value as Locale;
          startTransition(() => router.replace(targetPath, { locale: next }));
        }}
        className="bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-md px-2 py-1 text-xs cursor-pointer focus:outline-none focus:ring-2 focus:ring-white/40"
      >
        {routing.locales.map((l) => (
          <option key={l} value={l} className="text-[var(--color-ink)] bg-[var(--color-panel)]">
            {LANG_LABELS[l]} – {LANG_FULL[l]}
          </option>
        ))}
      </select>
    </label>
  );
}
