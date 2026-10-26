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

## 2026-10-26 — Plan (draft, awaiting approval)

- Outcome: `plan.md`, `manifest.md`, `01-backend-variant-code.md`, `02-storefront-size-display.md`
  written. Two tasks: backend adds `variantCode` to BC order detail lines (invoice read expands
  `itemVariant`, no extra call); storefront shows the size and applies the description rule via one
  pure helper in both tables, adds the size key in 8 locale files and a `decisions.md` row. Jira
  sub-tasks created: NIMBUS-256 (01), NIMBUS-257 (02). Nothing under "Needs your decision"; no
  UNVERIFIED framework rows.
- Not yet: human plan approval, `Ready for Dispatch: true`, the Jira "plan approved" comment on
  NIMBUS-255 (decisions new in the plan).
- Next owner: human (review `plan.md`), then `task-dispatcher` on a separate go-ahead.
- Handover prompt: "Dispatch NIMBUS-255 from `issues/NIMBUS-255/manifest.md`."

## 2026-10-26 — Plan approved

- Outcome: the user approved the plan as written ("godkendt"), including the new choices (optional
  `variantCode`, storefront helper for the description rule, return quantity label by product name,
  the 8 size texts). Manifest set `Ready for Dispatch: true`. Jira: "plan approved" comment on
  NIMBUS-255; sub-tasks NIMBUS-256 and NIMBUS-257 already exist.
- Still to verify after deploy: production BC returns `itemVariant.code` on invoice lines; the size
  key imported into the DB UI translations before the storefront release.
- Next owner: `task-dispatcher`, on a separate go-ahead from the user.
- Handover prompt: "Dispatch NIMBUS-255 from `issues/NIMBUS-255/manifest.md`."

## 2026-10-26 — Implementation (at the final gate, not pushed)

- Outcome: both tasks done, reviewed and committed locally: d22c39c (NIMBUS-256, backend
  `variantCode`), 03b83e9 (NIMBUS-257, storefront size and description rule). Consolidation: no
  changes. Cross-task review: no wiring findings; `deviation-report.md` written. Jira: NIMBUS-255
  In Progress; NIMBUS-256 and NIMBUS-257 Done with closing comments.
- Finalization: backend unit 1016/1016; backend modules 584 pass, 2 fail (the baseline BC
  `listOrders` guardrail test, src and compiled copy); storefront 611/611; typecheck backend 22 and
  storefront 8 (both = baseline); both builds pass. `test:integration:http` not run (no HTTP test
  added; NIMBUS-236 baseline).
- Open for the human (`deviation-report.md`, Open questions): (1, blocking) `pnpm ai:check` fails:
  the new `decisions.md` row makes generated `AGENTS.md` 32891 bytes, over 32768; trim other Tier 0
  text, drop the row, or raise the limit. (2) Keep the hard-coded "Size: XL" separator or use an ICU
  message per locale.
- Next owner: human (answer the open questions), then `task-dispatcher` resumes "After the gate".
- Handover prompt: "Resume NIMBUS-255 dispatch after the gate with these answers: <answers>."
