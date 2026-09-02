# Accept JSON and XML orders through APIM

- **Date:** 2026-09-02
- **Type:** Story
- **Tracker:** JIRA — https://alphasolutionsdk.atlassian.net/browse/NIMBUS-145
- **Priority:** Medium
- **Project Folder:** issues/NIMBUS-145/
- **Updated by:** main session (scoping done directly, not via the scoper sub-agent — see
  issues/NIMBUS-148/PROGRESS.md for why)
- **Outcome:** Scope approved. As with NIMBUS-144/147/148/149, implementation planning is the next
  stage but has not been requested yet — normal backlog pace.
- **Handover to:** implementation-planner agent (on request — not yet triggered)
- **Handover prompt:** Read `issues/NIMBUS-145/SCOPE.md` and plan the Azure APIM policy
  configuration for accepting JSON and XML order submissions. Scope is: (1) define/reference the
  JSON Schema and XSD for the canonical contract (from NIMBUS-147) that incoming payloads validate
  against; (2) author the APIM inbound policy — content-type branching, `validate-content` for both
  branches, the `xml-to-json` policy for XML normalization, HTTPS enforcement, and forwarding to
  NIMBUS-146 with the path token preserved unchanged; (3) author a safe `on-error` policy; (4)
  document all of this as reference artifacts in `issues/NIMBUS-145/` for manual application in the
  Azure Portal — no code changes to `apps/backend` or `apps/storefront`, and no new IaC tooling.
  Two decisions are fixed by this scope and must not be re-litigated without going back to the
  user: (a) both JSON and XML submissions arrive already shaped to mirror the canonical contract
  1:1 — this is NOT a remap of the raw N-EDI envelope seen in `issues/NIMBUS-129/example edi
  files/`; (b) path-token log redaction is explicitly OUT of scope — a deliberate risk-acceptance
  decision, not an oversight. Open questions left to the planner: exact APIM resource/API
  definition and versioning, exact JSON Schema/XSD artifact format for APIM's `validate-content`,
  and content-type-branching behavior for missing/unsupported `Content-Type` headers. If SCOPE.md
  needs adjustment during planning, update it in place rather than creating a new scope document.

---

## 2026-09-02 — Implementation Planning Complete

- **Updated by:** implementation-planner agent
- **Outcome:** Implementation plan produced. PLAN.md, manifest.md, and three task files created.
  Plan is ready for dispatch but conditional on NIMBUS-147's finalized XML representation and
  NIMBUS-146's Logic App deployment (backend URL is a placeholder).
- **Key decisions:**
  - Two separate schemas (JSON Schema draft 7 + XSD) derived from NIMBUS-147's canonical contract.
  - Content-type branching via `choose` on `Content-Type` header (JSON / XML / unsupported → 415).
  - `validate-content` with `action="prevent"` for both branches (rejects invalid payloads with 400).
  - `xml-to-json` with `kind="javascript-friendly"`, `always-array-child-elements="true"` for XML
    normalization (ensures single `<line>` becomes a JSON array).
  - `on-error` policy returns safe, structured 400 error (no raw payload, no internal details).
  - HTTPS enforcement via APIM's built-in HTTPS-only endpoints (no explicit policy needed).
  - Forwarding via `set-backend-service` to NIMBUS-146's Logic App (placeholder URL).
  - No code changes to `apps/backend` or `apps/storefront` — reference artifacts only.
  - Manual test payloads (no automated APIM test infrastructure in this repo).
- **Handover to:** implementor agent (once NIMBUS-147's XML representation is finalized and
  NIMBUS-146's Logic App trigger URL is available)
- **Handover prompt:** Implement NIMBUS-145 from the approved plan in issues/NIMBUS-145/. Start
  with Task 01 (schemas), then Task 02 (APIM policy), then Task 03 (test payloads). Before
  starting, complete the reconciliation checklist in manifest.md against NIMBUS-147's finalized
  XML representation and NIMBUS-146's deployed Logic App trigger URL.
