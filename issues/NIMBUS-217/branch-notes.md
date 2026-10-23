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

## Task 02: admin UI

- Detail page row "Order API" (Enabled/Disabled) in `src/admin/routes/companies/[companyId]/page.tsx`, below BC Customer Number; no BC indicator.
- `CompanyForm` renders the `CoolSwitch` (`fieldName="order_api_enabled"`, label "Order API") only when the `company` prop is given (edit drawer); create mode sends no field.
- Verified: the detail page's `fields=*employees,...` keeps the route defaults (`FieldParser.shouldReplaceDefaults` treats `*`-prefixed fields as modifiers, `@medusajs/framework/dist/http/utils/field-filtering/field-parser.js`), so `order_api_enabled` from `adminCompanyFields` reaches the page.
- Test pattern: `src/admin/routes/companies/__tests__/company-order-api-setting.test.tsx` mocks only `lib/client` (`client.fetch`, `admin.region.list`, `admin.customerGroup.list`); the detail page needs a `MemoryRouter` with `/companies/:companyId`.
- `CoolSwitch`'s label is not linked to the switch: query it with `getByRole("switch")`, not by name.
- jsdom logs "Not implemented: HTMLFormElement.prototype.requestSubmit" when Save is clicked in the company form (button inside `<form>`); harmless noise, tests pass.
