import { Suspense } from 'react';
import { hasLocale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { loadStadtData } from '@/lib/data';
import { routing, type Locale } from '@/i18n/routing';
import GraphView from '@/components/GraphView';
import DetailPanel from '@/components/DetailPanel';
import Legend from '@/components/Legend';

export default async function MaschineriePage({
  params,
}: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale as Locale);
  const data = await loadStadtData();
  return (
    <>
      {/* Suspense ist Pflicht, weil GraphView/DetailPanel useSearchParams() nutzen */}
      <Suspense fallback={null}>
        <GraphView data={data} />
        <DetailPanel data={data} />
      </Suspense>
      <Legend />
    </>
  );
}
