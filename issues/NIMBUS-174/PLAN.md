# NIMBUS-174: Checkout: no error message when a promotion code fails

**Issue:** https://alphasolutionsdk.atlassian.net/browse/NIMBUS-174

## Objective
Adding or removing a promotion code on the cart page runs through a Server Action that returns a result. Every
failure shows the translated `applyErrorMessage`, and the cart keeps all the other manual codes.

## Analysis
Checked against `develop` @ `4432cb4`, which includes NIMBUS-173. All findings in SCOPE.md hold:

- `promotion-code/index.tsx` never uses the `formAction` from `useActionState(submitPromotionForm, null)`.
  The form submits to a local `addPromotionCode` that calls the throwing `applyPromotions` without a
  try/catch. Remove is called from `onClick` without being awaited, and ignores its filtered list. Both
  handlers use the inverted filter `p.code === undefined`.
- `submitPromotionForm` (`cart.ts:372`) sends only `[code]`, returns the **raw** message, and logs with a
  hand-written `console.error("[customer-error]", ...)` instead of `logCustomerError`.
- Medusa 2.21.0 `promo_codes` replaces the list (`refresh-cart-items.js` REPLACE,
  `get-promotion-codes-to-apply.js`). Without `promo_codes`, Medusa itself re-sends every current code, so
  the list must be complete. Only manual codes are sent (`!is_automatic && code`); Medusa recalculates the
  automatic ones.
- **Callers:** `applyPromotions` is used only by `promotion-code/index.tsx` and by `cart.test.ts` (TC-8).
  `submitPromotionForm` is used only by `promotion-code/index.tsx`. `PromotionCode` is rendered by
  `cart/templates/summary.tsx` and `checkout/templates/checkout-summary/index.tsx` with `cart` only. Its
  props do not change, so neither caller is affected. `applyPromotions` keeps its signature.
- **React 19.0.5** resets uncontrolled form fields after every form action, whether it succeeded or not. So
  "keep the typed code on failure" needs a controlled input.
- When the cart is pending approval, the add form is not rendered but the remove buttons are. So a remove
  error needs a place to show that does not depend on the add form.
- Baselines re-verified: Jest 3 failures (`main-layout` x1, `product-tabs` x2) out of 350; `tsc --noEmit`
  9 errors; lint 2 `exhaustive-deps` warnings.

## Execution Plan
1. **Task 01:** `submitPromotionForm(currentState: PromotionFormState, formData): Promise<PromotionFormState>`,
   where `PromotionFormState = { success: boolean } | null`.
   - It reads the `applied_code` fields.
   - With `remove_code` it sends the applied codes minus that code. Otherwise it sends the applied codes
     plus `code`, de-duplicated. An empty code is a no-op and returns `null`.
   - It calls `applyPromotions` in a try/catch and never throws or returns the raw message.
   - It logs with `logCustomerError`, context `cart.submit-promotion` or `cart.remove-promotion`.
   - Unit tests cover add, remove, remove-last (`[]`), de-duplication, a Medusa error, cart-not-found, and an
     empty code.
2. **Task 02:** in `PromotionCode`:
   - One `useActionState` over a thin client wrapper that clears the input on a successful add. The add form
     and every remove form (now a `type="submit"` button) share its `formAction`.
   - Hidden `applied_code` inputs for the manual codes, and a controlled input.
   - One `discount-error-message`: under the input when the add form is open, otherwise above the
     applied-promotions list.
   - Replace the TC-6 `useActionState` stub with real form-submit tests.
3. **Task 03:** automated gates against the baselines, and a manual check on a production build
   (`/dk`, `/gb`): invalid code, multiple codes, remove, failed remove.

## Decisions & Trade-offs
- **One Server Action for add and remove.** They share one `useActionState`, so the error shown always
  belongs to the latest action, and there is only one error state. The alternative was two actions with two
  states that could contradict each other.
- **The client sends the applied manual codes as hidden fields**, and the server builds the list. The server
  does not re-fetch the cart, which saves a round-trip and keeps the tests simple. Trusting the client list
  is not a security issue: the Store API already accepts any `promo_codes` from the customer, and Medusa
  validates every code.
- **Result carries no message** (`{ success: boolean }`). All failures show the same translated text
  (Decision 2), so nothing raw is sent to the browser.
- **Controlled input.** This works around React 19's automatic form reset. If the tests show that the reset
  still clears it, Task 02 has a documented fallback (`onSubmit` + `startTransition`).
- **`applyPromotions` is left unchanged** (it still throws), because other code and TC-8 rely on it. Only the
  Server Action boundary changes.
- **Visible change:** the remove button is hidden for a manual promotion without a code. Before, the button
  did nothing in that case.
- **Deviation from the SCOPE.md wording:** the scope says remove "goes through a Server Action". It goes
  through the same `submitPromotionForm` rather than a separate remove action. The logging still uses a
  separate remove context (`cart.remove-promotion`), as the scope asks.

## Verification
- [ ] Task 01 unit tests:
  - add sends `[existing, new]`, and the first code sends `[new]`;
  - a duplicate code is not sent twice;
  - remove one of two sends `[remaining]`, and remove the only code sends `[]`;
  - a Medusa error and cart-not-found both resolve `{ success: false }` without throwing, and log
    `[customer-error]` with the right context;
  - an empty code sends nothing.
- [ ] Task 02 component tests, through the real form:
  - an invalid code shows the translated text, not the raw text, and keeps the typed code;
  - success clears the field with no error;
  - add sends the applied manual codes but no automatic codes;
  - remove sends `applied_code` plus `remove_code`;
  - a failed remove shows the message in exactly one `discount-error-message`, including on a cart pending
    approval.
- [ ] `pnpm test`: only the 3 baseline failures. `tsc --noEmit`: 9. Lint: 2 warnings.
- [ ] Manual check on a production build in `/dk` and `/gb`: the translated message, the field kept on
  failure, both codes applied, remove keeps the other code, and a failed remove shows the message.
