# Checkout: no error message when a promotion code fails

- **Tracker:** JIRA — https://alphasolutionsdk.atlassian.net/browse/NIMBUS-174 (relates to NIMBUS-173)
- **Severity:** Major
- **Area:** Storefront — cart/checkout promotion code (`apps/storefront/src/modules/checkout/components/promotion-code/index.tsx`)
- **Reported by:** Klaus Petersen (found during NIMBUS-173 implementation)
- **Reported at:** 2026-09-29T00:00:00Z

## Summary

When a customer enters a promotion code at checkout and it can't be applied (for example it is
invalid or expired), no error message is shown. The error handling behind the field is not
connected, so the failure is never caught and the customer gets no feedback. Removing a code has
the same gap. The problem exists on `develop` and predates NIMBUS-173. It means the translated
`applyErrorMessage` that NIMBUS-173 added can never appear.

## Steps to reproduce

1. Add an item to the cart and open the cart page, where the promotion field is shown when not in
   checkout and the cart is not pending approval.
2. Open "Add promotion code", enter a non-existent code such as `DOESNOTEXIST`, and apply it.
3. Observe that no error message is shown under the field. The Server Action's rejection goes
   unhandled (it may appear in the browser console or Next.js error overlay in dev).

## Expected

A translated error message appears under the field (`data-testid="discount-error-message"`), and
the code field keeps the customer's input so they can correct it.

## Actual

No message is shown, and the rejection from `applyPromotions` is not caught.

## Environment

- OS / browser: any
- Build / commit: `develop` @ `e913d55` (still present on `feature/NIMBUS-173`)
- Tenant / data context: any cart, any locale

## Evidence

Code on `develop`:

- `promotion-code/index.tsx:63` — `const [message, formAction] = useActionState(submitPromotionForm, null)`.
  `formAction` is **never used**, so `message` is always `null`.
- `promotion-code/index.tsx:69` — `<form action={(a) => addPromotionCode(a)}>` submits to the local
  `addPromotionCode`, which calls `await applyPromotions(codes)` (line 56) with **no try/catch**.
- `promotion-code/index.tsx:35-43` — `removePromotionCode` also calls `applyPromotions` without
  error handling.
- `lib/data/cart.ts:313-327` — `applyPromotions` throws "No existing cart found" or rethrows via
  `.catch(medusaError)`. Only `submitPromotionForm` (`cart.ts:372-385`) catches the error and
  returns a message, and the form never calls it.
- In production, Next.js replaces the message of errors thrown from Server Actions (see
  NIMBUS-173 PLAN.md), so a returned value is the only reliable way to get a message to the UI.

## Related defect found in the same component (confirm during scoping)

Both handlers build the list of codes to keep with
`promotions.filter((p) => p.code === undefined).map((p) => p.code!)` (lines 41 and 51-53). This
keeps only promotions that have **no** code, so:

- **Adding** a code sends only the new code, and any codes already applied are dropped.
- **Removing** a code sends a list of `undefined` values, which in effect removes all codes.

The filter looks inverted (it should keep promotions that have a code), and `removePromotionCode`
ignores its filtered `validPromotions`. Check this against Medusa's `promo_codes` semantics
(whether `updateCart({ promo_codes })` replaces or merges) before fixing.

## Analysis

*(Leave empty initially. Fill in `ANALYSIS.md` when investigation starts and link from here.)*
