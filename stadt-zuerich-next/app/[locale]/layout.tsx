import '../globals.css';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider, hasLocale } from 'next-intl';
import Shell from '@/components/Shell';
import { loadStadtData } from '@/lib/data';
import { getTheme } from '@/lib/theme';
import { routing, type Locale } from '@/i18n/routing';
import { getT, getMessages } from '@/lib/i18n-server';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = getT(locale as Locale, 'App');
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

  const data = await loadStadtData();
  const theme = await getTheme();
  const t = getT(locale as Locale, 'Nav');
  const messages = getMessages(locale as Locale);

  const htmlLang = ({ de: 'de-CH', en: 'en', fr: 'fr-CH', it: 'it-CH', ls: 'de-CH' } as const)[locale as Locale];

  return (
    <html lang={htmlLang} className={theme === 'dark' ? 'dark' : ''}>
      <body className="font-sans antialiased">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <a className="skip-link" href={locale === 'de' ? '/liste' : `/${locale}/liste`}>
            {t('skipToList')}
          </a>
          <Shell lebenslagen={data.lebenslagen ?? []}>{children}</Shell>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
