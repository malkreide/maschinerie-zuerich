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
import { loadStadtData } from '@/lib/data';
import { city as cityConfig } from '@/config/city.config';
import { layoutProzess } from '@/lib/prozess-layout';
import { prozessToJsonLd } from '@/lib/prozess-jsonld';
import { resolveI18n, type ProzessLocale, type Dauer } from '@/types/prozess';
import type { Department, Unit, Beteiligung, StadtData } from '@/types/stadt';
import ProzessFlow, {
  type ProzessFlowSchritt,
  type ProzessFlowKante,
  type ProzessFlowAkteur,
} from '@/components/prozess/ProzessFlow';

// Nur Zürich hat aktuell ein Org-Chart; andere Städte bekommen keinen
// einheit_ref-Link (Mapping aus validate-prozesse.mjs bewusst nicht
// geteilt — Render-Zeit-Code ist ein anderes Lifecycle als Build-Zeit).
function findEinheit(id: string, data: StadtData): Department | Unit | Beteiligung | null {
  return data.departments.find((d) => d.id === id)
    ?? data.units.find((u) => u.id === id)
    ?? data.beteiligungen.find((b) => b.id === id)
    ?? null;
}

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

  // Brücke in den Org-Chart: nur Prozesse unserer konfigurierten Stadt
  // können einheit_ref gegen das Org-Chart auflösen. Prozesse anderer
  // Städte (falls irgendwann mitverwaltet) behalten plain-Text-Swimlanes.
  const stadtData = city === cityConfig.id ? await loadStadtData() : null;

  // Akteur-ID → { label, einheitHref?, einheitName? }-Map
  const akteurInfo = new Map<string, { label: string; einheitHref?: string; einheitName?: string }>();
  for (const a of prozess.akteure) {
    const label = resolveI18n(a.label, lebLoc);
    if (a.einheit_ref && stadtData) {
      const unit = findEinheit(a.einheit_ref, stadtData);
      if (unit) {
        // Link zur Hauptansicht mit fokussierter Einheit. Wir benutzen hier
        // absichtlich keinen <Link>-Import — der href-String passt in ein
        // einfaches <a>, was auch in der Client-Komponente funktioniert.
        akteurInfo.set(a.id, {
          label,
          einheitHref: `/${locale}/?focus=${encodeURIComponent(a.einheit_ref)}`,
          einheitName: unit.name,
        });
        continue;
      }
    }
    akteurInfo.set(a.id, { label });
  }

  const schritte: ProzessFlowSchritt[] = prozess.schritte.map((s) => {
    const info = akteurInfo.get(s.akteur);
    return {
      id: s.id,
      typ: s.typ,
      akteurId: s.akteur,
      label: resolveI18n(s.label, lebLoc),
      beschreibung: s.beschreibung ? resolveI18n(s.beschreibung, lebLoc) : undefined,
      dauer: formatDauer(s.dauer_est, loc),
      kosten: formatKosten(s.kosten_chf),
      akteurLabel: info?.label ?? s.akteur,
      akteurEinheitHref: info?.einheitHref,
      akteurEinheitName: info?.einheitName,
    };
  });

  const kanten: ProzessFlowKante[] = prozess.flow.map((f, i) => ({
    id: `e-${i}-${f.von}-${f.nach}`,
    von: f.von,
    nach: f.nach,
    label: f.label ? resolveI18n(f.label, lebLoc) : undefined,
    bedingung: f.bedingung,
  }));

  const akteure: ProzessFlowAkteur[] = prozess.akteure.map((a) => {
    const info = akteurInfo.get(a.id);
    return {
      id: a.id,
      label: info?.label ?? resolveI18n(a.label, lebLoc),
      typ: a.typ,
      einheitHref: info?.einheitHref,
      einheitName: info?.einheitName,
    };
  });

  const layout = layoutProzess(prozess);

  const titel = resolveI18n(prozess.titel, lebLoc);
  const kurz  = resolveI18n(prozess.kurzbeschreibung, lebLoc);
  const reife = prozess.reife;

  // schema.org/GovernmentService als JSON-LD für Suchmaschinen. Absolute
  // URL aus NEXT_PUBLIC_SITE_URL (gleiche Konvention wie sitemap.ts), damit
  // `@id`/`mainEntityOfPage` canonical sind. Lokal ohne Env fällt das auf
  // die Vercel-Default-URL zurück — harmlos, weil JSON-LD-Discovery erst
  // in Produktion relevant ist.
  const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL
                   ?? 'https://maschinerie-zuerich.vercel.app').replace(/\/$/, '');
  const localePrefix = loc === routing.defaultLocale ? '' : `/${loc}`;
  const canonicalUrl = `${baseUrl}${localePrefix}/prozesse/${city}/${id}`;
  const jsonLd = prozessToJsonLd(prozess, { locale: loc, canonicalUrl });

  return (
    <main
      className="absolute top-14 inset-x-0 bottom-0 px-6 pt-4 pb-10 overflow-y-auto bg-[var(--color-bg)]"
      aria-labelledby="prozess-heading"
    >
      {/* JSON-LD: macht die Seite für Google/Bing als GovernmentService
          maschinenlesbar. Im <main> statt <head>, weil Next.js App Router
          das server-gerenderte <script> im Body ohne Lifecycle-Knie
          unterbringt — Suchmaschinen parsen beide Orte gleich. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
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
          goToUnitLabelTemplate={t('goToUnit', { name: '{name}' })}
        />
      </div>

      {reife && (
        <section
          aria-labelledby="reife-heading"
          className="max-w-[80ch] mb-6 bg-[var(--color-panel)] border border-[var(--color-line)] rounded-lg p-4"
        >
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <h3 id="reife-heading" className="text-base font-semibold m-0">{t('reifeHeading')}</h3>
            {reife.onlineReifegrad && (
              <span className="text-[11px] px-2 py-0.5 rounded-full border border-[var(--color-line)] bg-[var(--color-bg)]">
                {t('reifegradLabel')}: <strong>{t(`reifegrad.${reife.onlineReifegrad}`)}</strong>
              </span>
            )}
            {reife.status && (
              <span className="text-[11px] px-2 py-0.5 rounded-full border border-[var(--color-line)] bg-[var(--color-bg)]">
                {t('statusLabel')}: {t(`status.${reife.status}`)}
              </span>
            )}
          </div>

          {reife.medienbrueche && reife.medienbrueche.length > 0 && (
            <div className="mb-3">
              <h4 className="text-[11px] uppercase tracking-wider text-[var(--color-mute)] mb-1">{t('medienbruecheHeading')}</h4>
              <ul className="flex flex-wrap gap-1.5 list-none m-0 p-0">
                {reife.medienbrueche.map((m) => (
                  <li key={m} className="text-[12px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                    {t(`medienbruch.${m}`)}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {reife.onceOnlyPotenzial && (
            <div className="mb-3">
              <h4 className="text-[11px] uppercase tracking-wider text-[var(--color-mute)] mb-1">{t('onceOnlyHeading')}</h4>
              <p className="text-sm text-[var(--color-ink)] m-0">{resolveI18n(reife.onceOnlyPotenzial, lebLoc)}</p>
            </div>
          )}

          {reife.painPoints && reife.painPoints.length > 0 && (
            <div className="mb-3">
              <h4 className="text-[11px] uppercase tracking-wider text-[var(--color-mute)] mb-1">{t('painPointsHeading')}</h4>
              <ul className="list-disc list-inside text-sm text-[var(--color-mute)] space-y-1 m-0">
                {reife.painPoints.map((p, i) => <li key={i}>{resolveI18n(p, lebLoc)}</li>)}
              </ul>
            </div>
          )}

          {reife.improvementIdeas && reife.improvementIdeas.length > 0 && (
            <div className="mb-3">
              <h4 className="text-[11px] uppercase tracking-wider text-[var(--color-mute)] mb-1">{t('improvementsHeading')}</h4>
              <ul className="list-disc list-inside text-sm text-[var(--color-ink)] space-y-1 m-0">
                {reife.improvementIdeas.map((p, i) => <li key={i}>{resolveI18n(p, lebLoc)}</li>)}
              </ul>
            </div>
          )}

          {reife.wirkungKpi && reife.wirkungKpi.length > 0 && (
            <div className="mb-3">
              <h4 className="text-[11px] uppercase tracking-wider text-[var(--color-mute)] mb-1">{t('kpiHeading')}</h4>
              <ul className="text-sm space-y-1 list-none m-0 p-0">
                {reife.wirkungKpi.map((k, i) => (
                  <li key={i}>
                    <span className="font-medium">{resolveI18n(k.label, lebLoc)}</span>
                    {k.wert && <span className="text-[var(--color-mute)]">: {k.wert}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {reife.nutzergruppen && reife.nutzergruppen.length > 0 && (
            <div>
              <h4 className="text-[11px] uppercase tracking-wider text-[var(--color-mute)] mb-1">{t('nutzergruppenHeading')}</h4>
              <p className="text-sm text-[var(--color-mute)] m-0">
                {reife.nutzergruppen.map((n) => resolveI18n(n, lebLoc)).join(' · ')}
              </p>
            </div>
          )}
        </section>
      )}

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
                {s.akteurEinheitHref ? (
                  <a
                    href={s.akteurEinheitHref}
                    className="text-[11px] text-[var(--color-accent)] underline decoration-dotted hover:decoration-solid"
                    title={s.akteurEinheitName
                      ? t('goToUnit', { name: s.akteurEinheitName })
                      : undefined}
                  >
                    {s.akteurLabel}
                  </a>
                ) : (
                  <span className="text-[11px] text-[var(--color-accent)]">
                    {s.akteurLabel}
                  </span>
                )}
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
