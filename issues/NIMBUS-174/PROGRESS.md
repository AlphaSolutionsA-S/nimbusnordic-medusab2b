# Checkout: no error message when a promotion code fails

- **Date:** 2026-09-29
- **Type:** Bug
- **Tracker:** JIRA — https://alphasolutionsdk.atlassian.net/browse/NIMBUS-174
- **Priority:** Medium
- **Project Folder:** issues/NIMBUS-174/
- **Updated by:** bug reporting skill
- **Outcome:** Bug captured (linked Relates NIMBUS-173, no parent epic); scoping is the next stage.
- **Handover to:** scoper agent
- **Handover prompt:** Read `issues/NIMBUS-174/BUG.md` and scope the fix for the promotion-code form in `apps/storefront/src/modules/checkout/components/promotion-code/index.tsx`. Work out: (1) how to wire add/remove through a Server Action that *returns* a result (e.g. `useActionState` with `submitPromotionForm`, or equivalent), so failures show the translated `applyErrorMessage` added in NIMBUS-173 instead of going unhandled, given that Next.js replaces thrown Server Action error messages in production; (2) whether the related `p.code === undefined` filter defect (adding drops existing codes, removing clears all) is confirmed against Medusa's `promo_codes` update semantics, and whether it belongs in this bug; (3) the test cases needed (invalid code, removal, multiple codes). Note that NIMBUS-173 (`feature/NIMBUS-173`) also changes this file and its test, so base the fix on it once it is merged. Then write `issues/NIMBUS-174/SCOPE.md` and hand over to implementation-planner.

- **Date:** 2026-09-29
- **Updated by:** main session
- **Outcome:** The user decided to wait: scoping is deferred until NIMBUS-173 (`feature/NIMBUS-173`) is merged into `develop`, because both change `promotion-code/index.tsx` and its test.
- **Handover to:** scoper agent (after the NIMBUS-173 merge)
- **Handover prompt:** Same as above. Start from `develop` after NIMBUS-173 is merged.

- **Date:** 2026-09-30
- **Updated by:** main session
- **Outcome:** NIMBUS-173 is merged into `develop` (`3cb6ef3`), so the wait condition is met. Scoping can start from `develop`.
- **Handover to:** scoper agent
- **Handover prompt:** Same as the first entry. Base the scope on current `develop`.

- **Date:** 2026-09-30
- **Updated by:** scoper agent
- **Outcome:** SCOPE.md written from the user's Step 1 answers (relayed by the main session): code-list defect in scope, one generic translated message for every failure, same message for failed remove, typed code kept on failure. Medusa 2.21.0 `promo_codes` confirmed to REPLACE (evidence in SCOPE.md). Status is draft pending the user's approval of the document; Jira Step 6c is left to the main session.
- **Handover to:** user (approve SCOPE.md), then implementation-planner agent
- **Handover prompt:** Plan the implementation of NIMBUS-174 from the approved `issues/NIMBUS-174/SCOPE.md` (update that scope rather than creating a new one), based on `develop`. Make promotion add and remove in `apps/storefront/src/modules/checkout/components/promotion-code/index.tsx` go through Server Actions that return a result (not throw), since Next.js replaces thrown Server Action messages in production. Show the translated `Checkout.promotionCode.applyErrorMessage` in `discount-error-message` for every failure (including remove and cart-not-found), keep the typed code on failure and clear it on success. Fix the code list: add sends existing codes plus the new one, remove sends existing codes minus the removed one, and `submitPromotionForm` in `apps/storefront/src/lib/data/cart.ts` must stop sending only `[code]` (Medusa 2.21.0 `promo_codes` replaces the list). Reuse the NIMBUS-173 customer-error util/logging. Cover the test cases in SCOPE.md, replacing the TC-6 `useActionState` stub with a real form-submit test. Storefront only; no new translation keys.
