# Implementation Manifest: Ensure Business Central company data is fresh before viewing Company page

**Project ID:** NIMBUS-160
**Date:** 2026-08-21
**Ready for Dispatch:** true

## Branch

`feature/NIMBUS-160` (from `develop`)

## Tasks

| # | Title | File | App | Depends On | Status |
|---|-------|------|-----|------------|--------|
| 01 | Company `business_central_synced_at` field + migration | `01-backend-company-synced-at-field.md` | backend | None | DONE |
| 02 | Stamp timestamp on successful sync | `02-backend-set-sync-timestamp.md` | backend | 01 | DONE |
| 03 | GET route freshness orchestration | `03-backend-company-get-freshness.md` | backend | 01, 02 | DONE |
| 04 | Storefront company retrieve cache TTL | `04-storefront-company-cache-ttl.md` | storefront | 03 | DONE |
| 05 | Backend freshness integration tests | `05-backend-freshness-integration-tests.md` | backend | 01, 02, 03 | BLOCKED - PostgreSQL is reachable with configured `DB_*` credentials, but Medusa startup cannot acquire a connection while creating throwaway databases (`Unable to acquire a connection`; PostgreSQL logs `terminating connection due to administrator command`); no freshness assertion executed |

## Dispatch order

1. Task **01** first (model + migration underpins everything).
2. Task **02** requires 01 (uses the new field in the update).
3. Task **03** requires 01 and 02 (reads the timestamp, relies on the workflow stamping it).
4. Task **04** requires 03 (the backend gate must exist before the storefront relies on it).
5. Task **05** is the validation gate across 01–03 (and exercises the failure path).

## Apps affected

- `apps/backend` — company model/type/migration, prepare-sync step, `store/companies/:id` GET route,
  integration tests.
- `apps/storefront` — one-line cache TTL on `retrieveCompany`.

## Test strategy

- **Backend integration HTTP** (`medusaIntegrationTestRunner`, mirroring
  `integration-tests/http/customers/company-sync.spec.ts`): fresh (no BC call), missing timestamp
  (BC called), stale success (BC called, timestamp advanced), stale failure (`MedusaError` →
  HTTP 200, previous fields, timestamp unchanged). Mock `BusinessCentralService.getCustomer`.
- **Build:** `pnpm --filter @b2b-starter/backend build`.
- **Migration:** apply on a disposable DB; verify the column is nullable and reversible.
- **Storefront:** the cache change is a one-line `next.revalidate` addition; no new storefront test
  is required (no existing test asserts `retrieveCompany` cache options).
