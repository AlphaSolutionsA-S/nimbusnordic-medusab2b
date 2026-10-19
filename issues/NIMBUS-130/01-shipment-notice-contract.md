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
