import { getRequestConfig } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { routing, type Locale } from './routing';
import { messageFallback, onI18nError } from './fallback';

// Explizite statische Imports statt dynamic import(`../messages/${locale}.json`).
// Grund: der Template-Literal-Import ist in Vercels Edge-Bundle problematisch
// (__dirname not defined / ERR_MODULE_NOT_FOUND je nach Runtime). Statische
// Imports bundeln alle 5 Message-Files zuverlässig ins Middleware-Chunk.
import de from '../messages/de.json';
import en from '../messages/en.json';
import fr from '../messages/fr.json';
import it from '../messages/it.json';
import ls from '../messages/ls.json';

const MESSAGES = { de, en, fr, it, ls } as const;

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  return {
    locale,
    messages: MESSAGES[locale as Locale],
    // Fehlende Keys fallen auf de zurück statt als roher Key zu rendern
    // (siehe i18n/fallback.ts).
    getMessageFallback: messageFallback,
    onError: onI18nError,
  };
});
