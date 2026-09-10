# Send the Medusa order to Business Central

- **Date:** 2026-09-02
- **Type:** Story
- **Tracker:** JIRA — https://alphasolutionsdk.atlassian.net/browse/NIMBUS-148
- **Priority:** Medium
- **Project Folder:** issues/NIMBUS-148/
- **Updated by:** main session (see note below)
- **Outcome:** Scope approved; implementation planning is the next stage. As with NIMBUS-144/147/149,
  the user has not asked for the implementation-planner to be triggered yet — normal backlog pace.
- **Handover to:** implementation-planner agent (on request — not yet triggered)
- **Handover prompt:** Read `issues/NIMBUS-148/SCOPE.md` and plan the implementation for sending
  the persisted Medusa order (from NIMBUS-149) to Business Central. Scope is: (1) add a BC
  item-lookup method to the `business-central` module (`apps/backend/src/modules/business-central/`)
  resolving each canonical order line via `eanNo` first, falling back to `itemNumber`/`custItemNo`
  on failure or ambiguity; (2) add a real (non-stub) BC sales-order-creation method to the same
  module, following its existing OAuth2/OData conventions; (3) implement a `prepare-*`/`submit-*`
  workflow-step pair (matching the pattern in `workflows/business-central-return/`) that reads
  NIMBUS-149's raw canonical payload and BC integration-state metadata, resolves the BC customer
  via `Company.business_central_customer_number`, resolves each line's BC item, and submits the BC
  order with whatever lines resolve — partial resolution is allowed, not a hard failure; (4) on
  outcome, update NIMBUS-149's BC integration-state metadata object (BC order id, status
  `sent`/`failed`, timestamp, incremented retry count), and for partial resolution, record
  order-level and line-level failure detail in metadata (which line, why); (5) guard the reusable
  step against creating a duplicate BC order if invoked twice for the same Medusa order (exact
  mechanism open); (6) the trigger mechanism from NIMBUS-149 into this step is explicitly left open
  for the planner — do not assume the NIMBUS-144→147 convention applies here. Do NOT implement any
  admin UI, retry-trigger endpoint, or manual-retry flow — those belong to NIMBUS-158 (not yet
  scoped), which will later invoke this story's reusable submission step. Several implementation
  decisions are deliberately left open for the planner (see Open Questions in SCOPE.md): the exact
  BC sales-order-creation endpoint/payload shape, the exact BC item `$filter` for EAN lookup, the
  149→148 trigger mechanism, exact metadata field names for failure records, and the exact
  duplicate-submission guard. If SCOPE.md needs adjustment during planning, update it in place
  rather than creating a new scope document.

- **Date:** 2026-09-02
- **Updated by:** implementation-planner agent
- **Outcome:** Implementation plan is ready; implementation is the next stage. Produced
  `issues/NIMBUS-148/PLAN.md`, `manifest.md`, and five task files
  (`01-bc-integration-state-contract-implementation.md` through
  `05-bc-submission-trigger-implementation.md`). Base branch confirmed as `develop` (already in
  SCOPE.md). Backend test infrastructure already exists — no scaffolding gate was needed; 43 test
  cases are specified across `pnpm test:unit`, `pnpm test:integration:modules`, and
  `pnpm test:integration:http`. SCOPE.md was not modified — nothing in planning contradicted it.

  **Both Business Central open questions were resolved against the real OData `$metadata`**
  (`issues/NIMBUS-129/bc metadata/std odata metadata.xml`), not guessed: the Item field holding
  the EAN/GTIN is **`gtin`** (`Edm.String`, `MaxLength="14"`), so the lookup filter is
  `items()?$filter=gtin eq '<escaped>'&$top=2`; and sales-order creation is **plain OData resource
  POSTs against the standard API v2.0**, not a bound action and not a custom API — BC does not
  support deep-inserting `salesOrderLines` in the `salesOrders` POST body, so creation is
  `POST /salesOrders` followed by one `POST /salesOrders(<guid>)/salesOrderLines` per line (which
  is also what makes the required partial-line submission natural to implement). `lineType` for an
  item line is the string `"Item"`. The custom `metadata masterdata.xml` surface was checked and is
  irrelevant here (no sales-order or item entities, zero `<Action>`/`<Function>` declarations).

  **The remaining resolved planner decisions:** trigger = a subscriber on
  `order_ingestion.ready_for_business_central` (the boundary event NIMBUS-129's approved Task 04
  already emits *specifically for this story*; the NIMBUS-144→147 non-awaited-workflow convention
  SCOPE.md warned against was itself superseded by NIMBUS-129's event-driven redesign, so it
  correctly does not apply). Duplicate guard = short-circuit on `bc_order_id` being set **or**
  `status === "sent"` (the BC order id is the natural idempotency token; needs no new field, table,
  or migration). Retry counter = `attempt_count`, incremented only by invocations that actually
  attempt a submission — a duplicate-guarded short-circuit changes nothing at all. Metadata keys =
  `business_central_integration` (new), plus `canonical_order` and `company_id` reused verbatim
  from NIMBUS-129's approved Task 03 so NIMBUS-149 has nothing to change there.

  **⚠️ The plan's single biggest risk, recorded prominently in PLAN.md rather than papered over:**
  this story is specified as consuming *NIMBUS-149's* metadata contract, and **NIMBUS-149 is
  scoped but neither planned nor implemented**, with its exact key names and field types explicitly
  deferred to its own future planner. **NIMBUS-129 is planned and approved but also not
  implemented** (verified: `apps/backend/src/modules/` holds only `approval`, `business-central`,
  `company`, `quote`; `src/subscribers/` holds only `README.md`; no `/orderapi` route or
  `order-ingestion` module exists). The plan handles this two ways instead of inventing a contract
  and calling it settled: (1) it **defines** the contract in one importable file,
  `apps/backend/src/modules/order-ingestion/bc-integration-state.ts`, which **NIMBUS-149 must
  import (`createInitialBcIntegrationState`, `BC_INTEGRATION_STATE_METADATA_KEY`) and NIMBUS-158
  must read through (`parseBcIntegrationState`)** — if NIMBUS-149's planner invents its own shape
  instead, every order records `failed` with `canonical_payload_unavailable` and no BC order is
  ever created; and (2) it designs **defensively** — the metadata is runtime-validated with a
  narrow, non-strict zod schema rather than trusting an imported type, so **tasks 01–04 build and
  test with zero dependency on NIMBUS-129 or NIMBUS-149**, and only Task 05 (the trigger
  subscriber) is hard-blocked on NIMBUS-129's Task 04 landing. Task 05 is marked **BLOCKED** in the
  manifest with a documented (and explicitly worse) fallback that needs the user's decision before
  being taken.

  **Other flagged items, deliberately not silently resolved:** `unitPrice` is sent to BC (the EDI
  order states an agreed price) but whether BC should instead price from the customer's own price
  list is an **open business question** — a one-line change either way. BC's Item Reference table
  is not exposed by this API, so the required `custItemNo` fallback can only match `item.number`,
  the same field as `itemNumber` (a no-op in the real samples, where the two are equal); genuine
  customer-item-number resolution would need a BC-side custom API page. `submitBcOrderStep` has no
  compensation on purpose (a created BC order is another system's business data), with the known
  limitation that a failure in the recording step after a successful BC write strands the state at
  `pending` — mitigated by logging the BC order id the instant it is known. BC line rejections
  arriving *after* the header exists are collected rather than thrown, so an outcome can be
  `failed` while carrying a real `bc_order_id` (`all_lines_rejected_by_bc`) — **NIMBUS-158's retry
  story must decide how to handle that case.** No field-length truncation and no blocked-item
  rejection were added (both would be speculative). Two observations for *other* plans are also
  recorded: NIMBUS-129 Task 02's planned `canonical-order-fixtures.ts` sits in a directory matched
  by the `integration:modules` testMatch and will be collected as an empty test suite and fail; and
  the repo's existing `BCOrderStatus` union does not match BC's real three-member
  `salesOrderEntityBufferStatus` enum. Neither was changed — they are other stories' files.

  No admin UI, no retry endpoint, and no manual-retry flow were planned (all NIMBUS-158). Plan is
  awaiting user approval before dispatch.
- **Handover to:** user, for plan approval, then the implementor agent for execution.
- **Handover prompt:** Implement NIMBUS-148's Business Central order-submission plan from
  `issues/NIMBUS-148/manifest.md`, executing tasks in dependency order: 01 (BC integration-state
  metadata contract + defensive canonical-payload reader in
  `apps/backend/src/modules/order-ingestion/`), 02 (the `findItemsForOrderLines` batch item lookup
  on the `business-central` module — `gtin` first, then `number` for `itemNumber` and
  `custItemNo`), 03 (the real, non-stub `createSalesOrder` on the same module — header POST plus
  one line POST per line), then 04 (the reusable `prepare-bc-order` / `submit-bc-order` /
  `record-bc-order-outcome` steps and the `sendOrderToBusinessCentralWorkflow` that chains them).
  **Stop after Task 04 and report back**: Task 05 (the
  `order_ingestion.ready_for_business_central` subscriber) is **BLOCKED** on NIMBUS-129's Task 04
  being implemented and merged, which it is not — do not take Task 05's documented fallback path
  without the user's explicit decision. Tasks 02 and 03 both modify
  `apps/backend/src/modules/business-central/types.ts` and `service.ts`, so run them in sequence,
  never in parallel. Each task file carries verbatim code skeletons and full test skeletons —
  follow them exactly rather than inventing alternative type shapes or import paths; the only
  freedom is the handful of clearly-marked `// IMPLEMENT:` blocks inside the test files. Use double
  quotes and 2-space indent (matching `src/modules/business-central/**` and
  `src/workflows/business-central-return/**`), and import zod from `@medusajs/framework/zod`, never
  the bare `zod` package. Do **not** modify `createReturnFromSalesOrder` or `listReturnReasons`
  (NIMBUS-138 stubs), `src/workflows/business-central-return/**`,
  `src/workflows/hooks/order-created.ts`, `medusa-config.ts`, or anything under
  `apps/storefront/`. Do **not** build any admin UI, retry endpoint, or manual-retry flow — those
  are NIMBUS-158. Respect the flagged, deliberately-unresolved items in `issues/NIMBUS-148/PLAN.md`
  rather than quietly deciding them: whether `unitPrice` should be sent to BC at all, BC field-length
  truncation, blocked-item handling, and the residual uncertainty in Task 04's test suite about
  whether `jest.spyOn` on the container-resolved BC service instance is observed inside a workflow
  step (Task 04 documents the `global.fetch`-mocking fallback — never change production code to
  accommodate the test). After implementation, update this PROGRESS.md with the outcome and hand
  over per this repo's Definition of Done / code-review / commit-message conventions.

## Note on how this scope was produced

The scoper agent was launched as a background sub-agent to interview the user for this story (as
it had for NIMBUS-149 immediately prior). After its first round of questions was answered by the
user in the main session and relayed to it, the agent correctly refused to proceed: its own
instructions treat a coordinator relaying claimed user answers — rather than the user answering it
directly — as unverifiable, and it will not write scope on that basis. It also confirmed it has no
`AskUserQuestion`-equivalent tool available to it as a spawned sub-agent, so it could not open a
direct channel to the user itself, and stood by its refusal even when asked to seed such a tool's
options from the relayed answers.

This is a structural limitation of the sub-agent architecture (only the main session has a live
channel to the user), not a flaw in the user's actual answers, which were given directly to the
main session in this same conversation. Rather than attempt to route around the agent's safeguard,
the main session took over scoping directly: it reused all research the sub-agent had already
gathered (the existing `business-central` module, the `createReturnFromSalesOrder` stub pattern,
the `prepare-*`/`submit-*` workflow-step convention, the lack of any event bus or cron
infrastructure, and the real EDI line-shape sample), combined it with the user's direct answers to
the 9 open questions, and wrote `issues/NIMBUS-148/SCOPE.md` following the same structure and
level of detail as NIMBUS-144/147/149's scope documents. The user reviewed and approved the
resulting scope's summary before this file was written.
