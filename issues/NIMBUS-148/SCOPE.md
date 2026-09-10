# Send the Medusa order to Business Central

- **Date:** 2026-09-02
- **Status:** Scoped
- **Type:** Story
- **Tracker:** JIRA — https://alphasolutionsdk.atlassian.net/browse/NIMBUS-148
- **Priority:** Medium
- **Project Folder:** issues/NIMBUS-148/
- **Size:** M
- **Area:** Backend — Business Central order submission (Order API pipeline / Business Central integration)
- **Base Branch:** develop
- **Requested by:** Klaus Petersen (klp@alpha-solutions.dk)
- **Requested at:** 2026-09-02T00:00:00Z

## Background

Accepted Medusa orders must be delivered to Business Central with a clear, traceable outcome for
internal operations.

This is the fourth stage of the order-ingestion pipeline (Epic NIMBUS-129 — "Receive orders
through JSON and XML"), following NIMBUS-144 (receiving endpoint), NIMBUS-147 (canonical order
contract and validation), and NIMBUS-149 (Medusa order persistence). NIMBUS-149 persists a Medusa
order with header fields only (no `OrderLineItem` records — Medusa has no product catalog behind
these items) and initializes two `metadata` keys: the complete raw canonical order JSON (including
the full `lines` array), and a BC integration-state object (BC order id, status, timestamp(s),
retry count — all at their initial/pending values). NIMBUS-148 consumes both: it builds and submits
the actual Business Central sales order from the raw line detail, then updates the BC
integration-state object with the real outcome.

An existing `business-central` module (`apps/backend/src/modules/business-central/`, built by
NIMBUS-153) already provides OAuth2 client-credentials auth against Azure AD and OData v2.0 reads
against Business Central (`getCustomer`, `listOrders`, `getOrder`). It has one existing write
method, `createReturnFromSalesOrder`, currently a stub. NIMBUS-148 adds the module's first real
order-submission write path, following the same `prepare-*`/`submit-*` workflow-step pattern
already established by `workflows/business-central-return/`.

## Requirements

### Functional

- Add a Business Central **item-lookup** capability to the `business-central` module (no
  equivalent exists today): resolve each canonical order line to a real BC item, trying the line's
  `eanNo` first; if the EAN lookup fails or is ambiguous, fall back to `itemNumber`, then
  `custItemNo`.
- Add a Business Central **sales-order creation** capability to the `business-central` module (no
  equivalent exists today, unlike `createReturnFromSalesOrder` this is implemented as a real HTTP
  call against Business Central from the start, not a stub) — the real BC endpoint/contract for
  creating a sales order with lines is confirmed and known at scoping time; the exact OData
  resource/action shape is an implementation-planner detail.
- Determine the Business Central customer to submit the order under via the same
  `Company.business_central_customer_number` value already used for company matching upstream
  (NIMBUS-147), carried through the Medusa order created by NIMBUS-149.
- Build the BC sales order's lines from the raw canonical `lines` array persisted in NIMBUS-149's
  metadata (not from any Medusa `OrderLineItem`, since none exist), resolving each line's BC item
  via the lookup above.
- **Partial line-resolution failure is allowed, not a hard stop.** If some lines resolve to a BC
  item and others don't, submit the BC sales order with the successfully resolved lines, and
  record the failure at **both** levels in Medusa metadata: an order-level flag that the
  submission was partial, and a line-level record of which specific line(s) failed resolution and
  why (e.g. EAN not found, ambiguous match). If **no** lines resolve, the submission itself fails
  (see status handling below) rather than creating an empty BC order.
- On successful BC submission (full or partial), update NIMBUS-149's BC integration-state metadata
  object: store the real BC order identifier, set status to `sent`, and update the timestamp.
- On a failed submission (the BC call itself fails, or zero lines resolve), update the same
  integration-state object: set status to `failed`, update the timestamp, and do not fabricate a
  BC order id. A `pending` status is left untouched if this story's logic never actually attempts a
  submission (should not normally occur once triggered, but guards against no-op invocations).
- Build the BC-submission logic (item resolution + order creation + outcome persistence) as a
  single **reusable** workflow/step, not tied to a one-shot trigger — the same piece both the
  initial send (this story) and NIMBUS-158's future manual retry (a separate story) invoke. This
  story implements that reusable piece and its initial trigger; it does not implement any
  retry-trigger endpoint or admin UI itself.
- The reusable step increments the integration-state retry count on every invocation (including
  this story's own first, automatic attempt), so the count reflects total attempts regardless of
  who triggered them.
- Before creating a new BC sales order, the reusable step must check the existing integration-state
  object for an already-set BC order id / `sent` status, to avoid submitting a duplicate BC sales
  order if invoked more than once for the same Medusa order. Exact mechanism (e.g. short-circuit on
  existing BC order id) is left to the implementation planner.

### Non-Functional

- This story's logic runs as a background/async step triggered after NIMBUS-149 persists the
  Medusa order — it must never block or extend NIMBUS-144's synchronous 201 acknowledgment to the
  external caller, and the external caller never receives the BC order identifier or any BC
  outcome (internal-operations visibility only, via the future NIMBUS-158 admin widget), per the
  Jira description.
- Metadata (raw payload, integration-state object, and any line-failure records) must not contain
  customer tokens, credentials, or secret material.
- Reuse the existing `business-central` module's OAuth2/OData request conventions
  (`apps/backend/src/modules/business-central/service.ts`) rather than introducing a second HTTP
  client pattern.

## Affected Apps

- **backend** — the `business-central` module (new item-lookup and sales-order-creation
  capabilities), a new workflow/step pair (following the `prepare-*`/`submit-*` convention from
  `workflows/business-central-return/`) that resolves lines, submits the BC order, and updates
  NIMBUS-149's integration-state metadata. No admin UI changes here (status/retry display and the
  retry trigger are NIMBUS-158, not yet scoped).
- **storefront** — not involved.

## Proposed Structure

High-level task breakdown for the implementation planner:

1. Add a BC item-lookup method to the `business-central` module service/types (`eanNo` primary
   filter, `itemNumber`/`custItemNo` fallback on failure or ambiguity).
2. Add a BC sales-order-creation method to the `business-central` module service/types (real HTTP
   call — customer reference plus resolved line items), following the module's existing
   OAuth2/OData request conventions.
3. Implement a `prepare-bc-order` step: read the Medusa order's raw canonical payload and
   integration-state metadata (from NIMBUS-149), resolve the BC customer via
   `Company.business_central_customer_number`, resolve each line's BC item via the lookup, and
   partition lines into resolved vs. unresolved.
4. Implement a `submit-bc-order` step: call the BC sales-order-creation method with the resolved
   lines; handle full success, partial success (some lines unresolved), and full failure (BC call
   fails or zero lines resolve).
5. Implement outcome persistence: update the Medusa order's BC integration-state metadata (BC
   order id, status `sent`/`failed`, timestamp, incremented retry count), and for partial-failure
   cases, record per-line resolution failures (which line, why) alongside the order-level flag.
6. Guard against duplicate BC order creation on re-invocation of the reusable step (check existing
   integration-state before submitting again).
7. Wire the reusable step into the pipeline so it runs once NIMBUS-149 persists the Medusa order.
   The exact trigger mechanism from NIMBUS-149 into this step is left open for the implementation
   planner to decide (not fixed to any prior story's hand-off convention).
8. Tests: full-line-resolution submission (all lines succeed, status `sent`, BC order id stored);
   partial-line-resolution submission (order created with the resolved subset, order- and
   line-level failure flags recorded, status `sent`); full-failure submission (BC call fails or
   zero lines resolve, status `failed`, no BC order id fabricated); retry-count increments across
   repeated invocations; no duplicate BC order created when the step runs twice for the same
   Medusa order.

## Open Questions

- **Exact BC sales-order-creation endpoint/payload shape** (OData resource, bound action, or
  custom API) — confirmed to exist and be known, but the precise request/response contract is an
  implementation-planner detail to nail down against the real BC API.
- **Exact BC item-lookup filter** (which BC Item entity field holds the GTIN/EAN value, and the
  exact `$filter` shape) — planner to confirm against BC's actual item metadata.
- **Trigger mechanism from NIMBUS-149 into this story's reusable step** — explicitly left open,
  not assumed to follow the NIMBUS-144→147 non-awaited-workflow-call convention.
- **Exact metadata field names/shapes** for the order-level partial-failure flag and the
  line-level failure records — this scope fixes the requirement (both levels, one flag plus a
  per-line record with a reason), naming/typing is a planner decision.
- **Exact duplicate-submission guard mechanism** — this scope fixes the requirement (must not
  create a second BC sales order for the same Medusa order on re-invocation); the planner decides
  how (e.g. short-circuit on existing BC order id vs. a dedicated idempotency key).
- Whether NIMBUS-158's future admin UI needs anything from this story beyond invoking the reusable
  submission step and reading the integration-state (including line-failure) metadata — flagged
  for cross-check when NIMBUS-158 is scoped, not resolved now.

## Dependencies

- **NIMBUS-149** — supplies the persisted Medusa order, the raw canonical payload `metadata` key
  (line detail source of truth), and the BC integration-state `metadata` key this story updates.
- **NIMBUS-147** — canonical order contract; this story's item-lookup relies on the `eanNo` /
  `itemNumber` / `custItemNo` line fields it defines.
- **NIMBUS-153** — already built the `business-central` module (OAuth2 client, OData request
  conventions, `prepare-*`/`submit-*` workflow-step pattern) that this story extends with its
  first real order-submission write path.
- **NIMBUS-158** (not yet scoped) — will invoke this story's reusable BC-submission step to
  implement manual retry, and will read the BC integration-state metadata (including per-line
  failure records) for admin display.
- Existing `Company` model — `apps/backend/src/modules/company/models/company.ts`
  (`business_central_customer_number` field), used to determine which BC customer to submit the
  order under.
