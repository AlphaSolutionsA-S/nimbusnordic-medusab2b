# Create Medusa module for Business Central connectivity and migrate bc-utility

- **Date:** 2026-07-15
- **Type:** Story
- **Tracker:** JIRA — https://alphasolutionsdk.atlassian.net/browse/NIMBUS-153
- **Priority:** Medium
- **Project Folder:** issues/NIMBUS-153/
- **Updated by:** feature skill
- **Outcome:** Feature captured; scoping is the next stage.
- **Handover to:** scoper agent
- **Handover prompt:** Determine detailed scope for NIMBUS-153 and create `issues/NIMBUS-153/SCOPE.md` covering objectives, constraints, acceptance criteria refinement, dependencies, risks, and affected apps for the Business Central connectivity module migration from bc-utility.

## 2026-07-16 — Implementation completed

- **Updated by:** implementor agent
- **Outcome:** All 5 tasks completed.
  - Created `apps/backend/src/modules/business-central/` (types.ts, service.ts, index.ts) — all utility logic migrated into `BusinessCentralModuleService` private methods.
  - Registered `businessCentral` module in `apps/backend/medusa-config.ts`.
  - Updated `apps/backend/src/api/store/business-central/operations/route.ts` to resolve service via DI (`req.scope.resolve`).
  - Deleted `apps/backend/src/utils/business-central-client.ts` — zero remaining imports confirmed.
  - TypeScript check: zero errors in changed files (4 pre-existing unrelated errors in `quotes` admin UI and integration tests).
  - Lint: zero new warnings (11 pre-existing warnings in unrelated workflow/migration files).
- **Handover to:** developer (manual smoke test required)
- **Handover prompt:** NIMBUS-153 implementation is complete. Manual verification still needed: start the backend (`pnpm backend:dev`) and confirm it boots without DI errors, then call `GET /store/business-central/operations` with valid BC credentials and confirm response shape is unchanged. Once verified, transition issue to Done following the closing comment workflow (§ E in jira-workflow skill).

- **Updated by:** codex (scoping)
- **Outcome:** Created `issues/NIMBUS-153/SCOPE.md` with implementation-ready scope covering objective, in/out of scope, acceptance criteria refinement, affected backend/storefront surfaces, dependencies, risks, rollout/verification, and open questions.
- **Handover to:** implementation-planner agent
- **Handover prompt:** Using `issues/NIMBUS-153/SCOPE.md` and `issues/NIMBUS-153/FEATURE.md`, produce `issues/NIMBUS-153/manifest.md` and task implementation files for migrating `apps/backend/src/utils/business-central-client.ts` into a dedicated Medusa module (`apps/backend/src/modules/business-central`), wiring module registration in `apps/backend/medusa-config.ts`, updating `/store/business-central/operations` consumer integration, preserving route contract/behavior parity, and defining concrete verification tasks (build + connectivity smoke checks).

## 2026-07-15 — Implementation plan ready

- **Date:** 2026-07-15
- **Updated by:** implementation-planner agent
- **Outcome:** Implementation plan is ready; implementation is the next stage. Created manifest.md with 5 ordered tasks, task implementation files (01–05), and PLAN.md.
- **Handover to:** implementor agent
- **Handover prompt:** Implement NIMBUS-153 using the manifest and task files in `issues/NIMBUS-153/`. Execute tasks 01 through 05 in order: (1) create the Business Central module at `apps/backend/src/modules/business-central/` with index.ts, service.ts, and types.ts — migrating all logic from `apps/backend/src/utils/business-central-client.ts` into the service class; (2) wire the module in `apps/backend/medusa-config.ts`; (3) update `apps/backend/src/api/store/business-central/operations/route.ts` to resolve the service from DI; (4) delete the old utility file; (5) verify build passes with `pnpm build`. Branch from `develop` as `feature/NIMBUS-153`.
