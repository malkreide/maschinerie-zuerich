// Root-Redirect: ohne Middleware fängt nichts mehr '/' ab. Wir leiten
// auf '/de' (Default-Locale) weiter. Andere Locales sind über eigene
// Prefix-URLs erreichbar (/en, /fr, ...). LanguageSwitcher-Links gehen
// direkt auf die gewünschte Sprach-URL — der Redirect greift nur beim
// ersten Landing auf '/'.
//
// Kein Accept-Language-Auto-Match mehr: der kostete uns mehrere Tage
// wegen Vercel-Middleware-Bugs. Akzeptierter Trade-off für einen
// laufenden Deploy.

import { redirect } from 'next/navigation';

export default function RootRedirect() {
  redirect('/de');
}
