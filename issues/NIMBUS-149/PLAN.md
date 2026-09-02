# NIMBUS-149: Create and Persist the Medusa Order

**Issue:** https://alphasolutionsdk.atlassian.net/browse/NIMBUS-149
**Scope:** issues/NIMBUS-149/SCOPE.md (approved)
**Branch:** `feature/NIMBUS-149` (from `develop`)

## Objective

Complete the Medusa order persistence that NIMBUS-129 Task 03 started as a minimal synchronous
slice. NIMBUS-129 Task 03 creates a header-only order with `currency_code`, `email`, and a
`metadata` blob containing `company_id`, `canonical_order`, and `order_ingestion_state`. This
story adds what that slice deliberately omitted:

1. **Canonical header field mapping** — map `billTo`/`shipTo` addresses, `phoneNumber`, and
   other canonical fields onto native Medusa Order columns/relations.
2. **BC integration-state metadata** — the `bc_integration_state` object (BC order id, status,
   timestamp, retry count) that NIMBUS-148 and NIMBUS-158 depend on.
3. **Idempotency** — defense against double-creating an order for the same validated canonical
   order.
4. **Failure handling** — recoverable failure mechanism for order-creation errors.

## Analysis

### What NIMBUS-129 Task 03 already built

NIMBUS-129 Task 03 (`issues/NIMBUS-129/03-create-order-workflow-implementation.md`) implements
`createOrderFromCanonicalPayloadWorkflow`, which:

- Matches the company via `Company.business_central_customer_number` (synchronous, in-request).
- Creates a header-only `Order` via `orderModuleService.createOrders({ currency_code, email,
  metadata: { company_id, canonical_order, order_ingestion_state: 'created',
  order_ingestion_state_updated_at } })`.
- Creates the Order↔Company remote link (replicating `order-created.ts` hook logic directly).
- Creates the `OrderExternalReference` dedupe row (per-company `externalOrderNumber` check).

**What it deliberately omitted** (per its own PLAN.md "Decisions & Trade-offs"):

> This plan's order creation does not address NIMBUS-149's traceability/normalized-source-
> information requirements, nor the Business-Central-integration-state fields NIMBUS-158's admin
> widget will eventually need to display.

NIMBUS-129 Task 04 (`04-order-ingestion-event-chain-implementation.md`) implements the async
event chain that runs after order creation. Its `enrichOrderWorkflow` has a placeholder
`// IMPLEMENT:` block that explicitly flags address mapping as a candidate enrichment step:

> A concrete candidate flagged for consideration: mapping the canonical `billTo`/`shipTo`
> address objects onto the Order's proper address relations — but the exact `CreateOrderDTO`/
> update-address field shape for this was not verified in this planning pass, so it is **not**
> implemented here.

### What NIMBUS-149 adds

This story fills the gap between what Task 03 built (bare `createOrders` with `currency_code`,
`email`, and metadata) and what NIMBUS-149's SCOPE requires (full header field mapping + BC
integration-state metadata + idempotency + failure handling).

**Key architectural decision: modify the existing workflow, not create a new one.** NIMBUS-129
Task 03's `createOrderFromCanonicalPayloadWorkflow` and its `createOrderAndReferenceStep` already
exist (as plans — all NIMBUS-129 tasks are TODO). This story's implementation modifies those
existing step/workflow files to add the missing pieces, rather than creating a parallel
order-creation workflow. This avoids duplication and keeps a single source of truth for order
creation.

If NIMBUS-129 has already been implemented by the time this story starts, the implementor
modifies the existing files. If NIMBUS-129 has not yet been implemented, the implementor adds
this story's requirements to the NIMBUS-129 task files (or implements them together).

### Medusa Order model — available columns and address types

Verified from `@medusajs/order` and `@medusajs/types` (installed packages):

**Order entity columns** (relevant for header mapping):

| Column | Type | Nullable | Canonical source |
|--------|------|----------|-----------------|
| `currency_code` | string | No | `canonicalOrder.currencyCode` |
| `email` | string | Yes | `canonicalOrder.email` |
| `customer_id` | string | Yes | (not directly from canonical — company context) |
| `status` | enum | No | Default `"pending"` (not set from canonical) |
| `metadata` | JSON | Yes | `canonical_order`, `bc_integration_state`, etc. |

**OrderAddress entity** (for `billTo`/`shipTo` mapping):

| Field | Canonical source |
|-------|-----------------|
| `first_name` / `last_name` | `billTo.name` / `shipTo.name` (split or use `first_name`) |
| `address_1` | `billTo.addressLine1` / `shipTo.addressLine1` |
| `address_2` | `billTo.addressLine2` / `shipTo.addressLine2` |
| `city` | `billTo.city` / `shipTo.city` |
| `country_code` | `billTo.country` / `shipTo.country` |
| `province` | `billTo.state` / `shipTo.state` |
| `postal_code` | `billTo.postCode` / `shipTo.postCode` |
| `phone` | `canonicalOrder.phoneNumber` (on shipping address) |

**`CreateOrderDTO`** accepts inline `shipping_address` and `billing_address` as
`CreateOrderAddressDTO` objects — no need to create addresses separately first.

**`updateOrders`** uses a two-argument form: `updateOrders(id, data)` — verified from
`apps/backend/src/workflows/order/steps/update-order.ts`.

### Fields that cannot map to native Order columns

| Canonical field | Why it can't map | Where it goes instead |
|----------------|------------------|----------------------|
| `orderDate` | No `order_date` column; `created_at` is auto-set | Metadata (already in `canonical_order`) |
| `requestedDeliveryDate` | No such column on Order | Metadata (already in `canonical_order`) |
| `salesperson` | No such column | Metadata (already in `canonical_order`) |
| `discountAmount` / `discountAppliedBeforeTax` / `pricesIncludeTax` | No such columns | Metadata (already in `canonical_order`) |
| `company_id` | Not a column; linked via remote link | `metadata.company_id` (already done by Task 03) |

All of these are already preserved verbatim in the `canonical_order` metadata key — no
additional work needed for fields that don't map to native columns.

### Key design decisions

**D1 — Add BC integration-state metadata to the order-creation step, not as a separate step.**

The `bc_integration_state` object is initialized at order creation time. Adding it to the
`createOrderAndReferenceStep`'s `metadata` object (alongside the existing `company_id`,
`canonical_order`, and `order_ingestion_state` keys) is the simplest approach — it's one
`createOrders` call with a richer metadata blob. A separate step would require an immediate
`updateOrders` call, adding complexity for no benefit.

**D2 — Map `billTo`/`shipTo` as inline `CreateOrderAddressDTO` objects in `createOrders`.**

The `CreateOrderDTO` accepts `shipping_address` and `billing_address` as inline objects. This
is simpler than creating addresses separately and passing IDs. The mapping is:

- `canonicalOrder.shipTo` → `shipping_address` (if present)
- `canonicalOrder.billTo` → `billing_address` (if present)
- `canonicalOrder.phoneNumber` → `shipping_address.phone` (if shipping address exists)
- `canonicalOrder.email` → `order.email` (already done by Task 03)

If `billTo`/`shipTo` are absent (they're optional per the canonical contract), no address is
set — the Order is created without addresses, and BC's default master data is used downstream
(per NIMBUS-147's SCOPE).

**D3 — `name` field mapping: use `first_name` on `OrderAddress`.**

The canonical address has a single `name` field (e.g. "JK Tryk"). The `OrderAddress` has
`first_name` and `last_name`. The simplest mapping is to put the entire `name` value in
`first_name` and leave `last_name` empty. Splitting on space would be fragile (company names
don't have a reliable first/last name split).

**D4 — `country` → `country_code` mapping: lowercase the value.**

The canonical contract uses `country` (e.g. "DK"). The `OrderAddress` uses `country_code`,
which Medusa stores as a lowercase ISO 3166-1 alpha-2 code (e.g. "dk"). The mapping lowercases
the value.

**D5 — Idempotency: rely on the existing `OrderExternalReference` dedupe row.**

NIMBUS-129 Task 03's `matchCompanyAndCheckDuplicateStep` already checks the
`OrderExternalReference` table for an existing `(company_id, external_order_number)` pair and
throws `DUPLICATE_ERROR` if one exists. This is the primary idempotency mechanism. NIMBUS-149's
SCOPE asks for "defense in depth alongside NIMBUS-147's per-company `externalOrderNumber`
duplicate check upstream" — the `OrderExternalReference` check IS that defense in depth. No
additional idempotency mechanism is needed for this story.

**D6 — Failure handling: let the workflow step's compensation handle rollback.**

NIMBUS-129 Task 03's `createOrderAndReferenceStep` already has a compensation function that
deletes the `OrderExternalReference`, dismisses the remote link, and deletes the order on
failure. This is the recoverable failure mechanism — if order creation fails, the compensation
rolls back all three artifacts, and the route returns an error to the caller. No additional
failure-handling mechanism (logging, error state, alerting) is needed for this story's scope;
the existing workflow error propagation is sufficient.

**D7 — BC integration-state object shape.**

```typescript
interface BcIntegrationState {
  bc_order_id: string | null;     // null until NIMBUS-148 sets it
  status: 'pending';              // initial value — NIMBUS-148 changes to 'sent' | 'failed'
  timestamp: string;              // ISO timestamp of initialization
  retry_count: 0;                 // initial value — NIMBUS-148 increments
}
```

Metadata key: `bc_integration_state` (separate from `canonical_order` and
`order_ingestion_state`).

This shape is the stable contract that NIMBUS-148 (updates `status`, `bc_order_id`,
`retry_count`, `timestamp`) and NIMBUS-158 (reads `status`, `bc_order_id`, `retry_count`) depend
on. The NIMBUS-158 plan already uses this shape as its placeholder.

## Execution Plan

### Task 01: Header field mapping + BC integration-state metadata

Modify the existing `createOrderAndReferenceStep` (from NIMBUS-129 Task 03) to:

1. Map `canonicalOrder.shipTo` → `shipping_address` (inline `CreateOrderAddressDTO`).
2. Map `canonicalOrder.billTo` → `billing_address` (inline `CreateOrderAddressDTO`).
3. Map `canonicalOrder.phoneNumber` → `shipping_address.phone`.
4. Add `bc_integration_state` to the `metadata` object with initial values.

If NIMBUS-129 Task 03 has not yet been implemented, add these requirements to its task file. If
it has been implemented, modify the existing step file.

### Task 02: Idempotency verification + failure handling documentation

1. Verify that the existing `OrderExternalReference` dedupe check (from NIMBUS-129 Task 03's
   `matchCompanyAndCheckDuplicateStep`) satisfies NIMBUS-149's idempotency requirement.
2. Verify that the existing compensation function (from `createOrderAndReferenceStep`) satisfies
   NIMBUS-149's failure-handling requirement.
3. Document the failure-handling behavior in the task file — no additional code needed if the
   existing mechanisms are sufficient.

### Task 03: Integration tests

Test the order-creation workflow with the new header mapping and BC integration-state metadata:

1. Order with `shipTo` address → address mapped to `shipping_address`.
2. Order with `billTo` address → address mapped to `billing_address`.
3. Order without `billTo`/`shipTo` → no addresses set, order still created.
4. `phoneNumber` mapped to `shipping_address.phone`.
5. `bc_integration_state` metadata present with correct initial values.
6. `canonical_order` metadata present and verbatim.
7. No `OrderLineItem` records created.
8. Duplicate `externalOrderNumber` for same company → rejected (existing idempotency).
9. Order creation failure → compensation rolls back (existing behavior).

## Cross-Task Wiring Summary

- Task 01 modifies the existing `createOrderAndReferenceStep` from NIMBUS-129 Task 03. The
  workflow's input/output shape does not change — only the `createOrders` call's arguments are
  enriched with address mapping and the `metadata` object gains the `bc_integration_state` key.
- Task 02 is a verification/documentation task — no code changes. It confirms that the existing
  idempotency and failure-handling mechanisms from NIMBUS-129 Task 03 satisfy NIMBUS-149's
  requirements.
- Task 03 tests the modified workflow. It extends NIMBUS-129 Task 03's existing test cases
  (which test order creation, company link, and external reference) with assertions for address
  mapping and BC integration-state metadata.

## Environment / Config Changes

- No `medusa-config.ts` changes.
- No new modules, no DB migrations, no env vars.
- No `pnpm` package installs.
- The only code changes are to files that NIMBUS-129 Task 03 already plans to create (or has
  created): `createOrderAndReferenceStep` and its test file.

## Decisions & Trade-offs

### D1: Modify existing workflow vs. create a new one

**Chosen:** Modify the existing `createOrderFromCanonicalPayloadWorkflow` from NIMBUS-129 Task
03. **Why:** Creating a parallel workflow would duplicate the company-matching, order-creation,
link-creation, and dedupe-row-creation logic. The existing workflow is the single source of truth
for order creation — this story enriches it, not replaces it.

**Trade-off:** This story's implementation is coupled to NIMBUS-129 Task 03's implementation. If
Task 03's design changes, this story's changes must track it. This is acceptable — the
alternative (a separate workflow) would be worse.

### D2: Inline addresses in `createOrders` vs. separate address creation

**Chosen:** Inline `CreateOrderAddressDTO` objects in the `createOrders` call. **Why:** The
`CreateOrderDTO` supports inline addresses — no need to create addresses separately and pass
IDs. This is simpler and atomic (addresses are created with the order, no orphan addresses on
failure).

**Trade-off:** If the address creation fails, the entire `createOrders` call fails and the
compensation deletes the order. This is the desired behavior.

### D3: `name` → `first_name` mapping (no split)

**Chosen:** Put the entire `name` value in `first_name`, leave `last_name` empty. **Why:**
Company names (e.g. "JK Tryk") don't have a reliable first/last name split. Splitting on space
would produce incorrect results for multi-word company names.

**Trade-off:** The `last_name` field is always empty for these orders. This is cosmetic — the
admin UI displays `first_name` + `last_name` concatenated, so the full name still appears
correctly.

### D4: `country` → `country_code` lowercasing

**Chosen:** Lowercase the `country` value (e.g. "DK" → "dk"). **Why:** Medusa stores
`country_code` as a lowercase ISO 3166-1 alpha-2 code. The canonical contract uses uppercase
(e.g. "DK" from the EDI samples). The mapping is a simple `.toLowerCase()`.

**Trade-off:** If the canonical contract ever uses full country names (e.g. "Denmark"), this
mapping would produce an invalid country code. The canonical contract's `country` field is
defined as a string with no format constraint — the implementor should verify that real
submissions always use ISO 3166-1 alpha-2 codes.

### D5: Idempotency via existing `OrderExternalReference`

**Chosen:** Rely on the existing per-company `externalOrderNumber` dedupe check. **Why:**
NIMBUS-129 Task 03's `matchCompanyAndCheckDuplicateStep` already checks the
`OrderExternalReference` table and throws `DUPLICATE_ERROR` on a match. This is the "defense in
depth" the SCOPE asks for — the primary check is NIMBUS-147's upstream validation, and the
`OrderExternalReference` check is the secondary check. No additional mechanism is needed.

**Trade-off:** There is no tertiary check (e.g. a unique constraint on the Order table itself).
This is acceptable — two checks (upstream validation + dedupe row) are sufficient for this
story's scope.

### D6: Failure handling via existing compensation

**Chosen:** Rely on the existing workflow compensation. **Why:** The
`createOrderAndReferenceStep`'s compensation function already deletes the
`OrderExternalReference`, dismisses the remote link, and deletes the order on failure. This is
the "recoverable failure" mechanism the SCOPE asks for — the caller gets an error response, and
no partial artifacts are left behind.

**Trade-off:** No explicit error-state logging or alerting is added. The workflow engine's
built-in error propagation (which surfaces errors to the route handler, which returns a 4xx/5xx
response) is sufficient. A future story could add structured logging or alerting, but that is
out of scope here.

## Open Items for the Implementor

1. **Reconcile with NIMBUS-129 Task 03's implementation status** — if Task 03 has already been
   implemented, modify the existing files. If not, add this story's requirements to Task 03's
   task file or implement them together.

2. **Verify `country` field format** — confirm that real submissions always use ISO 3166-1
   alpha-2 codes (e.g. "DK"). If full country names are possible, add a country-code lookup.

3. **Verify `name` mapping** — confirm that putting the full name in `first_name` is acceptable
   for the admin UI's display. If the admin UI requires `last_name` for proper display, adjust
   the mapping.

4. **Verify `phoneNumber` placement** — the canonical `phoneNumber` is an order-header field,
   not an address field. This plan maps it to `shipping_address.phone`. If it should go on
   `billing_address.phone` instead (or both), adjust the mapping.

5. **Reconcile BC integration-state key name** — this plan uses `bc_integration_state`. The
   NIMBUS-158 plan also uses `bc_integration_state` as its placeholder. Verify that NIMBUS-148's
   plan uses the same key name (it has not been planned yet, but its SCOPE references the same
   metadata object).
