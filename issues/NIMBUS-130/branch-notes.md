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
