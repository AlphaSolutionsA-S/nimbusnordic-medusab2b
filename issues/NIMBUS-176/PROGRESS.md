# Manage country-to-language mapping from Medusa Admin

- **Date:** 2026-09-30
- **Type:** Story
- **Tracker:** JIRA — https://alphasolutionsdk.atlassian.net/browse/NIMBUS-176
- **Priority:** Low
- **Project Folder:** issues/NIMBUS-176/
- **Updated by:** feature skill
- **Outcome:** Enhancement captured as a follow-up to NIMBUS-175 (decision D16); scoping is the next stage, after NIMBUS-175 is planned.
- **Handover to:** scoper agent
- **Handover prompt:** Scope NIMBUS-176 (Manage country-to-language mapping from Medusa Admin). Read `issues/NIMBUS-176/FEATURE.md` and `issues/NIMBUS-175/SCOPE.md` (D16/D17: languages are DB rows with an active flag; the country map is currently hardcoded in `apps/storefront/src/lib/i18n/country-language-map.ts`). Study the storefront middleware and locale resolution, and how Medusa regions/countries are modelled. Resolve the open questions with the user, write `issues/NIMBUS-176/SCOPE.md`, and append a PROGRESS.md handover to the implementation-planner.

## 2026-10-20 — Scope draft prepared

- **Updated by:** scoper agent
- **Outcome:** Created SCOPE.md from Jira/intake and light code exploration. Full pipeline retained: backend persistence, Admin and storefront contract. Draft identifies static language gates, deactivation gap, formatting and alternate-link consumers. No rules approved; no implementation, commit or Jira transition performed.
- **Next owner:** User and scoper
- **Handover prompt:** Review issues/NIMBUS-176/SCOPE.md and resolve Q1–Q4 (configured countries/default, deactivation, visibility/outages, formatting). Revise the draft in place, then request scope approval. Record the scope-approved event only after approval; obtain a separate instruction before implementation-planner handoff.

## 2026-10-20 — Scope approved and recorded

- **Updated by:** scoper agent
- **Outcome:** Klaus Petersen approved the scope, business rules and draft data model ("all good"), including retaining removed-country assignments for reuse subject to active-language validation. Revised SCOPE.md in place; no unresolved scope-review business questions remain.
- **Tracker:** Added scope-approved comment 254657, then used valid transition 611 (Scope approved). A separate Jira readback confirmed status Estimation and the saved comment; Customer Portal component remains present.
- **Next owner:** User; implementation-planner only after separate authorization
- **Handover prompt:** Scope is finalized. Should I hand off to implementation-planner now, or stop here so you can review first? Do not begin planning from scope approval alone. On explicit handoff, read SCOPE.md, complete its technical data/security unknowns and resolve retained-assignment lifecycle details against the active-language rule.
- **Verification:** Read back the finalized scope and Jira state/comment. No code changes, tests, planning, commits, pushes or deployment performed.

## 2026-10-20 — Implementation plan drafted after explicit handoff

- **Updated by:** implementation-planner
- **Outcome:** User separately authorized planning ("yes"). Read the approved scope and current handover, used the required exploration subagent, and produced PLAN.md, manifest.md and five task files covering persistence/integrity, contracts/bootstrap, Admin, runtime resolution, and formatting/SEO/verification.
- **New decisions:** Existing translation module owns a versioned singleton map; transaction serialization protects mapping/deactivation; one server request publication replaces duplicate middleware/server locale decisions; 240-second blocking refresh with bounded retry and process-lifetime outage snapshot. Retained-entry reassignment requires a human answer.
- **Evidence:** Inspected installed auth/session and transaction-decorator source, current implementation/tests and affected docs. The narrow Region Query projection has not been executed against real local/test data; PLAN.md marks this UNVERIFIED and blocks dispatch until the read-only probe is recorded. Tests have not been run and no feature has been implemented.
- **Tracker:** Existing scope-approved state is Estimation. No plan-approved event, children, transition or description rewrite made; those wait for actual plan approval.
- **Next owner:** User and implementation-planner for plan review and the explicit evidence gate.
- **Handover prompt:** Review PLAN.md's Critical decisions/gates and High data/state/security/decision sections; approve or revise the retained-entry behavior and five-task decomposition. Complete the Region Query read-only evidence gate before marking Ready for Dispatch. Only after plan approval record Jira task keys and the plan-approved event; obtain a separate explicit instruction before task-dispatcher handoff.
- **Verification:** Planning artifacts only. No app code, migration, branch, commit, push or deployment changed; manifest remains Ready for Dispatch false.

## 2026-10-20 — Plan approval recorded; technical readiness gate remains

- **Updated by:** implementation-planner
- **Outcome:** Klaus Petersen approved the implementation plan and retained-entry rule. Updated PLAN.md to approved, clarified SCOPE.md B5 and requirement 2, and removed provisional retained-entry wording from the Admin task. Existing retained entries remain editable; creation for unconfigured countries remains forbidden.
- **Tracker:** Added agreed-rule clarification comment 254664 and plan-approved comment 254665. Created five Sub-tasks under NIMBUS-176: 01 → NIMBUS-194, 02 → NIMBUS-195, 03 → NIMBUS-196, 04 → NIMBUS-197, 05 → NIMBUS-198. Recorded keys in manifest.md.
- **Readback:** A separate Jira read confirmed both comments, all five parent relationships, all five Sub-task types and Customer Portal components. Parent remains Estimation; children are in the workflow's initial Scoping state. No implementation state transition was made.
- **Evidence gate:** Still UNVERIFIED: real-data Region Query projection. Bounded runtime checks found no Node on shell PATH; a running-process fnm Node path could not be executed by the shell; the connected Node REPL disallows process imports. No database connection, Query probe, application startup or data mutation occurred; no secrets were printed.
- **Readiness:** Ready for Dispatch remains false until the local/test Region Query probe succeeds and evidence is recorded. Human plan approval is recorded; no further business questions remain.
- **Next owner:** Implementation-planner to complete the read-only framework evidence check when a usable project runtime is available; user controls the subsequent separate task-dispatcher handoff.
- **Handover prompt:** Resolve the Region Query evidence gate in PLAN.md using the existing local/test Medusa container, update readiness only when verified, then ask for a separate explicit dispatcher handoff. Do not treat plan approval as permission to start implementation.
- **Verification:** Planning records and tracker readbacks only. No app code, migrations, git branches, commits, pushes, deployment or tests changed or run.

## 2026-10-20 — Region Query evidence verified; ready for handoff

- **Updated by:** Codex, completing the planner evidence gate
- **Outcome:** Klaus ran the prepared read-only Medusa exec probe and supplied PASS output. The projection returned one region with nine countries (de, dk, es, fr, gb, it, no, pl, se); runtime assertions verified string IDs/codes and array relations. Unknown-region filtering returned an empty array. The script performed zero mutations.
- **Evidence:** Preserved user-supplied output and execution command in samples/region-query-verification.json; probe at apps/backend/scripts/verify-region-query.ts. The agent did not independently rerun it.
- **Limits:** Country removal/re-addition was not exercised. That new assignment lifecycle remains required implementation integration coverage; this check verifies the existing Query projection and missing-region behavior only. No implemented-feature or deployed-result claim is made.
- **Readiness:** Updated PLAN.md evidence and manifest.md to Ready for Dispatch true. No business decisions changed; the already approved plan and five Jira tasks remain the agreed work.
- **Next owner:** User for separate dispatcher handoff authorization, then task-dispatcher.
- **Handover prompt:** Planning evidence gate is closed. On explicit authorization, hand issues/NIMBUS-176/manifest.md to task-dispatcher. Do not treat the verification output as implementation authorization.
