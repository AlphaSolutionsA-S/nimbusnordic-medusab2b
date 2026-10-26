# Manifest: Company admins can add another person's existing account to their company

**Key:** NIMBUS-243
**Issue:** NIMBUS-243
**Branch:** feature/NIMBUS-243 (from develop)
**Ready for Dispatch:** true

## Conventions and commands

- Backend (`@b2b-starter/backend`): unit `pnpm --filter @b2b-starter/backend test:unit -- <path>`;
  integration `pnpm --filter @b2b-starter/backend test:integration:http -- <path>` (finalization
  only, local Postgres); lint `pnpm --filter @b2b-starter/backend lint`; typecheck
  `apps/backend/node_modules/.bin/tsc --noEmit -p apps/backend` (at or below baseline).
- Storefront (`@b2b-starter/storefront`): lint `pnpm --filter @b2b-starter/storefront lint`;
  typecheck `pnpm --filter @b2b-starter/storefront exec tsc --noEmit` (at or below baseline).
- Unit tests: `apps/backend/src/**/__tests__/*.unit.spec.ts`. Contract tests:
  `apps/backend/integration-tests/http/<area>/*.spec.ts`.
- Integration specs fail locally with 401 on login (NIMBUS-236): handling in `plan.md` section 10.
  A touched case failing only on that login is recorded "code complete, unverified because
  NIMBUS-236", not a blocker.
- No migration, no new module, no new dependency.

## Tasks

| # | Title | File | App | Implements | Depends on | Issue | Status |
|---|-------|------|-----|------------|------------|-------|--------|
| 01 | Store employee creation accepts only a new account | `01-store-employee-new-account-only.md` | backend | F1, F2, F3; BR 1-3; Also update (backend type, docs) | None | NIMBUS-252 | DONE |
| 02 | Storefront request type drops `customer_id` | `02-storefront-employee-type.md` | storefront | Also update (storefront type) | None | NIMBUS-253 | TODO |

## Scope items with no task

| Scope item | Reason |
|---|---|
| F4: Admin route keeps `customer_id` | not needed: unchanged, out of scope |
| F5: company registration unchanged | not needed: no change; untouched code |
| Optional note in `docs/security-remediation.md` | not needed: it does not describe store `customer_id` linking (plan Decisions) |
| After-deploy log check for unexpected 400s | external: human after deploy (plan section 10) |
