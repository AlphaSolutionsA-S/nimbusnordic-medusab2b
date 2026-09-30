# Checkout: no error message when a promotion code fails

- **Date:** 2026-09-30
- **Status:** Scoped (draft — pending user approval of this document)
- **Type:** Bug
- **Tracker:** JIRA — https://alphasolutionsdk.atlassian.net/browse/NIMBUS-174 (Relates NIMBUS-173, no parent epic)
- **Priority:** Medium
- **Project Folder:** issues/NIMBUS-174/
- **Size:** S
- **Area:** Storefront — cart page promotion-code form
- **Base Branch:** develop (includes NIMBUS-173, `3cb6ef3`)
- **Requested by:** Klaus Petersen
- **Requested at:** 2026-09-29T00:00:00Z

## Background

When a customer applies a promotion code on the cart page and it can't be applied (for example the
code is invalid), no error is shown. The error goes unhandled and the customer gets no feedback.
Removing a code has the same gap. As a result, the translated `applyErrorMessage` added in
NIMBUS-173 can never appear.

In production, Next.js replaces the message of errors *thrown* from Server Actions (NIMBUS-173
PLAN.md), so the UI can only get a reliable result from a value that a Server Action *returns*.

The same handlers also build the wrong list of codes. Adding a code drops the codes already applied,
and removing one code clears every manual code. Medusa 2.21.0 replaces the cart's whole code list
on each update (see Evidence).

## Decisions

These are the user's answers to the Step 1 questions, relayed by the main session on 2026-09-30.

1. **The code-list defect is in scope.** Adding a code sends the existing codes plus the new one.
   Removing a code sends the existing codes minus the removed one. `submitPromotionForm` must stop
   sending only `[code]`.
2. **One message for every failure.** Every failure, including cart-not-found, shows the generic
   translated `Checkout.promotionCode.applyErrorMessage`. `CART_NOT_FOUND` is not mapped to a
   separate message.
3. **A failed remove shows the same message.** It uses the same translated message in the same
   `discount-error-message` area.
4. **The typed code is kept on failure.** When an apply fails, the code field keeps what the
   customer typed. It is cleared only when the apply succeeds.
5. **Stated defaults, not objected to:** priority Medium, base branch `develop`, requested by Klaus
   Petersen, size S.

## Verified against `develop`

- `promotion-code/index.tsx:63`: `useActionState(submitPromotionForm, null)`. Its `formAction`
  is never used, so `message` is always `null`.
- `promotion-code/index.tsx:69`: the form submits to the local `addPromotionCode`, which calls
  `applyPromotions` (line 56) with no error handling.
- `promotion-code/index.tsx:36-44`: `removePromotionCode` has no error handling, has the inverted
  filter (line 42) and ignores `validPromotions`. The remove button's `onClick` neither awaits nor
  catches the call.
- `promotion-code/index.tsx:51-53`: the add path has the same inverted filter, `p.code === undefined`.
- `lib/data/cart.ts:313-327`: `applyPromotions` throws `CART_NOT_FOUND_ERROR` or re-throws via
  `medusaError`.
- `lib/data/cart.ts:372-386`: `submitPromotionForm` catches the error and returns a message, but
  sends only `[code]`.
- `__tests__/modules/checkout/components/promotion-code/index.test.tsx`: TC-6 fakes the
  `useActionState` return value because that state can't be reached through the UI.

## Evidence: Medusa `promo_codes` semantics (installed 2.21.0)

Sending `promo_codes` to `POST /store/carts/:id` **replaces** the cart's manual codes. It does not
merge them. All paths below are under `apps/backend/node_modules/@medusajs/`:

- `medusa/dist/api/store/carts/[id]/route.js`: `POST` runs `updateCartWorkflow` with the
  validated body.
- `medusa/dist/api/store/carts/validators.js:22`: `promo_codes: z.array(z.string()).optional()`.
- `core-flows/dist/cart/workflows/update-cart.js:268`: forwards `promo_codes` to
  `refreshCartItemsWorkflow`.
- `core-flows/dist/cart/workflows/refresh-cart-items.js:158-172`: when `promo_codes` is defined,
  it is used as-is, with `action: PromotionActions.REPLACE`.
- `core-flows/dist/cart/steps/get-promotion-codes-to-apply.js:45-67`: `REPLACE` clears the
  current codes and adds only the codes sent. An unknown code throws
  `The promotion code X is invalid` (`INVALID_DATA`).

What this means for the current code:

- **Add** sends `[newCode]`, so existing manual codes are dropped.
- **Remove** sends `[]`, so every manual code is cleared.
- Automatic promotions are recalculated separately and are not affected.

## Requirements

### Functional
- Applying a code goes through a Server Action that returns a result instead of throwing, used
  via `useActionState` or an equivalent.
- If the apply fails, the translated `applyErrorMessage` shows under
  `data-testid="discount-error-message"`, and the field keeps the typed code.
- If the apply succeeds, no error shows and the field is cleared.
- Removing a code also goes through a Server Action that returns a result. If it fails, the same
  translated message shows in the same area.
- Apply sends the currently applied codes plus the new code.
- Remove sends the currently applied codes minus the removed code, so other codes stay applied.
- The raw backend or Next.js message never reaches the customer.

### Non-Functional
- Failures are logged for diagnostics with the existing `[customer-error]` convention
  (`logCustomerError` / context `cart.submit-promotion`, plus a remove context). The log holds the
  message only, with no form data or PII.
- Follow the NIMBUS-173 customer-error approach. No new translation keys are needed.

## Affected Apps

- **storefront**: the promotion-code component and the promotion Server Action(s) in the cart
  data layer, plus their tests.
- **backend**: no changes.

## Proposed Structure

1. Rework the promotion Server Action(s) so that add and remove both return a result and send the
   full intended list of codes.
2. Wire the component to the returning action(s): error display, keeping or clearing the input,
   and remove error handling.
3. Tests, listed below.

## Test Cases

- An invalid code submitted through the real form shows the translated message, not the raw text.
  This replaces the TC-6 test that fakes `useActionState`.
- On a failed apply the field keeps the typed code. On success it is cleared and no error shows.
- Adding a second code sends both the existing and the new code.
- Removing one of several codes sends the remaining codes.
- Removing the only manual code sends `[]`.
- A failed remove shows the translated message in `discount-error-message`.
- Cart-not-found shows the same generic translated message.
- Unit tests for the Server Action(s): success, Medusa error, and cart not found. The action
  returns a value and does not throw.

## Out of Scope

- Backend changes.
- New translation keys, and mapping `CART_NOT_FOUND` to a specific message.
- Gift cards.
- Changes to how applied promotions are displayed.
- The checkout-page view, where the form is hidden.

## Open Questions

- None. The decisions are recorded above. The user still needs to approve this document.

## Dependencies

- NIMBUS-173 (merged into `develop`), which supplies `applyErrorMessage`, `customer-error.ts` and
  `use-customer-error-message.ts`.
