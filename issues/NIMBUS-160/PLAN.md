# NIMBUS-160: Ensure Business Central company data is fresh before viewing Company page

**Issue:** https://alphasolutionsdk.atlassian.net/browse/NIMBUS-160

## Objective
Gate `GET /store/companies/:id` on a persisted, company-level "last successful Business Central sync" timestamp so a customer never sees data older than ~10 minutes, while a failed sync silently returns the last-known data and retries on the next request.

## Analysis
- The sync workflow already exists and is failure-safe. `prepareCompanyBcSyncStep`
  (`apps/backend/src/workflows/company/steps/prepare-company-bc-sync.ts`) returns
  `ready | skipped | failed`, and `updateCompaniesStep` only runs when `ready`. Writing the
  timestamp **inside the `ready` update object** therefore satisfies "only a successful sync
  updates the timestamp" for free — no new branch, no new step.
- The GET route is already authenticated (`authenticate("customer", ["session","bearer"])` in
  `apps/backend/src/api/store/companies/middlewares.ts`), so
  `req.auth_context.app_metadata.customer_id` is available — the same identity the login sync
  route uses. The sync is always driven by that server-resolved customer id, never the caller's
  `:id` param.
- The workflow only surfaces `failed` for `MedusaError`. Unexpected (non-`MedusaError`) errors
  re-throw and would 500 the page. To honour "no hard error on the page," the route wraps the
  workflow run in a try/catch that logs and falls through to returning stored data.
- **Storefront caching:** `retrieveCompany` (`apps/storefront/src/lib/data/companies.ts`) fetches
  with `next: { tags }` and **no `revalidate`**, so Next.js caches the response indefinitely until
  a tag is revalidated — which would bypass the backend's 10-minute check after the first render.
  Adding `revalidate: 120` caps self-healing staleness: worst case 10 min (backend window) + 2 min
  (storefront TTL) = ~12 min, while preserving tag-based revalidation from update/create flows and
  avoiding an uncached backend read on every render.

## Execution Plan
1. **Task 01** — add nullable `business_central_synced_at` to the company model + `ModuleCompany`
   type, generate the migration.
2. **Task 02** — in the prepare step's `ready` branch, stamp `business_central_synced_at: new Date()`
   into the update so it is written atomically with the mapped fields.
3. **Task 03** — add freshness orchestration to `GET /store/companies/:id`: read the timestamp, run
   the sync workflow (by authenticated `customer_id`) when missing or >10 min old, tolerate failures,
   re-read and return.
4. **Task 04** — add `revalidate: 120` to the storefront `retrieveCompany` fetch so the backend
   freshness gate is actually reached within ~2 minutes.
5. **Task 05** — backend integration tests for fresh / missing / stale-success / stale-failure.

## Decisions & Trade-offs
- **Timestamp lives on the company row**, not per session/cookie — meets the cross-device / new-tab /
  cookie-clear reliability requirement.
- **Timestamp is written via the existing update step**, keeping all mutation inside the workflow;
  the route only orchestrates freshness and reads.
- **2-minute storefront cache TTL** (not full uncaching) trades ≤2 min extra staleness for fewer
  backend reads and keeps existing tag revalidation intact.
- **Ownership mismatch accepted:** freshness is read from the `:id` param while the sync targets the
  authenticated customer's own company. For normal use they are identical; the endpoint already
  returns arbitrary `:id` today and broad authorization is explicitly out of scope.
- **Failure never advances the timestamp**, so the next Company-page request retries rather than
  treating the stale data as fresh.

## Verification
- [ ] Fresh (≤10 min): `BusinessCentralService.getCustomer` is **not** called; stored data returned.
- [ ] Missing timestamp: sync runs; mapped fields + timestamp persisted; refreshed data returned.
- [ ] Stale success (>10 min): sync runs; refreshed fields returned; timestamp advanced.
- [ ] Stale failure (`MedusaError`): HTTP 200 with previous fields; timestamp unchanged.
- [ ] Login sync continues to work and sets the same timestamp on success.
- [ ] `pnpm --filter @b2b-starter/backend build` and lint pass for changed files.
