import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { loadStadtData } from '@/lib/data';
import { routing, type Locale } from '@/i18n/routing';
import ListView from '@/components/ListView';

export async function generateMetadata({
  params,
}: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const tApp = await getTranslations({ locale, namespace: 'App' });
  const t    = await getTranslations({ locale, namespace: 'List' });
  return { title: `${t('title')} · ${tApp('title')}`, description: t('intro') };
}

export default async function ListePage({
  params,
}: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale as Locale);
  const data = await loadStadtData();
  return <ListView data={data} />;
}
