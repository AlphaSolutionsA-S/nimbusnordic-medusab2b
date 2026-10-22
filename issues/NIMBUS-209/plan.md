# Plan: Upgrade the storefront to Next.js 16

**Key:** NIMBUS-209 · **Branch:** `feature/NIMBUS-209` from `develop` · **App:** storefront only

## 1. Summary [High]

The storefront moves from Next.js 15.5 to 16.4.2 so that Medusa Cloud's OpenNext build accepts it
again (OpenNext 1.20.13 supports `>=16.4.1` in the 16 line). It is a framework change: customers
should not see any difference. Four tasks: the version bump and build fixes, a checkout fix that
Next.js 16 makes necessary, the cache-invalidation calls, and lint.

Three decisions shape it:

- **Server actions use `updateTag`, the translation route uses `revalidateTag(tag, { expire: 0 })`.**
  `updateTag` follows the same code path as today's single-argument `revalidateTag`, so cart and
  checkout invalidation behaves exactly as it does now. The stale-while-revalidate `"max"` form is
  refused (R1).
- **The checkout page must await `searchParams`.** Next.js 16 drops the synchronous compatibility
  layer, so today's `searchParams?.cartId` would read `undefined`. A company admin who approves a
  colleague's cart would then land on checkout with their **own** cookie cart. This is a
  payment-flow defect that the upgrade introduces, and the existing test hides it by passing a plain
  object.
- **Lint moves to the ESLint CLI.** `eslint-config-next` 16 brings React Compiler rules that flag 23
  existing places (checkout components among them) as errors. They go into a committed baseline,
  not into code changes.

**How to review this plan.** This plan is the human review gate: approving it is what allows
dispatch. Answer everything under *Needs your decision* first (two items, both `Critical`). Then
read the High sections closely: Klaus answered both on 2026-10-22, and decision 1 changes what a
signed-out visitor sees. There is no data-model change, so section 6 (the cache invalidation
table) and the security matrix are where an error would hurt. Section 4 (What gets built) is the
whole build in prose. The task files hold more depth but you don't need to read them. It is often
quicker to ask the planning agent in chat than to read further.

## 2. Needs your decision [Critical]

Both items are answered. Klaus approved the plan on 2026-10-22; Ready for Dispatch is true.

1. **Signed-out deep links to account pages.** Next.js 16 fails the build unless the `@login` slot
   has a `default.tsx`. Today a signed-out visitor who opens `/dk/account/orders` directly gets the
   built-in slot default, which calls `notFound()` and shows the 404 page (from reading the source,
   not run in a browser). Scope rule R4 said they see the login form. The options were (a) keep the
   404, or (b) show the login form. *Default:* (a).
   **Answer (Klaus, 2026-10-22):** neither option. A signed-out visitor on a deep account link is
   redirected to the country's front page (`/<countryCode>`). This replaces scope rule R4 for deep
   links; `/<countryCode>/account` itself still shows the login form. It is a deliberate change from
   today's 404. Checked for pitfalls in next@16.4.2, none found (section 9).
2. **New React Compiler lint errors.** `eslint-config-next` 16.x turns on `react-hooks` 7 rules
   (`set-state-in-effect`, `refs`, `immutability`, `error-boundaries`). A probe run reports 23
   errors in 15 existing files, including the checkout address, shipping and payment components and
   the cart drawer. The options were (a) a bulk-suppression baseline, (b) downgrade to warnings, or
   (c) refactor the files now. *Default:* (a).
   **Answer (Klaus, 2026-10-22):** (a). The existing findings go into `eslint-suppressions.json` and
   the rules stay at error, so new code must comply. A follow-up issue clears the suppressions.

## 3. Flows [High]

### A. Approved colleague cart reaches payment (task 02)
1. A company admin approves a colleague's cart. The approval action redirects to
   `/checkout?cartId=<cart>&step=payment`.
2. The checkout page awaits `searchParams` and reads `cartId`.
3. `lookupCart` loads that cart, not the admin's cookie cart, and the payment step renders for it.

### B. Customer changes the cart (task 03)
1. The customer adds, updates or removes a line, or changes shipping, payment session, promotion or
   region. Each of these runs in a server action.
2. The action calls the backend, then expires the cart tag (and the fulfillment tag where it does so
   today) immediately, using `updateTag`.
3. The page the action returns to, and the next page, read fresh cart data. The table in section 6
   lists every action and its tags.

### C. Backend publishes a translation (task 03)
1. The backend posts to `/api/translations/revalidate` with the bearer secret.
2. The route checks the secret, body size and schema, then the version (unchanged).
3. For an accepted request, the route expires exactly one `ui-translations:<locale>` tag immediately
   with `revalidateTag(tag, { expire: 0 })`. An outdated version returns `revalidated: false`
   without invalidating anything.

### D. Signed-out visitor opens an account page (task 01)
1. `/<cc>/account`: the layout has no customer, so it renders the `@login` slot page (login form).
2. `/<cc>/account/orders` (any deep account link): the `@login` slot has no matching page, so
   the layout renders the new `@login/default.tsx`. It redirects to `/<cc>`, the front page
   (decision 1). Today this request shows a 404.
3. The front page is outside `account`, so the redirect cannot loop.
4. A signed-in customer on the same URL gets the dashboard. The layout never renders the login
   slot, so the redirect does not fire (section 9).
5. A CMS live-preview request still sees the dashboard (unchanged, finding 10).

### E. Developer runs lint (task 04)
1. `pnpm --filter @b2b-starter/storefront lint` runs the ESLint CLI over `src` with the flat config.
2. Findings listed in `eslint-suppressions.json` are skipped. A new violation of any error rule
   fails the run, and `react/jsx-no-literals` still warns on `src/app` and `src/modules`.

## 4. What gets built [High]

### 01: Next.js 16 dependencies and a passing build
`next` and `eslint-config-next` are pinned to 16.4.2. React stays at 19.0.5 (answered), and the CMS
keeps its own Next.js 16.3.3; the lockfile change must not move it. The build uses Turbopack, the
default. `next-intl` 4.14 adds a `turbopack` alias under Next.js 16, so the "webpack config without
turbopack config" guard does not trip (verified, section 9). The account route gets
`@login/default.tsx` (S3 route file). It redirects a signed-out visitor on a deep account link to
the country's front page, `/<countryCode>` (decision 1, which replaces scope rule R4 for deep
links). The country segment is URL-encoded when the target is built, so a crafted segment cannot
turn the redirect into an off-site URL. `@dashboard` needs no
default, because every child route has a dashboard page. Add one only if the Turbopack build asks
for it. The product page's `params` type becomes a `Promise`. The code already awaits it, so only
the type changes. The `tsconfig.json` and `next-env.d.ts` edits that Next.js makes on its first
build are committed as they come. `next.config.js` is not changed: `typescript.ignoreBuildErrors`
stays, and the `headers()` CSP for the claims page is kept as it is (R5). The version strings in
`ai/AGENTS.md` and the storefront skill's `project.md` move to 16.4. The unused `webpack`, Babel and
`babel-loader` dependencies stay unless they break the build.

### 02: Checkout reads `cartId` from awaited search params
The checkout page (S3) declares `searchParams` as a `Promise` and awaits it before reading `cartId`
and `step`. This restores flow A under Next.js 16. The page test changes to pass a resolved
`Promise`, as Next.js 16 does in production, so it would have caught the defect. No other page
reads params synchronously: a search of every `params` and `searchParams` read under `src/app`
found only this one.

### 03: Immediate cache invalidation on the Next.js 16 APIs
Every single-argument `revalidateTag` in the `"use server"` data functions (S2: cart, customer,
companies, quotes, approvals, ui-translations-refresh) becomes `updateTag` with the same tag, in the
same place and order. No tags are added or removed. The translation refresh route (S3 route
handler), where `updateTag` throws, uses `revalidateTag(tag, { expire: 0 })`, which still expires
exactly one locale tag (R2, R3). Rules enforced: R1 (no `"max"` profile anywhere) and R2. The
commented-out `revalidateTag` lines in `cart.ts` are left alone. The unit tests that mock
`next/cache` switch to asserting `updateTag`, or `revalidateTag` with `{ expire: 0 }` for the route.

### 04: Lint on the ESLint CLI with a flat config
`.eslintrc.js` is replaced by `eslint.config.mjs`. It contains `eslint-config-next/core-web-vitals`
and the `react/jsx-no-literals` override, which stays at warn with its exact options and file globs
(`src/app/**/*.tsx`, `src/modules/**/*.tsx`, tests excluded). The `lint` script becomes `eslint src`.
That keeps the files `next lint` covered today and no longer needs the publishable key, which
`next lint` required because it loaded `next.config.js`. Pre-existing React Compiler findings are
handled per decision 2, and the `eslint` dev dependency floor rises to `^9.24.0`, the first version
with bulk suppressions. `ai/architecture/verification.md` gets one line naming the suppression file
as the storefront lint baseline.

## 5. Data model [High]

None. No table, field, migration or stored value changes. Cache tags keep their names: `carts`,
`fulfillment`, `orders`, `approvals`, `regions`, `products`, `customers`, `auth`, `companies`,
`quotes`, `quote-<id>`, `quotePreview-<id>` (all suffixed per cache id by `getCacheTag`) and
`ui-translations:<locale>`. Writer: the storefront server, inside the customer's own server action
or the backend-authorized refresh route. The tags are derived, not stored by us. Retention: Next.js
or OpenNext tag cache.

## 6. Business rules as state tables [High]

Cache tag invalidation. Every row is "tag fresh → action succeeds → tag expired now". The only
change in this story is the API that does it.

| Action (server action unless noted) | Tags expired immediately | API after upgrade | Side effects on other sessions |
|---|---|---|---|
| getOrSetCart (new cart / region change), updateCart, addToCart, addToCartBulk, updateLineItem, deleteLineItem, applyPromotions | carts (+ fulfillment where today) | `updateTag` | none: tags are per cache id |
| emptyCart, setShippingMethod, initiatePaymentSession | carts | `updateTag` | none |
| placeOrder | carts, orders, approvals | `updateTag` | none |
| updateRegion | carts (when a cart exists), regions, products | `updateTag` | none |
| createCartApproval; updateApproval | carts, approvals | `updateTag` | the colleague's cart is read with the admin's cache id, as today |
| updateCustomer, signup, address add/update/delete | customers | `updateTag` | none |
| login (incl. BC company sync) | customers, products, carts | `updateTag` | none |
| signout | auth, customers, products, carts | `updateTag` | none |
| createCompany, create/update/deleteEmployee, updateApprovalSettings | companies | `updateTag` | none |
| acceptQuote, rejectQuote, createQuoteMessage | quotes, quote-<id>, quotePreview-<id> | `updateTag` | none |
| refreshUiTranslationsForCountry (language switcher) | ui-translations:<locale> | `updateTag` | all visitors of that locale get fresh text (as today) |
| Translation refresh route (route handler) | ui-translations:<locale>, exactly one | `revalidateTag(tag, { expire: 0 })` | as above |

Preconditions are unchanged: the route invalidates only after the secret, size, schema and version
checks pass, and otherwise returns 401, 413, 400 or `revalidated: false` without invalidating. The
actor recorded for each change is the customer (or the backend for the route), as today.

## 7. Security-property matrix [High]

| Property | Control | Trust root | Failure behaviour | Negative test |
|---|---|---|---|---|
| Customer sees own writes in checkout | `updateTag` in every action (section 6) | Next.js tag cache | Stale totals would be a payment risk: blocker | Task 03: each action expires its tags, and no call passes `"max"` |
| Approved colleague cart reaches payment, not the admin's own | Checkout awaits `searchParams` | Signed `cartId` checked by the backend cart-access guard | Wrong cart at payment: blocker | Task 02: a Promise `searchParams` with `cartId` loads that cart; a missing `cartId` falls back to the cookie cart |
| Translation refresh only by the backend | Bearer secret (constant time), bounded body, strict schema (unchanged) | `REVALIDATE_SECRET` | 401/413/400, no invalidation | Task 03: wrong secret, oversized body and outdated version invalidate nothing |
| Account pages only for a signed-in customer | Layout picks login or dashboard; new `@login/default.tsx` redirects signed-out deep links to `/<cc>` and renders nothing | Medusa auth cookie | Redirect to the front page or login form, never account data | Task 01: the default redirects and renders no account data |
| The new redirect stays on our site | Target built from the URL-encoded country segment, always a same-origin path | Next.js routing | Off-site redirect would be an open redirect | Task 01: a segment that decodes to `//evil.example` still redirects to a single-slash same-origin path |
| Claims page framed only by the CMS | `headers()` `frame-ancestors` (unchanged) | `PAYLOAD_PUBLIC_URL` | Refuses foreign frame | After deploy: response header on `/dk/account/claims` |
| Server actions only from our origin (CSRF) | Next.js origin and host check, still present in 16.4.2 (verified) | Browser `Origin` | 500 "Invalid Server Actions request" | Framework guarantee, not retested |
| Server secrets stay on the server | Only `NEXT_PUBLIC_*` inlined (Turbopack keeps this rule) | Next.js env inlining | Secret in client bundle | Whole-branch pass: search `.next/static` for `REVALIDATE_SECRET` and other server variable values |

Trust anchor, replay, cross-instance and logout are unchanged by this work.

## 8. Decisions [High / Medium]

**New in this plan**
- `updateTag` in server actions: it takes the same `revalidate(..., profile undefined)` path as
  today's single-argument call, with no warning. Verified in `next@16.4.2`
  `dist/server/web/spec-extension/revalidate.js`.
- `revalidateTag(tag, { expire: 0 })` in the route handler: `updateTag` throws when
  `workStore.page` ends in `/route`, and `{ expire: 0 }` marks the path revalidated and expires the
  tag now, both in Next.js's file cache and in OpenNext's cache adapter. Verified in
  `revalidate.js`, `file-system-cache.js`, and `@opennextjs/aws@4.1.12` `dist/adapters/cache.js`.
- Checkout `searchParams` is awaited: in production Next.js 16 builds `searchParams` as a plain
  `Promise.resolve(...)` with no synchronous properties. Verified in `next@16.4.2`
  `dist/server/request/search-params.js` (`makeUntrackedSearchParams`).
- `@login/default.tsx` is required: the 16.4.2 app loader throws `MissingDefaultParallelRouteError`
  for a slot without a default when the segment has child routes. Verified in the webpack loader.
  Whether Turbopack's native check behaves the same is not verified, and does not matter, because
  the file is added either way.
- Signed-out deep account links redirect to `/<countryCode>` (Klaus, 2026-10-22, decision 1). This
  deviates from scope rule R4 and from today's 404 page.
- React Compiler findings that predate the rules go into an `eslint-suppressions.json` baseline,
  and the rules stay at error (Klaus, 2026-10-22, decision 2).
- Lint covers `src` only, the same files as `next lint` today. Verified by running `next lint`
  (0 errors, 2 warnings).
- React Compiler findings go into ESLint bulk suppressions (decision 2). Verified: ESLint 9.39.4
  has `--suppress-all` and `eslint-suppressions.json`.

**From the scope**
- Next.js 16.4.2, no version-check override (F1, F2). React stays at 19.0.5 (answered).
- `middleware.ts` stays as it is and gets no `proxy.ts`; the warning is accepted; the rename is
  NIMBUS-210 (N3, answered).
- Turbopack is the default and no new Next.js features are adopted (N2, N4).
- Wrangler risk accepted and covered by a smoke test; verification happens on the Medusa Cloud
  preview environment of the pull request (answered).

## 9. Framework assumptions [Medium]

| Primitive | Verified behaviour | Evidence |
|---|---|---|
| `updateTag(tag)` | Throws outside a server action and in route handlers. Inside an action it expires the tag immediately and marks the path revalidated (read-your-own-writes). Throws during render, as `revalidateTag` already does in 15 | `next@16.4.2` `revalidate.js`; 15.5.18 has the same render guard |
| `revalidateTag(tag, { expire: 0 })` | The object profile is validated; `expire === 0` marks the path revalidated; the file cache sets `expired = now`; OpenNext writes `expire: now` | `revalidate.js`, `cache-life-profile.js`, `file-system-cache.js`; `@opennextjs/aws@4.1.12` `adapters/cache.js` |
| Single-argument `revalidateTag` | Still works and warns once per call | `revalidate.js` |
| `searchParams` in production | Plain resolved Promise with no synchronous keys | `request/search-params.js` |
| Missing parallel-route default | Build error when the segment has child routes (webpack loader) | `next-app-loader/index.js` |
| `redirect()` thrown in an unused slot | A redirect error in the server-component render only returns a digest. The 307 and `Location` are set only when the HTML render actually reaches the slot, so a slot the layout does not render (the signed-in case) has no effect. Today's built-in `notFound()` default relies on the same mechanism and does not 404 signed-in users. A default segment gets `params` like a page | `create-error-handler.js` (`getDigestForWellKnownError`), `app-render.js` (`renderToStream` error recovery), `create-component-tree.js` |
| Turbopack and `next-intl/plugin` 4.14.1 | Under Next ≥16 the plugin always sets `turbopack.resolveAlias`, so the "webpack config without turbopack" exit does not trigger | `next-intl` `dist/cjs/development/plugin.cjs`; `next` `lib/turbopack-warning.js` |
| Server action CSRF origin check | Still present | `app-render/action-handler.js` |
| React peer | `^19.0.0` accepts 19.0.5 | `next@16.4.2` `package.json` |
| `next/jest`, `unstable_cache`, `unstable_rethrow` | Still exported | `dist/build/jest`, `spec-extension/unstable-cache.js`, `client/components/navigation.js` |
| `eslint-config-next@16` | Flat config only; the core-web-vitals config enables `react-hooks` 7 recommended rules, including the compiler rules at error | the package's `dist/index.js`; probe run with 16.3.3 (same `react-hooks` 7.1.x) |
| ESLint bulk suppressions | `--suppress-all`, `--prune-suppressions`, `eslint-suppressions.json` in 9.39.4 | `eslint/lib/options.js`, `lib/cli.js` |

No row is UNVERIFIED. The one gap left is the deploy itself, below.

## 10. Open risks and gates [Medium]

| Risk | Owner | Blocking? |
|---|---|---|
| Edge `middleware.ts` and the Turbopack build pass on Medusa Cloud's OpenNext and wrangler | Klaus, on the pull request's preview environment (answered) | Blocks merge, not dispatch |
| Visual tests need a running, seeded backend; finalization may not be able to run them locally | dispatcher; else Klaus on preview | Non-blocking: report as not run |
| Storefront `tsc --noEmit` baseline is not green; Next.js 16 type generation may move the count | task 01 records the count before and after | Non-blocking if not increased (N1) |
| Signed-in customer on a deep account link is not redirected (source-verified, not yet run) | task 01 unit test; Klaus on preview | Non-blocking |
