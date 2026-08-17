# Implementation Task 03: Idempotent Create-BC-Return Workflow

> **Depends on tasks 01 and 02.** All ownership, eligibility, idempotency, and reconciliation logic
> lives here — never in the route. Built against the task-01 **stub** service; task 09 swaps the
> stub for real HTTP with **no change to this workflow** (that is the point of the seam).

## Project Environment

- **App root:** `apps/backend`
- **Build command:** `pnpm build`
- **Test command:** `cd apps/backend && pnpm test:integration:modules`
- **File organization:** steps in `src/workflows/business-central-return/steps/`,
  composition in `src/workflows/business-central-return/workflows/` (mirrors
  `src/workflows/approval/`).

## Solution Design

`createBcReturnWorkflow`:

1. **Validate ownership + eligibility** via `bcService.getOrder({ customerNumber, orderId })`
   (NIMBUS-137 read seam). `null` → not owned by the caller's company → `NOT_FOUND` (route → 404,
   no existence leak). `sourceOrderNo` for the BC body comes from the fetched `order.number`.
   For each requested line: its `sourceLineNo` MUST match an `order.lines[].sequence`;
   `quantityToReturn` MUST be `> 0` and `<= line.quantity`; `returnReasonCode` MUST be one of the
   `listReturnReasons()` ids. Reject otherwise with a customer-safe `INVALID_DATA`. Reject duplicate
   `sourceLineNo`. (Final returnable-quantity authority is BC; this is a defensive pre-check.)
2. **Compute the deterministic `requestId`** from `customer_id + order.number + sorted(lines)` via
   `node:crypto` `createHash("sha256")` over a canonical JSON string, formatted as
   `RET-<short-hash>`. Same logical request → same `requestId` → collapses retries to one record and
   one BC document.
3. **Upsert the persistence record** (task 02). If an existing record is already `completed`,
   short-circuit and return its stored BC result. Otherwise ensure a `pending`/`reconciling` record.
4. **Invoke the BC action** (task 01 stub for now) with the mapped params. On success, persist BC
   ids and mark `completed`. On `BusinessCentralAmbiguousOutcomeError` (only reachable once task 09
   lands), mark `reconciling` and rethrow so the caller retries idempotently. On a definitive
   validation rejection, mark `failed` with a customer-safe message and rethrow.

Branching must live **inside steps**, not the composition function.

## Code Skeletons

### New File: `src/workflows/business-central-return/steps/prepare-bc-return.ts`

```typescript
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import { MedusaError } from "@medusajs/framework/utils";
import { BUSINESS_CENTRAL_MODULE } from "../../../modules/business-central";
import { BUSINESS_CENTRAL_RETURN_MODULE } from "../../../modules/business-central-return";
import { BcReturnStatus } from "../../../modules/business-central-return/models";
import type { IBusinessCentralModuleService } from "../../../modules/business-central/types";

export type PrepareBcReturnInput = {
  customerId: string;
  companyId: string;
  bcCustomerNumber: string;
  sourceSalesOrderId: string; // OData GUID (:id from the route) used for getOrder
  lines: {
    sourceLineNo: number;
    quantityToReturn: number;
    returnReasonCode: string;
  }[];
};

export const prepareBcReturnStep = createStep(
  "prepare-bc-return",
  async (input: PrepareBcReturnInput, { container }) => {
    const bcService = container.resolve<IBusinessCentralModuleService>(
      BUSINESS_CENTRAL_MODULE
    );
    const returnService = container.resolve(BUSINESS_CENTRAL_RETURN_MODULE);

    // IMPLEMENT:
    // 1. order = await bcService.getOrder({ customerNumber: input.bcCustomerNumber,
    //    orderId: input.sourceSalesOrderId }). If null -> throw MedusaError NOT_FOUND.
    //    sourceOrderNo = order.number.
    // 2. reasons = await bcService.listReturnReasons(); reasonIds = new Set(reasons.map(r => r.id)).
    // 3. For each input line: find order.lines[] where line.sequence === input.sourceLineNo.
    //    Missing line, quantityToReturn <= 0, quantityToReturn > line.quantity, or
    //    returnReasonCode not in reasonIds -> INVALID_DATA (customer-safe). Reject duplicate
    //    sourceLineNo.
    // 4. requestId = "RET-" + sha256(canonicalJson({ customerId, sourceOrderNo,
    //    lines: sorted by sourceLineNo })).slice(0, 12) (upper-cased).
    // 5. existing = await returnService.listBcReturnRequests({ request_id: requestId }, { take: 1 }).
    //    If existing[0]?.status === COMPLETED -> return StepResponse with
    //    { alreadyCompleted: true, record: existing[0], requestId, sourceOrderNo }.
    // 6. Else upsert: create if none (status PENDING), else reuse existing.id (status
    //    RECONCILING if it was SUBMITTED/RECONCILING, else PENDING). Persist verified lines +
    //    sourceOrderNo. Return StepResponse with { alreadyCompleted: false, record, requestId,
    //    sourceOrderNo, verifiedLines }.
    // Compensation: if a record was newly created, mark it FAILED.
  }
);
```

### New File: `src/workflows/business-central-return/steps/submit-bc-return.ts`

```typescript
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import { BUSINESS_CENTRAL_MODULE } from "../../../modules/business-central";
import { BUSINESS_CENTRAL_RETURN_MODULE } from "../../../modules/business-central-return";
import { BcReturnStatus } from "../../../modules/business-central-return/models";
import { BusinessCentralAmbiguousOutcomeError } from "../../../modules/business-central/service";
import type { IBusinessCentralModuleService } from "../../../modules/business-central/types";

export type SubmitBcReturnInput = {
  alreadyCompleted: boolean;
  requestId: string;
  recordId: string;
  sourceOrderNo: string;
  verifiedLines: {
    sourceLineNo: number;
    quantityToReturn: number;
    returnReasonCode: string;
  }[];
};

export const submitBcReturnStep = createStep(
  "submit-bc-return",
  async (input: SubmitBcReturnInput, { container }) => {
    const returnService = container.resolve(BUSINESS_CENTRAL_RETURN_MODULE);

    // IMPLEMENT:
    // 1. If input.alreadyCompleted -> load the record and return its stored BC result
    //    (map persisted bc_return_order_* fields to a BCReturnOrder-shaped object).
    // 2. Else:
    //    const bcService = container.resolve<IBusinessCentralModuleService>(BUSINESS_CENTRAL_MODULE);
    //    try {
    //      returnOrder = await bcService.createReturnFromSalesOrder({
    //        requestId: input.requestId, sourceOrderNo: input.sourceOrderNo,
    //        lines: input.verifiedLines });
    //      await returnService.updateBcReturnRequests({ id: input.recordId,
    //        status: COMPLETED, bc_return_order_id: returnOrder.id,
    //        bc_return_order_number: returnOrder.number,
    //        bc_return_order_status: returnOrder.status });
    //      return new StepResponse(returnOrder);
    //    } catch (e) {
    //      if (e instanceof BusinessCentralAmbiguousOutcomeError) {
    //        await returnService.updateBcReturnRequests({ id: input.recordId, status: RECONCILING });
    //        throw e; // caller retries; rerun is idempotent on requestId.
    //      }
    //      await returnService.updateBcReturnRequests({ id: input.recordId,
    //        status: FAILED, error_message: <customer-safe message> });
    //      throw e;
    //    }
    // NOTE: with the task-01 stub, only the success branch is exercised; the ambiguous/failed
    // branches become live once task 09 lands. Keep them now so task 09 is a service swap only.
  }
);
```

### New File: `src/workflows/business-central-return/workflows/create-bc-return.ts`

```typescript
import {
  createWorkflow,
  WorkflowResponse,
  transform,
} from "@medusajs/framework/workflows-sdk";
import { prepareBcReturnStep } from "../steps/prepare-bc-return";
import { submitBcReturnStep } from "../steps/submit-bc-return";
import type { PrepareBcReturnInput } from "../steps/prepare-bc-return";

export const createBcReturnWorkflow = createWorkflow(
  "create-bc-return",
  function (input: PrepareBcReturnInput) {
    const prepared = prepareBcReturnStep(input);

    const submitInput = transform({ prepared }, ({ prepared }) => ({
      alreadyCompleted: prepared.alreadyCompleted,
      requestId: prepared.requestId,
      recordId: prepared.record.id,
      sourceOrderNo: prepared.sourceOrderNo,
      verifiedLines: prepared.verifiedLines ?? [],
    }));

    const result = submitBcReturnStep(submitInput);

    return new WorkflowResponse(result);
  }
);
```

### New Files: `steps/index.ts` and `workflows/index.ts`

Re-export the steps and the workflow (mirror `src/workflows/approval/*/index.ts`).

## Test Cases (module tests; the stub is offline so no `fetch` mock is required for the happy path)

- **TC-1 Partial return success:** valid ownership + quantities + reason codes → one stub create
  call → record `completed` with the stub's return ids; workflow returns the `BCReturnOrder`.
- **TC-2 Cross-company:** `getOrder` returns `null` → `NOT_FOUND`; no create call; no completed
  record.
- **TC-3 Quantity exceeds line:** `quantityToReturn > line.quantity` → `INVALID_DATA`; no create.
- **TC-4 Unknown reason code:** `returnReasonCode` not in `listReturnReasons()` → `INVALID_DATA`.
- **TC-5 Idempotent retry:** two runs with identical input reuse the same `request_id`/record and
  yield one logical return (second run short-circuits on the completed record).

## Implementation Steps

1. Create the two steps, the workflow, and the index re-exports.
2. Implement the deterministic `requestId` with `node:crypto`.
3. Add module tests covering TC-1..TC-5 (mock `getOrder`/`listReturnReasons` on the resolved
   service; the create seam is the offline stub).
4. Run `pnpm test:integration:modules` and `pnpm build`.
