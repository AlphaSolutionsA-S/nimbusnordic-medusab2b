# Implementation Manifest: Company freshness sync can refresh the wrong company

**Project ID:** NIMBUS-161
**Date:** 2026-09-30
**Ready for Dispatch:** true

> On 2026-09-30 the user approved the plan, including OQ-1: a mismatch writes a `logger.warn`
> line that names both company ids.

## Branch

`develop`. Work directly on develop, with no feature branch (XS bug, per SCOPE.md).

## Tasks

| # | Title | File | App | Depends On | Status |
|---|-------|------|-----|------------|--------|
| 01 | Expected-company guard in the BC sync step, workflow and GET route | `01-backend-expected-company-guard-implementation.md` | backend | None | DONE |
| 02 | Integration tests for the guard, plus regression run | `02-backend-expected-company-guard-tests-implementation.md` | backend | 01 | DONE |

## Dispatch order

1. Task **01**: the guard in `prepare-company-bc-sync.ts`, the input type in
   `sync-company-from-business-central.ts`, and `expectedCompanyId: id` in
   `store/companies/[id]/route.ts`.
2. Task **02**: the workflow-level mismatch and match tests in `company-sync.spec.ts`, and a
   regression run of `company-sync.spec.ts` and `companies.spec.ts`.

## Apps affected

- `apps/backend` only. There are no storefront or admin changes and no migration.

## Test strategy

- **Backend HTTP integration** (`medusaIntegrationTestRunner`):
  - Run `syncCompanyFromBusinessCentralWorkflow` directly with a non-matching and a matching
    `expectedCompanyId`.
  - Business Central is mocked with `jest.spyOn(bcService, "getCustomer")`.
- **Regression:**
  - The NIMBUS-160 freshness tests in `integration-tests/http/companies/companies.spec.ts`.
  - The login sync tests in `integration-tests/http/customers/company-sync.spec.ts`.
- **Build/lint:** `pnpm --filter @b2b-starter/backend build`, and lint on the changed files.
