'use client';

// Client-seitiger Translator-Wrapper mit Auto-Injection von City-Defaults
// ({cityName}, {cityShortName}). Drop-in-Ersatz für useTranslations() aus
// next-intl, damit Call-Sites wie <Header /> oder <Search /> keinen
// manuellen cityName-Durchreich brauchen.
//
// Warum doppelt implementiert (Server in i18n-server.ts, Client hier)?
// useTranslations ist ein React-Hook und nur in Client-Komponenten legitim,
// createTranslator ist synchron und läuft in Server-Components. Die beiden
// Welten teilen also nur die Config-Quelle (city.config.json), nicht den
// Code-Pfad.

import { useTranslations, useLocale } from 'next-intl';
import { city } from '@/config/city.config';
import type { Locale } from '@/i18n/routing';

type Translator = (key: string, values?: Record<string, string | number>) => string;

export function useT(namespace?: string): Translator {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const t = useTranslations(namespace as any) as any;
  const locale = useLocale() as Locale;
  const defaults = {
    cityName: city.name[locale],
    cityShortName: city.shortName[locale],
  };
  return ((key, values) =>
    t(key, values ? { ...defaults, ...values } : defaults)) as Translator;
}
