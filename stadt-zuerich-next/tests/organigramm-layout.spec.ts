import { test, expect, type Page } from '@playwright/test';
import de from '../messages/de.json' with { type: 'json' };

// Layout «Gruppiert» der Organigramm-Werkzeugleiste.
//
// Zugeklappt sieht «Gruppiert» fast aus wie «Radial»: Die Kästen mit den
// Ämtern erscheinen erst nach dem Aufklappen. Darum klappt der Wechsel auf
// «Gruppiert» alle Departemente auf, und der Wechsel zurück auf «Radial»
// stellt den Stand von vorher wieder her.
//
// Der Knopf «Alle ausklappen / Alle einklappen» zeigt, ob alle Departemente
// offen sind. Die beiden Tests zusammen unterscheiden «Stand wiederherstellen»
// von «beim Zurückwechseln immer zuklappen» und von «nie zuklappen».

const tb = de.GraphToolbar;

async function leiste(page: Page) {
  await page.goto('/de');
  // Der Graph lädt erst nach der Hydration (GraphLoader, ssr:false).
  const l = page.getByRole('toolbar', { name: tb.label, exact: true });
  await expect(l).toBeVisible({ timeout: 15_000 });
  return {
    radial: l.getByRole('button', { name: tb.radial, exact: true }),
    gruppiert: l.getByRole('button', { name: tb.force, exact: true }),
    aufklappen: l.getByRole('button', { name: de.Nav.expandAll, exact: true }),
    zuklappen: l.getByRole('button', { name: de.Nav.collapseAll, exact: true }),
  };
}

test('Organigramm: «Gruppiert» klappt alle Departemente auf, «Radial» klappt sie wieder zu', async ({ page }) => {
  const k = await leiste(page);
  await expect(k.aufklappen).toBeVisible();

  await k.gruppiert.click();
  await expect(k.gruppiert).toHaveAttribute('aria-pressed', 'true');
  await expect(k.zuklappen).toBeVisible();

  await k.radial.click();
  await expect(k.radial).toHaveAttribute('aria-pressed', 'true');
  await expect(k.aufklappen).toBeVisible();
});

test('Organigramm: zurück auf «Radial» bleibt offen, was vorher offen war', async ({ page }) => {
  const k = await leiste(page);
  await k.aufklappen.click();
  await expect(k.zuklappen).toBeVisible();

  await k.gruppiert.click();
  await expect(k.zuklappen).toBeVisible();

  await k.radial.click();
  await expect(k.zuklappen).toBeVisible();
});
