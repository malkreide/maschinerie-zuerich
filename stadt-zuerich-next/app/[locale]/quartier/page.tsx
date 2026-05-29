import { getTranslations } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import QuartierMap from '@/components/QuartierMap';
import { loadStadtData } from '@/lib/data';
import { routing } from '@/i18n/routing';
import fs from 'fs';
import path from 'path';

export default async function QuartierPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  
  const t = await getTranslations({ locale, namespace: 'Quartier' });
  
  await loadStadtData();
  
  // Lade Mock-Daten
  let mockData = {};
  try {
    const mockPath = path.join(process.cwd(), 'data/zh/quartier-mock.json');
    mockData = JSON.parse(fs.readFileSync(mockPath, 'utf8'));
  } catch (e) {
    console.error('Konnte Mock-Daten nicht laden', e);
  }

  // Lade GeoJSON
  let geoJson = null;
  try {
    const geoPath = path.join(process.cwd(), 'public/data/stadtkreise.geojson');
    geoJson = JSON.parse(fs.readFileSync(geoPath, 'utf8'));
  } catch (e) {
    console.error('Konnte GeoJSON nicht laden', e);
  }

  return (
    <main className="absolute top-14 inset-x-0 bottom-0 p-4 pb-10 overflow-hidden flex flex-col bg-[var(--color-bg)]">
      <div className="max-w-4xl mx-auto w-full flex-1 flex flex-col">
        <h2 className="text-xl font-bold mb-2 text-[var(--color-ink)]">{t('title')}</h2>
        <p className="text-[13px] text-[var(--color-mute)] mb-4 max-w-2xl">
          {t('intro')}
        </p>

        <div className="flex-1 bg-[var(--color-panel)] rounded-xl border border-[var(--color-line)] shadow-sm overflow-hidden flex flex-col relative">
          {geoJson ? (
            <QuartierMap geoJson={geoJson} mockData={mockData} />
          ) : (
            <div className="flex items-center justify-center h-full text-[var(--color-mute)]">
              GeoJSON Daten nicht verfügbar.
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
