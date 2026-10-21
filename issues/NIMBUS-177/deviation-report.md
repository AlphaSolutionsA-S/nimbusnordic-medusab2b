# Deviation report: Protect company-linked carts from access by cart ID alone

> Record of NIMBUS-177, frozen when the work shipped. Not maintained: the code and docs/architecture/ describe current behaviour.

Branch `feature/NIMBUS-177`, merge-base `e4f7351`, HEAD `5476a92`. Reviewed: the full diff, the plan,
the branch notes, every task file, the fix brief for task 04 (`fix-04-cookie-cart-not-owned.md`) and
the consolidation commit. Installed Medusa 2.21.0 store routes were listed to check guard coverage.
Re-review of 5476a92 (brief `fix-integration-m1-m3.md`): M1–M3 are resolved and nothing new was
introduced.

## Deviations from scope and plan

None of these deviations blocks the branch. There is no migration, no new module and no
hand-written schema change.

- 01: the step is `validate-cart-access` (not the workflow id). Acceptable, and it matches
  `authorize-company-access`.
- 01: an input with both ids or with neither id fails closed with `Cart not found`. Acceptable.
- 01: the decision file exports `hasVerifiedCartAssociation`, so 06 and 07 reuse the predicate.
  Acceptable. This is the one home of the rule.
- 02: the anonymous-create test sends a publishable key. Without one, every store route answers 400
  first. Acceptable.
- 02: the hook's compensation is not tested. `cartCreated` is the last step of `createCartWorkflow`,
  so nothing after it can fail. Acceptable.
- 03: the guard runs after each route's validators, not before every middleware.
  - Core validators always register first on the same matcher.
  - As a result, an anonymous call with an invalid body gets 400 before 401. Validation reads no
    cart, so nothing leaks. Acceptable.
- 03: on `POST .../line-items/bulk` the check runs twice, because the `:line_id` matcher also
  matches `bulk`. Both runs give the same class and the same answer. Acceptable.
- 03: for routes the seeded cart cannot complete, the owner's success is asserted as "reached the
  route", not 200. Acceptable.
- 03: `companies.spec.ts` TC-5 now gives its cart an owner, because the old unowned cart is now
  ambiguous. This was an "Also update" the task did not list. Acceptable.
- 03: the quote HTTP specs still fail on the baseline (unset `JWT_SECRET`). The quote guard is
  therefore covered only by the security spec. Acceptable.
- 04: the sign-in prompt is a toast raised by `CartProvider`, and the product components are
  unchanged. Acceptable.
- 04: `addToCart` and `addToCartBulk` return `{ error: SIGN_IN_REQUIRED }` instead of throwing.
  Acceptable.
- 04: `lookupCart` adds an `error` state, so a transient fault never clears the cookie. Acceptable.
- 04: `getOrSetCart` no longer creates a cart after any failure; it throws instead. Acceptable.
- 04: the main layout no longer reads the customer. Acceptable.
- 04: `transferCart` is deleted. Acceptable.
- 04: the `Layout.cartMismatchBanner` keys are left in `messages/*.json` for the admin to retire.
  Acceptable; see open question 4.
- 04 follow-up fix (79d96c1, decided by Klaus on 2026-10-21): a cookie cart the account can read but
  does not own is dropped at login and replaced on add to cart.
  - The check lives in one helper, `lib/util/active-cart.ts`.
  - `lookupCart` still ignores ownership, so explicit-id reads keep working.
  - This is a scope addition that Klaus decided on. Acceptable, with three mechanical follow-ups
    (M1–M3 below).
- 05: plan section 5 is wrong to say storefront orders get an order–company link from metadata.
  - Core `completeCartWorkflow` never runs `createOrderWorkflow`, so the link is never written for
    storefront orders.
  - The doc states this correctly. The plan is a frozen record, so it stays as written. Acceptable.
- 05: the rollout section adds:
  - deploy the backend and the storefront together;
  - the per-locale import route;
  - retiring the banner key;
  - a five-step after-deploy check.

  Acceptable.
- 05: no separate replayed-ID test is claimed. The refused-stranger matrix covers replay. Acceptable.
- 06: `canAccessOrder` takes no operation, because `read` and `return` share one rule. The workflow
  still takes `operation`, as the seam says. Acceptable.
- 06: the administrator path also requires the source cart's `customer_id` to equal the order owner.
  It judges "owner still a member" on the order owner's employee record. This is stricter than the
  plan. Acceptable.
- 06: the guard reads with `is_draft_order: false`. Acceptable. The transfer check does not; see D2.
- 06: a transfer request for an unknown order answers 404 `Order not found` from our step; core's
  message named the ID. Acceptable.
- 06: the cancel route hard-codes `actor_type: "customer"`, which core's customer-only authentication
  guarantees. Acceptable.
- 06: the new workflow is named `requestTransferableOrderTransferWorkflow`. Acceptable.
- 06: the HTTP matrix seeds its orders through the order module. Only the end-to-end test completes
  a real cart. Acceptable.
- 07: the unreachable "caller has no company" branch now answers `carts_with_approvals: []` instead
  of `approvals: []`. Acceptable.
- 07: the caller is read from `auth_context.actor_id`. Acceptable.
- 07: the `status` filter is narrowed once, with no `any` left in the route. Acceptable.

## Consolidation changes

From commit 7e3985f; it changes no behaviour or seam.

- `workflows/cart/utils/cart-access.ts` now exports `AccessCaller`, `CartWithApprovals` and
  `hasApprovedAdminApproval(cart)`. `workflows/order/utils/order-access.ts` reuses them instead of
  keeping copies.
- Three things were left alone on purpose, and I agree with each:
  - `ensure-cart-access.ts` and `ensure-order-access.ts` look alike, but they run different
    workflows and use different id sources.
  - A three-line employee mapping repeats in `validate-cart-access.ts` and
    `validate-order-access.ts`.
  - The `Layout.cartMismatchBanner` keys stay, as a task 04 deviation.

## Findings

### Mechanical wiring (resolved in 5476a92)

All three are resolved. Worker results: `cart.test.ts` 13 of 13; `src/__tests__/lib` 197 passed,
with only the baseline `money.test.ts` failing; storefront lint passes; storefront typecheck 8
errors, equal to the baseline.

- M1 resolved: the bullet now says ownership is checked at login and before add to cart, and that
  approval pages and the redirect after approving open a colleague's cart through the explicit
  `cartId` query. This matches `active-cart.ts`, `customer.ts` and `approvals.ts`. The approval-card
  link is still D1.
- M2 resolved: `lookupCart` requests `+customer_id`. A new `lookupCart` test asserts the field and
  fails without it.
- M3 resolved: a new `add to cart` case covers an unreadable customer. It asserts `CART_NOT_FOUND`,
  no cart create, no line item, and no `setCartId` or `removeCartId`. The case pins behaviour the
  code already had, so it could not go red first.

Original findings:

- **M1. Doc wording is wrong.** `docs/security-remediation.md:139-144` says the cookie "only ever
  points at a cart the signed-in customer owns".
  - The ownership check runs only at login (`customer.ts`) and in `getOrSetCart`.
  - The cart page, checkout and layout read the cookie cart through `lookupCart` with no ownership
    check.
  - The storefront middleware sets the cookie from `?cart_id=` when there is no `step`.
  - The same bullet's claim that checkout of an approved colleague cart opens "by its ID" holds only
    for the `cartId` query; see D1.
  - Suggested wording: "is checked for ownership at login and before add to cart".
- **M2. Implicit join key in the ownership check.** `apps/storefront/src/lib/util/active-cart.ts:19`
  compares `lookup.cart.customer_id`.
  - `lookupCart` (`lib/data/cart.ts`, `fields`) does not request `customer_id`, and the field is not
    in core's `defaultStoreCartFields`.
  - It arrives only as the join key of the `*customer` expansion. The security spec shows it in a
    default-field response (line 624), but no test pins it for the storefront's field list.
  - If it were absent, every owner's cart would be treated as not owned: dropped at login and
    replaced on every add to cart.
  - Fix: add `+customer_id` to the fields, or compare `lookup.cart.customer?.id`.
- **M3. Untested branch.** `apps/storefront/src/lib/data/cart.ts:108`: no test covers `getOrSetCart`
  throwing `CART_NOT_FOUND` when the cookie cart is found but the customer cannot be read
  (`activeCartLookup` gives `error`).
  - This branch is new in fix 04; the login equivalent is tested.
  - Add one case to `src/__tests__/lib/data/cart.test.ts`: no cart created, no line item, cookie
    kept.

The rest of the wiring checks pass:

- Every core store cart, payment-collection, shipping-option, order and return route in installed
  2.21.0 is guarded, or deliberately left to core: transfer accept and decline, and the order list.
- Every project cart route is guarded.
- Every new export has an importer, or is the parameter type of an exported function.
- Nothing needs generated files; the `@medusajs/medusa/api/*` type import matches the package
  `exports` map and existing usage.
- Every storefront caller of a guarded route sends the auth headers.
- `git status` shows only the other session's `issues/NIMBUS-207/`.
- No comment cites a plan id. There is no `as any` in source; the one `as unknown as` is in a test,
  `cart-context.test.tsx:80`, which is a nit.

Optional, not required:

- `active-cart.ts` imports the type `CartLookup` from `lib/data/cart.ts`, which imports it back. The
  cycle is type-only and erased at build. Moving `CartLookup` to `types/` would remove it.
- `POST /store/quotes` authenticates twice: the `/store/quotes*` ALL entry, then `ensureCartAccess`.
  It is harmless; leave it.

### Design (decide at the gate)

- **D1 (medium, pre-existing, not introduced here).** The approval card's "Place order" button
  (`modules/account/components/approval-card-actions/index.tsx:76,130`) links to
  `/checkout?cart_id=<id>&step=payment`. Checkout reads `searchParams.cartId`
  (`checkout/page.tsx:24`).
  - Only the redirect after approving (`lib/data/approvals.ts:95`) uses `cartId`.
  - From the card, checkout shows the administrator's own cookie cart, not the colleague's.
  - When there is no cookie cart, the storefront middleware falls through to a redirect to the same
    URL, which looks like a redirect loop. I reasoned this from the code and did not run it.
  - This is flow C and part of task 04's after-deploy check; see open question 1.
- **D2 (low).** `workflows/order/steps/validate-order-transferable.ts:12-16` reads the order without
  `is_draft_order: false`, unlike the order guard.
  - A draft order with no account owner passes on to core's request workflow.
  - Draft order IDs appear in no store response.
  - Adding the filter would make drafts answer 404, the same as the guard. See open question 2.
- **D3 (low, accepted pattern).** A signed-out `POST /store/returns` with an invalid body answers
  400, not 401: core's validator runs before the guard.
  - This is the same trade-off task 03 accepted for carts. Validation reads no order, so nothing
    leaks.
  - Recommend accepting it.
- **D4 (low).** `CART_UNAVAILABLE` is thrown from server actions (`updateCart`, add, update and
  delete line item).
  - Next.js hides thrown messages in production, so the toast shows the generic error unless a
    caller catches the error and returns it.
  - Task 04 avoided this for sign-in by returning the code instead. `CART_NOT_FOUND` has the same
    pre-existing behaviour.
  - Not blocking. The full-page notice on the cart and checkout pages works, because it comes from
    `lookupCart`.
- **D5 (low).** The storefront rule "the active cart is one the customer owns"
  (`lib/util/active-cart.ts`) has no row in `ai/architecture/decisions.md`. It is a storefront
  lifecycle rule, not a copy of the backend rule. See open question 5.

The design matches the plan's tables:

- **Data model:** the company–cart link is written only by `hooks/cart-created.ts`, from
  `customer.employee.company_id`; metadata is no longer read. `cart.customer_id` can no longer
  change hands, because transfer is owner-only. No other field gets a new writer.
- **State tables:** the code matches every row of the plan's cart, order, transfer and approval
  tables:
  - `canAccessCart` and `canAccessOrder`;
  - `validate-order-transferable`;
  - `list-company-approval-carts`;
  - `validate-company-approval`.

  Login, logout and account switch behave as in flow D, with fix 04 on top.
- **Security matrix:**
  - Every control rests on the token plus a fresh Query read.
  - Refusal and absence share one error helper per guard.
  - `Cache-Control: private, no-store` is set before the check, so refusals carry it too.
  - Nothing is held in memory.
  - No locks are involved.
- **Framework assumptions:** no new reliance beyond plan section 9 and the branch notes. Middleware
  ordering, error mapping and Query paths were each shown at runtime by the HTTP specs.
- **One home per rule:** `hasVerifiedCartAssociation` is the only implementation; carts, orders and
  both approval steps call it. The three new backend rules have registry rows.

## Tests

Security paths:

- Every row of plan section 7 maps to a test, as the consolidation summary states. I checked these
  against the task evidence and spot-checked the spec:
  - the anonymous 401 matrix;
  - the 404 matrix with body equality and unchanged state;
  - admin pending and approved cases;
  - non-owner transfer;
  - indirect routes;
  - the approval list with a leak check;
  - the order matrix and the end-to-end admin payment and return;
  - the transfer refusal and the `{ success: true }` bodies;
  - forged order–company links.
- Gaps:
  - M3, the untested `getOrSetCart` branch (resolved in 5476a92).
  - `hasApprovedAdminApproval` has no test of its own; `canAccessCart` and `canAccessOrder` cover it
    fully.
  - Browser binding and CSRF are framework controls and are not retested, as the plan says.

Volume: tests +1681/-71, source +992/-301, catalogs +64/-8 in `apps/`.

- That is about 1.7 test lines per source line added, or about 2.3 net.
- Most of the volume is the table-driven HTTP matrix in `security-boundaries.spec.ts` (+647) and the
  storefront data tests.
- Nothing looks duplicated:
  - the unit specs test the pure rules on plain data;
  - the HTTP matrix tests wiring and bodies;
  - the storefront specs mock only the SDK.

Finalization results: every failure is on the baseline. One of them is not in the recorded baseline:
`admin/shipment-tracking.spec.ts` fails one test, and also fails on develop `e4f7351`. Module tests
ran against local `.medusa/server` build copies.

Known failure: `pnpm ai:check` fails on the `AGENTS.md` size, over the Codex limit. It failed before
this branch; the coordinator handles it separately.

## Open questions

1. **The approval card's "Place order" link (D1).** It sends `cart_id`, and checkout reads `cartId`.
   This is pre-existing, but it breaks the administrator path for an approved colleague cart opened
   from the card.
   - (a) Fix on this branch. It is a one-word storefront change, plus a test.
   - (b) Open a separate bug, and run the task 04 after-deploy check through the "Approve" redirect
     only.
2. **Draft orders in the transfer check (D2).**
   - (a) Add `is_draft_order: false`, so drafts answer 404 like the guard.
   - (b) Leave it as is.
3. **`admin/shipment-tracking.spec.ts`.** It fails one test here and on develop, but is not in the
   recorded baseline.
   - (a) Open a bug and add it to the baseline in `ai/architecture/verification.md`. That
     regenerates `AGENTS.md`, which is already over its size limit.
   - (b) Only open a bug for now.
4. **Retiring `Layout.cartMismatchBanner`.** Who deletes the keys in each environment's translation
   database, and when? Before or after the storefront release; leaving them is harmless.
5. **A registry row for the active-cart ownership rule (D5).**
   - (a) Add it to `decisions.md`. That also grows `AGENTS.md`.
   - (b) Leave it, since the rule has one home and a comment.

### Answers (Klaus Petersen, 2026-10-21)

1. D1: **(a)**, fix on this branch, test-first. An administrator who follows the link from an
   approved colleague cart reaches checkout with that colleague's cart, and is not caught in a
   redirect loop.
2. D2: **(a)**, add `is_draft_order: false` to the transfer check's order read, with a test, on this
   branch.
3. `admin/shipment-tracking.spec.ts`: **(b)**. It is not added to the `verification.md` baseline, and
   Klaus registers a separate bug. The same test also fails on develop e4f7351 (one test, same
   assertion).
4. `Layout.cartMismatchBanner`: keep the keys in every environment. Nothing to do beyond recording it
   in the rollout doc where the keys are mentioned.
5. D5: **(b)**, no `decisions.md` row for the active-cart rule.

Since 4de1d4a, `ai:check` passes again after the coordinator trimmed `AGENTS.md`. There are 69 bytes of
headroom left in the Windows checkout, so this branch adds no text to `ai/`.

## Verify after deploy

- **02 Trusted company link at cart creation:** company–cart link row (`links/company-carts.ts`) for
  one newly created cart; its `company_id` equals the creator's `employee.company_id`.
- **03 Guard on every direct and indirect cart route:** `GET /store/carts/<controlled cart>` as owner
  (200), as anonymous (401) and as a foreign customer (404); cart row unchanged after a refused
  `POST`.
- **04 Storefront sign-in, cart lifecycle and messages:** product page while signed out (sign-in
  prompt, no `_medusa_cart_id` cookie); admin approval card and checkout for one approved colleague
  cart.
- **06 Order access decision and guard:** `GET /store/orders/<controlled order>` as owner (200),
  signed out (401) and as a foreign customer (404); approving admin reaches the confirmation page
  after paying a colleague's approved cart; transfer request response body for a test order is
  `{ "success": true }`.
- **07 Approval list and decisions respect the verified association:** Approvals page for one
  administrator: a controlled cart whose owner left is absent.
- 01 and 05 have no after-deploy line. Task 05 put a five-step after-deploy list in
  `docs/security-remediation.md` ("Cart and order access rollout (NIMBUS-177)"), and it applies too.
  It includes importing the new translation keys in every environment before the storefront
  release.
- Fix 04 (79d96c1) has no separate line. On a browser holding a colleague's approved cart, signing
  in as the administrator drops the cookie, and the next add to cart creates a new cart owned by the
  administrator.
