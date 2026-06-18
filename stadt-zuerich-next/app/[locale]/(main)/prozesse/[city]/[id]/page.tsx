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
import { resolveContent } from '@/lib/search';
import { city as cityConfig } from '@/config/city.config';
import { layoutProzess } from '@/lib/prozess-layout';
import { prozessToJsonLd } from '@/lib/prozess-jsonld';
import { resolveI18n, dependsOnId, dependsOnCondition, type ProzessLocale, type Reference } from '@/types/prozess';
import type { Department, Unit, Beteiligung, StadtData, LebenslageLocale, Lebenslage, LebenslageContent } from '@/types/stadt';
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
  const titel = resolveI18n(p.title, locale as ProzessLocale);
  const desc  = resolveI18n(p.description, locale as ProzessLocale);
  return { title: `${titel} · ${tApp('title')}`, description: desc };
}

/** Hat der i18n-String eine eigene Fassung in dieser Locale? (Fallback auf
 *  'de' zählt nicht — dann zeigen wir den "Übersetzung ausstehend"-Hinweis.) */
function hasOwnLocale(s: Parameters<typeof resolveI18n>[0], locale: ProzessLocale): boolean {
  if (s === undefined) return true;
  if (typeof s === 'string') return locale === 'de';
  return Boolean(s[locale]);
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

  // Reverse der expliziten Verknüpfung: Welche Lebenslagen führen zu diesem
  // Verfahren? (lebenslage.prozesse[] enthält den Slug "<city>/<id>".)
  const prozessSlug = `${city}/${id}`;
  const relatedLebenslagen = (stadtData?.lebenslagen ?? [])
    .filter((l) => l.prozesse?.includes(prozessSlug))
    .map((l) => ({ l, c: resolveContent(l, lebLoc as unknown as LebenslageLocale) }))
    .filter((x): x is { l: Lebenslage; c: LebenslageContent } => x.c != null);

  // Akteur-ID → { label, einheitHref?, einheitName? }-Map (actors-Erweiterung).
  const akteurInfo = new Map<string, { label: string; einheitHref?: string; einheitName?: string }>();
  for (const a of prozess.actors ?? []) {
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

  // Reference-Map: bindende Werte (Fristen, Gebühren) hängen als Link an
  // Schritten — nie als gerenderte Zahl (Kardinalregel,
  // docs/process-data-contract.md).
  const referenceById = new Map<number, Reference>(
    (prozess.references ?? []).map((r) => [r.reference_id, r]),
  );
  const resolveReferences = (ids: number[] | undefined) =>
    (ids ?? [])
      .map((refId) => referenceById.get(refId))
      .filter((r): r is Reference => r !== undefined)
      .map((r) => ({ label: resolveI18n(r.label, lebLoc), url: r.source_url }));

  const schritte: ProzessFlowSchritt[] = prozess.steps.map((s) => {
    const info = akteurInfo.get(s.actor);
    return {
      id: String(s.step_id),
      typ: s.type ?? 'prozess',
      akteurId: s.actor,
      label: resolveI18n(s.label, lebLoc),
      beschreibung: s.description ? resolveI18n(s.description, lebLoc) : undefined,
      referenzen: resolveReferences(s.reference_ids),
      akteurLabel: info?.label ?? s.actor,
      akteurEinheitHref: info?.einheitHref,
      akteurEinheitName: info?.einheitName,
    };
  });

  // Kanten: Vorwärts-Kanten aus depends_on (mit condition-Label) plus
  // gestrichelte Rücksprung-Kanten aus loops_back_to (nicht Teil des DAG).
  const kanten: ProzessFlowKante[] = [];
  for (const s of prozess.steps) {
    for (const d of s.depends_on) {
      const von = dependsOnId(d);
      const condition = dependsOnCondition(d);
      kanten.push({
        id: `e-${von}-${s.step_id}`,
        von: String(von),
        nach: String(s.step_id),
        label: condition ? resolveI18n(condition, lebLoc) : undefined,
        bedingung: condition?.de,
      });
    }
    for (const target of s.loops_back_to ?? []) {
      kanten.push({
        id: `loop-${s.step_id}-${target}`,
        von: String(s.step_id),
        nach: String(target),
        bedingung: 'nein',
      });
    }
  }

  const akteure: ProzessFlowAkteur[] = (prozess.actors ?? []).map((a) => {
    const info = akteurInfo.get(a.id);
    return {
      id: a.id,
      label: info?.label ?? resolveI18n(a.label, lebLoc),
      typ: a.type,
      einheitHref: info?.einheitHref,
      einheitName: info?.einheitName,
    };
  });

  const layout = layoutProzess(prozess);

  // Legende für das Diagramm: nur die tatsächlich vorkommenden Schritt-Typen,
  // in kanonischer Ablauf-Reihenfolge. Labels aus dem bestehenden
  // schrittTyp-Namespace (server-seitig aufgelöst — Client bleibt i18n-frei).
  const TYP_ORDER = ['start', 'input', 'prozess', 'entscheidung', 'loop', 'warten', 'ende'] as const;
  const vorhandeneTypen = new Set(schritte.map((s) => s.typ));
  const legende = TYP_ORDER
    .filter((typ) => vorhandeneTypen.has(typ))
    .map((typ) => ({ typ, label: t(`schrittTyp.${typ}`) }));

  const titel = resolveI18n(prozess.title, lebLoc);
  const kurz  = resolveI18n(prozess.description, lebLoc);
  const reife = prozess.reife;

  // "Übersetzung ausstehend": Locale ohne eigene Titel-Fassung fällt auf
  // Deutsch zurück — sichtbar gekennzeichnet, nicht maschinell übersetzt.
  const translationPending = loc !== 'de' && !hasOwnLocale(prozess.title, lebLoc);

  // Inoffiziell-Hinweis: Key aus dem Datensatz (Default 'Prozesse.disclaimer').
  // Wir unterstützen nur das Prozesse-Namespace — andere Namespaces wären
  // hier ohnehin nicht geladen.
  const disclaimerKey = (prozess.disclaimer_key ?? 'Prozesse.disclaimer').replace(/^Prozesse\./, '');
  // Hochrisiko-Rechtsfälle (baugesuch, sozialhilfe, veranstaltung) tragen einen
  // eigenen, deutlich sichtbaren Disclaimer (rot statt amber, mit Label-Zeile) —
  // datengetrieben über den disclaimer_key, siehe CLAUDE.md / Datenvertrag.
  const isHochrisiko = disclaimerKey === 'disclaimerHochrisiko';

  const voraussetzungen = (prozess.preconditions ?? []).map((v) => resolveI18n(v, lebLoc));

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

      {translationPending && (
        <p
          role="note"
          className="max-w-[80ch] mb-3 text-[13px] px-3 py-2 rounded border border-[var(--color-line)] bg-[var(--color-panel)] text-[var(--color-mute)]"
        >
          {t('translationPending')}
        </p>
      )}

      {/* Inoffiziell-Hinweis: pro Prozess sichtbar, mit Quell-Link + Abrufdatum
          der primären Quelle (vollständige Liste unten unter Quellen).
          Hochrisiko-Fälle bekommen rote Hervorhebung + eine fette Label-Zeile. */}
      <aside
        role="note"
        aria-label={isHochrisiko ? t('disclaimerHochrisikoLabel') : t('disclaimer')}
        className={`max-w-[80ch] mb-4 text-[13px] px-3 py-2 rounded border ${
          isHochrisiko
            ? 'border-red-300 bg-red-50 text-red-900'
            : 'border-amber-200 bg-amber-50 text-amber-900'
        }`}
      >
        {isHochrisiko && (
          <strong className="block font-semibold mb-0.5">
            <span aria-hidden="true">⚠ </span>{t('disclaimerHochrisikoLabel')}
          </strong>
        )}
        {t(disclaimerKey)}{' '}
        <a
          href={prozess.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >
          {prozess.sources?.[0]?.title ?? prozess.source_url}
        </a>
        <span> ({t('retrieved', { date: prozess.retrieved_at })})</span>
      </aside>

      {voraussetzungen.length > 0 && (
        <section aria-labelledby="voraussetzungen-heading" className="max-w-[80ch] mb-4">
          <h3
            id="voraussetzungen-heading"
            className="text-[11px] uppercase tracking-wider text-[var(--color-mute)] mb-2"
          >
            {t('voraussetzungenHeading')}
          </h3>
          <ul className="list-disc list-inside text-sm text-[var(--color-ink)] space-y-1 m-0">
            {voraussetzungen.map((v, i) => <li key={i}>{v}</li>)}
          </ul>
        </section>
      )}

      {relatedLebenslagen.length > 0 && (
        <section aria-labelledby="related-anliegen-heading" className="max-w-[80ch] mb-5">
          <h3
            id="related-anliegen-heading"
            className="text-[11px] uppercase tracking-wider text-[var(--color-mute)] mb-2"
          >
            {t('relatedLebenslagenHeading')}
          </h3>
          <div className="flex flex-wrap gap-2">
            {relatedLebenslagen.map(({ l, c }) => (
              <Link
                key={l.id}
                href={{ pathname: '/anliegen', query: { q: c.stichworte[0] ?? c.frage } }}
                className="inline-flex items-center gap-1 text-[12px] px-2 py-1 rounded-full border border-[var(--color-line)] bg-[var(--color-panel)] text-[var(--color-ink)] no-underline hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition-colors"
              >
                {c.frage}
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="mb-6">
        <ProzessFlow
          titel={titel}
          schritte={schritte}
          kanten={kanten}
          akteure={akteure}
          layout={layout}
          goToUnitLabelTemplate={t('goToUnit', { name: '{name}' })}
          legendeHeading={t('legendeHeading')}
          legende={legende}
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
              {s.referenzen && s.referenzen.length > 0 && (
                <div className="mt-1 text-[12px] flex gap-3 flex-wrap">
                  {s.referenzen.map((r) => (
                    <a
                      key={r.url + r.label}
                      href={r.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[var(--color-accent)] underline decoration-dotted hover:decoration-solid"
                    >
                      {r.label} ↗
                    </a>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ol>
      </section>

      {prozess.references && prozess.references.length > 0 && (
        <section aria-labelledby="referenzen-heading" className="max-w-[80ch] mt-6">
          <h3 id="referenzen-heading" className="text-base font-semibold mb-1">{t('referenzenHeading')}</h3>
          <p className="text-[12px] text-[var(--color-mute)] mb-2">{t('referenzenHint')}</p>
          <ul className="list-disc list-inside text-sm space-y-1">
            {prozess.references.map((r) => (
              <li key={r.reference_id}>
                <a
                  href={r.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                >
                  {resolveI18n(r.label, lebLoc)}
                </a>
                <span className="ml-2 text-[11px] text-[var(--color-mute)]">
                  ({t('retrieved', { date: r.retrieved_at })})
                </span>
                {r.status === 'unverifiziert' && (
                  <span className="ml-2 text-[11px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                    {t('referenzUnverifiziert')}
                  </span>
                )}
                {r.source_quote && (
                  <blockquote className="ml-5 mt-0.5 text-[12px] text-[var(--color-mute)] border-l-2 border-[var(--color-line)] pl-2">
                    «{r.source_quote}»
                  </blockquote>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {prozess.legal_basis && prozess.legal_basis.length > 0 && (
        <section aria-labelledby="legal-heading" className="max-w-[80ch] mt-6">
          <h3 id="legal-heading" className="text-base font-semibold mb-2">{t('legalHeading')}</h3>
          <ul className="list-disc list-inside text-sm text-[var(--color-mute)] space-y-1">
            {prozess.legal_basis.map((r, i) => (
              <li key={i}>
                {r.url ? (
                  <a href={r.url} target="_blank" rel="noopener noreferrer" className="underline">
                    {r.label}
                  </a>
                ) : r.label}
              </li>
            ))}
          </ul>
        </section>
      )}

      {prozess.sources && prozess.sources.length > 0 && (
        <section aria-labelledby="sources-heading" className="max-w-[80ch] mt-6">
          <h3 id="sources-heading" className="text-base font-semibold mb-2">{t('sourcesHeading')}</h3>
          <ul className="list-disc list-inside text-sm text-[var(--color-mute)] space-y-1">
            {prozess.sources.map((q) => (
              <li key={q.id}>
                <a href={q.url} target="_blank" rel="noopener noreferrer" className="underline">
                  {q.title}
                </a>
                <span className="ml-2 text-[11px]">({t('retrieved', { date: q.retrieved_at })})</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
