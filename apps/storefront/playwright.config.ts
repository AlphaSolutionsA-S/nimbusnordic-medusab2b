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
  // Task 02 baseline generation showed occasional (1-2 of 96) transient
  // failures under full parallelism on a machine also running the backend +
  // Postgres — each one passed cleanly re-run in isolation, confirming
  // resource contention rather than a real diff. `workers` is capped and a
  // retry is allowed to absorb that without masking genuine regressions
  // (retries don't change what toHaveScreenshot compares against).
  workers: 4,
  retries: 1,
  reporter: [['html', { outputFolder: 'playwright-report', open: 'never' }]],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:8000',
  },
  webServer: {
    // A production build+start, not `pnpm dev`: under the 16-project parallel
    // matrix, `next dev`'s on-demand/single-flight route compilation became a
    // bottleneck (many workers requesting distinct, not-yet-compiled routes
    // at once), causing real (non-flaky) 30s navigation timeouts on the
    // cart/checkout specs during Task 02 baseline generation. A dev server's
    // on-demand compilation is also inherently non-deterministic timing-wise,
    // which is a poor foundation for a pixel-diff baseline suite regardless.
    command: 'pnpm build && pnpm start',
    // A static asset, not a locale route: the locale-redirect middleware
    // issues a self-redirect (e.g. `/no` -> `/no`) until a `_medusa_cache_id`
    // cookie is set, which Playwright's stateless webServer health-check
    // request never acquires, causing it to loop forever chasing redirects.
    // Real specs navigate via a full browser (cookies persist), so this only
    // affects the health check.
    url: 'http://127.0.0.1:8000/favicon.ico',
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
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
