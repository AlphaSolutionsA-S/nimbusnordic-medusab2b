# Implementation Task 01: BC Return Service Stub + Return-Reason Dummy Provider + Types

**Status:** Completed 2026-08-17

> **Not gated. This is the first task.** It ships a *stub* write seam and a *dummy* return-reason
> provider on the BC module so the whole vertical slice (tasks 02–07) can be built and demoed
> against fakes. The **real** BC HTTP call and the return-reason source are deferred to tasks 08–09.
> Every stub MUST carry a `// STUB (NIMBUS-138 task 09):` comment so the swap point is greppable.

## Assumed BC contract (documented, not yet sandbox-verified)

The real BC action is assumed to accept this request body (confirmed as the plan's working
assumption; task 08 verifies/adjusts it):

```json
{
  "requestId": "RET-000123",
  "sourceOrderNo": "SO123456",
  "lines": [
    { "sourceLineNo": 10000, "quantityToReturn": 2, "returnReasonCode": "DAMAGED" },
    { "sourceLineNo": 30000, "quantityToReturn": 1, "returnReasonCode": "WRONGITEM" }
  ]
}
```

Field mapping to NIMBUS-137 read data (`bcService.getOrder`):

| BC body field         | Source in portal                              | Notes |
|-----------------------|-----------------------------------------------|-------|
| `requestId`           | server-generated deterministic idempotency key | doubles as the idempotency identifier; BC is assumed idempotent on it |
| `sourceOrderNo`       | `BCOrderDetail.number`                          | human order no., not the OData GUID |
| `lines[].sourceLineNo`| `BCOrderLine.sequence`                          | BC line no.; **task 08 must confirm** `sequence === "Line No."` |
| `lines[].quantityToReturn` | UI quantity, validated `> 0` and `<= line.quantity` | |
| `lines[].returnReasonCode` | UI per-line dropdown value; an `id` from `listReturnReasons()` | |

## Project Environment

- **App root:** `apps/backend`
- **Build command:** `pnpm build` (from repo root) or `cd apps/backend && pnpm build`
- **Lint command:** `pnpm lint`
- **Test command:** `cd apps/backend && pnpm test:integration:modules`
- **Test location:** `apps/backend/src/modules/business-central/__tests__/`
- **Naming conventions:** kebab-case files, camelCase vars/functions, PascalCase types

## Solution Design

Extend the Business Central module with two seams that return deterministic fakes — **no network
calls**:

1. `createReturnFromSalesOrder(params)` — accepts the assumed-contract params, echoes back a
   synthetic `BCReturnOrder` (fabricated return number derived from `requestId`, `status: "Open"`,
   the submitted lines). This is the seam tasks 03/04 call and task 09 replaces with real HTTP.
2. `listReturnReasons()` — a dummy data provider returning a hardcoded `{ id, description }[]`.

Also define the `BusinessCentralAmbiguousOutcomeError` sentinel now (unused by the stub, but the
workflow in task 03 references it), so task 09 has nothing new to wire into the workflow.

Field names in the TypeScript types mirror the assumed BC body (`sourceOrderNo`, `sourceLineNo`,
`quantityToReturn`, `returnReasonCode`, `requestId`) so tasks 02–07 speak one vocabulary.

## Code Skeletons

### Modified File: `apps/backend/src/modules/business-central/types.ts`

Add after the existing `getOrder` result types:

```typescript
export type BCReturnLineInput = {
  sourceLineNo: number;
  quantityToReturn: number;
  returnReasonCode: string;
};

export type BCCreateReturnParams = {
  requestId: string; // server-generated deterministic idempotency key
  sourceOrderNo: string;
  lines: BCReturnLineInput[];
};

export type BCReturnLine = {
  sourceLineNo: number;
  quantityToReturn: number;
  returnReasonCode: string;
};

export type BCReturnOrder = {
  id: string;
  number: string;
  status: string;
  requestId: string;
  sourceOrderNo: string;
  lines: BCReturnLine[];
};

export type BCReturnReason = {
  id: string;
  description: string;
};
```

Extend the interface:

```typescript
export interface IBusinessCentralModuleService {
  getOperations(): Promise<unknown>;
  listOrders(params: BCListOrdersParams): Promise<BCListOrdersResult>;
  getOrder(params: BCGetOrderParams): Promise<BCOrderDetail | null>;
  createReturnFromSalesOrder(params: BCCreateReturnParams): Promise<BCReturnOrder>;
  listReturnReasons(): Promise<BCReturnReason[]>;
}
```

### Modified File: `apps/backend/src/modules/business-central/service.ts`

Add the sentinel error near the top-level helpers (exported for the workflow):

```typescript
// Thrown when a BC write reached BC but the outcome is unknown (timeout / 5xx / no body).
// The workflow reconciles these with the idempotency key instead of failing outright.
// NOTE: the task-01 stub never throws this; task 09 (real HTTP) does.
export class BusinessCentralAmbiguousOutcomeError extends Error {
  constructor(
    message: string,
    readonly idempotencyKey: string
  ) {
    super(message);
    this.name = "BusinessCentralAmbiguousOutcomeError";
  }
}
```

Add the two methods to `BusinessCentralModuleService` (read methods unchanged):

```typescript
// STUB (NIMBUS-138 task 09): replace with the real BC custom-action HTTP call.
// Returns a deterministic fake success; performs NO network I/O.
async createReturnFromSalesOrder(
  params: BCCreateReturnParams
): Promise<BCReturnOrder> {
  // IMPLEMENT:
  // 1. Defensive shape checks (params.sourceOrderNo non-empty; lines.length > 0;
  //    each line quantityToReturn > 0). These are belt-and-braces; the workflow (task 03)
  //    already validated against getOrder.
  // 2. Return a synthetic BCReturnOrder:
  //    {
  //      id: `bcret_stub_${params.requestId}`,
  //      number: params.requestId,          // e.g. "RET-000123"
  //      status: "Open",
  //      requestId: params.requestId,
  //      sourceOrderNo: params.sourceOrderNo,
  //      lines: params.lines.map((l) => ({
  //        sourceLineNo: l.sourceLineNo,
  //        quantityToReturn: l.quantityToReturn,
  //        returnReasonCode: l.returnReasonCode,
  //      })),
  //    }
  // 3. Do NOT call fetch / requestToken / getCustomerId here — the stub is offline.
}

// STUB (NIMBUS-138 task 09): replace with the real BC return-reason source (or confirm
// these codes are static and keep as config). Dummy data provider: { id, description }.
async listReturnReasons(): Promise<BCReturnReason[]> {
  return [
    { id: "DAMAGED", description: "Item arrived damaged or defective" },
    { id: "WRONGITEM", description: "Wrong item was delivered" },
    { id: "NOTORDERED", description: "Item was not ordered by the customer" },
    { id: "QUALITY", description: "Item does not meet expected quality" },
    { id: "OTHER", description: "Other reason (specified separately)" },
  ];
}
```

## Test Cases (module tests — no `fetch` mock needed; the stub is offline)

### TC-1: Stub returns deterministic return order
- **Given:** valid `BCCreateReturnParams`.
- **When:** `createReturnFromSalesOrder(params)` is called twice with identical input.
- **Then:** both calls resolve to an identical `BCReturnOrder` whose `number === params.requestId`
  and whose `lines` echo the input; no `global.fetch` call is made.

### TC-2: Return reasons provider shape
- **When:** `listReturnReasons()` is called.
- **Then:** it resolves to a non-empty array where every entry has a non-empty string `id` and a
  longer string `description`; `id` values are unique.

### TC-3: Stub input guard
- **Given:** empty `lines` or a non-positive `quantityToReturn`.
- **When:** `createReturnFromSalesOrder` is called.
- **Then:** it throws (defensive), so a mis-wired caller fails loudly rather than fabricating a
  bad return.

## Implementation Steps

1. Add the return/reason types and extend `IBusinessCentralModuleService` in `types.ts`.
2. Add the sentinel error class and the two stub methods in `service.ts`.
3. Add `__tests__/return-stub.spec.ts` covering TC-1..TC-3.
4. Run `pnpm test:integration:modules` and `pnpm build`.
