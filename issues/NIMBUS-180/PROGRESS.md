# NIMBUS-180 progress

## 2026-10-19 — Registered (triage)

- Outcome: bug registered in Jira (NIMBUS-180, components Customer Portal and Order API, linked
  "relates to" NIMBUS-129 and NIMBUS-130); `bug.md` written. Suspected from code reading and the Metz
  DESADV sample; not reproduced, Business Central not called.
- Proposed route: full pipeline (order API and Business Central sync always go through it):
  `scoper` first. Not started; awaiting the human's go-ahead.
- Next owner: human (decide whether to start the `scoper`).
- Handover prompt: "Scope NIMBUS-180 from `issues/NIMBUS-180/bug.md`: resolve variant EANs on order
  API lines to BC item + variant and send the variant code on the sales line; settle the open
  questions in bug.md first (PO decision, where BC holds variant EANs, BC behaviour without a variant
  code)."
- Not committed yet: commit the case folder (with `issues/NIMBUS-130/samples/`, which bug.md cites).
