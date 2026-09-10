# NIMBUS-169: Cross-locale QA

**Issue:** https://alphasolutionsdk.atlassian.net/browse/NIMBUS-169

## Objective
Stand up automated visual regression testing across all 8 locales and both viewports for the
storefront's key flows, catching text-expansion layout breaks before launch, alongside functional
checks for locale-correct links and the region switcher.

## Analysis
- Greenfield: no Playwright/Percy/Chromatic/BackstopJS/Cypress dependency exists anywhere in this
  monorepo today, and no `test:e2e`/`test:visual` turbo task exists — this is new infrastructure,
  not an extension of anything.
- Playwright's built-in `toHaveScreenshot()` was chosen (per scope.md's own suggestion) since it
  needs no external visual-diffing service, fits a project matrix (8 locales × 2 viewports = 16
  Playwright "projects") cleanly, and keeps everything self-contained in the repo.
- This suite **requires a live, seeded Medusa backend** to render real pages — unlike the existing
  Jest unit tests, it cannot run in isolation. This is called out as an operational dependency, not
  something the Playwright config itself can solve.
- Task 04 (triage/fix) is explicitly reactive — its actual scope depends on what real screenshot
  diffs surface once run against the fully-localized storefront, so it's planned as a process with
  guardrails (don't "fix" overflow by shortening translations; don't silently mark things green by
  skipping tests) rather than a fixed list of file edits.

## Execution Plan
1. **Task 01:** install Playwright, add `playwright.config.ts` with an 8-locale × 2-viewport
   project matrix, wire up `pnpm test:visual` and a `turbo.json` task.
2. **Task 02:** write 6 flow specs (home, PLP, PDP, cart, checkout, account) and generate/commit
   baseline screenshots.
3. **Task 03:** add functional specs — internal links preserve locale; region switcher (NIMBUS-166)
   works from every starting locale.
4. **Task 04:** run the full suite against the real localized storefront, triage failures into
   genuine layout breaks (fix via CSS) vs. accepted rendering differences (update baseline),
   iterate to green.

## Decisions & Trade-offs
- Chromium-only browser coverage initially — scope is about text-expansion/layout, not
  cross-browser rendering engine differences; expand only if the team asks.
- Functional specs live alongside visual specs in the same Playwright suite/config rather than a
  separate framework, per scope.md's "alongside visual checks" wording.
- If the region switcher's accessible label is itself translated per NIMBUS-165 (likely), tests
  use a `data-testid` rather than a translated-string-dependent `getByLabel` lookup — a
  locale-independent selector is the correct fix, not per-locale hardcoded label strings in tests.

## Verification
- [ ] 16 Playwright projects (8 locales × 2 viewports) are discoverable and a smoke spec passes
      (TC-1/TC-2, Task 01).
- [ ] All 96 baseline screenshots (6 flows × 16 projects) generate cleanly and are non-flaky on
      immediate re-run (TC-1/TC-2, Task 02).
- [ ] Internal links preserve the active locale segment; region switcher navigates correctly from
      every starting locale (TC-1/TC-2, Task 03).
- [ ] Full suite is green against the real localized storefront, or remaining failures are
      explicitly documented as accepted (not silently skipped) (TC-1, Task 04).
- [ ] No layout fix altered translated content to mask an overflow issue (TC-2, Task 04).
- [ ] `pnpm lint`, `pnpm build` pass.
