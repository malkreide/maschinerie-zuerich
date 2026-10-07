import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import type { Result } from 'axe-core';

// Accessibility-Smoke-Tests als Release-Gate (Strategie: Barrierefreiheit ist
// Grundbedingung, kein Feature). Wir prüfen die Hauptseiten mit axe-core gegen
// WCAG 2.0/2.1 A + AA — im hellen und im dunklen Farbmodus.
//
// Gate-Schwelle: 'serious' + 'critical' lassen den Test scheitern. 'moderate'
// und 'minor' werden nur geloggt — so ist der Gate von Anfang an durchsetzbar
// und kann später verschärft werden, ohne dass das Repo daran erstickt.

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
const BLOCKING_IMPACTS = new Set(['serious', 'critical']);

// Regeln, die vorerst NUR berichtet (nicht blockiert) werden. Aktuell leer:
// color-contrast ist seit dem Theming-/Treemap-Fix blockierend. Die App-Tokens
// sind AA-konform; die Treemap nutzt ein Label-Band für sicheren Kontrast.
const ADVISORY_RULES = new Set<string>([]);

function isBlocking(v: Result): boolean {
  return BLOCKING_IMPACTS.has(v.impact ?? '') && !ADVISORY_RULES.has(v.id);
}

// Locale-präfixierte Routen (localePrefix: 'always'). '/' redirectet auf '/de'.
//
// Nicht nur Deutsch: die a11y-Zusage gilt für alle 5 Sprachen. Fehlende
// i18n-Keys liessen früher rohe Key-Strings im Screenreader-Fallback der
// Nicht-DE-Locales rendern — von den axe-Läufen unbemerkt, weil nur /de
// geprüft wurde. Deshalb decken /en und /ls (Leichte Sprache) die Haupt-
// ansicht mit ab, und die Hochrisiko-Prozesse (baugesuch, sozialhilfe)
// laufen zusätzlich zu parkplatz durch das Gate — auch in Leichter Sprache.
const ROUTES = [
  '/de',
  '/en',
  '/ls',
  '/de/liste',
  '/de/anliegen',
  '/de/steuerfranken',
  '/de/prozesse',
  '/de/prozesse/zh/parkplatz',
  '/de/prozesse/zh/baugesuch',
  '/ls/prozesse/zh/baugesuch',
  '/en/prozesse/zh/sozialhilfe',
  '/de/portfolio',
  '/de/roadmap',
];

function summarize(route: string, violations: Result[]): string {
  const lines = [`a11y-Verstösse auf ${route}:`];
  for (const v of violations) {
    lines.push(`  [${v.impact}] ${v.id}: ${v.help}`);
    lines.push(`    → ${v.helpUrl}`);
    for (const node of v.nodes.slice(0, 5)) {
      lines.push(`    • ${node.target.join(' ')}`);
    }
  }
  return lines.join('\n');
}

/** Lädt die Route, lässt axe laufen und erwartet keine blockierenden
 *  Verstösse. `name` erscheint in Log und Fehlermeldung (Route plus ggf.
 *  Farbmodus). */
async function expectRouteAccessible(page: Page, route: string, name = route) {
  await page.goto(route);
  // Auf den Haupt-Landmark warten, damit Client-Komponenten gerendert sind.
  await page.locator('main').first().waitFor({ state: 'attached', timeout: 15_000 });

  const results = await new AxeBuilder({ page })
    .withTags(WCAG_TAGS)
    // Drittanbieter-Wasserzeichen (React Flow), nicht unser Markup.
    .exclude('.react-flow__attribution')
    .analyze();

  const blocking = results.violations.filter(isBlocking);
  const advisory = results.violations.filter((v) => !isBlocking(v));

  if (advisory.length) {
    console.log(`ℹ︎ ${name}: ${advisory.length} nicht-blockierende Hinweise (moderate/minor): ` +
      advisory.map((v) => v.id).join(', '));
  }
  if (blocking.length) {
    console.log(summarize(name, blocking));
  }

  expect(blocking, `${blocking.length} serious/critical a11y-Verstösse auf ${name}`).toEqual([]);
}

for (const route of ROUTES) {
  test(`a11y: ${route}`, async ({ page }) => {
    await expectRouteAccessible(page, route);
  });
}

// Dunkelmodus: dieselben Routen noch einmal mit dunklem Farbschema.
//
// Die Farb-Tokens haben je Modus eigene Werte (app/globals.css, html.dark),
// und --color-accent ist im Dunkelmodus hell statt dunkel. Was im hellen
// Modus AA-konform ist, kann im dunklen durchfallen: weisse Schrift auf der
// Akzentfarbe hatte dort nur ≈ 2.4:1 — in der ganzen Kopfzeile, vom hellen
// Lauf unbemerkt.
//
// Aktiviert wird der Modus wie im echten Betrieb über das Cookie, das der
// Server beim Rendern liest (THEME_COOKIE in lib/theme.ts) — nicht über eine
// nachträglich gesetzte Klasse. So prüft der Test auch den Weg dorthin.
test.describe('Dunkelmodus', () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await context.addCookies([{ name: 'mog-theme', value: 'dark', url: baseURL! }]);
  });

  for (const route of ROUTES) {
    test(`a11y: ${route} (dunkel)`, async ({ page }) => {
      await expectRouteAccessible(page, route, `${route} (dunkel)`);
      // Wächter gegen einen stillen Fehlschlag: griffe das Cookie nicht, liefe
      // der Test im hellen Modus und wäre grün, ohne etwas zu prüfen.
      await expect(page.locator('html')).toHaveClass(/(^|\s)dark(\s|$)/);
    });
  }
});

// Territory-Karte (Leaflet): eigener Test, weil die Karte client-only via
// next/dynamic(ssr:false) lädt — wir warten daher explizit auf das Control-
// Panel und den Leaflet-Container, bevor axe läuft. Leaflet-eigene Chrome
// (Zoom-/Attribution-Controls) ist Drittanbieter-Markup und wird ausgeschlossen,
// analog zum React-Flow-Wasserzeichen.
test('a11y: /de/territory (Karten-Layer)', async ({ page }) => {
  await page.goto('/de/territory');
  await page.locator('input[type="checkbox"]').first().waitFor({ state: 'attached', timeout: 15_000 });
  await page.locator('.leaflet-container').first().waitFor({ state: 'attached', timeout: 15_000 });

  const results = await new AxeBuilder({ page })
    .withTags(WCAG_TAGS)
    .exclude('.react-flow__attribution')
    .exclude('.leaflet-control-container')
    .analyze();

  const blocking = results.violations.filter(isBlocking);
  const advisory = results.violations.filter((v) => !isBlocking(v));
  if (advisory.length) {
    console.log(`ℹ︎ /de/territory: ${advisory.length} nicht-blockierende Hinweise (moderate/minor): ` +
      advisory.map((v) => v.id).join(', '));
  }
  if (blocking.length) console.log(summarize('/de/territory', blocking));

  expect(blocking, `${blocking.length} serious/critical a11y-Verstösse auf /de/territory`).toEqual([]);
});

// Mobile-Viewport: deckt den MobileExplorer auf der Hauptseite ab (auf Desktop
// ist er per sm:hidden ausgeblendet und würde von axe nicht gesehen).
test.describe('mobile viewport', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('a11y: /de (Mobile-Explorer)', async ({ page }) => {
    await page.goto('/de');
    await page.locator('[role="region"]').first().waitFor({ state: 'attached', timeout: 15_000 });
    const results = await new AxeBuilder({ page })
      .withTags(WCAG_TAGS)
      .exclude('.react-flow__attribution')
      .analyze();
    const blocking = results.violations.filter(isBlocking);
    if (blocking.length) console.log(summarize('/de (mobile)', blocking));
    expect(blocking, `${blocking.length} serious/critical a11y-Verstösse auf /de (mobile)`).toEqual([]);
  });
});
