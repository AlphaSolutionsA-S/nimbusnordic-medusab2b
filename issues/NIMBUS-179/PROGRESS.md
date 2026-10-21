# NIMBUS-179 progress

## 2026-10-15 — triage

- Outcome: registered as Bug NIMBUS-179 (component Customer Portal), linked "relates to" NIMBUS-130.
  Intake: `bug.md`. Split out of NIMBUS-130 scoping at Klaus Petersen's request.
- Route proposed: full pipeline (`scoper` → `implementation-planner` → `task-dispatcher`). Signals:
  touches Business Central order submission and approvals (always full pipeline), a cross-cutting
  infrastructure/vendor configuration change (lock provider, possibly a migration for the
  `locking` table), and a decision only the business can make (Medusa Cloud plan).
- Not started: waiting for the human's go-ahead.
- Next owner: `scoper`.
- Handover prompt: "Scope NIMBUS-179 from `issues/NIMBUS-179/bug.md`: make backend locks (and,
  if in scope, scheduled-job single-run) hold across multiple Medusa Cloud instances on the Develop
  plan. Resolve the open decisions in bug.md first."

## 2026-10-15 — triage (decision recorded)

- Outcome: Klaus Petersen decided to register `@medusajs/medusa/locking-postgres` as the default lock
  provider. Recorded in `bug.md` (Decisions) and as a Jira comment on NIMBUS-179.
- Still open: whether production stays on the Develop plan; scope breadth (locking only, or also the
  workflow engine and event bus); when to start the pipeline.
- Not started: waiting for the human's go-ahead.
- Next owner: `scoper`, unchanged.
- Handover prompt: "Scope NIMBUS-179 from `issues/NIMBUS-179/bug.md`: make backend locks hold across
  multiple Medusa Cloud instances using the decided `locking-postgres` provider. Resolve the
  remaining open decisions in bug.md first."

## 2026-10-20 — Intake committed on develop

- **Outcome:** Committed the existing `bug.md` and this progress record on local `develop`, as
  requested by the user. This records the previously registered intake; it does not start the
  locking-provider implementation or resolve the outstanding scope decisions. Jira remains
  Scoping, and no application source was changed for NIMBUS-179.
- **Next owner:** `scoper`, on the human's implementation go-ahead.
- **Handover prompt:** Scope the existing NIMBUS-179 intake and resolve the remaining production
  hosting and scope-breadth decisions before planning implementation.

## 2026-10-20 — Risk accepted; close without implementation

- **Outcome:** The user accepted in-memory locking and no validation for local/Develop environments,
  including the multi-instance production risk if production remains on Develop without shared
  infrastructure. This supersedes the earlier PostgreSQL-provider decision. Recorded the accepted
  risk and verification limits in `bug.md`; no application code, migration, test or deployment change
  is part of this closure. Jira closure uses "Won't Do" to distinguish acceptance from a fix.
- **Next owner:** human owner; no scoping or implementation handover remains for this case.
- **Handover prompt:** Retain the accepted-risk record. Any future requirement to validate shared
  processing or change infrastructure needs a fresh decision; do not treat this closure as proof
  that Cloud Redis is active or that multi-instance processing is safe.
