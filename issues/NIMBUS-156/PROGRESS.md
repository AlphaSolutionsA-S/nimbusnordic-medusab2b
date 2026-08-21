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
