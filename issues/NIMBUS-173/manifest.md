# Implementation Manifest: Multi-lingual storefront: remaining English text not translated

**Project ID:** NIMBUS-173
**Date:** 2026-09-29
**Ready for Dispatch:** true

> Approved by Klaus Petersen on 2026-09-29: the plan (`PLAN.md`) and the home page meta description
> copy in all 8 locales, as drafted in Task 02.

## Branch

`feature/NIMBUS-173` (from `develop`)

## Tasks

| # | Title | File | App | Depends On | Status |
|---|-------|------|-----|------------|--------|
| 01 | Locale-aware price and date formatting (helper, required `convertToLocale` locale, replace en-GB/en-US) | `01-locale-aware-formatting-implementation.md` | storefront | None | DONE |
| 02 | Translated page metadata (`generateMetadata`, `Metadata` namespace, segment + root not-found) | `02-page-metadata-implementation.md` | storefront | None (logical); run after 01 | DONE |
| 03 | Remaining hardcoded UI text, catalog value fixes, bctest removal | `03-ui-text-catalog-fixes-bctest-removal-implementation.md` | storefront | 01, 02 | DONE |
| 04 | Translated customer-facing errors (error codes, generic fallback + logging, zod messages) | `04-customer-facing-errors-implementation.md` | storefront | 01, 03 | DONE |
| 05 | `react/jsx-no-literals` warn-level lint guard | `05-jsx-no-literals-lint-guard-implementation.md` | storefront | 02, 03, 04 | DONE |
| 06 | Verification (automated gates + manual /dk, /de, /gb) | `06-verification-implementation.md` | storefront | 01–05 | PARTIAL (manual checks pending) |

## Execution order and parallelism

Run the tasks **sequentially 01 → 06 on one branch**. Task 01 and Task 02 are logically independent: they
share no source file, and Task 01 changes no catalog. They could run in parallel in separate worktrees, but
every later task edits `messages/*.json`, and 03/04 edit files that 01 also touches (`payment-details`,
`product-preview`, `shipping`, `promotion-code`, `quote-details`, `payment`). So parallel runs only create
merge work. Task 05 is a one-file config change and can be written at any time, but its "0 warnings"
acceptance check needs 02–04.

## Items needing user input

- **Home page meta description (8 locales)**: draft copy in Task 02, "Catalog changes". Needs approval or
  replacement text.
- **Plan approval (Step 8)**: see `PLAN.md`.

## Baselines (develop @ e913d55)

- Jest: 140 suites, 3 failing tests (`main-layout.test.tsx`, `product-tabs/index.test.tsx`), pre-existing
- `tsc --noEmit`: 10 errors, pre-existing (the build ignores TS errors via `next.config.js`)
- `pnpm lint`: 0 errors, 2 `react-hooks/exhaustive-deps` warnings, pre-existing
