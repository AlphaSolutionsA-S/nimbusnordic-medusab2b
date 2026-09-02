# Define and validate the canonical order contract

- **Date:** 2026-09-01
- **Status:** Scoped
- **Type:** Story
- **Tracker:** JIRA — https://alphasolutionsdk.atlassian.net/browse/NIMBUS-147
- **Priority:** Medium
- **Project Folder:** issues/NIMBUS-147/
- **Size:** M
- **Area:** Backend — canonical order contract, validation, customer/company matching (Order API)
- **Base Branch:** develop
- **Requested by:** Klaus Petersen (klp@alpha-solutions.dk)
- **Requested at:** 2026-09-01T00:00:00Z

## Background

External B2B customer systems submit orders into Medusa via Business Central, an Azure APIM
gateway, and a Logic App (Epic NIMBUS-129 — "Receive Orders Through JSON and XML"). Both JSON
and XML submissions must be validated against one shared, canonical order definition before an
accepted request can become a real Medusa order.

NIMBUS-144 (already scoped) defines the Medusa-side receiving endpoint: it does auth, structural
boundary validation, and a fast/shallow idempotency check, then hands the payload off
asynchronously. NIMBUS-147 owns what happens next in that async path: defining the canonical JSON
contract itself (and its XML representation), matching the payload's customer identifier to the
correct Medusa company, deep canonical-level payload validation, and the deeper business-level
duplicate-submission check. Creating and persisting the actual Medusa order from the validated
payload is NIMBUS-149's job, not this story's.

## Requirements

### Functional

- Define a canonical JSON order contract as a single, flat, domain-native schema organized
  around real order concepts — not around which downstream system (Medusa or Business Central)
  stores or uses a field. There is no `business_central` wrapper object and no "native" vs.
  "passthrough" labeling anywhere in the contract shape. The customer identifier is **not** part
  of this body schema — see the customer-matching bullet below:
  - **Order (header)** — `externalOrderNumber` (the dedupe key), `orderDate`,
    `requestedDeliveryDate`, `currencyCode`, `salesperson`, `email`, `phoneNumber`,
    `discountAmount`, `discountAppliedBeforeTax`, `pricesIncludeTax`, `billTo` (optional, nested
    address: name, addressLine1, addressLine2, city, state, postCode, country), `shipTo`
    (optional, nested address: name, contact, addressLine1, addressLine2, city, state, postCode,
    country), and `lines` (array of Order Line). Computed total fields
    (`totalAmountExcludingTax`, `totalTaxAmount`, `totalAmountIncludingTax`) are **not** part of
    the input contract — see note below.
  - **Order Line** — `lineNumber`, `itemNumber`, `custItemNo` (optional pass-through hint),
    `eanNo` (the line's EAN/GTIN barcode identifier — present on every line in real EDI samples;
    the reliable item identifier going forward), `description`, `description2`,
    `unitOfMeasureCode`, `quantity`, `unitPrice`, `discountPercent`, `discountAmount`,
    `discountAppliedBeforeTax`, `taxCode`, `taxPercent`, `requestedShipmentDate`. Computed line
    total fields (`amountExcludingTax`, `totalTaxAmount`, `amountIncludingTax`) are **not** part
    of the input contract — see note below.
  - **`billTo`/`shipTo` are optional, not required.** Business Central already holds default
    ship-to/bill-to master data reachable from the customer's identity. When the payload omits
    `billTo`/`shipTo`, they are resolved via a BC customer-master lookup rather than treated as a
    validation failure; when present (e.g. a one-off delivery override), the payload values take
    precedence. Resolving the BC fallback is downstream processing/enrichment logic, not owned by
    this story (see Dependencies) — this story's job is only to not reject a payload for omitting
    them.
  - **Computed totals are dropped from the input contract entirely, not just made optional.**
    They are derived outputs, not submitter-supplied data — calculation-input fields are kept
    instead: `quantity`, `unitPrice`, `discountPercent`, `discountAmount`,
    `discountAppliedBeforeTax`, `taxCode`, `taxPercent`, `pricesIncludeTax`. Neither real EDI
    sample file (see Findings below) includes any total field at all, only line quantity/price.
  - Every field lives on the order or order-line object it actually describes, and all fields are
    validated as one schema (not two validation regimes).
- Define an XML representation that mirrors this single canonical JSON model (not BC's raw OData
  XML), so NIMBUS-145 can map XML → canonical JSON directly with the Azure APIM `xml-to-json`
  policy.
- Match the customer to the correct Medusa company by looking up the existing
  `Company.business_central_customer_number` field
  (`apps/backend/src/modules/company/models/company.ts`, already present, nullable text) against
  the value NIMBUS-146 (Logic App) resolves for the caller. **This value is not part of the
  canonical JSON body** — NIMBUS-144's endpoint receives it as a query-string parameter
  (NIMBUS-144 is being reopened separately to reflect this) and passes it through its async
  hand-off; NIMBUS-147 consumes it from there. The matching logic itself is unchanged — only the
  source of the value changed from a body field to a query parameter. No new identifier field on
  `Company` is required.
- Reject payloads with an unknown customer identifier (no matching company) with a clear
  validation error response.
- Perform canonical-level payload validation beyond NIMBUS-144's structural/boundary check:
  required order-header and order-line fields present and correctly typed, and at least one
  order line. Reject invalid payloads with a clear validation error response.
- Perform business-level duplicate-submission validation using `externalOrderNumber` as the
  dedupe key (confirmed, matching NIMBUS-144's preliminary read) — this is the deeper check that
  NIMBUS-144's shallow existence check does not perform. Reject a duplicate submission without
  creating another Medusa or Business Central order.
  - **Confirmed:** duplicate scope is per-company — the same `externalOrderNumber` from two
    different companies is not treated as the same order.
- Hand off validated, canonical orders to NIMBUS-149 for Medusa order creation/persistence.

### Non-Functional

- Canonical validation, customer matching, and duplicate checking run in the async processing
  path NIMBUS-144 hands off to — they must not block or extend NIMBUS-144's synchronous
  201/4xx acknowledgment.
- Validation and rejection error responses must not expose customer tokens, credentials, or raw
  internal payload contents.
- Error response structure/status codes should stay consistent with NIMBUS-144's existing
  boundary-validation error conventions (exact codes/shape are an implementation-planner
  decision, not fixed here).

## Affected Apps

- **backend** — the canonical JSON/XML contract definition (as a spec/schema artifact and
  validation logic), company/customer matching against the existing `Company` model, canonical
  payload validation, and duplicate-submission validation. Wires into NIMBUS-144's async
  hand-off and feeds NIMBUS-149's order creation.
- **storefront** — not involved.
- **Azure integration** — not implemented here, but the XML representation this story defines is
  what NIMBUS-145 needs to configure the APIM `xml-to-json` policy against.

## Proposed Structure

High-level task breakdown for the implementation planner:

1. Define the canonical JSON schema as a single, flat, domain-native order schema (Order header
   with optional nested `billTo`/`shipTo` addresses and a `lines` array of Order Line, per the
   field list above — no computed totals, `eanNo` included on lines), including which fields are
   required vs. optional. No system-specific tiers or wrapper objects, no customer identifier in
   the body.
2. Define the XML representation of that canonical JSON schema (documentation/spec artifact
   consumable by NIMBUS-145's APIM policy configuration).
3. Implement company/customer matching against `Company.business_central_customer_number`, fed
   from the query-string customer identifier passed through NIMBUS-144's async hand-off (not from
   the body); reject unknown identifiers.
4. Implement canonical-level payload validation (distinct from NIMBUS-144's structural/boundary
   validation).
5. Implement duplicate-submission validation keyed on `externalOrderNumber`, scoped per company
   (confirmed).
6. Integrate with NIMBUS-144's async hand-off: validated orders proceed to NIMBUS-149; rejected
   orders return/record a clear validation failure.
7. Tests: schema validation (valid and invalid payloads), unknown-customer rejection, and
   duplicate rejection.

## Findings from Real EDI Samples

The canonical contract above was checked against two real EDI sample files
(`issues/NIMBUS-129/example edi files/order1.xml` and `order2.xml`, Evenex/N-EDI "ORDERS"
format), which drove the `customerNumber` removal, `billTo`/`shipTo` optionality, dropped
totals, and added `eanNo` above. Two further findings from that comparison remain open:

- **Customer identifier format:** the real customer identifier observed in the sample files is a
  13-digit EAN number (e.g. `579000283084`), not a typical short BC customer code. The BC-side
  team should confirm that `Company.business_central_customer_number` actually stores EAN-format
  values for EDI-sourced customers — otherwise the company-matching lookup in this story won't
  match. This concerns the value's *format*, not its transport, so it is unaffected by the
  query-string change above.
- **Decimal formatting:** `UnitPrice` in the EDI samples uses comma-decimal formatting (e.g.
  `"209,25"`). Normalization (comma → dot) must happen before or during canonical JSON
  production — likely NIMBUS-145's concern (the XML→JSON transform), not this story's, but
  flagging the dependency so it isn't missed.

## Open Questions

- **Precise required/optional flags per field** in the domain schema above — this story fixes the
  field list and the single-schema *architecture*; the implementation planner confirms which
  fields are strictly required to accept a payload versus optional, informed by NIMBUS-144's BC
  field mapping table.
- **Exact error response shape/status codes** for unknown-customer, canonical-validation, and
  duplicate rejection — deferred to the implementation planner, consistent with NIMBUS-144's
  conventions.

## Dependencies

- **NIMBUS-144** — Medusa receiving endpoint; this story's validation runs inside the async
  hand-off path 144 defines, and depends on 144's boundary validation and shallow idempotency
  check without duplicating them.
- **NIMBUS-145** — Accept JSON and XML orders through APIM; depends on the XML representation
  this story defines to implement the `xml-to-json` mapping.
- **NIMBUS-146** — Validate customer token and route order; this story assumes NIMBUS-146 already
  resolves the customer token to a customer identifier that NIMBUS-144 receives as a query-string
  parameter (not a body field) and passes through its async hand-off for this story to consume.
- **NIMBUS-149** — Create and persist the Medusa order. **Medusa has no product catalog behind
  these items**, so NIMBUS-149 persists Medusa order **header fields only** — it does **not**
  create any `OrderLineItem` records. The canonical order's `lines` array (including `eanNo`) is
  retained as-is (mechanism TBD — likely `metadata` on the Medusa order) for NIMBUS-148 to
  consume; it is not modeled as Medusa order lines.
- **NIMBUS-148** (not yet scoped) — Send the Medusa order to Business Central. This is where the
  actual BC sales-order-line creation happens, including the **EAN → BC item-number lookup**
  (calling a BC service to resolve each line's `eanNo` to a real BC item). This is neither
  NIMBUS-147's (validation) nor NIMBUS-149's (Medusa persistence) job — flagging here as key
  context to carry into NIMBUS-148's future scoping, not something to resolve in this story.
- Existing `Company` model — `apps/backend/src/modules/company/models/company.ts`
  (`business_central_customer_number` field, already present; no new field needed).
