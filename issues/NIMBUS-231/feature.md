# Show the size on shipment notice lines

- Tracker: [NIMBUS-231](https://alphasolutionsdk.atlassian.net/browse/NIMBUS-231)
- Priority: Should (to confirm with Klaus)
- Size: M
- Area: Order API: shipment notices (backend, Logic App contract)
- Requested by: Klaus Petersen
- Requested at: 2026-10-23T00:00:00Z

## Description
Shipment notices sent to order API customers list each shipped item by barcode and item number. For
items that come in sizes, each notice line should also say which size was shipped.

## Why
Customers ordering items in several sizes can then match each shipped line to the size they ordered
without relying on the barcode alone. Follow-up to NIMBUS-180, which makes order lines with size
barcodes reach Business Central with the right size; kept separate because it changes the shipment
notice format customers receive.

## Acceptance criteria
- [ ] Each shipment notice line for an item with sizes shows the size that was shipped.
- [ ] Lines for items without sizes show no size, as today.
- [ ] The size appears in both the JSON and the XML format of the shipment notice, and the published
      formats (schemas) describe it.
- [ ] Customers who ignore the new field keep working unchanged.
- [ ] It is decided and documented whether shipment notices sent before this change get the size
      added afterwards.

## Out of scope
- Resolving size barcodes on order lines (NIMBUS-180).

## Open questions
- Priority: Must, Should or Could?
- Back-fill: should notices already stored get the size, or stay without it?
- Which Business Central field exposes the variant code on a posted shipment line (needs a
  read-only probe)?

## Mockups / references
- NIMBUS-180 `scope.md`, "Out of scope", where this follow-up was defined.
- `docs/architecture/order-api/shipment-notices.md`.

## Technical notes
From the NIMBUS-180 scope (not a design):

- Each shipment notice line gains a nullable size (variant code) field next to `item_number`, read
  from the BC posted shipment line. Today's shipment line read carries no variant; which BC field
  exposes it is UNVERIFIED and needs a read-only probe.
- Changes the wire contract (`apps/backend/src/modules/order-ingestion/shipment-notice-contract.ts`),
  the customer-facing JSON Schema and the XSD of APIM's XML rendering (originals in
  `issues/NIMBUS-130/artifacts/`), the Logic App mapping, and
  `docs/architecture/order-api/shipment-notices.md`.
- Full pipeline (order API contract).
