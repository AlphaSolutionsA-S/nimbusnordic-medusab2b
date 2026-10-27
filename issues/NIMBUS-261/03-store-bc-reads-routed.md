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

## Deviations

- Added cases beyond the test intent: a customer without a company gets the same 400 on `GET /store/bc-orders`; every case that expects no BC call stubs the spied method to reject, so a regression cannot reach Business Central.
- The "environment parameter" negative case has two outcomes by route, both allowed by the intent: the two list routes reject it with 400 (their query validators are `.strict()`), and the order detail, return detail and return reasons routes (no query validator) ignore it and still call `"DK"`.
- `return-detail-route.unit.spec.ts` now mocks the account workflow module (as `jobs/__tests__/poll-shipment-notices.unit.spec.ts` does) instead of Query, and its happy path asserts the environment from the workflow result (`"NO"`) reaches `getReturn`. Its `TC-n` comment prefixes were removed while rewriting the file (`no-plan-id-comments`).
- `bc-orders/route.ts`: the unused `MedusaError` import went with the removed `ContainerRegistrationKeys` import line.
- The return reasons route now runs the account workflow (one company read per call) to pick the environment; it still answers without a customer number or company (DK), as before.

## Done-when evidence

- Each route reaches the company's environment (NO / DK / blank country): `integration-tests/http/business-central/store-bc-reads.spec.ts`, `describe.each` "for a company with country %s" (five cases each: lists orders, reads an order, lists returns, reads a return, lists return reasons). Code complete, unverified locally (plan section 2 item 3: no Postgres, NIMBUS-236). Unit: `return-detail-route.unit.spec.ts` "returns the return from the authenticated customer's company environment" (passes).
- No request field selects the environment: same spec, "a request cannot choose the environment" (400 on the list routes, `"DK"` on the detail and return-reasons routes); unverified locally as above.
- Missing customer number → 400 with today's message, unknown order/return → 404, body equals the module result with field types: same spec, "existing answers are kept" and the per-country cases' type assertions; unit spec 400/404 cases (pass).
- None of the five routes queries the customer's company itself: the diff removes every `query.graph` and `ContainerRegistrationKeys` from the five route files; each calls `resolveBusinessCentralAccountWorkflow(req.scope).run({ input: { customerId } })`.
- Each body within 40 lines: GET bodies are 36, 29, 13, 36 and 37 lines (`bc-orders`, `bc-orders/[id]`, `return-reasons`, `bc-returns`, `bc-returns/[number]`).
- Typecheck shows no new errors: `tsc --noEmit -p apps/backend` 22 errors, all in `integration-tests` files untouched here (baseline 22).
- Also update `return-detail-route.unit.spec.ts`: rewritten to mock the workflow boundary; 6 cases pass.
- Also update `security-boundaries.spec.ts` `/store/bc-returns` auth cases: no change needed; the 401 comes from the unchanged `authenticate("customer")` middleware before the route runs.
