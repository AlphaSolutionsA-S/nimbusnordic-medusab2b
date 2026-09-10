# Receive normalized order JSON in Medusa

- **Date:** 2026-09-01
- **Status:** Scoped
- **Type:** Story
- **Tracker:** JIRA — https://alphasolutionsdk.atlassian.net/browse/NIMBUS-144
- **Priority:** Medium
- **Project Folder:** issues/NIMBUS-144/
- **Size:** M
- **Area:** Backend — new order-ingestion API route (Order API)
- **Base Branch:** develop
- **Requested by:** Klaus Petersen (klp@alpha-solutions.dk)
- **Requested at:** 2026-09-01

## Background

External B2B customer systems (via Business Central, an Azure APIM gateway, and a Logic
App) need to submit orders into Medusa without going through the storefront. This story is
part of a larger pipeline (Epic NIMBUS-129 — "Receive orders through JSON and XML") that
covers the full path from external submission to a confirmed order in Business Central.

NIMBUS-144 is specifically the **Medusa-side receiving endpoint**: the point where the
already-normalized, already-token-validated order JSON (produced upstream by APIM/NIMBUS-145
and the Logic App/NIMBUS-146) lands inside Medusa. It must accept the payload, enforce its
own authorization so the endpoint cannot be called outside the authorized integration path,
acknowledge the request, and hand the payload off for canonical validation and order
creation (owned by other stories — see Dependencies and Open Questions).

## Requirements

### Functional

- Provide a Medusa API route (proposed `POST /orderapi/orders`; exact path/namespace to be
  confirmed during planning — see Open Questions) that accepts the canonical normalized
  order JSON forwarded by the Logic App.
- Accept a **customer-identity query parameter** on the same request (e.g.
  `POST /orderapi/orders?customerNumber=...`; exact parameter name TBD — see Open Questions).
  The Logic App (NIMBUS-146) resolves customer identity upstream and passes it via this query
  parameter — it does **not** travel in the JSON/XML request body. This was confirmed against
  real EDI sample files after initial scoping; it supersedes the earlier assumption that a
  `customerNumber` field would live in the canonical JSON body.
- Authenticate the incoming request using a scoped API key issued to the integration caller.
  This is a Medusa-side control, independent of and in addition to the Logic App's own
  customer-token validation (NIMBUS-146) — its purpose is to ensure this endpoint cannot be
  invoked by any caller other than the authorized integration path.
- Accept the order payload covering order header fields, order lines, and the external order
  identifier used for deduplication (see Field Mapping below).
- Perform structural/envelope validation of the incoming payload (e.g. required top-level
  fields present, correct types) at the API boundary. Deep canonical-contract validation and
  customer/company matching is owned by NIMBUS-147, not this story.
- Perform structural/envelope validation of the customer-identity query parameter as part of
  the same boundary check: the parameter must be present and well-formed. A missing or
  malformed query parameter is a boundary-validation failure (4xx), the same category as a
  malformed body — it is rejected before any async hand-off, not deferred to NIMBUS-147.
- Perform a fast idempotency check against the external order identifier in the payload, to
  short-circuit an already-processed resend before further processing. **Confirmed boundary:**
  NIMBUS-144 owns this fast/shallow existence check only; NIMBUS-147 owns the deeper
  business-level "duplicate-submission validation" in its own scope.
- Return **201 Accepted** with a Medusa order reference once the payload passes the
  boundary/auth/idempotency checks. Actual canonical validation, customer/company matching
  (NIMBUS-147), and order creation/persistence (NIMBUS-149) happen **asynchronously** after
  this response is returned — the caller does not wait for order creation to complete.
- Return a structured **validation error** response (4xx) with clear error details when the
  payload fails structural/boundary validation or authentication.
- Return a structured **processing error** response for failures detected before the async
  hand-off (e.g. malformed JSON).

### Non-Functional

- The endpoint must not be reachable/usable without the scoped API key — no caller should be
  able to bypass the authorized integration (APIM → Logic App → Medusa) path.
- Must not log or expose the scoped API key or sensitive payload contents in error responses.
- Response time for the synchronous acknowledgment (201/4xx) should not depend on the
  duration of canonical validation, customer matching, or order creation.

## Affected Apps

- **backend** — new custom API route under `apps/backend/src/api/`, its auth/middleware, and
  the hand-off into the async processing path (workflow/event, to be defined by the
  implementation planner). No admin UI changes are in scope here.
- **storefront** — not involved. This is a system-to-system integration endpoint; no
  storefront changes.

## Field Mapping (BC → Medusa, conceptual)

Source: Business Central OData `salesOrder` / `salesOrderLine` entities, as documented in
`issues/NIMBUS-129/bc metadata/std odata metadata.xml` (lines 2503–2647). This is the
standard BC OData v4 schema (`Microsoft.NAV.salesOrder` / `salesOrderLine`) with no custom
extensions.

This mapping is conceptual/requirements-level — exact Medusa field names, types, and
whether values are passed through vs. recalculated by Medusa are implementation decisions
for the planner (see Open Questions), and the canonical JSON contract itself is owned by
NIMBUS-147.

**Order header** (`salesOrder` → Medusa order)
| BC field | Purpose |
|---|---|
| `number` | BC's own sales order number (internal to BC) |
| `externalDocumentNumber` | Likely candidate for the external order ID used for dedupe — **not confirmed, see Open Questions** |
| `customerNumber`, `customerName` | **Superseded assumption:** these do not travel in the canonical JSON body. Customer identity is resolved upstream by the Logic App (NIMBUS-146) and passed to this endpoint as a query parameter; NIMBUS-147's canonical contract no longer carries a body-level `customerNumber` field, and its customer/company matching consumes the query-param value passed through NIMBUS-144's async hand-off. |
| `orderDate`, `postingDate` | Order date reference |
| `billToAddress*`, `shipToAddress*` fields | Maps to Medusa order billing/shipping address |
| `currencyCode` | Order currency |
| `totalAmountExcludingTax`, `totalTaxAmount`, `totalAmountIncludingTax` | Order totals — pass-through vs. Medusa-recalculated is an open decision |
| `email`, `phoneNumber` | Customer contact info |
| `status` | BC order status — relevance to Medusa order state TBD |

**Order line** (`salesOrderLine` → Medusa order line item)
| BC field | Purpose |
|---|---|
| `lineObjectNumber` | Item/account number — product/variant matching |
| `description`, `description2` | Line item title/description |
| `quantity` | Line quantity |
| `unitPrice` | Line unit price |
| `discountAmount`, `discountPercent` | Line-level discount — Medusa discount modeling TBD |
| `amountExcludingTax`, `totalTaxAmount`, `amountIncludingTax` | Line totals/tax — pass-through vs. recalculated TBD |
| `unitOfMeasureCode` | Unit of measure — no obvious native Medusa order-line field; open item |

## Proposed Structure

High-level task breakdown for the implementation planner:

1. Define the Medusa API route (path, HTTP method, file location under `apps/backend/src/api/`).
2. Implement the scoped-API-key authentication/middleware for this route.
3. Implement structural/envelope payload validation at the API boundary, including presence
   and well-formedness of the customer-identity query parameter.
4. Implement the fast idempotency check on the external order identifier.
5. Define and implement the async hand-off mechanism (e.g. workflow trigger or event) to the
   downstream canonical-validation (NIMBUS-147) and order-creation (NIMBUS-149) processing —
   ensure the resolved customer-identity value from the query parameter is carried through
   the hand-off — coordinate with those stories' implementations/status.
6. Define the success (201 + order reference) and error response contracts.
7. Integration tests covering: auth enforcement, structural validation errors (including
   missing/malformed query parameter), idempotent resend handling, and the async
   acknowledgment contract.

## Open Questions

- **Endpoint path/namespace**: Is `POST /orderapi/orders` the final intended path, or should
  it live under an existing namespace convention (e.g. a new top-level route group outside
  `/admin` and `/store`)? Needs confirming during planning.
- **Customer-identity query parameter name**: Confirmed to arrive as a query string parameter
  (e.g. `customerNumber`) supplied by the Logic App (NIMBUS-146), rather than in the JSON/XML
  body — discovered by comparing the canonical contract against real EDI sample files. Exact
  parameter name and its precise value (BC customer number vs. some other identifier) still
  need confirming at planning time, ideally in coordination with NIMBUS-146 and NIMBUS-147.
- **Dedupe key**: BC's `salesOrder` schema has both `number` (BC-internal order number) and
  `externalDocumentNumber` (explicitly intended for an external reference). Which one is "the"
  external order ID for Medusa's dedupe check? Preliminary read: `externalDocumentNumber` is
  the more likely candidate, but this needs confirming — ideally against the actual canonical
  JSON contract once NIMBUS-147 defines it.
- **Async processing mechanism**: What should trigger the downstream processing after the
  201 response — a Medusa workflow invoked directly, an emitted event/subscriber, a queued
  job? This is an implementation decision but affects how NIMBUS-144, 147, and 149 integrate;
  flagging for the planner.
- **Scoped API key provisioning**: No existing pattern for a scoped/service API key was found
  in this repo's env template or backend config. How should this key be issued/stored/rotated
  (Medusa's native API key auth vs. a custom secret)? Planner to confirm against Medusa v2
  capabilities.
- **Order totals/tax pass-through vs. recalculation**: Should BC-supplied totals and line tax
  amounts be trusted and stored as-is, or should Medusa recalculate them via its own pricing
  engine? Affects both NIMBUS-144's contract expectations and NIMBUS-149's order-creation
  logic.
- **Canonical JSON contract availability**: NIMBUS-147 ("Define and validate the canonical
  order contract") is still in Scoping and not yet defined. NIMBUS-144's payload shape
  depends on that contract being finalized — implementation may need to proceed with a
  provisional/BC-derived shape until NIMBUS-147 is scoped/built.

## Dependencies

- **NIMBUS-145** — Accept JSON and XML orders through APIM (upstream; defines what reaches
  the Logic App).
- **NIMBUS-146** — Validate customer token and route order (upstream; defines what "already
  authorized" means by the time a request reaches Medusa). **Confirmed:** NIMBUS-146 also
  resolves customer identity and passes it to this endpoint as a query string parameter — it
  does not travel in the request body.
- **NIMBUS-147** — Define and validate the canonical order contract (defines the exact JSON
  shape this endpoint accepts, and owns customer/company matching + deep business-level
  duplicate-submission validation). **Confirmed boundary:** NIMBUS-144 owns only a fast/shallow
  existence check on the external order ID at the API layer; NIMBUS-147 owns the deeper
  duplicate-rejection logic. **Confirmed:** the canonical contract no longer carries a
  body-level `customerNumber` field — NIMBUS-147's customer/company matching consumes the
  query-param value passed through NIMBUS-144's async hand-off instead.
- **NIMBUS-149** — Create and persist the Medusa order (owns the actual order-creation logic
  that this endpoint's async hand-off ultimately invokes).
- **NIMBUS-148** — Send the Medusa order to Business Central (downstream of order creation;
  not in scope here, but part of the same pipeline).
- BC field reference: `issues/NIMBUS-129/bc metadata/std odata metadata.xml`
  (`salesOrder`/`salesOrderLine` entities, lines 2503–2647).
