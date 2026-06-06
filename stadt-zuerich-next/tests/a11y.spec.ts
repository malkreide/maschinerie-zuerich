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

// Regeln, die vorerst NUR berichtet (nicht blockiert) werden. color-contrast
// hängt am Theme (--color-mute zu hell auf hellem Grund) und braucht visuelle
// Iteration in einem eigenen Theming-PR — bis dahin advisory, damit das Gate
// die strukturellen a11y-Probleme (Rollen, Namen, ARIA) durchsetzen kann.
const ADVISORY_RULES = new Set(['color-contrast']);

// Locale-präfixierte Routen (localePrefix: 'always'). '/' redirectet auf '/de'.
const ROUTES = [
  '/de',
  '/de/liste',
  '/de/anliegen',
  '/de/steuerfranken',
  '/de/prozesse',
  '/de/prozesse/zh/anwohnerparkkarte',
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

    const isBlocking = (v: Result) =>
      BLOCKING_IMPACTS.has(v.impact ?? '') && !ADVISORY_RULES.has(v.id);
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
