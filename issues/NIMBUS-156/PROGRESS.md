# Sync Business Central customer data to Medusa company on login

- **Date:** 2026-08-21
- **Type:** Story
- **Tracker:** JIRA — https://alphasolutionsdk.atlassian.net/browse/NIMBUS-156
- **Priority:** Medium
- **Project Folder:** issues/NIMBUS-156/
- **Updated by:** feature skill
- **Outcome:** Feature captured; scoping is the next stage.
- **Handover to:** scoper agent
- **Handover prompt:** You are the scoper for `NIMBUS-156` in `D:\projects\Nimbus\nimbusnordic-medusab2b`. Read `issues\NIMBUS-156\FEATURE.md` and produce a detailed `SCOPE.md` covering: the login-triggered BC Customer fetch (via `business_central_customer_number`), the field mapping (direct matches + address concatenation + new fields `blocked` as Medusa enum mirroring BC `customerBlocked`, `credit_limit` as bare decimal, `vat_number` + `currency_code` from currency navigation), the Medusa company model migration needed, the BC module service extension (new `getCustomer` method), the auth/login hook point, error handling (non-blocking on BC failure), and sync on every login. Resolved decisions: `blocked` = Medusa enum (`""`, `"Ship"`, `"Invoice"`, `"All"`), `credit_limit` = bare decimal, sync every login, skip `salespersonCode`/`website`/`taxAreaDisplayName`. Keep JIRA business-facing and store technical planning in repo issue files only.

## 2026-08-21 - Scoping completed

- **Updated by:** scoper agent
- **Outcome:** Created `SCOPE.md` with the login trigger, BC customer contract, exact field
	mapping and normalization, company migration boundary, Medusa workflow, non-blocking
	failure behavior, authorization constraints, acceptance scenarios, and validation scope.
- **Key finding:** Medusa v2.18 emits no successful-login event. The supported trigger is a
	protected backend sync endpoint called by the storefront immediately after successful
	token storage; the authenticated customer remains the sole source of company authority.
- **Jira hygiene:** Confirmed Story status `Scoping` and component `Customer Portal`; assigned
	the previously unassigned issue to Klaus Petersen.
- **Handover to:** implementation-planner agent
- **Handover prompt:** You are the implementation planner for `NIMBUS-156` in
	`D:\projects\Nimbus\nimbusnordic-medusab2b`. Read `issues\NIMBUS-156\FEATURE.md`,
	`issues\NIMBUS-156\SCOPE.md`, and this progress record. Produce `PLAN.md`, `manifest.md`,
	and dependency-ordered implementation task files. Preserve the scoped post-login
	protected endpoint, authenticated company resolution, BC `getCustomer` currency expansion,
	`_x0020_` blocked normalization, generated company migration, workflow-owned mutation,
	and non-fatal login behavior. Do not implement production code during planning.

## 2026-08-21 - Implementation planning completed

- **Date:** 2026-08-21
- **Updated by:** implementation-planner agent
- **Outcome:** Implementation plan is ready; implementation is the next stage. Created
	`PLAN.md`, `manifest.md`, and six dependency-ordered task files
	(`01-bc-get-customer`, `02-company-model-migration`, `03-sync-company-workflow`,
	`04-sync-route`, `05-storefront-login-sync`, `06-validation`).
- **Gates resolved from records:** Base branch = `develop` (FEATURE.md + AGENTS.md). Test
	infrastructure already present (backend Jest module/http/unit runners; storefront Jest +
	next/jest jsdom) — no bootstrapping required.
- **Key design decisions:** Login trigger is the protected bodyless endpoint
	`POST /store/customers/me/company/sync-business-central`, authenticated via
	`authenticate("customer", ["session","bearer"])`, with company authority resolved
	server-side through `customer -> employee -> company` (no caller-supplied authority).
	BC `getCustomer` expands `currency`, normalizes `_x0020_`→`""`, and rejects unknown blocked
	values at the external boundary. `credit_limit` uses `model.bigNumber().nullable()` (adds a
	`raw_credit_limit` column) to preserve decimal precision. Migration generated via
	`npx medusa db:generate company`. The workflow guards `updateCompaniesStep` with `when` so a
	skip/failed fetch never mutates the company. Expected BC service errors become a non-failing
	workflow status; unexpected programming/database failures remain observable endpoint errors.
- **Handover to:** implementor agent
- **Handover prompt:** You are the implementor for `NIMBUS-156` in
	`D:\projects\Nimbus\nimbusnordic-medusab2b`. Read `issues\NIMBUS-156\PLAN.md`,
	`issues\NIMBUS-156\manifest.md`, and the task files `01`..`06` in that folder, then implement
	them in dependency order (01 and 02 first — independent; then 03; then 04; then 05; then 06
	validation). Preserve every scoped requirement: the post-login protected bodyless endpoint,
	authenticated server-side company resolution, BC `getCustomer` currency expansion,
	`_x0020_` blocked normalization with unknown-value rejection, the generated company migration,
	the workflow-owned mutation via `updateCompaniesStep`, and non-fatal login behavior. Await
	storefront token persistence before the sync call. Contain expected BC service failures as the
	workflow's `failed` result, but do not convert unexpected programming/database failures into
	HTTP 200; those remain observable while the storefront treats the secondary request as
	non-fatal. Do not add the new fields to any store/admin validator. Run the Task 06 validation
	matrix before handing back.

## 2026-08-21 - Implementation completed

- **Updated by:** implementor agent
- **Outcome:** Implemented Tasks 01-05 and ran the Task 06 matrix. Added the typed BC customer
	lookup with currency expansion and strict blocked-state normalization, company integration
	fields and generated migration, actor-scoped workflow mutation through `updateCompaniesStep`,
	protected bodyless sync route, and awaited best-effort storefront post-login synchronization.
- **Migration note:** Medusa 2.18 cannot generate GraphQL SDL for an enum containing the required
	empty-string value. The model therefore uses defaulted text for `blocked`, while the BC boundary
	and module DTO retain the exact `"" | "Ship" | "Invoice" | "All"` contract. The migration and
	snapshot were generated with `medusa db:generate company`.
- **Validation passed:** BC module tests (26/26 full module matrix), focused sync HTTP tests (6/6),
	backend build, storefront tests (36/36), focused storefront sync tests (4/4), and disposable
	PostgreSQL migration up/default/down verification.
- **Baseline blockers:** The full pre-existing backend HTTP matrix fails in the existing company,
	quote, and admin quote suites (20 failures; existing admin seeding receives HTTP 401); the new
	sync suite passes. Storefront production compilation/lint succeeds, then static page collection
	fails because no storefront backend is running (`ECONNREFUSED`). Standalone storefront
	`tsc --noEmit` reports only pre-existing account/profile/cart type errors after the new test
	errors were corrected.
- **Sandbox BC:** Not run because no BC sandbox availability was provided.
- **Handover to:** reviewer / pull-request owner
- **Handover prompt:** Review NIMBUS-156 with emphasis on the typed BC failure boundary, guarded
	`updateCompaniesStep`, actor-derived company authority, generated migration, and post-login
	token-before-sync ordering. Treat the recorded full-suite HTTP and storefront environment
	failures as baseline follow-up unless they reproduce specifically in the new focused tests.

## 2026-08-21 - Blocked state enum revised

- **Updated by:** implementor agent
- **Decision:** Medusa stores the unblocked state as the explicit enum value `not_blocked`.
	Business Central `""`, null, and `_x0020_` values normalize to `not_blocked`; unknown values
	continue to be rejected.
- **Outcome:** Replaced the text-backed field with
	`model.enum(["not_blocked", "Ship", "Invoice", "All"])`, regenerated the company migration and
	snapshot, and updated the BC and company contracts.
- **Validation:** BC service tests passed (10/10), focused sync HTTP tests passed (6/6), backend
	build passed, and disposable PostgreSQL verification confirmed the `not_blocked` default,
	invalid-enum rejection, existing-row migration, and clean rollback.
- **Handover to:** reviewer / pull-request owner
