// Index-Route für Verwaltungsprozesse. Listet alle Prozesse aller Städte
// nach dem OpenGov-Process-Schema. Server-rendered: i18n wird hier aufgelöst,
// die Interaktivität (Reifegrad-Filter) übernimmt der Client-Island
// ProzesseExplorer. React Flow kommt erst auf der Detail-Seite zum Zug.

import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { routing, type Locale } from '@/i18n/routing';
import { getT } from '@/lib/i18n-server';
import { listProzesse } from '@/lib/prozesse';
import { resolveI18n, type ProzessLocale, type OnlineReifegrad } from '@/types/prozess';
import { REIFEGRAD_ORDER } from '@/lib/reifegrad';
import ProzesseExplorer, {
  type ExplorerGroup,
} from '@/components/ProzesseExplorer';

export async function generateMetadata({
  params,
}: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const tApp = getT(locale as Locale, 'App');
  const t    = getT(locale as Locale, 'Prozesse');
  return { title: `${t('title')} · ${tApp('title')}`, description: t('intro') };
}

export default async function ProzesseIndex({
  params,
}: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = getT(locale as Locale, 'Prozesse');
  const lebLocale = locale as ProzessLocale;
  const entries = await listProzesse();

  // Gruppiere nach Stadt und löse alle i18n-Texte server-seitig auf, damit der
  // Client-Island nur noch serialisierbare Strings erhält.
  const byCity = entries.reduce<Record<string, typeof entries>>((acc, e) => {
    (acc[e.city] = acc[e.city] ?? []).push(e);
    return acc;
  }, {});
  const cityKeys = Object.keys(byCity).sort();

  const groups: ExplorerGroup[] = cityKeys.map((city) => ({
    city,
    cityLabel: t('city', { city: city.toUpperCase() }),
    items: byCity[city].map((e) => ({
      city: e.city,
      id: e.id,
      pathname: `/prozesse/${e.city}/${e.id}`,
      title: resolveI18n(e.titel, lebLocale),
      description: e.kurzbeschreibung
        ? resolveI18n(e.kurzbeschreibung, lebLocale)
        : undefined,
      schritteText:
        typeof e.schritteCount === 'number'
          ? t('schritteAnzahl', { count: e.schritteCount })
          : undefined,
      version: e.version,
      hochrisiko: Boolean(e.hochrisiko),
      hochrisikoLabel: t('disclaimerHochrisikoLabel'),
      reifegrad: e.onlineReifegrad,
      reifegradLabel: e.onlineReifegrad
        ? t(`reifegrad.${e.onlineReifegrad}`)
        : undefined,
    })),
  }));

  const reifegradLabels = Object.fromEntries(
    REIFEGRAD_ORDER.map((g) => [g, t(`reifegrad.${g}`)]),
  ) as Record<OnlineReifegrad, string>;

  return (
    <main
      className="absolute top-14 inset-x-0 bottom-0 px-4 sm:px-6 pt-4 pb-10 overflow-y-auto bg-[var(--color-bg)]"
      aria-labelledby="prozesse-heading"
    >
      <h2 id="prozesse-heading" className="text-lg font-semibold mb-1">{t('title')}</h2>
      <p className="text-[13px] text-[var(--color-mute)] mb-5 max-w-[70ch]">{t('intro')}</p>

      {entries.length === 0 ? (
        <p className="text-[var(--color-mute)] max-w-[70ch]">{t('empty')}</p>
      ) : (
        <ProzesseExplorer
          groups={groups}
          labels={{
            filterHeading: t('filterReifegradHeading'),
            alle: t('filterAlle'),
            reifegradLabel: t('reifegradLabel'),
            leer: t('filterLeer'),
            reifegrad: reifegradLabels,
          }}
        />
      )}
    </main>
  );
}
