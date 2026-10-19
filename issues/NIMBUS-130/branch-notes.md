# Branch notes: NIMBUS-130

## Task 01: shipment notice contract

- `apps/backend/src/modules/order-ingestion/shipment-notice-contract.ts` (pure, zod 4 via
  `@medusajs/framework/zod`): `ShipmentNoticeEnvelopeSchema`, `ShipmentNoticeSchema`,
  `ShipmentNoticeLineSchema`, `ShipmentNoticePartySchema`, `ShipmentNoticeShipToSchema`,
  `ShipmentNoticePayloadSchema` + type `ShipmentNoticePayload` (task 05 builds, task 02 stores),
  `ShipmentNoticeErrorBodySchema` (union of `MedusaErrorBodySchema` and `GatewayErrorBodySchema`),
  `SHIPMENT_NOTICE_STATUSES` / `ShipmentNoticeStatus`.
- All objects are `.strict()`: a mapper must emit exactly the contract keys, with `null` (never
  `undefined` or a missing key) for empty values; `lines` needs at least one line; `quantity` ≥ 0.
- `recorded_at` must be UTC with `Z` (`Date#toISOString()` fits); dates are `YYYY-MM-DD`; cursors
  are decimal strings (convert the integer `sequence` with `String()`).
- Example envelope: `__fixtures__/shipment-notice-fixtures.ts` (`shipmentNoticeEnvelopeExample`),
  identical to `issues/NIMBUS-130/artifacts/shipment-notices.example.json`.
- Artifacts for task 10: `shipment-notice-schema.xsd` (roots `shipment_notice_response` and
  `error_response`, no namespace, nulls omitted), JSON and XML examples of success and both error
  shapes (`error-service.*`, `error-gateway.*`). The service's `code` is not rendered in XML.
- Verified: Medusa error body is `{ code, type, message }` with `code` dropped when undefined
  (`@medusajs/framework` 2.21.2 `dist/http/middlewares/error-handler.js`); Zod errors give
  `{ type: "invalid_data", message }`.
- Validation scripts (re-runnable after a contract change) are in the run scratchpad:
  `validate-json-artifacts.js <repoRoot>` and `validate-xml-artifacts.ps1 -Artifacts <dir>`.

## Task 02: shipment notice storage

- Types and input shapes: `modules/order-ingestion/shipment-notice-storage.ts`
  (`StoreShipmentNoticeInput`, `StoreShipmentNoticeResult`, `ShipmentTrackingSchedule`
  (`action: "reschedule" | "close"`), `ShipmentTrackingDiscovery`, `ShipmentTrackingRow`,
  `ShipmentNoticeRow`, `ShipmentPollState`, `CompanyShipmentNoticeQuery`, close-reason constants).
- `orderIngestion` service methods: `storeShipmentNotice`, `upsertShipmentTracking` →
  `{ inserted, updated }`, `listDueShipmentTracking({ now, limit })`,
  `rescheduleShipmentTracking(bcShipmentId, …)` / `closeShipmentTracking(bcShipmentId, …)` → `false`
  when the row is not open, `listGaveUpShipmentTracking({ limit, offset })` → `{ rows, count }`,
  `reopenShipmentTracking(id, actorId)` (`NOT_ALLOWED` → 400 unless `gave_up`, `NOT_FOUND`),
  `retrieveShipmentPollState()` (null before first run), `initializeShipmentPollState(now)` →
  `{ state, created }`, `setShipmentPollCursor("lead" | "trail", date)`,
  `setShipmentPollBackoff(date | null)`, `listCompanyShipmentNotices({ company_id, limit, after | since })`
  (returns up to `limit + 1` rows; use `after: 0` for the start).
- The store throws `NOT_FOUND` if the poll state row or the tracking row is missing: tests and
  workflows must initialize state and upsert tracking first. It writes tracking only on `stored`.
- `sequence` and cursors are `integer` (int4) columns; raw rows come back as `number`, timestamps as
  `Date`, `payload` as parsed JSON. Convert `sequence` with `String()` for the wire.
- Every method takes an optional last `{ transactionManager }` context; passing one runs it inside
  the caller's transaction (verified: `@medusajs/utils` 2.21.2 `inject-transaction-manager.js`).
- Module specs run with `pnpm --filter @b2b-starter/backend test:integration:modules -- <path>`
  (local Postgres works here); the runner builds the schema from the models, not the migration.
- `medusa db:migrate` hangs after applying here (link-sync prompt); check the DB instead.

## Task 03: BC line map at submission

- Read the map with `parseBcIntegrationState(order.metadata[BC_INTEGRATION_STATE_METADATA_KEY]).bc_lines`
  (`modules/order-ingestion/bc-integration-state.ts`): `BcOrderLineMapEntry[] | null`, entries
  `{ line_number, ean_no: string | null, bc_sequence: number | null }`. `null` = older order, no map.
- Only accepted lines are in the map; `bc_sequence` can be null (BC 201 body without `sequence`),
  so a shipment line with no matching entry must be handled, not assumed impossible.
- The map always belongs to the current `bc_order_number` (both replaced together when an attempt
  creates a BC order, including an all-lines-rejected one, which records an empty map).
- Adapter: `BCCreatedSalesOrder.acceptedLines: BCAcceptedSalesOrderLine[]` (`types.ts`) beside the
  existing `acceptedLineNumbers`; test fixtures of `BCCreatedSalesOrder` need both.
- `AdminBcIntegration` omits `bc_lines` (the Admin spec asserts exact keys and no `ean_no`).
- `sales-order-create.spec.ts` is not `*.unit.spec.ts`: run it with
  `pnpm --filter @b2b-starter/backend test:integration:modules -- <path>` (no DB needed).
- `send-order-to-bc.spec.ts` plus the subscriber spec take about 10 minutes locally; run them in
  the background with a timeout above 600 s.

## Task 04: BC shipment reads

- Service methods (`IBusinessCentralModuleService`): `countShipments({ after, until })` → number,
  `listShipmentHeaders({ after, until })` → `BCShipmentHeader[]` (ascending, whole window or throw),
  `getShipmentsByNumbers(numbers)` → `BCShipment[]` (unknown numbers absent, `[]` → no request).
- Types in `modules/business-central/types.ts`: `BCShipmentWindow`, `BCShipmentHeader`, `BCShipment`
  (`shipmentMethodCode`, `yourReference`, `sellTo`/`billTo` `BCShipmentParty`, `shipTo`
  `BCShipmentShipTo`, `lines`), `BCShipmentLine`, `BCShipmentLineType` (`item | comment | other`).
- Every text field is `string | null` (empty → null); dates `YYYY-MM-DD` or null; `lastModifiedDateTime`
  is BC's ISO string (parse it if you need a `Date`). Lines come unsorted, as BC returns them.
- Throttling: `BusinessCentralThrottledError` (`modules/business-central/shipment-reads.ts`, importable
  without the service) with `retryAfterSeconds: number | null`; apply the plan's "at least 1 min" in
  the caller. Other failures (incl. 20 s timeouts) are `MedusaError` `UNEXPECTED_STATE`.
- The token cache lives on the service instance (a container singleton), so it survives across runs.
- Workflow tests stub these three methods on the resolved `businessCentral` service; no fetch mocking.
- `service.spec.ts` "round-trip guardrail" fails on HEAD too (baseline), not a regression.

## Task 05: decision and schedule

- `workflows/shipment-notice/utils/match-shipment-order.ts`: `matchShipmentToOrder(header,
  candidates, goLiveAt)` (generic: returns the candidate object you passed) with
  `ShipmentOrderCandidate { company_id, business_central_customer_number, order_id,
  external_order_number, bc_state }` (`bc_state` = `parseBcIntegrationState(...)`);
  `isCurrentBcOrder(bcOrderNumber, state)` for task 07's `superseded` check.
- `utils/decide-shipment-notice.ts`: `decideShipmentNotice({ shipment: BCShipment, order: { order_id,
  external_order_number, bc_order_number, posting_date, bc_lines }, latest })`, `latest` =
  `{ revision, content_hash, listed_bc_line_numbers }` or null (build the list from the latest
  notice's `payload.lines[].bc_line_number`). Returns `record | nothing | unpairable(sequence)`.
- `utils/shipment-check-schedule.ts`: `initialShipmentSchedule({ postingDate, lastModifiedDateTime })`
  for discovery's `next_check_at`/`recheck_until`; `scheduleShipmentCheck(row, outcome, now)` →
  `ShipmentTrackingSchedule` (pass as `tracking` to the store, or to reschedule/close). Outcomes:
  `checked` (nothing or shipped/revised stored), `cancelled`, `superseded`, `conflict`,
  `failed { error }` (error code only). Compute it before the store: a "record" uses `checked`, or
  `cancelled` when the decision's status is `cancelled`.
- Hash is sha256 hex over net > 0 lines only; a `cancelled` revision stores the hash of no lines.
- `pnpm ai:check` fails locally on AGENTS.md size (CRLF on disk); see task 05 deviations.

## Task 06: discovery scan

- `workflows/shipment-notice/workflows/discover-shipments.ts`: `discoverShipmentsWorkflow`,
  input `{ deadline: Date }`, result `DiscoverShipmentsResult` `{ headers, matched, tracked,
  lead_lag_ms, trail_lag_ms, complete }`; lags = run start − cursor after the run.
- It does not check `bc_backoff_until` (task 08 skips the run); on throttling it sets the back-off
  (`max(Retry-After, 60 s)`) and returns `complete: false` without throwing. Any other BC or DB
  error rejects the workflow (cursor kept at the last complete window), so wrap it if checks must
  still run.
- The scan loop lives in `steps/scan-shipment-windows.ts` (used twice with `.config({ name })`:
  `scan-lead-shipment-windows`, `scan-trail-shipment-windows`). Deadline is checked with
  `Date.now()` before each BC request; tests spy `Date.now` to pass it mid-window.
- Pure helpers in `utils/discovery-window.ts`: `shipmentScanBounds`, `halveShipmentWindow`,
  `shipmentTrackingForHeaders`, constants `SHIPMENT_SETTLING_MS`, `SHIPMENT_TRAIL_LAG_MS`,
  `SHIPMENT_WINDOW_HEADER_BUDGET`, `SHIPMENT_MIN_BACKOFF_SECONDS`.
- Order candidates: companies via Query (`companies`, filter on `business_central_customer_number`),
  references via `listOrderExternalReferences`, order metadata via a commented narrow
  `query.graph` on `order` (the same read task 07 needs for `isCurrentBcOrder`).
- Step results carry dates as ISO strings. Integration spec
  `integration-tests/http/shipment-notice/discover-shipments.spec.ts` (about 2 min) has a
  window-honouring BC fake and a `seedApiOrder` helper (company + order with BC state + reference);
  `createCompanies` needs every `ModuleCreateCompany` field or it adds typecheck errors.

## Task 07: shipment checks

- `workflows/shipment-notice/workflows/check-shipments.ts`: `checkShipmentsWorkflow`, input
  `{ deadline: Date }`, result `CheckShipmentsWorkflowResult` `{ checked, recorded, unchanged,
  conflicts, errors, backlog_due, oldest_due_age_ms, status }`; `SHIPMENT_CHECK_BATCH_SIZE` (200) is
  exported from `steps/prepare-shipment-checks.ts`.
- It never throws for a per-shipment or BC problem (they become `errors` and `last_error` codes);
  only DB errors reject. It does not check `bc_backoff_until` itself; a throttled run sets it.
- `backlog_due` / `oldest_due_age_ms` are measured after the checks: use them as-is for the
  stalled-progress warning.
- Step names `prepare-shipment-checks`, `check-shipments`, `set-shipment-check-backoff`,
  `measure-shipment-backlog` do not collide with the discovery workflow's. The workflow id is also
  `check-shipments` (same as its step); harmless standalone, but give it a `.config({ name })` if
  nesting with `runAsStep` complains.
- The spec takes about 2 min (250-row batch test); knex "Connection ended unexpectedly" console
  lines in its output are pool noise, not failures. Check for stale jest processes holding the DB
  before re-running.

## Task 08: polling job

- `jobs/poll-shipment-notices.ts`: default `pollShipmentNoticesJob(container)`, `config`
  (`shipment-notice-poll`, every minute), `SHIPMENT_NOTICE_POLL_LOCK_KEY`, `..._LOCK_TTL_SECONDS`.
  It never throws (Medusa's job wrapper would log `error.message`).
- The job is disabled under `NODE_ENV=test` via `defineFileConfig`; a spec imports and calls it.
  Any later job needs the same guard or it fires inside every integration spec.
- `workflows/poll-shipment-notices.ts`: `pollShipmentNoticesWorkflow` (no input) →
  `ShipmentPollSummary` (`utils/shipment-poll.ts`); discovery and checks via `runAsStep` (step
  names `discover-shipments-as-step`, `check-shipments-as-step`, no collision).
- Verified: inside `when()`, a skipped sibling's result is `undefined` to a later `when` condition
  and `transform`; the poll spec covers both skip paths.
- Pure helpers: `isShipmentPollBackedOff`, `shipmentPollDeadline`, `shipmentPollLogLines`.
- `integration-tests/http/shipment-notice/poll-shipment-notices.spec.ts` takes about 75 s.
