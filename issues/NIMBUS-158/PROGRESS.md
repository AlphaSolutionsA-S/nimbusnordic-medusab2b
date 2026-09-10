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
