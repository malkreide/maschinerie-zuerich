'use client';

// Dünner Wrapper um NextIntlClientProvider, der das gemeinsame
// Fallback-Verhalten (i18n/fallback.ts) an Client-Komponenten bringt.
// Nötig als eigene Client-Komponente, weil Funktions-Props
// (getMessageFallback/onError) nicht vom Server-Layout über die
// RSC-Grenze serialisiert werden können.

import type { ReactNode } from 'react';
import { NextIntlClientProvider, type AbstractIntlMessages } from 'next-intl';
import { messageFallback, onI18nError } from '@/i18n/fallback';

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
      getMessageFallback={messageFallback}
      onError={onI18nError}
    >
      {children}
    </NextIntlClientProvider>
  );
}
