# 03: Rule home and 403 for switched-off companies on both order API endpoints
**App:** backend · **Layer:** L5 decision fn, L3 step (shared company resolution) · **Depends on:** 01

**Goal:** One pure rule "a company is enabled for the order API"; the shared resolve step uses it so both `POST /orderapi/orders` and `GET /orderapi/shipment-notices` refuse a switched-off company with 403 "Customer not registered for the order API", after the unknown-customer 404 and before anything else.
**Files / areas:** new `src/utils/order-api-access.ts` (pure), `src/workflows/order-ingestion/steps/resolve-company-by-customer-number.ts`, `ai/architecture/decisions.md` (new row: owning file, verdict, consumers intake, notices, discovery, check run, Admin retry).
**Seam contracts:** the rule takes a company row (or none) with `order_api_enabled` and returns a boolean; a missing company or a non-`true` value is not enabled. Tasks 04 and 05 import it. Error: `MedusaError` `FORBIDDEN` with the exact message above (exported constant beside `CUSTOMER_NOT_FOUND_MESSAGE`). The new log line carries the company id only.
**Test intent:**
- Unit: rule returns true only for `true`; false for `false`, null/undefined value and a missing company.
- Contract `orders.spec.ts`: switched-off company → 403, body exactly `{ type, message }` with the fixed message and no customer number or id; no order, external reference or company link for it; a duplicate external number for a switched-off company → 403 (not 422); unknown → 404 unchanged; invalid body → 400 unchanged; switched on → 201.
- Contract `shipment-notices.spec.ts`: switched-off company with stored notices → 403, no notice data; switched back on → 200 with the same notices (R8).
- Security spec: one negative case per endpoint for a switched-off company.
**Done when:** tests pass; every existing spec that drives the order API or the ingestion workflow switches its company on and stays green; lint, typecheck at or below baseline.
**Verify after deploy:** before the go-live step, a Logic App call for one API company returns 403 with the fixed message; after switching it on, the next call returns 201/200.
**Also update:** `integration-tests/http/orderapi/{orders,shipment-notices}.spec.ts`, `integration-tests/http/security/security-boundaries.spec.ts`, `integration-tests/http/order-ingestion/{create-order-workflow,enrich-order-event-chain}.spec.ts`, `integration-tests/utils/shipment-notices.ts` (`createApiCustomerCompany` seeds the company switched on), any other spec found seeding a company for the order API; `ai/architecture/decisions.md`.
