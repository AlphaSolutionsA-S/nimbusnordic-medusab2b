# 04: Return creation routed per company
**App:** backend · **Layer:** L6 route, L4 workflow, L3 steps · **Depends on:** 02

**Goal:** A return is validated against the source order and created in the company's environment.
**Files / areas:** `api/store/bc-orders/[id]/returns/route.ts`, `workflows/business-central-return/workflows/create-bc-return.ts`, `workflows/business-central-return/steps/{prepare,submit}-bc-return.ts`.
**Seam contracts:** `PrepareBcReturnInput` gains `environment: BusinessCentralEnvironment`; the workflow passes it to both steps (submit input through `transform`). The route resolves customer number and environment with the task 02 workflow (`{ customerId }`). Request id rule, validation and error mapping unchanged.
**Test intent:**
- Integration (same spec as task 03 or a sibling): a `NO` company's `POST /store/bc-orders/:id/returns` reads the order with `"NO"` and creates the return with `"NO"`; a `DK` company with `"DK"`.
- Negative: the order is not found in the company's environment (module returns `null` for that environment) → 404 "Order not found." and `createReturnFromSalesOrder` not called.
- Existing answers kept: invalid line → 400; ambiguous outcome → 503.
**Done when:** both steps receive the environment from the workflow input only, and typecheck shows no new errors.
**Verify after deploy:** after the customer-portal extension is deployed to TestNO (it is not yet; plan section 10), a test return created by a Norwegian test company's user appears as a sales return order in TestNO, not TestDK. Until then the create fails for NO companies with the existing 500 answer.
**Also update:** none found (no existing spec covers the return route; `security-boundaries.spec.ts` has no return-create case).
