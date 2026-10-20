# Manifest: Manage country languages from Admin

**Key:** NIMBUS-176
**Issue:** NIMBUS-176
**Branch:** feature/NIMBUS-176 (from develop)
**Ready for Dispatch:** true

## Conventions and commands

Plan approved by Klaus Petersen on 2026-10-20, including retained-entry reassignment. The Region Query projection passed in a user-executed read-only probe; evidence is recorded in PLAN.md and samples/region-query-verification.json. Country removal/re-addition remains implementation integration-test coverage. Jira children NIMBUS-194–198 are recorded below. A separate explicit dispatcher handoff is still required; no implementation has started.

Run from repository root, one command at a time. Backend scoped tests: `pnpm --filter @b2b-starter/backend test:unit -- <path>`; Admin: `pnpm --filter @b2b-starter/backend test:admin -- <path>`; storefront: `pnpm --filter @b2b-starter/storefront test -- <path>`. Per affected app run `pnpm --filter <package> lint` and `pnpm --filter <package> exec tsc --noEmit`. Remeasure the documented pre-existing baseline and introduce no new failures.

Backend unit tests: src/**/__tests__/*.unit.spec.ts; Admin: src/admin/**/__tests__/*.test.tsx; real-PG module tests: src/modules/storefront-translation/__tests__/*.spec.ts; HTTP: integration-tests/http/translations/translations.spec.ts and security/security-boundaries.spec.ts. Storefront Jest mirrors source under src/__tests__; browser tests under e2e/visual. No source-text assertion or service-call-order mock tests.

Finalization runs backend full unit, module and HTTP integration suites, Admin tests, storefront suite and relevant Playwright functional cases, plus both app builds; use ai/AGENTS.md commands. Backend integration requires local/test Postgres and a BUSINESS_CENTRAL_DISCOVERY_URL accepted by integration-tests/global-setup.ts; never point tests at production. Migration commands: `pnpm --filter @b2b-starter/backend exec medusa db:generate storefrontTranslation`, then `pnpm --filter @b2b-starter/backend exec medusa db:migrate`. Generate and retain the schema snapshot; never write schema migration SQL manually. After ai/ changes run `pnpm ai:check --fix` and `pnpm ai:check`.

## Tasks

| # | Title | File | App | Implements | Depends on | Issue | Status |
|---|---|---|---|---|---|---|---|
| 01 | Persist assignments and protect language integrity | 01-configuration-integrity.md | Backend | F3 persistence, F5, F6 atomic initialization, F7 overlap integrity | None | NIMBUS-194 | DONE |
| 02 | Publish validated country-language contracts and bootstrap | 02-contracts-bootstrap.md | Backend | F1 management read, F2, F4 public contract, F6 rollout operation; NFR protected operations | 01 | NIMBUS-195 | DONE |
| 03 | Add Admin assignment management and feedback | 03-admin-management.md | Admin | F1 display, F7 UI; NFR Admin accessibility | 02 | NIMBUS-196 | DONE |
| 04 | Resolve runtime language from one cached publication | 04-runtime-resolution.md | Storefront | F3 dynamic consumers, F4 request/render/reporting; NFR cache/outage/restarts/message preservation | 02 | NIMBUS-197 | DONE |
| 05 | Preserve formatting and SEO with rollout verification | 05-formatting-seo-verification.md | Storefront / docs | F4 metadata/alternates, F8; NFR current documentation and storefront text | 03, 04 | NIMBUS-198 | DONE |

## Scope items with no task

| Scope item | Reason |
|---|---|
| None | Every functional and non-functional requirement is assigned above; approved business rules constrain the relevant tasks. Out-of-scope exclusions are guardrails, not deliverables. |
