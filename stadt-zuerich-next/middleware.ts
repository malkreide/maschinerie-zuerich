import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

export default createMiddleware(routing);

export const config = {
  // Edge-Runtime (Next.js-Default). Node-Runtime wurde probiert, brach aber
  // mit ERR_MODULE_NOT_FOUND weil next-intl 'next/server' ohne .js-Suffix
  // importiert — Node's ESM-strict-Resolver auf Vercel lehnt das ab. Edge
  // bundler löst das anders auf und kommt damit klar. Mit next-intl >=4.9
  // gibt es auf Edge keine 'MIDDLEWARE_INVOCATION_FAILED' mehr.
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
