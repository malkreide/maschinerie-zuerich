import { defineConfig, devices } from '@playwright/test';

// E2E-/Accessibility-Tests. Bewusst getrennt vom App-Typecheck (tsconfig
// excludet tests/) — Playwright transpiliert die Specs selbst.
//
// Der Webserver ist die PRODUKTIONS-Variante (next start), damit die Tests
// gegen denselben Build laufen wie Vercel. Voraussetzung: vorher `npm run
// build`. In CI übernimmt das ein eigener Schritt; lokal startet Playwright
// den Server selbst, wenn nicht schon einer läuft.
const PORT = 3100;

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: `npm run start -- --port ${PORT}`,
    url: `http://localhost:${PORT}/de`,
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
  },
});
