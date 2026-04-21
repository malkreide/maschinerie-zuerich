// Server-seitige Translator-Helper ohne next-intl/plugin.
// Motivation: das Plugin injiziert Runtime-Code in den Bundle, der auf
// Vercels Edge-Runtime zu `__dirname is not defined` führt. Statt über
// getRequestConfig/getTranslations laufen Server-Components direkt
// gegen createTranslator mit explizit übergebenem Locale.

import { createTranslator } from 'next-intl';
import type { Locale } from '@/i18n/routing';
import de from '@/messages/de.json';
import en from '@/messages/en.json';
import fr from '@/messages/fr.json';
import it from '@/messages/it.json';
import ls from '@/messages/ls.json';

export const MESSAGES = { de, en, fr, it, ls } as const;

export type Messages = typeof de;

export function getMessages(locale: Locale): Messages {
  return MESSAGES[locale] as Messages;
}

// Translator-Wrapper: String-basierte Keys + Values (statt der strikt
// typisierten Namespace-Keys von createTranslator). Das passt zu unserem
// Vorher-Stand mit useTranslations(), der auch String-Keys akzeptiert hat.
type Translator = (key: string, values?: Record<string, string | number>) => string;

export function getT(locale: Locale, namespace?: string): Translator {
  const t = createTranslator({
    locale,
    messages: getMessages(locale),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    namespace: namespace as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any;
  return ((key: string, values?: Record<string, string | number>) =>
    values ? t(key, values) : t(key)) as Translator;
}
