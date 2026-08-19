# Make BC customer number read-only in storefront

- **Date:** 2026-08-19
- **Type:** Story
- **Tracker:** JIRA — https://alphasolutionsdk.atlassian.net/browse/NIMBUS-155
- **Priority:** Not set
- **Project Folder:** issues/NIMBUS-155/
- **Updated by:** feature skill
- **Outcome:** Feature captured; scoping is the next stage.
- **Handover to:** scoper agent
- **Handover prompt:** Determine detailed scope for NIMBUS-155 and create `issues/NIMBUS-155/SCOPE.md` covering the storefront company-profile field behavior, authorization and API-update implications, regression coverage, and the constraint that Admin retains edit access to the Business Central customer number.

## 2026-08-19 — Scope completed

- **Updated by:** scoper agent
- **Outcome:** Created `issues/NIMBUS-155/SCOPE.md`. The scope requires both a non-editable storefront presentation and Store API rejection of attempted BC customer-number updates. Admin edit access is explicitly excluded from changes.
- **Handover to:** implementation-planner agent
- **Handover prompt:** Using `issues/NIMBUS-155/FEATURE.md` and `issues/NIMBUS-155/SCOPE.md`, create `issues/NIMBUS-155/PLAN.md`, `manifest.md`, and dependency-ordered implementation task files. Plan storefront UI/update-payload changes, Store validator and integration-test coverage, and verification. Do not modify Admin company surfaces or Business Central integration behavior.

## 2026-08-19 — Implementation plan ready

- **Updated by:** implementation-planner agent
- **Outcome:** Created `PLAN.md`, `manifest.md`, and task files 01 (storefront), 02 (backend), 03 (verification). Per requester adjustment, the BC customer number is locked on **both** Store create and update boundaries (set/adjusted only in Admin). Work is done directly on `develop` (small fix — no feature branch). Admin surfaces and the Business Central integration are unchanged.
- **Handover to:** implementor agent
- **Handover prompt:** Implement `issues/NIMBUS-155/` tasks in order: 01 (storefront read-only BC card, exclude field from update payload, remove field from `StoreCreateCompany` write type, add component test), 02 (remove `business_central_customer_number` from Store `StoreCreateCompany` and `StoreUpdateCompany` validators so `.strict()` rejects it at `POST /store/companies` and `POST /store/companies/:id`; rewrite TC-1/TC-3, remove TC-3a, keep TC-2/TC-4/TC-5), then 03 (verification). Commit directly on `develop`. Do not modify any Admin company files or the Business Central module.
