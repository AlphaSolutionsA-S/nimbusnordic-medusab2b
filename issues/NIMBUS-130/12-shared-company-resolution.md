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

## Deviations

- Renamed `steps/match-company-and-check-duplicate.ts` to `steps/check-duplicate-external-order.ts`
  (`checkDuplicateExternalOrderStep`, step id `check-duplicate-external-order`, input
  `{ company_id, external_order_number }`, no output): the old name no longer fits a step that
  matches no company. Done with `git mv`, so the rename is already staged. The two comments in
  `steps/create-order-external-reference.ts` that named the old step now name the new one.
- Added test case: workflow TC-2 spies on the container logger and asserts exactly one warn line
  carries the customer number and that it does not carry the external order number (decision 12 had
  no test in the intent).
- HTTP TC-5 and the security case assert the exact body `{ type: "not_found", message: "Customer not
  found" }` as well as the absence of the number (stronger than the intent's "does not contain").
- The red run was the workflow TC-2 only (it failed on the old message); the two HTTP cases exercise
  the same step through the route and were run green after the change.

## Done-when evidence

- Unknown number → `NOT_FOUND` "Customer not found", number not echoed:
  `integration-tests/http/order-ingestion/create-order-workflow.spec.ts` "TC-2: rejects an unknown
  customer_number with a generic NOT_FOUND" (passes; failed before the change with the old message).
- Warn line with the number only: same TC-2 (logger spy, one matching warn line, no external order
  number).
- 404 over HTTP with no number in the body: `integration-tests/http/orderapi/orders.spec.ts` "TC-5:
  rejects a request for an unrecognized customerNumber with a 404, synchronously — no order is
  created".
- Security row for `POST /orderapi/orders`: `integration-tests/http/security/security-boundaries.spec.ts`
  "answers an unknown order API customer number without revealing it".
- Duplicate check takes `company_id` and still returns 422 echoing `externalOrderNumber`: unchanged
  workflow TC-3, TC-4, TC-6 and HTTP TC-6 pass.
- Existing success cases pass unchanged: workflow spec 11/11, orders spec 10/10, security spec 25/25.
- Step seam `{ customer_number }` → `{ company_id }`, read-only, no compensation:
  `steps/resolve-company-by-customer-number.ts` (`resolveCompanyByCustomerNumberStep`); used by
  `create-order-from-canonical-payload.ts`.
- Lint: 0 errors (13 pre-existing warnings, none in touched files). Typecheck: 22 errors, baseline
  22 (orders.spec.ts still 7; none in edited lines).
- Also update: the three specs above updated as listed. `issues/NIMBUS-129/03-...` not updated
  (frozen record). No `docs/` or `ai/` file names the old step or message (searched
  `match-company-and-check-duplicate`, `matchCompanyAndCheckDuplicate`, "No company found").
