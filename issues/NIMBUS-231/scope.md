# Show the size on shipment notice lines

**Date:** 2026-10-24
**Status:** Approved (Klaus Petersen, 2026-10-24)
**Type:** Story
**Priority:** Must
**Issue:** NIMBUS-231
**Key:** NIMBUS-231
**Case folder:** issues/NIMBUS-231/
**Base Branch:** develop

## Background

Order API customers fetch shipment notices from `GET /orderapi/shipment-notices` (JSON, or XML
rendered by APIM). Each notice line names the shipped item by the customer's line number and EAN,
BC line number and item number, unit and quantity. Since NIMBUS-180, order lines with a size
barcode reach Business Central as item + size (item variant). The notice does not say which size
shipped, so a customer who orders one item in several sizes must rely on the line number or EAN to
tell the lines apart, and cannot see the size at all on a line that BC added or that could not be
matched to an order line (`line_number` and `ean_no` null).

Today's shipment read uses BC API v2.0 `salesShipments` with `salesShipmentLines`. That entity has
no variant field: selecting `itemVariantId` fails with 400. The published ODataV4 web service
`TRCShipmentLine` (a third-party extension) carries `variantCode` for posted shipment lines. In
TestDK its rows join the v2.0 lines one to one on shipment number + line number, and undo
corrections carry the variant of the line they undo (`samples/bc-shipment-line-variant-testdk.md`).
It is published in production (`ProductionDK`) with the same fields
(`samples/bc-shipment-line-variant-production.md`). It is the source of the size.

Goal: every notice line for an item with sizes states the size shipped, in JSON and XML and in the
published schemas, without creating notices nobody asked for.

## Requirements

### Functional

1. Each shipment notice line gains the field `variant_code`: the BC variant code of the shipped
   line, which for sized items is the size (e.g. `M`, `XL`).
2. The value is the variant code on the posted BC shipment line, read from `TRCShipmentLine`, as BC
   reports it (trimmed); not the size the customer ordered and not one derived from the EAN.
3. A line for an item without sizes (empty variant code in BC) has `variant_code: null` in JSON and
   the element omitted in XML, following the contract's existing null rule.
4. Notices recorded from the release on carry the field on every line, including lines of `revised`
   and `cancelled` notices (quantity 0 lines keep their size).
5. Notices stored before the release are not back-filled: they are served with `variant_code: null`
   on every line (never with the key missing). `docs/architecture/order-api/shipment-notices.md`
   states the cut-off: notices recorded before the release carry null even for sized items.
   Production has no shipment notices today, only test environments do, so the cut-off affects test
   data only.
6. The wire contract (`shipment-notice-contract.ts`), the customer-facing JSON Schema, the XSD and
   the example documents describe the field. The updated JSON Schema, XSD and examples are delivered
   in `issues/NIMBUS-231/artifacts/`, starting from the NIMBUS-130 originals; Klaus deploys them to
   customers and APIM. The change is published as a new schema with no opt-in and no versioning.
7. `docs/architecture/order-api/shipment-notices.md` documents the second BC read, its request
   budget, the field and the cut-off.

### Non-functional

1. The check run's BC load grows by one ODataV4 company-name read per run (the helper's existing
   form) plus one `TRCShipmentLine` read per 20 shipments checked, sequential like the existing
   detail read, inside the same run deadline and throttling back-off. An or-filter over 20 shipment
   numbers works in one request in TestDK (84 rows, no next link).
2. The size read follows `@odata.nextLink` pages the way the existing shipment reads do (only to the
   configured BC origin). BC's ODataV4 page limit is 20000 rows, so 20 shipments fit one page in
   practice.
3. A failed or throttled size read behaves like a failed shipment read today: the check is retried
   on the existing back-off schedule and no notice is stored for that check (rule B5).
4. No personal data is added to notices or logs; log lines keep to shipment numbers, BC order
   numbers and error codes. The size read selects only `documentNumber, lineNo, variantCode`.
5. APIM's XML rendering and the Logic App need no change: the policy renders any JSON property as
   an element of the same name and the Logic App passes the body through (from the NIMBUS-130
   artifacts; the planner confirms against what is deployed). Only the published XSD changes.

## Business rules

- B1. Size on a notice line → the variant code BC posted on that shipment line; empty in BC → null.
- B2. Adding the size never creates a notice on its own: a shipment whose shipped lines (BC line,
  item, unit, net quantity) are unchanged produces no `revised` notice, even though earlier revisions
  of it were stored without the size. The size is not part of the change detection (content hash).
- B3. Undo corrections: a negative line pairs with the line it undoes only if item, unit, opposite
  quantity and variant code all match; otherwise the shipment is unpairable as today. (TestDK: every
  correction seen carries its original line's variant, including one item undone in five sizes.)
- B4. A BC item line with no matching `TRCShipmentLine` row (same shipment number and line number)
  → the check fails and is retried; never a guess and never null for an item that may have sizes.
- B5. Size read failed or throttled → the whole check fails as a BC read failure does today
  (back-off 15 min, 1 h, 4 h, 6 h; gives up after the window); no notice stored from that check.
- B6. Stored notices are never rewritten; notices stored before the release are served with
  `variant_code: null` on each line (requirement 5).
- B7. Customers that read the field get it. Customers that validate responses against the published
  schema must take the new schema (Klaus publishes it); the old schemas are closed and reject the
  new field, so they are replaced, not extended.
- B8. Access is unchanged: only companies switched on for the order API are checked and served;
  the field adds no new reader, writer or actor.

## Data model (draft)

| Entity / field | Meaning | Owner | Written by | Stored or derived | Sensitive? | Retention |
|---|---|---|---|---|---|---|
| Notice line `variant_code` (wire) | BC variant code (size) of the shipped line; null when the item has none or the notice predates the release | `orderIngestion` (contract) | check run (decision rule) | stored inside `shipment_notice.payload` (JSON), no new column, no migration | no | as the notice |
| BC shipment line `variantCode` (from `TRCShipmentLine`) | Variant code on the posted line, keyed by shipment number + line number | Business Central | BC | read per check, kept only in the notice | no | — |
| Notices stored before release | Lines without the key in the stored payload | `orderIngestion` | — | stored as is; served with the field null (normalised on read) | no | as today |
| `shipment_notice.content_hash` | Change detection of shipped lines | `orderIngestion` | check run | stored | no | unchanged definition (B2) |

## Security properties (draft)

Not an auth, personal-data or payment change. One note for the planner: the new read uses the
existing BC client credentials and ODataV4 company parameter, GET only, filtered by shipment
numbers already matched to an enabled company's API order, so it cannot widen what a customer sees.
Next links are followed only to the configured BC origin, as the existing shipment reads do.

## Affected apps

- Backend (`apps/backend`): BC adapter (second shipment-line read), shipment types, the notice
  decision rule, the wire contract and page shaping (null for old notices), tests,
  `docs/architecture/order-api/shipment-notices.md`.
- Published contract artifacts (JSON Schema, XSD, examples) in `issues/NIMBUS-231/artifacts/`, for
  Klaus to deploy to customers and APIM.
- No storefront, Admin UI or CMS change. No change to the APIM policy or Logic App expected (NFR 5).

## Proposed structure

1. BC adapter: read `TRCShipmentLine` (`documentNumber, lineNo, variantCode`) for the shipments of a
   check, chunked by 20 shipment numbers, following next links, and attach the variant code to each
   shipment line; fail on missing rows or a failed read (B4, B5). Fetch-mocked module tests shaped
   like the probe.
2. Decision rule: carry the variant code onto notice lines, include it in undo pairing (B3), keep it
   out of the content hash (B2). Unit tests for each rule.
3. Contract and serving: add the nullable `variant_code` to `ShipmentNoticeLineSchema`; serve notices
   stored without it with null (B6); contract and HTTP tests.
4. Artifacts and docs: updated JSON Schema, XSD (`minOccurs="0"`) and examples in
   `issues/NIMBUS-231/artifacts/`; `docs/architecture/order-api/shipment-notices.md` (second read,
   request budget, field, cut-off).

About four tasks in one app; full pipeline because it changes the order API contract and adds a
Business Central read.

## Verification items for the planner

- Throttling of `TRCShipmentLine` (expected to behave like other BC reads; not provoked in TestDK).
- That the deployed APIM policy and Logic App are the NIMBUS-130 versions (NFR 5).
- After deploy: a real shipment of a sized item in TestDK yields a notice with the shipped size in
  JSON and XML, and an open shipment stored before the release gets no extra `revised` notice.

## Open questions

None blocking. Answered by Klaus on 2026-10-24: priority Must; no back-fill, old notices served with
null and the cut-off documented (no production notices exist); publish the new schema, no opt-in or
versioning; field name `variant_code`; depend on `TRCShipmentLine` (verified in production);
artifacts in this case folder, deployed by Klaus.

## Dependencies

- NIMBUS-180 (merged to `develop` at ac78fda): sizes reach BC sales lines.
- NIMBUS-130 / NIMBUS-216 / NIMBUS-217: the shipment notice pipeline and contract this extends.
- BC `TRCShipmentLine` web service (verified in TestDK and ProductionDK). Risk, not a blocker: the
  owner of the TRC extension is unknown, so a change to or removal of that service would stop
  shipment notices (every check would fail and back off) until the read is changed. The fallback is
  Nimbus publishing the standard Posted Sales Shipment Lines page as an ODataV4 web service.
- Klaus publishes the new schemas to customers and APIM at release.

## Documentation

- [docs/architecture/order-api/shipment-notices.md](../../docs/architecture/order-api/shipment-notices.md) — Shipment notices: line size, second BC read, failure codes, cut-off, contract location (updated)

AI base files updated: `ai/architecture/decisions.md` (shipment notice rule row, in task 02)
