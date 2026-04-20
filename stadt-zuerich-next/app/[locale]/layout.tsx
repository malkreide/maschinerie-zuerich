import '../globals.css';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import Shell from '@/components/Shell';
import { loadStadtData } from '@/lib/data';
import { getTheme } from '@/lib/theme';
import { routing, type Locale } from '@/i18n/routing';

// Statische Vorgenerierung aller Locales als Fallback. (Mit Cookies wird's
// dynamisch — siehe Theme-Note unten — aber generateStaticParams hilft, falls
// jemand das Cookie-Lesen später wegrefaktoriert.)
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: 'App' });
  return { title: t('title'), description: t('subtitle') };
}

export default async function LocaleLayout({
  children, params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale as Locale);

  const data = await loadStadtData();
  const theme = await getTheme();
  const t = await getTranslations({ locale, namespace: 'Nav' });

  // <html lang> spiegelt das aktive Locale (für Screenreader und Browser-Heuristik)
  const htmlLang = ({ de: 'de-CH', en: 'en', fr: 'fr-CH', it: 'it-CH', ls: 'de-CH' } as const)[locale as Locale];

  return (
    <html lang={htmlLang} className={theme === 'dark' ? 'dark' : ''}>
      <body className="font-sans antialiased">
        <NextIntlClientProvider>
          <a className="skip-link" href={locale === 'de' ? '/liste' : `/${locale}/liste`}>
            {t('skipToList')}
          </a>
          <Shell lebenslagen={data.lebenslagen ?? []}>{children}</Shell>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
