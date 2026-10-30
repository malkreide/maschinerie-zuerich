// Ansicht «Belege & Herkunft» (docs/plan-belege-herkunft.md, Phasen P2–P5):
// zeigt, wie die bindenden Angaben der Prozesse belegt sind und welche
// Prüfungen die Daten durchlaufen. Konsumiert das committete, deterministische
// Aggregat data/belege/<stadt>.json (npm run build:belege, CI-Drift-geschützt)
// und, sobald einer gemergt ist, den Wochenbefund data/befunde/<stadt>.json
// (Bot-PR aus link-rot.yml). Die Seite rechnet nur das Alter der Abrufe.
// Das Änderungsprotokoll (lib/aenderungen.ts) kommt live von GitHub (ISR 300 s)
// und fällt bei einem Ausfall auf einen Hinweis zurück.
//
// Kardinalregel: keine bindenden Werte, keine Zitate — die stehen auf der
// Detailseite. Hier nur Status, Quelle, Datum und Link. Keine Inszenierung:
// kein «live», keine Animation, keine Rangliste. Tote Links werden mit URL
// genannt (Entscheid E5), neutral: der Fehler liegt in unserem Verweis.
//
// Server-gerendert, ohne Client-JS; i18n hier aufgelöst.

import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import { routing, type Locale } from '@/i18n/routing';
import { getT } from '@/lib/i18n-server';
import { listProzesse } from '@/lib/prozesse';
import { resolveI18n, type ProzessLocale } from '@/types/prozess';
import { HERKUNFT_SCHLUESSEL, QUELLEN_EBENEN, type Belege, type HerkunftSchluessel, type QuellenEbene } from '@/lib/belege';
import { befundLeser, type Wochenbefund } from '@/lib/befunde';
import DataQualityBadge from '@/components/DataQualityBadge';
import BelegMatrix, { zaehlungFuer } from '@/components/BelegMatrix';
import { artVon, fetchAenderungen, PROZESS_PFAD } from '@/lib/aenderungen';
import { findBindingValue } from '@/scripts/lib/binding-values.mjs';

// Gleiches Repo wie die Roadmap; die Prüfkette verlinkt ihre Umsetzung.
const REPO_URL = `https://github.com/${process.env.ROADMAP_GITHUB_REPO ?? 'malkreide/maschinerie-zuerich'}`;

/** Prüfstufen in Reihenfolge, je mit der Datei, die sie umsetzt. */
const STUFEN = [
  { key: 'erfassung', pfad: 'docs/process-data-contract.md' },
  { key: 'schema', pfad: 'stadt-zuerich-next/scripts/validate-prozesse.mjs' },
  { key: 'regression', pfad: 'stadt-zuerich-next/scripts/check-prozess-regression.mjs' },
  { key: 'referenzen', pfad: 'stadt-zuerich-next/scripts/check-refs-gate.mjs' },
  { key: 'review', pfad: 'docs/branch-protection.md' },
  { key: 'woche', pfad: '.github/workflows/link-rot.yml' },
] as const;

const METHODIK = ['woertlich', 'keineWerte', 'herkunft', 'uebersetzung', 'protokoll', 'erreichbar', 'gesperrt', 'stand', 'veroeffentlichung', 'verbindlich'] as const;

export async function generateMetadata({
  params,
}: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const tApp = getT(locale as Locale, 'App');
  const t = getT(locale as Locale, 'Belege');
  return { title: `${t('title')} · ${tApp('title')}`, description: t('intro') };
}

/** Liest alle committeten JSON-Artefakte eines Verzeichnisses unter data/.
 *  Failed-soft pro Datei: defekte Artefakte werden übersprungen (CI fängt
 *  Drift/Defekt in check:belege bzw. validate:befunde ab). */
async function loadJsonDir<T>(sub: string): Promise<T[]> {
  const dir = path.join(process.cwd(), 'data', sub);
  let files: string[];
  try {
    files = await fs.readdir(dir);
  } catch {
    return [];
  }
  const out: T[] = [];
  for (const file of files.sort()) {
    if (!file.endsWith('.json')) continue;
    try {
      out.push(JSON.parse(await fs.readFile(path.join(dir, file), 'utf-8')) as T);
    } catch {
      // defektes Artefakt überspringen
    }
  }
  return out;
}

function Kpi({ value, label }: { value: string; label: string }) {
  return (
    <div className="bg-[var(--color-panel)] border border-[var(--color-line)] rounded-lg p-4">
      <div className="text-2xl font-bold text-[var(--color-ink)] tabular-nums">{value}</div>
      <div className="text-[12px] text-[var(--color-mute)] mt-0.5">{label}</div>
    </div>
  );
}

type OffenerBefund = {
  key: string;
  art: 'tot' | 'drift' | 'ueberholt';
  titel: string;
  city: string;
  id: string;
  referenceId: number;
  url: string;
  httpStatus: number | null;
};

export default async function BelegePage({
  params,
}: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const loc = locale as Locale;
  const t = getT(loc, 'Belege');

  const [alleBelege, alleBefunde, prozesse] = await Promise.all([
    loadJsonDir<Belege>('belege'),
    loadJsonDir<Wochenbefund>('befunde'),
    listProzesse(),
  ]);
  const belege = alleBelege.filter((b) => b.prozesse.length > 0);
  const befundVon = (city: string) => alleBefunde.find((w) => w.city === city) ?? null;
  const heute = new Date();

  // slug → aufgelöster Titel (aus dem Prozess-Index; Single Source bleibt dort).
  const titel: Record<string, string> = {};
  for (const p of prozesse) titel[p.slug] = resolveI18n(p.titel, loc as ProzessLocale);

  // Kardinalregel auch hier: ein Betreff mit bindendem Wert erscheint nicht.
  const aenderungen = await fetchAenderungen({
    prozessSlugs: new Set(prozesse.map((p) => p.slug)),
    istBindend: (text) => findBindingValue(text) !== null,
  });
  // Betreffe sind deutsch; in en/fr/it als Sprachwechsel auszeichnen (WCAG 3.1.2).
  const betreffLang = loc === 'de' || loc === 'ls' ? undefined : 'de';

  // Summen über alle Städte (heute eine; die View bleibt mehrstadtfähig).
  const summe = (f: (b: Belege) => number) => belege.reduce((n, b) => n + f(b), 0);
  const referenzen = summe((b) => b.summary.referenzen);
  const mitZitat = summe((b) => b.summary.mitZitat);
  const hochrisiko = summe((b) => b.summary.hochrisiko);
  const gesetz = summe((b) => b.prozesse.reduce((n, z) => n + z.referenzen.filter((r) => r.gesetzesfassung).length, 0));
  const nachEbene = Object.fromEntries(
    QUELLEN_EBENEN.map((e) => [e, summe((b) => b.summary.nachEbene[e] ?? 0)]),
  ) as Record<QuellenEbene, number>;
  // Aus den Zeilen gezählt: in einem Aggregat vor 1.2.0 fehlt herkunft, dann
  // zählt die Zeile als «nicht erfasst» — nichts wird geraten.
  const nachHerkunft = Object.fromEntries(
    HERKUNFT_SCHLUESSEL.map((k) => [k, summe((b) => b.prozesse.filter((z) => (z.herkunft?.art ?? 'nicht-erfasst') === k).length)]),
  ) as Record<HerkunftSchluessel, number>;
  const juengster = belege
    .flatMap((b) => b.prozesse.map((z) => z.abruf.juengster))
    .filter((d): d is string => d !== null)
    .sort()
    .pop();

  // Wochenbefund: Zählung und offene Befunde — nur für References, deren
  // geprüfte Fassung (url + retrieved_at) noch gilt.
  const befunde = belege.map((b) => befundVon(b.city)).filter((w): w is Wochenbefund => w !== null);
  const befundDatum = befunde.map((w) => w.erhoben_am.slice(0, 10)).sort().pop();
  const laufUrl = befunde.find((w) => w.lauf_url)?.lauf_url ?? null;
  const woche = { tot: 0, drift: 0, ueberholt: 0, gesperrt: 0 };
  const offen: OffenerBefund[] = [];
  for (const b of belege) {
    const w = befundVon(b.city);
    if (!w) continue;
    const lies = befundLeser(w);
    for (const z of b.prozesse) {
      const n = zaehlungFuer(z, lies);
      woche.tot += n.linkTot;
      woche.drift += n.zitatDrift;
      woche.ueberholt += n.fassungUeberholt;
      woche.gesperrt += n.linkGesperrt;
      for (const r of z.referenzen) {
        const f = lies({ slug: z.slug, reference_id: r.reference_id, url: r.url, retrieved_at: r.retrieved_at });
        if (!f) continue;
        const basis = { titel: titel[z.slug] ?? z.slug, city: z.city, id: z.id, referenceId: r.reference_id, url: r.url, httpStatus: f.http_status };
        if (f.erreichbar === 'tot') offen.push({ ...basis, key: `${z.slug}#${r.reference_id}#tot`, art: 'tot' });
        if (f.zitat === 'drift') offen.push({ ...basis, key: `${z.slug}#${r.reference_id}#drift`, art: 'drift' });
        if (f.fassung === 'ueberholt') offen.push({ ...basis, key: `${z.slug}#${r.reference_id}#ueberholt`, art: 'ueberholt' });
      }
    }
  }
  offen.sort((a, b) => a.titel.localeCompare(b.titel, loc) || a.referenceId - b.referenceId);
  const offeneBefunde = woche.tot + woche.drift + woche.ueberholt;

  const sectionH = 'text-sm font-semibold uppercase tracking-wider text-[var(--color-mute)] mb-2';

  return (
    <main
      className="absolute top-14 inset-x-0 bottom-0 px-4 sm:px-6 pt-4 pb-10 overflow-y-auto bg-[var(--color-bg)]"
      aria-labelledby="belege-heading"
    >
      <h2 id="belege-heading" className="text-lg font-semibold mb-1">{t('title')}</h2>
      <p className="text-[13px] text-[var(--color-mute)] mb-3 max-w-[80ch]">{t('intro')}</p>
      <div className="mb-6">
        <DataQualityBadge status="aggregiert" stand={juengster} quelle={t('source')} hinweis={t('privacyNote')} />
      </div>

      {belege.length === 0 ? (
        <p className="text-[var(--color-mute)] max-w-[70ch]">{t('empty')}</p>
      ) : (
        <>
          <section aria-labelledby="belege-kpi-heading" className="mb-8 max-w-[80ch]">
            <h3 id="belege-kpi-heading" className="sr-only">{t('kpiHeading')}</h3>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Kpi value={`${mitZitat}/${referenzen}`} label={t('kpiBelegt')} />
              <Kpi value={String(gesetz)} label={t('kpiGesetz')} />
              <Kpi value={String(hochrisiko)} label={t('kpiHochrisiko')} />
              {befundDatum ? (
                <Kpi value={String(offeneBefunde)} label={t('kpiOffen')} />
              ) : (
                <Kpi value={t('kpiWocheWert')} label={t('kpiWoche')} />
              )}
            </div>
            <p className="text-[13px] text-[var(--color-ink)] mt-3">
              <span className="text-[var(--color-mute)]">{t('ebenenHeading')}: </span>
              {QUELLEN_EBENEN.map((e) => `${t(`ebene.${e}`)} ${nachEbene[e]}`).join(' · ')}
            </p>
            <p className="text-[13px] text-[var(--color-ink)] mt-1">
              <span className="text-[var(--color-mute)]">{t('herkunftHeading')}: </span>
              {HERKUNFT_SCHLUESSEL.filter((k) => nachHerkunft[k] > 0)
                .map((k) => `${t(`herkunft.${k === 'nicht-erfasst' ? 'nichtErfasst' : k}`)} ${nachHerkunft[k]}`)
                .join(' · ')}
            </p>
            {befundDatum && (
              <p className="text-[13px] text-[var(--color-ink)] mt-1">
                {t('wocheZeile', { datum: befundDatum, ...woche })}{' '}
                {laufUrl && (
                  <a href={laufUrl} target="_blank" rel="noopener noreferrer" className="text-[var(--color-accent)] underline">
                    {t('laufLink')}
                  </a>
                )}
              </p>
            )}
          </section>

          {befundDatum && (
            <section aria-labelledby="belege-offen-heading" className="mb-8 max-w-[80ch]">
              <h3 id="belege-offen-heading" className={sectionH}>{t('offenHeading')}</h3>
              {offen.length === 0 ? (
                <p className="text-[13px] text-[var(--color-ink)]">{t('offenKeine')}</p>
              ) : (
                <>
                  <p className="text-[13px] text-[var(--color-mute)] mb-2">{t('offenIntro')}</p>
                  <ul className="list-disc pl-5 space-y-1.5 text-[13px] text-[var(--color-ink)]">
                    {offen.map((o) => (
                      <li key={o.key}>
                        {o.art === 'tot' &&
                          t('offenTot', {
                            titel: o.titel,
                            id: o.referenceId,
                            status: o.httpStatus !== null ? `HTTP ${o.httpStatus}` : t('adresseUnbekannt'),
                          })}
                        {o.art === 'drift' && t('offenDrift', { titel: o.titel, id: o.referenceId })}
                        {o.art === 'ueberholt' && t('offenUeberholt', { titel: o.titel, id: o.referenceId })}{' '}
                        {o.art === 'tot' && (
                          <span className="block font-mono text-[12px] text-[var(--color-mute)] break-all">{o.url}</span>
                        )}
                        <Link
                          href={`/prozesse/${o.city}/${o.id}#referenzen-heading`}
                          className="text-[var(--color-accent)] underline"
                        >
                          {t('offenDetail')}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>
          )}

          <section aria-labelledby="belege-matrix-heading" className="mb-10">
            <h3 id="belege-matrix-heading" className={sectionH}>{t('matrixHeading')}</h3>
            <p className="text-[13px] text-[var(--color-mute)] mb-2 max-w-[80ch]">{t('matrixIntro')}</p>
            {!befundDatum && (
              <p className="text-[12px] px-2 py-1 mb-4 rounded border border-[var(--color-line)] bg-[var(--color-panel)] text-[var(--color-mute)] max-w-[80ch]">
                {t('matrixFolgt')}
              </p>
            )}
            <div className="space-y-8">
              {belege.map((b) => (
                <BelegMatrix key={b.city} belege={b} befund={befundVon(b.city)} titel={titel} locale={loc} heute={heute} repoUrl={REPO_URL} />
              ))}
            </div>
          </section>
        </>
      )}

      <section aria-labelledby="belege-protokoll-heading" className="mb-10 max-w-[80ch]">
        <h3 id="belege-protokoll-heading" className={sectionH}>{t('protokollHeading')}</h3>
        <p className="text-[13px] text-[var(--color-mute)] mb-3">
          {t('protokollIntro')}
          {loc !== 'de' && ` ${t('protokollSprache')}`}
        </p>
        {aenderungen === null ? (
          <p className="text-[13px] text-[var(--color-ink)]">{t('protokollFehler')}</p>
        ) : aenderungen.length === 0 ? (
          <p className="text-[13px] text-[var(--color-ink)]">{t('protokollLeer')}</p>
        ) : (
          <ul className="list-none m-0 p-0 space-y-2.5 text-[13px] text-[var(--color-ink)]">
            {aenderungen.map((e) => (
              <li key={e.sha} className="border-l-2 border-[var(--color-line)] pl-3">
                <span className="text-[var(--color-mute)] tabular-nums">
                  <time dateTime={e.datum}>{e.datum}</time>
                </span>
                {' · '}
                <span className="font-semibold">{t(`protokollArt.${artVon(e.typ)}`)}</span>
                {' · '}
                {e.prozesse.length > 0
                  ? e.prozesse.map((slug, i) => (
                      <span key={slug}>
                        {i > 0 && ', '}
                        <Link href={`/prozesse/${slug}`} className="text-[var(--color-accent)] underline">
                          {titel[slug] ?? slug}
                        </Link>
                      </span>
                    ))
                  : t('protokollAllgemein')}
                <span className="block mt-0.5">
                  {e.titel !== null ? <span lang={betreffLang}>{e.titel}</span> : t('protokollZurueckgehalten')}{' '}
                  <a href={e.url} target="_blank" rel="noopener noreferrer" className="text-[var(--color-accent)] underline tabular-nums">
                    {e.pr !== null ? (
                      <>
                        <span className="sr-only">{t('protokollPrLabel')} </span>#{e.pr}
                      </>
                    ) : (
                      <>
                        <span className="sr-only">{t('protokollCommitLabel')} </span>
                        {e.sha}
                      </>
                    )}
                  </a>
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="text-[12px] mt-3">
          <a
            href={`${REPO_URL}/commits/main/${PROZESS_PFAD}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--color-accent)] underline"
          >
            {t('protokollAlle')}
          </a>
        </p>
      </section>

      <section aria-labelledby="belege-pruef-heading" className="mb-10 max-w-[80ch]">
        <h3 id="belege-pruef-heading" className={sectionH}>{t('pruefHeading')}</h3>
        <p className="text-[13px] text-[var(--color-mute)] mb-3">{t('pruefIntro')}</p>
        <ol className="list-decimal pl-5 space-y-3 text-[13px] text-[var(--color-ink)]">
          {STUFEN.map((s) => (
            <li key={s.key}>
              <span className="font-semibold">{t(`stufe.${s.key}.name`)}</span>
              <span>: {t(`stufe.${s.key}.was`)}</span>
              <span className="block text-[12px] text-[var(--color-mute)] mt-0.5">
                {t('grenzeLabel')} {t(`stufe.${s.key}.grenze`)}{' '}
                <a
                  href={`${REPO_URL}/blob/main/${s.pfad}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--color-accent)] underline"
                >
                  {t('codeLink')}
                </a>
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="belege-methodik-heading" className="max-w-[80ch]">
        <h3 id="belege-methodik-heading" className={sectionH}>{t('methodikHeading')}</h3>
        <ul className="list-disc pl-5 space-y-1.5 text-[13px] text-[var(--color-ink)]">
          {METHODIK.map((k) => (
            <li key={k}>{t(`methodik.${k}`)}</li>
          ))}
        </ul>
      </section>
    </main>
  );
}
