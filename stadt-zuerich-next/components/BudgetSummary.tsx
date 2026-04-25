// Kompakter, server-gerenderter Banner mit den wichtigsten Stadt-Zahlen:
// Brutto-Aufwand · Netto-Aufwand · jeweils Pro-Kopf. Wird auf der
// Maschinerie-Startseite über dem Graphen platziert, damit Bürger:innen die
// Bezugsgrösse sehen, bevor sie in die Detail-Knoten klicken.
//
// Bewusst Server-Component: keine Interaktivität, alle Daten liegen schon
// auf dem Server. Spart Client-Bundle.

import type { StadtData } from '@/types/stadt';
import type { Locale } from '@/i18n/routing';
import {
  computeTotalAufwand,
  computeTotalNettoaufwand,
  perCapitaCHF,
} from '@/lib/budget-context';
import { fmtMio } from '@/lib/search';
import { getT } from '@/lib/i18n-server';
import { city } from '@/config/city.config';

export default function BudgetSummary({
  data, locale,
}: {
  data: StadtData;
  locale: Locale;
}) {
  const t = getT(locale, 'BudgetSummary');
  const totalAufwand = computeTotalAufwand(data);
  const totalNetto   = computeTotalNettoaufwand(data);
  const population   = city.population;

  // Wenn weder ein Budget-Total noch eine Bevölkerungszahl bekannt ist, gibt
  // es nichts Sinnvolles zu zeigen — Banner schweigt statt einer leeren Pille.
  if (totalAufwand <= 0) return null;

  const aufwandPerCapita = perCapitaCHF(totalAufwand, population);
  const nettoPerCapita   = perCapitaCHF(totalNetto, population);
  const sampleJahr = data.units.find((u) => u.budget?.jahr)?.budget?.jahr;

  return (
    <aside
      // Floating top-center, knapp unter dem Header. pointer-events-none auf
      // das äussere div verhindert, dass die Pille Klicks auf den Graphen
      // schluckt; die Inhalte bleiben aber selektierbar (text-Auswahl).
      role="complementary"
      aria-label={t('ariaLabel')}
      className="fixed top-[64px] left-1/2 -translate-x-1/2 z-[8] pointer-events-none flex items-center gap-3 px-3.5 py-1.5 rounded-full bg-[var(--color-panel)]/90 backdrop-blur-sm border border-[var(--color-line)] shadow text-[11px] max-w-[90vw] overflow-hidden"
    >
      <span className="text-[var(--color-mute)] uppercase tracking-wider font-semibold whitespace-nowrap">
        {sampleJahr ? t('eyebrowYear', { jahr: sampleJahr }) : t('eyebrow')}
      </span>
      <Stat
        label={t('aufwandLabel')}
        value={`${fmtMio(totalAufwand)} CHF`}
        perCapita={aufwandPerCapita}
        title={t('aufwandTitle')}
      />
      {totalNetto > 0 && (
        <Stat
          label={t('nettoLabel')}
          value={`${fmtMio(totalNetto)} CHF`}
          perCapita={nettoPerCapita}
          title={t('nettoTitle')}
        />
      )}
    </aside>
  );
}

function Stat({
  label, value, perCapita, title,
}: {
  label: string;
  value: string;
  perCapita: string | null;
  title: string;
}) {
  return (
    <span title={title} className="flex items-baseline gap-1.5 whitespace-nowrap">
      <span className="text-[var(--color-mute)]">{label}</span>
      <strong className="text-[var(--color-ink)] tabular-nums">{value}</strong>
      {perCapita && (
        <span className="text-[var(--color-mute)]">
          (≈ <span className="tabular-nums">{perCapita}</span>/Einw.)
        </span>
      )}
    </span>
  );
}
