// Portfolio-Heatmap: das BIG PICTURE über alle Prozesse als Matrix
// «Prozesse (Zeilen) × Indikatoren (Spalten)». Konsumiert ausschliesslich das
// deterministische Aggregat data/portfolio/<stadt>.json (lib/portfolio.ts) —
// rechnet selbst nichts ab.
//
// Barrierefreiheit (nicht verhandelbar): Farbe ist NIE die alleinige
// Information. Jede Zelle trägt zusätzlich ein Symbol (✓ / ✕ / ?), einen
// sr-only-Statustext und ein title-Tooltip. «unbekannt» hat eine eigene
// Schraffur (Textur statt nur Farbe) und wird NIE als 0/«nicht erfüllt»
// dargestellt. Jede Zelle verlinkt per Zeilen-Link auf den Prozess und seine
// Evidenz (Drill-down) — die Detailseite #bewertung-heading.
//
// Server-gerendert, ohne Client-JS (wie ProzessBewertung).

import { Link } from '@/i18n/navigation';
import { getT } from '@/lib/i18n-server';
import type { Locale } from '@/i18n/routing';
import type { Portfolio, PortfolioZeile } from '@/lib/portfolio';
import type { IndikatorStatus, KategorieScore } from '@/lib/bewertung';

type T = (key: string, values?: Record<string, string | number>) => string;

const STATUS_SYMBOL: Record<IndikatorStatus, string> = {
  erfuellt: '✓',
  'nicht-erfuellt': '✕',
  unbekannt: '?',
};

// Gezählte (Score-relevante) Indikatoren: voller Farb-Code.
const STATUS_CELL: Record<IndikatorStatus, string> = {
  erfuellt: 'bg-green-100 text-green-900',
  'nicht-erfuellt': 'bg-amber-100 text-amber-900',
  unbekannt: 'text-[var(--color-mute)]',
};

// «unbekannt» bekommt zusätzlich eine diagonale Schraffur — als Textur, damit
// es auch ohne Farbwahrnehmung klar von «nicht erfüllt» unterscheidbar ist.
const HATCH_STYLE: React.CSSProperties = {
  backgroundImage:
    'repeating-linear-gradient(45deg, var(--color-line) 0, var(--color-line) 1px, transparent 1px, transparent 5px)',
};

function statusLabel(t: T, status: IndikatorStatus): string {
  return t(`status.${status}`); // aus dem 'Prozesse'-Namespace (bewertung.status.*)
}

/** Eine Indikator-Zelle. `gezaehlt=false` (informativ, z.B. eid-noetig) wird
 *  neutral als ja/nein/– gezeigt — nicht als erfüllt/nicht erfüllt. */
function Zelle({
  status,
  gezaehlt,
  indikatorLabel,
  tP,
  tPortfolio,
}: {
  status: IndikatorStatus;
  gezaehlt: boolean;
  indikatorLabel: string;
  tP: T;
  tPortfolio: T;
}) {
  const isUnbekannt = status === 'unbekannt';

  // Informativ: neutrale Tatsache ja/nein/–, kein Erfüllungs-Code.
  if (!gezaehlt) {
    const sym = status === 'erfuellt' ? '+' : status === 'nicht-erfuellt' ? '–' : '?';
    const txt =
      status === 'erfuellt' ? tP('ja') : status === 'nicht-erfuellt' ? tP('nein') : statusLabel(tP, status);
    return (
      <td
        className="text-center align-middle border border-[var(--color-line)] bg-[var(--color-bg)] text-[var(--color-mute)] w-9 h-9"
        title={tPortfolio('cellTitle', { indikator: indikatorLabel, status: txt })}
      >
        <span aria-hidden="true" className="text-[13px]">{sym}</span>
        <span className="sr-only">{indikatorLabel}: {txt} ({tPortfolio('legendInformativ')})</span>
      </td>
    );
  }

  return (
    <td
      className={`text-center align-middle border border-[var(--color-line)] w-9 h-9 ${STATUS_CELL[status]}`}
      style={isUnbekannt ? HATCH_STYLE : undefined}
      title={tPortfolio('cellTitle', { indikator: indikatorLabel, status: statusLabel(tP, status) })}
    >
      <span aria-hidden="true" className="text-[13px] font-semibold">{STATUS_SYMBOL[status]}</span>
      <span className="sr-only">{indikatorLabel}: {statusLabel(tP, status)}</span>
    </td>
  );
}

/** Score-Zelle (% erfüllt unter den BEKANNTEN). Zahl ist sichtbarer Text;
 *  null ⇒ «kein Score» (kein erfundener Wert). */
function ScoreZelle({ score, tPortfolio, tP, label }: { score: KategorieScore; tPortfolio: T; tP: T; label: string }) {
  if (score.prozent === null) {
    return (
      <td className="text-center align-middle border border-[var(--color-line)] bg-[var(--color-bg)] text-[var(--color-mute)] text-[11px] px-1.5">
        <span aria-hidden="true">–</span>
        <span className="sr-only">{label}: {tPortfolio('scoreNa')}</span>
      </td>
    );
  }
  return (
    <td
      className="text-center align-middle border border-[var(--color-line)] bg-[var(--color-panel)] text-[var(--color-ink)] tabular-nums text-[12px] font-semibold px-1.5"
      title={`${label}: ${score.prozent}% (${tP('bewertung.scoreWert', { erfuellt: score.erfuellt, bekannt: score.bekannt })})`}
    >
      {score.prozent}%
      <span className="sr-only">
        {' '}
        {label} ({tP('bewertung.scoreWert', { erfuellt: score.erfuellt, bekannt: score.bekannt })})
        {score.unbekannt > 0 ? `, ${tP('bewertung.status.unbekannt')}: ${score.unbekannt}` : ''}
      </span>
    </td>
  );
}

/** Kleine Legenden-Probe (Farbe + Symbol + Text). */
function LegendItem({ swatch, sym, label, hatch }: { swatch: string; sym: string; label: string; hatch?: boolean }) {
  return (
    <li className="flex items-center gap-1.5 text-[12px] text-[var(--color-ink)]">
      <span
        aria-hidden="true"
        className={`inline-flex items-center justify-center w-5 h-5 rounded border border-[var(--color-line)] text-[11px] font-semibold ${swatch}`}
        style={hatch ? HATCH_STYLE : undefined}
      >
        {sym}
      </span>
      {label}
    </li>
  );
}

/** Stacked-Balken für die Spalten-Summe eines Indikators (erfüllt / nicht /
 *  unbekannt). Zahlen stehen als Text daneben — Balken ist dekorativ. */
function SummaryBar({
  erfuellt,
  nichtErfuellt,
  unbekannt,
  total,
  label,
  tPortfolio,
}: {
  erfuellt: number;
  nichtErfuellt: number;
  unbekannt: number;
  total: number;
  label: string;
  tPortfolio: T;
}) {
  const pct = (n: number) => (total > 0 ? (100 * n) / total : 0);
  return (
    <div className="grid grid-cols-[minmax(9rem,16rem)_1fr_auto] items-center gap-3 py-1">
      <span className="text-[13px] text-[var(--color-ink)] truncate" title={label}>{label}</span>
      <span className="flex h-2.5 rounded-full overflow-hidden bg-[var(--color-bg)]" aria-hidden="true">
        <span className="block h-full bg-green-500" style={{ width: `${pct(erfuellt)}%` }} />
        <span className="block h-full bg-amber-400" style={{ width: `${pct(nichtErfuellt)}%` }} />
        <span className="block h-full" style={{ width: `${pct(unbekannt)}%`, ...HATCH_STYLE }} />
      </span>
      <span className="text-[12px] tabular-nums text-[var(--color-mute)] text-right whitespace-nowrap">
        {tPortfolio('summaryZeile', { erfuellt, nichtErfuellt, unbekannt })}
      </span>
    </div>
  );
}

export default function PortfolioHeatmap({
  portfolio,
  titel,
  locale,
}: {
  portfolio: Portfolio;
  /** slug ("city/id") → aufgelöster Prozess-Titel (aus dem Prozess-Index). */
  titel: Record<string, string>;
  locale: Locale;
}) {
  const t = getT(locale, 'Portfolio');
  const tP = getT(locale, 'Prozesse'); // bewertung.indikator.* / status.* / kategorie.*

  const indikatorLabel = (key: string) => tP(`bewertung.indikator.${key}`);

  const digitalCols = portfolio.spalten.filter((s) => s.kategorie === 'digitalisierung');
  const nutzendCols = portfolio.spalten.filter((s) => s.kategorie === 'nutzendenorientierung');

  const zelleByKey = (row: PortfolioZeile, key: string) => row.zellen.find((z) => z.key === key);
  const gezaehltByKey = (key: string) => portfolio.spalten.find((s) => s.key === key)?.gezaehlt ?? true;

  const colHeader = (key: string, gezaehlt: boolean) => (
    <th
      key={key}
      scope="col"
      className="border border-[var(--color-line)] bg-[var(--color-panel)] p-1 align-bottom"
    >
      <span className="block text-[10px] leading-tight font-normal text-[var(--color-ink)] w-9 mx-auto break-words">
        {indikatorLabel(key)}
        {!gezaehlt && (
          <span className="block text-[9px] uppercase tracking-wide text-[var(--color-mute)]">
            {tP('bewertung.informativ')}
          </span>
        )}
      </span>
    </th>
  );

  return (
    <div>
      {/* Legende (Farbe nie allein: Symbol + Text). */}
      <div className="mb-4">
        <h3 className="sr-only">{t('legendHeading')}</h3>
        <ul className="flex flex-wrap gap-x-4 gap-y-1.5 m-0 p-0 list-none">
          <LegendItem swatch="bg-green-100 text-green-900" sym="✓" label={tP('bewertung.status.erfuellt')} />
          <LegendItem swatch="bg-amber-100 text-amber-900" sym="✕" label={tP('bewertung.status.nicht-erfuellt')} />
          <LegendItem swatch="text-[var(--color-mute)]" sym="?" label={tP('bewertung.status.unbekannt')} hatch />
          <LegendItem swatch="bg-[var(--color-bg)] text-[var(--color-mute)]" sym="+/–" label={t('legendInformativ')} />
        </ul>
      </div>

      {/* Abdeckungs-Hinweis (Transparenz statt stiller Lücke). */}
      <p className="text-[12px] px-2 py-1 mb-4 rounded border border-[var(--color-line)] bg-[var(--color-bg)] text-[var(--color-mute)] max-w-[80ch]">
        {t('coverageNote', { ohne: portfolio.summary.ohneBeleg, total: portfolio.summary.prozesse })}
      </p>

      {/* Heatmap-Tabelle (horizontal scrollbar, erste Spalte sticky). */}
      <div className="overflow-x-auto border border-[var(--color-line)] rounded-lg">
        <table className="border-collapse text-sm">
          <caption className="sr-only">{t('caption')}</caption>
          <thead>
            <tr>
              <th
                scope="col"
                rowSpan={2}
                className="sticky left-0 z-10 bg-[var(--color-panel)] border border-[var(--color-line)] px-3 py-2 text-left text-[12px] font-semibold text-[var(--color-ink)] min-w-[12rem]"
              >
                {t('colProzess')}
              </th>
              <th
                scope="colgroup"
                colSpan={digitalCols.length}
                className="border border-[var(--color-line)] bg-[var(--color-panel)] px-2 py-1 text-[11px] uppercase tracking-wider text-[var(--color-mute)]"
              >
                {tP('bewertung.kategorie.digitalisierung')}
              </th>
              <th
                scope="colgroup"
                colSpan={nutzendCols.length}
                className="border border-[var(--color-line)] bg-[var(--color-panel)] px-2 py-1 text-[11px] uppercase tracking-wider text-[var(--color-mute)]"
              >
                {tP('bewertung.kategorie.nutzendenorientierung')}
              </th>
              <th
                scope="colgroup"
                colSpan={3}
                className="border border-[var(--color-line)] bg-[var(--color-panel)] px-2 py-1 text-[11px] uppercase tracking-wider text-[var(--color-mute)]"
              >
                {t('scoreGroup')}
              </th>
            </tr>
            <tr>
              {digitalCols.map((s) => colHeader(s.key, s.gezaehlt))}
              {nutzendCols.map((s) => colHeader(s.key, s.gezaehlt))}
              <th scope="col" className="border border-[var(--color-line)] bg-[var(--color-panel)] p-1 align-bottom">
                <span className="block text-[10px] leading-tight text-[var(--color-ink)] w-10 mx-auto" title={t('scoreDigitalLong')}>{t('scoreDigital')}</span>
              </th>
              <th scope="col" className="border border-[var(--color-line)] bg-[var(--color-panel)] p-1 align-bottom">
                <span className="block text-[10px] leading-tight text-[var(--color-ink)] w-10 mx-auto" title={t('scoreNutzendLong')}>{t('scoreNutzend')}</span>
              </th>
              <th scope="col" className="border border-[var(--color-line)] bg-[var(--color-panel)] p-1 align-bottom">
                <span className="block text-[10px] leading-tight text-[var(--color-ink)] w-10 mx-auto" title={t('scoreGesamtLong')}>{t('scoreGesamt')}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {portfolio.prozesse.map((row) => {
              const rowTitel = titel[row.slug] ?? row.slug;
              return (
                <tr key={row.slug} className="even:bg-[var(--color-bg)]/40">
                  <th
                    scope="row"
                    className="sticky left-0 z-10 bg-[var(--color-panel)] border border-[var(--color-line)] px-3 py-1.5 text-left font-normal min-w-[12rem]"
                  >
                    <Link
                      href={`/prozesse/${row.city}/${row.id}#bewertung-heading`}
                      className="text-[var(--color-accent)] no-underline hover:underline text-[13px]"
                      title={t('detailLink', { titel: rowTitel })}
                    >
                      {rowTitel}
                    </Link>
                    {row.belegLuecke && (
                      <span
                        className="ml-2 align-middle text-[10px] px-1.5 py-0.5 rounded-full border border-[var(--color-line)] bg-[var(--color-bg)] text-[var(--color-mute)] whitespace-nowrap"
                        title={t('belegLueckeTitle')}
                      >
                        {t('belegLuecke')}
                      </span>
                    )}
                  </th>
                  {digitalCols.map((s) => {
                    const z = zelleByKey(row, s.key);
                    return (
                      <Zelle
                        key={s.key}
                        status={z?.status ?? 'unbekannt'}
                        gezaehlt={s.gezaehlt}
                        indikatorLabel={indikatorLabel(s.key)}
                        tP={tP}
                        tPortfolio={t}
                      />
                    );
                  })}
                  {nutzendCols.map((s) => {
                    const z = zelleByKey(row, s.key);
                    return (
                      <Zelle
                        key={s.key}
                        status={z?.status ?? 'unbekannt'}
                        gezaehlt={s.gezaehlt}
                        indikatorLabel={indikatorLabel(s.key)}
                        tP={tP}
                        tPortfolio={t}
                      />
                    );
                  })}
                  <ScoreZelle score={row.score.digitalisierung} tPortfolio={t} tP={tP} label={t('scoreDigitalLong')} />
                  <ScoreZelle score={row.score.nutzendenorientierung} tPortfolio={t} tP={tP} label={t('scoreNutzendLong')} />
                  <ScoreZelle score={row.score.gesamt} tPortfolio={t} tP={tP} label={t('scoreGesamtLong')} />
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Spalten-Summen: Erfüllung je Indikator über alle Prozesse. */}
      <section aria-labelledby="portfolio-summary-h" className="mt-8 max-w-[80ch]">
        <h3 id="portfolio-summary-h" className="text-sm font-semibold uppercase tracking-wider text-[var(--color-mute)] mb-2">
          {t('summaryHeading')}
        </h3>
        {portfolio.summary.proIndikator.map((s) => (
          <SummaryBar
            key={s.key}
            label={indikatorLabel(s.key) + (gezaehltByKey(s.key) ? '' : ` (${tP('bewertung.informativ')})`)}
            erfuellt={s.erfuellt}
            nichtErfuellt={s.nichtErfuellt}
            unbekannt={s.unbekannt}
            total={portfolio.summary.prozesse}
            tPortfolio={t}
          />
        ))}
      </section>
    </div>
  );
}
