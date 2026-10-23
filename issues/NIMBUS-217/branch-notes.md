# Branch notes: NIMBUS-217

## Task 01: company setting

- Model: `order_api_enabled: model.boolean().default(false)` on `Company`
  (`apps/backend/src/modules/company/models/company.ts`).
- **No migration yet**: `medusa db:generate company` needs a running Postgres and could not run in
  the first dispatch environment. Until it is generated and committed, integration tests that
  create companies fail (the test runner migrates from migration files). Tasks 03/04 adding seeds
  with `order_api_enabled: true` depend on it.
- Types: `ModuleCompany.order_api_enabled: boolean` (required), `ModuleCreateCompany.order_api_enabled?`
  (optional, so `companyService.createCompanies({ ..., order_api_enabled: true })` typechecks),
  `AdminUpdateCompany` (HTTP type) has it optional; `AdminCreateCompany` does not.
- `ModuleUpdateCompany` extends `Partial<ModuleCompany>`, so `updateCompanies({ id, order_api_enabled })` works.
- Admin: `AdminUpdateCompany` zod schema accepts `order_api_enabled: z.boolean().optional()`;
  `adminCompanyFields` in `api/admin/companies/query-config.ts` returns it. Admin create schema is
  strict without it (400).
- Store company routes never expose it: responses go through the explicit lists in
  `api/store/companies/company-projection.ts`; don't add it there.
- `ModuleCompanyFilters` only allows `q` and `id`: filter by name in tests fails typecheck.
- Shell: `pnpm` is not on PATH; use `corepack pnpm ...` from bash.
