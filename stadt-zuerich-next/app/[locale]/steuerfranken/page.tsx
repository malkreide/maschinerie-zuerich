import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { loadStadtData } from '@/lib/data';
import { routing, type Locale } from '@/i18n/routing';
import TreemapView from '@/components/TreemapView';

export async function generateMetadata({
  params,
}: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const tApp = await getTranslations({ locale, namespace: 'App' });
  const t    = await getTranslations({ locale, namespace: 'Treemap' });
  return { title: `${t('title')} · ${tApp('title')}` };
}

export default async function SteuerfrankenPage({
  params,
}: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale as Locale);
  const data = await loadStadtData();
  return <TreemapView data={data} />;
}
