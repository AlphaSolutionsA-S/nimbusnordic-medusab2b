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
