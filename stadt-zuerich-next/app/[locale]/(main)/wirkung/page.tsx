// Wirkungs-/Reife-Dashboard: aggregiert die reife-Daten aller Prozesse plus
// die Lebenslagen-Abdeckung zu evaluierbaren Kennzahlen. Server-gerendert,
// rein datenabgeleitet (kein Tracking). Enum-Labels werden aus dem bestehenden
// 'Prozesse'-Namespace wiederverwendet.

import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import { routing, type Locale } from '@/i18n/routing';
import { getT } from '@/lib/i18n-server';
import { buildWirkungReport } from '@/lib/wirkung';
import { resolveI18n, type ProzessLocale } from '@/types/prozess';
import DataQualityBadge from '@/components/DataQualityBadge';

export async function generateMetadata({
  params,
}: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const tApp = getT(locale as Locale, 'App');
  const t = getT(locale as Locale, 'Wirkung');
  return { title: `${t('title')} · ${tApp('title')}`, description: t('intro') };
}

// Einfache, barrierefreie Balkenzeile: Zahl ist sichtbarer Text, der Balken
// selbst ist dekorativ (aria-hidden).
function Bar({ label, value, max, suffix, color = 'var(--color-accent)' }: {
  label: string; value: number; max: number; suffix?: string; color?: string;
}) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="grid grid-cols-[minmax(9rem,14rem)_1fr_auto] items-center gap-3 py-1">
      <span className="text-[13px] text-[var(--color-ink)] truncate" title={label}>{label}</span>
      <span className="h-2.5 rounded-full bg-[var(--color-bg)] overflow-hidden" aria-hidden>
        <span className="block h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </span>
      <span className="text-[13px] tabular-nums text-[var(--color-mute)] text-right min-w-[3rem]">
        {value}{suffix ?? ''}
      </span>
    </div>
  );
}

function Kpi({ value, label }: { value: string; label: string }) {
  return (
    <div className="bg-[var(--color-panel)] border border-[var(--color-line)] rounded-lg p-4">
      <div className="text-2xl font-bold text-[var(--color-ink)] tabular-nums">{value}</div>
      <div className="text-[12px] text-[var(--color-mute)] mt-0.5">{label}</div>
    </div>
  );
}

const REIFEGRAD_COLOR: Record<string, string> = {
  offline: '#dc2626',
  'teil-digital': '#f59e0b',
  digital: '#16a34a',
  'end-to-end': '#0ea5e9',
};

export default async function WirkungPage({
  params,
}: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const loc = locale as Locale;
  const t = getT(loc, 'Wirkung');
  const tP = getT(loc, 'Prozesse');

  const r = await buildWirkungReport();
  const maxMedienbruch = r.medienbruecheTop[0]?.count ?? 0;

  const sectionH = 'text-sm font-semibold uppercase tracking-wider text-[var(--color-mute)] mb-2';

  return (
    <main
      className="absolute top-14 inset-x-0 bottom-0 px-6 pt-4 pb-10 overflow-y-auto bg-[var(--color-bg)]"
      aria-labelledby="wirkung-heading"
    >
      <h2 id="wirkung-heading" className="text-lg font-semibold mb-1">{t('title')}</h2>
      <p className="text-[13px] text-[var(--color-mute)] mb-3 max-w-[80ch]">{t('intro')}</p>
      <div className="mb-6">
        <DataQualityBadge
          status="aggregiert"
          quelle={t('source')}
          hinweis={t('privacyNote')}
        />
      </div>

      {/* KPI-Karten */}
      <section aria-labelledby="kpi-heading" className="mb-8 max-w-[80ch]">
        <h3 id="kpi-heading" className="sr-only">{t('kpiHeading')}</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <Kpi value={String(r.prozesseCount)} label={t('kpiProzesse')} />
          <Kpi value={String(r.medienbruecheGesamt)} label={t('kpiMedienbrueche')} />
          <Kpi value={`${r.onceOnlyCount}/${r.prozesseCount}`} label={t('kpiOnceOnly')} />
          <Kpi value={String(r.improvementGesamt)} label={t('kpiImprovements')} />
          <Kpi value={`${r.abdeckungProzent}%`} label={t('kpiAbdeckung')} />
        </div>
      </section>

      <div className="grid lg:grid-cols-2 gap-x-10 gap-y-8 max-w-[80ch]">
        {/* Online-Reifegrad */}
        <section aria-labelledby="reife-h">
          <h3 id="reife-h" className={sectionH}>{t('reifegradHeading')}</h3>
          {r.reifegrad.map((x) => (
            <Bar
              key={x.key}
              label={tP(`reifegrad.${x.key}`)}
              value={x.count}
              max={r.prozesseCount}
              color={REIFEGRAD_COLOR[x.key]}
            />
          ))}
        </section>

        {/* Vereinfachungs-Status */}
        <section aria-labelledby="status-h">
          <h3 id="status-h" className={sectionH}>{t('statusHeading')}</h3>
          {r.status.map((x) => (
            <Bar key={x.key} label={tP(`status.${x.key}`)} value={x.count} max={r.prozesseCount} />
          ))}
        </section>

        {/* Häufigste Medienbrüche */}
        <section aria-labelledby="mb-h">
          <h3 id="mb-h" className={sectionH}>{t('medienbruecheHeading')}</h3>
          {r.medienbruecheTop.length === 0 ? (
            <p className="text-[13px] text-[var(--color-mute)]">{t('none')}</p>
          ) : (
            r.medienbruecheTop.map((x) => (
              <Bar key={x.key} label={tP(`medienbruch.${x.key}`)} value={x.count} max={maxMedienbruch} color="#b45309" />
            ))
          )}
        </section>

        {/* Sprachabdeckung der Lebenslagen */}
        <section aria-labelledby="sprache-h">
          <h3 id="sprache-h" className={sectionH}>{t('spracheHeading')}</h3>
          {r.sprachabdeckung.map((x) => (
            <Bar
              key={x.locale}
              label={x.locale.toUpperCase()}
              value={x.count}
              max={r.lebenslagenTotal}
              suffix={` (${x.prozent}%)`}
            />
          ))}
        </section>
      </div>

      {/* Prozesskomplexität */}
      <section aria-labelledby="komplex-h" className="mt-10 max-w-[80ch]">
        <h3 id="komplex-h" className={sectionH}>{t('komplexHeading')}</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px] border-collapse">
            <caption className="sr-only">{t('komplexHeading')}</caption>
            <thead>
              <tr className="text-left text-[var(--color-mute)] border-b border-[var(--color-line)]">
                <th scope="col" className="py-1.5 pr-3 font-medium">{t('colProzess')}</th>
                <th scope="col" className="py-1.5 px-2 font-medium text-right">{t('colSchritte')}</th>
                <th scope="col" className="py-1.5 px-2 font-medium text-right">{t('colAkteure')}</th>
                <th scope="col" className="py-1.5 px-2 font-medium text-right">{t('colEntscheidungen')}</th>
                <th scope="col" className="py-1.5 pl-2 font-medium text-right">{t('colMedienbrueche')}</th>
              </tr>
            </thead>
            <tbody>
              {r.komplexitaet.map((row) => (
                <tr key={`${row.city}-${row.id}`} className="border-b border-dashed border-[var(--color-line)] last:border-0">
                  <th scope="row" className="py-1.5 pr-3 font-normal">
                    <Link
                      href={{ pathname: `/prozesse/${row.city}/${row.id}` }}
                      className="text-[var(--color-accent)] no-underline hover:underline"
                    >
                      {resolveI18n(row.titel, loc as ProzessLocale)}
                    </Link>
                  </th>
                  <td className="py-1.5 px-2 text-right tabular-nums">{row.schritte}</td>
                  <td className="py-1.5 px-2 text-right tabular-nums">{row.akteure}</td>
                  <td className="py-1.5 px-2 text-right tabular-nums">{row.entscheidungen}</td>
                  <td className="py-1.5 pl-2 text-right tabular-nums">{row.medienbrueche}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
