# Admin translation editor for storefront UI text

- **Date:** 2026-09-30
- **Type:** Story
- **Tracker:** JIRA — https://alphasolutionsdk.atlassian.net/browse/NIMBUS-175
- **Priority:** Medium
- **Project Folder:** issues/NIMBUS-175/
- **Updated by:** feature skill
- **Outcome:** Feature captured; scoping is the next stage.
- **Handover to:** scoper agent
- **Handover prompt:** Scope NIMBUS-175 (Admin translation editor for storefront UI text). Read `issues/NIMBUS-175/FEATURE.md` and the reference screenshot in `issues/NIMBUS-175/mockups/`. Study the current next-intl setup (`apps/storefront/messages/*.json`, `apps/storefront/src/i18n/request.ts`, `apps/storefront/src/lib/i18n/`) and existing admin customizations and custom modules in `apps/backend/src/`. Resolve the open questions with the user — above all whether the storefront reads translations from the DB at runtime or the DB is only an editing workspace whose export is committed back to the repo — plus import merge-vs-replace, how "diff towards file" gets the shipped file contents, label derivation, placeholder validation, and audit/role needs. Evaluate the proposed data model (one row per locale holding the full JSON). Write `issues/NIMBUS-175/SCOPE.md` and append a PROGRESS.md entry handing over to the implementation-planner.

- **Date:** 2026-09-30
- **Updated by:** scoper agent
- **Outcome:** Scope drafted in `SCOPE.md` from the user's answers (relayed by the coordinating agent). The data model is decided: one DB row per locale holding the full JSON. The scope is **awaiting the user's explicit approval (Step 5)**. Open questions Q1–Q7 remain; Q1 (admin roles: none exist today) and Q2 (behaviour with no file fallback) should be answered before or during planning.
- **Handover to:** user (approve scope / answer Q1–Q7), then implementation-planner agent
- **Handover prompt:** Plan the implementation of NIMBUS-175 from the approved `issues/NIMBUS-175/SCOPE.md` (also read `FEATURE.md` and `mockups/shopify-theme-content-reference.png` in the same folder). Load the building-with-medusa, building-admin-dashboard-customizations and building-storefronts skills. Respect decisions D1–D9 exactly:
  - the storefront reads UI text only from the Medusa DB via a store API route, with no fallback to `messages/*.json`;
  - one row per locale holding the full nested JSON, with a version column for the stale-save rejection;
  - import is upload → diff preview (added/changed/removed) → merge or replace;
  - "new texts from code" is detected by comparing an uploaded JSON file with the stored row;
  - ICU placeholder mismatches against English warn but do not block the save;
  - no audit trail or history;
  - seeding is manual import per environment.

  Design:
  - the custom module and schema migration;
  - admin and store routes plus workflows;
  - the admin "Translations" page (tabs from top-level namespaces, groups and labels derived from the key path, search, compare languages, import/export);
  - storefront loading in `src/i18n/request.ts`, `[countryCode]/layout.tsx` and root `not-found.tsx`, with per-locale cache tags and revalidation;
  - updates to the tests that currently read `messages/*.json`.

  Carry open questions Q1–Q7 forward and do not decide them silently. Q1 is admin role restriction (Medusa RBAC is behind `MEDUSA_FF_RBAC` and disabled; the existing "admin role" is for company employees only). Q2 is missing-row or unreachable-backend behaviour. Q3 is revalidation latency and mechanism. Q4 is whether to keep or delete `messages/*.json`. Include the rollout order: deploy backend → import 8 locales → deploy storefront. The scoping document already exists; update it rather than creating a new one if the scope needs refinement.

- **Date:** 2026-09-30
- **Updated by:** scoper agent
- **Outcome:** Q1–Q4 resolved by the user and recorded in `SCOPE.md` as decisions D10–D13:
  - any logged-in admin can edit;
  - last cached copy, then raw keys;
  - revalidation on save plus a timed backup;
  - `messages/*.json` kept as dev/import material.

  Q5–Q7 remain open with recommended defaults. The scope is **still awaiting the user's explicit approval (Step 5)**.
- **Handover to:** user (approve scope / confirm Q5–Q7 defaults), then implementation-planner agent
- **Handover prompt:** As in the previous entry, plus decisions D10–D13 in `SCOPE.md`; the open questions are now only Q5–Q7.

- **Date:** 2026-09-30
- **Updated by:** coordinating agent
- **Outcome:** User answered Q5–Q7 (labels derived from key path, values-only editing; compare-with-file reuses the import preview; replace imports that remove keys highlight them and need explicit confirmation). Recorded in `SCOPE.md`; no open questions remain. The user is reviewing `SCOPE.md` before approving.
- **Handover to:** user (approve scope), then implementation-planner agent
- **Handover prompt:** As in the scoper entry above, with decisions D1–D13 and the resolved Q5–Q7 in `SCOPE.md`.

- **Date:** 2026-09-30
- **Updated by:** coordinating agent
- **Outcome:** Scope extended at the user's request: missing-key logging and reporting to a "Missing keys" admin list (D14, server and client, D15); adding a new language in the admin, as a copy or import, inactive until activated (D16/D17); country mapping stays in code, with NIMBUS-176 logged as the follow-up enhancement to move it to the DB. `SCOPE.md`, `FEATURE.md` and the Jira acceptance criteria updated to match. Scope still awaits the user's approval.
- **Handover to:** user (approve scope), then implementation-planner agent
- **Handover prompt:** As in the scoper entry above, with decisions D1–D17 in `SCOPE.md`.

- **Date:** 2026-09-30
- **Updated by:** implementation-planner (foreground)
- **Outcome:** At the user's request to "plan 175", inspected develop at `cdbc75a`,
  the scope/mockup, runtime i18n paths, installed SDK/cache behavior, and backend/Admin
  conventions. Created `PLAN.md`, `CONTRACTS.md`, eight implementation task files,
  and `manifest.md`. No application code, branch, deployment, or database changes.
  Jira was unassigned and has been assigned to Klaus Petersen under the Jira
  workflow; status remains Scoping and Customer Portal was already present.
  Both apps have test infrastructure; the plan adds a dedicated Admin TSX/jsdom
  configuration. No tests were run as evidence of implementing this feature.
- **Review points:** Approve the concrete plan, including the 300-second refresh,
  warm-process last-good snapshot/cold-start raw-key limitation, explicit inactive
  cache state, import confirmation/version contract, and bounded missing-key
  reporting. Scope approval was not recorded in the preceding entries and has
  not been silently inferred from the request to draft the plan.
- **Handover to:** user for plan/scope review; then implementor after approval.
- **Handover prompt:** Review `issues/NIMBUS-175/PLAN.md` and `CONTRACTS.md` against
  the decisions in `SCOPE.md`. After explicit approval, record it here and set
  `manifest.md` to `Ready for Dispatch: true`. Implement NIMBUS-175 on
  `feature/NIMBUS-175` from `develop`, following the eight dependency-ordered task
  files. Preserve database-only runtime messages, atomic stale-save rejection,
  manual per-environment imports, inactive new languages, server/client missing-key
  reporting, and country mapping in code. Capture a fresh validation baseline and
  execute Task 08's production-mode cache/concurrency checks. Do not dispatch while
  the manifest remains false.

- **Date:** 2026-09-30
- **Updated by:** implementation-planner (foreground)
- **Outcome:** Completed the plan review pass: specified leaf-only flattening and
  immutable leaf updates to preserve empty JSON groups; added a readiness panel for
  the original eight imports; clarified cache/snapshot fallback for absent rows and
  network failures. Updated contracts and verification cases consistently. Markdown
  diff check is clean. No application tests were run because this change only drafts
  implementation work.
- **Handover to:** user for scope and plan approval.
- **Handover prompt:** Review `PLAN.md`, especially the cache/fallback limits and
  reporting caps. Confirm the scope and plan explicitly before dispatch; keep
  `manifest.md` false until approval, then implement via the eight tasks.

- **Date:** 2026-09-30
- **Updated by:** coordinating agent (jira-workflow)
- **Outcome:** User explicitly approved `SCOPE.md` and `PLAN.md` as written ("Approve and
  implement"). `manifest.md` set to `Ready for Dispatch: true`. Jira assigned to Klaus
  Petersen with component Customer Portal; status moved from Scoping to Estimation via "Scope approved" (no In Progress
  transition is available from Scoping).
- **Handover to:** implementor agent
- **Handover prompt:** Implement NIMBUS-175 on `feature/NIMBUS-175` from `develop`, following
  `manifest.md` and the eight dependency-ordered task files, `PLAN.md` and `CONTRACTS.md`.
