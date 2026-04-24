import { Suspense } from 'react';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { loadStadtData } from '@/lib/data';
import { buildEinheitProzesseMap } from '@/lib/prozesse';
import { routing, type Locale } from '@/i18n/routing';
import { resolveI18n, type ProzessLocale } from '@/types/prozess';
import GraphView from '@/components/GraphView';
import DetailPanel, { type RelatedProzess } from '@/components/DetailPanel';
import Legend from '@/components/Legend';

export default async function MaschineriePage({
  params,
}: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const lebLoc = locale as ProzessLocale;

  // Org-Chart-Daten + Reverse-Index einheit_ref → Prozesse parallel laden.
  // Der Reverse-Index lebt im Server-Component; wir lösen titel hier schon
  // mit dem aktiven Locale auf, damit DetailPanel (Client) keine eigene
  // resolveI18n-Auflösung braucht.
  const [data, einheitProzesseMap] = await Promise.all([
    loadStadtData(),
    buildEinheitProzesseMap(),
  ]);
  const relatedProzesse: Record<string, RelatedProzess[]> = {};
  for (const [einheitId, entries] of Object.entries(einheitProzesseMap)) {
    relatedProzesse[einheitId] = entries.map((e) => ({
      id: e.id,
      city: e.city,
      titel: resolveI18n(e.titel, lebLoc),
    }));
  }

  return (
    <>
      {/* Suspense ist Pflicht, weil GraphView/DetailPanel useSearchParams() nutzen */}
      <Suspense fallback={null}>
        <GraphView data={data} />
        <DetailPanel data={data} relatedProzesse={relatedProzesse} />
      </Suspense>
      <Legend locale={locale as Locale} />
    </>
  );
}
