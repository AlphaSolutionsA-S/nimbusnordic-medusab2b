# Implementation Manifest: NIMBUS-144 + NIMBUS-147 — Order Ingestion Endpoint and Canonical Contract

**Project ID:** NIMBUS-129-order-ingestion
**Date:** 2026-09-02
**Ready for Dispatch:** true
**Implemented:** 2026-09-16 on branch `feature/NIMBUS-129-order-ingestion`

## Scope Note

This manifest covers only the two approved, ready-to-implement stories in Epic NIMBUS-129:
**NIMBUS-144** (Receive normalized order JSON in Medusa) and **NIMBUS-147** (Define and validate
the canonical order contract). NIMBUS-145, NIMBUS-146, NIMBUS-148, NIMBUS-149, and NIMBUS-158
are NOT planned here — they remain in Jira "Scoping" status without an approved SCOPE.md.

**This plan now also includes a minimal, synchronous, header-only slice of NIMBUS-149's job**
(real Medusa order creation) — see PLAN.md's "Decisions & Trade-offs" for why, and for the
explicit note that NIMBUS-149 as a Jira story still has unaddressed requirements (traceability,
NIMBUS-158's integration-state fields) that whoever scopes it properly will need to reconcile
with what this plan actually built.

## Branch

`feature/NIMBUS-129-order-ingestion` (from `develop`)

## Tasks

| # | Title | File | App | Depends On | Status |
|---|-------|------|-----|------------|--------|
| 01 | Order Ingestion Module (canonical contract + dedupe-index model) | `01-order-ingestion-module-implementation.md` | backend | None | DONE |
| 02 | Canonical Order Contract (zod schema) | `02-canonical-order-contract-implementation.md` | backend | None | DONE |
| 03 | Synchronous Validate + Create Order Workflow | `03-create-order-workflow-implementation.md` | backend | 01, 02 | DONE |
| 04 | Post-Creation Async Event Chain | `04-order-ingestion-event-chain-implementation.md` | backend | 01, 03 | DONE |
| 05 | Order API Route + Middleware (NIMBUS-144 endpoint) | `05-order-api-route-implementation.md` | backend | 01, 02, 03, 04 | DONE |

**Task file renames from an earlier revision**: `03-receive-order-workflow-implementation.md`
and `04-process-incoming-order-workflow-implementation.md` no longer exist — they were superseded
by the architectural redesign (synchronous order creation + event-driven post-processing) and
replaced by `03-create-order-workflow-implementation.md` and
`04-order-ingestion-event-chain-implementation.md` respectively, which have entirely different
content, not incremental edits.

## Cross-Task Wiring Summary

- Task 01 exports `ORDER_INGESTION_MODULE` and `OrderIngestionModuleService` (now backing an
  `OrderExternalReference` dedupe-index model, not the old `IncomingOrder` audit table) —
  consumed by Tasks 03 and 04's tests.
- Task 02 exports `CanonicalOrderSchema` (a single schema now, not an envelope/canonical pair) —
  consumed directly by Task 05's middleware for body validation, and by Task 03's workflow for
  its `CanonicalOrder` TypeScript type. The shared test fixtures live in
  `src/modules/order-ingestion/__fixtures__/canonical-order-fixtures.ts` (moved out of
  `__tests__/` during implementation — see Deviations below), consumed by Tasks 03, 04, and 05's
  test files.
- Task 03 exports `createOrderFromCanonicalPayloadWorkflow` — consumed by Task 05's route
  handler. Its `matchCompanyAndCheckDuplicateStep`/`createOrderAndReferenceStep` are internal to
  this workflow, not consumed elsewhere.
- Task 04 exports `emitOrderIngestionCreatedEventWorkflow` (consumed by Task 05's route handler,
  fired without being awaited), `enrichOrderWorkflow`, and the event name constants
  `ORDER_INGESTION_CREATED_EVENT` / `READY_FOR_BUSINESS_CENTRAL_EVENT`. Its
  `order-ingestion-created` subscriber (`apps/backend/src/subscribers/order-ingestion-created.ts`)
  is auto-discovered by Medusa at startup — not imported/wired by any other task's code.
  `READY_FOR_BUSINESS_CENTRAL_EVENT` is the boundary a future NIMBUS-148 will subscribe to; no
  subscriber for it exists yet (deliberately — see Task 04's doc).
- Task 05's route awaits Task 03's workflow synchronously, then fires Task 04's initial event
  workflow without awaiting it, then responds with the real order id.

## Environment / Config Changes

- `apps/backend/medusa-config.ts` — registers the new `orderIngestion` module (Task 01). No
  change needed for `Modules.ORDER`, `Modules.EVENT_BUS`, or `Modules.API_KEY` — all are Medusa
  core modules registered by default.
- `apps/backend/src/api/middlewares.ts` — spreads in the new `/orderapi` namespace's middlewares
  (Task 05).
- New DB migration for the `order_external_reference` table (Task 01, via `npx medusa db:generate`
  + `db:migrate`).
- No env var changes. Auth for `/orderapi/orders` uses Medusa's built-in secret API key
  (`authenticate("user", ["api-key"])`, HTTP Basic auth) — created/managed via the Admin
  dashboard's `/admin/api-keys`, not an env var.
- `apps/backend/src/subscribers/order-ingestion-created.ts` is a new file — the first subscriber
  in this repo. No `medusa-config.ts` change needed; Medusa auto-discovers files under
  `src/subscribers/`.

## Test Infrastructure

Backend test infrastructure already exists (`apps/backend/jest.config.js`, three `TEST_TYPE`
gated commands). No scaffolding needed. All new tests follow existing conventions:
`pnpm test:unit` (Task 02), `pnpm test:integration:modules` (Task 01),
`pnpm test:integration:http` (Tasks 03, 04, 05).

## Deviations From the Plan Found During Implementation

Four things in the planned skeletons did not survive contact with the real repo. Each was
verified empirically (a failing test or a failing suite), not assumed:

1. **`canonical-order-fixtures.ts` moved out of `__tests__/`.** The plan put it at
   `src/modules/order-ingestion/__tests__/canonical-order-fixtures.ts`, but this repo's
   `test:integration:modules` glob is `**/src/modules/*/__tests__/**/*.[jt]s` — it picked the
   fixtures file up as a test suite and failed the whole run with "Your test suite must contain
   at least one test." The file now lives at
   `src/modules/order-ingestion/__fixtures__/canonical-order-fixtures.ts`; Tasks 02–05's test
   files import it from there.
2. **The model no longer has a `default` export.** The planned
   `export default OrderExternalReference` alongside the named export made MikroORM discover the
   entity twice — `MetadataError: Duplicate entity names are not allowed: OrderExternalReference`.
   The module now follows this repo's own convention (`company`, `quote`): a named export only,
   re-exported through `models/index.ts`, with `service.ts` importing from `./models`.
3. **Workflow rejections are serialized plain objects, not `MedusaError` instances.** This was
   the residual uncertainty Task 03's doc flagged, and it is real: the engine rejects with a
   plain object where `instanceof Error === false` but `type` (`"not_found"` /
   `"duplicate_error"`) and `message` survive. Consequence for tests: `.rejects.toThrow(/re/)`
   never matches, so Task 03's TC-2/TC-3 assert with `.rejects.toMatchObject({ type, message })`
   instead. **Consequence for the route: none.** Medusa's `errorHandler` keys off
   `err.type || err.name`, not `instanceof` — verified by reading
   `@medusajs/framework/dist/http/middlewares/error-handler.js` and confirmed by Task 05's TC-5
   (404) and TC-6 (422) passing. The route's no-try/catch design holds as planned.
4. **`currency_code` is persisted lowercase.** `createOrders({ currency_code: "DKK" })` reads
   back as `"dkk"`, so Task 03's TC-1 asserts `"dkk"`.

Minor style alignment (not defects): the skeletons used single quotes and imported
`MiddlewareRoute` from `@medusajs/framework`; the implementation uses this repo's actual
conventions — double quotes and `MiddlewareRoute` from `@medusajs/medusa`.
