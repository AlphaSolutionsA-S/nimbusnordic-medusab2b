# Validate customer token and route order

- **Date:** 2026-09-02
- **Type:** Story
- **Tracker:** JIRA — https://alphasolutionsdk.atlassian.net/browse/NIMBUS-146
- **Priority:** Medium
- **Project Folder:** issues/NIMBUS-146/
- **Updated by:** main session (scoping done directly, not via the scoper sub-agent — see
  issues/NIMBUS-148/PROGRESS.md for why)
- **Outcome:** Scope approved. Jira description corrected in place: removed the stale "matching is
  handled when the Medusa order is created" line (matching is NIMBUS-147's job, running before
  order creation) and the "token redaction from logs and telemetry" scope line (deliberately
  dropped, consistent with NIMBUS-145). As with the other scoped siblings, implementation planning
  is the next stage but has not been requested yet — normal backlog pace.
- **Handover to:** implementation-planner agent (on request — not yet triggered)
- **Handover prompt:** Read `issues/NIMBUS-146/SCOPE.md` and plan the Azure Logic App
  implementation for customer token validation and order routing. Scope is: (1) extend the
  existing GlobalLists-style token-list store (see the example Logic App shared via Jira comment
  on this issue) so each valid entry also resolves to a customer number, not just a valid/invalid
  token; (2) implement the token-validation branch (fetch list, match token, extract customer
  number) following that example's `Get_APIkeys`/`Parse_JSON`/match pattern; (3) on a valid token,
  forward the order to NIMBUS-144's `POST /orderapi/orders` endpoint with the customer number as a
  query parameter and the canonical JSON body unchanged, authenticated via Medusa's secret API key
  over HTTP Basic auth (the mechanism NIMBUS-129's planning already settled on for that endpoint —
  see `issues/NIMBUS-129/05-order-api-route-implementation.md`); (4) on an invalid token, return a
  generic 401 that never echoes the token back; (5) enforce HTTPS. Two decisions are fixed by this
  scope and should not be re-litigated without going back to the user: (a) the token store reuses
  the existing GlobalLists-style pattern rather than a new mechanism; (b) path-token log redaction
  is explicitly OUT of scope, consistent with NIMBUS-145. Do NOT implement customer/company
  matching against the `Company` model — that is NIMBUS-147's job; this story only resolves and
  forwards a bare customer number. Open questions left to the planner: exact token-list extension
  format, exact secret-storage mechanism for the Logic App's own Medusa credential, and which real
  GlobalLists API/list this project uses (the example references an unrelated product-feed list).
  If SCOPE.md needs adjustment during planning, update it in place rather than creating a new scope
  document.
