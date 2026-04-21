// Minimale Locale-Routing-Middleware (ersetzt next-intl's createMiddleware).
//
// Motivation: next-intl 4.9 + Next.js 16 + Vercel Edge → `__dirname is not
// defined` und `ERR_MODULE_NOT_FOUND` je nach Runtime. Weil wir keine
// advanced next-intl-Middleware-Features brauchen (keine pathname-Aliase,
// keine domain-based-routing), rollen wir die Locale-Erkennung selber.
//
// Verhalten:
//  - Pfad hat Prefix (/en/…, /fr/…, /it/…, /ls/…) → passthrough + Cookie
//    auf Prefix-Locale aktualisieren
//  - Pfad ohne Prefix (= Default 'de') → Locale bestimmen aus Cookie >
//    Accept-Language > Default; wenn ≠ de: Redirect zu /{locale}...
//    Sonst passthrough, Cookie auf 'de' setzen
//
// Cookie NEXT_LOCALE: 1 Jahr Laufzeit, samesite=lax — persistiert die Wahl
// des Users über Sessions.

import { NextRequest, NextResponse } from 'next/server';

const LOCALES = ['de', 'en', 'fr', 'it', 'ls'] as const;
type Locale = (typeof LOCALES)[number];
const DEFAULT_LOCALE: Locale = 'de';
const COOKIE_NAME = 'NEXT_LOCALE';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

const PREFIXED: ReadonlyArray<Locale> = LOCALES.filter((l) => l !== DEFAULT_LOCALE);

function isLocale(v: string | undefined | null): v is Locale {
  return !!v && (LOCALES as readonly string[]).includes(v);
}

function detect(cookieValue: string | undefined, acceptLang: string | null): Locale {
  if (isLocale(cookieValue)) return cookieValue;
  if (acceptLang) {
    for (const entry of acceptLang.split(',')) {
      const tag = entry.trim().split(';')[0];        // "de-CH;q=0.9" → "de-CH"
      const lang = tag.split('-')[0].toLowerCase();   // "de-CH" → "de"
      if (isLocale(lang)) return lang;
    }
  }
  return DEFAULT_LOCALE;
}

function setCookie(response: NextResponse, locale: Locale): NextResponse {
  response.cookies.set(COOKIE_NAME, locale, {
    path: '/',
    sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE,
  });
  return response;
}

export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Prefix schon vorhanden? Locale erkennen, Cookie aktualisieren, durchlassen.
  const prefixLocale = PREFIXED.find((l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`));
  if (prefixLocale) {
    return setCookie(NextResponse.next(), prefixLocale);
  }

  // 2. Kein Prefix. Locale bestimmen.
  const cookieLocale = request.cookies.get(COOKIE_NAME)?.value;
  const resolved = detect(cookieLocale, request.headers.get('accept-language'));

  // 3. Default-Locale? Passthrough (keine Weiterleitung).
  if (resolved === DEFAULT_LOCALE) {
    return setCookie(NextResponse.next(), DEFAULT_LOCALE);
  }

  // 4. Non-Default → Redirect auf /{locale}{pathname}.
  const url = request.nextUrl.clone();
  url.pathname = `/${resolved}${pathname === '/' ? '' : pathname}`;
  return setCookie(NextResponse.redirect(url), resolved);
}

export const config = {
  // Zurück auf Edge-Default. Node-Runtime hatte das Problem, dass Vercel's
  // strict ESM-Resolver `next/server` nicht via exports-Field auflösen kann
  // (ERR_MODULE_NOT_FOUND). Mit aktuellen Renovate-Updates (next, react,
  // etc.) probieren wir Edge-Runtime nochmal — ggf. ist der `__dirname`-Bug
  // in einer neueren Next.js-Version gefixt.
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
