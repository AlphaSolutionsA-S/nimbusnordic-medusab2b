# NIMBUS-243 progress

## 2026-10-24 — Registered

- Outcome: bug registered in Jira (Bug, parent epic NIMBUS-206, component Customer Portal) and
  mirrored in `bug.md`. Found by code reading during triage of NIMBUS-242; not yet reproduced
  against a running backend.
- Next owner: triage, to route it. Company authorization is an always-full-pipeline area in
  `ai/AGENTS.md`, though the likely fix (drop `customer_id` from the store validator, since the
  storefront never sends it) is small.
- Handover prompt: "Triage NIMBUS-243 (issues/NIMBUS-243/bug.md): store route
  POST /store/companies/:id/employees accepts any companyless customer_id."
