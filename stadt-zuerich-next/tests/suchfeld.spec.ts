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

// Karte (/territory): Hier liegt das Suchfeld bewusst über der Karte. Leaflet
// stapelt Kacheln und Marker mit z-index 200–700; ohne eigenen Stapelkontext
// lagen sie über dem Suchfeld (z-9), es war auf Desktop und Handy unsichtbar.
// Ebenso lag die Kartenebene über dem Standorte-Panel (Ebenen-Schalter,
// Demo-Hinweis). Kacheln sind für elementFromPoint unsichtbar
// (pointer-events: none), Marker nicht: Der Test schiebt darum einen Marker
// unter den Prüfpunkt und schaut, was dort zuoberst liegt.

type Punkt = { x: number; y: number };

function mitte(b: Box): Punkt {
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}

/** Greift die Karte an einem freien Marker und zieht ihn unter `ziel`. */
async function markerUnter(page: Page, ziel: Punkt) {
  const marker = page.locator('.leaflet-marker-icon');
  await expect(marker.first()).toBeVisible({ timeout: 15_000 });
  // Nur an einem Marker, den nichts verdeckt, greift die Maus die Karte.
  const i = await page.evaluate(() =>
    [...document.querySelectorAll('.leaflet-marker-icon')].findIndex((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)?.closest('.leaflet-marker-icon') === el;
    }),
  );
  expect(i, 'ein freier Marker').toBeGreaterThanOrEqual(0);
  const m = marker.nth(i);
  const start = mitte((await m.boundingBox())!);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(ziel.x, ziel.y, { steps: 12 });
  // Ruhen, dann ein letzter Schritt: Leaflet sieht nur noch diesen einen
  // Punkt und wirft die Karte beim Loslassen nicht weiter (inertia).
  await page.waitForTimeout(150);
  await page.mouse.move(ziel.x + 1, ziel.y);
  await page.mouse.up();
  await page.waitForTimeout(300);
  const neu = (await m.boundingBox())!;
  expect(
    neu.x <= ziel.x && ziel.x <= neu.x + neu.width && neu.y <= ziel.y && ziel.y <= neu.y + neu.height,
    'Marker liegt am Prüfpunkt',
  ).toBe(true);
}

async function zuoberst(page: Page, punkt: Punkt, selector: string) {
  return page.evaluate(
    ({ x, y, selector }) => Boolean(document.elementFromPoint(x, y)?.closest(selector)),
    { ...punkt, selector },
  );
}

for (const vp of VIEWPORTS) {
  test.describe(`Karte: Suchfeld und Panel liegen oben (${vp.name})`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test('Suchfeld', async ({ page }) => {
      // Zugleich: Das Standorte-Panel liegt nicht unter dem Suchfeld.
      await pruefe(page, '/de/territory');
      const ziel = mitte((await page.getByRole('search').first().boundingBox())!);
      await markerUnter(page, ziel);
      expect(await zuoberst(page, ziel, '[role="search"]'), 'zuoberst liegt das Suchfeld').toBe(true);
    });

    test('Standorte-Panel', async ({ page }) => {
      await page.goto('/de/territory');
      await page.waitForLoadState('networkidle');
      const titel = page.locator('main h2').first();
      await expect(titel).toBeVisible({ timeout: 15_000 });
      const ziel = mitte((await titel.boundingBox())!);
      await markerUnter(page, ziel);
      expect(await zuoberst(page, ziel, 'main h2'), 'zuoberst liegt das Panel').toBe(true);
    });
  });
}
