'use client';

// Dünner Wrapper um NextIntlClientProvider, der das gemeinsame
// Fallback-Verhalten (i18n/fallback.ts) an Client-Komponenten bringt.
// Nötig als eigene Client-Komponente, weil Funktions-Props
// (getMessageFallback/onError) nicht vom Server-Layout über die
// RSC-Grenze serialisiert werden können.

import type { ReactNode } from 'react';
import { NextIntlClientProvider, type AbstractIntlMessages } from 'next-intl';
import { messageFallback, onI18nError } from '@/i18n/fallback';
import { cityTimeZone } from '@/config/city.config';

export default function IntlProvider({
  locale,
  messages,
  children,
}: {
  locale: string;
  messages: AbstractIntlMessages;
  children: ReactNode;
}) {
  return (
    <NextIntlClientProvider
      locale={locale}
      messages={messages}
      // Dieselbe Zeitzone beim Server-Rendering und im Browser — sonst
      // meldet next-intl ENVIRONMENT_FALLBACK, und Datumsangaben können
      // zwischen Server (meist UTC) und Client abweichen.
      timeZone={cityTimeZone}
      getMessageFallback={messageFallback}
      onError={onI18nError}
    >
      {children}
    </NextIntlClientProvider>
  );
}
