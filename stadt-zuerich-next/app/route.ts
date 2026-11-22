// Root-Redirect: ohne Middleware fängt nichts mehr '/' ab. Wir leiten
// auf '/de' (Default-Locale) weiter. Andere Locales sind über eigene
// Prefix-URLs erreichbar (/en, /fr, ...). LanguageSwitcher-Links gehen
// direkt auf die gewünschte Sprach-URL — der Redirect greift nur beim
// ersten Landing auf '/'.
//
// Kein Accept-Language-Auto-Match mehr: der kostete uns mehrere Tage
// wegen Vercel-Middleware-Bugs. Akzeptierter Trade-off für einen
// laufenden Deploy.
//
// Route Handler statt Seite: Früher lag hier app/page.tsx mit
// redirect('/de'). Seit Next 16.4 braucht jede Seite ein Root-Layout, und
// das einzige Root-Layout liegt unter app/[locale]/ — der Build brach mit
// «page.tsx doesn't have a root layout» ab. Ein Route Handler braucht kein
// Layout. Bewusst nicht als redirects() in next.config.ts: Dort antwortet
// Next ohne die Sicherheits-Header aus headers() (CSP, X-Frame-Options,
// HSTS), ein Route Handler bekommt sie wie jede andere Route.
//
// Location relativ ('/de'), wie zuvor redirect() sie setzte: eine absolute
// URL aus request.url zeigte hinter Proxies bzw. im Docker-Container
// (HOSTNAME=0.0.0.0) auf den internen Host.

export function GET(): Response {
  return new Response(null, { status: 307, headers: { Location: '/de' } });
}
