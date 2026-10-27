// Ansicht «Belege & Herkunft» (docs/plan-belege-herkunft.md, Phase P2): zeigt,
// wie die bindenden Angaben der Prozesse belegt sind und welche Prüfungen die
// Daten durchlaufen. Konsumiert das committete, deterministische Aggregat
// data/belege/<stadt>.json (npm run build:belege, CI-Drift-geschützt); die
// Seite rechnet nur das Alter der Abrufe beim Rendern.
//
// Kardinalregel: keine bindenden Werte, keine Zitate — die stehen auf der
// Detailseite. Hier nur Status, Quelle, Datum und Link. Keine Inszenierung:
// kein «live», keine Animation, keine Rangliste.
//
// Server-gerendert, ohne Client-JS; i18n hier aufgelöst.

import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { routing, type Locale } from '@/i18n/routing';
import { getT } from '@/lib/i18n-server';
import { listProzesse } from '@/lib/prozesse';
import { resolveI18n, type ProzessLocale } from '@/types/prozess';
import { QUELLEN_EBENEN, type Belege, type QuellenEbene } from '@/lib/belege';
import DataQualityBadge from '@/components/DataQualityBadge';
import BelegMatrix from '@/components/BelegMatrix';

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

const METHODIK = ['woertlich', 'keineWerte', 'erreichbar', 'gesperrt', 'verbindlich'] as const;

export async function generateMetadata({
  params,
}: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const tApp = getT(locale as Locale, 'App');
  const t = getT(locale as Locale, 'Belege');
  return { title: `${t('title')} · ${tApp('title')}`, description: t('intro') };
}

/** Liest alle committeten Belege-Aggregate (data/belege/<stadt>.json).
 *  Failed-soft pro Datei: defekte Aggregate werden übersprungen (CI fängt
 *  Drift/Defekt im check:belege-Gate ab). */
async function loadBelege(): Promise<Belege[]> {
  const dir = path.join(process.cwd(), 'data', 'belege');
  let files: string[];
  try {
    files = await fs.readdir(dir);
  } catch {
    return [];
  }
  const out: Belege[] = [];
  for (const file of files.sort()) {
    if (!file.endsWith('.json')) continue;
    try {
      out.push(JSON.parse(await fs.readFile(path.join(dir, file), 'utf-8')) as Belege);
    } catch {
      // defektes Aggregat überspringen
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

export default async function BelegePage({
  params,
}: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const loc = locale as Locale;
  const t = getT(loc, 'Belege');

  const [alleBelege, prozesse] = await Promise.all([loadBelege(), listProzesse()]);
  const belege = alleBelege.filter((b) => b.prozesse.length > 0);
  const heute = new Date();

  // slug → aufgelöster Titel (aus dem Prozess-Index; Single Source bleibt dort).
  const titel: Record<string, string> = {};
  for (const p of prozesse) titel[p.slug] = resolveI18n(p.titel, loc as ProzessLocale);

  // Summen über alle Städte (heute eine; die View bleibt mehrstadtfähig).
  const summe = (f: (b: Belege) => number) => belege.reduce((n, b) => n + f(b), 0);
  const referenzen = summe((b) => b.summary.referenzen);
  const mitZitat = summe((b) => b.summary.mitZitat);
  const hochrisiko = summe((b) => b.summary.hochrisiko);
  const gesetz = summe((b) => b.prozesse.reduce((n, z) => n + z.referenzen.filter((r) => r.gesetzesfassung).length, 0));
  const nachEbene = Object.fromEntries(
    QUELLEN_EBENEN.map((e) => [e, summe((b) => b.summary.nachEbene[e] ?? 0)]),
  ) as Record<QuellenEbene, number>;
  const juengster = belege
    .flatMap((b) => b.prozesse.map((z) => z.abruf.juengster))
    .filter((d): d is string => d !== null)
    .sort()
    .pop();

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
              <Kpi value={t('kpiWocheWert')} label={t('kpiWoche')} />
            </div>
            <p className="text-[13px] text-[var(--color-ink)] mt-3">
              <span className="text-[var(--color-mute)]">{t('ebenenHeading')}: </span>
              {QUELLEN_EBENEN.map((e) => `${t(`ebene.${e}`)} ${nachEbene[e]}`).join(' · ')}
            </p>
          </section>

          <section aria-labelledby="belege-matrix-heading" className="mb-10">
            <h3 id="belege-matrix-heading" className={sectionH}>{t('matrixHeading')}</h3>
            <p className="text-[13px] text-[var(--color-mute)] mb-2 max-w-[80ch]">{t('matrixIntro')}</p>
            <p className="text-[12px] px-2 py-1 mb-4 rounded border border-[var(--color-line)] bg-[var(--color-panel)] text-[var(--color-mute)] max-w-[80ch]">
              {t('matrixFolgt')}
            </p>
            <div className="space-y-8">
              {belege.map((b) => (
                <BelegMatrix key={b.city} belege={b} titel={titel} locale={loc} heute={heute} />
              ))}
            </div>
          </section>
        </>
      )}

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
