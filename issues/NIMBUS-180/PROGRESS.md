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

## 2026-10-23 — Scope drafted (scoper)

- Outcome: `scope.md` written (Bug, Medium, backend only, full pipeline). Verified from saved
  metadata: v2.0 `salesOrderLine` takes `itemVariantId` (no `variantCode`); v2.0 has no item
  reference entity; the ODataV4 metadata publishes `ItemReferenceEntries` (item, variant, unit,
  reference type, barcode). UNVERIFIED: whether Henderson's size barcodes are stored there, and what
  BC does with a variant-less line for a variant item (probes listed in the scope).
- Not recorded in Jira: scope not approved yet. Nothing committed.
- Next owner: Klaus — answer open questions 1-9 in `scope.md` (at least 1, and run or authorise the
  probes in 2, 3, 5), then approve the scope.
- Handover prompt: "Revise the NIMBUS-180 scope with Klaus's answers to the open questions, then
  record 'scope approved' in Jira once he approves."

## 2026-10-23 — Scope revised with Klaus's answers (scoper)

- Outcome: `scope.md` revised.
  - Product-owner rule: a barcode always points to one item and size, so a line resolves to
    item + variant.
  - Per-size barcodes are held in Item Reference (`ItemReferenceEntries`). TestDK was checked by
    query (`samples/bc-variant-barcodes-testdk.md`); for production, Klaus stated it is the same
    (not queried).
  - Item Reference rows that agree on item + variant collapse into one match; only rows that
    disagree are refused.
  - A line for an item with sizes is never sent without its size, so BC's handling of a size-less
    line was not probed and is no longer needed.
  - Klaus's manual ODataV4 query failed with a hand-written `company` parameter; recorded as a
    note, no design change.
- Open questions now 1-6: reference types, unit of measure, item-number fallback,
  priority/history, customer feedback, shipment-notice size code.
- Not recorded in Jira; nothing committed.
- Next owner: Klaus. Answer or accept the proposals in open questions 1-6, then approve the scope.
- Handover prompt: "Finalise the NIMBUS-180 scope with Klaus's answers to open questions 1-6 and
  record 'scope approved' in Jira once he approves."

## 2026-10-23 — Scope final, open questions answered (scoper)

- Outcome: `scope.md` updated with Klaus's answers.
  - Only "Bar Code" reference rows count.
  - A barcode held only for another unit of measure is refused with its own line-failure reason.
  - The item-number fallback is kept for items without sizes.
  - No order-API orders are in production yet, so there is no history to correct.
  - Showing refused lines in the Admin widget only is accepted.
  - Size code on shipment notices: out of scope, a follow-up to be registered (described under
    "Out of scope" in `scope.md`).
- No open questions remain.
- Not recorded in Jira; nothing committed.
- Next owner: Klaus. Approve the scope. Separately: register the shipment-notice size follow-up.
- Handover prompt: "Record 'scope approved' for NIMBUS-180 in Jira, then, on a separate go-ahead,
  hand `issues/NIMBUS-180/` to implementation-planner."

## 2026-10-23 — scope approved

- Outcome: Klaus approved the scope. Jira comment added (rules, decisions, no open questions) and
  NIMBUS-180 moved to Estimation via "Scope approved". Follow-up registered as NIMBUS-231 ("Show
  the size on shipment notice lines", linked "relates to"; case folder `issues/NIMBUS-231/`).
- Next owner: `implementation-planner` (Klaus gave the go-ahead to plan).
- Handover prompt: "Plan NIMBUS-180 from issues/NIMBUS-180/scope.md."

## 2026-10-23 — plan approved

- Outcome: Klaus accepted the four defaults in plan.md "Needs your decision" and approved the plan.
  Ready for Dispatch set; sub-tasks NIMBUS-232 to NIMBUS-235 created and recorded in the manifest;
  "plan approved" comment on NIMBUS-180.
- Next owner: `task-dispatcher` (Klaus gave the go-ahead).
- Handover prompt: "Dispatch NIMBUS-180 from issues/NIMBUS-180/manifest.md on feature/NIMBUS-180."

## 2026-10-23 — Plan written, awaiting review (implementation-planner)

- Outcome: `plan.md`, `manifest.md` and task files 01-04 written (backend only, no migrations).
  Read-only TestDK probe run with the backend's credentials (`samples/bc-item-lookup-probe-planner.md`):
  the ODataV4 call shape via `getODataV4Url` works; `Reference_Type` wire value is `"Bar Code"`;
  batched `or` filters work on both APIs. Findings: no TestDK item has an item-card barcode; the Metz
  sample barcodes are size barcodes on items with sizes; an item number over 20 characters makes BC
  answer 400, which today aborts the whole submission.
- Ready for Dispatch: false. Four items under "Needs your decision" (each with a default). No Jira
  sub-tasks created; nothing committed.
- Next owner: Klaus — review `plan.md` (Needs your decision, sections 5-7), then approve.
- Handover prompt: "Revise the NIMBUS-180 plan with Klaus's answers, mark it ready, and record
  'plan approved' in Jira (tracker-workflow § F) with the task sub-tasks."

## 2026-10-23 — Implementation gate reached (task-dispatcher)

- Outcome: tasks 01-04 done, reviewed and committed locally on `feature/NIMBUS-180` (3ec103c,
  7909708, f016624, 915dfb9; consolidation a994408); sub-tasks NIMBUS-232..235 closed with comments.
  Parent NIMBUS-180 not moved (Estimation; "Estimate approved" is Klaus's decision). Finalization:
  unit, admin, module and HTTP tests at or equal to the develop baseline, typecheck 22 = baseline,
  build passes. `deviation-report.md` written (not committed). Nothing pushed.
- Open questions (in the report): `pnpm ai:check` fails on the root AGENTS.md size after the new
  registry row; the new Admin HTTP reason test is unverified (local admin auth 401, also at develop);
  permission for the after-deploy TestDK order.
- Next owner: Klaus — answer the open questions in `deviation-report.md`.
- Handover prompt: "Resume task-dispatcher for NIMBUS-180 at 'After the gate' with Klaus's answers
  to the deviation report's open questions."

## 2026-10-24 — Branch ready for review (task-dispatcher)

- Outcome: Klaus's gate answers recorded in `deviation-report.md` and as a gate comment on
  NIMBUS-180. Fix: Tier 0 wording trimmed without dropping rules, and the local HTTP 401 baseline
  recorded in `ai/architecture/verification.md`; `pnpm ai:check` passes (AGENTS.md 32 616 bytes).
  Architecture doc request-budget statement corrected. Scope status Implemented; working files removed.
  PR description written outside the repo. Nothing pushed; NIMBUS-180 not moved in Jira.
- Not yet verified: the new Admin HTTP reason test (local admin login 401, also on develop; separate
  bug by the main session); after deploy, Klaus's TestDK order with barcode 5712094132141 (item
  HEND-L-MIDNBLUE, size L).
- Next owner: main session / Klaus — merge `feature/NIMBUS-180` into develop, push, move NIMBUS-180.
- Handover prompt: "Merge feature/NIMBUS-180 into develop and push; open the PR with the saved
  description if wanted; then run the after-deploy TestDK check."
