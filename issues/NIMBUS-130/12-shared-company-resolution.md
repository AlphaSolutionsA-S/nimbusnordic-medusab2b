# 12: One company-resolution step with a generic 404 (fixes NIMBUS-192)
**App:** backend · **Layer:** L3 (shared step), L4 (order-ingestion workflow wiring) · **Depends on:** None

**Goal:** Resolve a company from a BC customer number in one step, used by `POST /orderapi/orders`
now and by the shipment-notice read workflow (task 09). An unknown number gives a 404 with a fixed
generic message and no identifier; the number is logged server-side only. This fixes NIMBUS-192.
**Files / areas:**
- `apps/backend/src/workflows/order-ingestion/steps/` (new step; `match-company-and-check-duplicate.ts`
  keeps only the duplicate check);
- `workflows/order-ingestion/workflows/create-order-from-canonical-payload.ts` (wiring).
**Seam contracts:**
- Step input `{ customer_number }`, output `{ company_id }`. It is read-only and has no compensation.
  Task 09 imports this step (`file-shared-step`).
- Unknown number → `MedusaError` `NOT_FOUND` with the fixed message "Customer not found". Medusa's
  handler returns it as 404 `{ type: "not_found", message }` (verified, see below).
- Before throwing, it logs one warn line with the customer number and no other data (decision 12).
- The duplicate check takes `company_id` and still returns 422 echoing the caller's own
  `externalOrderNumber` (decision 13).
**Test intent:**
- HTTP (`integration-tests/http/order-ingestion/create-order-workflow.spec.ts` TC-2): the message
  equals "Customer not found" and does not contain the customer number.
- HTTP (`integration-tests/http/orderapi/orders.spec.ts` TC-5): 404, and the response body (as text)
  does not contain the customer number.
- Security (`security-boundaries.spec.ts`): the same negative case for `POST /orderapi/orders`, so the
  order API has a row there (task 09 adds the GET).
- The existing duplicate (422) and success cases still pass unchanged.
**Done when:** tests updated; lint and typecheck at or below the baseline.
**Verify after deploy:** `POST /orderapi/orders?customerNumber=<unknown>` through the Logic App
returns 404 with `message` "Customer not found", and the Medusa runtime log has the warn line.
**Also update:** the three specs above. `issues/NIMBUS-129/03-create-order-workflow-implementation.md`
quotes the old message; it is a frozen record and is not updated.
