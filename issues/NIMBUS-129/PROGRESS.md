# Receive Orders Through JSON and XML

- **Date:** 2026-08-21
- **Type:** Epic
- **Tracker:** JIRA - https://alphasolutionsdk.atlassian.net/browse/NIMBUS-129
- **Priority:** Medium
- **Project Folder:** issues/NIMBUS-129/
- **Updated by:** scoper agent
- **Outcome:** Scope approved; Jira epic and stories NIMBUS-144 through NIMBUS-149 were aligned, and NIMBUS-158 was created for the Medusa Admin status-and-retry widget. Implementation planning is the next stage.
- **Handover to:** implementation-planner agent
- **Handover prompt:** Plan NIMBUS-129 from the approved scope in issues/NIMBUS-129/SCOPE.md. Update the existing scope only if planning uncovers a required clarification, produce the implementation plan and task manifest for the Medusa backend/admin and Azure APIM/Logic App work, and preserve the approved story boundaries for NIMBUS-144 through NIMBUS-149 and NIMBUS-158.

- **Date:** 2026-08-21
- **Updated by:** scoper agent
- **Outcome:** Scope clarification approved: NIMBUS-147 defines an XML representation compatible with Azure API Management's `xml-to-json` policy, and NIMBUS-145 uses that policy for the actual XML-to-canonical-JSON transformation (https://learn.microsoft.com/en-us/azure/api-management/xml-to-json-policy).
- **Handover to:** implementation-planner agent
- **Handover prompt:** Plan NIMBUS-129 from the approved scope in issues/NIMBUS-129/SCOPE.md, treating the Azure API Management `xml-to-json` policy as the required XML transformation facility for NIMBUS-145 and ensuring the NIMBUS-147 contract is compatible with it.

- **Date:** 2026-09-02
- **Updated by:** orchestrating assistant (epic-wide consistency check after NIMBUS-144/147 rework)
- **Outcome:** Reviewing real EDI sample files against the approved NIMBUS-144/147 designs
  surfaced that Medusa has no product catalog behind these order items, so NIMBUS-149's Medusa
  order is now header-only (no `OrderLineItem` records) — canonical line data passes through
  for NIMBUS-148's Business Central order-line creation instead. This epic's Proposed Structure
  (item 6) was corrected to match. NIMBUS-149's Jira description ("Medusa order with its order
  lines") was also corrected. Notes for NIMBUS-148 (owns EAN→item lookup and BC line building,
  not just "send the order"), NIMBUS-158 (its widget needs to surface the retained canonical
  line data since the Medusa order page will show no native line items), and NIMBUS-146 (minor
  ownership wording — matching is NIMBUS-147's job, not "when the order is created") were added
  as Jira comments for persistence, pending those stories' own scoping.
  **Resolved 2026-09-02:** the epic and NIMBUS-148 both described returning the Business
  Central order identifier synchronously to the caller ("Return the Business Central identifier
  on success"), but the approved NIMBUS-144 design returns 201 + a Medusa order reference
  immediately, with BC delivery happening asynchronously afterward. User confirmed: keep the
  async design as-is — the calling system never receives the Business Central order identifier,
  at any point, by any mechanism. It is retained internally and surfaced only to internal
  operations via NIMBUS-158's admin widget. No callback/webhook/polling mechanism to the
  external system is needed. Epic SCOPE.md, the epic's Jira description, and NIMBUS-148's Jira
  description were corrected to match.
- **Handover to:** implementation-planner agent, once the user is ready to plan NIMBUS-144
  and/or NIMBUS-147 (146/148/149/158 remain unscoped locally, with corrective Jira comments/
  description fixes in place for when they are scoped).

- **Date:** 2026-09-02
- **Updated by:** implementation-planner agent
- **Outcome:** Planned NIMBUS-144 and NIMBUS-147 together (explicitly excluding NIMBUS-145,
  146, 148, 149, 158, which remain unscoped). Produced a combined implementation plan covering:
  a new `orderIngestion` Medusa module (`IncomingOrder` data model as the async-processing state
  machine), the canonical order contract as two zod schemas (loose envelope for NIMBUS-144,
  strict canonical for NIMBUS-147), a `receiveOrderWorkflow` (NIMBUS-144's fast/shallow
  idempotency check), a `processIncomingOrderWorkflow` (NIMBUS-147's deep validation/company
  matching/duplicate check), and the `POST /orderapi/orders` route wiring them together with a
  custom API-key middleware. The async hand-off from 144 to 147 is a plain non-awaited workflow
  invocation from route-handler code (no event bus/subscriber — none exists in this repo).
  Several previously-open questions were resolved and flagged explicitly rather than guessed
  silently: the endpoint path, the auth mechanism, the idempotency scoping, and — most
  importantly — that the 201 response's "Medusa order reference" is necessarily this project's
  own `IncomingOrder.id` (not a Medusa core Order id), since NIMBUS-149 doesn't exist yet; this
  needs reconciliation whenever NIMBUS-149 is scoped. Full detail in
  `issues/NIMBUS-129/PLAN.md`, task files `01`–`05`, and `manifest.md`. Base branch confirmed as
  `develop` (already recorded in both stories' SCOPE.md). Backend test infrastructure already
  exists — no scaffolding gate was needed. Plan is awaiting user approval before dispatch.
- **Handover to:** user, for plan approval, then implementor agent for execution.
- **Handover prompt:** Review `issues/NIMBUS-129/PLAN.md` and the five task files
  (`01-order-ingestion-module-implementation.md` through
  `05-order-api-route-implementation.md`) plus `manifest.md`. Once approved, invoke the
  implementor agent with: "Implement NIMBUS-129's order-ingestion plan (NIMBUS-144 +
  NIMBUS-147) from issues/NIMBUS-129/manifest.md, in task order 01 through 05." NIMBUS-145,
  146, 148, 149, and 158 remain out of scope for this dispatch and should not be touched.

- **Date:** 2026-09-02
- **Updated by:** implementation-planner agent
- **Outcome:** Reversed Task 05's auth mechanism after user review, before final approval. The
  bespoke `x-orderapi-key` header + `ORDER_INGESTION_API_KEY` env-var middleware is replaced
  with Medusa's built-in secret API key (`authenticate("user", ["api-key"])`, HTTP Basic auth,
  managed via `/admin/api-keys`). The original recommendation was based on that strategy
  hard-coding to `actor_type: "user"` (full admin scope, verified against
  `@medusajs/framework`'s `authenticate-middleware.js`); the user's accepted counter-argument is
  that this key is used exclusively by the Logic App (NIMBUS-146) — an internal Azure credential
  never distributed to external customer systems — so the "leaked to an untrusted third party"
  concern doesn't apply, making Medusa's native, already-built secret key preferable to a second
  bespoke mechanism. Updated `issues/NIMBUS-129/05-order-api-route-implementation.md` (full
  auth section, middleware/route skeletons, all HTTP test cases), `PLAN.md` (Decision #1
  rewritten to preserve both sides of the reasoning, not just the final answer), and
  `manifest.md` (env/config changes section). No other task or design element was changed. Full
  detail, including verified mechanics of Medusa's secret-API-key middleware (HTTP Basic auth
  requirement, why `/orderapi` outside `/admin` has no CORS implications), is in Task 05's doc.
- **Handover to:** user, for a final approval pass on this revision, then implementor agent.
- **Handover prompt:** Same as the previous entry — re-read `issues/NIMBUS-129/PLAN.md` and
  `05-order-api-route-implementation.md` for the revised auth design before approving dispatch.

- **Date:** 2026-09-02
- **Updated by:** implementation-planner agent
- **Outcome:** Major architectural redesign, requested by the user after reviewing the plan a
  second time — bigger than the auth change, and holds dispatch pending re-approval. Canonical
  validation, company matching, the per-company duplicate check, and real Medusa order creation
  (header-only, no `OrderLineItem` records) now all happen **synchronously** inside the request,
  replacing the earlier fully-async design. The response now returns the real Medusa order id (or
  a structured `404`/`422`/`400` error with nothing created) instead of the earlier design's
  explicitly-flagged placeholder `IncomingOrder.id` stopgap — that flagged issue is now fully
  resolved rather than needing future reconciliation. Post-creation processing (enrichment, and
  the future NIMBUS-148 hand-off) is now driven by genuine Medusa domain events
  (`emitEventStep` + a `src/subscribers/*.ts` file, verified against this repo's actual installed
  Medusa v2.18.0 packages) rather than a single fire-and-forget workflow call — this is a
  deliberate, explicit user directive, not something this plan second-guessed despite an earlier
  pass correctly finding zero event/subscriber precedent in this repo. This redesign pulls a
  synchronous, header-only slice of NIMBUS-149 ("Create and persist the Medusa order") into this
  plan — explicitly flagged: NIMBUS-149 as a story still has unaddressed requirements
  (traceability, NIMBUS-158's integration-state fields) that its future scoping needs to
  reconcile with what actually got built here. Task 01 shrank (the old `IncomingOrder`
  audit/state table collapsed to a minimal `OrderExternalReference` dedupe-index model, since
  rejected submissions are no longer persisted at all). Task 02 shrank (the old two-schema
  envelope/canonical split collapsed to one schema, since there's no longer a fast/deferred-deep
  split to serve). Tasks 03 and 04 are new content, not edits, of the previous 03/04 (old files
  deleted, new files with different names and content created) — see
  `issues/NIMBUS-129/manifest.md`'s "Task file renames" note. Full reasoning recorded in
  `issues/NIMBUS-129/PLAN.md`'s "Decisions & Trade-offs" (the redesign section), preserving both
  what changed and why, same treatment as the earlier auth reversal.
- **Handover to:** user, for a fresh approval pass on this redesign (not assumed approved), then
  implementor agent.
- **Handover prompt:** Re-read `issues/NIMBUS-129/PLAN.md` and all five task files
  (`01`–`05`) in full — this is a genuine architectural change, not an incremental diff from the
  previously-presented plan. Once approved, invoke the implementor agent with: "Implement
  NIMBUS-129's order-ingestion plan (NIMBUS-144 + NIMBUS-147) from
  issues/NIMBUS-129/manifest.md, in task order 01 through 05." NIMBUS-145, 146, 148, 149, and 158
  remain out of scope for this dispatch and should not be touched.

- **Date:** 2026-09-02
- **Updated by:** implementation-planner agent
- **Outcome:** Redesigned plan approved by the user (synchronous canonical validation + company
  matching + duplicate check + header-only order creation in Task 03; async event-driven
  post-processing chain in Task 04 via `emitEventStep` + a `src/subscribers/*.ts` file; the
  NIMBUS-149 scope-crossing explicitly recorded in `issues/NIMBUS-129/PLAN.md`'s "Decisions &
  Trade-offs"). Implementation planning for NIMBUS-144 + NIMBUS-147 is complete:
  `issues/NIMBUS-129/PLAN.md`, `manifest.md`, and task files `01-order-ingestion-module-implementation.md`
  through `05-order-api-route-implementation.md` are the approved, current state — do not treat
  any earlier PROGRESS.md entry's design description as current; only this plan's latest files
  reflect what should be built. **Implementor dispatch is intentionally held — pending, on user
  request** — not triggered automatically as part of this approval.
- **Handover to:** implementor agent, on request (not yet triggered).
- **Handover prompt:** Implement NIMBUS-129's order-ingestion plan (NIMBUS-144 + NIMBUS-147) from
  `issues/NIMBUS-129/manifest.md`, executing tasks in dependency order: 01 (Order Ingestion
  Module — canonical contract + `OrderExternalReference` dedupe-index model), 02 (Canonical Order
  Contract — single `CanonicalOrderSchema`), 03 (Synchronous Validate + Create Order Workflow —
  company matching, per-company duplicate check, header-only Medusa order creation via
  `Modules.ORDER` directly, replicating the existing order-created hook's link-creation logic),
  04 (Post-Creation Async Event Chain — `emitEventStep`-based event emission, the
  `order-ingestion-created` subscriber, `enrichOrderWorkflow`, and the
  `order_ingestion.ready_for_business_central` boundary event left without a subscriber for a
  future NIMBUS-148), then 05 (the `POST /orderapi/orders` route itself — Medusa secret-API-key
  auth, synchronous response with the real order id or a `404`/`422`/`400` error). Each task file
  contains verbatim code skeletons and full test skeletons — follow them exactly rather than
  inventing alternative type shapes or import paths. Flagged, not-fully-specified items to
  respect rather than silently resolve during implementation: Task 04's enrichment step content
  (`// IMPLEMENT:` block in `enrich-order.ts`) and the residual uncertainty around whether a
  thrown `MedusaError` survives Task 03's workflow engine unwrapped (verify via the tests, adjust
  only if a test actually fails). NIMBUS-145, 146, 148, 149, and 158 remain out of scope — do not
  touch them or attempt to build their internals. After implementation, update this PROGRESS.md
  with the outcome and hand over per this repo's normal Definition of Done / code-review /
  commit-message conventions.
