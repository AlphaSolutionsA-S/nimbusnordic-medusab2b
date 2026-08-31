# Task 01: Playwright Visual Regression Setup — Implementation Plan

**Status:** TODO
**App:** storefront
**App Root:** apps/storefront
**Task ID:** 01
**Date:** 2026-08-31
**Branch:** feature/NIMBUS-169 (from develop)
**Depends on:** NIMBUS-163–168 substantially complete (this story verifies their combined output)

---

## Project Environment

- **App root:** `apps/storefront`
- **Build command:** `pnpm build`
- **Lint command:** `pnpm lint`
- **Test command:** new — `cd apps/storefront && pnpm test:visual` (this task creates it)
- **Test framework:** **Playwright** (new dependency — chosen because it has built-in
  screenshot-comparison (`toHaveScreenshot()`), needs no separate visual-diffing service, and no
  existing tool exists in this monorepo to extend, confirmed by exploration: no Playwright/Percy/
  Chromatic/BackstopJS/Cypress dependency anywhere in the repo)
- **Test location:** new `apps/storefront/e2e/visual/` directory — kept separate from
  `src/__tests__/` because Playwright specs are not jsdom-compatible and must not be picked up by
  the existing `jest.config.ts`'s `testMatch: ['<rootDir>/src/**/*.test.{ts,tsx}']` (which
  already excludes `e2e/` by directory, but confirm no overlap)
- **Naming conventions:** kebab-case spec files (`home.visual.spec.ts`), matching Playwright
  convention over the Jest `ComponentName.test.tsx` convention (different tool, different
  convention — do not force Jest naming onto Playwright specs)

## Solution Design

This is greenfield tooling — no existing pattern to extend. Structure:

- `apps/storefront/playwright.config.ts` — defines 8 locale × 2 viewport (desktop/mobile)
  "projects" (Playwright's built-in mechanism for running the same specs under different
  configurations), each with a `baseURL` pointing at a locally-running dev server and a
  `use.locale`/custom fixture carrying the target `countryCode`.
- Uses Playwright's `webServer` config option to boot `pnpm dev` (or a production build via
  `pnpm build && pnpm start`) automatically before running tests, matching how CI would run this
  without requiring a manually-started server — **but this requires a running Medusa backend with
  seeded data** (regions, products) to render real pages; see Risks.
- A new root-level `turbo.json` task `test:visual` (mirroring the existing `test:unit`/
  `test:integration:*` naming pattern) so this suite is invokable the same way as other test tasks.

## Code Skeletons

### New File: `apps/storefront/playwright.config.ts`

```typescript
import { defineConfig, devices } from '@playwright/test'

const LOCALES = [
  { countryCode: 'dk', locale: 'da-DK' },
  { countryCode: 'gb', locale: 'en-GB' },
  { countryCode: 'se', locale: 'sv-SE' },
  { countryCode: 'no', locale: 'nb-NO' },
  { countryCode: 'pl', locale: 'pl-PL' },
  { countryCode: 'it', locale: 'it-IT' },
  { countryCode: 'fr', locale: 'fr-FR' },
  { countryCode: 'de', locale: 'de-DE' },
]

const VIEWPORTS = {
  desktop: devices['Desktop Chrome'],
  mobile: devices['iPhone 13'],
}

export default defineConfig({
  testDir: './e2e/visual',
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: [['html', { outputFolder: 'playwright-report' }]],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',
  },
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: LOCALES.flatMap(({ countryCode, locale }) =>
    Object.entries(VIEWPORTS).map(([viewportName, device]) => ({
      name: `${countryCode}-${viewportName}`,
      use: {
        ...device,
        locale,
        extraHTTPHeaders: {},
        // Custom fixture value consumed by spec files to build locale-aware URLs.
        countryCode,
      },
    }))
  ),
})
```

> **Worker note:** Playwright's `use` object doesn't natively support arbitrary custom keys like
> `countryCode` typed this way — the recommended pattern is a custom fixture
> (`test.extend<{ countryCode: string }>(...)`) rather than smuggling it through `use`. Adjust this
> skeleton to Playwright's actual fixture API (check the installed `@playwright/test` version's
> docs) before finalizing; the `LOCALES`/`VIEWPORTS`/project-matrix structure is the important part
> to preserve, the exact mechanism for passing `countryCode` into each spec may need adjustment.

### New File: `apps/storefront/package.json` (script addition)

```json
{
  "scripts": {
    "test:visual": "playwright test",
    "test:visual:update": "playwright test --update-snapshots"
  }
}
```

### New File: `turbo.json` (task addition, root level)

```json
{
  "tasks": {
    "test:visual": {
      "dependsOn": ["^build"],
      "cache": false
    }
  }
}
```

## Impacted Files

- New: `apps/storefront/playwright.config.ts`.
- `apps/storefront/package.json`: add `@playwright/test` devDependency, add `test:visual` /
  `test:visual:update` scripts.
- Root `turbo.json`: add a `test:visual` task entry (worker must read the current file structure
  first — exploration confirmed tasks like `build`, `test:unit`, `test:integration:*` already
  exist there; match their exact shape).
- New: `apps/storefront/.gitignore` entry for `playwright-report/` and `test-results/` (Playwright's
  default output dirs) if not already covered by an existing ignore pattern.

## Test Cases

Since this is infrastructure setup (no application behavior), verification is operational rather
than unit-testable:

### TC-1: Playwright installs and runs a trivial smoke spec
- **Given:** `@playwright/test` installed and browsers downloaded (`playwright install`)
- **When:** a minimal smoke spec (e.g. `expect(page).toHaveURL(...)` after visiting `/gb`) runs
  via `pnpm test:visual`
- **Then:** it passes with no config errors, confirming the `webServer` boot + project matrix work

### TC-2: All 16 projects (8 locales × 2 viewports) are discoverable
- **Given:** the config above
- **When:** `playwright test --list` runs
- **Then:** it lists 16 distinct projects, one per locale/viewport combination

## Implementation Steps

1. Add `@playwright/test` as a devDependency; run `pnpm install` and `npx playwright install
   --with-deps chromium` (start with Chromium only, per scope's focus on layout/text-overflow
   rather than cross-browser compatibility — expand to other engines only if the team asks).
2. Add `playwright.config.ts`, adjusting the custom-fixture mechanism per the worker note above.
3. Add the `test:visual`/`test:visual:update` npm scripts and the `turbo.json` task.
4. Add `.gitignore` entries for Playwright's output directories.
5. Add a minimal smoke spec under `e2e/visual/` to validate TC-1/TC-2.
6. Document in a short README (`apps/storefront/e2e/visual/README.md`) that this suite requires a
   running Medusa backend with the 8 target regions/countries seeded (per NIMBUS-164) — this is an
   operational prerequisite, not something the Playwright config can provision itself.

## Risks

- **Requires a live backend with real seeded data** to render meaningful pages (products, regions).
  This suite cannot run in true isolation the way the existing Jest unit tests can — document this
  clearly so CI setup (if added later) knows it needs a backend + DB, not just the storefront.
- Running the full 16-project matrix × several page flows (home, PLP, PDP, cart, checkout,
  account) × screenshot comparison will be slow — Task 02 should scope an initial baseline run and
  note actual runtime, flagging to the user if it's impractical for routine CI (vs. a
  scheduled/manual job).
