// Kompakter, server-gerenderter Banner mit der wichtigsten Stadt-Zahl:
// Brutto-Aufwand · Pro-Kopf. Wird auf der Maschinerie-Startseite über dem
// Graphen platziert, damit Bürger:innen die Bezugsgrösse sehen, bevor sie
// in die Detail-Knoten klicken. Bewusst kein Stadt-Netto: das liegt nahe
// bei null (Steuern zählen als Ertrag) und wäre als Headline irreführend.
//
// Bewusst Server-Component: keine Interaktivität, alle Daten liegen schon
// auf dem Server. Spart Client-Bundle.

import type { StadtData } from '@/types/stadt';
import type { Locale } from '@/i18n/routing';
import {
  computeTotalAufwand,
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
  const tE = getT(locale, 'Einheiten');
  const totalAufwand = computeTotalAufwand(data);
  const population   = city.population;

  // Wenn weder ein Budget-Total noch eine Bevölkerungszahl bekannt ist, gibt
  // es nichts Sinnvolles zu zeigen — Banner schweigt statt einer leeren Pille.
  if (totalAufwand <= 0) return null;

  const aufwandPerCapita = perCapitaCHF(totalAufwand, population);
  const sampleJahr = data.units.find((u) => u.budget?.jahr)?.budget?.jahr;

  // Pro-Kopf-Text je Sprache («(≈ {value}/Einw.)», «(≈ {value} per resident)»
  // …), an der Zahl geteilt: Nur die Zahl bekommt tabular-nums, wie vor der
  // Übersetzung. Auf dem ganzen Text änderte tabular-nums auch die Breite von
  // Satzzeichen, und das deutsche Banner verschob sich um Subpixel.
  const MARKE = '\u0000';
  const [vorZahl, nachZahl = ''] = t('proKopf', { value: MARKE }).split(MARKE);
  const proKopf = aufwandPerCapita ? { vor: vorZahl, wert: aufwandPerCapita, nach: nachZahl } : null;

  return (
    <aside
      // pointer-events-none verhindert, dass die Pille Klicks auf den Graphen
      // schluckt; die Inhalte bleiben aber selektierbar (text-Auswahl).
      //
      // Position: Die Startseite rendert das Banner nur ab 640px (Container
      // «hidden sm:block» in page.tsx). Oben mittig liegt es zwischen Suchfeld
      // (links, bis 332px) und Werkzeugleiste (rechts). Erst ab 1200px ist dort
      // in allen Sprachen Platz (längste Variante: ls mit ausgeschriebenen
      // Einheiten, 520px breit; bei 1200px beginnt sie bei x=340). Darunter
      // lag es unter dem Suchfeld und bis 768px in der Werkzeugleiste. Darum
      // unter 1200px links unter dem Suchfeld (top-unter-suche), schmal und
      // mehrzeilig; die Legende beginnt dort erst darunter (Legend.tsx).
      // Umbruchpunkt als min-[75rem] (= 1200px) in rem: Mit px sortiert
      // Tailwind die Media Query vor sm (40rem), und sm:-Klassen gewinnen.
      role="complementary"
      aria-label={t('ariaLabel')}
      className="fixed left-3 top-unter-suche max-w-[236px] flex-wrap justify-start gap-x-3 gap-y-0.5 rounded-lg min-[75rem]:left-1/2 min-[75rem]:top-[64px] min-[75rem]:-translate-x-1/2 min-[75rem]:max-w-[90vw] min-[75rem]:flex-nowrap min-[75rem]:justify-center min-[75rem]:gap-3 min-[75rem]:rounded-full z-[8] pointer-events-none flex items-center px-3.5 py-1.5 bg-[var(--color-panel)]/90 backdrop-blur-sm border border-[var(--color-line)] shadow text-[11px]"
    >
      <span className="text-[var(--color-mute)] uppercase tracking-wider font-semibold whitespace-nowrap">
        {sampleJahr ? t('eyebrowYear', { jahr: sampleJahr }) : t('eyebrow')}
      </span>
      <Stat
        label={t('aufwandLabel')}
        // Einheiten und Pro-Kopf-Text je Sprache: Bis 2026-11 standen
        // «Mrd» (aus fmtMio) und «/Einw.» fest auf Deutsch, auch in en/fr/it/ls.
        value={`${fmtMio(totalAufwand, { mrd: tE('mrd'), mio: tE('mio') })} CHF`}
        perCapita={proKopf}
        title={t('aufwandTitle')}
      />
    </aside>
  );
}

function Stat({
  label, value, perCapita, title,
}: {
  label: string;
  value: string;
  perCapita: { vor: string; wert: string; nach: string } | null;
  title: string;
}) {
  return (
    // flex-wrap: Im schmalen Banner (unter 1200px) bricht die Pro-Kopf-Zahl
    // als Ganzes auf eine eigene Zeile um; die Teile selbst bleiben einzeilig.
    <span title={title} className="flex flex-wrap min-[75rem]:flex-nowrap items-baseline gap-x-1.5 whitespace-nowrap">
      <span className="text-[var(--color-mute)]">{label}</span>
      <strong className="text-[var(--color-ink)] tabular-nums">{value}</strong>
      {perCapita && (
        <span className="text-[var(--color-mute)]">
          {perCapita.vor}<span className="tabular-nums">{perCapita.wert}</span>{perCapita.nach}
        </span>
      )}
    </span>
  );
}
