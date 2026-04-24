import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { loadStadtData } from '@/lib/data';
import { routing, type Locale } from '@/i18n/routing';
import { getT } from '@/lib/i18n-server';
import { city } from '@/config/city.config';
import TreemapLoader from '@/components/TreemapLoader';

export async function generateMetadata({
  params,
}: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const tApp = getT(locale as Locale, 'App');
  const t    = getT(locale as Locale, 'Treemap');
  return { title: `${t('title')} · ${tApp('title')}` };
}

export default async function SteuerfrankenPage({
  params,
}: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const data = await loadStadtData();
  return <TreemapLoader data={data} rootName={city.name[locale as Locale]} />;
}
