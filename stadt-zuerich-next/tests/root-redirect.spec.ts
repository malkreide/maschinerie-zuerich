import { test, expect } from '@playwright/test';

// Einstieg '/' → '/de' mit denselben Sicherheits-Headern wie jede Seite.
//
// Die Weiterleitung lag kurz als redirects() in next.config.ts (#372). Next
// beantwortet solche Config-Redirects ohne die Header aus headers(): Die
// Startadresse — die Scanner wie securityheaders.com zuerst prüfen — kam
// ohne CSP, X-Frame-Options und HSTS. app/route.ts behebt das; dieser Test
// hält fest, dass es so bleibt, und dass die Weiterleitung wie zuvor 307
// mit relativem Ziel ist.

test('/ leitet mit 307 auf /de weiter, inklusive Sicherheits-Header', async ({ request }) => {
  const res = await request.get('/', { maxRedirects: 0 });

  expect(res.status()).toBe(307);
  expect(res.headers()['location']).toBe('/de');

  const h = res.headers();
  expect(h['content-security-policy']).toContain("frame-ancestors 'none'");
  expect(h['x-frame-options']).toBe('DENY');
  expect(h['strict-transport-security']).toContain('max-age=');
  expect(h['x-content-type-options']).toBe('nosniff');
  expect(h['referrer-policy']).toBe('strict-origin-when-cross-origin');
});
