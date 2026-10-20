# NIMBUS-130: Return shipment notices to API customers (until 2026-10-19: order confirmations)

## 2026-10-15 — Scope drafted
- **Updated by:** scoper agent
- **Outcome:** `scope.md` written for the epic as one unit of work (stories NIMBUS-150, 151, 152
  and new NIMBUS-178). Recommendations: a data model in the `orderIngestion` module (not order
  metadata), and an opaque sequence-number cursor (`after`, exclusive, paged) with an optional
  `since` timestamp for the first call. Jira: NIMBUS-150/151/152 retitled and described (their
  descriptions were empty), NIMBUS-178 created under the epic with components Customer Portal and
  Order API, and a "scope drafted, awaiting approval" comment on NIMBUS-130 with the rules,
  decisions and open questions. Epic status left at Scoping; epic title not changed (Q1).
- **Handover to:** human (product owner / lead dev) for scope approval and answers to Q1–Q7; Q2
  and Q3 need the Business Central consultant.
- **Handover prompt:** Review `issues/NIMBUS-130/scope.md`, answer the open questions (at least Q1
  XML vs JSON and Q2 the Business Central "confirmed" signal), and approve or correct the business
  rules, the data model and the watermark design. On approval, the scoper records "scope approved"
  in Jira; planning (`implementation-planner` with `issues/NIMBUS-130/`) starts only on a separate
  go-ahead.

## 2026-10-15 — Open questions answered, scope revised
- **Updated by:** scoper agent
- **Outcome:** The product owner answered Q1–Q8: JSON (epic renamed "Return order confirmations
  to API customers"); confirmations live in a separate BC table; fields are what that table holds;
  Q4–Q7 as recommended; polling only, no changes in Business Central. Read-only check of BC
  `$metadata` (all published API routes and ODataV4, TestDK) found no entity named "order
  confirmation"; the confirmation table is the sales order archive (`salesOrderArchives` /
  `salesOrderArchiveLines`, standard API v2.0), confirmed by TestDK data (archives of still-open
  orders, multiple versions). Excerpt saved in `samples/bc-sales-order-archive-metadata.xml`.
  `scope.md` revised: Facts, contract, rule R5 (confirmed = an archive exists for the current BC
  order number; highest version at first detection stored), R3/R7/R9, data model, resolved
  questions; remaining planner items P1–P3. Jira: epic renamed, NIMBUS-150/151/178 descriptions
  updated, decision-change comment on NIMBUS-130. Scope approval not yet given.
- **Handover to:** human (product owner / lead dev) for scope approval.
- **Handover prompt:** Review the revised `issues/NIMBUS-130/scope.md`, especially rule R5 (sales
  order archive as the order confirmation) and the draft contract. On approval, the scoper records
  "scope approved" in Jira; planning (`implementation-planner` with `issues/NIMBUS-130/`) needs a
  separate go-ahead and starts with P1–P3.

## 2026-10-15 — Multiple workers: design made safe for concurrent runs
- **Updated by:** scoper agent
- **Outcome:** The product owner answered P2: "there might be multiple workers". Verified from
  installed 2.21.2 source and the `medusa` MCP: jobs load on every `worker`/`shared` instance;
  the in-memory workflow engine runs every tick on every instance, the Redis engine schedules a
  BullMQ repeatable job with a fixed key; `locking-redis` and `locking-postgres` are installed;
  Medusa Cloud auto-configures Redis locking and workflow engine on Launch/Scale/Enterprise plans
  only. `scope.md` revised: correctness no longer depends on a lock (insert-if-absent on unique
  `order_id`; sequence from a counter row locked in the store transaction, so commits are in
  cursor order); the cross-instance single-run lock only saves BC reads. New P4 (which Cloud plan
  / lock provider) and P5 (app-wide in-memory locking assumption, separate case). Jira:
  NIMBUS-150 and NIMBUS-152 descriptions updated, decision-change comment on NIMBUS-130. Scope
  approval not yet given.
- **Handover to:** human (product owner / lead dev) for scope approval; P4 to whoever can see the
  Medusa Cloud plan.
- **Handover prompt:** Review the revised Watermark design and Non-functional sections of
  `issues/NIMBUS-130/scope.md`, confirm the Cloud plan (P4) and decide whether to open a separate
  case for P5. On approval, the scoper records "scope approved" in Jira; planning needs a separate
  go-ahead.

## 2026-10-15 — Lock provider decided (P4, P5)
- **Updated by:** scoper agent
- **Outcome:** P4: the Medusa Cloud project is on the Develop plan (no Redis); the human approved
  `@medusajs/medusa/locking-postgres` as the cross-instance lock provider. P5: registered as
  NIMBUS-179 (Bug), which delivers the provider registration and migration, outside this epic.
  `scope.md`: both moved to resolved; the NIMBUS-150 job uses the default lock provider (becomes
  cross-instance with NIMBUS-179); NIMBUS-179 added as a non-blocking dependency (correctness rests
  on the counter row and unique `order_id`); open note on whether production stays on Develop.
  Jira: NIMBUS-150 linked "relates to" NIMBUS-179; decision comment on NIMBUS-130. Scope
  approval not yet given.
- **Handover to:** human (product owner / lead dev) for scope approval.
- **Handover prompt:** Review `issues/NIMBUS-130/scope.md` and approve or correct it. On approval,
  the scoper records "scope approved" in Jira; planning (`implementation-planner` with
  `issues/NIMBUS-130/`) needs a separate go-ahead and starts with P1 and P3.

## 2026-10-19 — Decision changed: shipment notices instead of order confirmations
- **Updated by:** scoper agent
- **Outcome:** The product owner / lead dev decided the epic delivers shipment notices (despatch
  advice), not order confirmations; token, APIM + Logic App path, JSON, polling only, no BC changes
  and the concurrency-safe watermark design are kept. Metz's DESADV sample saved as
  `samples/metz-desadv-NLF230439.xml`; `salesShipment` metadata excerpt saved as
  `samples/bc-sales-shipment-metadata.xml`. Read-only TestDK check (GET only): `salesShipments` /
  `salesShipmentLines` fields match the snapshot; `lastModifiedDateTime gt` and `orderNumber eq … or`
  filters work; partial shipments common (11 of 185 orders with 2–4 shipments) and repeat every
  order line with quantity 0; Undo Shipment adds negative correction lines to the same posted
  shipment (5 of 500); shipment numbers are 8 digits like the DESADV `DocumentNo`. `scope.md`
  rewritten: posted sales shipment as source; one notice per shipment, recorded once keyed by BC
  shipment id after a settling delay (R5–R7); "changed since" read with overlap replaces per-order
  polling (30-day expiry and backoff dropped); EAN per line from the customer's own order line via
  the line match (P1); data model `shipment_notice` + job state; order-confirmation material moved
  to a "Superseded" section (archive sample kept). New open questions Q10–Q17 (EAN, carrier/tracking/
  weights, JSON vs Evenex DESADV and overlap with today's EDI, undone shipments, prices, edge orders,
  start point, order confirmations later) and planner items P1, P3, P6. Jira: epic renamed "Return
  shipment notices to API customers"; NIMBUS-150/151/152/178 retitled and descriptions rewritten;
  decision-change comment on NIMBUS-130. Scope approval not yet given.
- **Handover to:** human (product owner / lead dev) for scope approval; Q10–Q12 need Metz A/S.
- **Handover prompt:** Review the revised `issues/NIMBUS-130/scope.md` (Business rules R1–R10, the
  "how new shipments are found" decision, the contract draft) and answer Q10–Q17, at least Q12
  (JSON vs Evenex DESADV, and whether it replaces today's EDI despatch advice) with Metz. On
  approval, the scoper records "scope approved" in Jira; planning (`implementation-planner` with
  `issues/NIMBUS-130/`) needs a separate go-ahead and starts with P1, P3 and P6.

## 2026-10-19 — Product owner answers; revisions for changed shipments
- **Updated by:** scoper agent
- **Outcome:** The product owner answered:
  - Q10: EAN from the customer's own order line.
  - Q11: carrier, tracking and weights left out (possible later extension).
  - Q12: Medusa returns JSON; APIM returns plain XML of the same contract (not Evenex), chosen by
    the `Accept` header, JSON by default.
  - Q14: no prices; `your_reference` returned.
  - Q15: canceled orders still reported, only the current BC order number matched (both decided
    for now).
  - Q16: no back-fill.
  - Q17: no order confirmations now.
  - Q13: send revised notices instead of "record once".

  Verified read-only on TestDK with item ledger entry numbers: Undo Shipment does not move
  `salesShipment.lastModifiedDateTime`. Shipment 30947937 was undone after shipment 30947938
  (07:09:15) was posted, yet its own timestamp stayed at 07:07:01; the other four undo cases are
  inconclusive. `scope.md` revised:
  - R7 now records revisions. Each run re-reads the recorded shipments inside a re-check window by
    number in batches and compares a content hash of the netted lines. When they differ it stores a
    new revision with a new cursor position (`revision`, `status` shipped / revised / cancelled,
    `previous_cursor`; always a full snapshot).
  - R6 nets undo correction lines against their original.
  - The store transaction is insert-if-changed under the counter lock, with unique
    (BC shipment id, revision).
  - The contract and data model are updated, and the XML rendering is added to NIMBUS-151/178.

  Jira: NIMBUS-150/151/152/178 descriptions updated; a decisions comment was added on NIMBUS-130.
  Scope approval not yet given.
- **Handover to:** human (product owner / lead dev) for scope approval and Q12b / Q13a.
- **Handover prompt:** Answer Q12b (does the API replace today's EDI despatch advice for Metz,
  yes/no) and Q13a (re-check window, proposed 14 days; 15-minute settling delay, recommended), then
  review `issues/NIMBUS-130/scope.md` (R1–R10, especially R6–R7). On approval, the scoper records
  "scope approved" in Jira; planning (`implementation-planner` with `issues/NIMBUS-130/`) needs a
  separate go-ahead and starts with P1, P3, P6 and P8.

## 2026-10-19 — Last product-owner answers (Q12b, Q13a)
- **Updated by:** scoper agent
- **Outcome:** Q12b: the API and today's EDI despatch advice run side by side; the API is a pull
  mechanism, Metz chooses what to use, and nothing is deduplicated or suppressed between the two
  (new R11). Q13a: 14-day re-check window and a 15-minute settling delay before revision 1, as
  recommended. `scope.md`: R7, the "how new shipments are found" decision, the data model and the
  stories updated; no product-owner questions open. Jira: NIMBUS-150 description updated; decisions
  comment on NIMBUS-130. Scope approval not yet given.
- **Handover to:** human (product owner / lead dev) for scope approval.
- **Handover prompt:** Review `issues/NIMBUS-130/scope.md` (R1–R11) and approve or correct it. On
  approval, the scoper records "scope approved" in Jira. Planning (`implementation-planner` with
  `issues/NIMBUS-130/`) needs a separate go-ahead and starts with P1, P3, P6 and P8.

## 2026-10-19 — Scope approved
- **Updated by:** scoper agent
- **Outcome:** The human (product owner / lead dev) approved the scope. `scope.md` Status set to
  "Scope approved". Jira: "scope approved" comment on NIMBUS-130 (business rules, key decisions,
  planner questions); epic transitioned "Scope approved" (Scoping → Estimation). Not committed
  (the coordinator commits and pushes).
- **Handover to:** human, for a separate go-ahead to start planning.
- **Handover prompt:** On go-ahead, run `implementation-planner` with `issues/NIMBUS-130/`. Start
  with the planner items in `scope.md`: P1 (line match and order lookup), P3 (production data
  check), P6 (BC timestamps on undo, overlap size) and P8 (pairing undo correction lines).

## 2026-10-19 — Plan drafted
- **Updated by:** implementation-planner agent
- **Outcome:** `plan.md`, `manifest.md` and task files `01`–`08` written (8 tasks: contract,
  storage, BC line capture at submission, BC shipment reads, decision function, polling workflow +
  job, read endpoint, APIM + Logic App artifacts). Read-only TestDK probes (GET only, scripts kept in
  the session scratchpad):
  - P1: shipment line `sequence` = sales-order line `sequence` (70/70). The same item is on several
    lines in 9,666 of 20,000 shipments, so lines are matched by capturing the BC line number at
    submission. The order is found by a BC order number stored on `order_external_reference`.
  - P8: 559/559 correction lines pair with the nearest preceding positive line (same item, unit,
    opposite quantity).
  - P6: 7 cases confirm, 0 contradict that undo leaves `lastModifiedDateTime` unchanged. Visibility
    lag is UNVERIFIED (TestDK idle since 2026-09-25); the overlap is 30 minutes.
  - P3: not reachable (TestDK credentials only); now a pre-go-live check.

  70% of headers are re-modified on later days, so a go-live posting-date guard was added. Jira:
  sub-tasks NIMBUS-181 (under 151), NIMBUS-182–186 (under 150), NIMBUS-187 (under 152) and NIMBUS-188
  (under 178), all with components Customer Portal and Order API; a "plan drafted, awaiting approval"
  comment on NIMBUS-130. `Ready for Dispatch: false`. Nothing committed; no branch created.
- **Handover to:** human (product owner / lead dev) for plan review.
- **Handover prompt:** Review `issues/NIMBUS-130/plan.md`. Answer the 7 items under "Needs your
  decision", read sections 5–7 closely and stop at the `Critical` flags. A competing-model review is
  recommended (personal data, BC vendor behaviour). On approval the planner sets `Ready for Dispatch:
  true` and records "plan approved" in Jira. Dispatch (`task-dispatcher` with `issues/NIMBUS-130/`)
  needs a separate go-ahead and the branch `feature/NIMBUS-130` from `develop`.

## 2026-10-19 — Plan decisions answered
- **Updated by:** implementation-planner agent
- **Outcome:** The human answered the plan's section 2: "all decisions to recommendations"; items 1–7
  accepted with their defaults, including the unmeasured late-visibility risk (30-minute overlap,
  re-measured on production; the UNVERIFIED row no longer blocks dispatch) and P3 as a non-blocking
  pre-go-live check. Recorded as `**Answer:**` lines in `plan.md` (sections 2, 8 and 9 updated) and in
  the manifest header. Jira: comment on NIMBUS-130. Plan not yet approved; `Ready for Dispatch:
  false`. Nothing committed.
- **Handover to:** human (product owner / lead dev) for plan approval.
- **Handover prompt:** Approve `issues/NIMBUS-130/plan.md` or ask for changes. On approval the planner
  sets `Ready for Dispatch: true` and records "plan approved" in Jira; dispatch needs a separate
  go-ahead.

## 2026-10-19 — Plan revised after the independent review
- **Updated by:** implementation-planner agent
- **Outcome:** `plan-review.md` (F1–F8) resolved in `plan.md`, `manifest.md` and the task files, now
  10 tasks:
  - F3: the line map moved into the existing BC outcome metadata write. No new step and no
    `order_external_reference` columns. The order lookup is now customer number + external document
    number + current BC number (probe 7: 11/11). The migration script was dropped.
  - F2: count-sized windows read to the end with server-driven paging, plus a trail scan 30 minutes
    behind. Probes 7–9: OR keyset → 501; `$count`, `Prefer: odata.maxpagesize` and `nextLink` work;
    a 77-row tie group exists.
  - F4, F5, F6: a `shipment_tracking` table with a bounded, rotated check schedule, back-off,
    `gave_up` and a final check after the window. Run deadline 4 min, request timeout 20 s, lock TTL
    10 min, summary log and stalled-progress warnings.
  - F1: store against the expected revision, with a stale-worker test.
  - F7: a held-transaction visibility test.
  - F8: canonical, sequence-sorted pairing and hash, with permutation tests.
  - Review correction 3: `sequence` in the line POST response is verified from Microsoft Learn (201
    returns the full object); it does not block dispatch.

  Human answers recorded: Logic App run-history personal data accepted; XML error bodies yes. New
  decisions 8–11 (retry, final check, force resend, lookup) are open with defaults. Jira: NIMBUS-189
  and NIMBUS-190 created under NIMBUS-150; NIMBUS-182, 183, 186 and 188 retitled or re-described;
  revision comment on NIMBUS-130. `Ready for Dispatch: false`. Nothing committed; no branch.
- **Handover to:** human (product owner / lead dev).
- **Handover prompt:** Answer decisions 8–11 in `issues/NIMBUS-130/plan.md` section 2, then approve
  the plan or ask for changes. On approval the planner sets `Ready for Dispatch: true` and records
  "plan approved" in Jira; dispatch needs a separate go-ahead.

## 2026-10-19 — Decisions 8–11 answered; Admin recovery task added
- **Updated by:** implementation-planner agent
- **Outcome:** The human accepted decisions 8–11 with their defaults. For decision 8, recovery is now
  from Medusa Admin: new task 11 (`11-admin-gave-up-retry.md`). Admin routes under `/admin` (default
  admin auth, verified in `@medusajs/framework` 2.21.2 `dist/http/router.js`) list the `gave_up`
  tracking rows and retry one through a reopen workflow. The Admin UI page uses `admin/lib/client.ts`.
  There is no reopen for `window_ended` rows; a database reset stays the documented fallback.
  `shipment_tracking` gains `closed_at`, `reopened_at` and `reopened_by`. The give-up rule now counts
  from the later of the window's end and the reopen time (tasks 02 and 05 updated). `plan.md`
  sections 2, 4, 5, 6, 7, 9 and 10 updated; manifest row 11 added. Jira: NIMBUS-191 created under
  NIMBUS-150 (components Customer Portal, Order API); comment on NIMBUS-130. All decisions answered;
  `Ready for Dispatch: false` pending plan approval. Nothing committed; no branch.
- **Handover to:** human (product owner / lead dev) for plan approval.
- **Handover prompt:** Approve `issues/NIMBUS-130/plan.md` or ask for changes. On approval the planner
  sets `Ready for Dispatch: true` and records "plan approved" in Jira; dispatch needs a separate
  go-ahead and the branch `feature/NIMBUS-130` from `develop`.

## 2026-10-19 — Plan approved
- **Updated by:** implementation-planner agent
- **Outcome:** The human approved the plan. `manifest.md` has `Ready for Dispatch: true` (no
  unaccepted UNVERIFIED row; the late-visibility risk was accepted). `plan.md` status updated. Jira:
  "plan approved" comment on NIMBUS-130 with the decisions new in the plan and their answers. No
  transition (the tracker skills name none for plan approval). Sub-tasks NIMBUS-181–191 already
  exist and are in the manifest. Nothing committed; no branch.
- **Handover to:** human, for the separate dispatch go-ahead.
- **Handover prompt:** Commit the case folders (`issues/NIMBUS-130/`, and `issues/NIMBUS-179/` and
  `issues/NIMBUS-180/` as you decide). Create `feature/NIMBUS-130` from `develop`, then run
  `task-dispatcher` with `issues/NIMBUS-130/`. Approving the plan is not that go-ahead.

## 2026-10-19 — NIMBUS-192 folded in; plan re-approved
- **Updated by:** implementation-planner agent
- **Outcome:** The human folded bug NIMBUS-192 into this epic as task 12
  (`12-shared-company-resolution.md`, Jira NIMBUS-193 under NIMBUS-152, linked "implements"
  NIMBUS-192). One shared, read-only step resolves the company for `POST /orderapi/orders` and the GET.
  An unknown number → 404 "Customer not found", with the number in one warn log line only. Task 09 now
  depends on 12.
  - bug.md Q4 verified: `@medusajs/framework@2.21.2` `dist/http/middlewares/error-handler.js` maps
    `NOT_FOUND` to 404 and returns the thrown message verbatim (and logs 4xx messages at info).
  - Contract correction found on the way: Medusa error bodies are `{ type, message, code? }`, not
    `{ error, message }`; tasks 01, 09 and 10 updated so APIM maps both error shapes.
  - Decisions 12 (log the number server-side, sole traders flagged) and 13 (duplicate 422s keep
    echoing the caller's own order number) were accepted, and the plan was re-approved with the
    change.
  - `Ready for Dispatch: true`. Jira: comments on NIMBUS-130 and NIMBUS-192. Nothing committed; no
    branch.
- **Handover to:** human, for the separate dispatch go-ahead.
- **Handover prompt:** Commit the case folders (`issues/NIMBUS-130/`, `issues/NIMBUS-192/`, and the
  others as you decide). Create `feature/NIMBUS-130` from `develop`, then run `task-dispatcher` with
  `issues/NIMBUS-130/`. Task 12 runs before task 09.

## 2026-10-19 — Implementation resumed after interruption

- **Updated by:** task 10 worker, on dispatcher handover.
- **Outcome:** The previous progress entry was stale: tasks 01–09 and 12 are already committed on
  `feature/NIMBUS-130`. Task 10 artifacts and its evidence notes exist as uncommitted work; task 10
  is resumed to inspect and verify them. Task 11 remains pending.
- **Handover to:** task 10 worker, then dispatcher for review and task 11.
- **Handover prompt:** Finish task 10 without changing unrelated work or NIMBUS-179; record fresh
  offline evidence and the deployment checks that still require Azure.

## 2026-10-19 — Task 10 artifacts verified on resumption

- **Updated by:** task 10 worker.
- **Outcome:** Existing five task 10 artifacts reviewed; no artifact changes needed. Recreated the
  missing offline harness in `.tmp/NIMBUS-130-20261019-resume/task10-render/`: 69 policy-expression
  and XSD checks plus 29 workflow-reference, token-parity and URL-encoding checks pass. Updated
  task evidence and branch notes. No Azure deployment or live manual calls; gateway acceptance
  and actual forwarding remain after-deploy checks. Dispatcher measured 22 existing backend
  type errors (`typecheck-baseline.log` in the run scratchpad); this artifacts-only task did not
  repeat backend checks. Dispatcher checked pull, but the local branch has no tracking branch.
- **Handover to:** dispatcher for task 10 review, then task 11 implementation.
- **Handover prompt:** Review the five task 10 artifacts and fresh evidence, then continue with
  `11-admin-gave-up-retry.md`. Preserve unrelated work, including NIMBUS-179. Nothing was committed
  by the worker.

## 2026-10-19 — Task 11 implemented and scoped checks passed

- **Updated by:** task 11 worker.
- **Outcome:** Added Admin gave-up shipment listing, atomic retry workflow and recovery page.
  Real HTTP contract/integration: six passed, including retry to polling check and the renewed
  three-day failure window. Security: three credential cases passed (six denied HTTP requests).
  Admin RTL: four passed. Lint: zero errors, 13 existing warnings. Backend typecheck: exactly
  the same 22 baseline diagnostics, zero new. Logs are `task11-{http,security,admin,lint,typecheck}.log`
  in `.tmp/NIMBUS-130-20261019-resume/`.
- **Handover to:** dispatcher for task 11 review and finalization.
- **Handover prompt:** Review task 11 files and deviations (API keys supply their own actor id,
  while user bearer/session actors supply the admin user id); run final whole-branch checks.
  No worker commit or tracker update. Deployed Admin and next-minute poll checks remain after
  deployment; unrelated NIMBUS-179 and manifest changes were preserved.

## 2026-10-19 — Consolidation and local finalization evidence recorded

- **Updated by:** consolidation worker, on dispatcher handover.
- **Outcome:** All twelve tasks reviewed locally. Compared the implementation with merge-base
  `1b6e33ab5de42272f71dbd6cd10cc4df8e1e5af7`, task deviations and plan security matrix. No duplicate
  units, dead APIs or inter-task test gaps justified a source change. Security coverage, branch
  source/test line counts and completed check results are recorded in `branch-notes.md`.
  Unit 389/389 and Admin 41/41 passed; build passed; lint zero errors/13 existing warnings.
  Module run: 369 passed, two documented BC guardrail failures (source/generated duplicates).
  Full corrected HTTP: 181 passed/31 failed; 23 companies failures were a startup-hook timeout,
  and a scoped unchanged-timeout rerun passed all 23. The other eight match the documented quote
  fixture failure with unchanged causal code. Typecheck still has 22 diagnostics; exact failing
  snippets and owning types/helpers/config were compared with merge-base and remain unchanged.
  No fresh merge-base test/compiler execution; no suppression. Initial interrupted HTTP run is
  incomplete evidence. Documentation-only consolidation did not repeat the completed checks.
- **Handover to:** integration reviewer, then dispatcher for the human implementation gate.
- **Handover prompt:** Review the full branch against plan/seams and this evidence. Carry the live
  Azure/token/forwarding, TestDK posting/undo, production matching, deployed Admin/poll and alert
  checks into the deviation report and ship gate. Nothing pushed, deployed, committed or changed
  in the tracker by this worker; unrelated NIMBUS-179 and scratch files preserved.

## 2026-10-19 — Cross-task integration review: changes requested

- **Updated by:** integration reviewer.
- **Outcome:** Wrote `deviation-report.md` against merge-base `1b6e33ab5de42272f71dbd6cd10cc4df8e1e5af7` through `d21d9cc`. M1 is a mechanical blocker: workflow deadlines are not propagated to token/data/page requests in the BC adapter, so pagination can dispatch after the four-minute deadline. Preserve complete-window cursor semantics and stop unread checks without a BC error. D1 (persistent non-throttling discovery failure starves checks and summary/stall warnings) remains a human design question, alongside the recorded CRLF size limitation and baseline-check acceptance. All task after-deploy lines copied into the report; no deployment verified. No source/test/build/lint changes or runs by this reviewer.
- **Handover to:** dispatcher for a surgical M1 fix, independent review and affected verification, then integration re-review before the human gate.
- **Handover prompt:** Carry the absolute deadline to every actual token/data/page dispatch; stop before starting another request once expired. Discard incomplete windows without advancing their cursor; leave unread checks due without a failure/throttle. A final page started before expiry may finish and its complete window may commit. Cover expiry across token refresh and nextLink and a later successful retry. Retain D1 for the gate. Preserve unrelated NIMBUS-179 and run scratch evidence; nothing pushed.

## 2026-10-20 — M1 deadline propagation implemented and verified

- **Updated by:** M1 worker, resumed from the existing uncommitted fix.
- **Outcome:** Absolute deadlines now reach every shipment token/data/page dispatch. Expiry is a
  normal incomplete outcome: unfinished discovery windows keep their cursor and unread checks
  retain schedule/attempts/error without BC backoff. Complete responses started before expiry
  can still commit afterward. Adapter unit 27/27 and affected module 48/48 passed. Fresh affected
  workflow HTTP 31/31 across three suites passed with original timeouts, including cursor retry
  and final-response cases. The original overnight runner-hook stall remains unexplained; no
  fixture, timeout or clock-spy workaround was required. See scratch `deadline-resume-audit.md`.
  Fresh typecheck: same 22 baseline diagnostic headers, zero new. Lint: zero errors/13 existing
  warnings; ai:check passed; post-M1 production build passed, exit 0; diff whitespace check passed.
  Full-suite evidence from finalization remains recorded; those suites were not repeated for M1.
- **Handover to:** dispatcher for independent M1 review and integration re-review, then human gate.
- **Handover prompt:** Review the eight adapter/workflow/test files and the evidence in
  `fix-deadline-propagation.md` and `branch-notes.md`. Keep D1 discovery-failure coupling and the
  recorded live Azure/BC/Admin/poll checks for the gate. This is local implementation evidence;
  no deployed behavior or customer delivery is verified. No commits, tracker updates, pushes or
  deployments by this worker. Unrelated NIMBUS-179, root AGENTS.md normalization and scratch
  evidence were preserved.

## 2026-10-20 — Cross-task integration re-review approved

- **Updated by:** integration reviewer.
- **Outcome:** Re-reviewed M1 commit `a25c893` and its adapter/workflow boundaries after independent review. M1 is resolved: token/data/page/chunk dispatches honor the absolute deadline, incomplete discovery preserves its cursor, unread checks retain state, and complete requests begun before expiry may commit afterward. Recorded affected checks passed (adapter 27/27, module 48/48, fresh HTTP 31/31); fresh typecheck remains exactly the recorded 22 diagnostics, production backend/Admin build passed, lint has zero errors/13 warnings, and ai:check passed. Earlier full-suite results retain their documented baseline limits; no fresh baseline compiler/full-suite run is claimed. The overnight incomplete HTTP stall remains unexplained; the fresh original-timeout rerun passed. D2 is resolved by unchanged-content LF normalization. D1 is the sole new human design question; previously approved baseline policy and go-live owners/checkpoints remain in force. All after-deploy checklist text is preserved unchanged.
- **Handover to:** dispatcher, then human implementation gate.
- **Handover prompt:** Present D1 with the recommendation for independent tracked checks and a failure-aware summary; keep current behavior until the human decides. Retain all live Azure/BC/Admin/poll/alert checkpoints and evidence limits in the report. No source changes, test/build/lint runs, commit, tracker update, push or deployment by this reviewer; unrelated NIMBUS-179 and scratch evidence preserved.
