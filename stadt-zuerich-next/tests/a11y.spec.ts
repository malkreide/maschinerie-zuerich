import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import type { Result } from 'axe-core';

// Accessibility-Smoke-Tests als Release-Gate (Strategie: Barrierefreiheit ist
// Grundbedingung, kein Feature). Wir prüfen die Hauptseiten mit axe-core gegen
// WCAG 2.0/2.1 A + AA.
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
const ROUTES = [
  '/de',
  '/de/liste',
  '/de/anliegen',
  '/de/steuerfranken',
  '/de/prozesse',
  '/de/prozesse/zh/parkplatz',
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

for (const route of ROUTES) {
  test(`a11y: ${route}`, async ({ page }) => {
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
      console.log(`ℹ︎ ${route}: ${advisory.length} nicht-blockierende Hinweise (moderate/minor): ` +
        advisory.map((v) => v.id).join(', '));
    }
    if (blocking.length) {
      console.log(summarize(route, blocking));
    }

    expect(blocking, `${blocking.length} serious/critical a11y-Verstösse auf ${route}`).toEqual([]);
  });
}

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
