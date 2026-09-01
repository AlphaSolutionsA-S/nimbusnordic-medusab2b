import { defineConfig, devices } from '@playwright/test';

const LOCALES = [
  { countryCode: 'dk', locale: 'da-DK' },
  { countryCode: 'gb', locale: 'en-GB' },
  { countryCode: 'se', locale: 'sv-SE' },
  { countryCode: 'no', locale: 'nb-NO' },
  { countryCode: 'pl', locale: 'pl-PL' },
  { countryCode: 'it', locale: 'it-IT' },
  { countryCode: 'fr', locale: 'fr-FR' },
  { countryCode: 'de', locale: 'de-DE' },
];

const VIEWPORTS = {
  desktop: devices['Desktop Chrome'],
  // `devices['iPhone 13']` defaults to WebKit; use an Android device so both
  // viewports stay on Chromium, per scope's Chromium-only decision (this
  // story targets text-expansion/layout breaks, not rendering-engine
  // differences).
  mobile: devices['Pixel 5'],
};

export default defineConfig({
  testDir: './e2e/visual',
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: [['html', { outputFolder: 'playwright-report', open: 'never' }]],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:8000',
  },
  webServer: {
    command: 'pnpm dev',
    // A static asset, not a locale route: the locale-redirect middleware
    // issues a self-redirect (e.g. `/no` -> `/no`) until a `_medusa_cache_id`
    // cookie is set, which Playwright's stateless webServer health-check
    // request never acquires, causing it to loop forever chasing redirects.
    // Real specs navigate via a full browser (cookies persist), so this only
    // affects the health check.
    url: 'http://127.0.0.1:8000/favicon.ico',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  // 8 locales x 2 viewports = 16 projects. `countryCode` is not passed through
  // `use` (Playwright's `use` type doesn't support arbitrary custom keys) —
  // specs derive it from `testInfo.project.name` instead (e.g. "dk-desktop" -> "dk").
  projects: LOCALES.flatMap(({ countryCode, locale }) =>
    Object.entries(VIEWPORTS).map(([viewportName, device]) => ({
      name: `${countryCode}-${viewportName}`,
      use: {
        ...device,
        locale,
      },
    }))
  ),
});
