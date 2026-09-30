# Task 01: Expected-company guard in the Business Central sync — Implementation Plan

**Status:** DONE
**App:** backend
**App Root:** apps/backend
**Task ID:** 01
**Date:** 2026-09-30
**Branch:** `develop` (work directly on develop, no feature branch)
**Depends on:** None

---

## Project Environment

- **App root:** `apps/backend`
- **Build command:** `pnpm --filter @b2b-starter/backend build`
- **Lint command:** `pnpm lint` (from repo root). Lint only the changed files if the full run is
  noisy.
- **Test command:** see Task 02. This task has no test file of its own.
- **Test framework:** Jest (`medusaIntegrationTestRunner` for HTTP integration tests)
- **Naming conventions:** keep the existing camelCase workflow input keys (`customerId`), so the
  new key is `expectedCompanyId`. Match the existing file style: double quotes, semicolons,
  2-space indentation.

## Solution Design

`prepareCompanyBcSyncStep` resolves the company from `customer.employee.company`. Today it
ignores which company the caller wants refreshed. Add an **optional** `expectedCompanyId` to
the step input and the workflow input.

- If `expectedCompanyId` is set and the resolved company id is different, the step returns
  `{ status: "skipped", update: null }`. It does this **before** it resolves the Business
  Central service or calls `getCustomer`.
  - Because the result is `skipped`, `updateCompaniesStep` does not run, so no company data
    and no `business_central_synced_at` is written.
  - The workflow already maps `skipped` to the result `{ status: "skipped" }`.
- If `expectedCompanyId` is `undefined`, the behaviour is exactly as it is today. This is the
  login route's path.
- `GET /store/companies/:id` passes `expectedCompanyId: id`. After that, the route still
  re-reads and returns the stored `:id` company, as it does today.
- `POST /store/customers/me/company/sync-business-central` is **not touched**.

The guard runs after `companyId` is resolved and before the `bcCustomerNumber` check. A customer
with no company, and an expected id, still goes to the existing `!companyId` skip, so that result
is `skipped` either way.

On a mismatch the step writes a `logger.warn` line naming both ids, following the existing
`Business Central sync skipped: ...` warn. Company ids are not PII. The only log call that
changes is this new line. The route's existing `logger.error` is unchanged (see Open Question
OQ-1 in PLAN.md).

## Code Skeletons

### Modify: `apps/backend/src/workflows/company/steps/prepare-company-bc-sync.ts`

Input type (replace the existing type):

```typescript
export type PrepareCompanyBcSyncInput = {
  customerId: string;
  expectedCompanyId?: string;
};
```

Inside the step, after the existing lines:

```typescript
    const companyId = company?.id ?? null;
    const bcCustomerNumber =
      company?.business_central_customer_number ?? null;
```

and **before** the existing `if (!companyId || !bcCustomerNumber) {` block, insert:

```typescript
    if (
      companyId &&
      input.expectedCompanyId &&
      companyId !== input.expectedCompanyId
    ) {
      logger.warn(
        `Business Central sync skipped: customer company ${companyId} does not match expected company ${input.expectedCompanyId}`
      );
      return new StepResponse({ status: "skipped", update: null });
    }
```

Nothing else in this file changes. Do not touch the `failed` path, the `ready` mapping, or
`resolveCurrencyCode`.

### Modify: `apps/backend/src/workflows/company/workflows/sync-company-from-business-central.ts`

```typescript
export type SyncCompanyFromBusinessCentralInput = {
  customerId: string;
  expectedCompanyId?: string;
};
```

and the step call:

```typescript
    const prepared = prepareCompanyBcSyncStep({
      customerId: input.customerId,
      expectedCompanyId: input.expectedCompanyId,
    });
```

Nothing else in this file changes. The `when(...)`/`transform(...)` logic already handles
`skipped`.

### Modify: `apps/backend/src/api/store/companies/[id]/route.ts` (current develop, lines 54-62)

Change only the `input` object of the sync call:

```typescript
  if (customer_id && isStale(existing?.business_central_synced_at)) {
    try {
      await syncCompanyFromBusinessCentralWorkflow(req.scope).run({
        input: { customerId: customer_id, expectedCompanyId: id },
      });
    } catch (error) {
      logger.error(`Business Central freshness sync failed for company ${id}`);
    }
  }
```

Leave the rest of the file unchanged. That includes the `company-projection` imports,
`resolveCompanyActor`, `toStoreCompany(company, isAdmin)` and `DELETE`. NIMBUS-157 removed
`POST` from this file; do not re-add it.

### Do NOT modify

- `apps/backend/src/api/store/customers/me/company/sync-business-central/route.ts`: the login
  sync keeps `input: { customerId: customer_id }`.
- `apps/backend/src/api/store/companies/middlewares.ts`, `ensureCompanyAccess`,
  `authorizeCompanyAccessWorkflow`: authorization is out of scope.

## Impacted Files

| File | Change | New signature |
| --- | --- | --- |
| `apps/backend/src/workflows/company/steps/prepare-company-bc-sync.ts` | `PrepareCompanyBcSyncInput` gains an optional key; a mismatch guard is added | `type PrepareCompanyBcSyncInput = { customerId: string; expectedCompanyId?: string }` |
| `apps/backend/src/workflows/company/workflows/sync-company-from-business-central.ts` | Input type gains an optional key, which is forwarded to the step | `type SyncCompanyFromBusinessCentralInput = { customerId: string; expectedCompanyId?: string }` |
| `apps/backend/src/api/store/companies/[id]/route.ts` | `GET` passes `expectedCompanyId: id` | unchanged handler signature |

## Test Cases

Task 02 implements these. They are listed here so the guard's contract is clear.

### TC-1: Mismatched expected company is skipped without a BC call
- **Given:** a customer linked to Company A, and a separate Company B. Both have a BC customer
  number and a stale `business_central_synced_at`.
- **When:** `syncCompanyFromBusinessCentralWorkflow` runs with
  `{ customerId, expectedCompanyId: companyB.id }`.
- **Then:** the result is `{ status: "skipped" }`, `getCustomer` is not called, and both
  timestamps and Company A's name are unchanged.

### TC-2: Matching expected company still syncs
- **Given:** the same setup.
- **When:** the workflow runs with `{ customerId, expectedCompanyId: companyA.id }`.
- **Then:** the result is `{ status: "updated" }`, `getCustomer` is called once, and Company A's
  timestamp advances.

### TC-3: No expected company leaves the login sync unchanged (regression)
- **Given:** the existing `POST /store/customers/me/company/sync-business-central` tests.
- **When:** they run.
- **Then:** all of them pass unchanged.

### TC-4: The GET route still syncs its own company (wiring regression)
- **Given:** the existing NIMBUS-160 freshness tests in `companies.spec.ts`. They cover a fresh
  company, a missing timestamp, a stale sync that succeeds, and a stale sync that fails.
- **When:** they run.
- **Then:** all of them pass. The stale and missing-timestamp cases prove that passing
  `expectedCompanyId: id` for the caller's own company still triggers the sync.

## Implementation Steps

1. Edit `prepare-company-bc-sync.ts` exactly as shown in the skeleton: the type plus the guard
   block.
2. Edit `sync-company-from-business-central.ts`: the type plus forwarding
   `expectedCompanyId`.
3. Edit `[id]/route.ts`: add `expectedCompanyId: id` to the sync input.
4. Confirm that `sync-business-central/route.ts` has no diff.
5. Run `pnpm --filter @b2b-starter/backend build`, then lint the changed files.
6. Continue with Task 02.
