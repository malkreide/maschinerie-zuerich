import { test, expect, type Page } from '@playwright/test';
import de from '../messages/de.json' with { type: 'json' };

// Das globale Suchfeld (components/Search.tsx) schwebt fixiert oben links.
// Bis 2026-10 begannen die Inhaltsseiten direkt unter dem Header, und das
// Suchfeld verdeckte ihren Titel («Portfolio: Prozesse × Dimensionen»,
// «Belege & Herkunft» …), auf Prozess-Detailseiten die Breadcrumb, auf dem
// Handy die ganze Breite. Für Screenreader war alles da, darum sah axe nichts.
//
// Geprüft wird das oberste sichtbare Inhaltselement jeder Seite: Es darf sich
// nicht mit dem Suchfeld überschneiden. Organigramm (Desktop) und Karte liegen
// bewusst unter dem Suchfeld und sind hier nicht dabei; für die Karte prüft der
// Block am Ende, dass sie Suchfeld und Panel nicht übermalt.

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

// Die Karte (/territory) liegt bewusst unter dem Suchfeld, ihr Bedienpanel
// «Standorte» darüber. Bis 2026-11 übermalte die Leaflet-Kartenebene beides:
// .leaflet-map-pane bildet mit z-index 400 einen eigenen Stapelkontext auf
// Seitenebene. Suchfeld und Panel waren unsichtbar, aber anklickbar, weil die
// Kacheln pointer-events: none tragen — ein Box-Vergleich wie oben sieht das
// nicht. Darum hier mit pointer-events überall an: Dann trifft
// elementFromPoint, was zuoberst gemalt ist.
for (const vp of VIEWPORTS) {
  test.describe(`Karte übermalt nichts (${vp.name})`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test('/de/territory', async ({ page }) => {
      await page.goto('/de/territory');
      await page.waitForLoadState('networkidle');
      // Ohne Kachel an der Stelle wäre «oben» trivial erfüllt: erst messen,
      // wenn die Kartenebene steht (geladene oder fehlgeschlagene Kacheln
      // bekommen beide leaflet-tile-loaded und werden gemalt).
      await expect(page.locator('.leaflet-tile-loaded').first()).toBeAttached({ timeout: 15_000 });
      await page.addStyleTag({ content: '* { pointer-events: auto !important; }' });

      const suche = page.getByRole('search').first();
      const panelTitel = page.locator('main h2').first();
      const zuoberst = (el: Element) => {
        const b = el.getBoundingClientRect();
        const hit = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2);
        return !!hit && el.contains(hit);
      };

      await expect
        .poll(async () => {
          const [s, p] = [await suche.boundingBox(), await panelTitel.boundingBox()];
          if (!s || !p) return 'nicht messbar';
          if (!(await suche.evaluate(zuoberst))) return 'Karte übermalt das Suchfeld';
          if (!(await panelTitel.evaluate(zuoberst))) return 'Karte übermalt das Panel';
          if (ueberschneiden(s, p)) return 'Panel liegt unter dem Suchfeld';
          return 'frei';
        }, { message: '/de/territory', timeout: 15_000 })
        .toBe('frei');
    });
  });
}

// Startseite (Organigramm) in niedrigen Fenstern. Die Legende wächst von unten
// links nach oben. Bis 2026-11 hatte sie ab 640px Breite keine Höhengrenze und
// lag auf derselben Ebene wie das Suchfeld, aber später im DOM: Bei 1280×420
// und Handy quer (812×375) verdeckte sie das Suchfeld, bei 1366×650 die Hälfte
// der Suchvorschläge.
const NIEDRIG = [
  { name: '1280×420', width: 1280, height: 420 },
  { name: 'Handy quer', width: 812, height: 375 },
  { name: '1366×650', width: 1366, height: 650 },
];

for (const vp of NIEDRIG) {
  test.describe(`Legende verdeckt die Suche nicht (${vp.name})`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test('/de', async ({ page }) => {
      // Einführungstour aus: Ihr Backdrop läge nach 1.5s über allem.
      await page.addInitScript(() => {
        try { localStorage.setItem('mog-tour-seen', 'true'); } catch { /* privat */ }
      });
      await page.goto('/de');
      await page.waitForLoadState('networkidle');
      const suche = page.getByRole('search').first();
      const legende = page.getByRole('complementary', { name: de.Legend.headingTop, exact: true });

      await expect
        .poll(async () => {
          const [s, l] = [await suche.boundingBox(), await legende.boundingBox()];
          if (!s || !l) return 'nicht messbar';
          return ueberschneiden(s, l) ? 'Legende liegt über dem Suchfeld' : 'frei';
        }, { message: 'Suchfeld', timeout: 15_000 })
        .toBe('frei');

      await page.getByRole('searchbox').first().fill('Schule');
      const optionen = page.getByRole('listbox').first().getByRole('option');
      await expect(optionen.first()).toBeVisible();
      // Nur Vorschläge im Fenster zählen; was unten aus dem Fenster ragt, ist
      // nicht verdeckt, sondern abgeschnitten (eigenes Thema).
      const verdeckt = await optionen.evaluateAll((els) =>
        els
          .filter((o) => o.getBoundingClientRect().bottom <= window.innerHeight)
          .filter((o) => {
            const r = o.getBoundingClientRect();
            const hit = document.elementFromPoint(r.x + 20, r.y + r.height / 2);
            return !hit || !o.contains(hit);
          })
          .map((o) => o.textContent?.trim().slice(0, 30)),
      );
      expect(verdeckt, 'Suchvorschläge unter der Legende').toEqual([]);
    });
  });
}
