import '../globals.css';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { hasLocale } from 'next-intl';
import IntlProvider from '@/components/IntlProvider';
import { getTheme } from '@/lib/theme';
import { routing, type Locale } from '@/i18n/routing';
import { getT, getMessages } from '@/lib/i18n-server';
import { city, themeCssVars } from '@/config/city.config';

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

  const theme = await getTheme();
  const messages = getMessages(locale as Locale);

  // BCP-47-Tag aus der City-Config (htmlLang) — die Regions-Tags (de-CH …)
  // sind stadt-/länderspezifisch, kein App-Wissen. Fallback: roher Locale-Code.
  const htmlLang = city.htmlLang?.[locale as Locale] ?? locale;

  return (
    <html lang={htmlLang} className={theme === 'dark' ? 'dark' : ''}>
      <head>
        <style
          dangerouslySetInnerHTML={{ __html: themeCssVars() }}
        />
      </head>
      <body className="font-sans antialiased">
        <IntlProvider locale={locale} messages={messages}>
          {children}
        </IntlProvider>
      </body>
    </html>
  );
}
