# Implementation Manifest: Checkout: no error message when a promotion code fails

**Project ID:** NIMBUS-174
**Date:** 2026-09-30
**Ready for Dispatch:** true

> Plan (`PLAN.md`), including its deviations from SCOPE.md, approved by Klaus Petersen on 2026-09-30.

## Branch

`feature/NIMBUS-174` (from `develop`)

## Tasks

| # | Title | File | App | Depends On | Status |
|---|-------|------|-----|------------|--------|
| 01 | Result-returning `submitPromotionForm` (add + remove, full code list, logging) | `01-promotion-server-action-implementation.md` | storefront | None | DONE |
| 02 | Wire `PromotionCode` to the returning action (error area, keep/clear input, remove form) | `02-promotion-code-component-implementation.md` | storefront | 01 | TODO |
| 03 | Verification (automated gates + production-build manual check) | `03-verification-implementation.md` | storefront | 01, 02 | TODO |

## Execution order

Run the tasks sequentially, 01 → 02 → 03, on one branch. The branch compiles after Task 01 alone, because the
component still passes `submitPromotionForm` to `useActionState(..., null)`.

## Conventions and commands

Run from the repository root, one command at a time. This session uses
`corepack pnpm` because the standalone `pnpm` command is absent from PATH.

- Scoped tests: `corepack pnpm --filter @b2b-starter/storefront test -- <path> --runInBand`
- Full tests: `corepack pnpm --filter @b2b-starter/storefront test -- --runInBand`
- Lint: `corepack pnpm --filter @b2b-starter/storefront lint`
- Typecheck: `corepack pnpm --filter @b2b-starter/storefront exec tsc --noEmit`
- Build: `corepack pnpm --filter @b2b-starter/storefront build`

Baseline remeasured on 2026-10-23 at `eea3a0184c635a4b373e0e60f152b4a09c1c771d`:
58 existing TypeScript errors. The 2026-09-30 counts in the task files are historical.
Run evidence: `.tmp/NIMBUS-174-20261023-1840/` (ignored, local only).
