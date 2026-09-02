# Create and persist the Medusa order

- **Date:** 2026-09-02
- **Status:** Scoped
- **Type:** Story
- **Tracker:** JIRA — https://alphasolutionsdk.atlassian.net/browse/NIMBUS-149
- **Priority:** Medium
- **Project Folder:** issues/NIMBUS-149/
- **Size:** M
- **Area:** Backend — order creation/persistence (Order API pipeline)
- **Base Branch:** develop
- **Requested by:** Klaus Petersen (klp@alpha-solutions.dk)
- **Requested at:** 2026-09-02T00:00:00Z

## Background

Every accepted external order must be retained as a real Medusa order before it is sent to
Business Central, so the order is visible in history and integration failures can be recovered.

This is the third stage of the order-ingestion pipeline (Epic NIMBUS-129 — "Receive orders
through JSON and XML"), following NIMBUS-144 (Medusa-side receiving endpoint) and NIMBUS-147
(canonical order contract, deep validation, and company/customer matching). NIMBUS-149 consumes
the validated canonical order and resolved company/customer context that NIMBUS-147 hands off,
and turns it into a persisted Medusa order. Sending that order on to Business Central is a
separate, not-yet-scoped story (NIMBUS-148).

A binding architectural constraint carried over from NIMBUS-147's scoping: **Medusa has no
product catalog behind these order items**, so this story creates Medusa order **header fields
only** — no `OrderLineItem` records are created. The validated line detail must still be
retained for NIMBUS-148 to use later.

## Requirements

### Functional

- Create a Medusa order from the validated canonical order handed off by NIMBUS-147, mapping the
  canonical header fields (e.g. currency, contact email/phone, order date, requested delivery
  date, addresses, company/customer reference) onto native Medusa Order columns where they
  reasonably fit. The exact field-by-field mapping is an implementation-planner decision, using
  NIMBUS-144's BC field-mapping table and NIMBUS-147's finalized canonical schema as inputs.
- Associate the order with the matched company and customer context resolved by NIMBUS-147 (the
  company matched via `Company.business_central_customer_number` against the customer identifier
  NIMBUS-146 resolves and passes through the pipeline as a query parameter).
- Do **not** create any `OrderLineItem` records — confirmed constraint from NIMBUS-147's scoping
  (no product catalog behind these SKUs).
- Persist the complete, verbatim canonical order JSON (as validated by NIMBUS-147, including the
  full `lines` array) into a dedicated key within the Medusa order's `metadata` field. This is
  stored as received — not reshaped, re-derived, or partially extracted — and is the source of
  truth for line detail that NIMBUS-148 will read when building the Business Central order.
  Mapped header fields still become real Order columns per the bullet above; the raw payload in
  metadata is the record of everything, including line detail that has nowhere else to live.
- Design and persist a dedicated Business Central integration-state object, as a second, clearly
  separate key within the same `metadata` field (not a separate data model), recording the
  initial BC delivery state needed for later stories to build on:
  - a BC order identifier field (initially unset/null — not yet known until NIMBUS-148 delivers
    the order to BC)
  - a delivery status field, initialized to a "not yet sent" / pending value
  - timestamp field(s) capturing when this integration-state record was initialized
  - a retry count, initialized to zero
  - the object's exact field names/types are this story's design decision; the rough shape above
    is fixed by this scope so NIMBUS-148 (updates status/BC order id on delivery) and NIMBUS-158
    (reads/displays status and retry in Medusa Admin) have a stable contract to build against.
- The raw canonical payload and the BC integration-state object must live under distinct,
  clearly-named `metadata` keys — never merged into one blob — so downstream stories can read/
  update one without disturbing the other.
- Order creation failures must be surfaced in a way that allows recovery (per the Jira
  description's "integration failures can be recovered") rather than silently dropping a
  validated order. Exact failure-handling/retry mechanics (logging, error state, alerting) are
  left to the implementation planner.

### Non-Functional

- Order creation must not double-create a Medusa order for the same validated canonical order if
  invoked more than once (defense in depth alongside NIMBUS-147's per-company
  `externalOrderNumber` duplicate check upstream) — exact idempotency mechanism left to the
  planner.
- Metadata must not contain customer tokens, credentials, or any secret material. The raw
  canonical payload stored in metadata is the same payload NIMBUS-147 already validated and
  scoped as free of credentials — no additional sensitive data is introduced by persisting it.
- Preserve the normalized source information needed for traceability (the raw canonical payload)
  without exposing sensitive payload data beyond what NIMBUS-147 already accepted as safe to
  retain.

## Affected Apps

- **backend** — order-creation logic (workflow/service invoked from NIMBUS-147's async
  hand-off), the `metadata` shape design (raw payload key + BC integration-state key), and
  mapping canonical header fields onto native Order columns. No admin UI changes here (BC
  status/retry display is NIMBUS-158, not yet scoped).
- **storefront** — not involved.

## Proposed Structure

High-level task breakdown for the implementation planner:

1. Confirm which canonical order header fields map onto native Medusa Order columns (currency,
   email, phone, dates, addresses, company/customer reference) versus which remain metadata-only,
   using NIMBUS-144's field-mapping table and NIMBUS-147's finalized canonical schema.
2. Implement Medusa order creation (workflow/service call) from the validated canonical order and
   resolved company/customer context handed off by NIMBUS-147, populating the mapped header
   columns. No `OrderLineItem` records.
3. Persist the complete raw canonical order JSON into a dedicated `metadata` key as the
   line-detail source of truth for NIMBUS-148.
4. Design and implement the BC integration-state object (BC order id, status, timestamp(s),
   retry count) under a separate `metadata` key, initialized to its starting/pending state.
5. Wire into NIMBUS-147's async hand-off: consume the validated canonical order plus
   company/customer match, and produce either a persisted Medusa order or a clear, recoverable
   failure.
6. Define failure handling for order-creation errors so failures remain visible and recoverable
   rather than silently dropped.
7. Tests: order creation from a valid canonical payload (header columns mapped correctly, raw
   payload metadata present verbatim, BC integration-state metadata initialized correctly), no
   `OrderLineItem` records created, correct company/customer association, and failure-path
   behavior.

## Open Questions

- **Exact `metadata` key names and field types** for the raw payload key and the BC
  integration-state object — this story fixes the requirement (two distinct keys; integration
  state = BC order id, status, timestamp(s), retry count) but exact naming/typing is confirmed by
  the implementation planner.
- **Exact set of canonical header fields mapped to native Order columns** vs. left metadata-only
  — deferred to the planner, informed by NIMBUS-144's field-mapping table.
- **Failure/retry mechanics** for order-creation errors — must be recoverable per the Jira
  description's intent; exact mechanism (logging, error metadata, alerting) is a planner
  decision.
- Whether NIMBUS-158's future admin UI will need BC integration-state fields beyond the four
  listed here — flagged for cross-checking when NIMBUS-158 is scoped, not resolved now.

## Dependencies

- **NIMBUS-147** — supplies the validated canonical order and resolved company/customer match
  this story consumes; NIMBUS-149 does not repeat NIMBUS-147's validation or matching logic.
- **NIMBUS-144** — upstream receiving endpoint; its BC field-mapping table is a starting
  reference for this story's header-column mapping decisions.
- **NIMBUS-148** (not yet scoped) — will read the raw payload's `lines` array from `metadata` to
  build the Business Central sales order, and will update the BC integration-state object this
  story initializes (BC order id, status, retry count) as delivery progresses.
- **NIMBUS-158** (not yet scoped) — admin UI for BC status/retry; will read (and likely update)
  the BC integration-state object whose initial shape this story defines.
- Existing `Company` model — `apps/backend/src/modules/company/models/company.ts`
  (`business_central_customer_number` field, already present, used for company matching by
  NIMBUS-147 and consumed by association here).
