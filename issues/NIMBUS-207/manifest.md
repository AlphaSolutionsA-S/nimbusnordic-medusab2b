# Manifest: Restrict store quote response fields

**Key:** NIMBUS-207
**Issue:** NIMBUS-207
**Branch:** feature/NIMBUS-207 (from develop)
**Ready for Dispatch:** true

## Conventions and commands

Backend Jest unit tests: `src/**/__tests__/*.unit.spec.ts`; HTTP contracts: `integration-tests/http/**/*.spec.ts`, real PostgreSQL. Run from repository root, one command at a time. Scoped unit: `pnpm --filter @b2b-starter/backend test:unit -- query-config`; scoped HTTP: `pnpm --filter @b2b-starter/backend test:integration:http -- security-boundaries` and `-- quotes/quotes`. Per task run changed tests, `pnpm --filter @b2b-starter/backend lint` and `pnpm --filter @b2b-starter/backend exec tsc --noEmit`, comparing failures with the measured baseline. Finalization runs backend full unit, module/HTTP integration suites and `pnpm --filter @b2b-starter/backend build` once. After architecture edits run `pnpm ai:check --fix` then `pnpm ai:check`. No migration, module registration or storefront edit is planned; run storefront typecheck for compatibility and distinguish its pre-existing errors.

## Tasks

| # | Title | File | App | Implements | Depends on | Issue | Status |
|---|---|---|---|---|---|---|---|
| 01 | Restrict quote projections and prove response compatibility | `01-restrict-store-quote-fields.md` | backend | Functional 1–4; all non-functional requirements and agreed scope answers | None | NIMBUS-237 | DONE |

## Scope items with no task

| Scope item | Reason |
|---|---|
| None | All approved requirements belong to task 01; ownership, Admin and writes remain unchanged |
