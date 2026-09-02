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
