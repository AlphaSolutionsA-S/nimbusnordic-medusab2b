# Branch notes: NIMBUS-243

## Task 01

- Backend store contract for `POST /store/companies/:id/employees`: `email` (valid email) and `password` (min 8) required; `first_name`, `last_name`, `phone`, `spending_limit`, `is_admin`, `country_code` optional; `customer_id` or any other key is refused with 400 (strict zod schema, `apps/backend/src/api/store/companies/validators.ts`).
- Backend `StoreCreateEmployee` type in `apps/backend/src/types/company/http.ts` no longer has `customer_id`; its other optional fields (`email?`, `password?`) were left as they were (type is unused by runtime code).
- The store route now always runs `createEmployeeAccountWorkflow`; `createEmployeesWorkflow` is used only by the Admin route.
- Typecheck after task 01: still 22 errors, same lines as the baseline.

## Task 02

- Storefront `StoreCreateEmployee` (`apps/storefront/src/types/company/http.ts`) no longer has `customer_id`; the other fields are unchanged. Its only user is `createEmployee` in `apps/storefront/src/lib/data/companies.ts`.
- Storefront typecheck after task 02: 8 errors, the same as the baseline. A diff shows one changed line in `account-nav.test.tsx(101,24)`, where tsc printed the properties in a different order; it is the same error.
- Storefront `next lint` exits early unless `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY` is set; a placeholder value is enough for linting.
