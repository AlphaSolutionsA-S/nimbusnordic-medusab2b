# Implementation Manifest: Sync Business Central customer data to Medusa company on login

**Project ID:** NIMBUS-156
**Date:** 2026-08-21
**Ready for Dispatch:** true

## Branch

`feature/NIMBUS-156` (from `develop`)

## Tasks

| # | Title | File | App | Depends On | Status |
|---|-------|------|-----|------------|--------|
| 01 | BC module `getCustomer` + typed contract | `01-bc-get-customer-implementation.md` | backend | None | DONE |
| 02 | Company model fields + migration | `02-company-model-migration-implementation.md` | backend | None | DONE |
| 03 | Sync workflow + steps | `03-sync-company-workflow-implementation.md` | backend | 01, 02 | DONE |
| 04 | Protected sync route + middleware | `04-sync-route-implementation.md` | backend | 03 | DONE |
| 05 | Storefront login sync helper | `05-storefront-login-sync-implementation.md` | storefront | 04 | DONE |
| 06 | Validation, tests & migration verification | `06-validation-implementation.md` | backend + storefront | 01, 02, 03, 04, 05 | VALIDATED — BASELINE BLOCKERS |

## Dispatch order

1. Tasks **01** and **02** are independent and may run in parallel.
2. Task **03** requires both 01 and 02.
3. Task **04** requires 03.
4. Task **05** requires 04 (endpoint contract must exist).
5. Task **06** is the final validation gate across all tasks.

## Apps affected

- `apps/backend` — BC module, company module/model/migration, workflow, store route, middleware.
- `apps/storefront` — login server action + SDK helper.

## Test strategy

- **Backend module tests** (`pnpm --filter @b2b-starter/backend test:integration:modules`):
  extend `business-central/__tests__/service.spec.ts` for `getCustomer`; add workflow tests under
  a module `__tests__` (or colocated) directory.
- **Backend integration HTTP test** (`test:integration:http`): authenticated + unauthenticated
  coverage of the sync route using `medusaIntegrationTestRunner`.
- **Storefront test** (`apps/storefront` jest): focused helper test proving one sync attempt
  follows login and its failure is non-fatal (mirrors `src/__tests__/lib/data/cms.test.ts`).
- **Build**: `pnpm --filter @b2b-starter/backend build` and storefront type/build.
- **Migration**: apply on a disposable DB; verify defaults/nullability and reversibility.
