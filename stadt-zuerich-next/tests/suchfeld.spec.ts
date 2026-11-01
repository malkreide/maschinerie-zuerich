import { test, expect, type Page } from '@playwright/test';

// Das globale Suchfeld (components/Search.tsx) schwebt fixiert oben links.
// Bis 2026-10 begannen die Inhaltsseiten direkt unter dem Header, und das
// Suchfeld verdeckte ihren Titel («Portfolio: Prozesse × Dimensionen»,
// «Belege & Herkunft» …), auf Prozess-Detailseiten die Breadcrumb, auf dem
// Handy die ganze Breite. Für Screenreader war alles da, darum sah axe nichts.
//
// Geprüft wird das oberste sichtbare Inhaltselement jeder Seite: Es darf sich
// nicht mit dem Suchfeld überschneiden. Organigramm (Desktop) und Karte liegen
// bewusst unter dem Suchfeld und sind nicht dabei.

const ROUTES = [
  '/de/portfolio',
  '/de/belege',
  '/de/roadmap',
  '/de/wirkung',
  '/de/prozesse',
  '/de/prozesse/zh/baugesuch',
  '/de/quartier',
  '/de/simulator',
  '/de/steuerfranken',
];

const VIEWPORTS = [
  { name: 'Desktop', width: 1280, height: 800 },
  { name: 'Handy', width: 375, height: 812 },
];

type Box = { x: number; y: number; width: number; height: number };

function ueberschneiden(a: Box, b: Box) {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

async function pruefe(page: Page, route: string) {
  await page.goto(route);
  // Einige Seiten rendern nach der Hydration neu (Handy-Startseite, Treemap):
  // erst messen, wenn nichts mehr nachlädt, und dann wiederholt, bis beide
  // Boxen stehen.
  await page.waitForLoadState('networkidle');
  const suche = page.getByRole('search').first(); // globales Suchfeld, vor <main> im DOM
  // Oberstes sichtbares Inhaltselement in Dokument-Reihenfolge.
  const erstes = page.locator('main :is(h1, h2, nav, p):visible').first();
  await expect
    .poll(async () => {
      const [s, e] = [await suche.boundingBox(), await erstes.boundingBox()];
      if (!s || !e) return 'nicht messbar';
      const text = (await erstes.textContent())?.trim().slice(0, 40);
      return ueberschneiden(s, e) ? `«${text}» liegt unter dem Suchfeld` : 'frei';
    }, { message: route, timeout: 15_000 })
    .toBe('frei');
}

for (const vp of VIEWPORTS) {
  test.describe(`Suchfeld verdeckt nichts (${vp.name})`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    for (const route of ROUTES) {
      test(route, async ({ page }) => {
        await pruefe(page, route);
      });
    }
  });
}

// Auf dem Handy zeigt die Startseite statt des Organigramms eine Liste
// (MobileExplorer) — auch deren Einleitung lag unter dem Suchfeld.
test.describe('Suchfeld verdeckt nichts (Handy-Startseite)', () => {
  test.use({ viewport: { width: 375, height: 812 } });
  test('/de', async ({ page }) => {
    await pruefe(page, '/de');
  });
});
