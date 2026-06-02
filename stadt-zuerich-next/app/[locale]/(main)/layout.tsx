import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { hasLocale } from 'next-intl';
import Shell from '@/components/Shell';
import { loadStadtData } from '@/lib/data';
import { parseDataStand } from '@/lib/data-meta';
import { routing, type Locale } from '@/i18n/routing';
import { getT } from '@/lib/i18n-server';

export default async function MainLayout({
  children, params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  const data = await loadStadtData();
  const dataStand = parseDataStand(data._meta);
  const t = getT(locale as Locale, 'Nav');

  return (
    <>
      <a className="skip-link" href={`/${locale}/liste`}>
        {t('skipToList')}
      </a>
      <Shell lebenslagen={data.lebenslagen ?? []} dataStand={dataStand}>{children}</Shell>
    </>
  );
}
