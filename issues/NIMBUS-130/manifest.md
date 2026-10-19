# Manifest: Return shipment notices to API customers

**Key:** NIMBUS-130
**Issue:** NIMBUS-130
**Branch:** feature/NIMBUS-130 (from develop)
**Ready for Dispatch:** true (plan approved by the human 2026-10-19; dispatch needs a separate go-ahead)

## Conventions and commands

- **Commands:** backend package `@b2b-starter/backend` (`<f>` = `pnpm --filter @b2b-starter/backend`).
  - Scoped unit test: `<f> test:unit -- <path>`.
  - Lint: `<f> lint`.
  - Typecheck: `apps/backend/node_modules/.bin/tsc --noEmit -p apps/backend` (the filter form can
    report "tsc not found" on Windows), at or below the baseline in `ai/architecture/verification.md`.
- **Integration tests** need local Postgres and an allowed BC test environment, and run once at
  finalization (`pnpm test:integration:modules`, `pnpm test:integration:http`), not per task.
  - Module tests: `src/modules/order-ingestion/__tests__/*.spec.ts`.
  - HTTP tests: `integration-tests/http/**`.
- **Unit tests:** `src/**/__tests__/*.unit.spec.ts`. BC adapter tests mock `global.fetch` as the
  existing `modules/business-central/__tests__/*.spec.ts` do. Never read source as text in a test.
- **Workflow tests** stub the BC adapter's new read methods at the module boundary to supply shipment
  data. They never mock framework services to assert call order.
- **Migrations:** `<f> exec medusa db:generate orderIngestion`, then `<f> exec medusa db:migrate`;
  never hand-written. The shared module is `orderIngestion`: tasks 02, 06, 07 and 09 use its service.
- **Validation:** `z` from `@medusajs/framework/zod`. Logs carry counts, order numbers and shipment
  numbers only.
- **Azure artifacts** (task 10) go in `issues/NIMBUS-130/artifacts/`. NIMBUS-145/146 artifacts are
  frozen records and are not edited.

## Tasks

| # | Title | File | App | Implements | Depends on | Issue | Status |
|---|-------|------|-----|------------|------------|-------|--------|
| 01 | Shipment notice contract (schemas incl. error, JSON Schema, XSD, examples) | `01-shipment-notice-contract.md` | backend + artifacts | Contract, Response format (incl. XML errors) | None | NIMBUS-181 | TODO |
| 02 | Storage: notices, tracking, poll state; store against expected revision | `02-shipment-notice-storage.md` | backend | Stored notice, Watermark design, Data model, correctness (F1, F7) | None | NIMBUS-182 | TODO |
| 03 | Keep BC line numbers in the BC outcome at submission | `03-capture-bc-line-map.md` | backend | P1, Q10 (F3) | None | NIMBUS-183 | TODO |
| 04 | Business Central shipment reads (count, complete window, by number) | `04-bc-shipment-reads.md` | backend | Polling BC side, BC load (F2, F4) | None | NIMBUS-184 | TODO |
| 05 | Decision and schedule: match, netting, revision, check schedule | `05-shipment-notice-decision.md` | backend | R1, R2, R4–R7, P8 (F5, F6, F8) | 01, 04 | NIMBUS-185 | TODO |
| 06 | Discovery scan (lead and trail windows, tracking upsert) | `06-discovery-scan.md` | backend | Polling discovery, R1, R2, R4 (F2) | 02, 03, 04, 05 | NIMBUS-186 | TODO |
| 07 | Shipment checks (bounded, against expected revision) | `07-shipment-checks.md` | backend | R5–R7, R9 (F1, F4, F5, F6) | 02, 03, 04, 05 | NIMBUS-189 | TODO |
| 08 | Polling job with run deadline and progress warnings | `08-poll-job.md` | backend | Polling schedule, lock-single-run, observability (F4) | 06, 07 | NIMBUS-190 | TODO |
| 09 | `GET /orderapi/shipment-notices` read endpoint | `09-read-endpoint.md` | backend | Read endpoint, R8, cursor API, security | 01, 02 | NIMBUS-187 | TODO |
| 10 | APIM GET operation (XML incl. errors) and Logic App workflow | `10-apim-logic-app.md` | Azure artifacts | Customer path, Response format | 01, 09 | NIMBUS-188 | TODO |
| 11 | Admin page: list `gave_up` shipments and retry | `11-admin-gave-up-retry.md` | backend (admin routes + Admin UI) | Decision 8 recovery | 02, 05, 07 | NIMBUS-191 | TODO |

## Scope items with no task

| Scope item | Reason (already done / external / not needed) |
|---|---|
| P3 production data check | External: pre-go-live check by the lead dev (plan section 10); no production credentials here |
| R3 shipments of canceled Medusa orders reported | Not needed: no rule filters on Medusa order state |
| R10 retention | Not needed: rows are never deleted, like `order_external_reference` (plan section 5) |
| R11 EDI DESADV runs side by side | Not needed: nothing to build; no deduplication by decision |
| NIMBUS-179 lock provider | External: separate bug |
| Carrier, tracking, weights (Q11), prices (Q14) | Not needed: left out by decision |
| Business Central, storefront, CMS changes | Not needed: none in scope |
| `docs/architecture/` for the order API, shipment notices and tracking-row recovery | After ship: `documentation-writer` |
