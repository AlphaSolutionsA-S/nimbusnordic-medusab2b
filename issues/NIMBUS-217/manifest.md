# Manifest: Only companies enabled for the order API can place orders and receive shipment notices

**Key:** NIMBUS-217
**Issue:** NIMBUS-217
**Branch:** feature/NIMBUS-217 (from develop)
**Ready for Dispatch:** true

## Conventions and commands

All tasks are in `apps/backend` (`@b2b-starter/backend`); `<f>` = `pnpm --filter @b2b-starter/backend`.

- Unit (pure functions): `<f> test:unit -- <path>`; files `src/**/__tests__/*.unit.spec.ts`.
- Admin UI: `<f> test:admin -- <path>`; files `src/admin/**/__tests__/*.test.tsx`.
- Contract (HTTP, real Postgres): `<f> test:integration:http -- <path>`; files
  `integration-tests/http/<area>/*.spec.ts`. Requires `BUSINESS_CENTRAL_DISCOVERY_URL` to be an
  allowed test environment (`integration-tests/global-setup.ts`).
- Lint: `<f> lint`. Typecheck: `apps/backend/node_modules/.bin/tsc --noEmit` (at or below baseline).
- Migrations are generated, never hand-written: `<f> exec medusa db:generate company` (task 01),
  `<f> exec medusa db:generate orderIngestion` (task 04), then `<f> exec medusa db:migrate`.
- Seeds: `integration-tests/utils/shipment-notices.ts` `createApiCustomerCompany` is the shared
  seed for API companies; tasks 03 and 04 make API-company seeds switch the setting on.

## Tasks
| # | Title | File | App | Implements | Depends on | Issue | Status |
|---|-------|------|-----|------------|------------|-------|--------|
| 01 | Company setting `order_api_enabled`: model, migration, Admin read/update, kept out of store and BC sync | `01-company-setting.md` | backend | F1, R12, R13, R14 | None | NIMBUS-218 | DONE |
| 02 | Admin UI: show and edit the setting on the company page | `02-admin-company-setting-ui.md` | backend (admin) | F2 | 01 | NIMBUS-219 | TODO |
| 03 | Rule home and 403 for switched-off companies on both order API endpoints | `03-order-api-refusal.md` | backend | F3, F4, R1–R5, R8, R11, R15, N1–N3 | 01 | NIMBUS-220 | TODO |
| 04 | Shipment job: discovery skips and check run closes switched-off companies | `04-shipment-job-filter.md` | backend | F5, F6, R6, R7, R9, N2, N4 | 03 | NIMBUS-221 | TODO |
| 05 | Admin retry refuses a shipment of a switched-off company | `05-retry-refusal.md` | backend | R10 | 03 | NIMBUS-222 | TODO |

## Scope items with no task
| Scope item | Reason (already done / external / not needed) |
|---|---|
| F7, R13 go-live step (switch on today's API companies) | Not needed now: no production customers; Klaus switches companies on manually in Admin while testing (2026-10-23) |
| Proposed structure 6: `docs/architecture/` section on the order API and shipment notices | `documentation-writer` after ship |
| APIM / Logic App passing on the 403 (O2) | External: Klaus handles it outside this repo (NIMBUS-178) |
| NIMBUS-216 overview showing the setting | Not part of this story (scope, Dependencies) |
