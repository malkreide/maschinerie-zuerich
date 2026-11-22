import { test, expect, type Locator, type Page } from '@playwright/test';
import de from '../messages/de.json' with { type: 'json' };
import en from '../messages/en.json' with { type: 'json' };
import fr from '../messages/fr.json' with { type: 'json' };
import it from '../messages/it.json' with { type: 'json' };
import ls from '../messages/ls.json' with { type: 'json' };

// Einführungstour der Startseite (components/GuidedTour.tsx, react-joyride 3).
//
// Bis 2026-11 war sie für react-joyride 2 geschrieben: Fortschritt und
// «Überspringen» fehlten, das X hiess «Los geht's» und sprang nur weiter,
// der Beacon hiess in allen Sprachen «Open the dialog». Schritt 2 lag auf dem
// Desktop über dem Bildschirmrand, auf dem Handy erschien er gar nicht, und
// im Dunkelmodus stand der Text hell auf weissem Tooltip (Kontrast: a11y.spec).

type M = typeof de;
const tip = (page: Page) => page.locator('.react-joyride__tooltip');
const beacon = (page: Page) => page.locator('.react-joyride__beacon');
const weiterMit = (m: M, nr: number) =>
  `${m.Onboarding.next} (${m.Onboarding.progress.replace('{current}', String(nr)).replace('{total}', '3')})`;

async function imBild(page: Page, el: Locator) {
  const b = await el.boundingBox();
  const vp = page.viewportSize()!;
  return !!b && b.x >= 0 && b.y >= 0 && b.x + b.width <= vp.width && b.y + b.height <= vp.height;
}

async function gesehen(page: Page) {
  return page.evaluate(() => localStorage.getItem('mog-tour-seen'));
}

/** Alle drei Schritte: Titel, im Bild, Knöpfe der Sprache; am Ende gesehen. */
async function durchlaufen(page: Page, m: M, text2: string) {
  const o = m.Onboarding;
  const titel = [o.step1Title, o.step2Title, o.step3Title];
  for (let i = 0; i < 3; i++) {
    const dialog = page.getByRole('alertdialog', { name: titel[i], exact: true });
    await expect(dialog, `Schritt ${i + 1}`).toBeVisible({ timeout: 10_000 });
    // Die Tour scrollt und positioniert animiert: warten, bis sie steht.
    await expect.poll(() => imBild(page, tip(page)), { message: `Schritt ${i + 1} im Bild` }).toBe(true);
    await expect(dialog.getByRole('button', { name: o.close, exact: true })).toBeVisible();
    if (i === 1) await expect(dialog).toContainText(text2);
    if (i < 2) {
      await expect(dialog.getByRole('button', { name: o.skip, exact: true })).toBeVisible();
      await dialog.getByRole('button', { name: weiterMit(m, i + 1), exact: true }).click();
    } else {
      await dialog.getByRole('button', { name: o.done, exact: true }).click();
    }
  }
  await expect(tip(page)).toBeHidden();
  expect(await gesehen(page)).toBe('true');
}

for (const [locale, m] of Object.entries({ de, en, fr, it, ls }) as [string, M][]) {
  test(`Tour: Desktop, alle Schritte und Beschriftungen auf /${locale}`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`/${locale}`);
    await expect(beacon(page)).toHaveAccessibleName(m.App.helpButton, { timeout: 10_000 });
    await beacon(page).click();
    await durchlaufen(page, m, m.Onboarding.step2Body);
  });
}

for (const [locale, m] of Object.entries({ de, ls }) as [string, M][]) {
  test(`Tour: Handy, alle Schritte auf /${locale}`, async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(`/${locale}`);
    await beacon(page).click({ timeout: 10_000 });
    await durchlaufen(page, m, m.Onboarding.step2BodyMobile);
  });
}

test('Tour: X und Escape beenden die ganze Tour', async ({ page }) => {
  for (const wie of ['X', 'Escape']) {
    await page.goto('/de');
    await page.evaluate(() => localStorage.removeItem('mog-tour-seen'));
    await page.reload();
    await beacon(page).click({ timeout: 10_000 });
    const dialog = page.getByRole('alertdialog', { name: de.Onboarding.step1Title, exact: true });
    await expect(dialog).toBeVisible();
    if (wie === 'X') await dialog.getByRole('button', { name: de.Onboarding.close, exact: true }).click();
    else await page.keyboard.press('Escape');
    await expect(tip(page), wie).toBeHidden();
    // Kein Beacon für den nächsten Schritt: Die Tour ist vorbei.
    await page.waitForTimeout(800);
    await expect(beacon(page), `${wie}: kein Beacon danach`).toHaveCount(0);
    expect(await gesehen(page), wie).toBe('true');
  }
});

test('Tour: Hilfe-Knopf öffnet sie sofort, auch ein zweites Mal und von Unterseiten', async ({ page }) => {
  await page.addInitScript(() => {
    try { localStorage.setItem('mog-tour-seen', 'true'); } catch { /* privat */ }
  });
  await page.goto('/de/steuerfranken');
  const hilfe = page.getByRole('button', { name: de.App.helpButton, exact: true });
  const schritt1 = page.getByRole('alertdialog', { name: de.Onboarding.step1Title, exact: true });

  // Von einer Unterseite: zurück zur Startseite, Tooltip ohne Beacon.
  await hilfe.click();
  await expect(page).toHaveURL(/\/de$/);
  await expect(schritt1).toBeVisible({ timeout: 10_000 });
  await schritt1.getByRole('button', { name: weiterMit(de, 1), exact: true }).click();
  await expect(page.getByRole('alertdialog', { name: de.Onboarding.step2Title, exact: true })).toBeVisible();
  await page.getByRole('button', { name: de.Onboarding.close, exact: true }).click();
  await expect(tip(page)).toBeHidden();

  // Zweites Mal: wieder von vorn.
  await hilfe.click();
  await expect(schritt1).toBeVisible();
  await expect(beacon(page)).toHaveCount(0);
});

test('Tour: startet beim Erstbesuch nur auf der Startseite', async ({ page }) => {
  await page.goto('/de/steuerfranken');
  await page.locator('main').first().waitFor();
  await page.waitForTimeout(2500);
  await expect(beacon(page)).toHaveCount(0);
  await expect(tip(page)).toHaveCount(0);
});
