# 03: Store BC order and return reads routed per company
**App:** backend · **Layer:** L6 · **Depends on:** 02

**Goal:** The five store BC read routes reach the logged-in customer's company environment; response shapes and error answers are unchanged.
**Files / areas:** `api/store/bc-orders/route.ts`, `api/store/bc-orders/[id]/route.ts`, `api/store/bc-orders/return-reasons/route.ts`, `api/store/bc-returns/route.ts`, `api/store/bc-returns/[number]/route.ts`.
**Seam contracts:** each route runs the task 02 account workflow with `{ customerId }` from `auth_context` and passes `environment` (and `customerNumber`) to the BC module; return reasons use only `environment`. No request field selects the environment.
**Test intent:**
- Integration (new spec under `integration-tests/http/business-central/`, spying on the BC module as `company-sync.spec.ts` does): for a company with country `NO`, `GET /store/bc-orders`, `/:id`, `/store/bc-returns`, `/:number` and `/store/bc-orders/return-reasons` call the module with `"NO"` and the company's number; for country `DK` and for a blank country, with `"DK"`.
- Negative: an extra `environment=NO` query parameter on a DK company's request does not change the environment (rejected by the validator or ignored).
- Existing behaviour kept: missing customer number → 400 with today's message; unknown order or return → 404; response body equals what the module returned (assert `orders`/`returns` fields' types the storefront reads).
**Done when:** none of the five routes queries the customer's company itself any more, each body stays within 40 lines, and typecheck shows no new errors.
**Verify after deploy:** `GET /store/bc-returns` and `GET /store/bc-orders` as a user of one Norwegian test company (country `NO`; most TestNO cards have a blank country, so fill it or use one of the two `NO` cards) return documents that exist in TestNO, not TestDK. Return reasons, open return detail and order reservations only after the customer-portal extension is deployed to TestNO; until then those calls fail for NO companies (plan flow A8).
**Also update:** `src/api/store/bc-returns/__tests__/return-detail-route.unit.spec.ts` (mocks the customer query the route no longer runs: move its cases to the integration spec or mock the workflow boundary, never assert call order of framework services); `security-boundaries.spec.ts` `/store/bc-returns` auth cases (unchanged, keep passing).
