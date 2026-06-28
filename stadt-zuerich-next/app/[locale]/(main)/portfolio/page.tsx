// Portfolio-Route: das BIG PICTURE über alle Prozesse als Heatmap
// «Prozesse × Dimensionen». Konsumiert das committete, deterministische
// Aggregat data/portfolio/<stadt>.json (erzeugt via npm run build:portfolio,
// CI-Drift-geschützt) — die Seite rechnet selbst nichts ab. Titel/Links werden
// aus dem Prozess-Index dazugejoint (Single Source bleibt die Prozessdatei).
//
// Server-gerendert; i18n hier aufgelöst.

import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { routing, type Locale } from '@/i18n/routing';
import { getT } from '@/lib/i18n-server';
import { listProzesse } from '@/lib/prozesse';
import { resolveI18n, type ProzessLocale } from '@/types/prozess';
import type { Portfolio } from '@/lib/portfolio';
import DataQualityBadge from '@/components/DataQualityBadge';
import PortfolioHeatmap from '@/components/PortfolioHeatmap';

export async function generateMetadata({
  params,
}: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const tApp = getT(locale as Locale, 'App');
  const t = getT(locale as Locale, 'Portfolio');
  return { title: `${t('title')} · ${tApp('title')}`, description: t('intro') };
}

/** Liest alle committeten Portfolio-Aggregate (data/portfolio/<stadt>.json).
 *  Failed-soft pro Datei: defekte Aggregate werden übersprungen (CI fängt
 *  Drift/Defekt im check:portfolio-Gate ab). */
async function loadPortfolios(): Promise<Portfolio[]> {
  const dir = path.join(process.cwd(), 'data', 'portfolio');
  let files: string[];
  try {
    files = await fs.readdir(dir);
  } catch {
    return [];
  }
  const out: Portfolio[] = [];
  for (const file of files.sort()) {
    if (!file.endsWith('.json')) continue;
    try {
      const raw = await fs.readFile(path.join(dir, file), 'utf-8');
      out.push(JSON.parse(raw) as Portfolio);
    } catch {
      // defektes Aggregat überspringen
    }
  }
  return out;
}

export default async function PortfolioPage({
  params,
}: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const loc = locale as Locale;
  const t = getT(loc, 'Portfolio');

  const [portfolios, prozesse] = await Promise.all([loadPortfolios(), listProzesse()]);

  // slug → aufgelöster Titel (aus dem Prozess-Index; Single Source bleibt dort).
  const titel: Record<string, string> = {};
  for (const p of prozesse) titel[p.slug] = resolveI18n(p.titel, loc as ProzessLocale);

  const hatProzesse = portfolios.some((p) => p.prozesse.length > 0);

  return (
    <main
      className="absolute top-14 inset-x-0 bottom-0 px-4 sm:px-6 pt-4 pb-10 overflow-y-auto bg-[var(--color-bg)]"
      aria-labelledby="portfolio-heading"
    >
      <h2 id="portfolio-heading" className="text-lg font-semibold mb-1">{t('title')}</h2>
      <p className="text-[13px] text-[var(--color-mute)] mb-3 max-w-[80ch]">{t('intro')}</p>
      <div className="mb-6">
        <DataQualityBadge status="aggregiert" quelle={t('source')} hinweis={t('privacyNote')} />
      </div>

      {!hatProzesse ? (
        <p className="text-[var(--color-mute)] max-w-[70ch]">{t('empty')}</p>
      ) : (
        <div className="space-y-10">
          {portfolios
            .filter((p) => p.prozesse.length > 0)
            .map((p) => (
              <PortfolioHeatmap key={p.city} portfolio={p} titel={titel} locale={loc} />
            ))}
        </div>
      )}
    </main>
  );
}
