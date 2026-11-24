import { test, expect } from '@playwright/test';
import city from '../config/city.config.json' with { type: 'json' };
import de from '../messages/de.json' with { type: 'json' };

// Block «Parlamentarische Geschäfte» im Detail-Panel folgt dem Schalter
// city.config.json → parlamentsGeschaefte. Ausgeschaltet, weil die
// Geschäfts-API des Gemeinderats von aussen nicht erreichbar ist: Der Block
// zeigte immer «Keine aktuellen Geschäfte gefunden». Ausgeschaltet darf er
// weder erscheinen noch /api/ris aufrufen, und /api/ris fragt die Quelle
// nicht an. Wird der Schalter wieder eingeschaltet, prüft derselbe Test,
// dass der Block erscheint.
test('Detail-Panel: Block «Parlamentarische Geschäfte» folgt dem Config-Schalter', async ({ page, request }) => {
  const risAufrufe: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes('/api/ris')) risAufrufe.push(r.url());
  });

  await page.goto('/de?focus=SSD-schule');
  const panel = page.getByRole('region', { name: de.Detail.ariaLabel });
  await expect(panel.getByRole('heading', { level: 3 }).first()).toBeVisible({ timeout: 15_000 });

  const block = panel.locator('h4', { hasText: de.RIS.heading });
  if (city.parlamentsGeschaefte) {
    await expect(block).toBeVisible();
    return;
  }

  await expect(block).toHaveCount(0);
  expect(risAufrufe).toEqual([]);

  const res = await request.get('/api/ris?q=Schulamt');
  expect(res.status()).toBe(200);
  expect(await res.json()).toEqual([]);
});
