# Implementation Task 03: Direct Create-BC-Return Workflow

> **Depends on task 01.** The workflow synchronously validates and invokes the BC service. The
> deterministic `requestId` is passed to BC as its idempotency key; the portal stores no return
> request and an ambiguous BC outcome is immediately returned to the storefront as a customer-safe
> failure.

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
   `RET-<short-hash>`. Same logical request → same `requestId`, which BC uses to collapse retries.
3. **Invoke the BC action** (task 01 stub for now) with the verified values. Return its result
   directly. A `BusinessCentralAmbiguousOutcomeError` is mapped by the HTTP route to a customer-safe
   immediate failure; no local reconciliation or retry state is created.

Branching must live **inside steps**, not the composition function.

## Code Skeletons

### New File: `src/workflows/business-central-return/steps/prepare-bc-return.ts`

```typescript
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import { MedusaError } from "@medusajs/framework/utils";
import { BUSINESS_CENTRAL_MODULE } from "../../../modules/business-central";
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
    // 5. Return StepResponse with { requestId, sourceOrderNo, verifiedLines }.
  }
);
```

### New File: `src/workflows/business-central-return/steps/submit-bc-return.ts`

```typescript
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import { BUSINESS_CENTRAL_MODULE } from "../../../modules/business-central";
import type { IBusinessCentralModuleService } from "../../../modules/business-central/types";

export type SubmitBcReturnInput = {
  requestId: string;
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
    // IMPLEMENT:
    // 1. Resolve the BC service and call createReturnFromSalesOrder with requestId,
    //    sourceOrderNo, and verifiedLines.
    // 2. Return the BC result in StepResponse. Let BC validation and ambiguous-outcome errors
    //    propagate to the route for customer-safe HTTP mapping.
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
      requestId: prepared.requestId,
      sourceOrderNo: prepared.sourceOrderNo,
      verifiedLines: prepared.verifiedLines,
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
  call; workflow returns the `BCReturnOrder`.
- **TC-2 Cross-company:** `getOrder` returns `null` → `NOT_FOUND`; no create call.
- **TC-3 Quantity exceeds line:** `quantityToReturn > line.quantity` → `INVALID_DATA`; no create.
- **TC-4 Unknown reason code:** `returnReasonCode` not in `listReturnReasons()` → `INVALID_DATA`.
- **TC-5 Idempotent retry:** two runs with identical input submit the same deterministic
  `requestId`; the BC contract guarantees that this yields one logical return.

## Implementation Steps

1. Create the two steps, the workflow, and the index re-exports.
2. Implement the deterministic `requestId` with `node:crypto`.
3. Add module tests covering TC-1..TC-5 (mock `getOrder`/`listReturnReasons` on the resolved
   service; the create seam is the offline stub).
4. Run `pnpm test:integration:modules` and `pnpm build`.
