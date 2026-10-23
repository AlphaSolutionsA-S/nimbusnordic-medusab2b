# 01: Company setting `order_api_enabled`
**App:** backend · **Layer:** L0 data model, L6 Admin company routes (schema, query config) · **Issue:** NIMBUS-218 · **Depends on:** None

**Goal:** Companies carry a stored boolean `order_api_enabled` (not null, default `false`) that only the Admin company update can change; new and existing companies are off.
**Files / areas:** `src/modules/company/models/company.ts`, a generated migration in `src/modules/company/migrations/`, `src/api/admin/companies/{validators,query-config}.ts`, `src/types/company/{module,http}.ts`; read-only checks of `src/api/store/companies/**` and `src/workflows/company/steps/prepare-company-bc-sync.ts` (no change expected).
**Seam contracts:** field name and wire value `order_api_enabled: boolean` on the Admin company GET/POST response and the Admin update body; the module-level `createCompanies` accepts it optionally (test seeds in 03 and 04 set it to `true`). The Admin update drawer sends back every field it read, so the update schema must accept the field in the same change that adds it to the read config. Admin create schema stays without it.
**Test intent:**
- Contract (Admin): GET company returns `order_api_enabled` as a boolean, `false` for a new company; POST update with `true` then `false` round-trips; POST create with the field → 400.
- Contract (store, negative): POST `/store/companies` with the field → 400; GET `/store/companies/:id`, also with a `fields` selection naming it, has no `order_api_enabled` key.
- Integration: a Business Central company sync run leaves the field unchanged on an enabled and on a disabled company.
- The generated migration adds the column `not null default false` (inspect the SQL; never hand-edit).
**Done when:** tests above pass; lint clean; typecheck at or below baseline; migration generated and applied locally.
**Verify after deploy:** `company.order_api_enabled` exists and is `false` for every company right after the migration; one test company in Admin shows it.
**Also update:** `integration-tests/http/companies/companies.spec.ts` (store and Admin company cases), `integration-tests/http/customers/company-sync.spec.ts`, `integration-tests/http/security/security-boundaries.spec.ts` (store negative case, or keep it in companies.spec and say so).

## Deviations

- **BLOCKING: migration not generated.** `medusa db:generate company` needs a live database (it
  connects before diffing; run here failed with `ECONNREFUSED`, no Postgres on localhost:5432 and
  no `.env.test`). Per `ai/architecture/data-ownership.md` no migration was hand-written. Someone
  with a database must run `pnpm --filter @b2b-starter/backend exec medusa db:generate company`,
  check the SQL is `alter table if exists "company" add column if not exists "order_api_enabled"
  boolean not null default false;` (down: drop the column), commit it with the updated
  `.snapshot-company.json`, then `medusa db:migrate`. Until then every integration test of this
  branch that touches the company table fails, because the test runner migrates from the migration
  files.
- Contract and integration tests were written but NOT run (no database here); they typecheck.
- `AdminUpdateCompany` (`src/types/company/http.ts`) gained the field as `Partial<AdminCreateCompany>
  & { order_api_enabled?: boolean }` so the shared HTTP create type stays without it, matching the
  create schema.
- Store negative cases kept in `companies.spec.ts` (next to the existing store company
  authorization cases) instead of `security-boundaries.spec.ts`, which has no company profile
  section.
- The Admin-create 400 case also asserts that no company was created.
- The BC sync case runs through `POST /store/customers/me/company/sync-business-central`
  (the same `syncCompanyFromBusinessCentralWorkflow` the login and freshness syncs use), once with
  the setting on and once off.
- No change needed in `src/api/store/companies/**` (strict create schema; reads go through the
  explicit field lists in `company-projection.ts`) or `prepare-company-bc-sync.ts` (the update lists
  only BC fields).

## Done-when evidence

- GET returns a boolean, `false` for a new company: `integration-tests/http/companies/companies.spec.ts`
  "order_api_enabled company setting" › "a new company is returned with the setting off" (written, not run).
- POST update `true` then `false` round-trips: same describe › "the Admin update switches the setting
  on and off again" (written, not run).
- Admin create with the field → 400: same describe › "the Admin create refuses the setting" (written, not run).
- Store create with the field → 400: same describe › "the store create refuses the setting" (written, not run).
- Store GET, also with `fields=order_api_enabled` / `+order_api_enabled`, has no key: same describe ›
  "the store company read never returns the setting" (written, not run).
- BC sync leaves the field unchanged on an enabled and a disabled company:
  `integration-tests/http/customers/company-sync.spec.ts` › "leaves order_api_enabled at %s after a
  sync" (`true`, `false`) (written, not run).
- Migration adds the column `not null default false`: not provable in this task: generation needs a
  database (blocking deviation above).
- Migration applied locally: not provable in this task: no database.
- Lint clean: `pnpm --filter @b2b-starter/backend lint` 0 errors (13 pre-existing warnings, none in
  touched files).
- Typecheck at or below baseline: `tsc --noEmit` 22 errors, baseline 22 (same files).
- Also update `companies.spec.ts`: Admin and store cases added (describe "order_api_enabled company setting").
- Also update `company-sync.spec.ts`: sync case added.
- Also update `security-boundaries.spec.ts`: no change; store negative cases kept in `companies.spec.ts` (see Deviations).
