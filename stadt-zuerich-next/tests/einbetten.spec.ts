import { test, expect, type Page } from '@playwright/test';
import de from '../messages/de.json' with { type: 'json' };

// Einbetten-Dialog auf /steuerfranken (components/EmbedButton.tsx).
//
// Bis 2026-11 war der Dialog ein gewöhnliches <div>: kein role="dialog", der
// Fokus blieb auf dem Knopf, Escape schloss nicht, der Rest der Seite blieb
// bedienbar. Und weil er im Wrapper der Seite steckte (z-10, eigener
// Stapelkontext), lag das Suchfeld (z-[20]) über seinem Hintergrund. Heute
// ist er ein natives <dialog> mit showModal() in der obersten Ebene des
// Browsers. Geprüft wird, was man davon bemerkt: Fokus, Escape, Hintergrund,
// Kopieren.

const e = de.Embed;

async function oeffnen(page: Page) {
  await page.goto('/de/steuerfranken');
  const knopf = page.getByRole('button', { name: e.knopf, exact: true });
  await knopf.click();
  const dialog = page.getByRole('dialog', { name: e.titel, exact: true });
  await expect(dialog).toBeVisible();
  return { knopf, dialog };
}

test('Einbetten: modaler Dialog, Fokus hinein und beim Schliessen zurück', async ({ page }) => {
  const { knopf, dialog } = await oeffnen(page);
  expect(await dialog.evaluate((d) => d.matches(':modal')), 'modal (showModal)').toBe(true);
  // Fokus auf der Hauptaktion, nicht mehr auf dem Knopf dahinter.
  await expect(dialog.getByRole('button', { name: e.kopieren, exact: true })).toBeFocused();

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(knopf).toBeFocused();
});

test('Einbetten: Suchfeld liegt nicht über dem Dialog', async ({ page }) => {
  const { dialog } = await oeffnen(page);
  // Mitte des Suchfelds: Dort muss der abgedunkelte Hintergrund des Dialogs
  // liegen (::backdrop gehört zum dialog-Element), nicht das Suchfeld.
  const suche = await page.getByRole('search').getByRole('searchbox').boundingBox();
  expect(suche, 'Suchfeld vorhanden').not.toBeNull();
  const oben = await page.evaluate(
    ({ x, y }) => document.elementFromPoint(x, y)?.closest('dialog') != null,
    { x: suche!.x + suche!.width / 2, y: suche!.y + suche!.height / 2 },
  );
  expect(oben, 'Element über dem Suchfeld gehört zum Dialog').toBe(true);
  await expect(dialog).toBeVisible();
});

test('Einbetten: schliesst per Hintergrund und per Knopf, nicht beim Markieren', async ({ page }) => {
  const { knopf, dialog } = await oeffnen(page);

  // Im Codefeld markieren und ausserhalb loslassen: Der Dialog bleibt offen.
  const feld = await dialog.getByRole('textbox', { name: e.codeLabel, exact: true }).boundingBox();
  await page.mouse.move(feld!.x + 10, feld!.y + 10);
  await page.mouse.down();
  await page.mouse.move(5, 5);
  await page.mouse.up();
  await expect(dialog).toBeVisible();

  // Klick auf den Hintergrund (Ecke oben links, ausserhalb des Panels).
  await page.mouse.click(5, 5);
  await expect(dialog).toBeHidden();

  await knopf.click();
  await expect(dialog).toBeVisible();
  // Zwei Knöpfe heissen «Schliessen»: das X oben und der Knopf unten.
  const schliessen = dialog.getByRole('button', { name: e.schliessen, exact: true });
  await expect(schliessen).toHaveCount(2);
  await schliessen.last().click();
  await expect(dialog).toBeHidden();
  await expect(knopf).toBeFocused();
});

test('Einbetten: Code kommt in die Zwischenablage und wird angesagt', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const { dialog } = await oeffnen(page);
  const code = await dialog.getByRole('textbox', { name: e.codeLabel, exact: true }).inputValue();
  expect(code).toContain('<iframe');
  expect(code).toContain('/de/embed/steuerfranken"');

  await dialog.getByRole('button', { name: e.kopieren, exact: true }).click();
  await expect(dialog.getByRole('status')).toHaveText(e.kopiert);
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(code);
});

test('Einbetten: ohne Zwischenablage markiert und sagt es, statt «kopiert» zu melden', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: () => Promise.reject(new Error('kein Zugriff')) },
    });
  });
  const { dialog } = await oeffnen(page);
  await dialog.getByRole('button', { name: e.kopieren, exact: true }).click();
  await expect(dialog.getByRole('status')).toHaveText(e.kopierenFehler);
  const feld = dialog.getByRole('textbox', { name: e.codeLabel, exact: true });
  await expect(feld).toBeFocused();
  const markiert = await feld.evaluate((t: HTMLTextAreaElement) => [t.selectionStart, t.selectionEnd, t.value.length]);
  expect(markiert, 'ganzer Code markiert').toEqual([0, markiert[2], markiert[2]]);
});
