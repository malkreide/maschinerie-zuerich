import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

export default createMiddleware(routing);

export const config = {
  // Aktiviert i18n-Routing für alle Pfade ausser API, Next-internals und Assets.
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
