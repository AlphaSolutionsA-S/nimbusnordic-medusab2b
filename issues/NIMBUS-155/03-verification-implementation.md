# Implementation Task 03: Verification

**Status:** Validation blocked - backend HTTP integration tests require a configured PostgreSQL password.

## Project Environment

- **Repo root commands:** `pnpm lint`, `pnpm build`
- **Storefront tests:** `cd apps/storefront && pnpm test`
- **Backend integration tests:** `cd apps/backend && pnpm test:integration:http`

## Depends On

Tasks 01 (storefront) and 02 (backend) must be complete.

## Verification Steps

1. **Storefront tests:** `cd apps/storefront && pnpm test` — the new `company-card-bc-readonly` test passes (read-only presentation, payload excludes BC).
2. **Backend integration tests:** `cd apps/backend && pnpm test:integration:http` — the companies spec passes with the rewritten BC cases (create and update rejected with 400; unchanged-value and absent-field cases green).
3. **Lint:** `pnpm lint` passes for both apps (no unused-binding warnings from the storefront destructure change).
4. **Build / type-check:** `pnpm build` passes; the removed BC field from `StoreCreateCompany` does not break any storefront consumer (create flow already omits it).

## Acceptance Checklist

- [ ] Storefront edit view shows BC number read-only when configured; hidden when not configured.
- [ ] Saving unrelated storefront company fields does not include or change the BC number.
- [ ] `POST /store/companies` and `POST /store/companies/:id` return 400 when the body contains `business_central_customer_number`; persisted value on update is unchanged.
- [ ] Normal Store create/update (without the BC field) still succeed.
- [ ] Admin create/update still accept and persist the BC number (no Admin files changed).
- [ ] `pnpm lint` and `pnpm build` pass; storefront and backend focused test suites pass.

## Constraints

- Do not change code in this task beyond fixes strictly required to make lint/build/tests pass for the Task 01/02 changes. Report any unexpected failures rather than expanding scope.
