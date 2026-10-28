// Belegmatrix der Ansicht «Belege & Herkunft»: je Zeile ein Verfahren, je
// Spalte eine Eigenschaft seiner Belegkette. Konsumiert ausschliesslich das
// deterministische Aggregat data/belege/<stadt>.json (lib/belege.ts) und,
// falls vorhanden, den Wochenbefund data/befunde/<stadt>.json
// (lib/befunde.ts) — rechnet selbst nur das Alter der Abrufe (relativ zu
// `heute`). Die Herkunft (meta.herkunft) ist keine Güte: sie erscheint als
// Text ohne Statusfarbe, fehlend als «nicht erfasst».
//
// Kardinalregel: keine bindenden Werte, keine Zitate. Die Zeile verlinkt auf
// die Referenzen der Detailseite, wo Zitat und Deep-Link stehen.
//
// Barrierefreiheit: Farbe ist nie die alleinige Information (Symbol + Text,
// lib/status-stil.ts). Ein Befund gilt nur für die geprüfte Fassung einer
// Reference; ohne gültigen Befund heisst es «offen» (schraffiert), nie ok.
// «Gesperrt» ist nie «tot». Zeilen alphabetisch nach Titel, nie nach
// «Güte» — keine Rangliste von Verfahren.
//
// Server-gerendert, ohne Client-JS (wie PortfolioHeatmap).

import { Link } from '@/i18n/navigation';
import { getT } from '@/lib/i18n-server';
import type { Locale } from '@/i18n/routing';
import { istAelterAls, QUELLEN_EBENEN, type BelegZeile, type Belege, type HerkunftSchluessel } from '@/lib/belege';
import { befundLeser, zaehleBefunde, type BefundZaehlung, type Wochenbefund } from '@/lib/befunde';
import type { IndikatorStatus } from '@/lib/bewertung';
import { HATCH_STYLE, STATUS_CELL, STATUS_SYMBOL } from '@/lib/status-stil';

type T = (key: string, values?: Record<string, string | number>) => string;

const TH = 'border border-[var(--color-line)] bg-[var(--color-panel)] px-2 py-1.5 text-left text-[12px] font-semibold text-[var(--color-ink)]';
const TD = 'border border-[var(--color-line)] px-2 py-1.5 text-[13px] align-middle';

/** Eine Statuszelle: Symbol + Kurztext sichtbar, Langtext für Screenreader
 *  und als title. «unbekannt» (offen) zusätzlich schraffiert. */
function ZustandZelle({ status, kurz, lang }: { status: IndikatorStatus; kurz: string; lang: string }) {
  return (
    <td
      className={`${TD} whitespace-nowrap ${STATUS_CELL[status]}`}
      style={status === 'unbekannt' ? HATCH_STYLE : undefined}
      title={lang}
    >
      <span aria-hidden="true" className="font-semibold mr-1.5">{STATUS_SYMBOL[status]}</span>
      <span aria-hidden="true" className="tabular-nums">{kurz}</span>
      <span className="sr-only">{lang}</span>
    </td>
  );
}

const Leer = () => <td className={`${TD} text-[var(--color-mute)]`}>–</td>;

/** i18n-Schlüssel je Herkunft ('nicht-erfasst' → 'nichtErfasst'). */
const herkunftKey = (k: HerkunftSchluessel) => (k === 'nicht-erfasst' ? 'nichtErfasst' : k);

function HerkunftZelle({ z, t, repoUrl }: { z: BelegZeile; t: T; repoUrl: string }) {
  const k = herkunftKey(z.herkunft?.art ?? 'nicht-erfasst');
  const prs = z.herkunft?.tessera_prs ?? [];
  return (
    <td className={`${TD} whitespace-nowrap`} title={t(`herkunft.${k}Titel`)}>
      <span className={z.herkunft ? undefined : 'text-[var(--color-mute)]'}>{t(`herkunft.${k}`)}</span>
      {prs.map((n) => (
        <span key={n}>
          {' '}
          <a
            href={`${repoUrl}/pull/${n}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--color-accent)] underline tabular-nums"
          >
            <span className="sr-only">{t('herkunft.prLabel')} </span>#{n}
          </a>
        </span>
      ))}
    </td>
  );
}

function BelegtZelle({ z, t }: { z: BelegZeile; t: T }) {
  if (z.summe.referenzen === 0) return <ZustandZelle status="unbekannt" kurz="" lang={t('keineAngaben')} />;
  const alle = z.summe.mitZitat === z.summe.referenzen;
  return (
    <ZustandZelle
      status={alle ? 'erfuellt' : 'nicht-erfuellt'}
      kurz={t('belegtWert', { belegt: z.summe.mitZitat, gesamt: z.summe.referenzen })}
      lang={`${t('belegtWert', { belegt: z.summe.mitZitat, gesamt: z.summe.referenzen })}: ${alle ? t('belegtAlle') : t('belegtNichtAlle')}`}
    />
  );
}

function LinkZelle({ n, t }: { n: BefundZaehlung; t: T }) {
  if (n.referenzen === 0) return <Leer />;
  if (n.linkTot > 0) return <ZustandZelle status="nicht-erfuellt" kurz={t('befund.linkTotKurz', { n: n.linkTot })} lang={t('befund.linkTotLang', { n: n.linkTot })} />;
  if (n.linkOk === n.referenzen) return <ZustandZelle status="erfuellt" kurz={t('befund.linkOkKurz')} lang={t('befund.linkOkLang')} />;
  return <ZustandZelle status="unbekannt" kurz={t('befund.offenKurz', { n: n.linkOffen })} lang={t('befund.linkOffenLang', { n: n.linkOffen })} />;
}

function ZitatZelle({ n, t }: { n: BefundZaehlung; t: T }) {
  if (n.referenzen === 0) return <Leer />;
  if (n.zitatDrift > 0) return <ZustandZelle status="nicht-erfuellt" kurz={t('befund.zitatDriftKurz', { n: n.zitatDrift })} lang={t('befund.zitatDriftLang', { n: n.zitatDrift })} />;
  if (n.zitatWoertlich === n.referenzen) return <ZustandZelle status="erfuellt" kurz={t('befund.zitatOkKurz')} lang={t('befund.zitatOkLang')} />;
  return <ZustandZelle status="unbekannt" kurz={t('befund.offenKurz', { n: n.zitatOffen })} lang={t('befund.zitatOffenLang', { n: n.zitatOffen })} />;
}

function GesetzZelle({ n, t, mitBefund }: { n: BefundZaehlung; t: T; mitBefund: boolean }) {
  if (n.gesetze === 0) return <Leer />;
  if (!mitBefund) return <td className={`${TD} text-right tabular-nums`}>{n.gesetze}</td>;
  if (n.fassungUeberholt > 0) return <ZustandZelle status="nicht-erfuellt" kurz={t('befund.fassungUeberholtKurz', { n: n.fassungUeberholt })} lang={t('befund.fassungUeberholtLang', { n: n.fassungUeberholt })} />;
  if (n.fassungAktuell === n.gesetze) return <ZustandZelle status="erfuellt" kurz={t('befund.fassungAktuellKurz', { n: n.gesetze })} lang={t('befund.fassungAktuellLang', { n: n.gesetze })} />;
  return <ZustandZelle status="unbekannt" kurz={t('befund.offenKurz', { n: n.fassungOffen })} lang={t('befund.fassungOffenLang', { n: n.fassungOffen })} />;
}

/** «Stadt 2 · Bund 1» — nur Ebenen mit mindestens einem Beleg. */
function ebenenText(z: BelegZeile, t: T): string {
  const teile = QUELLEN_EBENEN.map((e) => [e, z.referenzen.filter((r) => r.ebene === e).length] as const)
    .filter(([, n]) => n > 0)
    .map(([e, n]) => `${t(`ebene.${e}`)} ${n}`);
  return teile.length > 0 ? teile.join(' · ') : '–';
}

/** Befund-Zählung je Zeile — exportiert, damit die Seite dieselbe Zuordnung
 *  (befundLeser: nur gültig für die geprüfte Fassung) für ihre Kennzahlen nutzt. */
export function zaehlungFuer(z: BelegZeile, lies: ReturnType<typeof befundLeser>): BefundZaehlung {
  return zaehleBefunde(
    z.referenzen.map((r) => ({
      gesetzesfassung: r.gesetzesfassung,
      befund: lies({ slug: z.slug, reference_id: r.reference_id, url: r.url, retrieved_at: r.retrieved_at }),
    })),
  );
}

function LegendeEintrag({ status, text }: { status: IndikatorStatus; text: string }) {
  return (
    <li className="flex items-center gap-1.5">
      <span
        aria-hidden="true"
        className={`inline-flex items-center justify-center w-5 h-5 rounded border border-[var(--color-line)] text-[11px] font-semibold ${STATUS_CELL[status]}`}
        style={status === 'unbekannt' ? HATCH_STYLE : undefined}
      >
        {STATUS_SYMBOL[status]}
      </span>
      {text}
    </li>
  );
}

export default function BelegMatrix({
  belege,
  befund,
  titel,
  locale,
  heute,
  repoUrl,
}: {
  belege: Belege;
  /** Wochenbefund derselben Stadt, falls schon einer veröffentlicht ist. */
  befund: Wochenbefund | null;
  /** slug ("city/id") → aufgelöster Prozess-Titel (aus dem Prozess-Index). */
  titel: Record<string, string>;
  locale: Locale;
  heute: Date;
  /** GitHub-Repo der Daten, für die Links auf tessera-PRs */
  repoUrl: string;
}) {
  const t = getT(locale, 'Belege');
  const tP = getT(locale, 'Prozesse');
  const lies = befundLeser(befund);
  const mitBefund = befund !== null;

  const titelVon = (z: BelegZeile) => titel[z.slug] ?? z.slug;
  const zeilen = [...belege.prozesse].sort((a, b) => titelVon(a).localeCompare(titelVon(b), locale));

  return (
    <div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1.5 m-0 p-0 mb-3 list-none text-[12px] text-[var(--color-ink)]">
        <LegendeEintrag status="erfuellt" text={mitBefund ? t('befund.legendOk') : t('belegtAlle')} />
        <LegendeEintrag status="nicht-erfuellt" text={mitBefund ? t('befund.legendNicht') : t('belegtNichtAlle')} />
        {mitBefund && <LegendeEintrag status="unbekannt" text={t('befund.legendOffen')} />}
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
              {mitBefund && <th scope="col" className={TH}>{t('befund.colLink')}</th>}
              {mitBefund && <th scope="col" className={TH}>{t('befund.colZitat')}</th>}
              <th scope="col" className={mitBefund ? TH : `${TH} text-right`}>{t('colGesetz')}</th>
              <th scope="col" className={TH}>{t('colAbruf')}</th>
              <th scope="col" className={TH}>{t('colHerkunft')}</th>
            </tr>
          </thead>
          <tbody>
            {zeilen.map((z) => {
              const rowTitel = titelVon(z);
              const n = zaehlungFuer(z, lies);
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
                  {mitBefund && <LinkZelle n={n} t={t} />}
                  {mitBefund && <ZitatZelle n={n} t={t} />}
                  <GesetzZelle n={n} t={t} mitBefund={mitBefund} />
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
                  <HerkunftZelle z={z} t={t} repoUrl={repoUrl} />
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
