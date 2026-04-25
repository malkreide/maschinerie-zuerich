// Server-Route für den Budget-Simulator. Aggregiert die Aufwand-Werte pro
// Departement (Summe der Unter-Einheiten — analog zur Treemap), reicht eine
// schlanke Liste an die Client-Komponente weiter. Schwere Berechnungen
// laufen damit einmal pro Request auf dem Server, nicht im Browser-State.

import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { loadStadtData } from '@/lib/data';
import { routing, type Locale } from '@/i18n/routing';
import { getT } from '@/lib/i18n-server';
import { city } from '@/config/city.config';
import { computeTotalAufwand } from '@/lib/budget-context';
import BudgetSimulator, { type SimulatorDept } from '@/components/BudgetSimulator';

export async function generateMetadata({
  params,
}: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const tApp = getT(locale as Locale, 'App');
  const t    = getT(locale as Locale, 'Simulator');
  return { title: `${t('title')} · ${tApp('title')}`, description: t('intro') };
}

export default async function SimulatorPage({
  params,
}: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const data = await loadStadtData();

  // Aufwand pro Departement = Summe aller Unter-Einheiten mit positivem
  // Aufwand. Bewusst nicht `dep.budget?.aufwand` direkt, weil viele
  // Departemente keinen aggregierten Wert führen — die Summe der Units ist
  // die einzige stabile Bezugsgrösse (gleiches Vorgehen wie Treemap).
  const sumByDep = new Map<string, number>();
  for (const u of data.units) {
    const a = u.budget?.aufwand;
    if (typeof a === 'number' && a > 0) {
      sumByDep.set(u.parent, (sumByDep.get(u.parent) ?? 0) + a);
    }
  }

  // Theme-Palette zyklisch zuweisen — passend zur Farbgebung im Treemap, so
  // bleibt das mentale Modell zwischen den beiden Tabs konsistent.
  const palette = city.theme.departmentPalette;
  const departments: SimulatorDept[] = data.departments
    .map((dep, i) => ({
      id: dep.id,
      name: dep.name,
      originalAufwand: sumByDep.get(dep.id) ?? 0,
      color: palette[i % palette.length],
    }))
    .filter((d) => d.originalAufwand > 0)
    .sort((a, b) => b.originalAufwand - a.originalAufwand);

  const totalAufwand = computeTotalAufwand(data);
  const sampleJahr = data.units.find((u) => u.budget?.jahr)?.budget?.jahr;

  return (
    <BudgetSimulator
      departments={departments}
      totalOriginal={totalAufwand}
      population={city.population}
      jahr={sampleJahr}
    />
  );
}
