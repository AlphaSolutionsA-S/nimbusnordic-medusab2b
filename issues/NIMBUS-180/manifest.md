# Manifest: Order API matches size barcodes to the right Business Central item and size

**Key:** NIMBUS-180
**Issue:** NIMBUS-180
**Branch:** feature/NIMBUS-180 (from develop)
**Ready for Dispatch:** true (plan approved by Klaus Petersen, 2026-10-23)

## Conventions and commands

All tasks are in `apps/backend` (`<f>` = `pnpm --filter @b2b-starter/backend`), run from the repo root.

- Scoped unit test: `<f> test:unit -- <path>`; Admin widget test: `<f> test:admin -- <path>`.
- Lint: `<f> lint`. Typecheck: `apps/backend/node_modules/.bin/tsc --noEmit -p apps/backend`
  (the filter form can report "tsc not found" on Windows); compare against the recorded baseline.
- Unit tests: `src/**/__tests__/*.unit.spec.ts`, run by `test:unit`. The business-central module's
  existing fetch-mocked tests (`src/modules/business-central/__tests__/item-lookup.spec.ts`,
  `sales-order-create.spec.ts`) have no `.unit` suffix and run only with
  `<f> test:integration:modules -- <path>` (no database needed); a new pure-mapping test may use
  `.unit.spec.ts`. HTTP integration tests:
  `integration-tests/http/business-central-order/`, run once at finalization
  (`pnpm test:integration:http`, local Postgres, `BUSINESS_CENTRAL_DISCOVERY_URL` must be an allowed
  test environment).
- BC responses in tests are synthetic; use the TestDK rows in `samples/` as fixture shapes
  (`bc-variant-barcodes-testdk.md`, `bc-item-lookup-probe-planner.md`). No test calls BC.
- No migrations, no new module, no new dependency.

## Tasks

| # | Title | File | App | Implements | Depends on | Issue | Status |
|---|-------|------|-----|------------|------------|-------|--------|
| 01 | Adapter reads item lookup evidence per order and sends `itemVariantId` | `01-adapter-item-evidence.md` | backend | F1, F2, NF BC load, NF throttling, NF ODataV4 helper, NF logs | None | NIMBUS-232 | DONE |
| 02 | Barcode resolution rule and the two new line-failure reasons | `02-barcode-resolution-rule.md` | backend | F1, F3, F4, F5, all business rules | 01 | NIMBUS-233 | DONE |
| 03 | Submission uses the rule and sends the size | `03-submission-wiring.md` | backend | F2, F4, F6 | 01, 02 | NIMBUS-234 | DONE |
| 04 | Documentation and schema comment | `04-docs.md` | backend | Proposed structure 4 | 03 | NIMBUS-235 | TODO |

## Scope items with no task

| Scope item | Reason |
|---|---|
| Proposed structure 5 (after-deploy order with `5712094132141`) | not provable in the pipeline; it is task 03's "Verify after deploy" |
| Confirm the ODataV4 call shape against TestDK | already done by the planner (read-only probe, `samples/bc-item-lookup-probe-planner.md`) |
| Size on shipment notices | out of scope, NIMBUS-231 |
| Telling the customer about refused lines | out of scope (Admin widget only) |
