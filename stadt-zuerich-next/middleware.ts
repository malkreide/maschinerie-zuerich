import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

export default createMiddleware(routing);

// Node.js-Runtime statt Edge-Default: next-intl v4 + localeDetection=true
// pulled transitive Dependencies, die auf Vercels Edge-Bundle zu
// MIDDLEWARE_INVOCATION_FAILED führten. Node-Runtime ist seit Next.js 16
// stabil für Middleware und hat volle Kompatibilität. Kostet ein paar ms
// Cold-Start, für uns irrelevant.
export const runtime = 'nodejs';

export const config = {
  // Aktiviert i18n-Routing für alle Pfade ausser API, Next-internals und Assets.
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
