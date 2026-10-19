# 01: Shipment notice contract
**App:** backend + artifacts · **Layer:** L5 (pure contract file in `orderIngestion`) · **Depends on:** None

**Goal:** Fix the wire contract (plan section 5, "Contract") as Zod schemas and types for the success
envelope, one notice and the error body, shared by the decision function and the read endpoint. Also
the customer-facing JSON Schema, an XSD covering success and error XML, and JSON and XML examples of
both.
**Files / areas:** `apps/backend/src/modules/order-ingestion/` (new contract file beside
`canonical-order-schema.ts`); `issues/NIMBUS-130/artifacts/`.
**Seam contracts:**
- Exports the stored payload type (built by task 05, stored by task 02): the notice without `cursor`,
  `previous_cursor`, `recorded_at`, `revision` and `status`, which are row columns.
- Exports the envelope and error schemas (task 09).
- Status wire values: `shipped`, `revised`, `cancelled`.
- XML names (task 10): root `shipment_notice_response`, `shipment_notices/shipment_notice`,
  `lines/line`; null fields are omitted.
- Error XML: `error_response` with `error` (Medusa's `type`, or the gateway's `error`) and `message`.
  JSON errors are Medusa's `{ type, message, code? }` or the gateway's `{ error, message? }`.
**Test intent:**
- Unit: the envelope schema accepts the JSON example and rejects an unknown `status`, a non-string
  cursor and a missing `lines`.
- Unit: nullable fields (`line_number`, `ean_no`, `your_reference`, address parts) accept null.
- Unit: the error schema accepts both error shapes.
**Done when:**
- schemas exported and artifacts written;
- the JSON examples validate against both the Zod schemas and the JSON Schema;
- the XML examples match the XSD.
**Also update:** none found.

## Deviations

- Nullability the plan left open, chosen from task 04's mapping (empty BC strings become null):
  every `sell_to`/`bill_to`/`ship_to` field (including `customer_number` and `name`),
  `shipment_method_code`, `your_reference`, `previous_cursor`, and the line fields `line_number`,
  `ean_no`, `description`, `description_2`, `unit_of_measure_code` are nullable. Required non-null:
  the cursor, `recorded_at`, `revision`, `status`, the order and shipment numbers, both
  `shipment_date`s, `bc_line_number`, `item_number` (Item lines only) and `quantity`.
- Constraints added beyond the plan's list: `lines` has at least one line (every "record" outcome
  in plan section 6 lists lines); `quantity` is non-negative (net, 0 when undone); `revision` ≥ 1;
  cursors match `^(0|[1-9][0-9]*)$`; `recorded_at` must be UTC (`Z`); objects are strict (no
  extra fields, so nothing beyond the contract can leak into a response).
- The XSD has no target namespace (the NIMBUS-145 request XSD has one because APIM's
  validate-content needs it; this XSD describes a response APIM renders, so the plan's names are
  used unqualified). Task 10 renders the root without `xmlns`.
- Artifacts are split into two JSON Schemas (`shipment-notice-schema.json` for success,
  `shipment-notice-error-schema.json` for errors) and one XSD with both roots.
- Test cases added: empty page, each status accepted, extra field rejected, non-UTC
  `recorded_at` and non-`YYYY-MM-DD` date rejected, required line fields reject null, the stored
  payload schema (accepts the notice minus row columns, rejects one carrying a row column), error
  bodies with neither `type` nor `error` rejected.
- The JSON example is also the unit-test fixture (`__fixtures__/shipment-notice-fixtures.ts`) so
  the test does not read the case folder; a scratchpad script checks the two are equal.

## Done-when evidence

- Schemas exported: `apps/backend/src/modules/order-ingestion/shipment-notice-contract.ts`
  (`ShipmentNoticeEnvelopeSchema`, `ShipmentNoticeSchema`, `ShipmentNoticePayloadSchema` /
  `ShipmentNoticePayload`, `ShipmentNoticeErrorBodySchema`, `MedusaErrorBodySchema`,
  `GatewayErrorBodySchema`, `ShipmentNoticeStatusSchema`); `shipment-notice-contract.unit.spec.ts`,
  24 tests pass (envelope accepts the example; rejects unknown status, numeric and non-decimal
  cursor, missing `lines`; "accepts null in every nullable field"; error schema "accepts Medusa's
  body" / "accepts the gateway's body").
- Artifacts written: `issues/NIMBUS-130/artifacts/` `shipment-notice-schema.json`,
  `shipment-notice-error-schema.json`, `shipment-notice-schema.xsd`,
  `shipment-notices.example.json|.xml`, `error-service.example.json|.xml`,
  `error-gateway.example.json|.xml`.
- JSON examples validate against Zod and the JSON Schema: run-scratchpad
  `validate-json-artifacts.js` (ajv 8.17.1 + ajv-formats): all PASS, including the example equals
  the test fixture and negative controls (unknown status, numeric cursor, missing lines, error with
  neither key are rejected).
- XML examples match the XSD: run-scratchpad `validate-xml-artifacts.ps1` (.NET XmlSchemaSet):
  the three XML examples valid; unknown status, non-decimal cursor, empty `lines`, non-UTC
  `recorded_at` and `error_response` without `error` rejected; an empty page accepted.
- Also update: none found (new contract; no existing test, doc or `ai/` row describes it).
