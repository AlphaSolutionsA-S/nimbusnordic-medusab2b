# Progress

## 2026-10-26 — triage

- Outcome: new feature request drafted in `feature.md`; no duplicate in Jira (component Customer
  Portal). Related: NIMBUS-156, NIMBUS-160, NIMBUS-161. Jira issue not yet created (waiting for the
  user's yes). Proposed flow: full pipeline (Business Central sync is always full pipeline).
- Next owner: the user (approve issue creation and the flow), then `scoper`.
- Handover prompt: "Create the Jira issue from `issues/admin-company-bc-sync-now/feature.md`, rename
  the folder to `issues/NIMBUS-<n>/`, then run the scoper on it."

## 2026-10-26 — scoper

- Outcome: Jira Story NIMBUS-254 created (component Customer Portal, priority Medium = MoSCoW
  Should, parent epic NIMBUS-128, relates to NIMBUS-156/160/161); folder renamed from
  `admin-company-bc-sync-now`; `feature.md` Tracker line filled in. `scope.md` written with the
  human's answers of 2026-10-26 (R1–R9) and three open questions (storefront 120 s company cache vs
  "immediately"; blocked/credit limit are display-only today; audit of who ran a sync). Scope comment
  added to Jira. Issue left in status Scoping: the "Scope approved" transition (to Estimation) waits
  for the human's approval of the scope. Case folder not yet committed.
- Next owner: the human (review scope, answer the open questions, approve), then
  `implementation-planner` on a separate go-ahead.
- Handover prompt: "Plan NIMBUS-254 from `issues/NIMBUS-254/scope.md` (read `feature.md` and this
  file first). Add a company-id entry point to the BC company sync sharing the existing field
  mapping, an Admin route to sync one company with outcome updated / nothing to sync / failed, the
  last-synced time in the Admin company read, and the Admin action (disabled with tooltip without a
  BC customer number) plus a last-synced row. Do not change the login or freshness triggers; keep
  `integration-tests/http/customers/company-sync.spec.ts` green. Apply the human's answers to the
  scope's open questions first."
