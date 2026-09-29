# NIMBUS-161: Company freshness sync can refresh the wrong company

- **Status:** Scoped
- **Issue:** https://alphasolutionsdk.atlassian.net/browse/NIMBUS-161 (relates to NIMBUS-160)
- **Type:** Bug
- **Priority:** Medium (downgraded from High — see Current State)
- **Area:** Backend — Business Central freshness sync on `GET /store/companies/:id`
- **Size:** XS
- **Base Branch:** develop (work directly on develop, no feature branch)

## Objective

Make the freshness sync in `GET /store/companies/:id` only run when the company in `:id` is the
same company the sync would refresh. The company the sync resolves from the authenticated
customer must match `:id`. When they differ, skip the sync and return the stored company data.

## Confirmed Decisions

- **Fix direction (option b):** Sync only when `:id` equals the authenticated customer's own
  company. When it doesn't match, skip the sync without an error. The GET response is unchanged.
- **No change to authorization.** Access to `/store/companies/:id*` is already enforced by
  `ensureCompanyAccess`. This bug does not change it.
- **Backend only.** No storefront changes.
- **Priority Medium.** No data-exposure vulnerability exists (see Current State).

## Current State

- [`apps/backend/src/api/store/companies/[id]/route.ts:53-62`](../../apps/backend/src/api/store/companies/[id]/route.ts):
  - The route checks whether the company in `:id` is stale, using `business_central_synced_at`.
  - It then calls `syncCompanyFromBusinessCentralWorkflow` with `{ customerId }`.
  - The workflow ([`prepare-company-bc-sync.ts`](../../apps/backend/src/workflows/company/steps/prepare-company-bc-sync.ts))
    resolves the company through `customer.employee.company` and ignores `:id`.
- **Correction to BUG.md:** BUG.md says the route has no ownership check. That is wrong.
  - [`middlewares.ts:53-60`](../../apps/backend/src/api/store/companies/middlewares.ts) applies
    `ensureCompanyAccess(false)` to `GET /store/companies/:id`.
  - That runs `authorizeCompanyAccessWorkflow` against `req.params.id`, so a customer cannot read
    another company, or trigger a sync through it.
- The mismatch is therefore **latent**. Today the access check guarantees that `:id` is the
  caller's company. It turns into a real bug if the check is ever relaxed, for example for
  multi-company employees or sales reps. Nothing in the route itself enforces the invariant.
- The failure log line names `:id`, not the company that was actually synced.
- The same workflow is used on login by `POST /store/customers/me/company/sync-business-central`.
  That path has no target company and must keep its current behaviour.

## In Scope

1. Guard the freshness sync so it only runs when the company resolved from the authenticated
   customer equals `:id`.
   - Preferred direction: add an optional expected company id to the workflow input
     (`SyncCompanyFromBusinessCentralInput` / `PrepareCompanyBcSyncInput`).
   - `prepareCompanyBcSyncStep` returns `skipped` when the resolved company id doesn't match it.
   - The route passes `:id`. The login route passes nothing and is unchanged.
   - The planner may pick an equivalent approach, as long as the guard is covered by tests.
2. On a mismatch, make no Business Central call, don't update the timestamp, and return the
   stored company for `:id` as today.
3. Integration test coverage for the mismatch case. Relaxing access control isn't in scope, so
   the test can drive the workflow directly with a non-matching company id, or unit-test the
   step.
4. Keep existing tests green: NIMBUS-160 freshness tests (fresh / stale-success / stale-failure /
   no-timestamp) and the login sync tests.

## Out of Scope

- Changes to `ensureCompanyAccess`, `authorizeCompanyAccessWorkflow` or any company-route
  authorization.
- Syncing a company other than the caller's own (option a).
- Rejecting mismatched requests with 403/404 (option c).
- Storefront changes.
- Changes to the freshness window, which company fields are mapped, or retry/throttling behaviour.
- Rewording the existing log message beyond what the guard needs.

## Behavioral Contract

| Situation | Required behavior |
| --- | --- |
| `:id` = caller's company, stale | Sync as today (NIMBUS-160 contract unchanged). |
| `:id` = caller's company, fresh | No sync, as today. |
| `:id` ≠ caller's company (only reachable if access control changes) | No Business Central call, `business_central_synced_at` of both companies unchanged, return stored `:id` company with 200. |
| Login sync (no expected company id) | Unchanged — syncs the caller's company. |

## Acceptance Criteria

- [ ] When the expected company id doesn't match the customer's company, the sync workflow does
  not call `BusinessCentralService.getCustomer` and returns status `skipped`.
- [ ] `GET /store/companies/:id` passes `:id` as the expected company id to the sync.
- [ ] The login sync route behaves exactly as before.
- [ ] A test covers the mismatch case. The existing NIMBUS-160 freshness tests and the
  company-sync tests pass.
- [ ] Backend build and lint pass for changed files.

## Likely Implementation Areas

- `apps/backend/src/api/store/companies/[id]/route.ts`
- `apps/backend/src/workflows/company/workflows/sync-company-from-business-central.ts`
- `apps/backend/src/workflows/company/steps/prepare-company-bc-sync.ts`
- `apps/backend/integration-tests/http/companies/companies.spec.ts` and/or
  `apps/backend/integration-tests/http/customers/company-sync.spec.ts`

## Verification

- Run the focused backend HTTP integration tests for companies and company sync.
- Confirm that a mismatched expected company id causes no Business Central request.

## Handover

Use the `implementation-planner` agent to turn this scope into a short task list and manifest in
this folder. Implement directly on `develop`.
