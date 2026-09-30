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
| 01 | Result-returning `submitPromotionForm` (add + remove, full code list, logging) | `01-promotion-server-action-implementation.md` | storefront | None | TODO |
| 02 | Wire `PromotionCode` to the returning action (error area, keep/clear input, remove form) | `02-promotion-code-component-implementation.md` | storefront | 01 | TODO |
| 03 | Verification (automated gates + production-build manual check) | `03-verification-implementation.md` | storefront | 01, 02 | TODO |

## Execution order

Run the tasks sequentially, 01 → 02 → 03, on one branch. The branch compiles after Task 01 alone, because the
component still passes `submitPromotionForm` to `useActionState(..., null)`.
