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
