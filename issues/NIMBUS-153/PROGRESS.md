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

## 2026-07-15 — Scoping completed

- **Updated by:** codex (scoping)
- **Outcome:** Created `issues/NIMBUS-153/SCOPE.md` with implementation-ready scope covering objective, in/out of scope, acceptance criteria refinement, affected backend/storefront surfaces, dependencies, risks, rollout/verification, and open questions.
- **Handover to:** implementation-planner agent
- **Handover prompt:** Using `issues/NIMBUS-153/SCOPE.md` and `issues/NIMBUS-153/FEATURE.md`, produce `issues/NIMBUS-153/manifest.md` and task implementation files for migrating `apps/backend/src/utils/business-central-client.ts` into a dedicated Medusa module (`apps/backend/src/modules/business-central`), wiring module registration in `apps/backend/medusa-config.ts`, updating `/store/business-central/operations` consumer integration, preserving route contract/behavior parity, and defining concrete verification tasks (build + connectivity smoke checks).
