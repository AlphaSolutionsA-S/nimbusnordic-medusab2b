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
