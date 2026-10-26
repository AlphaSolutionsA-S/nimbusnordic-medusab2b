# NIMBUS-255 progress

## 2026-10-26 — Triage

- Outcome: bug registered as NIMBUS-255 (Bug, component Customer Portal, status Scoping), linked
  "relates to" NIMBUS-170 and NIMBUS-137. Intake in `bug.md`.
- Route: full pipeline. It touches the Business Central integration (BC read and its mapped order
  contract between backend and storefront), which `ai/AGENTS.md` always routes to the full pipeline.
  Size of the change itself is small (two apps, a handful of files).
- Next owner: `scoper`, after the human's go-ahead.
- Handover prompt: "Scope NIMBUS-255 from `issues/NIMBUS-255/bug.md`. First confirm against live BC
  data (an invoiced order such as SO330301) that `salesInvoiceLines($expand=itemVariant)` returns the
  size as `itemVariant.code`, then decide how size and description are shown on order lines."

## 2026-10-26 — Scope (draft, awaiting approval)

- Outcome: `scope.md` written. Live BC check (TestDK, read-only): `salesInvoiceLines($expand=item,itemVariant)`
  returns `itemVariant.code` = "XL" on SO330301 / SIN29817; open order SO347954 line has
  description "M" = its `itemVariant.code`, so BC's order-line description is the size itself.
  Production BC environment not checked (UNVERIFIED).
- Open for the human: description equal to the size (hide it too?), size in the return table on
  the same page, variant code vs variant description.
- Next owner: human (approve scope and answer open questions), then `implementation-planner` on a
  separate go-ahead. Jira "scope approved" event not recorded yet (scope not approved).
- Handover prompt: "Plan NIMBUS-255 from `issues/NIMBUS-255/scope.md`."

## 2026-10-26 — Scope (open questions answered, awaiting approval)

- Outcome: the human answered all three questions, folded into `scope.md` (no open questions
  left): the description is also hidden when it equals the size (trimmed, case-insensitive); the
  return table on the same page shows the size too (in scope); the variant code is shown and every
  variant in use is a size, so the label "Size" is right.
- Not yet: explicit scope approval, the Jira "scope approved" event, a commit.
- Next owner: human (approve scope), then `implementation-planner` on a separate go-ahead.
- Handover prompt: "Plan NIMBUS-255 from `issues/NIMBUS-255/scope.md`."

## 2026-10-26 — Scope approved

- Outcome: scope approved by the user (relayed by the pipeline coordinator). Jira: "scope approved"
  comment added and NIMBUS-255 moved Scoping → Estimation (transition "Scope approved"). Case
  folder committed on `feature/NIMBUS-255`.
- Still to verify after deploy: production BC returns `itemVariant.code` on invoice lines (TestDK
  only so far); the "Size" label translated in every locale after the UI translation import.
- Next owner: `implementation-planner` (started by the coordinator).
- Handover prompt: "Plan NIMBUS-255 from `issues/NIMBUS-255/scope.md`."
