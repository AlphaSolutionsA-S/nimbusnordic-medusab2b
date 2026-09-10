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

## 2026-08-19 - Implementation validation blocked

- **Updated by:** implementor agent
- **Outcome:** Completed Task 01 and implemented Task 02. Storefront changes make the BC customer number display-only, omit it from update state and write types, and add regression coverage. Store validators now reject the BC field on create and update; integration cases now expect 400, retain normal no-field coverage, and verify rejected updates leave the null value unchanged. No Admin or Business Central module files were modified.
- **Files changed:** `apps/storefront/src/modules/account/components/company-card/index.tsx`, `apps/storefront/src/types/company/http.ts`, `apps/storefront/src/__tests__/modules/account/components/company-card-bc-readonly.test.tsx`, `apps/backend/src/api/store/companies/validators.ts`, `apps/backend/integration-tests/http/companies/companies.spec.ts`, and NIMBUS-155 task records.
- **Validation:** `cd apps/storefront && pnpm test` passed (9 suites, 32 tests); `pnpm lint` passed with existing unrelated warnings; `pnpm build` passed across all workspaces. The Windows-compatible backend integration invocation reached Jest but all cases failed during database initialization with `SASL: SCRAM-SERVER-FIRST-MESSAGE: client password must be a string`. The package script `pnpm test:integration:http` also cannot run unchanged on Windows because its POSIX inline environment assignments are not recognized.
- **Handover to:** implementor agent after backend test environment configuration
- **Handover prompt:** Configure the backend integration-test PostgreSQL credentials so `DATABASE_URL` includes a usable password, then run `cd apps/backend && $env:TEST_TYPE = 'integration:http'; $env:NODE_OPTIONS = '--experimental-vm-modules'; pnpm exec jest integration-tests/http/companies/companies.spec.ts --silent=false --runInBand --forceExit`. When it passes, mark Tasks 02 and 03 complete and transition NIMBUS-155 to Internal Review.

## 2026-08-21 - Implementation completed and moved to Internal Review

- **Updated by:** developer
- **Outcome:** Implementation is complete and the story is now in Internal Review.
- **Handover to:** reviewer
- **Handover prompt:** Review the NIMBUS-155 storefront read-only BC customer number behavior and Store API validator enforcement, then proceed with normal review/approval flow.
