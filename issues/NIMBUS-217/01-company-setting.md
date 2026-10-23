# 01: Company setting `order_api_enabled`
**App:** backend · **Layer:** L0 data model, L6 Admin company routes (schema, query config) · **Depends on:** None

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
