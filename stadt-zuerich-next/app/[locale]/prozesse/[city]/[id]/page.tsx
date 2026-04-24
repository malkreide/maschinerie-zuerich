// Detail-Route für einen einzelnen Prozess.
// Server-Komponente lädt das JSON, löst i18n auf, berechnet Layout.
// Die eigentliche React-Flow-Visualisierung (Client) erhält nur noch
// fertige Strings + Layout-Positionen.
//
// Unterhalb der Visualisierung rendern wir eine textuelle Fallback-Version
// der Schritte — damit die Seite auch ohne JS nutzbar ist (Screenreader,
// Text-Browser, SEO).

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { hasLocale } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { routing, type Locale } from '@/i18n/routing';
import { getT } from '@/lib/i18n-server';
import { loadProzess, listProzessParams } from '@/lib/prozesse';
import { layoutProzess } from '@/lib/prozess-layout';
import { resolveI18n, type ProzessLocale, type Dauer } from '@/types/prozess';
import ProzessFlow, {
  type ProzessFlowSchritt,
  type ProzessFlowKante,
  type ProzessFlowAkteur,
} from '@/components/prozess/ProzessFlow';

// Nur im Schema erfasste Prozesse sind gültige URLs — alles andere → 404.
// Mit dynamicParams=false kann Next das Ergebnis vollständig statisch
// vorrendern (wichtig für Static-Export-Hosting à la Novatrend/GitHub Pages).
export const dynamicParams = false;

export async function generateStaticParams() {
  const params = await listProzessParams();
  return routing.locales.flatMap((locale) =>
    params.map((p) => ({ locale, city: p.city, id: p.id })),
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; city: string; id: string }>;
}): Promise<Metadata> {
  const { locale, city, id } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const p = await loadProzess(city, id);
  if (!p) return {};
  const tApp = getT(locale as Locale, 'App');
  const titel = resolveI18n(p.titel, locale as ProzessLocale);
  const desc  = resolveI18n(p.kurzbeschreibung, locale as ProzessLocale);
  return { title: `${titel} · ${tApp('title')}`, description: desc };
}

function formatDauer(d: Dauer | undefined, locale: Locale): string | undefined {
  if (!d) return undefined;
  const einheit: Record<Dauer['einheit'], Record<string, string>> = {
    minuten:     { de: 'Min', en: 'min', fr: 'min', it: 'min', ls: 'Minuten' },
    stunden:     { de: 'Std', en: 'h', fr: 'h', it: 'h', ls: 'Stunden' },
    arbeitstage: { de: 'Arbeitstage', en: 'business days', fr: 'jours ouvrés', it: 'giorni lavorativi', ls: 'Arbeits-Tage' },
    kalendertage:{ de: 'Tage', en: 'days', fr: 'jours', it: 'giorni', ls: 'Tage' },
    wochen:      { de: 'Wochen', en: 'weeks', fr: 'semaines', it: 'settimane', ls: 'Wochen' },
    monate:      { de: 'Monate', en: 'months', fr: 'mois', it: 'mesi', ls: 'Monate' },
  };
  const unit = einheit[d.einheit][locale] ?? einheit[d.einheit].de;
  if (d.min === d.max) return `${d.min} ${unit}`;
  return `${d.min}–${d.max} ${unit}`;
}

function formatKosten(k: { min?: number; max?: number } | undefined): string | undefined {
  if (!k || (k.min === undefined && k.max === undefined)) return undefined;
  if (k.min === k.max) return `${k.min?.toLocaleString('de-CH')}`;
  return `${k.min?.toLocaleString('de-CH') ?? '?'}–${k.max?.toLocaleString('de-CH') ?? '?'}`;
}

export default async function ProzessDetailPage({
  params,
}: {
  params: Promise<{ locale: string; city: string; id: string }>;
}) {
  const { locale, city, id } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const loc = locale as Locale;
  const lebLoc = locale as ProzessLocale;

  const prozess = await loadProzess(city, id);
  if (!prozess) notFound();

  const t = getT(loc, 'Prozesse');

  // Akteur-ID → Label-Map
  const akteurLabel = new Map(
    prozess.akteure.map((a) => [a.id, resolveI18n(a.label, lebLoc)]),
  );

  const schritte: ProzessFlowSchritt[] = prozess.schritte.map((s) => ({
    id: s.id,
    typ: s.typ,
    akteurId: s.akteur,
    label: resolveI18n(s.label, lebLoc),
    beschreibung: s.beschreibung ? resolveI18n(s.beschreibung, lebLoc) : undefined,
    dauer: formatDauer(s.dauer_est, loc),
    kosten: formatKosten(s.kosten_chf),
    akteurLabel: akteurLabel.get(s.akteur) ?? s.akteur,
  }));

  const kanten: ProzessFlowKante[] = prozess.flow.map((f, i) => ({
    id: `e-${i}-${f.von}-${f.nach}`,
    von: f.von,
    nach: f.nach,
    label: f.label ? resolveI18n(f.label, lebLoc) : undefined,
    bedingung: f.bedingung,
  }));

  const akteure: ProzessFlowAkteur[] = prozess.akteure.map((a) => ({
    id: a.id,
    label: resolveI18n(a.label, lebLoc),
    typ: a.typ,
  }));

  const layout = layoutProzess(prozess);

  const titel = resolveI18n(prozess.titel, lebLoc);
  const kurz  = resolveI18n(prozess.kurzbeschreibung, lebLoc);

  return (
    <main
      className="absolute top-14 inset-x-0 bottom-0 px-6 pt-4 pb-10 overflow-y-auto bg-[var(--color-bg)]"
      aria-labelledby="prozess-heading"
    >
      <nav aria-label="Breadcrumb" className="text-[13px] text-[var(--color-mute)] mb-3">
        <Link href={{ pathname: '/prozesse' }} className="hover:underline">
          {t('title')}
        </Link>
        <span aria-hidden> › </span>
        <span>{titel}</span>
      </nav>

      <h2 id="prozess-heading" className="text-lg font-semibold mb-1">{titel}</h2>
      {kurz && <p className="text-[13px] text-[var(--color-mute)] mb-4 max-w-[80ch]">{kurz}</p>}

      <div className="mb-6">
        <ProzessFlow
          titel={titel}
          schritte={schritte}
          kanten={kanten}
          akteure={akteure}
          layout={layout}
        />
      </div>

      {/* Textueller Fallback + a11y — immer sichtbar, damit Screenreader
          und Kopien per "Print" den vollen Inhalt bekommen. */}
      <section aria-labelledby="steps-heading" className="max-w-[80ch]">
        <h3 id="steps-heading" className="text-base font-semibold mb-3">{t('stepsHeading')}</h3>
        <ol className="list-decimal list-inside space-y-3 text-sm">
          {schritte.map((s) => (
            <li key={s.id} className="bg-[var(--color-panel)] border border-[var(--color-line)] rounded p-3">
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="font-semibold">{s.label}</span>
                <span className="text-[11px] uppercase tracking-wider text-[var(--color-mute)]">
                  {t(`schrittTyp.${s.typ}`)}
                </span>
                <span className="text-[11px] text-[var(--color-accent)]">
                  {s.akteurLabel}
                </span>
              </div>
              {s.beschreibung && (
                <p className="mt-1 text-[var(--color-mute)]">{s.beschreibung}</p>
              )}
              {(s.dauer || s.kosten) && (
                <div className="mt-1 text-[12px] text-[var(--color-mute)] flex gap-3 flex-wrap">
                  {s.dauer && <span>⏱ {s.dauer}</span>}
                  {s.kosten && <span>CHF {s.kosten}</span>}
                </div>
              )}
            </li>
          ))}
        </ol>
      </section>

      {prozess.rechtsgrundlagen && prozess.rechtsgrundlagen.length > 0 && (
        <section aria-labelledby="legal-heading" className="max-w-[80ch] mt-6">
          <h3 id="legal-heading" className="text-base font-semibold mb-2">{t('legalHeading')}</h3>
          <ul className="list-disc list-inside text-sm text-[var(--color-mute)] space-y-1">
            {prozess.rechtsgrundlagen.map((r, i) => (
              <li key={i}>
                {r.url ? (
                  <a href={r.url} target="_blank" rel="noopener noreferrer" className="underline">
                    {r.bezeichnung}
                  </a>
                ) : r.bezeichnung}
              </li>
            ))}
          </ul>
        </section>
      )}

      {prozess.quellen && prozess.quellen.length > 0 && (
        <section aria-labelledby="sources-heading" className="max-w-[80ch] mt-6">
          <h3 id="sources-heading" className="text-base font-semibold mb-2">{t('sourcesHeading')}</h3>
          <ul className="list-disc list-inside text-sm text-[var(--color-mute)] space-y-1">
            {prozess.quellen.map((q) => (
              <li key={q.id}>
                {q.url ? (
                  <a href={q.url} target="_blank" rel="noopener noreferrer" className="underline">
                    {q.titel}
                  </a>
                ) : q.titel}
                {q.abgerufen && <span className="ml-2 text-[11px]">({t('retrieved', { date: q.abgerufen })})</span>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
