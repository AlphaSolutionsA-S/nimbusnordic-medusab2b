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

## 2026-10-24 — implementation-planner: concrete plan ready for review

- Outcome: wrote `plan.md`, `manifest.md` and `01-restrict-store-quote-fields.md`; one backend task covers the approved scope. No implementation code or branch change made.
- Verified actual Medusa 2.21.2 exact-path allowlist, silent stripping, sort validation and route-local relation-depth override from installed source. Runnable `field-filter-probe.cjs` passed malicious selection forms, retained safe selections, repeated/ten concurrent calls, sorting and depth checks; no HTTP/database result claimed.
- New implementation decisions: explicit customer/employee scalar leaves prevent parent wildcards, preserve valid sorting and existing draft-order state requests, local depth four preserves existing product expansion. Found current architecture docs describing quote wildcard exposure that must be updated.
- Architecture review complete using medusa-backend, medusa-api-route, secure-coding-owasp and Tier 0. Existing HTTP authentication baseline is a verification risk, not a reason to weaken controls.
- Next owner: Klaus Petersen, concrete plan approval; manifest remains not ready. The planner role explicitly requires approval before dispatch; approved scope predates this plan.
- Handover prompt: "Approve issues/NIMBUS-207/plan.md and implement NIMBUS-207." After approval record Jira plan event/child item, mark ready and dispatch under the existing implementation request where authorized.

## 2026-10-24 — implementation authorized

- Outcome: Klaus Petersen approved the concrete plan and dispatch ("approved, go"); the plan approval gate is resolved. Task 01 / NIMBUS-237 is in progress.
- Next owner: tdd-worker, then dispatcher for review and local commit.
- Handover prompt: "Implement task 01 using the approved projection and exact-path allowlist; record real-library and HTTP evidence separately."

## 2026-10-24 — tdd-worker: task 01 implemented

- Outcome: narrowed the shared store quote projection and installed Medusa exact-path allowlist, preserving existing safe quote/item selections and setting depth four locally. Added public-middleware regressions and HTTP privacy/compatibility contracts; updated current architecture documents and generated AI copies.
- Verification: 20/20 real-library middleware tests pass (20 failures before implementation); lint zero errors / 13 existing warnings with task-local Medusa config; backend tsc exactly matches the 22-diagnostic baseline; storefront tsc reports 58 diagnostics in untouched code. `ai:check` and `git diff --check` pass.
- HTTP result: both scoped suites were attempted but stopped in global setup because the allowed BC test URL is unavailable. No process/User-scope BC or database configuration was found. No HTTP/database delivery or deployed result is claimed; NIMBUS-236 login baseline remains unmeasured in this environment.
- Next owner: dispatcher for task review, consolidation and local commit. Required release check remains a controlled employee quote response and quote/conversation display.
- Handover prompt: "Review task 01 / NIMBUS-237 using its Done-when evidence. Preserve the HTTP environment blocker and run the scoped contracts when the established integration environment is available; do not weaken authentication or the BC guard."

## 2026-10-24 — tdd-worker: review fixture correction

- Outcome: corrected the quotes fixture after review found `productSeeder` ignores `data`. An explicit Admin product update now publishes the product, assigns its sales channel and checks both before creating the nonempty cart. No shared seeder or production behavior changed.
- Verification: affected HTTP scope re-attempted, same missing BC URL guard; lint zero errors / 13 existing warnings; backend tsc exact match to the 22-diagnostic baseline. `git diff --check` passes. Installed product update validator/route/default projection verified for the fixture's update and response assertions.
- Next owner: dispatcher/reviewer. HTTP verification remains dependent on the guarded integration environment; the source correction is not a delivered HTTP result.
- Handover prompt: "Re-review the explicit Admin fixture update and its assertions; preserve the recorded HTTP environment blocker."

## 2026-10-24 — tdd-worker: consolidation complete

- Outcome: checked the complete branch against the approved plan and task deviations. No material duplication, dead code or missing planned security path found; no implementation or test changes needed. Production additions are 28 lines (5 removed); test additions are 310 lines (4 removed), relative to merge-base `016ec41258802ef833109d25470e44924e6869b2`.
- Security coverage: owner-only access maps to "keeps another customer quote absent on list, retrieve, preview and mutations with expanded fields" and existing "denies foreign quote %s". Both-role company privacy, colleague exclusion and author privacy map to "bounds every response route for is_admin=%s with default and malicious fields". Widening/sort refusal map to the real-library "silently strips forbidden expansion %s" and "permits existing sorting and refuses sorting on forbidden data". Default projection and concurrent evaluation have dedicated real-library tests.
- Verification status: per-task 20 source middleware tests pass, lint zero errors / 13 existing warnings, backend tsc baseline unchanged at 22 diagnostics. Dispatcher reports final backend build passed, final tsc unchanged, and stable full units passed (71 suites / 880 tests; includes generated JavaScript duplicates, not 880 distinct source tests). Full module/HTTP runs remain blocked by the missing guarded integration configuration. HTTP/database delivery and the controlled after-deploy UI check remain unverified.
- Next owner: dispatcher for integration review and human gate before push.
- Handover prompt: "Complete integration review using the consolidation security-path mapping and existing environment limitations; no additional implementation changes are requested."

## 2026-10-24 — integration-reviewer: whole-branch source review approved

- Outcome: approved with no source or wiring changes requested; deviation-report.md records the finalization evidence and verification gaps.
- HTTP/database responses and deployed quote detail/conversation remain unverified; guarded integration environment is unavailable.
- Next owner: Klaus Petersen, implementation gate before final documentation/cleanup and any push.
- Handover prompt: Review issues/NIMBUS-207/deviation-report.md Open questions; decide whether to accept the HTTP verification gap or require the scoped integration suites first.


## 2026-10-24 - documentation-writer: documentation finalized

- Outcome: scope marked Implemented, current architecture documentation and extension guidance refreshed; no source/tests/config changed.
- Human accepted the HTTP/database verification gap and authorized push and merge to develop. Controlled response and display checks remain required after deployment.
- Next owner: dispatcher, PR description and cleanup before authorized push/merge.

## 2026-10-24 - cleanup: case records frozen

- Outcome: all cleanup gates passed; scope, plan and deviation report marked frozen. Removed manifest, task brief and branch notes; retained the field-filter probe as durable verification evidence.
- Next owner: dispatcher, commit final records and complete the authorized push/merge under required checks and branch protections.
- Handover prompt: "Commit NIMBUS-207 cleanup; preserve the accepted HTTP/database gap and controlled after-deploy verification."

