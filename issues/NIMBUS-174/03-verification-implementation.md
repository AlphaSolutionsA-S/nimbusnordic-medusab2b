# Task 03: Verification (automated gates and a manual production-build check) — Implementation Plan

**Status:** TODO
**App:** storefront
**App Root:** apps/storefront
**Task ID:** 03
**Date:** 2026-09-30
**Branch:** feature/NIMBUS-174 (from develop)
**Depends on:** Task 01, Task 02

---

## Project Environment

- **App root:** `apps/storefront`
- **Commands:** `pnpm test`, `npx tsc --noEmit`, `pnpm lint`, `pnpm build` then `pnpm start` (all from `apps/storefront`)
- **Test framework:** Jest (automated part); manual browser check against a running backend (`apps/backend`, `pnpm dev`)

## Solution Design

No code changes. This task confirms the baselines have not grown and that the fix works in a
**production** build. That matters because the root cause is production-only: Next.js replaces thrown
Server Action messages there. Record the results as a dated entry in `issues/NIMBUS-174/PROGRESS.md`.

## Test Cases

### TC-1: Automated gates hold the baselines
- **Given:** Tasks 01 and 02 are done
- **When:** running `pnpm test`, `npx tsc --noEmit` and `pnpm lint` in `apps/storefront`
- **Then:** Jest shows only the 3 baseline failures (`main-layout.test.tsx` x1, `product-tabs/index.test.tsx` x2);
  tsc shows 9 errors, none in `cart.ts`, `promotion-code/index.tsx` or their tests; lint shows only the 2
  `exhaustive-deps` warnings

### TC-2: An invalid code in a production build shows the translated message
- **Given:** `pnpm build && pnpm start`, the backend running, a cart with an item, on `/dk/cart` (Danish) and `/gb/cart`
- **When:** open "Add promotion code", enter `DOESNOTEXIST`, apply
- **Then:** the translated `Checkout.promotionCode.applyErrorMessage` for that locale shows under the field,
  the field still contains `DOESNOTEXIST`, no Next.js error overlay or unhandled rejection appears, and the
  server log has a `[customer-error]` line with context `cart.submit-promotion`

### TC-3: Multiple codes are kept
- **Given:** two valid manual promotion codes exist in the admin (create them if needed, for example `TEST10` and `TEST20`)
- **When:** apply `TEST10`, then `TEST20`
- **Then:** both are listed as applied and the field is empty after each success.
- **When:** remove `TEST10`
- **Then:** `TEST20` is still applied. Removing `TEST20` leaves no manual code, and automatic promotions,
  if any, are still listed.

### TC-4: A failed remove shows the message
- **Given:** a cart with an applied manual code
- **When:** make the remove fail, for example by stopping the backend and clicking remove
- **Then:** the translated message shows in the error area, and there is no unhandled rejection

## Implementation Steps

1. Run the three automated gates and compare them with the baselines.
2. Run the production build and do TC-2..TC-4 in at least `/dk` and `/gb`.
3. Append a dated PROGRESS.md entry with the results. If a manual check cannot be done (for example, no backend
   available), mark it pending in that entry instead of claiming it passed.
