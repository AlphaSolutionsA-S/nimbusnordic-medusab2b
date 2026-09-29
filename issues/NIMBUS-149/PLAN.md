# NIMBUS-149: Create and Persist the Medusa Order

**Issue:** https://alphasolutionsdk.atlassian.net/browse/NIMBUS-149
**Scope:** issues/NIMBUS-149/SCOPE.md (approved 2026-09-02)
**Branch:** `feature/NIMBUS-149` (from `develop`)
**Revision:** 2026-09-29 re-plan against the implemented NIMBUS-129 code on `develop`. Supersedes
the 2026-09-02 plan.

## Objective

Finish Medusa order persistence on top of what NIMBUS-129 Task 03 already built. Make order
creation roll back cleanly on failure and hold up against concurrent duplicates, initialize the
Business Central integration state that NIMBUS-148 and NIMBUS-158 depend on, and map the remaining
canonical header fields onto native Order columns.

## Analysis

### What is on `develop` today (verified from code, not from the old plan)

`POST /orderapi/orders` (`src/api/orderapi/orders/route.ts`) validates the body against the strict
`CanonicalOrderSchema` and awaits `createOrderFromCanonicalPayloadWorkflow`:

1. `matchCompanyAndCheckDuplicateStep`: resolves the company via
   `business_central_customer_number` (404 if none). It then lists `OrderExternalReference` rows
   for `(company_id, external_order_number)` and rejects with 422 if one exists.
2. `createOrderAndReferenceStep`: one step doing three mutations. It calls
   `Modules.ORDER.createOrders({ currency_code, email, metadata: { company_id, canonical_order,
   order_ingestion_state: "created", order_ingestion_state_updated_at } })`, then
   `remoteLink.create` for Order↔Company, then `createOrderExternalReferences`. Its compensation
   undoes all three using data from its own `StepResponse`.

After that, the route fires `order_ingestion.order_created` without awaiting it. The subscriber
then runs `enrichOrderWorkflow`, which read-merge-writes `order_ingestion_state =
"ready_for_business_central"` and emits `order_ingestion.ready_for_business_central`.

### Requirement reconciliation

| NIMBUS-149 requirement | Status on `develop` | This plan |
|---|---|---|
| Create a Medusa order from the validated canonical order | **Done** | — |
| No `OrderLineItem` records | **Done** (not asserted by any test) | Test added (Task 03) |
| Verbatim canonical payload in its own metadata key | **Done**: `metadata.canonical_order`. It is the zod output of a strict schema with no transforms or defaults, so it is structurally identical to the submitted JSON (not asserted) | Test added (Task 03) |
| Associate with matched company/customer | **Done for company** (`metadata.company_id` + link). No customer is resolved upstream, so `customer_id` stays unset | — |
| Map header fields onto native columns | **Partial**: `currency_code`, `email` only | Addresses + phone (Task 03) |
| BC integration-state object, separate metadata key | **Missing** | Task 02 |
| Failures surfaced and recoverable | **Partial**: step errors reach the caller as 404/422/5xx. A failure *inside* the 3-mutation step leaves orphans (below) | Task 01 |
| No double-creation (defense in depth) | **Partial**: sequential duplicates are rejected. Concurrent duplicates can both pass the read-then-write check, and there is no DB constraint | Task 01 |
| No secrets in metadata | **Done** | — |

### Gap 1: partial failure orphans the order (verified in Medusa 2.21 orchestrator)

When a step throws, the orchestrator does run that step's compensation (`flagStepsToRevert`
includes `PERMANENT_FAILURE` steps). It passes `undefined` compensation data, though, because no
`StepResponse` was returned. The existing compensation starts with `if (!compensationData)
return;`. So if the link or reference insert fails after `createOrders` succeeded, the order
stays behind. The caller then retries and gets a second order. The Medusa-idiomatic fix is one
mutation per step, each with its own compensation.

### Gap 2: no atomic duplicate guard

NIMBUS-129's PLAN.md recorded this: "no DB-level uniqueness constraint on
`OrderExternalReference(company_id, external_order_number)` … flagged as a follow-up hardening
item". The syntax it was unsure about has now been verified. The DML's
`.indexes([{ on: [...], unique: true, where: "deleted_at IS NULL" }])` is the same form used by
`@medusajs/order`'s own models.

### Contracts sibling stories expect from NIMBUS-149

- **NIMBUS-148** (plan pending approval) reads `metadata.canonical_order` and
  `metadata.company_id`, which are already written with those exact names. It also defines the
  integration-state contract in `src/modules/order-ingestion/bc-integration-state.ts`: key
  `business_central_integration`, with `status`, `bc_order_id`, `bc_order_number`,
  `attempt_count`, `initialized_at`, `last_attempt_at`, `sent_at`, `partial`, `failure_reason` and
  `line_failures`. It says NIMBUS-149 must initialize via `createInitialBcIntegrationState` rather
  than invent names. With a mismatched key, NIMBUS-148 would ignore the initialized state and
  write its outcome to a different key than the one NIMBUS-149 created. It triggers on
  `order_ingestion.ready_for_business_central`, which already exists.
- **NIMBUS-158** (planned; conditional) uses the old placeholder `bc_integration_state` /
  `retry_count` / `timestamp`. It has a mandatory reconciliation checklist against whatever 148 and
  149 actually implement. It relies on the state starting at `pending` so an admin can see and
  submit orders the automatic path never delivered.
- The old 2026-09-02 NIMBUS-149 plan used `bc_integration_state` / `retry_count` / `timestamp`.
  That conflicts with NIMBUS-148 and is superseded here.

## Execution Plan

1. **Task 01: Atomic order-creation steps + DB-level duplicate guard.** Split
   `createOrderAndReferenceStep` into `createIngestedOrderStep` (compensation: `deleteOrders`),
   Medusa's `createRemoteLinkStep` (built-in dismiss) and `createOrderExternalReferenceStep`
   (compensation: delete reference). Recompose the workflow and delete the old step. Add a
   composite unique index on `order_external_reference(company_id, external_order_number)` and
   generate its migration. Tests cover the unique index at module level, rollback of an order
   when a later step fails, and two concurrent identical submissions producing exactly one order.
2. **Task 02: BC integration-state contract + initialization.** Create
   `bc-integration-state.ts` with NIMBUS-148's exact key, types and
   `createInitialBcIntegrationState`. Write
   `metadata.business_central_integration = createInitialBcIntegrationState(now)` at order
   creation, sharing the timestamp with `order_ingestion_state_updated_at`. Tests: a unit test of
   the initial state, the state being present on a created order, and the state surviving
   `enrichOrderWorkflow`.
3. **Task 03: Header field mapping.** A pure `mapCanonicalOrderHeader` maps `currencyCode`,
   `email`, `shipTo`→`shipping_address` and `billTo`→`billing_address`. On each address,
   `name`→`company`, `contact`→`first_name`, `country`→lowercase `country_code`, and
   `phoneNumber`→`phone`. It is spread inline into `createOrders`. The stale placeholder comment
   in `enrich-order.ts` is replaced. Tests: mapper unit tests, a persisted shipping address with
   no line items and a verbatim `canonical_order`, and an order with no addresses.

## Decisions & Trade-offs

- **D1: Build on the existing workflow rather than write a parallel one.** Its name, input and
  output stay the same, so the route, the subscriber and NIMBUS-148/158 are unaffected.
- **D2: One mutation per step.** This fixes the orphaned-order gap using Medusa's own
  compensation model instead of a try/catch inside one step. `createRemoteLinkStep` is already
  used in this repo (`create-companies.ts`, `create-approvals.ts`). Trade-off: the workflow has
  four steps instead of two.
- **D3: DB unique index as the atomic duplicate guard.** The existing check stays for the
  friendly 422 on sequential duplicates. The index catches a genuine concurrent race at the
  reference insert, and the preceding steps then roll back. Trade-off: the race loser gets a 400
  (`INVALID_DATA "… already exists"`, Medusa's DB error mapper) rather than 422. It is only
  reachable under true concurrency. Rejected alternative: `acquireLockStep` keyed on
  company + number. It relies on the locking provider being shared across instances (none is
  configured in `medusa-config.ts`), while the index holds regardless of deployment topology.
  Deployment risk: the migration fails if a target DB already holds a duplicate pair; Task 01
  includes the pre-check query.
- **D4: Adopt NIMBUS-148's integration-state contract verbatim.** This means key
  `business_central_integration`, `attempt_count` rather than the scope's "retry count", and three
  timestamps. NIMBUS-148 is the writer with the most complex semantics, and its rationale holds:
  `attempt_count` counts total attempts, so `retry_count: 1` after a first send would mislead.
  NIMBUS-149 creates the file with only what it uses (key, types, factory). NIMBUS-148 appends
  its parser and guard. Trade-off: NIMBUS-148 Task 01 needs a small reconciliation from "create"
  to "append" (listed in manifest.md). The alternative, creating NIMBUS-148's whole file here,
  would ship unused parser code in this story.
- **D5: Map addresses synchronously and inline in `createOrders`.** This is atomic, and
  `deleteOrders` removes the addresses on compensation. It is used instead of the
  `enrichOrderWorkflow` placeholder, which would leave a window with an address-less order and add
  a second write.
- **D6: `name → company`, `contact → first_name`, `last_name` unset.** `OrderAddress` has a
  `company` column, so the business name and the attention person both keep their meaning. This
  replaces the old plan's `name → first_name`, which dropped `contact`.
- **D7: `phoneNumber` goes on every created address.** The order has no header phone column, and
  the phone belongs to the order contact, not to one address. If there are no addresses, it lives
  only in `canonical_order`.
- **D8: `country` is lowercased without validation.** `order_address.country_code` has no FK, so
  a non-ISO value is stored as given and cannot fail order creation. Both EDI samples use `"DK"`.
  Validating the code is NIMBUS-147's contract, and it was deliberately left as a free string.
- **D9: Post-creation recovery stays out of scope.** A lost `order_ingestion.order_created` event
  or a failed enrichment leaves `order_ingestion_state: "created"`, and nothing currently
  re-drives it. This is NIMBUS-129's recorded known limitation. Such orders are now visible with
  `business_central_integration.status: "pending"`, which is exactly what NIMBUS-158's admin
  submit/retry acts on. A scheduled recovery job is not built here.

## Open Questions (resolved — both approved by the user on 2026-09-29)

1. **Confirm D4 (approved):** NIMBUS-149 adopts NIMBUS-148's `business_central_integration` contract
   (`attempt_count`, not `retry_count`) and owns creating `bc-integration-state.ts`. NIMBUS-148
   Task 01 changes from "create" to "append". NIMBUS-148's plan is still pending approval, so this
   ties the two plans together. Recommended: yes.
2. **Confirm D6/D7 (approved):** the address mapping `name → company`, `contact → first_name`, and phone on
   both addresses. Recommended: yes.

## Observations for other plans (reported, not changed here)

- NIMBUS-148's plan still says NIMBUS-129 is unimplemented and marks its Task 05 BLOCKED on
  NIMBUS-129 Task 04. That task is DONE on `develop`, so the blocker is gone.
- NIMBUS-148 Decision 6 still sends `unitPrice` to BC as an open question. NIMBUS-129's PROGRESS.md
  (2026-09-16) records a user decision that a submitted `unitPrice` must **not** be sent as a BC
  line-price override.
- NIMBUS-158's placeholder field names need reconciling as described in manifest.md.

## Verification

- [ ] `cd apps/backend && pnpm test:unit` covers two cases:
      - `createInitialBcIntegrationState` returns the full pending object.
      - `mapCanonicalOrderHeader` maps shipTo/billTo/phone (company, contact, lowercased country,
        nulls for absent optionals) and leaves both addresses undefined when none are given.
- [ ] `cd apps/backend && pnpm test:integration:modules`: the unique index rejects a second
      `(company_id, external_order_number)` row and accepts the same number for another company.
      The existing TC-1..TC-3 still pass.
- [ ] `cd apps/backend && pnpm test:integration:http` covers:
      - All existing order-ingestion, orderapi and event-chain cases pass unchanged.
      - A failure after order creation leaves no orphaned order.
      - Two concurrent identical submissions create exactly one order and one reference.
      - A created order carries `metadata.business_central_integration` in its pending state,
        with `initialized_at` equal to `order_ingestion_state_updated_at`, and no
        `bc_integration_state` key.
      - `enrichOrderWorkflow` leaves the integration state untouched.
      - `multiLineCanonicalOrder` persists a shipping address (`company: "JK Tryk"`,
        `country_code: "dk"`, …), no billing address, zero line items, and
        `metadata.canonical_order` deep-equal to the submitted payload.
      - An order with no addresses is still created.
- [ ] `pnpm build` and `pnpm lint` from the repo root pass.
- [ ] Generated migration contains only the new unique index; the duplicate-pair pre-check query
      returns no rows on each target DB before deploy.
- [ ] Manual: `POST /orderapi/orders` with `order2.xml`-derived JSON shows the ship-to address on
      the order in Medusa Admin.
