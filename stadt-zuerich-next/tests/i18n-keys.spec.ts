import { test, expect, type Locator } from '@playwright/test';
import de from '../messages/de.json' with { type: 'json' };
import en from '../messages/en.json' with { type: 'json' };
import fr from '../messages/fr.json' with { type: 'json' };
import it from '../messages/it.json' with { type: 'json' };
import ls from '../messages/ls.json' with { type: 'json' };

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

// Werkzeugleiste des Organigramms: stand bis 2026-10 fest auf Deutsch im
// Code und blieb so auch in en/fr/it/ls. Ein roher Schlüssel wäre oben
// aufgefallen, ein vergessener deutscher Text nicht — darum hier die Namen
// je Sprache. Der Graph lädt erst nach der Hydration (GraphLoader, ssr:false).
for (const [locale, m] of Object.entries({ de, en, fr, it, ls })) {
  test(`i18n: Werkzeugleiste des Organigramms auf /${locale}`, async ({ page }) => {
    const tb = m.GraphToolbar;
    await page.goto(`/${locale}`);
    const leiste = page.getByRole('toolbar', { name: tb.label, exact: true });
    await expect(leiste).toBeVisible({ timeout: 15_000 });
    for (const name of [tb.radial, tb.force, tb.resetLabel, tb.fitLabel]) {
      await expect(leiste.getByRole('button', { name, exact: true })).toBeVisible();
    }
    for (const gruppe of [tb.groupLayout, tb.groupView, tb.groupExport]) {
      await expect(leiste.getByRole('group', { name: gruppe, exact: true })).toBeVisible();
    }
  });
}

// Budget-Banner der Startseite (components/BudgetSummary.tsx): Die Einheiten
// standen bis 2026-11 fest auf Deutsch im Code — «10.97 Mrd CHF (≈ 24'816
// CHF/Einw.)» auch in en/fr/it/ls. Ein vergessener deutscher Text ist kein
// roher Schlüssel und fällt oben nicht auf; darum hier je Sprache die
// Einheiten aus messages/*.json, und ausser auf Deutsch keine deutschen Reste.
for (const [locale, m] of Object.entries({ de, en, fr, it, ls })) {
  test(`i18n: Einheiten im Budget-Banner auf /${locale}`, async ({ page }) => {
    const b = m.BudgetSummary;
    await page.goto(`/${locale}`);
    const banner = page.getByRole('complementary', { name: b.ariaLabel, exact: true });
    await expect(banner).toBeVisible({ timeout: 15_000 });
    const text = (await banner.textContent())?.replace(/\s+/g, ' ') ?? '';

    expect(text, 'Einheit der Milliarden').toContain(` ${m.Einheiten.mrd} CHF`);
    const [vorher, nachher] = b.proKopf.split('{value}');
    expect(text, 'Pro-Kopf-Text').toContain(vorher);
    expect(text, 'Pro-Kopf-Text').toContain(nachher);
    if (locale !== 'de') {
      expect(text, 'deutsche Einheit «Einw.»').not.toContain('Einw.');
      expect(text, 'deutsche Einheit «Mrd»').not.toContain('Mrd');
    }
  });
}

// Simulator und Treemap (/steuerfranken) formatieren Beträge mit derselben
// Funktion (fmtMio) und zeigten bis 2026-11 ebenfalls «Mrd»/«Mio» in allen
// Sprachen: in Summen, Departementsköpfen, Kacheln und Schiebereglern. Geprüft
// je Sprache: Die Einheiten aus messages/*.json (Namespace «Einheiten»)
// erscheinen, ausser auf Deutsch kein «Mrd» und kein «Mio».
const DEUTSCHE_EINHEIT = /\b(?:Mrd|Mio)\b/;
const nachZahl = (einheit: string) =>
  new RegExp(`\\d ${einheit.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
// Textknoten einzeln, mit Leerzeichen verbunden: textContent klebt die
// SVG-Texte der Treemap aneinander («657 MioTED»), dann greift \b nicht —
// weder für die gesuchte noch für die verbotene Einheit.
const textVon = (el: Locator) => el.evaluate((root) => {
  const teile: string[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) teile.push(n.textContent ?? '');
  return teile.join(' ').replace(/\s+/g, ' ');
});

for (const [locale, m] of Object.entries({ de, en, fr, it, ls })) {
  for (const seite of ['simulator', 'steuerfranken']) {
    test(`i18n: Einheiten auf /${locale}/${seite}`, async ({ page }) => {
      const e = m.Einheiten;
      await page.goto(`/${locale}/${seite}`);
      const main = page.locator('main').first();
      // Die Treemap lädt erst nach der Hydration (TreemapLoader): warten, bis
      // Milliarden- und Millionenbeträge stehen.
      await expect
        .poll(async () => {
          const text = await textVon(main);
          return nachZahl(e.mrd).test(text) && nachZahl(e.mio).test(text);
        }, { message: `«${e.mrd}» und «${e.mio}» nach einer Zahl auf /${locale}/${seite}`, timeout: 15_000 })
        .toBe(true);
      if (locale !== 'de') {
        const text = await textVon(main);
        expect(text.match(DEUTSCHE_EINHEIT)?.[0], 'deutsche Einheit').toBeUndefined();
      }
    });
  }
}
