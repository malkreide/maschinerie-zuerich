import { test, expect, type Page } from '@playwright/test';

// Standorte-Panel der Karte (/territory, components/TerritoryMap.tsx).
//
// Auf dem Handy deckte das Panel mit Einleitung und sieben Ebenen-Schaltern
// den grössten Teil der Karte ab. Es startet dort darum zugeklappt: Titel,
// Datenqualität und ein Knopf zum Aufklappen. Die Datenqualität bleibt auch
// zugeklappt sichtbar, denn ob die Marker Demodaten zeigen, darf nicht
// hinter einem Klick liegen. Ab sm (640px) ist das Panel immer offen.

async function oeffneKarte(page: Page) {
  await page.goto('/de/territory');
  const panel = page.getByRole('region', { name: 'Standorte' });
  await expect(panel).toBeVisible({ timeout: 15_000 });
  // Erst wenn Marker stehen, sind die Daten geladen; davor zeigt das
  // Abzeichen kurz «Demodaten» ohne Stand und Quelle.
  await expect(page.locator('.leaflet-marker-icon').first()).toBeVisible({ timeout: 15_000 });
  return panel;
}

test.describe('Standorte-Panel auf dem Handy', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('startet zugeklappt und klappt per Knopf auf', async ({ page }) => {
    const panel = await oeffneKarte(page);
    const knopf = panel.getByRole('button', { name: /^Kategorien \(1\)/ });
    const schulen = panel.getByRole('checkbox', { name: 'Schulanlagen' });

    // Zugeklappt: Knopf, Datenqualität sichtbar, Schalter nicht; Panel klein.
    await expect(knopf).toHaveAttribute('aria-expanded', 'false');
    await expect(schulen).toBeHidden();
    await expect(panel.getByText(/^(Publiziert|Demodaten)$/)).toBeVisible();
    const zu = (await panel.boundingBox())!;
    expect(zu.height, 'Höhe zugeklappt').toBeLessThanOrEqual(110);
    // Zugeklappt zeigt das Abzeichen nur den Status, Stand und Quelle erst
    // aufgeklappt — so bleibt das Panel schmal. (Bei Demodaten gibt es
    // weder Stand noch Quelle.)
    const details = panel.locator('span', { hasText: /^· / });
    const publiziert = await panel.getByText('Publiziert', { exact: true }).isVisible();
    if (publiziert) await expect(details.first()).toBeHidden();
    expect(zu.width, 'Breite zugeklappt').toBeLessThanOrEqual(280);

    // Aufgeklappt: Schalter bedienbar, Zähler folgt der Auswahl.
    await knopf.click();
    await expect(knopf).toHaveAttribute('aria-expanded', 'true');
    await expect(schulen).toBeVisible();
    await expect(schulen).toBeChecked();
    if (publiziert) await expect(details.first()).toBeVisible();
    await panel.getByRole('checkbox', { name: 'Entsorgung' }).check();
    await expect(panel.getByRole('button', { name: /^Kategorien \(2\)/ })).toBeVisible();

    // Wieder zu.
    await panel.getByRole('button', { name: /^Kategorien/ }).click();
    await expect(schulen).toBeHidden();
  });
});

test.describe('Standorte-Panel auf dem Desktop', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('ist immer offen, ohne Klappknopf', async ({ page }) => {
    const panel = await oeffneKarte(page);
    await expect(panel.getByRole('button', { name: /^Kategorien/ })).toBeHidden();
    await expect(panel.getByRole('checkbox', { name: 'Schulanlagen' })).toBeVisible();
    await expect(panel.getByText('Städtische Standorte auf der Karte.', { exact: false })).toBeVisible();
  });
});
