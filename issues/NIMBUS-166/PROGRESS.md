# Region Switcher

- **Date:** 2026-08-31
- **Type:** Story
- **Tracker:** JIRA — https://alphasolutionsdk.atlassian.net/browse/NIMBUS-166
- **Priority:** Medium
- **Project Folder:** issues/NIMBUS-166/
- **Updated by:** scoper workflow (run inline in main session)
- **Outcome:** Scope approved by user; Jira description synced. Implementation planning is the next stage.
- **Handover to:** implementation-planner agent
- **Handover prompt:** Read `issues/NIMBUS-166/SCOPE.md` (approved) and plan a site-wide header region switcher (redirects to the selected region's homepage), kept distinct from the existing checkout/account country-select. Depends on NIMBUS-164's country/language list.

- **Date:** 2026-08-31
- **Updated by:** implementation-planner agent
- **Outcome:** Implementation plan is ready; implementation is the next stage. Depends on NIMBUS-164 Task 01 for language labels; does not hard-block on NIMBUS-163/165.
- **Handover to:** implementor agent
- **Handover prompt:** Implement `issues/NIMBUS-166/manifest.md`'s 2 tasks (01 region switcher component reusing the existing `NativeSelect` primitive, 02 mobile layout & country-select conflict check) per their implementation files in the same folder.

- **Date:** 2026-09-01
- **Updated by:** implementor agent
- **Branch / worktree:** `feature/NIMBUS-166` (created from `develop` @ `8435da0`), worked in
  `D:\projects\Nimbus\nimbusnordic-medusab2b\.claude\worktrees\agent-a97b0fa6f318e54d8`. Changes
  are unstaged/uncommitted, left for review as instructed.
- **Outcome:** Both tasks (01 and 02) implemented and verified with `pnpm test` (full suite),
  `pnpm lint` (`next lint`), and `tsc --noEmit`. Manual dev-server verification is outstanding (no
  backend available in this environment) — see below.

## What was implemented

- **New:** `apps/storefront/src/modules/layout/components/region-switcher/index.tsx` — a client
  component `RegionSwitcher` built on the existing `NativeSelect` primitive (default export,
  confirmed via `NativeSelectProps` before use — the plan's skeleton incorrectly assumed a named
  export `{ NativeSelect }`; fixed to `import NativeSelect from "..."`, matching how
  `CountrySelect` already imports it). Selecting a region does a full `window.location.href =
  "/{countryCode}"` navigation (not `router.push`) so `middleware.ts` re-runs; re-selecting the
  active region is a no-op. Options render as `"{countryName} ({locale})"` using
  `getLocaleForCountry` from NIMBUS-164's `country-language-map.ts`.
- **Modified:** `apps/storefront/src/modules/layout/templates/nav/index.tsx` — `NavigationHeader`
  (still a Server Component, confirmed) now also awaits `listRegions()`, flattens
  `region.countries` into `{countryCode, countryName}` options, and renders `<RegionSwitcher
  options={regionOptions} />` as the first item in the header's right-side control cluster,
  **always visible** (not behind the `hidden small:*` breakpoint classes the search box/nav links
  use) — this satisfies the "usable on mobile" requirement without inventing new mobile-menu
  infrastructure, per Task 02's guidance to prefer minimal adjustments. No existing mobile
  drawer/hamburger component exists in this header (confirmed by exploration), so there was
  nothing to integrate into; `RegionSwitcher` was given a `max-w-[10rem] small:max-w-none` bound
  so it can't blow out the header at narrow widths.
- **Message catalogs:** added `Layout.regionSwitcher.label` ("Select your region") to all 8 locale
  files (`da/de/en/fr/it/no/pl/sv.json`). **Deviation from the plan's fallback note:** the plan's
  Task 01 said to use a hardcoded/TODO-commented `aria-label` only if NIMBUS-163/165 hadn't landed
  — they have (confirmed: `nav/index.tsx` already uses `getTranslations("Layout.nav")` from
  NIMBUS-165), so `RegionSwitcher` uses `useTranslations("Layout.regionSwitcher")` directly, no
  fallback/TODO needed. Note: all 8 locale catalogs currently hold identical **English** text for
  every key (verified — e.g. `Common.welcome` is `"Welcome"` in every locale file, not yet
  machine-translated), since NIMBUS-167's DeepL translation pass hasn't run against the catalogs
  yet. The new key follows that same existing convention (English placeholder in all 8 files) for
  consistency — it will pick up a real translation whenever that MT pass runs, same as every other
  key.
- **Tests:**
  - `apps/storefront/src/__tests__/modules/layout/components/region-switcher/index.test.tsx`
    (new) — covers Task 01's TC-1 through TC-4 (all 8 regions with language shown, redirect on
    select, no-op on re-selecting active region, distinct DOM/`aria-label` from the checkout
    `CountrySelect`), plus Task 02's TC-1 (not opted out of mobile visibility via the app's
    `hidden small:*` convention — see caveat below) and TC-2 (its `max-w-[10rem]` class doesn't
    leak onto the checkout `CountrySelect`'s markup when both are rendered together).
  - `apps/storefront/src/__tests__/modules/layout/templates/nav/index.test.tsx` (modified) — added
    a `jest.mock("@/lib/data/regions", ...)` and stubbed `RegionSwitcher` (same pattern already
    used for `MegaMenuWrapper`/`AccountButton`/etc.) so this test stays focused on `NavigationHeader`'s
    own extracted strings, unaffected by the new region fetch.

## Deviations from the plan

1. **`nav/index.tsx` skeleton was stale** — the plan's Task 01 code skeleton for this file predated
   NIMBUS-165's string-extraction work. The current file already imports `getTranslations` from
   `next-intl/server` and uses `t("brandName")` etc.; I integrated `listRegions()` and
   `<RegionSwitcher>` into that current structure rather than the plan's excerpt.
2. **`NativeSelect` import fix** — plan skeleton used a named import; actual component is a
   `forwardRef` default export. Fixed in the real implementation.
3. **No TODO/hardcoded-label fallback** — added real (English, for now) catalog keys directly to
   all 8 locales instead, per the task brief's instruction that NIMBUS-163/165 having landed makes
   the fallback unnecessary.
4. **Placement**: put `RegionSwitcher` always-visible in the header's right-side cluster (not
   inside a mobile drawer) since none exists in this header — a larger mobile-nav rework was
   explicitly flagged in Task 02 as out of scope if no existing pattern was found, which is the
   case here.

## Test results

- `pnpm test` (full suite, from `apps/storefront`): **130 suites / 232 tests passed**, including
  the new `region-switcher` suite and the updated `nav` suite.
- `pnpm lint` (`next lint`): no errors; only 2 **pre-existing** warnings in unrelated files
  (`src/lib/context/cart-context.tsx`, `src/modules/cart/components/cart-drawer/index.tsx`,
  both `react-hooks/exhaustive-deps`) — confirmed pre-existing by diffing against `develop`.
- `tsc --noEmit`: no new errors introduced. Confirmed by stashing my changes and re-running against
  `develop` HEAD — the same errors appear (`account-nav.test.tsx`, `company-card-bc-readonly.test.tsx`,
  `profile-card/index.tsx`, `cart-drawer/index.tsx`) both with and without my changes; these are
  pre-existing and out of scope for this story.

## Environment notes (for whoever picks this up)

- This worktree had no `node_modules` installed and no `apps/storefront/.env`. I added a local,
  gitignored `apps/storefront/.env` (copied the required public keys from `.env.template`) so
  `next.config.js`'s `checkEnvVariables()` guard didn't hard-exit the Jest process. This file is
  **not tracked** (already covered by `.gitignore`'s `**/.env`) and needs no cleanup.
- Running `next/jest`'s Jest wrapper directly in this nested worktree
  (`.claude/worktrees/<id>/apps/storefront`) hits a pre-existing Next.js workspace-root
  misdetection bug: Next sees both the outer repo's `pnpm-lock.yaml` and the worktree's own copy,
  picks the outer one as `outputFileTracingRoot`, and that leaks into `next/jest`'s `<rootDir>`
  substitution for `testMatch`, producing a corrupted glob that matches zero files ("No tests
  found"). **Did not** modify `next.config.js`/`jest.config.ts` to work around this (out of scope,
  and risky to change shared config for an infra quirk). Worked around it for verification only by
  invoking `npx jest --testMatch "**/*.test.{ts,tsx}"` (a CLI-supplied `testMatch` bypasses next/jest's
  broken pre-substitution). No repo files were changed for this — it only affects how the test
  runner is invoked in this specific nested-worktree layout; a normal `pnpm test` from a
  non-nested checkout should be unaffected.

## Outstanding / manual verification needed

- **No live Medusa backend was available in this environment**, so I could not start `pnpm dev`
  and manually click through: (a) that all 8 configured regions actually appear (this depends on
  the backend's `/store/regions` data matching NIMBUS-164's 8-country config), (b) that selecting
  a region visually redirects to that region's homepage, and (c) real-browser mobile layout at
  375px/414px widths (jsdom performs no CSS layout, so the Task 02 TC-1 test above is a proxy —
  it only checks the component isn't marked with this app's `hidden` breakpoint-hiding convention,
  not actual pixel rendering). **Recommend a manual pass against a live backend before merging.**
