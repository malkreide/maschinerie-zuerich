import { test, expect } from '@playwright/test';

// Tastatur-Smoke: die Live-Suche (Header) muss per Tastatur bedienbar sein —
// fokussierbar, zeigt Vorschläge, und Escape leert das Feld. Deckt die
// wichtigste interaktive Komponente der Hauptseite ab.

test('keyboard: Live-Suche ist fokussierbar, zeigt Vorschläge und Escape leert', async ({ page }) => {
  await page.goto('/de');

  // Auf die Such-Region scopen — sonst trifft getByRole('option') auch die
  // (versteckten) Optionen des Sprach-<select> im Header.
  const searchRegion = page.getByRole('search');
  const search = searchRegion.getByRole('searchbox');
  await search.waitFor({ state: 'visible', timeout: 15_000 });

  await search.focus();
  await expect(search).toBeFocused();

  await search.fill('hund');
  // Vorschläge sind role="option" innerhalb der Such-Region (siehe Search.tsx).
  await expect(searchRegion.getByRole('option').first()).toBeVisible({ timeout: 10_000 });

  await search.press('Escape');
  await expect(search).toHaveValue('');
});
