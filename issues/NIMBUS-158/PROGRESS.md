# Show Business Central status and retry in Medusa Admin

- **Date:** 2026-09-02
- **Type:** Story
- **Tracker:** JIRA — https://alphasolutionsdk.atlassian.net/browse/NIMBUS-158
- **Priority:** Medium
- **Project Folder:** issues/NIMBUS-158/
- **Updated by:** scoper agent
- **Outcome:** Scope approved; implementation planning is the next stage.
- **Handover to:** implementation-planner agent
- **Handover prompt:** Plan NIMBUS-158 from the approved scope in issues/NIMBUS-158/SCOPE.md. Produce an implementation plan and dependency-ready task manifest for the Medusa Admin order-detail widget and authenticated backend trigger. Reconcile the final NIMBUS-149 integration-state metadata and NIMBUS-148 reusable submission workflow contracts, preserve duplicate protection for normal submissions, and include the approved explicit force-resend path with a clear duplicate-BC-order warning.

---

## 2026-09-02 — Implementation Planning Complete

- **Updated by:** implementation-planner agent
- **Outcome:** Implementation plan produced. PLAN.md, manifest.md, and three task files created.
  Plan is ready for dispatch but conditional on NIMBUS-148 and NIMBUS-149 being implemented
  first — all task files contain explicit TODO markers for contract reconciliation.
- **Key decisions:**
  - Two custom admin API routes (GET + POST) instead of reading metadata via the built-in SDK
    order endpoint, for response sanitization and a clean mutation contract.
  - Fire-and-forget submission start (202 response) per SCOPE's async requirement.
  - Force-resend flag passed through the route to the workflow; the workflow enforces the guard.
  - Concurrency guard via metadata status check (409 on in-progress submission).
  - Widget in `order.details.side` zone — first widget in the project.
  - Force-resend confirmation via `@medusajs/ui` Dialog with duplicate-order warning.
- **Handover to:** implementor agent (once NIMBUS-148 and NIMBUS-149 are implemented)
- **Handover prompt:** Implement NIMBUS-158 from the approved plan in issues/NIMBUS-158/. Start
  with Task 01 (admin API routes), then Task 02 (widget), then Task 03 (tests). Before starting,
  complete the reconciliation checklist in manifest.md against the actual implemented code from
  NIMBUS-148 and NIMBUS-149.

## 2026-10-01 - Task 01 implementation complete; review pending

- Updated by: Task 01 tdd-worker, with root executing approved filesystem writes and checks.
- Outcome: Reconciled Admin read/submit API implemented, shared asynchronous reservation/event dispatch wired, normal duplicate guard preserved and explicit force flag added. Four new unit tests pass; HTTP/runtime evidence belongs to Task 03. Lint has 0 errors, 13 existing warnings; typecheck remains at the 22-error baseline.
- Next owner: dispatcher/code-reviewer for Task 01; then Task 02 worker.
- Handover prompt: Review Task 01 source and recorded deviations, then implement the order-detail widget against the actual `AdminBcIntegration` fields in branch-notes.md. Preserve manual refresh and explicit force confirmation. Keep Task 03 runtime coverage pending.

## 2026-10-01 - Task 01 review rework

- Outcome: Addressed the lease-expiry review blocker with serialized owner renewal during delivery and timer/drain/release cleanup. Scoped behavior tests remain 4/4 passing. Runtime proof beyond initial TTL belongs to Task 03.
- Next owner: code-reviewer for final Task 01 verdict, then Task 02 and Task 03 workers.

## 2026-10-02 - Task 02 implementation complete; review pending

- Updated by: Task 02 tdd-worker; root executed authorized writes and checks.
- Outcome: Admin order BC widget/hooks implemented with manual Refresh, explicit force confirmation/cancellation, disabled controls and sanitized feedback. Eight RTL cases passed; lint 0 errors/13 existing warnings; typecheck unchanged at 22 baseline errors.
- Next owner: dispatcher/code-reviewer, then Task 03 integration-test worker.
- Handover prompt: Review Task 02 against manual-refresh and confirmation requirements, then implement real HTTP/authentication/background-delivery/reservation-renewal tests using branch-notes.md. Browser and deployed outcomes remain unverified.

## 2026-10-02 - Task 02 review approved

- Outcome: Dedicated review approved the widget, manual-refresh hooks, real confirmation UI and test-runtime mapping. Scoped Admin tests reran successfully: 8/8 passed, including attempt count and last-attempt timestamp assertions.
- Next owner: dispatcher/Task 03 integration-test worker after the local Task 02 commit.
- Handover prompt: Verify Admin authentication, asynchronous acceptance, ordinary duplicate protection, confirmed force resend and reservation renewal/cleanup through the real HTTP/framework runtime. No deployed result has been checked.
