# Receive normalized order JSON in Medusa

- **Date:** 2026-09-01
- **Type:** Story
- **Tracker:** JIRA — https://alphasolutionsdk.atlassian.net/browse/NIMBUS-144
- **Priority:** Medium
- **Project Folder:** issues/NIMBUS-144/
- **Updated by:** scoper agent
- **Outcome:** Scope approved; implementation planning is the next stage. User has asked to
  hold off running the implementation-planner for now — it will be triggered later by the
  user, not automatically.
- **Handover to:** implementation-planner agent (on request — not yet triggered)
- **Handover prompt:** Read `issues/NIMBUS-144/SCOPE.md` and plan the implementation for the
  Medusa-side order-ingestion receiving endpoint. Scope is deliberately narrow: the API route
  itself (proposed `POST /orderapi/orders`, exact path TBD), its own scoped-API-key
  authentication (independent of the Logic App's token check), structural/envelope payload
  validation, a fast/shallow idempotency check on the external order ID, an async hand-off to
  downstream processing, and the success/error response contracts (201 + order reference on
  acceptance; async processing happens after the response). Do NOT implement canonical
  contract validation, customer/company matching, or actual order creation/persistence — those
  are owned by sibling stories NIMBUS-147 and NIMBUS-149 respectively (see Dependencies and
  Open Questions in SCOPE.md for the full boundary rationale, including the confirmed
  144-vs-147 duplicate-detection split). Several implementation decisions are still open
  (endpoint path/namespace, which BC field is the true dedupe key, the async trigger
  mechanism, scoped API key provisioning, totals pass-through vs. recalculation) — resolve or
  flag these explicitly in the plan rather than guessing. If SCOPE.md needs adjustment during
  planning, update it in place rather than creating a new scope document.

- **Date:** 2026-09-02
- **Updated by:** scoper agent
- **Outcome:** Reopened scope to add a request-shape correction, discovered while comparing
  the canonical order contract against real EDI sample files: resolved customer identity does
  not travel in the JSON/XML order body. NIMBUS-146 (Logic App) resolves it upstream and passes
  it to this endpoint as a query string parameter instead (e.g.
  `POST /orderapi/orders?customerNumber=...`; exact parameter name TBD). Updated
  `issues/NIMBUS-144/SCOPE.md` (request shape, structural validation scope, field mapping,
  proposed structure, open questions, and dependencies) and posted a Jira comment on NIMBUS-144
  recording the correction. This change was explicitly confirmed by the user; no new approval
  gate was required.
- **Handover to:** implementation-planner agent (on request — still not yet triggered)
- **Handover prompt:** Same as above, updated for the query-parameter correction: read
  `issues/NIMBUS-144/SCOPE.md` and plan the implementation of the Medusa-side order-ingestion
  receiving endpoint, including reading and validating the customer-identity query parameter
  (present + well-formed, rejected as a 4xx boundary failure if not) alongside the JSON/XML
  body, and ensuring that resolved value is carried through the async hand-off to NIMBUS-147.
  Do not implement canonical contract validation, customer/company matching, or order
  creation/persistence (NIMBUS-147/NIMBUS-149 respectively). Resolve or explicitly flag the
  remaining open questions listed in SCOPE.md rather than guessing.

- **Date:** 2026-09-02
- **Updated by:** implementation-planner agent
- **Outcome:** Planned together with NIMBUS-147 (see `issues/NIMBUS-129/PLAN.md` and task files
  `issues/NIMBUS-129/01-*.md` through `05-*.md`) since they form one coupled receive→process
  pipeline. Resolved open questions: endpoint path is `POST /orderapi/orders` (new `/orderapi`
  namespace); auth is a custom `x-orderapi-key` header middleware, not Medusa's built-in
  admin-scoped secret API key; the fast idempotency check is scoped to
  `(external_order_number, customer_number)`; the async hand-off to NIMBUS-147 is a plain
  non-awaited workflow call, not an event/subscriber. Flagged (not silently resolved): the 201
  response's `order_reference` is this plan's new `IncomingOrder.id`, not a Medusa core Order id,
  since NIMBUS-149 doesn't exist yet — needs reconciliation when NIMBUS-149 is scoped.
- **Handover to:** user for plan approval (see `issues/NIMBUS-129/PLAN.md`), then implementor
  agent.
- **Handover prompt:** See `issues/NIMBUS-129/PROGRESS.md`'s 2026-09-02 entry — this story is
  implemented as part of that combined NIMBUS-129 dispatch, not standalone.

- **Date:** 2026-09-02
- **Updated by:** implementation-planner agent
- **Outcome:** Correction to the entry above: the auth mechanism is no longer the custom
  `x-orderapi-key` header middleware. After user review, it was reversed to Medusa's built-in
  secret API key (`authenticate("user", ["api-key"])`, HTTP Basic auth via `/admin/api-keys`) —
  this key is used exclusively by the Logic App (NIMBUS-146), an internal Azure-held credential
  never distributed to external customer systems, so the admin-scope blast-radius concern that
  motivated the original recommendation doesn't apply. See `issues/NIMBUS-129/PROGRESS.md`'s
  matching 2026-09-02 entry and `PLAN.md`'s Decision #1 for the full reasoning on both sides.
- **Handover to:** user for a final approval pass, then implementor agent.
- **Handover prompt:** See `issues/NIMBUS-129/PROGRESS.md`'s latest entry.

- **Date:** 2026-09-02
- **Updated by:** implementation-planner agent
- **Outcome:** Larger correction to the entries above: this story's async design is superseded.
  NIMBUS-144's endpoint now synchronously runs company matching, the duplicate check, and real
  Medusa order creation (a header-only slice of NIMBUS-149) within the request, returning the
  real Medusa order id on success or a structured `404`/`422`/`400` error with nothing created on
  failure — not a 201-plus-async-hand-off acknowledgment. The response contract's previously
  flagged "placeholder reference, not a real Medusa order id" issue is now fully resolved. What
  remains asynchronous (enrichment, the future NIMBUS-148 hand-off) is driven by genuine Medusa
  domain events, not a fire-and-forget workflow call. See `issues/NIMBUS-129/PLAN.md`'s
  redesign section for the full reasoning and the explicit NIMBUS-149 scope-crossing note.
- **Handover to:** user for a final approval pass, then implementor agent.
- **Handover prompt:** See `issues/NIMBUS-129/PROGRESS.md`'s latest entry.

- **Date:** 2026-09-02
- **Updated by:** implementation-planner agent
- **Outcome:** User approved the redesigned plan (synchronous validation + order creation, async
  event chain, NIMBUS-149 scope-crossing recorded in `issues/NIMBUS-129/PLAN.md`).
  Implementation planning for this story is complete. **Implementor dispatch is intentionally
  held — pending, on user request** — not triggered automatically.
- **Handover to:** implementor agent, on request (not yet triggered).
- **Handover prompt:** See `issues/NIMBUS-129/PROGRESS.md`'s latest entry for the full dispatch
  prompt — this story is implemented as part of that combined NIMBUS-129 dispatch, not
  standalone.
