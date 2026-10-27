# 02: Country → environment rule and the BC account workflow
**App:** backend · **Layer:** L5 decision function; L4 workflow with one L3 query step · **Depends on:** 01

**Goal:** One pure function decides a company's BC environment from its `country`, and one workflow resolves a company's BC account (company id, customer number, environment, not-found record) from a customer id or a company id.
**Files / areas:** `utils/` (new decision function, pure, beside `order-api-access.ts`) with `utils/__tests__/`; `workflows/company/` (new step and workflow); `ai/architecture/decisions.md` (new row).
**Seam contracts:**
- Decision: `(country: string | null | undefined) => BusinessCentralEnvironment`; `"NO"` after trim, any case → `"NO"`; everything else → `"DK"`.
- Workflow input: `{ customerId: string } | { companyId: string }` (shapes exclusive, as in `PrepareCompanyBcSyncInput`).
- Workflow output: `{ companyId: string | null; customerNumber: string | null; environment: BusinessCentralEnvironment; notFound: { at: Date; environment: BusinessCentralEnvironment; customerNumber: string } | null }`.
- Unknown `companyId` → `MedusaError.NOT_FOUND`; customer without a company → `{ companyId: null, customerNumber: null, environment: "DK", notFound: null }`.
- The not-found columns arrive in task 05; this task returns `notFound: null` and task 05 extends the step's selection.
**Test intent:**
- Unit (decision): `NO`, `no`, ` No `, `\tNO\n` → NO; `DK`, `SE`, `""`, `null`, `undefined`, `NOR`, `N` → DK.
- Integration (`integration-tests/http/customers/`): a customer whose company has country `no` resolves to `NO` with its customer number; a company id resolves likewise; unknown company id → not found; a customer without a company → DK and no number.
**Done when:** the decision function is the only place comparing a country with `NO` (grep), the registry row exists and `pnpm ai:check` passes.
**Also update:** `ai/architecture/decisions.md` (new row: rule, owning file, verdict "environment", consumers: store BC routes, return creation, company sync, Admin BC customer routes); none found elsewhere.
