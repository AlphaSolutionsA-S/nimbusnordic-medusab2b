# Cross-locale QA

- **Date:** 2026-08-31
- **Type:** Story
- **Tracker:** JIRA — https://alphasolutionsdk.atlassian.net/browse/NIMBUS-169
- **Priority:** Medium
- **Project Folder:** issues/NIMBUS-169/
- **Updated by:** scoper workflow (run inline in main session)
- **Outcome:** Scope approved by user; Jira description synced. Implementation planning is the next stage.
- **Handover to:** implementation-planner agent
- **Handover prompt:** Read `issues/NIMBUS-169/SCOPE.md` (approved) and plan setting up automated visual regression testing (greenfield — no existing tool) covering desktop and mobile across all 8 locales for home/PLP/PDP/cart/checkout/account, plus functional checks on the region switcher (NIMBUS-166) and locale-correct links. This is the epic's final verification pass — depends on NIMBUS-163 through NIMBUS-168 being substantially complete.

- **Date:** 2026-08-31
- **Updated by:** implementation-planner agent
- **Outcome:** Implementation plan is ready; implementation is the next stage. Task 01 (Playwright setup) can be dispatched independently/early; Tasks 02–04 need NIMBUS-163–168 substantially complete to test against real translated/localized pages. Task 04 (triage/fix) is scoped as a reactive process, not fixed file edits — see PLAN.md.
- **Handover to:** implementor agent
- **Handover prompt:** Implement `issues/NIMBUS-169/manifest.md`'s 4 tasks in order (01 Playwright setup, 02 baseline screenshots, 03 functional checks, 04 triage/fix layout breaks). Task 04's actual scope depends on what Tasks 02/03 find when run against the fully-localized storefront — treat it as a process to follow, not a pre-specified diff.

- **Date:** 2026-09-01
- **Updated by:** implementor agent
- **Outcome:** Verified the cross-project dependency (NIMBUS-163–168) is substantially complete: `develop` has NIMBUS-166's `RegionSwitcher` (`bb9b55f`), NIMBUS-167's real per-locale translations for all 8 catalogs (`e1655f3`), and NIMBUS-168's hreflang/metadata work merged in. Confirmed against a real Postgres (Docker) + `medusa develop` backend + seeded region data (all 8 target countries present under the "Europe" region) — proceeded with implementation on branch `feature/NIMBUS-169`.
  - **Task 01 (DONE):** Added `@playwright/test`, `apps/storefront/playwright.config.ts` (8 locale x 2 viewport = 16 projects), `test:visual`/`test:visual:update` scripts, a `turbo.json` task, and a smoke spec. Two corrections to the plan's skeleton, both discovered and fixed during implementation:
    - The `webServer` health-check URL was changed from a locale route to `/favicon.ico`: the locale-redirect middleware self-redirects (`/no` -> `/no`) until a `_medusa_cache_id` cookie is set, and Playwright's stateless health-check request never acquires one, looping forever. Root-caused via `DEBUG=pw:webserver` plus a standalone reproduction of Playwright's internal `isURLAvailable` check.
    - The mobile viewport uses the `Pixel 5` device preset instead of the plan's `iPhone 13` — Playwright's iPhone presets default to WebKit, which wasn't installed and contradicts the plan's own Chromium-only decision.
    - TC-1/TC-2 confirmed: smoke spec passes, `playwright test --list` shows 144 tests across 16 projects/9 spec files.
  - **Task 02 (DONE):** Added 6 flow specs (home, PLP, PDP, cart, checkout, account) and committed all 96 baseline screenshots. Findings against the real seeded storefront:
    - This storefront's home route hard-redirects unauthenticated visitors to `/account` (`src/app/[countryCode]/(main)/page.tsx`) — flagging for visibility as a product-level UX decision, not something this QA story should change. No seeded customer/company exists (`initial-data-seed.ts`) to reach the authenticated home/account dashboard or an authenticated checkout, so the home/account baselines capture the real anonymous-visitor state (login page), and checkout captures the guest-checkout state the app renders directly (with a sign-in prompt) rather than hard-redirecting.
    - Initial baseline run under `pnpm dev` produced 35/96 failures — real (non-flaky) 30s navigation timeouts on cart/checkout, root-caused to `next dev`'s on-demand route compilation becoming a bottleneck under the 16-project parallel matrix. Switched the `webServer` to a production `pnpm build && pnpm start`; re-ran cleanly at 89/96, then 96/96 after fixing a genuine test bug (a Suspense fallback/resolved-content race on the product page occasionally left two `add-product-button` elements in the DOM — added a `toHaveCount(1)` wait).
    - TC-2 (immediate re-run, zero diffs) needed one more fix: Next.js `<Image>` lazy-loading meant `fullPage` screenshots could be taken mid-image-load; added `e2e/visual/utils.ts`'s `waitForImagesToLoad()` (forces `loading=eager` then waits for completion, skipping CSS-hidden images). After that fix, full-suite reruns showed only 1-2/96 transient failures under full (8-way) parallelism, each confirmed to pass cleanly in isolation — capped `workers: 4` and added `retries: 1` in config to absorb this without masking real regressions. Final confirmation run: 96/96 passed.
    - TC-3 (deliberate regression detection) verified manually: widened the login form's `max-w-sm` to `max-w-4xl`, confirmed all 8 desktop-locale home+account specs failed (16 failures), then reverted — confirmed clean (`git diff` empty) and 32/32 passing again.
    - `pnpm lint` (storefront): clean, only 2 pre-existing unrelated warnings. `pnpm test` (Jest): 134/134 suites, 244/244 tests pass — no regressions.
    - Flagging per Task 02's own Risk note: the 96 committed PNGs add ~16.5MB to the repo — acceptable for a one-time baseline per the plan, revisit (e.g. Git LFS) if re-baselining grows this significantly over time.
  - **Validation commands:** `npx playwright test --list` (Task 01); `npx playwright test <6 flow specs>` and `--update-snapshots` variants, `pnpm lint`, `pnpm test` (Task 02) — all from `apps/storefront`.
- **Handover to:** implementor agent (continuing in the same session)
- **Handover prompt:** Proceed to Task 03 (functional checks: region switcher, locale-correct links) and Task 04 (reactive triage/fix, per PLAN.md's process — not a fixed diff).
