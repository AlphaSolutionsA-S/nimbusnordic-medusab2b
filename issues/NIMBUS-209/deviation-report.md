# Deviation report: Upgrade the storefront to Next.js 16

Branch `feature/NIMBUS-209`, merge-base `cf39220`, commits `154c4e1` (plan), `ed3cf4b` (01),
`137a02f` (02), `a0d9438` (03), `2d8147d` (04), `ba0226c` (consolidation). Working tree clean.
Storefront only: no backend or CMS file changed, and the lockfile still resolves `next@16.3.3` for
`apps/cms`.

## Deviations from scope and plan

None is blocking. There is no data model and no migration.

- **Scope rule R4 replaced for deep links (decided by Klaus on 2026-10-22, plan decision 1).** A
  signed-out visitor on `/<cc>/account/<anything>` is now redirected to `/<cc>`. Before the upgrade
  this showed a 404, and the scope asked for the login form. `/<cc>/account` itself still shows the
  login form. Acceptable: it was decided before dispatch.
- **Task 01 was accepted with typecheck at 58 errors, above the baseline of 8 (dispatcher).** All 50
  extra errors were TS2554 on single-argument `revalidateTag` calls, which task 03 replaced. After
  task 03 the count is back to the same 8 errors. Acceptable: the gap was temporary and the end
  state is at the baseline.
- **The build was verified only against a local stub backend (task 01, finalization).**
  `generateStaticParams` for collections needs a live backend, so product, collection and category
  pages were prerendered with no data. The real proof is the Medusa Cloud preview build. Acceptable:
  plan section 10 already gates merge on that build.
- **Task 01 made two edits it did not plan.** It changed two existing tests (product page `params` passed as a
  Promise), and it added `account-layout.test.tsx` as a new file instead of extending the dashboard
  layout test, which covers a different file. Both acceptable.
- **Task 02 left `cartId as string` unchanged.** A repeated `?cartId=a&cartId=b` still passes an
  array cast to a string, as it did before. The backend cart-access guard is the control. Acceptable:
  the behaviour predates this branch.
- **Task 03 tests only part of the actions.** Signup, `updateCustomer`, the address actions, the
  companies actions and the quotes actions have no new tests. Only the rename changed in them, and
  the compiler rejects a single-argument `revalidateTag`. Acceptable; see the Tests section.
- **Task 03 tested more than planned.** It added cases for `emptyCart`, cart creation, `updateRegion`
  without a cart, `createCartApproval`, and `placeOrder` when it returns a cart (nothing expires).
  Acceptable.
- **Task 04 added one new lint warning.** The new rule `@next/next/no-location-assign-relative-destination`
  flags pre-existing code at `src/modules/layout/components/region-switcher/index.tsx:34`. Lint now
  ends with 0 errors and 3 warnings. Acceptable; see open question 2.
- **Task 04 wrote the suppressions per rule (`--suppress-rule`), not with `--suppress-all`.** The
  file can therefore hold only the four React Compiler rules (23 findings in 15 files). This is
  stricter than the plan. Acceptable.
- **Task 04 shortened the `verification.md` baseline line.** The longer version would have pushed
  the generated `AGENTS.md` past the 32768-byte Codex limit that `ai:check` enforces. The file is
  now 32761 bytes, so any later Tier 0 addition needs a matching cut. Acceptable.
- **Task 04 changed a little more in `pnpm-lock.yaml`.** Besides the new `eslint` specifier, the
  registry's `deprecated` note on `eslint@9.39.4` was added. Metadata only. Acceptable.
- **Task 04's worker created NIMBUS-215** (component Customer Portal), a follow-up issue to clear
  the suppressions, as its task file asked.
- **NIMBUS-209 was not moved to In Progress (dispatcher).** It is in Jira status "Estimation", and
  its only forward transition is "Estimate approved" (to To Do). See open question 1.

## Consolidation changes

- Removed `updateTag` mock code from `src/__tests__/app/api/translations/revalidate.test.ts` that
  never ran: a top-level import and a `mockClear`. They had no effect because of
  `jest.resetModules`. The `revalidateTag` import and its `mockClear` were there before the branch
  and were left.
- No duplicated helpers, types or tests were found.
- Security-matrix rows are covered by tests, with three exceptions: the claims-page CSP (checked
  after deploy), CSRF (a framework guarantee) and secrets in the bundle (a whole-branch check).

## Findings

No design finding blocks. Checked against the plan's tables:

- **Section 6 (cache tags):** matches the code. Every server action in
  `lib/data/{cart,customer,companies,quotes,approvals,ui-translations-refresh}.ts` calls `updateTag`
  with the same tag, in the same place and order. No tag was added or removed, and no `"max"`
  profile is used anywhere. The only `revalidateTag` call left is in
  `app/api/translations/revalidate/route.ts:79`, as `(tag, { expire: 0 })`. The three
  commented-out calls in `cart.ts` are unchanged, as planned.
- **`updateTag` in a route handler (checked across tasks).** I read `next@16.4.2` `revalidate.js`:
  `updateTag` throws only when there is no work store or the page ends in `/route`. Otherwise it
  goes through the same `revalidate()` path as the old call. The only route handlers are
  `api/translations/{missing,revalidate}`. `missing` imports no `lib/data` action. `revalidate`
  uses `revalidateTag`. `middleware.ts` uses raw `fetch`. So no `updateTag` can be reached from a
  route handler.
- **Flow A (checkout):** `checkout/page.tsx:22-24` awaits `searchParams`. No other page or layout
  under `src/app` reads `params` or `searchParams` without awaiting them. `cookies()` and
  `headers()` are always awaited.
- **Flow D (signed-out deep link):** `@login/default.tsx` builds its target with
  `encodeURIComponent` and never loads the customer. The layout (`account/layout.tsx:14`) renders the
  login slot only when there is no customer and the request is not a live preview. Finding 10
  (live-preview bypass) is unchanged, as the scope requires.
- **Low (informational): fresh-clone typecheck.** `apps/storefront/next-env.d.ts:3-4` (generated
  by Next.js 16) imports `./.next/types/routes.d.ts` and `./.next/types/root-params.d.ts`. Both are
  gitignored build output, so `tsc --noEmit` on a fresh clone fails until `next build` or `next dev`
  has run once. The previous `/// <reference path>` to `routes.d.ts` had the same dependency, so
  this is not new, and the file says "should not be edited".
- **Low (informational): no architecture doc for the account deep-link behaviour.**
  `docs/architecture/` does not describe the signed-out behaviour on account pages. The new
  redirect to `/<cc>` is a deliberate behaviour change, so `documentation-writer` could add it to
  `store-access.md` after the branch ships.

Mechanical wiring is clean:

- **Imports and exports:** every import resolves (`updateTag` and `revalidateTag` from `next/cache`
  16.4.2). There are no new dead exports, no duplicate files, routes or pages, no new
  `as unknown as` in source, and no circular imports.
- **Unplanned uniformity:** the only repeated pattern is the planned `revalidateTag` to `updateTag`
  rename.
- **Whole-branch checks in `verification.md`:** no new UI text (the default renders nothing), no
  new module and no new company-scoped route.
- **Code comments:** the comments in `default.tsx` and `route.ts` explain why and cite NIMBUS-209.
  No plan, task or test-case ids appear in added comments. The `TC-1` test names were there before.
- **"Also update" search** (for `next lint`, `revalidateTag`, `Next.js 15`, `.eslintrc`,
  `15.5.28` and `searchParams?.`): nothing stale is left in `ai/`, `docs/architecture/` or
  storefront source. `docs/security-remediation.md:180` mentions `next lint` only for the CMS, and
  the root `README.md` is on the do-not-read list. `turbo.json` already lists `eslint.config.*` as
  a lint input.
- **Lockfile:** the `apps/cms` importer still resolves `next` 16.3.3 and `eslint-config-next`
  16.3.3. The storefront resolves `next` 16.4.2 and `eslint-config-next` 16.4.2, with
  `eslint-plugin-react-hooks` 7.1.1.

## Tests

Each row of the security matrix and its coverage:

- **Own writes in checkout:** `cart.test.ts` "cart cache invalidation" (13 tests), `customer.test.ts`
  "session cache invalidation" plus the BC sync, `approvals.test.ts`, and
  `ui-translations-refresh.test.ts`. Each asserts the exact `updateTag` arguments and that
  `revalidateTag` is not called, so a `"max"` profile would fail them. The companies and quotes
  actions, signup, `updateCustomer` and the address actions have no tests. Their change is the same
  rename, and a single-argument `revalidateTag` fails `tsc`. But `tsc` is not green and the build
  skips type errors (`ignoreBuildErrors`), so for those actions only review protects against a
  regression.
- **Colleague cart at payment:** `checkout-page.test.tsx` passes `searchParams` as a Promise. The
  `cartId` cases failed before the fix, and the case without `cartId` falls back to the cookie cart.
- **Translation refresh only by the backend:** `revalidate.test.ts` covers a wrong or missing
  secret (5 cases), a bad schema (4), an oversized body and an outdated version. Each checks that
  neither invalidation function is called. The accepted request expires exactly
  `("ui-translations:da", { expire: 0 })`.
- **Account pages only when signed in:** `account-login-default.test.tsx` checks the redirect to
  `/dk`, that the default renders nothing and that it never loads the customer.
  `account-layout.test.tsx` checks the slot choice for a signed-in and a signed-out visitor. That a
  redirect in a slot that is not rendered has no effect was verified from source only. The preview
  check below covers it.
- **Open redirect:** `account-login-default.test.tsx` covers a segment that decodes to `//…`, one
  containing `/` and one starting with a backslash. All stay same-origin.
- **Claims CSP, CSRF and secrets:** these have no unit tests. The CSP is checked after deploy,
  CSRF is a framework guarantee, and secrets were checked by name in finalization (below).

Volume: tests added 422 lines and removed 53. Source added 75 and removed 59. That is about 5.6:1,
mostly the cart invalidation table. The tests do not look duplicated or redundant: each one asserts
a different action's tag list.

Finalization results, from the dispatcher (storefront only):

- **Jest:** 4 tests failed in 3 suites, 581 passed. The 4 failures (main-layout, money,
  product-tabs) were already there before the bump. `verification.md` still says "3 storefront"
  failing tests; that predates this branch.
- **Typecheck:** `tsc --noEmit` reports 8 errors, the same set as the baseline.
- **Lint:** 0 errors and 3 warnings.
- **Build:** exit 0 with Next.js 16.4.2 (Turbopack), against the stub backend.
- **Secrets:** no server variable name appears in `.next/static`. The values were not set locally,
  so they could not be searched for.
- **Visual tests (Playwright):** not run, because they need a seeded backend.

## Open questions

1. **Jira status of NIMBUS-209.** It is in "Estimation", and the only forward transition is
   "Estimate approved" (to To Do). Options: (a) Klaus moves it through "Estimate approved" and on to
   In Progress or review before the PR; (b) leave it and move it when the PR opens; (c) fix the
   workflow step that skipped estimation.
2. **The new lint warning in `region-switcher/index.tsx:34`.** It comes from
   `no-location-assign-relative-destination`, a rule new in Next 16. Options: (a) leave it as a
   warning (it does not fail lint); (b) add it to NIMBUS-215's scope; (c) open a separate small
   issue.
3. **Secrets in the client bundle were checked by name only.** The plan asked for a search for
   values, and no values exist locally. Options: (a) accept the name check, since Turbopack inlines
   only `NEXT_PUBLIC_*`; (b) on the preview, search the served JS chunks for the real
   `REVALIDATE_SECRET` and `PAYLOAD_API_KEY` values (added below as an after-deploy check).
4. **Visual tests were not run.** Options: (a) accept, and rely on the manual smoke test on the
   preview; (b) run `test:visual` against a seeded backend before merge.

### Answers (Klaus, 2026-10-22)

Klaus accepted the proposed answer to each question ("Alle er fint push og pr"):

1. Transition NIMBUS-209 with "Estimate approved", then on to the status for an open pull request.
2. (b) The region-switcher warning is added to NIMBUS-215's scope.
3. (b) On the preview, search the served JS chunks for the real secret values (after-deploy check).
4. (a) A manual smoke test on the preview is enough; visual tests are not run before merge.
5. NIMBUS-215, created during the run for clearing the lint suppressions, is kept.

## Verify after deploy

On the Medusa Cloud preview environment of the pull request, before merge to `develop`:

- **01: Next.js 16 dependencies and a passing build.** The preview build log shows Next.js 16.4.2.
  On the preview site, `/dk/account/orders` while signed out answers with a 307 to `/dk`. The same
  URL signed in shows the orders page.
- **02: Checkout reads cartId from awaited search params.** On the preview site, a company admin
  approves a colleague's cart. The payment step shows the colleague's cart id and total, not the
  admin's own cart.
- **03: Immediate cache invalidation on the Next.js 16 APIs.** On the preview site, add an item to
  the cart and check that the cart page total updates at once. Publish a Danish translation in
  Admin and check that `/dk` shows the new text on the next load.
- **04: Lint on the ESLint CLI with a flat config.** No after-deploy line (tooling only).
- **Plan security matrix (claims page).** The response to `/dk/account/claims` carries
  `Content-Security-Policy: frame-ancestors 'self' <Payload origin>;`, and the CMS live preview of
  the claims page still renders inside Payload admin.
- **Plan section 10 and scope F2.** The Medusa Cloud OpenNext/wrangler build passes with no
  unsupported-version error and no override. The edge `middleware.ts` still redirects `/` to a
  country path.
- **Open question 3 (chosen).** The served `/_next/static` JS chunks contain no value of
  `REVALIDATE_SECRET`, `PAYLOAD_API_KEY` or `TRANSLATION_REPORT_SECRET`.
- **Open question 4 (chosen).** In place of the visual tests, a manual smoke test of the main pages
  (front page, product, category, cart, checkout, account) looks as before.
