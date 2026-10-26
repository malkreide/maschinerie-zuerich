// Belegmatrix der Ansicht «Belege & Herkunft»: je Zeile ein Verfahren, je
// Spalte eine Eigenschaft seiner Belegkette. Konsumiert ausschliesslich das
// deterministische Aggregat data/belege/<stadt>.json (lib/belege.ts) — rechnet
// selbst nur das Alter der Abrufe (relativ zu `heute`).
//
// Kardinalregel: keine bindenden Werte, keine Zitate. Die Zeile verlinkt auf
// die Referenzen der Detailseite, wo Zitat und Deep-Link stehen.
//
// Barrierefreiheit: Farbe ist nie die alleinige Information (Symbol + Text,
// lib/status-stil.ts). Zeilen alphabetisch nach Titel, nie nach «Güte» —
// keine Rangliste von Verfahren.
//
// Server-gerendert, ohne Client-JS (wie PortfolioHeatmap).

import { Link } from '@/i18n/navigation';
import { getT } from '@/lib/i18n-server';
import type { Locale } from '@/i18n/routing';
import { istAelterAls, QUELLEN_EBENEN, type BelegZeile, type Belege } from '@/lib/belege';
import type { IndikatorStatus } from '@/lib/bewertung';
import { HATCH_STYLE, STATUS_CELL, STATUS_SYMBOL } from '@/lib/status-stil';

type T = (key: string, values?: Record<string, string | number>) => string;

const TH = 'border border-[var(--color-line)] bg-[var(--color-panel)] px-2 py-1.5 text-left text-[12px] font-semibold text-[var(--color-ink)]';
const TD = 'border border-[var(--color-line)] px-2 py-1.5 text-[13px] align-middle';

/** Status «wörtlich belegt» einer Zeile: alle / nicht alle / keine Angaben. */
function belegStatus(z: BelegZeile): IndikatorStatus {
  if (z.summe.referenzen === 0) return 'unbekannt';
  return z.summe.mitZitat === z.summe.referenzen ? 'erfuellt' : 'nicht-erfuellt';
}

function BelegtZelle({ z, t }: { z: BelegZeile; t: T }) {
  const status = belegStatus(z);
  const text =
    status === 'erfuellt' ? t('belegtAlle') : status === 'nicht-erfuellt' ? t('belegtNichtAlle') : t('keineAngaben');
  return (
    <td
      className={`${TD} whitespace-nowrap ${STATUS_CELL[status]}`}
      style={status === 'unbekannt' ? HATCH_STYLE : undefined}
      title={text}
    >
      <span aria-hidden="true" className="font-semibold mr-1.5">{STATUS_SYMBOL[status]}</span>
      {z.summe.referenzen > 0 && (
        <span className="tabular-nums">{t('belegtWert', { belegt: z.summe.mitZitat, gesamt: z.summe.referenzen })}</span>
      )}
      <span className="sr-only">{z.summe.referenzen > 0 ? `: ${text}` : text}</span>
    </td>
  );
}

/** «Stadt 2 · Bund 1» — nur Ebenen mit mindestens einem Beleg. */
function ebenenText(z: BelegZeile, t: T): string {
  const teile = QUELLEN_EBENEN.map((e) => [e, z.referenzen.filter((r) => r.ebene === e).length] as const)
    .filter(([, n]) => n > 0)
    .map(([e, n]) => `${t(`ebene.${e}`)} ${n}`);
  return teile.length > 0 ? teile.join(' · ') : '–';
}

export default function BelegMatrix({
  belege,
  titel,
  locale,
  heute,
}: {
  belege: Belege;
  /** slug ("city/id") → aufgelöster Prozess-Titel (aus dem Prozess-Index). */
  titel: Record<string, string>;
  locale: Locale;
  heute: Date;
}) {
  const t = getT(locale, 'Belege');
  const tP = getT(locale, 'Prozesse');

  const titelVon = (z: BelegZeile) => titel[z.slug] ?? z.slug;
  const zeilen = [...belege.prozesse].sort((a, b) => titelVon(a).localeCompare(titelVon(b), locale));

  return (
    <div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1.5 m-0 p-0 mb-3 list-none text-[12px] text-[var(--color-ink)]">
        {(['erfuellt', 'nicht-erfuellt'] as const).map((s) => (
          <li key={s} className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className={`inline-flex items-center justify-center w-5 h-5 rounded border border-[var(--color-line)] text-[11px] font-semibold ${STATUS_CELL[s]}`}
            >
              {STATUS_SYMBOL[s]}
            </span>
            {s === 'erfuellt' ? t('belegtAlle') : t('belegtNichtAlle')}
          </li>
        ))}
      </ul>

      <div className="overflow-x-auto border border-[var(--color-line)] rounded-lg">
        <table className="border-collapse text-sm w-full">
          <caption className="sr-only">{t('caption')}</caption>
          <thead>
            <tr>
              <th scope="col" className={`${TH} sticky left-0 z-10 min-w-[12rem]`}>{t('colProzess')}</th>
              <th scope="col" className={`${TH} text-right`}>{t('colReferenzen')}</th>
              <th scope="col" className={TH}>{t('colBelegt')}</th>
              <th scope="col" className={TH}>{t('colEbenen')}</th>
              <th scope="col" className={`${TH} text-right`}>{t('colGesetz')}</th>
              <th scope="col" className={TH}>{t('colAbruf')}</th>
            </tr>
          </thead>
          <tbody>
            {zeilen.map((z) => {
              const rowTitel = titelVon(z);
              const gesetz = z.referenzen.filter((r) => r.gesetzesfassung).length;
              const alt = z.abruf.aeltester !== null && istAelterAls(z.abruf.aeltester, heute);
              return (
                <tr key={z.slug}>
                  <th scope="row" className={`${TD} sticky left-0 z-10 bg-[var(--color-panel)] text-left font-normal min-w-[12rem]`}>
                    <Link
                      href={`/prozesse/${z.city}/${z.id}#referenzen-heading`}
                      className="text-[var(--color-accent)] no-underline hover:underline"
                      title={t('detailLink', { titel: rowTitel })}
                    >
                      {rowTitel}
                    </Link>
                    {z.hochrisiko && (
                      <span className="ml-2 align-middle text-[10px] px-1.5 py-0.5 rounded-full border border-red-300 bg-red-50 text-red-800 whitespace-nowrap">
                        <span aria-hidden="true">⚠ </span>
                        {tP('disclaimerHochrisikoLabel')}
                      </span>
                    )}
                  </th>
                  <td className={`${TD} text-right tabular-nums`}>{z.summe.referenzen}</td>
                  <BelegtZelle z={z} t={t} />
                  <td className={`${TD} whitespace-nowrap`}>{ebenenText(z, t)}</td>
                  <td className={`${TD} text-right tabular-nums`}>{gesetz > 0 ? gesetz : '–'}</td>
                  <td className={`${TD} whitespace-nowrap tabular-nums`}>
                    {z.abruf.aeltester ?? '–'}
                    {alt && (
                      <span
                        className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full border border-amber-300 bg-amber-50 text-amber-900"
                        title={t('abrufAltTitle')}
                      >
                        {t('abrufAlt')}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
