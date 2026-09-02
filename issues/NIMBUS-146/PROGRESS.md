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

- **Date:** 2026-09-02
- **Updated by:** implementation-planner agent
- **Outcome:** Implementation plan complete. This is a pure Azure configuration/documentation
  deliverable (no `apps/backend`/`apps/storefront` code changes), so the plan produces reference
  artifacts under `issues/NIMBUS-146/artifacts/` rather than application code: a token-list
  extension design (`token-list-schema.md`, Task 01 — customer number delimiter-encoded into the
  GlobalLists-style `Value` field as `"<token>::<customerNumber>"`, with a documented fallback if
  the real API supports custom properties), a full Logic App Workflow Definition JSON plus
  deployment instructions (Task 02 — HTTP trigger with path-token extraction, list fetch/match,
  authenticated forward to NIMBUS-144's `POST /orderapi/orders` using Medusa's secret API key over
  HTTP Basic auth exactly as fixed by `issues/NIMBUS-129/05-order-api-route-implementation.md`,
  full pass-through of Medusa's 2xx/4xx responses, generic token-free 401 on no match, HTTPS
  enforced via the trigger's built-in HTTPS-only callback URL), and documented manual test payloads
  (Task 03, since no automated Azure Logic App test infrastructure exists in this repo — same
  precedent as NIMBUS-145). All three SCOPE.md open questions were resolved with an explicit
  design decision and a flagged pre-deployment verification checklist rather than guessed
  silently: the token-list extension format, the secret-storage mechanism (Key Vault reference
  recommended, plain secure parameter as an accepted fallback), and the real GlobalLists list
  identity (left as an explicit `<TBD>` placeholder for the Azure environment owner). Flagged
  dependency: NIMBUS-129's Task 05 (the Medusa endpoint this Logic App calls) is approved but not
  yet implemented/deployed, which blocks full end-to-end execution of three of Task 03's five
  documented test cases until it is. Full detail in `issues/NIMBUS-146/PLAN.md`, task files `01`-
  `03`, and `manifest.md`. Plan is awaiting user approval before dispatch.
- **Handover to:** user, for plan approval, then implementor agent for execution.
- **Handover prompt:** Review `issues/NIMBUS-146/PLAN.md` and the three task files
  (`01-token-list-store-extension-implementation.md`,
  `02-logic-app-workflow-implementation.md`, `03-test-documentation-implementation.md`) plus
  `manifest.md`. Once approved, invoke the implementor agent with: "Implement NIMBUS-146's Logic
  App plan from issues/NIMBUS-146/manifest.md, in task order 01 through 03. This produces
  reference artifacts under issues/NIMBUS-146/artifacts/ only — no apps/backend or
  apps/storefront code changes." After the artifacts are written, actual Azure deployment is a
  manual step for the environment owner per Task 02's deployment-instructions.md, and Task 03's
  test payloads are executed manually post-deployment (partially blocked on NIMBUS-129's Task 05
  being deployed first — see manifest.md's "Open items carried into deployment").

- **Date:** 2026-09-02
- **Updated by:** main session
- **Outcome:** Plan revised at user request. A matched token is no longer sufficient to forward an
  order when its Business Central customer number resolves to JSON `null` or an empty string. Task
  02 now places `Condition_Customer_Number_Present` after extraction and before the Medusa HTTP
  action; the failed branch returns `401` with `{"error":"Not allowed"}` and does not call Medusa
  or expose authorization data. Task 01 documents the non-empty customer-number invariant, and
  Task 03 adds live manual coverage for both null and empty-string representations. PLAN.md and
  the detailed task verification references were updated consistently. The manifest remains
  dispatch-ready and the plan is still awaiting user approval.
- **Handover to:** user, for plan approval, then implementor agent for execution.
- **Handover prompt:** Review the revised `issues/NIMBUS-146/PLAN.md`, especially the new
  null-or-empty customer-number rejection in Task 02 and TC-3 in Task 03. Once approved, invoke
  the implementor agent with: "Implement NIMBUS-146's Logic App plan from
  issues/NIMBUS-146/manifest.md, in task order 01 through 03. This produces reference artifacts
  under issues/NIMBUS-146/artifacts/ only — no apps/backend or apps/storefront code changes."
