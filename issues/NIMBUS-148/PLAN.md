# NIMBUS-148: Send the Medusa order to Business Central

**Issue:** https://alphasolutionsdk.atlassian.net/browse/NIMBUS-148
(Epic: https://alphasolutionsdk.atlassian.net/browse/NIMBUS-129)

## Objective

Take the persisted, header-only Medusa order and its retained canonical payload, resolve each order
line to a real Business Central item, create the corresponding BC sales order, and record the
outcome — including partial and total failures at both order and line level — back onto the order's
Business Central integration-state metadata, as a reusable workflow that NIMBUS-158's future manual
retry will invoke unchanged.

## ⚠️ Biggest risk, read this first: the contract this story "consumes" does not exist

SCOPE.md describes NIMBUS-148 as *updating NIMBUS-149's* BC integration-state metadata object and
*reading NIMBUS-149's* raw canonical payload key. Neither exists:

- **NIMBUS-149 is scoped but not planned and not implemented.** Its SCOPE.md explicitly defers
  "exact `metadata` key names and field types" to its own future planner.
- **NIMBUS-129 (NIMBUS-144 + NIMBUS-147) is planned and approved but also not implemented** —
  verified by inspection: `apps/backend/src/modules/` contains only `approval`,
  `business-central`, `company`, `quote`; `apps/backend/src/subscribers/` contains only
  `README.md`; there is no `/orderapi` route and no `order-ingestion` module or workflow directory.

So NIMBUS-148 is being planned on top of two layers of unbuilt code. This plan handles that two
ways rather than pretending the contract is settled:

**1. It defines the contract explicitly, here, in one importable file.**
`apps/backend/src/modules/order-ingestion/bc-integration-state.ts` (Task 01) is the authoritative
shape:

```
Order.metadata.business_central_integration = {
  status:           "pending" | "sent" | "failed",
  bc_order_id:      string | null,
  bc_order_number:  string | null,
  attempt_count:    number,
  initialized_at:   string | null,   // ISO — set by NIMBUS-149
  last_attempt_at:  string | null,   // ISO — set by NIMBUS-148 on every attempt
  sent_at:          string | null,   // ISO — set by NIMBUS-148 on success only
  partial:          boolean,         // order-level partial-submission flag
  failure_reason:   string | null,
  line_failures:    Array<{ line_number, ean_no, item_number, cust_item_no, reason, message }>,
}
Order.metadata.canonical_order = <verbatim canonical order JSON, incl. the full lines array>
Order.metadata.company_id      = <matched Medusa company id>
```

**ACTION REQUIRED when NIMBUS-149 is planned: it must import
`createInitialBcIntegrationState` and `BC_INTEGRATION_STATE_METADATA_KEY` from that file rather
than inventing its own names, and it must write the raw payload under `canonical_order`.**
NIMBUS-158 must read via `parseBcIntegrationState`. If NIMBUS-149's planner instead invents its own
shape, NIMBUS-148 silently reads nothing, every order records `failed` with
`canonical_payload_unavailable`, and no BC order is ever created. This is the single highest-impact
failure mode in the plan.

Two of the three keys are chosen for maximum compatibility rather than aesthetics:
`canonical_order` and `company_id` are already the exact key names NIMBUS-129's approved Task 03
writes, so NIMBUS-149 has nothing to change there. Only
`business_central_integration` is genuinely new — and NIMBUS-129 never named it, so there is no
conflict to reconcile.

**2. It designs defensively so that a contract mismatch degrades instead of exploding.** Task 01's
`parseBcIntegrationState` coerces anything absent, partial, or malformed into a well-formed pending
state, and `parseBcOrderPayload` validates the metadata payload at runtime with a deliberately
**narrow, non-strict** zod schema covering only the fields BC submission needs. Consequences:
NIMBUS-148 never imports NIMBUS-129's `CanonicalOrder` type, so **tasks 01–04 compile, build, and
test with zero dependency on NIMBUS-129 or NIMBUS-149**; a canonical contract that grows new fields
does not break this story; and an unusable payload is recorded as a visible `failed` outcome rather
than crashing a subscriber. Only Task 05 (the trigger subscriber) has a hard dependency on
NIMBUS-129, and it is marked BLOCKED accordingly.

## Analysis

### What already exists and is reused

- **`business-central` module** (`apps/backend/src/modules/business-central/`, NIMBUS-153):
  OAuth2 client-credentials against Azure AD (`login.microsoftonline.com/{tenant}/oauth2/v2.0/token`,
  scope `https://api.businesscentral.dynamics.com/.default`), strict discovery-URL validation
  (https-only, host-pinned, `/v2.0/{tenant}/...` shape), `escapeODataString`, `MedusaError`
  throwing with no caller-side try/catch, and reads against root-level OData entity sets
  (`customers()`, `SalesOrders()`). All four new service methods follow this exactly — **no second
  HTTP client pattern is introduced**, per SCOPE.md's non-functional requirement.
- **`business-central-return` workflow** (`src/workflows/business-central-return/`): the
  `steps/` + `workflows/` layout with `index.ts` barrels and the `prepare-*` / `submit-*` step
  naming. Copied.
- **`Company.business_central_customer_number`** (nullable text, already present) — the BC customer
  the order is submitted under.
- **`Order.metadata.company_id`** as the company reference — already the convention used by
  `src/workflows/hooks/order-created.ts` and by NIMBUS-129's Task 03.
- **Backend test infrastructure** — three real jest projects, no scaffolding needed:
  `pnpm test:unit` (`**/src/**/__tests__/**/*.unit.spec.ts`), `pnpm test:integration:modules`
  (`**/src/modules/*/__tests__/**/*.ts`), `pnpm test:integration:http`
  (`**/integration-tests/http/**/*.spec.ts`). The existing
  `src/modules/business-central/__tests__/service.spec.ts` is the exact pattern for
  `global.fetch`-mocked service tests, reused verbatim in Tasks 02/03.

### What did not exist and had to be built from BC's real metadata

Both of SCOPE.md's BC open questions were **resolved against the actual OData `$metadata`** in
`issues/NIMBUS-129/bc metadata/std odata metadata.xml`, not guessed:

- **The Item field holding the EAN/GTIN is `gtin`** (`Edm.String`, `MaxLength="14"`) on
  `<EntityType Name="item">`. Lookup filter: `items()?$filter=gtin eq '<escaped>'&$top=2`. The
  real EDI samples' `eanNo` values are GTIN-13 strings (`5712094145752`), which fit.
- **Sales-order creation is plain OData resource POSTs, not a bound action and not a custom API.**
  The standard API v2.0 exposes `salesOrders` and `salesOrderLines` as root-level entity sets, and
  BC does **not** support deep-inserting lines inside the header POST — so creation is
  `POST /salesOrders` followed by one `POST /salesOrders(<guid>)/salesOrderLines` per line. The
  custom `metadata masterdata.xml` API surface was checked too and is irrelevant here: customers,
  prices, contacts, item availability, and **zero** `<Action>`/`<Function>` declarations.
- `lineType` for an item line is the string `"Item"` (enum `Microsoft.NAV.invoiceLineAggLineType`),
  which also confirms the existing return workflow's `lineType === "Item"` filter.
- BC's two-call creation API is what makes SCOPE.md's partial-submission requirement natural to
  implement: each line succeeds or fails independently.

### Constraints carried in from sibling stories

- **No `OrderLineItem` records exist** for these orders (Medusa has no product catalog behind the
  items) — so BC lines are built from `metadata.canonical_order.lines`, never from Medusa order
  items. Binding constraint from NIMBUS-147/149 scoping.
- The external caller **never** receives the BC order id or any BC outcome, by any mechanism —
  confirmed in NIMBUS-129's PROGRESS.md. This story therefore has no response contract at all; its
  only output is metadata.
- **`createReturnFromSalesOrder` is a stub** (`// STUB (NIMBUS-138 task 09)`). This story
  deliberately does **not** follow that precedent — the user confirmed a real HTTP implementation,
  and a fabricated `bcso_stub_...` id would poison the very field NIMBUS-158's widget displays as a
  real BC order number.

## Execution Plan

1. **Task 01 — the contract.** `bc-integration-state.ts` (metadata key, state type, status union,
   line-failure type, `createInitialBcIntegrationState`, defensive `parseBcIntegrationState`,
   `hasBusinessCentralOrder` duplicate guard) and `bc-order-payload.ts` (payload/company-id metadata
   keys, narrow non-strict zod schema, `parseBcOrderPayload`, `readCompanyIdFromMetadata`).
   9 unit test cases.
2. **Task 02 — BC item lookup.** One batch method `findItemsForOrderLines` on the
   `business-central` module: per line, try `gtin eq eanNo` → `number eq itemNumber` →
   `number eq custItemNo`, `$top=2` to detect ambiguity, first single match wins, duplicate
   candidates skipped. 10 fetch-mocked module test cases.
3. **Task 03 — BC sales-order creation.** `createSalesOrder`: real header POST + per-line POSTs,
   canonical→BC flat field mapping, line rejections collected rather than thrown. 10 fetch-mocked
   module test cases.
4. **Task 04 — the reusable workflow.** `prepareBcOrderStep` (read metadata, duplicate guard,
   resolve company + BC customer number, resolve items, partition resolved/unresolved),
   `submitBcOrderStep` (the BC write, errors converted to a recorded outcome),
   `recordBcOrderOutcomeStep` (read-merge-write the integration state, increment `attempt_count`,
   compensating restore), and `sendOrderToBusinessCentralWorkflow` chaining all three. 10
   container-backed HTTP-suite test cases.
5. **Task 05 — the trigger (BLOCKED).** A subscriber on
   `order_ingestion.ready_for_business_central` running Task 04's workflow. Blocked on NIMBUS-129's
   Task 04 landing. 4 test cases.

## Decisions & Trade-offs

### 1. The 149→148 trigger is a subscriber on `order_ingestion.ready_for_business_central`

SCOPE.md left this explicitly open and warned against assuming the NIMBUS-144→147 non-awaited-
workflow convention. It does not apply — **that convention was superseded** by NIMBUS-129's own
architectural redesign, which replaced fire-and-forget workflow calls with real Medusa domain
events on an explicit user directive. And NIMBUS-129's Task 04 already emits
`order_ingestion.ready_for_business_central` **specifically for this story**, with a written note
that NIMBUS-148's subscriber should use exactly that `config.event`. Choosing anything else would
strand a deliberately-provisioned boundary event and invent a parallel path.

Rejected, recorded so they are not re-litigated:
- *Calling the submission workflow from inside `enrichOrderWorkflow`* — makes a BC outage fail (and
  compensate) ingestion enrichment, and couples two stories' workflows.
- *A scheduled job polling for `pending` integration states* — no scheduled-job infrastructure is
  in use, and NIMBUS-129 already flagged that filtering orders by a nested `metadata` JSON key via
  `query.graph()` is not a verified-reliable pattern in this codebase. Worth building later as a
  *recovery* mechanism (it would also close NIMBUS-129's "stuck mid-chain" gap); not the primary
  trigger.

### 2. Duplicate guard = short-circuit on `bc_order_id` set **or** `status === "sent"`

The BC order id *is* the natural idempotency token: it is already required to be stored for
NIMBUS-158, so this needs no extra field, no extra table, and no migration — unlike the alternative
of a dedicated idempotency key. Checking `bc_order_id` as well as `status` also covers the edge
case where BC accepted the header but rejected every line: a BC order exists, so a re-invocation
must not create a second one even though the recorded status is `failed`.

### 3. `attempt_count`, not `retry_count` — and a short-circuited invocation does not increment

NIMBUS-149's scope calls the field "a retry count"; NIMBUS-148's scope redefines its semantics as
*total attempts including the first automatic one*. Those two readings conflict, so the field is
named `attempt_count` to match the behaviour that was actually specified — a successful first send
leaves it at `1`, and `retry_count: 1` after a first non-retry would be actively misleading.
**NIMBUS-149 must adopt this name.**

SCOPE.md's phrase "increments on every invocation" is interpreted as *every invocation that makes
an attempt*. A duplicate-guarded short-circuit increments nothing and touches no status or
timestamp — consistent with SCOPE.md's own rule that "`pending` is left untouched if this story's
logic never actually attempts a submission". Flagged rather than assumed, because a literal reading
of "every invocation" could also mean no-ops count.

### 4. Business failures are returned as data, not thrown

`prepareBcOrderStep` and `submitBcOrderStep` return a discriminated outcome instead of throwing for
missing companies, unusable payloads, zero resolved lines, or BC rejections. If they threw, the
workflow would abort before the recording step and the integration state would be stranded at
`pending` — the exact opposite of SCOPE.md's "on a failed submission … set status to `failed`". Only
a genuinely exceptional case throws: the Medusa order id not existing (`MedusaError.NOT_FOUND`),
where there is no metadata to record onto. This also avoids `when()` in the workflow composition:
each step no-ops on its own discriminator, so no conditional composition is needed and no
`transform()` is needed either.

### 5. BC line rejections after the header exists are collected, not thrown

Both directions were weighed:
- *Throwing* on the first rejected line gives a simpler method contract — but the BC header already
  exists and cannot be un-created, so the caller would record `failed` with no BC order id, an
  orphan header would sit in BC, and NIMBUS-158's retry would create a **second** BC order.
- *Collecting* keeps the real BC order id available whenever a BC order actually exists, so the
  duplicate guard is always armed.

Collecting wins: preventing a duplicate BC order is an explicit requirement; a tidy signature is
not. **Consequence, flagged for NIMBUS-158:** an outcome can be `failed` *and* carry a real
`bc_order_id` (`failure_reason: "all_lines_rejected_by_bc"`). NIMBUS-158's retry must decide what
to do with that — clear the id after manual BC cleanup, or add lines to the existing BC order. Not
solved here.

### 6. `unitPrice` is sent to BC — **open business question**

The canonical contract deliberately retains per-line `unitPrice` and the real EDI samples populate
it (`209,25`). Sending it makes BC use the price the customer's system stated; omitting it makes BC
price from the customer's own BC price list. These differ whenever the two disagree, and which is
correct is a **business** decision. This plan sends it (silently discarding submitter-supplied data
is the worse default) and flags it. If the answer is "let BC price it", the change is one line:
stop setting `unitPrice` in `buildSalesOrderLineBody`.

### 7. No compensation on the BC write, mitigated by logging

`submitBcOrderStep` has no compensation function: a created BC sales order is externally visible
business data in another system, and silently deleting it on a downstream failure is worse than
leaving it. **Known limitation:** if `recordBcOrderOutcomeStep` fails after the BC order was
created, compensation restores the old metadata, the state stays `pending`, and a later invocation
would duplicate the BC order. Mitigation: the BC order id and number are logged at `info` the
instant they are known, so the id is recoverable and reconcilable by hand. A durable fix (write the
id in its own step before computing the rest of the outcome, or an outbox row) is out of scope.

### 8. `custItemNo` can only be matched against `item.number`

BC's Item Reference / Item Cross Reference table is **not** exposed by the standard OData v2.0 API,
and the custom masterdata API exposes no item-reference entity either. So the `custItemNo` fallback
SCOPE.md requires resolves against the same `item.number` field as `itemNumber`. In the real EDI
samples `custItemNo` equals `itemNumber` on every line, so the third attempt is currently a no-op in
the happy path (and Task 02 skips the duplicate request rather than issuing it twice). It exists
because SCOPE.md mandates the third attempt. **If genuine customer-item-number resolution is needed,
it requires a BC-side custom API page** — flagged, not built.

### 9. Batch item lookup rather than per-line

`BusinessCentralModuleService` has no token caching — every public method mints a fresh Azure AD
token. A per-line lookup would therefore mint one token per order line. `findItemsForOrderLines`
takes the whole batch, mints one token, and issues only item requests. This keeps SCOPE.md's
"reuse the existing conventions, don't introduce a second HTTP client" intact without adding a
caching layer.

### 10. Not doing: BC field-length truncation, blocked-item rejection

BC enforces `MaxLength` on `description` (100), `externalDocumentNumber` (35),
`unitOfMeasureCode` (10), `salesperson` (20). This plan does not truncate — an over-long value is
sent as-is and BC rejects it, surfacing as a recorded failure rather than as silently-corrupted BC
data. Real sample values are far inside the limits. Likewise, `item.blocked` is read but blocked
items are **not** rejected: SCOPE.md says nothing about it and inventing the rule would be
speculative. Both flagged for the business, not implemented.

## Observations for other plans (not fixed here)

- **NIMBUS-129 Task 02 has a jest-collection hazard.** Its planned
  `apps/backend/src/modules/order-ingestion/__tests__/canonical-order-fixtures.ts` sits inside a
  directory matched by `testMatch: ["**/src/modules/*/__tests__/**/*.[jt]s"]` under
  `TEST_TYPE=integration:modules`. Jest will collect that non-spec fixture file as a test suite and
  fail it with "Your test suite must contain at least one test." NIMBUS-148 avoids the trap by
  declaring every fixture inline in its own spec file; NIMBUS-129 should either move that file out
  of `__tests__/` or narrow its own testMatch. **Reported, not changed** — it is another plan's
  file.
- **`BCOrderStatus` in `types.ts` does not match BC's real enum.** The repo declares
  `"Open" | "Released" | "Pending Approval" | "Pending Prepayment" | "Shipped" | "Invoiced"`, but
  `Microsoft.NAV.salesOrderEntityBufferStatus` has exactly three members: `Draft`, `In Review`,
  `Open`. Pre-existing, out of scope, and this story's `BCCreatedSalesOrder.status` is a plain
  `string` precisely so it does not inherit the mismatch. Reported for attention.

## Verification

- [ ] `cd apps/backend && pnpm test:unit` — Task 01, 9 cases: initial state is pending/zero; the
      state parser round-trips a full state; it falls back to pending for `undefined`/`null`/a
      string/an unrecognized status; it drops malformed line failures and coerces unknown reasons;
      `hasBusinessCentralOrder` fires on either signal; the payload reader accepts a real
      EDI-derived order, tolerates unmodelled fields, and reports missing/empty-`lines`/non-object
      payloads as a result rather than throwing; the company-id reader accepts only non-empty
      strings.
- [ ] `cd apps/backend && pnpm test:integration:modules` — Task 02, 10 cases: resolves by `eanNo`
      without attempting fallbacks; falls back to `itemNumber` on a miss **and** on an ambiguous
      EAN; falls back to `custItemNo` when it differs; does not repeat an identical filter when
      `custItemNo === itemNumber`; reports `ambiguous`, `no_identifiers` (with no HTTP call), and
      `not_found` correctly; resolves a mixed batch with one token in input order; throws on a
      failing BC request; short-circuits an empty batch with no HTTP call at all.
- [ ] `cd apps/backend && pnpm test:integration:modules` — Task 03, 10 cases: header POST then one
      POST per line to the containment URL; canonical→BC flat header mapping (including
      `shipToContact`) with no `number`/`id`/`lines` keys; `lineType: "Item"` + `itemId` per line;
      absent optionals omitted rather than sent as `null`; a rejected line collected with the BC
      order id still returned; every line rejected still returns the id; a failing header POST
      throws and attempts no line request; a header response with no `id` throws; empty
      `lines`/blank `customerNumber` rejected before any network call; one token for the whole
      operation.
- [ ] `cd apps/backend && pnpm test:integration:http` — Task 04, 10 cases: full submission records
      `sent` + real BC id + `attempt_count: 1`; partial submission calls BC with the resolved
      subset only and records `partial: true`, `failure_reason: "partial_lines_submitted"`, and a
      per-line failure with that line's identifiers; zero resolved lines creates **no** BC order and
      records `failed`/`no_lines_resolved`/no id; a failing BC call records
      `failed`/`bc_submission_failed`/no fabricated id; `attempt_count` reaches 1→2→3 across
      repeated invocations; a second invocation after success calls `createSalesOrder` exactly once
      in total and leaves the state byte-identical; a missing canonical payload records
      `failed`/`canonical_payload_unavailable` instead of staying `pending`; a company with no BC
      customer number records `bc_customer_number_missing`; an unknown order id throws; recording
      the outcome preserves `canonical_order`, `company_id`, and `order_ingestion_state`.
- [ ] `cd apps/backend && pnpm test:integration:http` — Task 05, 4 cases: the handler drives the
      order to `sent`; it resolves rather than throwing when the workflow throws; `config.event`
      equals `order_ingestion.ready_for_business_central`; running
      `enrichOrderWorkflow` drives the order to `sent` end to end through the real event bus.
- [ ] `pnpm build` and `pnpm lint` from the repo root pass after all tasks.
- [ ] Manual, against a BC sandbox, once tasks 01–04 are merged (the mocked tests cannot prove the
      wire contract): submit one real order and confirm a BC sales order appears with the expected
      `externalDocumentNumber`, customer, and lines. **Specifically watch for a `400` on the header
      POST complaining about `billToCustomerNumber`** — that field is `Nullable="false"` in BC's
      metadata but is normally server-derived from `customerNumber`; if BC insists on it, the fix is
      to also set `billToCustomerNumber: params.customerNumber` in `buildSalesOrderHeaderBody`.
