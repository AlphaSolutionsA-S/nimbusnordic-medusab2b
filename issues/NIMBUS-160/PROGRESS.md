# Ensure Business Central company data is fresh before viewing Company page

- **Date:** 2026-08-21
- **Type:** Story
- **Tracker:** JIRA — https://alphasolutionsdk.atlassian.net/browse/NIMBUS-160
- **Priority:** Medium
- **Project Folder:** issues/NIMBUS-160/
- **Updated by:** feature skill
- **Outcome:** Feature captured; scoping is the next stage. Note: an earlier attempt to implement this directly (before creating the tracker issue) was reverted with no leftover changes — no code exists yet for this feature.
- **Handover to:** scoper agent
- **Handover prompt:** `@scoper Please scope NIMBUS-160. Jira issue: https://alphasolutionsdk.atlassian.net/browse/NIMBUS-160. Interview me interactively before writing any scope document. Two known open questions to raise during the interview: (1) should the 10-minute freshness check live purely in the backend GET /store/companies/[id] route, or does the storefront also need to track "last synced at"; (2) should a failed sync attempt still count as "attempted" for throttling purposes.`

- **Date:** 2026-08-21
- **Updated by:** scoper agent
- **Outcome:** Scope completed after stakeholder interview. The backend Company GET route will orchestrate automatic freshness checks using a persisted successful-sync timestamp. It returns stale data when Business Central sync fails and retains the old timestamp so the next request retries. No manual refresh UI or storefront freshness state is included.
- **Handover to:** implementation-planner agent
- **Handover prompt:** `@implementation-planner Create PLAN.md, a dependency-ordered manifest, and implementation task files for NIMBUS-160 using issues/NIMBUS-160/SCOPE.md. Reuse the existing company Business Central workflow; preserve stale company data and its old successful-sync timestamp when synchronization fails.`

- **Date:** 2026-08-21
- **Updated by:** implementation-planner agent
- **Outcome:** Implementation plan is ready; implementation is the next stage. Produced `PLAN.md`, `manifest.md`, and five dependency-ordered task files (01 model+migration, 02 stamp-on-success, 03 GET freshness route, 04 storefront cache TTL, 05 integration tests). Base branch `develop`. Storefront cache decision revised per stakeholder: `retrieveCompany` gets `revalidate: 120` (≈12 min worst-case staleness) instead of full uncaching. Timestamp is written inside the existing sync workflow's `ready` update, so only successful syncs advance it; the GET route tolerates sync failures and returns last-known data.
- **Handover to:** implementor agent
- **Handover prompt:** `@implementor Implement NIMBUS-160 from issues/NIMBUS-160/manifest.md and the task files 01–05 in that folder, on branch feature/NIMBUS-160 from develop. Follow the dependency order (01 → 02 → 03 → 04, then 05). Keep all Business Central mutations inside the existing sync workflow; the GET route only orchestrates freshness and reads. Preserve stale company data and the prior successful-sync timestamp on failure.`

- **Date:** 2026-08-21
- **Updated by:** implementor agent
- **Outcome:** Implemented Tasks 01–04 and added Task 05 coverage on branch `feature/NIMBUS-160`. Added the nullable company timestamp and generated `Migration20260821114023.ts`; successful Business Central syncs stamp the timestamp; the authenticated Company GET route refreshes only stale or never-synced data and returns last-known data on sync errors; `retrieveCompany` now revalidates after 120 seconds. Added fresh, missing, stale-success, and stale-failure HTTP integration cases.
- **Validation:** `pnpm --filter @b2b-starter/backend build` passed with 12 existing unrelated lint warnings. `pnpm --filter @b2b-starter/storefront build` compiled and linted, then failed static page collection because the backend connection was refused. Both focused backend integration commands were blocked before test execution because the disposable PostgreSQL connection has no string password (`SASL: SCRAM-SERVER-FIRST-MESSAGE: client password must be a string`).
- **Handover to:** developer or CI environment with configured integration-test PostgreSQL credentials
- **Handover prompt:** `Configure the PostgreSQL password used by the Medusa integration-test harness, then rerun pnpm --filter @b2b-starter/backend test:integration:http -- integration-tests/http/customers/company-sync.spec.ts and pnpm --filter @b2b-starter/backend test:integration:http -- integration-tests/http/companies/companies.spec.ts. On success, change Task 05 from BLOCKED to DONE and transition NIMBUS-160 to Internal Review.`

- **Date:** 2026-08-21
- **Updated by:** implementor agent
- **Outcome:** Docker Desktop was available on `feature/NIMBUS-160`. The existing PostgreSQL service on `localhost:5432` accepted `admin` / `S3cret` for `nimbus-medusa-dev`; its container was reused because it already owned the configured port. The initial full HTTP run and focused companies run failed before assertions because `medusaIntegrationTestRunner` constructs temporary database URLs from `DB_HOST`, `DB_PORT`, `DB_USERNAME`, and `DB_PASSWORD`, not `DATABASE_URL`, leaving the password undefined. With those `DB_*` variables supplied, the companies suite reached Medusa startup and test-data provisioning but did not complete: the shared PostgreSQL service repeatedly terminated connections during the throwaway-database lifecycle (`Connection ended unexpectedly`; PostgreSQL log: `terminating connection due to administrator command`). No NIMBUS-160 assertion completed, so Task 05 remains blocked. No application or test assertions were changed.
- **Validation:** `pnpm --filter @b2b-starter/backend test:integration:http` — failed before test assertions with missing runner password. `pnpm --filter @b2b-starter/backend test:integration:http -- integration-tests/http/companies/companies.spec.ts` — 16 failed / 16 total before assertions with the same missing password. Retried the focused companies suite with `DB_HOST=localhost`, `DB_PORT=5432`, `DB_USERNAME=admin`, and `DB_PASSWORD=S3cret`; no Jest summary was produced because the database connections were terminated during setup. `company-sync.spec.ts` was not run after this confirmed shared-database interruption.
- **Handover to:** developer or CI environment with an isolated PostgreSQL instance that does not terminate connections during temporary-database setup
- **Handover prompt:** `Run the NIMBUS-160 HTTP integration specs with DB_HOST, DB_PORT, DB_USERNAME, and DB_PASSWORD set for the Medusa test runner, using an isolated PostgreSQL service. Verify integration-tests/http/companies/companies.spec.ts (including the four freshness cases) and integration-tests/http/customers/company-sync.spec.ts. On success, set Task 05 to DONE and move NIMBUS-160 to Internal Review.`

- **Date:** 2026-08-21
- **Updated by:** implementor agent
- **Outcome:** Re-verified Task 05 on `feature/NIMBUS-160` after the backend test environment began loading `apps/backend/.env` with the configured `DB_*` credentials. `nimbus_postgres_container` was reachable on `localhost:5432`; no `medusa develop` process was running against it. The companies suite was run twice as permitted for a transient shared-DB failure. Both attempts completed migrations, then Medusa startup timed out because it could not acquire a connection; none of the four NIMBUS-160 freshness assertions executed. The companion company-sync suite reproduced the same startup failure. PostgreSQL container logs show `FATAL: terminating connection due to administrator command` during the disposable-database lifecycle. No application code or test assertion was changed.
- **Validation:** `pnpm --filter @b2b-starter/backend test:integration:http -- integration-tests/http/companies/companies.spec.ts` — first attempt: 16 failed / 16 total; retry: 16 failed / 16 total; all failures were the `medusaIntegrationTestRunner` setup hook timeout, with no test-body assertion executed. `pnpm --filter @b2b-starter/backend test:integration:http -- integration-tests/http/customers/company-sync.spec.ts` — 6 failed / 6 total; all failures were the same setup hook timeout. Runtime log: `Error starting the app: Unable to acquire a connection`.
- **Handover to:** developer or CI environment with an isolated PostgreSQL service that permits Medusa's disposable-database lifecycle
- **Handover prompt:** `Reuse the configured DB_* credentials with an isolated PostgreSQL instance, then rerun the focused NIMBUS-160 backend suites. Task 05 remains BLOCKED until integration-tests/http/companies/companies.spec.ts passes its fresh, missing, stale-success, and stale-failure cases and integration-tests/http/customers/company-sync.spec.ts passes its timestamp regression coverage.`
