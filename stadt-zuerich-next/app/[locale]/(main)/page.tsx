import { Suspense } from 'react';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { loadStadtData } from '@/lib/data';
import { buildEinheitProzesseMap, buildProzessEinheitenMap } from '@/lib/prozesse';
import { buildEinheitLebenslagenMap } from '@/lib/lebenslage-graph';
import { resolveContent } from '@/lib/search';
import { getT } from '@/lib/i18n-server';
import { routing, type Locale } from '@/i18n/routing';
import { resolveI18n, type ProzessLocale } from '@/types/prozess';
import type { LebenslageLocale } from '@/types/stadt';
import GraphView from '@/components/GraphView';
import DetailPanel, { type RelatedProzess, type RelatedLebenslage } from '@/components/DetailPanel';
import Legend from '@/components/Legend';
import BudgetSummary from '@/components/BudgetSummary';
import MobileExplorer from '@/components/MobileExplorer';

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
  const [data, einheitProzesseMap, prozessEinheiten] = await Promise.all([
    loadStadtData(),
    buildEinheitProzesseMap(),
    buildProzessEinheitenMap(),
  ]);
  const relatedProzesse: Record<string, RelatedProzess[]> = {};
  for (const [einheitId, entries] of Object.entries(einheitProzesseMap)) {
    relatedProzesse[einheitId] = entries.map((e) => ({
      id: e.id,
      city: e.city,
      titel: resolveI18n(e.titel, lebLoc),
    }));
  }

  // N:M-Reverse: Einheit → betreffende Lebenslagen (zuständig oder über ein
  // verlinktes Verfahren beteiligt). titel/term server-seitig aufgelöst.
  const einheitLebenslagen = buildEinheitLebenslagenMap(data.lebenslagen ?? [], prozessEinheiten);
  const relatedLebenslagen: Record<string, RelatedLebenslage[]> = {};
  for (const [einheitId, list] of Object.entries(einheitLebenslagen)) {
    relatedLebenslagen[einheitId] = list.map((l) => {
      const c = resolveContent(l, lebLoc as unknown as LebenslageLocale);
      return { id: l.id, frage: c?.frage ?? l.id, term: c?.stichworte?.[0] ?? c?.frage ?? l.id };
    });
  }

  const tNav = getT(locale as Locale, 'Nav');

  return (
    // Ein gemeinsames <main>-Landmark für beide (per CSS exklusive) Ansichten:
    // Desktop-Graph bzw. Mobile-Explorer. Gibt der Hauptseite den fehlenden
    // Haupt-Landmark (a11y) und einen stabilen Anker.
    <main aria-label={tNav('graph')}>
      <div className="hidden sm:block relative h-[calc(100vh-56px)] mt-14 overflow-hidden">
        <Suspense fallback={null}>
          <GraphView data={data} locale={locale as Locale} />
          <DetailPanel data={data} relatedProzesse={relatedProzesse} relatedLebenslagen={relatedLebenslagen} />
        </Suspense>
        <Legend locale={locale as Locale} />
        {/* Pro-Kopf-Banner über dem Graphen — gibt der Visualisierung sofort
            eine Bezugsgrösse, ohne dass User:innen erst klicken müssen. */}
        <BudgetSummary data={data} locale={locale as Locale} />
      </div>
      <div className="block sm:hidden">
        <MobileExplorer data={data} relatedProzesse={relatedProzesse} />
      </div>
    </main>
  );
}
