# NIMBUS-192 progress

## 2026-10-19 — Registered (triage)

- Outcome: bug registered in Jira (NIMBUS-192, Bug, components Customer Portal and Order API, linked
  "relates to" NIMBUS-129 and NIMBUS-130); `bug.md` written. Found by code reading during NIMBUS-130
  planning; not reproduced.
- Proposed route: full pipeline (the order API `/orderapi` always goes through it): `scoper` first.
  The change is small (one message, one log line, two test assertions), so the human may instead fold
  it into an existing order-API case (NIMBUS-130, whose plan already adds a generic-404 company
  resolution, or NIMBUS-144, which built the POST). Not started; awaiting the human's decision.
- Next owner: human (start the `scoper`, or fold into another case).
- Handover prompt: "Scope NIMBUS-192 from `issues/NIMBUS-192/bug.md`: make the order API's
  unknown-customer 404 generic, log the detail server-side without personal data, and update the
  tests listed under Also update; settle the open questions in bug.md first."
- Not committed yet: commit the case folder.

## 2026-10-19 — Folded into NIMBUS-130
- **Updated by:** implementation-planner agent (NIMBUS-130)
- **Outcome:** The human decided to fix this bug within epic NIMBUS-130, as its task 12
  (`issues/NIMBUS-130/12-shared-company-resolution.md`, Jira sub-task NIMBUS-193, linked "implements"
  NIMBUS-192).
  - Open questions answered on 2026-10-19:
    - Q1: one shared company-resolution step for the POST and the new GET;
    - Q2: log the customer number server-side in one warn line with nothing else (sole traders
      flagged);
    - Q3: duplicate-order 422s keep echoing the caller's own order number;
    - Q4 verified: Medusa's error handler (`@medusajs/framework@2.21.2`
      `dist/http/middlewares/error-handler.js`) returns the thrown message verbatim with 404, so the
      bug is real.
  - Tests to change are listed in the task file. Jira: comment on NIMBUS-192.
- **Handover to:** delivered by NIMBUS-130; this case gets no separate pipeline run.
- **Handover prompt:** None. Close NIMBUS-192 (with a closing comment) when NIMBUS-130's task 12 is
  committed and shipped.
