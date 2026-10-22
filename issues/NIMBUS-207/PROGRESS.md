# NIMBUS-207 progress

## 2026-10-21 — triage: registered

- Outcome: Bug NIMBUS-207 created in Jira (component Customer Portal), linked "relates to"
  NIMBUS-177; `bug.md` written. Registration only, at Klaus Petersen's request; no flow started.
- Proposed flow: full pipeline, starting with `scoper`, pending human go-ahead. Deciding signal:
  personal and financial company data (a full-pipeline signal in `ai/AGENTS.md`); the change itself
  looks small (one backend config, likely a few files), so the scoper may hand it down to
  `quick-fix` (bug mode).
- Next owner: Klaus Petersen (decide the flow).
- Handover prompt: "Let's start working on NIMBUS-207" (triage), or scoper with: "Case folder:
  `issues/NIMBUS-207`, start from `bug.md`. Store quote `quoteFields` selects
  `*customer.employee.company` (`apps/backend/src/api/store/quotes/query-config.ts:6`), returned by
  every store quote route; storefront uses only the company name."
- The case folder is not committed yet; registration is complete once it is.

## 2026-10-21 — scoper: scope written

- Outcome: `scope.md` written (Bug, Medium, base `develop`). Findings beyond triage: (1) the shipped
  role rule (store company projection, NIMBUS-157) makes credit limit, blocked status and
  spending-limit reset frequency administrator-only, so the leak is those fields reaching every
  employee; VAT and BC customer number are already visible to all members; (2) the store quote
  routes have no field allowlist, and in the installed Medusa caller `fields` are then unfiltered,
  so trimming the defaults alone would not close the leak (verified from installed source, not
  probed live). Jira: comment with business rules and open questions added; status left at
  Scoping, the "Scope approved" transition (to Estimation) waits for the human's approval.
- Open questions for the human: scope.md, "Open questions" 1-5 (company id, strip vs 400,
  include message author records, register the role rule in decisions.md, priority).
- Recommended next flow: `implementation-planner` (company authorization and personal data are
  "always full pipeline" in `ai/AGENTS.md`); the work is about two backend tasks, so a short plan.
  `quick-fix` (bug mode) only if the human explicitly chooses to override that.
- Next owner: Klaus Petersen (approve the scope, answer the open questions, choose the flow; then
  transition NIMBUS-207 "Scope approved").
- Handover prompt: "Plan NIMBUS-207. Case folder `issues/NIMBUS-207`, start from `scope.md`
  (answers to its open questions: ...). Base `develop`, branch `feature/NIMBUS-207`."

## 2026-10-21 — open questions answered

- Outcome: Klaus Petersen accepted the proposed answers to all five open questions (recorded in
  `scope.md`, "Open questions"): company `name` only; Medusa's native allowlist behaviour, pinned
  by a test; message authors narrowed to names in this bug; a `decisions.md` row for company field
  visibility by role; priority stays Medium.
- Next owner: Klaus Petersen (approve the scope, transition NIMBUS-207 "Scope approved", start the
  planner).
- Handover prompt: "Plan NIMBUS-207. Case folder `issues/NIMBUS-207`, start from `scope.md`
  (open questions answered there). Base `develop`, branch `feature/NIMBUS-207`."

## 2026-10-21 — scope approved

- Outcome: Klaus Petersen approved the scope. NIMBUS-207 transitioned "Scope approved" (now
  Estimation); approval and answers commented in Jira.
- Next owner: Klaus Petersen (go-ahead to start `implementation-planner`).
- Handover prompt: as in the previous entry.
