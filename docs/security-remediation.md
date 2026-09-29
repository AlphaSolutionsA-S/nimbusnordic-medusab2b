# Security review remediation

This change addresses review findings 1–6 and 9. Findings 7 (cumulative spending
limits), 8 (the cart/company metadata link), and 10 (claims live preview) remain
outside this change.

## API behavior

- Company reads require membership in the requested company. Company updates,
  deletion, employee management, and approval settings require that company's
  `employee.is_admin` flag. Provider `user_metadata.role` grants no authority.
- `POST /store/companies` creates the authenticated customer's first company and
  its administrator together. Clients must stop making a second request to create
  that employee. Customers already linked to a company cannot register another.
  Existing companies without an administrator must have an owner assigned through
  the merchant administration tools after ownership is verified.
- Customer quote acceptance, rejection, messages, and preview require ownership.
  Creating a quote also requires ownership of its source cart.
- Store approval decisions require an administrator of the cart's company and an
  `admin` approval. The server assigns `handled_by`; only pending requests can be
  approved or rejected. Sales-manager approvals remain merchant operations.
- Checkout requires an approved request for every approval type configured for
  the cart's company or the customer's company. Missing, pending, or rejected
  requests block checkout.
- Pending and approved carts cannot be edited, including quantities, deleted
  items, promotions, shipping, customer assignment, and bulk additions. Start a
  new cart to change such a purchase. Rejected carts can be edited and submitted
  again; a new submission replaces the rejected requests. Old decisions cannot
  authorize a changed purchase.
- Business Central store operations require customer authentication. The empty
  duplicate middleware entry has been removed.

## CMS deployment

Payload packages and the storefront live-preview client are pinned to 3.90.0.
The CMS uses Next.js 16.3.3, which is supported by this Payload release. The
storefront's Next.js version is unchanged. CMS lint now uses ESLint directly
because Next.js 16 removed `next lint`.

1. Back up the CMS database and test the upgrade with a staging copy.
2. Install the committed lockfile: `corepack pnpm install --frozen-lockfile`.
3. With the target CMS configuration, run `corepack pnpm --filter @dtc/cms migrate`
   before routing requests to the upgraded CMS.
4. Deploy the backend, CMS, and storefront together; the signup API and client
   now create the first employee in a single server operation.
5. Smoke-test CMS login, password recovery, existing media, a published page,
   company signup, and the approval/checkout flow.

Migration `20260919_131145_security_upgrade` adds the password-reset request
timestamp, user-session storage, Payload key/value storage, and Azure object keys.
Its SQL was tested on a disposable PostgreSQL database through initial schema,
upgrade, downgrade, and reapplication while preserving an existing user.
Downgrading removes session and new-column data, so retain the backup. Prefer a
forward fix over returning to the vulnerable CMS release.

The dependency audit no longer reports Payload advisories. Other dependency
advisories remain and need separate triage; this is not a clean bill of health
for the full dependency tree.

## Regression coverage

`apps/backend/integration-tests/http/security/security-boundaries.spec.ts` covers
company isolation, first-administrator registration, stale global roles, quote
ownership, approval authority, immutable carts, and Business Central authentication.
`apps/backend/src/utils/__tests__/validate-cart-approvals.unit.spec.ts` covers
missing, rejected, incomplete, and fully approved checkout requests.

Run HTTP tests only against disposable databases. The Medusa test runner creates
and drops its own databases using `DB_HOST`, `DB_PORT`, `DB_USERNAME`, and
`DB_PASSWORD`; do not supply production database credentials.

## Validation results (2026-09-20)

These results cover the local working tree, not a deployed release. The earlier
execution-credit blocker has cleared. Local PostgreSQL and disposable databases
were used for the backend HTTP/module tests and the isolated storefront build.

| Check | Result |
| --- | --- |
| Backend production build | Passed, including admin bundle; 0 lint errors and 11 warnings. |
| Security HTTP regressions | All 22 passed, including cross-company/quote isolation, approval decisions, frozen carts, editable carts, item deletion, and Business Central authentication. |
| Company HTTP tests | All 16 cases verified: 15 passed in the combined run; the remaining nonexistent-company deletion case passed separately after updating its expected status to 404. |
| Company-sync HTTP tests | All 7 passed in the recovered 2026-09-19 final log. |
| Remaining backend HTTP suites | Order API, order creation, order-event chain, and region migration passed (16 tests). Store/admin quote suites failed all 8 cases during cart setup: fixture products are unpublished. |
| Backend unit tests | All 21 source tests passed across 2 suites; compiled `.medusa/server` duplicates were excluded. |
| Backend module tests | 35 passed, 1 failed: Business Central invoice pagination mock expects 10 batches while the service permits 50. |
| CMS production build and lint | Passed during the preceding remediation work; unchanged since those checks. |
| CMS standalone typecheck | Passed on 2026-09-20. |
| CMS migration SQL | Initial schema, upgrade, downgrade, and reapplication passed on a disposable database, preserving a synthetic user. |
| Storefront production build | Passed on 2026-09-20 using a temporary local backend, synthetic region/channel/key, and empty catalog. CMS fetching was disabled for that isolated build. Two existing hook-dependency lint warnings remain. |
| Storefront signup regression | All 5 tests passed during the preceding remediation work. |
| Full storefront unit suite | Previous run: 245 passed, 3 failed; removed-banner expectation and two product-tabs React-version failures. |
| CMS unit suite | Previous run: 19 passed, 1 failed; claims-preview test expects `/us` while configuration returns `/dk`. |
| Standalone backend/storefront typechecks | Failed; details below. |

The company fixture no longer creates an unused cart with invalid product setup
before every company test. Token/header debug logging was removed from that
fixture. The nonexistent-company deletion expectation now reflects authorization
returning 404. Two positive security regression cases additionally prove that
carts with no approval or a rejected approval remain editable and allow item
deletion. No application behavior was changed during this validation follow-up.

Backend standalone TypeScript validation reports 10 diagnostics in existing
order-ingestion/order-API test fixtures and the shared admin test helper (incomplete
company data, untyped container calls, and optional JWT secret). It reports no
errors in the security regression or production source. Storefront validation
reports 10 diagnostics in account fixtures, quote-message Zod resolver types,
nullable profile fields, and timer types. Its existing `ignoreBuildErrors: true`
setting means a successful production build does not establish type safety.

The eight legacy quote HTTP failures happen before their assertions. The shared
product seeder creates draft products and ignores its supplied `data`, so these
results do not validate successful quote creation or admin messaging. Separately,
the default quote field expansion exceeds Medusa's relation-depth limit; the
focused authorization tests use explicit shallow fields to reach the ownership
checks. Both limitations need follow-up. Jest also failed to serialize the legacy
Axios errors into its JSON report because they contain circular request/response
objects; the completed text log provides the six-suite result above.

The production dependency audit from the remediation run reported no Payload
advisories, but still reported 3 critical, 55 high, 52 moderate, and 8 low findings
elsewhere. This is the saved audit result, not a new advisory lookup on 2026-09-20.

### Checks still needed before release

- Resolve the outstanding test/typecheck failures and obtain a green CI run and
  peer review. The repository as a whole is not fully green.
- Exercise a populated catalog and the signup, quote, approval, and checkout flows
  in a browser against staging, including real payment/integration configuration.
  The isolated build is a build check, not an end-to-end commerce test.
- Run the Payload migration through the deployment workflow on a staging copy;
  smoke-test login, password recovery, existing media, and published pages. The SQL
  migration test does not validate the entire Payload runtime upgrade.
- Verify production multi-instance locking/event infrastructure and concurrent
  approval/cart requests; local tests use in-memory locking and a local event bus.
- Apply the documented migration/deployment steps and perform post-deploy smoke
  tests. No live database migration or deployment was performed in this session.

Original findings 7, 8, and 10 remain outside the requested remediation scope.
