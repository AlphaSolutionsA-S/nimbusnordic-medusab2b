# Deviation report: Return shipment notices to API customers

Reviewed 2026-10-20 against approved scope/plan and merge-base `1b6e33ab5de42272f71dbd6cd10cc4df8e1e5af7`, through consolidation `d21d9cc` and reviewed M1 fix `a25c893`. Verdict: **REVIEW APPROVED** for mechanical integration; D1 remains the sole new human design question before push. Baseline acceptance and go-live owners/checkpoints were already approved and remain in force. This reviewer inspected source and recorded evidence without running tests, lint or build.

## Deviations from scope and plan

- Contract: explicit nullable fields, strict objects, non-negative quantities, positive revisions, UTC recorded times, decimal cursors and separate success/error JSON Schemas. Acceptable contract clarifications; schemas/examples/XSD and response mapping agree.
- Storage: missing poll/tracking state refuses the store; conflict compares revision before hash; unchanged/conflict schedules are applied by the check caller; reopen times come from the database. Acceptable and covered by real Postgres tests. Migration and snapshot are recorded generator output; no hand-written migration finding.
- BC outcome: the line map follows creation of a BC order, including an all-lines-rejected order with an empty map. This differs from the plan's blanket failed-attempt preservation wording, but preserves the essential invariant that the current BC number and map belong together. Acceptable.
- Adapter: empty BC dates become null; foreign-origin nextLink is refused; missing expiry disables token caching; duplicate shipment numbers are removed. Acceptable. M1 is resolved: the absolute run deadline reaches token, data, nextLink and by-number chunk dispatches. Expiry returns normal incomplete work without advancing incomplete-window cursors or failing unread checks. A complete final response started before expiry may commit afterward.
- Decision rules: current BC number is authoritative even after a failed resend; hashes use sorted positive-net lines; already-corrected originals are skipped when pairing another undo; missing previously listed lines are unpairable. Acceptable and consistent with the approved detailed flows.
- Discovery/check loops live inside L3 steps; pure matching, netting and scheduling remain in their single L5 homes. BC names/addresses stay inside the check step rather than workflow results. Idempotent discovery/cursor writes and customer-visible notice writes have no compensation. Acceptable.
- Per-batch ordinary BC check failures use a safe bc_error code and row backoff; throttling leaves unread rows due and sets shared backoff. Checked includes completed failed/superseded rows; backlog is measured afterward. Acceptable operational clarifications.
- Poll job is disabled in test apps using the installed file-loader primitive; real scheduling remains an after-deploy check. Incomplete/throttled discovery skips checks; ordinary discovery errors reject the run and skip its normal summary. The latter needs the D1 decision.
- GET and POST share generic company resolution; duplicate checks were renamed to reflect their remaining responsibility. No duplicate resolver or stale consumer was found.
- Gateway adds required SAS sp/sv, normalizes gateway/platform error variants, removes unsupported XML control characters and reuses existing app parameters. Offline rendering is verified; actual Azure acceptance/forwarding remains unverified. ISO-looking free text may be normalized by JObject.Parse, as recorded in task 10; retain this documented edge at the gate.
- Admin retry records the authenticated actor: user id for bearer/session, API key id for secret-key authentication. Acceptable with the required default Admin authentication; a real HTTP case verifies the distinction.
- D2 is resolved by routine LF normalization of generated AGENTS.md with unchanged content (32,426 bytes). Recorded post-M1 ai:check passed. No approval is needed for this normalization; no rule content or architecture boundary was changed.

## Consolidation changes

Documentation-only consolidation recorded evidence and security coverage. Shared company resolution, state constants, schedules and backoff were reused; no source simplification or duplicate-unit removal was justified. No new module registration, dependency, storefront contract or cross-app caller change is needed. Existing orderIngestion registration picks up the new models. Before this re-review, git status contained the untracked prior deviation report, run evidence in .tmp/ and unrelated issues/NIMBUS-179/; preserve the unrelated files.

## Findings

- **M1 — Resolved, mechanical:** `a25c893` passes the absolute deadline from both workflow callers through all three shipment service methods to the token and data dispatch checks. Every nextLink and by-number chunk uses that data check. Deadline guards sit outside the generic request-error catches, so `ShipmentReadDeadlineError` reaches callers as a normal incomplete result. Discovery writes its cursor only after a complete window; check expiry breaks without updating unread rows, attempts, errors or BC backoff. A final request started before expiry may finish and complete work may commit afterward. Independent M1 review approved these boundaries; focused adapter and real-DB workflow tests cover the seam, including successful retry. No new mechanical blocker identified.
- **D1 — High, design decision: persistent discovery failures can starve checks and hide stall warnings.** `workflows/shipment-notice/steps/scan-shipment-windows.ts:196` rethrows non-throttling failure; `workflows/shipment-notice/workflows/poll-shipment-notices.ts:28` then never reaches checks or summary, and `jobs/poll-shipment-notices.ts:52` emits only the safe failure line. A discovery-only failure can indefinitely postpone already-tracked revisions and Admin retries while suppressing lead/backlog warnings. This is the explicitly recorded task 08 open point; the plan promises separated checks, a final check and stalled-progress monitoring. Decide at the gate whether to accept this coupling with an alert on the failure line, or require independent checks and a failure-aware summary. Do not treat the existing tests as proving recovery from a persistent discovery-only error.
- **D2 — Resolved, tooling:** generated AGENTS.md was normalized to LF with unchanged content (32,426 bytes); post-M1 ai:check passed. Routine normalization needs no new human decision.

## Tests

Evidence is from completed dispatcher/worker runs under `.tmp/NIMBUS-130-20261019-resume/`; this review did not rerun them. Full-suite figures below are the earlier finalization evidence, not post-M1 full-suite runs. Affected M1 checks were rerun as recorded separately below. The previously approved baseline policy remains in force, with these limits.

| Check | Recorded result and limit |
|---|---|
| Backend unit | 389/389 passed. |
| Admin RTL | 41/41 passed; recovery task contributes four behavior cases. |
| Module suite | 369 passed, two failed: source/generated duplicates of the documented BC listOrders round-trip guardrail failure. |
| Full HTTP with corrected startup JWT configuration | 15/18 suites passed, 181 passed/31 failed. Twenty-three companies cases failed during one startup hook; unchanged focused rerun passed 23/23. Remaining eight quote failures match the documented unpublished-product fixture/cartSeeder 400, and causal fixture/route code equals merge-base. No fresh merge-base suite execution was performed. |
| Initial HTTP run | Interrupted due pre-existing JWT/config startup-load ordering; incomplete evidence. Corrected run sets the synthetic JWT value before Jest config loads. |
| Typecheck | 22 diagnostics. Every failing line plus the following eight lines occurs verbatim at merge-base; owning company module/types, affected helpers, environment config, manifests, tsconfig and lockfile are unchanged. This supports pre-epic causes; no fresh merge-base compiler run was performed. No suppression. |
| Build/lint | Backend/Admin build exit 0; lint zero errors, 13 existing warnings. |
| Gateway artifacts | 69 expression/render/XSD checks plus 29 workflow/token-parity/URL-encoding checks passed offline; no Azure delivery proof. |
| Post-M1 affected checks | Adapter 27/27; affected module 48/48; fresh workflow HTTP 31/31 across three suites with original timeouts and unchanged fixtures. Covers token renewal, nextLink/chunk expiry, incomplete-window cursor preservation and retry, unread checks, and final pre-expiry requests completing afterward. |
| Post-M1 typecheck | Same 22 diagnostic headers, zero differences against the recorded baseline in path/position/TS-code/primary message (normalizing only the apps/backend path prefix). No fresh merge-base compiler run or full-suite rerun. |
| Post-M1 build/lint/ai | Production backend/Admin build passed; lint zero errors/13 existing warnings; ai:check passed after unchanged-content LF normalization of AGENTS.md. |
| Overnight M1 HTTP attempt | Incomplete runner-hook timeout/stall with no final summary; cause remains unexplained. Fresh scoped run above passed without timeout, fixture or clock-spy workaround. The incomplete attempt is not passing evidence. |
| Scoped Admin recovery | HTTP 6, security credential matrix 3 (six denied requests), Admin RTL 4 passed. |

Security matrix review: secret-key-only GET and foreign-company isolation have negative HTTP cases; strict parameters and generic GET/POST unknown-customer errors are tested. Discovery tests cover company/external/current-BC-number association. Error/log tests forbid receiver names/addresses. Default Admin authentication denies absent/customer/publishable credentials, listing selects only safe fields, and atomic reopen/state guard/audit identity and renewed three-day retry window have real HTTP coverage. Gateway token denial and query injection are checked offline and remain mandatory live tests. Logic App history exposure and order-length retention/no deletion remain the approved plan decisions; no new deletion mechanism was added.

Branch backend TS/TSX counts: tests +4,484/-39; fixtures/helpers +266/-0; source including generated migration +3,540/-90. There is no target ratio. Coverage follows rules, concurrency, failures and trust boundaries; generated .medusa copies cause duplicate executions, not duplicate source suites. No redundant mocking seam or duplicate production implementation was identified. M1 closes the identified inter-task deadline coverage gap; D1 recovery from persistent discovery-only failure remains unproved by the existing tests.

No separate architecture-check command is configured in ai/AGENTS.md; layer/boundary review is manual and Medusa lint evidence is recorded above. No missing import/public export, circular dependency, blanket unknown cast, source dependency on generated files, duplicate route/page or stale Also update consumer requiring a further mechanical finding was identified.

## Open questions

1. **D1 — sole new human design question:** accept ordinary discovery failures skipping tracked checks and the normal summary, with an alert on the safe failure line, or require independent checks (subject to the shared deadline and throttling) and a failure-aware summary? **Recommendation:** independent checks and a summary exposing discovery failure. Existing behavior stays in place until the human decides. This is a design decision at the implementation gate, not an unresolved mechanical wiring fix.

Previously approved decisions remain in force: accept the documented unrelated module/quote/typecheck baseline evidence with its limits; retain the agreed go-live owners and checkpoints below. These are not reopened for approval. Customer go-live still requires recorded Azure operation/workflow acceptance and token/query/XML manual calls; production shipment matching and Metz DocumentNo; TestDK API submission, line map, posting and undo; deployed Admin retry and minute polling; and Medusa Cloud stalled/failure alerts. Late-visibility measurement remains the accepted post-go-live follow-up. The documented gateway ISO-looking free-text normalization edge remains visible above.

## Verify after deploy

Copied in full from task files so cleanup can remove those files without losing the checks. No deployment or real customer delivery was verified in this run.

### 01: Shipment notice contract

No standalone Verify after deploy line in this task; its contract/pure adapter or decision behavior is covered by the downstream checks below.

### 02: Shipment notice storage

**Verify after deploy:** table `shipment_notice_state` has no row until the job's first run.

### 03: Keep the BC line numbers at submission

**Verify after deploy:** `metadata.business_central_integration.bc_lines` on the next API order sent
to BC (a Metz test order), with one entry per accepted line and non-null `bc_sequence`.

### 04: Business Central shipment reads

No standalone Verify after deploy line in this task; its contract/pure adapter or decision behavior is covered by the downstream checks below.

### 05: Shipment notice decision and schedule

No standalone Verify after deploy line in this task; its contract/pure adapter or decision behavior is covered by the downstream checks below.

### 06: Discovery scan

**Verify after deploy:** `shipment_notice_state.lead_cursor` follows the clock with a lag of about 15
minutes.

### 07: Shipment checks

**Verify after deploy:** after the TestDK end-to-end shipment, one `shipment_notice` row for that
order with `status` `shipped` and its `shipment_tracking` row open.

### 08: Polling job

**Verify after deploy:** one summary log line per minute in Medusa Cloud runtime logs, with lag under
20 minutes.

### 09: GET /orderapi/shipment-notices

**Verify after deploy:** a `GET` through the Logic App for Metz's customer number returns 200 with the
TestDK end-to-end notice.

### 10: APIM GET operation and Logic App workflow

**Verify after deploy:** the manual test calls against the deployed APIM return the expected statuses
and XML bodies with roots `shipment_notice_response` and `error_response`.

### 11: Admin recovery for shipments that gave up

**Verify after deploy:** in Admin, "Shipment tracking" lists `gave_up` rows. After "Retry" on one, the
`shipment_tracking` row's `state` = `open` and `reopened_by` is set, and the next run's summary counts
it as checked.

### 12: One company-resolution step with a generic 404 (fixes NIMBUS-192)

**Verify after deploy:** `POST /orderapi/orders?customerNumber=<unknown>` through the Logic App
returns 404 with `message` "Customer not found", and the Medusa runtime log has the warn line.
