import { test, expect } from '@playwright/test';
import de from '../messages/de.json' with { type: 'json' };

// Keine rohen Übersetzungs-Schlüssel im gerenderten HTML.
//
// Fehlt ein Schlüssel in ALLEN Sprachen, hat der Laufzeit-Fallback
// (i18n/fallback.ts) nichts, worauf er zurückfallen kann, und rendert den
// Pfad selbst — «Prozesse.status.erfuellt». Der Paritäts-Test
// (messages-parity.test.mjs) sieht das nicht: er vergleicht die Sprachdateien
// untereinander, nicht mit dem Code, der sie abruft. So standen in der
// Portfolio-Heatmap rohe Schlüssel in jedem Tooltip und in jedem
// Screenreader-Text — unsichtbar für Sehende, weil die Zelle selbst nur ein
// Symbol zeigt.
//
// Geprüft wird darum nicht nur der sichtbare Text, sondern auch sr-only-Text
// und die Attribute title / aria-label / alt / placeholder.

// Namespaces = oberste Schlüssel der Pflicht-Locale. Ein roher Schlüssel ist
// «<Namespace>.<wort>» ohne Leerzeichen nach dem Punkt («Prozesse. Dann …»
// am Satzende ist keiner).
const NAMESPACES = Object.keys(de);
const RAW_KEY = new RegExp(`(?<![\\w./-])(?:${NAMESPACES.join('|')})\\.[A-Za-z0-9_-]+(?:\\.[A-Za-z0-9_-]+)*`, 'g');

// Seiten mit dynamisch zusammengesetzten Schlüsseln (status.*, indikator.*,
// kategorie.* …), je in der Pflicht-Locale und in Leichter Sprache.
const ROUTES = [
  '/de/portfolio',
  '/ls/portfolio',
  '/en/portfolio',
  '/de/prozesse',
  '/de/prozesse/zh/baugesuch',
  '/ls/prozesse/zh/baugesuch',
  '/de/roadmap',
  '/ls/roadmap',
  '/de/wirkung',
  '/ls/wirkung',
];

for (const route of ROUTES) {
  test(`i18n: keine rohen Schlüssel auf ${route}`, async ({ page }) => {
    await page.goto(route);
    await page.locator('main').first().waitFor({ state: 'attached', timeout: 15_000 });

    // Text aller Elemente (inkl. sr-only; textContent statt innerText) plus
    // die für Menschen bestimmten Attribute. <script>/<style> ausgenommen —
    // dort stehen JSON-LD und Hydrations-Daten, kein gerenderter Text.
    const fundstellen = await page.evaluate((source) => {
      const re = new RegExp(source, 'g');
      const treffer = new Set<string>();
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        const parent = n.parentElement;
        if (!parent || parent.closest('script, style, noscript')) continue;
        for (const m of (n.textContent ?? '').matchAll(re)) treffer.add(`Text: ${m[0]}`);
      }
      for (const el of document.body.querySelectorAll('[title], [aria-label], [alt], [placeholder]')) {
        for (const attr of ['title', 'aria-label', 'alt', 'placeholder']) {
          for (const m of (el.getAttribute(attr) ?? '').matchAll(re)) treffer.add(`${attr}: ${m[0]}`);
        }
      }
      return [...treffer].sort();
    }, RAW_KEY.source);

    expect(fundstellen, `rohe Übersetzungs-Schlüssel auf ${route}`).toEqual([]);
  });
}
