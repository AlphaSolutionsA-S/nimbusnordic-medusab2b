# Branch notes: NIMBUS-261

## Task 01

- `BusinessCentralEnvironment = "DK" | "NO"` is exported from `modules/business-central/types.ts`. Every `IBusinessCentralModuleService` method except `getOperations` takes it first, e.g. `getCustomer("NO", number)`, `listReturnReasons("NO")`, `getOrder("NO", { customerNumber, orderNumber })`.
- `modules/business-central/environment-config.ts` exports `getBusinessCentralLocalCurrency(environment)` (DK: `BUSINESS_CENTRAL_LCY_CODE` or `DKK`; NO: `BUSINESS_CENTRAL_NO_LCY_CODE` or `NOK`; trimmed, blank falls back) for task 05, plus `getBusinessCentralEndpoint` and `getBusinessCentralCompanyId` used by the service.
- Callers still on `"DK"` that tasks 03 to 05 switch: the five store BC routes (`api/store/bc-orders/route.ts`, `[id]/route.ts`, `return-reasons/route.ts`, `api/store/bc-returns/route.ts`, `[number]/route.ts`), `business-central-return/steps/{prepare,submit}-bc-return.ts`, `company/steps/prepare-company-bc-sync.ts`. Order submission and shipment-notice steps stay `"DK"` (commented).
- Integration specs asserting `getCustomer` arguments now expect `("DK", number)`: `customers/company-sync.spec.ts:457,566`, `companies/companies.spec.ts:919` (task 05 changes them to the routed environment).
- A missing or invalid NO setting throws `MedusaError` `INVALID_DATA` from the NO call only, message `<VARIABLE> <requirement> (Business Central environment NO)`; the configured value never appears in it.
- Pitfall: BC module specs run with `test:integration:modules`, and a bare path pattern also picks up stale compiled copies under `apps/backend/.medusa/server`. Run jest directly from `apps/backend` with `--testPathIgnorePatterns '[\\/]\.medusa[\\/]'` (a plain `.medusa` regex matches the repo folder name `nimbusnordic-medusab2b` and skips every test). `pnpm` is not on PATH here; use `corepack pnpm`.
- Baseline failure, not ours: `service.spec.ts` "listOrders › stops filling from salesInvoices after the round-trip guardrail even if the page stays short" fails before and after task 01.
- `environments.spec.ts` has a fetch router keyed on tenant and company path that later module-level NO tests can reuse.

## Task 02

- Rule: `getBusinessCentralEnvironmentForCountry(country)` in `utils/business-central-environment.ts` (single `=== 'NO'` in the backend; registry row in `decisions.md`). Use it in `transform()` or a step, never re-compare a country.
- Workflow: `resolveBusinessCentralAccountWorkflow` (`workflows/company/workflows/resolve-business-central-account.ts`), input `{ customerId } | { companyId }`, result type `BusinessCentralAccount` `{ companyId, customerNumber, environment, notFound }` (also exported: `BusinessCentralNotFoundRecord`, `ResolveBusinessCentralAccountInput`). Both are re-exported from the company `workflows/index.ts`.
- Step: `loadBusinessCentralAccountCompanyStep` (`steps/load-business-central-account-company.ts`) returns the raw company row or null; field list `ACCOUNT_COMPANY_FIELDS` and row type `BusinessCentralAccountCompanyRow` live there. Task 05: add the three not-found columns to both, then map them to `notFound` in the workflow's transform (currently hard `null`).
- Unknown company id rejects with `type: "not_found"` (`MedusaError.NOT_FOUND` → 404 in a route). Unknown customer id or customer without company → `{ companyId: null, customerNumber: null, environment: "DK", notFound: null }`.
- Probe: `query.graph` rows here are typed as the full generated `Company`, so a wrong row type fails typecheck (verified by temporarily breaking `country`'s type).
- Pitfall: PowerShell 5.1 `Set-Content -Encoding utf8` writes a BOM; use the file tools for edits.
- Integration cases are in `integration-tests/http/customers/business-central-account.spec.ts` (not run locally).

## Task 03

- The five store BC read routes call `resolveBusinessCentralAccountWorkflow(req.scope).run({ input: { customerId: customer_id } })` (customer id from `req.auth_context.app_metadata`) and pass `account.environment` / `account.customerNumber` to the BC module. Task 04 can copy this shape for `bc-orders/[id]/returns/route.ts`.
- Unit-testing a route that runs the workflow: `jest.mock` the workflow module and `jest.mocked(resolveBusinessCentralAccountWorkflow).mockReturnValue({ run } as never)`, `run` resolving `{ result: account }` (see `api/store/bc-returns/__tests__/return-detail-route.unit.spec.ts`).
- Integration pattern for routed BC calls: `integration-tests/http/business-central/store-bc-reads.spec.ts` (company via `POST /store/companies`, then `updateCompanies` sets `country` and number; spy on the resolved BC module; stub unexpected calls with `mockRejectedValue` so nothing reaches BC).
- Verified: `validateAndTransformQuery` passes the whole normalised query to the zod schema (`@medusajs/framework/dist/http/utils/validate-query.js`), so a `.strict()` query validator answers an unknown `environment` param with 400.

## Task 04

- `PrepareBcReturnInput` and `SubmitBcReturnInput` both carry `environment: BusinessCentralEnvironment`; `createBcReturnWorkflow` passes `input.environment` to submit through `transform`.
- Verified by probe: a failed workflow `run()` rejects with a plain serialised object (`message`, `name`, `stack`, plus own fields such as `type`, `__isMedusaError`, `idempotencyKey`), never the thrown instance; `instanceof` is false. Routes must read `name` / `MedusaError.isMedusaError(e)` + `type`. The return route now does (`getReturnFailureAnswer` in `[id]/returns/route.ts`). Any route mapping workflow errors with `instanceof` (task 06's Admin routes) has the same trap.
- Don't answer every `INVALID_DATA` with its message: BC configuration errors (`environment-config.ts`, `getClientCredentials`) are `INVALID_DATA` and name settings. Give shopper-facing errors a distinct `name` and match that (the return route's `BC_RETURN_VALIDATION_ERROR`, exported from `create-bc-return.ts`); everything else is the generic 500.
- Running a real workflow in a unit spec works: `createMedusaContainer()` from `@medusajs/framework/utils`, register the BC module key and `ContainerRegistrationKeys.LOGGER` with `asValue` (`@medusajs/framework/awilix`), pass it as `req.scope` (`api/store/bc-orders/__tests__/create-return-route.unit.spec.ts`).
- The return route no longer imports `modules/business-central/service.ts`; its `bound-route-no-service` baseline entry is gone.
- Return-create integration cases live in `integration-tests/http/business-central/store-bc-reads.spec.ts` ("creating a return").
- `jest --testPathPattern <x>` is needed when running jest directly in Git Bash; a bare positional path ran every suite.

## Task 05

- Company columns `business_central_not_found_at` (dateTime), `business_central_not_found_environment` (enum `DK`/`NO`), `business_central_not_found_customer_number` (text), all nullable; also on `ModuleCompany`. Migration `modules/company/migrations/Migration20261027225750.ts` (generated).
- **Seam change for tasks 06 and 07:** `BusinessCentralNotFoundRecord.at` is now an ISO 8601 `string`, not a `Date`, and the account step's row carries it as a string. Workflow results are serialised: a `Date` never comes out of `workflow.run()`, even when built in `transform` (probe). Send it to the Admin UI as is, and parse it there for display.
- Running integration specs against a scratch Postgres: use `DB_HOST=localhost`. With any other host, `@medusajs/test-utils` (`configLoaderOverride`) turns on SSL and `beforeAll` hangs until the 60 s timeout with no connection to the test DB. Shell values win over `.env` (`loadEnv` does not override).
- `integration-tests/http/admin/shipment-tracking.spec.ts` still expects the BC shipment read without the environment argument (received `"DK", [...]`); this was missed by task 01's "Also update" and is not fixed here.
- The sync workflow writes the not-found record and still reports `skipped`; a found card clears it in the same single `updateCompaniesStep` call. Task 06's "Use this customer" gets this by nesting `syncCompanyFromBusinessCentralWorkflow`.
- `resolveBusinessCentralAccountWorkflow` now returns `notFound: { at: Date, environment, customerNumber } | null` (null unless all three columns are set). The account step converts `business_central_not_found_at` to a `Date`; the generated `query.graph` type is `Date | string`.
- LCY rule: `resolveCurrencyCode(environment, code)` in `workflows/company/utils/resolve-currency-code.ts` (delegates to `getBusinessCentralLocalCurrency`). Order submission calls it with `"DK"`.
- Verified by a unit run: a step's output is serialised before the next step reads it, so a `new Date()` set in the prepare step reaches `updateCompaniesStep` as an ISO string (MikroORM accepts it). Assert step-to-step timestamps as strings in workflow unit specs.
- `.medusa/types` (gitignored) goes stale after a model change, and typecheck then fails on `query.graph` rows. Without a database, regenerate it with `generate-types.js` in the run scratchpad (`node <script> .` from `apps/backend`), the same `generateTypes` call `medusa build` makes with `skipDbConnection`.
- Running a real workflow in a unit spec with Query and a module replaced: `src/workflows/company/__tests__/sync-company-from-business-central.unit.spec.ts` (register `ContainerRegistrationKeys.QUERY` as `{ graph }` and `COMPANY_MODULE` as `{ listCompanies, updateCompanies }`).
- `--testPathPattern` with an escaped separator (`workflows[\\/]company`) ran every unit suite; use a file-name fragment.

## Task 06

- Routes: `GET /admin/companies/:id/business-central-customer` (status), `GET …/lookup`, `POST …/use` (strict body `{ environment }`, validator `AdminUseBusinessCentralCustomer` in `api/admin/companies/validators.ts`). Response types for the Admin UI in `types/company/http.ts`: `AdminBusinessCentralCustomerResponse`, `AdminBusinessCentralCustomerLookupResponse` (results always `[DK, NO]` in that order), `AdminBusinessCentralCustomerLookupResult`, `AdminUseBusinessCentralCustomer`, `AdminUseBusinessCentralCustomerResponse`; all exported from `types` like `AdminSyncCompanyBusinessCentralResponse`.
- Error answers task 07 must show: lookup and use → 400 when the company has no customer number, 404 unknown company; use → 404 when the card is not in that environment. A BC failure in the use re-read is 500 (or 400 for missing NO configuration); in the lookup it is a per-environment `could_not_check`, never an HTTP error.
- `not_found.at` arrives as an ISO 8601 string; `customer` is null unless `status` is `found`.
- Workflows: `lookupBusinessCentralCustomerWorkflow`, `useBusinessCentralCustomerWorkflow` (re-exported from `workflows/company/workflows/index.ts`). The use workflow keeps the written country when the nested sync reports `failed` (unit-tested).
- Verified: Admin contract cases in `companies.spec.ts` fail locally only with 401 on the Admin request (NIMBUS-236), the same as the existing NIMBUS-254 sync cases (8/8). Admin-free security cases run and pass.
- Runner for integration specs against the scratch Postgres: `run-http-06.sh <path fragment> [-t pattern]` in the run scratchpad.

## Task 07

- Section: `admin/routes/companies/components/company-business-central-customer.tsx` (`CompanyBusinessCentralCustomer`, prop `company`), entry id `business-central-customer` after `company-information` on the company page.
- Hooks: `admin/hooks/api/business-central-customer.tsx` (re-exported from `hooks/api`): `useBusinessCentralCustomer(companyId)`, `useBusinessCentralCustomerLookup(companyId, customerNumber)` (disabled query, run with `refetch()`), `useUseBusinessCentralCustomer(companyId)` (invalidates the company detail and lists on settle).
- The status query key is nested under `companyQueryKey.detail(id)`, so any company invalidation (menu sync, edit drawer, "Use this customer") reloads the section.
- Pitfall: Admin page tests that answer every GET under `/admin/companies/comp_1` with `{ company }` now also hit `…/business-central-customer`; serve that URL a status object (see `company-details-layout.test.tsx`, `company-bc-sync.test.tsx`).
- Pitfall: importing a value from `@medusajs/js-sdk` (e.g. `FetchError`) in an Admin test fails under jsdom (`TransformStream is not defined`); build `Object.assign(new Error(m), { status })` instead and keep production imports type-only.
- Medusa UI `Prompt` renders as `alertdialog` in jsdom; `Prompt.Cancel` closes it without calling the action.
