# 03: Immediate cache invalidation on the Next.js 16 APIs
**App:** storefront · **Layer:** S2 (server actions), S3 (route handler) · **Depends on:** 01

**Goal:** Replace every single-argument `revalidateTag` call with the Next.js 16 API that keeps
immediate expiry. Server actions use `updateTag` with the same tags in the same places. The
translation refresh route uses `revalidateTag(tag, { expire: 0 })`. No tag is added or removed,
and no `"max"` profile is used (plan section 6).
**Files / areas:** `src/lib/data/{cart,customer,companies,quotes,approvals,ui-translations-refresh}.ts`,
`src/app/api/translations/revalidate/route.ts`. The commented-out lines in `cart.ts` stay as they are.
**Seam contracts:** none outside this task.
**Test intent (unit, mocks of `next/cache` only):**
- Cart actions (add, update line, delete line, shipping method, payment session, promotions, place
  order, region) expire exactly the tags in plan section 6, through `updateTag`. Assert the tag
  values, not only that the function was called.
- Customer login and signout, and the approval decision, expire their tags through `updateTag`.
- The translation route, for an accepted request, calls `revalidateTag` once with
  `("ui-translations:<locale>", { expire: 0 })`. Wrong secret, oversized body, bad schema and an
  outdated version call neither function.
- `refreshUiTranslationsForCountry` expires one locale tag through `updateTag`.
- Negative: no call anywhere passes `"max"` or any profile other than `{ expire: 0 }`.
**Done when:** a search for single-argument `revalidateTag(` in `src` finds only comments, and the
changed tests pass.
**Verify after deploy:** on the preview site, add an item to the cart and check that the cart page
total updates at once. Publish a Danish translation in Admin and check that `/dk` shows the new
text on the next load.
**Also update:** `src/__tests__/lib/data/{cart,customer,approvals,ui-translations,ui-translations-refresh}.test.ts`,
`src/__tests__/app/api/translations/revalidate.test.ts`,
`src/__tests__/modules/account/components/company-card-bc-readonly.test.tsx` (its `next/cache`
mock); `ai/skills/medusa-storefront/project.md` line 9 (`revalidateTag` → `updateTag`).

## Deviations

- Added cases beyond the listed cart actions: `emptyCart`, `getOrSetCart` creating a cart (via
  `addToCart`), `updateRegion` without a cart, `createCartApproval`, and `placeOrder` returning a
  cart (expires nothing). Why: plan section 6 lists these rows too; the last one guards against
  expiring tags on a failed completion.
- `customer` (signup, `updateCustomer`, address actions), `companies` and `quotes` actions have no
  new tests. Why: the test intent names only login/signout and the approval decision; their change
  is the same mechanical rename, covered by the typecheck (`updateTag(tag: string)`) and the
  source search below.
- The "no `"max"` profile" negative is asserted per action as exact call arguments
  (`updateTag` with exactly `[tag]`, `revalidateTag` not called; the route with exactly
  `[tag, { expire: 0 }]`), not as a search over source text (`verification.md`).
- `ui-translations.test.ts`: its in-memory `next/cache` stand-in and the test's own invalidation
  calls now use the two-argument `revalidateTag(tag, { expire: 0 })` form the route uses; no
  behaviour asserted there changed.
- The oversized-body route case now also asserts nothing is invalidated (it only checked 413).
- One why-comment added to the route above the `{ expire: 0 }` call.

## Done-when evidence

- Single-argument `revalidateTag(` in `src` only in comments: a search of `apps/storefront/src`
  (tests excluded) for `revalidateTag\([^,)]*\)` matches only the three commented-out lines in
  `lib/data/cart.ts` (395, 407, 426); the route's call has two arguments.
- Cart actions expire the plan's tags through `updateTag`: `src/__tests__/lib/data/cart.test.ts`,
  "cart cache invalidation" (13 tests: add existing/new cart, update line, delete line, empty,
  shipping method, payment session, promotions, place order, place order not completed, region with
  and without a cart, approval request).
- Login and signout: `src/__tests__/lib/data/customer.test.ts`, "session cache invalidation" (2
  tests); company sync: "posts once and revalidates the customer cache".
- Approval decision: `src/__tests__/lib/data/approvals.test.ts`, "updateApproval expires approvals
  and carts at once after the decision".
- Route: `src/__tests__/app/api/translations/revalidate.test.ts`, "expires only the selected
  locale's tag, at once" (exactly `("ui-translations:da", { expire: 0 })`); wrong secret (5
  cases), bad schema (4 cases), oversized body and outdated version call neither function.
- `refreshUiTranslationsForCountry`: `src/__tests__/lib/data/ui-translations-refresh.test.ts`
  (all cases now on `updateTag`; the first asserts exactly one call and no `revalidateTag`).
- Negative, no `"max"` or other profile: every invalidation test above asserts the exact argument
  lists and that the other function was not called.
- Changed tests pass: 7 suites, 75 tests passed.
- Typecheck: 8 errors, the same set as `tsc-baseline.txt` (`tsc-after-03.txt` in the run
  scratchpad).
- Not provable in this task: immediate freshness on the deployed site (the "Verify after deploy"
  lines; Next.js and OpenNext cache behaviour is verified in plan section 8 from source).
- Also update, `cart.test.ts`, `customer.test.ts`, `approvals.test.ts`,
  `ui-translations-refresh.test.ts`, `revalidate.test.ts`: mocks gain `updateTag` and assertions
  moved to it (route: `revalidateTag` with `{ expire: 0 }`).
- Also update, `ui-translations.test.ts`: stand-in and calls on the two-argument form.
- Also update, `company-card-bc-readonly.test.tsx`: mock now provides `updateTag`.
- Also update, `ai/skills/medusa-storefront/project.md` line 9: `revalidateTag` → `updateTag`;
  `pnpm ai:check` passed. No other `revalidateTag` mention in `ai/` or `docs/`.
- Lint: not run, `next lint` is gone until task 04.
