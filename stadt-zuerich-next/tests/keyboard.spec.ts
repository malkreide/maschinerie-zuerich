import { test, expect } from '@playwright/test';

// Tastatur-Smoke: die Live-Suche (Header) muss per Tastatur bedienbar sein —
// fokussierbar, zeigt Vorschläge, und Escape leert das Feld. Deckt die
// wichtigste interaktive Komponente der Hauptseite ab.

test('keyboard: Live-Suche ist fokussierbar, zeigt Vorschläge und Escape leert', async ({ page }) => {
  await page.goto('/de');

  const search = page.getByRole('searchbox').first();
  await search.waitFor({ state: 'visible', timeout: 15_000 });

  await search.focus();
  await expect(search).toBeFocused();

  await search.fill('hund');
  // Vorschläge sind role="option" (siehe components/Search.tsx).
  await expect(page.getByRole('option').first()).toBeVisible({ timeout: 10_000 });

  await search.press('Escape');
  await expect(search).toHaveValue('');
});
