# NIMBUS-161: Company freshness sync can refresh the wrong company

**Issue:** https://alphasolutionsdk.atlassian.net/browse/NIMBUS-161

> **Status (2026-09-30):** Planned. **Ready for Dispatch: false.** Waiting for the user to
> review the plan and answer OQ-1. Work goes directly on `develop`.

## Objective

The Business Central freshness sync in `GET /store/companies/:id` must only refresh a company
when it is the `:id` company. When the authenticated customer's company differs from `:id`, the
sync is skipped and the stored company is returned.

## Analysis

Checked against develop at `b9e751c`. NIMBUS-157 and NIMBUS-160 are both merged.

- **`apps/backend/src/api/store/companies/[id]/route.ts`**
  - Since NIMBUS-157 the file has `GET` (a read-only projection through `company-projection.ts`)
    and `DELETE`. `POST` is gone.
  - The freshness block is at lines 54-62. It reads the `:id` company's
    `business_central_synced_at`. If that is stale, it runs
    `syncCompanyFromBusinessCentralWorkflow` with `{ customerId: customer_id }` only, inside a
    try/catch that logs `Business Central freshness sync failed for company ${id}`.
  - It then re-reads `:id` and returns `toStoreCompany(company, isAdmin)`.
- **`apps/backend/src/workflows/company/steps/prepare-company-bc-sync.ts`**
  - The step resolves `customer.employee.company.{id, business_central_customer_number}` and
    returns `skipped | failed | ready`.
  - `updateCompaniesStep` runs only on `ready`, and the workflow maps `ready` to `updated`.
  - So a `skipped` return from the step already means that nothing is written and no timestamp
    advances. The guard only needs a new early return.
- **Callers of the workflow:** only two.
  - The GET route.
  - `apps/backend/src/api/store/customers/me/company/sync-business-central/route.ts` (login
    sync, `{ customerId }`). This route does not change.
- **Access control:** `ensureCompanyAccess(false)` already stops a customer from requesting
  another company. So the mismatch cannot happen over HTTP today, and it can only be tested by
  running the workflow directly.
  - The repo already does this in
    `integration-tests/http/business-central-order/send-order-to-bc.spec.ts`.
- **How BC is mocked in tests:** both existing specs use
  `jest.spyOn(container.resolve(BUSINESS_CENTRAL_MODULE), "getCustomer")`, together with
  `medusaIntegrationTestRunner({ inApp: true })`.

## Execution Plan

1. **Task 01: add the guard.**
   - Add `expectedCompanyId?: string` to `PrepareCompanyBcSyncInput` and to
     `SyncCompanyFromBusinessCentralInput`, and forward it in the workflow.
   - In the step, after the company is resolved: if `expectedCompanyId` is set and differs from
     the resolved company id, `logger.warn` and return `skipped`. This happens before the BC
     service is resolved or called.
   - The GET route passes `expectedCompanyId: id`.
2. **Task 02: tests.**
   - In `integration-tests/http/customers/company-sync.spec.ts`, add two workflow-level tests:
     - Mismatch: `skipped`, no `getCustomer` call, and both companies' timestamps and names
       unchanged.
     - Match: `updated`, `getCustomer` called once, and the timestamp advanced.
   - Run `company-sync.spec.ts` and `companies.spec.ts` as the regression gate.

## Decisions & Trade-offs

- **The guard lives in the step, not in the route.**
  - The step already resolves the customer's company, so the route needs no second query.
  - Any future caller can pass the same guard.
  - The route change is one property.
- **The field is optional, so login sync is unchanged.** When `expectedCompanyId` is absent the
  code path is exactly as it is today, with no new branch taken.
- **The guard is placed after `companyId` is resolved and before the BC-number check.**
  - A customer without a company still goes to the existing `skipped` path.
  - A mismatch never resolves the BC service or calls it.
- **A mismatch is `skipped`, not `failed`, and not an error.**
  - This matches the scope's option (b).
  - The route returns 200 with the stored `:id` company, and its error log does not fire.
- **A mismatch is logged at warn level.** The line names both company ids, which are not PII, so
  a relaxed access check would show up in the logs (OQ-1).
- **Mismatch coverage is at workflow level, not HTTP level.** Reaching the mismatch over HTTP
  would mean relaxing `ensureCompanyAccess`, which is out of scope. The route's wiring is
  covered by the existing NIMBUS-160 stale and no-timestamp tests. Those still sync because
  `:id` is the caller's own company.
- **Two tasks, not one.** This keeps the database-dependent test run as its own gate. NIMBUS-160
  T05 was blocked by the database once.

**Differences from SCOPE.md**

- The route line numbers are 54-62 on current develop, not 53-62.
- The route now also uses `resolveCompanyActor` and `toStoreCompany`. Its behaviour is otherwise
  as SCOPE.md describes.
- The tests go in `company-sync.spec.ts`, which already holds the `customer` id. There is no new
  test in `companies.spec.ts`, which is only run as a regression check.

## Open Questions

- **OQ-1:** Should a mismatch write a `logger.warn` line? The plan says yes, with one line that
  names both company ids. The alternative is to skip silently, keeping the diff as small as
  possible. SCOPE.md says not to reword existing logs; this would be a new line.
- **OQ-2:** Do you approve the plan for dispatch directly on `develop`?

## Verification

- [ ] **TC-1 (mismatch):** the workflow is run with the customer's id and another company's
  `expectedCompanyId`.
  - `{ status: "skipped" }`.
  - `getCustomer` is not called.
  - Both companies' `business_central_synced_at` and names are unchanged.
- [ ] **TC-2 (match):** the workflow is run with the customer's own company as
  `expectedCompanyId`.
  - `{ status: "updated" }`.
  - `getCustomer` is called once with `00011551`.
  - The timestamp advanced.
- [ ] **TC-3:** the existing `POST /store/customers/me/company/sync-business-central` tests pass
  unchanged. The login route has no diff.
- [ ] **TC-4:** the NIMBUS-160 freshness tests (fresh, no timestamp, stale success, stale
  failure) in `companies.spec.ts` pass.
- [ ] `pnpm --filter @b2b-starter/backend build` passes, and lint passes for the changed files.
- [ ] How to run the integration tests. Use shell-only env vars and never write a `.env` file.
  1. Start a throwaway postgres:
     `docker run -d --rm --name nimbus161-pg -e POSTGRES_USER=admin -e POSTGRES_PASSWORD=S3cret -p 5432:5432 postgres:16`
  2. From `apps/backend`, run:

     ```bash
     DB_HOST=localhost DB_PORT=5432 DB_USERNAME=admin DB_PASSWORD=S3cret \
     DATABASE_URL=postgres://admin:S3cret@localhost:5432/postgres \
     BUSINESS_CENTRAL_DISCOVERY_URL=https://api.businesscentral.dynamics.com/v2.0/00000000-0000-0000-0000-000000000000/TestDK/api/v2.0 \
     TEST_TYPE=integration:http NODE_OPTIONS=--experimental-vm-modules \
     node ./node_modules/jest/bin/jest.js --runInBand --forceExit \
       integration-tests/http/customers/company-sync.spec.ts \
       integration-tests/http/companies/companies.spec.ts
     ```

  3. Stop the container: `docker stop nimbus161-pg`.
