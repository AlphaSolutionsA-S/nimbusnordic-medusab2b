# Implementation Manifest: NIMBUS-144 + NIMBUS-147 — Order Ingestion Endpoint and Canonical Contract

**Project ID:** NIMBUS-129-order-ingestion
**Date:** 2026-09-02
**Ready for Dispatch:** true

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
| 01 | Order Ingestion Module (canonical contract + dedupe-index model) | `01-order-ingestion-module-implementation.md` | backend | None | TODO |
| 02 | Canonical Order Contract (zod schema) | `02-canonical-order-contract-implementation.md` | backend | None | TODO |
| 03 | Synchronous Validate + Create Order Workflow | `03-create-order-workflow-implementation.md` | backend | 01, 02 | TODO |
| 04 | Post-Creation Async Event Chain | `04-order-ingestion-event-chain-implementation.md` | backend | 01, 03 | TODO |
| 05 | Order API Route + Middleware (NIMBUS-144 endpoint) | `05-order-api-route-implementation.md` | backend | 01, 02, 03, 04 | TODO |

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
  its `CanonicalOrder` TypeScript type. Also exports the test fixtures file
  `canonical-order-fixtures.ts`, consumed by Tasks 03, 04, and 05's test files.
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
