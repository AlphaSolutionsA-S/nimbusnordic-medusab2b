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

## Deviations

- Decision function name and file: `getBusinessCentralEnvironmentForCountry` in `utils/business-central-environment.ts` (task left the name open).
- The step (`loadBusinessCentralAccountCompanyStep`, `steps/load-business-central-account-company.ts`) only reads the company row (`id`, `business_central_customer_number`, `country`, in `ACCOUNT_COMPANY_FIELDS`); the rule runs in the workflow's `transform()`, so the step holds no business rule. Task 05 adds the not-found columns to `ACCOUNT_COMPANY_FIELDS` / `BusinessCentralAccountCompanyRow` and maps them in the workflow's transform.
- An unknown `customerId` resolves like a customer without a company (`companyId: null`, `DK`), as the sync's prepare step treats it; the task named only the company-id not-found case.
- Added test cases: unit `"   "` and `"N O"` → DK; integration "customer whose company country is DK → DK", "company without a customer number → its environment and no number", and a Norwegian company the customer does not belong to stays out of a company-less customer's result.
- `pnpm ai:check --fix` also regenerated the Tier 0 blocks in root `AGENTS.md` and `.github/copilot-instructions.md` (generated copies of `decisions.md`).

## Done-when evidence

- Decision maps `NO`/`no`/` No `/`\tNO\n` → NO and `DK`, `SE`, `""`, `null`, `undefined`, `NOR`, `N` → DK: `apps/backend/src/utils/__tests__/business-central-environment.unit.spec.ts` (13 passed).
- Workflow resolves customer id / company id, unknown company id → not found, customer without company → DK and no number: `apps/backend/integration-tests/http/customers/business-central-account.spec.ts` ("resolves a customer whose company country is lower-case no…", "resolves a company id to Norway…", "rejects an unknown company id as not found", "resolves a customer without a company to Denmark and no number"). Not run: integration specs can't run in this checkout (plan section 2, item 3); lint and typecheck pass.
- The decision function is the only place comparing a country with `NO`: grep `(===|!==|==)\s*["']NO["']|["']NO["']\s*(===|!==|==)` over `apps/` matches only `apps/backend/src/utils/business-central-environment.ts:12`.
- Registry row exists and `pnpm ai:check` passes: row "Business Central environment of a company…" in `ai/architecture/decisions.md`; `ai:check passed (harness 2.1.2)`.
- Also update `ai/architecture/decisions.md`: new row added (owning file, verdict via the account workflow, the four consumers).
