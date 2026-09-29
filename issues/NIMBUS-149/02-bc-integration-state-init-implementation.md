# Task 02: Business Central Integration-State Contract + Initialization — Implementation Plan

**Status:** DONE (2026-09-29)
**App:** backend
**App Root:** apps/backend
**Task ID:** 02
**Date:** 2026-09-29
**Branch:** feature/NIMBUS-149 (from develop)
**Depends on:** Task 01 (modifies `create-ingested-order.ts`, which Task 01 creates)

---

## Project Environment

- **App root:** `apps/backend`
- **Build command:** `pnpm build` (from repo root)
- **Lint command:** `pnpm lint` (from repo root)
- **Test commands:** `cd apps/backend && pnpm test:unit` (contract) and
  `cd apps/backend && pnpm test:integration:http` (workflow)
- **Test framework:** Jest (`@swc/jest`); `medusaIntegrationTestRunner` for the workflow test
- **Test locations:** `apps/backend/src/modules/order-ingestion/__tests__/*.unit.spec.ts` — the
  file name MUST end in `.unit.spec.ts` or `pnpm test:unit` will not collect it — and
  `apps/backend/integration-tests/http/order-ingestion/create-order-workflow.spec.ts`
- **Conventions:** double quotes, 2-space indent, named exports, `type` aliases for unions.

## Why this task exists

NIMBUS-149's scope requires a Business Central integration-state object, under its own `metadata`
key separate from the raw payload, initialized when the order is persisted: a BC order id
(initially null), a delivery status (initially pending), timestamp(s), and a retry/attempt count
(initially zero). Nothing on `develop` writes this yet — the order currently carries only
`company_id`, `canonical_order`, `order_ingestion_state`, `order_ingestion_state_updated_at`.

### The contract is adopted from NIMBUS-148, not invented here

NIMBUS-148's plan (`issues/NIMBUS-148/01-bc-integration-state-contract-implementation.md`,
pending approval) already defines the authoritative shape and states: *"NIMBUS-149 must import
`createInitialBcIntegrationState` and `BC_INTEGRATION_STATE_METADATA_KEY` from that file rather
than inventing its own names."* NIMBUS-148 updates this object and NIMBUS-158 displays it; if the
names drift, NIMBUS-148 reads nothing and every order records `failed`. So this task:

- creates `apps/backend/src/modules/order-ingestion/bc-integration-state.ts` containing, **verbatim
  from NIMBUS-148 Task 01**, the metadata key, the four types and `createInitialBcIntegrationState`;
- does **not** add `parseBcIntegrationState`, `hasBusinessCentralOrder` or the constant arrays —
  NIMBUS-149 has no reader; NIMBUS-148 Task 01 appends them to this same file (see manifest
  "Cross-story reconciliation").

This supersedes the earlier NIMBUS-149 plan's `bc_integration_state` / `retry_count` /
`timestamp` placeholder shape. The adopted names are:

| Scope requirement | Field | Initial value |
|---|---|---|
| Metadata key (separate from `canonical_order`) | `business_central_integration` | — |
| BC order identifier | `bc_order_id` (+ `bc_order_number`) | `null` |
| Delivery status | `status: "pending" \| "sent" \| "failed"` | `"pending"` |
| Initialization timestamp | `initialized_at` (+ `last_attempt_at`, `sent_at`) | ISO now / `null` / `null` |
| Retry count | `attempt_count` (total attempts, per NIMBUS-148 semantics) | `0` |
| Partial / line failure detail (NIMBUS-148) | `partial`, `failure_reason`, `line_failures` | `false`, `null`, `[]` |

Security: the object holds no token, credential or secret.

## Code Skeletons

### New File: `apps/backend/src/modules/order-ingestion/bc-integration-state.ts`

```typescript
/**
 * Business Central integration-state contract stored on `Order.metadata`.
 *
 * Ownership note: NIMBUS-149 initializes this object to its pending state when it persists the
 * Medusa order; NIMBUS-148 updates it with the delivery outcome; NIMBUS-158 reads it for the
 * Medusa Admin status/retry widget. This file is the single source of truth for its shape — all
 * three stories import from here rather than restating field names.
 */

export const BC_INTEGRATION_STATE_METADATA_KEY = "business_central_integration";

export type BcIntegrationStatus = "pending" | "sent" | "failed";

export type BcOrderLineFailureReason =
  | "no_identifiers"
  | "not_found"
  | "ambiguous"
  | "rejected_by_bc";

export type BcOrderLineFailure = {
  line_number: number;
  ean_no: string | null;
  item_number: string | null;
  cust_item_no: string | null;
  reason: BcOrderLineFailureReason;
  message: string | null;
};

export type BcIntegrationState = {
  status: BcIntegrationStatus;
  bc_order_id: string | null;
  bc_order_number: string | null;
  attempt_count: number;
  initialized_at: string | null;
  last_attempt_at: string | null;
  sent_at: string | null;
  partial: boolean;
  failure_reason: string | null;
  line_failures: BcOrderLineFailure[];
};

/**
 * The initial, not-yet-sent state. NIMBUS-149 calls this when it creates the Medusa order.
 */
export function createInitialBcIntegrationState(
  initializedAt: string
): BcIntegrationState {
  return {
    status: "pending",
    bc_order_id: null,
    bc_order_number: null,
    attempt_count: 0,
    initialized_at: initializedAt,
    last_attempt_at: null,
    sent_at: null,
    partial: false,
    failure_reason: null,
    line_failures: [],
  };
}
```

### Modified File: `apps/backend/src/workflows/order-ingestion/steps/create-ingested-order.ts`

Add the import:

```typescript
import {
  BC_INTEGRATION_STATE_METADATA_KEY,
  createInitialBcIntegrationState,
} from "../../../modules/order-ingestion/bc-integration-state";
```

Replace the `createOrders` call body (from Task 01) with — one shared timestamp, one new key:

```typescript
    const now = new Date().toISOString();

    const order = await orderModuleService.createOrders({
      currency_code: input.canonicalOrder.currencyCode,
      email: input.canonicalOrder.email,
      metadata: {
        company_id: input.companyId,
        canonical_order: input.canonicalOrder,
        order_ingestion_state: "created",
        order_ingestion_state_updated_at: now,
        [BC_INTEGRATION_STATE_METADATA_KEY]:
          createInitialBcIntegrationState(now),
      },
    });
```

Update the step's leading comment to mention that the Business Central integration state starts
at `pending` (one clause; keep the rest of the comment).

No other file changes. `updateOrderIngestionStateStep` already read-merge-writes metadata, so the
new key survives `enrichOrderWorkflow` untouched (asserted by TC-3).

## Impacted Files

| File | Change |
|---|---|
| `apps/backend/src/modules/order-ingestion/bc-integration-state.ts` | **New** — `BC_INTEGRATION_STATE_METADATA_KEY`, `BcIntegrationStatus`, `BcOrderLineFailureReason`, `BcOrderLineFailure`, `BcIntegrationState`, `createInitialBcIntegrationState(initializedAt: string): BcIntegrationState` |
| `apps/backend/src/modules/order-ingestion/__tests__/bc-integration-state.unit.spec.ts` | **New** — TC-1 |
| `apps/backend/src/workflows/order-ingestion/steps/create-ingested-order.ts` | Metadata gains `business_central_integration`; shared `now` timestamp |
| `apps/backend/integration-tests/http/order-ingestion/create-order-workflow.spec.ts` | Add TC-2 |
| `apps/backend/integration-tests/http/order-ingestion/enrich-order-event-chain.spec.ts` | Add TC-3 |

## Test Cases

### TC-1 (unit, happy path): the initial state is pending with a zero attempt count
- **Given:** the timestamp `"2026-09-29T10:00:00.000Z"`
- **When:** `createInitialBcIntegrationState` is called
- **Then:** it equals the full pending object (status `pending`, ids `null`, `attempt_count` `0`,
  `initialized_at` the timestamp, other timestamps `null`, `partial` `false`, `failure_reason`
  `null`, `line_failures` `[]`)

### TC-2 (workflow, wiring): a created order carries the initialized state under its own key
- **Given:** a company and `singleLineCanonicalOrder`
- **When:** `createOrderFromCanonicalPayloadWorkflow` runs and the order is re-read from the DB
- **Then:** `metadata.business_central_integration` equals the pending state with
  `initialized_at` equal to `metadata.order_ingestion_state_updated_at`; `metadata.canonical_order`
  is still present and separate; no `bc_integration_state` key exists

### TC-3 (workflow, edge case): enrichment does not disturb the integration state
- **Given:** an ingested order
- **When:** `enrichOrderWorkflow` runs
- **Then:** `order_ingestion_state` is `ready_for_business_central` and
  `metadata.business_central_integration` is byte-identical to its value before enrichment

### New File: `apps/backend/src/modules/order-ingestion/__tests__/bc-integration-state.unit.spec.ts`

NIMBUS-148 Task 01 later appends its own `describe` blocks to this file — keep the `describe`
name below so the two do not collide.

```typescript
import { createInitialBcIntegrationState } from "../bc-integration-state";

describe("createInitialBcIntegrationState", () => {
  it("TC-1: starts pending with a zero attempt count and no BC order", () => {
    const state = createInitialBcIntegrationState("2026-09-29T10:00:00.000Z");

    expect(state).toEqual({
      status: "pending",
      bc_order_id: null,
      bc_order_number: null,
      attempt_count: 0,
      initialized_at: "2026-09-29T10:00:00.000Z",
      last_attempt_at: null,
      sent_at: null,
      partial: false,
      failure_reason: null,
      line_failures: [],
    });
  });
});
```

### Test Skeleton — add to `create-order-workflow.spec.ts` (inside the existing `describe`)

Add the import:

```typescript
import {
  BC_INTEGRATION_STATE_METADATA_KEY,
  createInitialBcIntegrationState,
} from "../../../src/modules/order-ingestion/bc-integration-state";
```

```typescript
      it("TC-7: initializes the Business Central integration state under its own metadata key (NIMBUS-149 contract)", async () => {
        const container = getContainer();
        const companyService =
          container.resolve<ICompanyModuleService>(COMPANY_MODULE);
        const orderModuleService = container.resolve<IOrderModuleService>(
          Modules.ORDER
        );

        await companyService.createCompanies({
          name: "TC-7 Company",
          email: "tc7@example.com",
          business_central_customer_number: "tc7-customer-number",
        });

        const { result: order } = await createOrderFromCanonicalPayloadWorkflow(
          container
        ).run({
          input: {
            customer_number: "tc7-customer-number",
            canonicalOrder: {
              ...singleLineCanonicalOrder,
              externalOrderNumber: "BC-STATE-1",
            },
          },
        });

        const persisted = await orderModuleService.retrieveOrder(order.id, {
          select: ["id", "metadata"],
        });
        const metadata = persisted.metadata ?? {};

        expect(metadata[BC_INTEGRATION_STATE_METADATA_KEY]).toEqual(
          createInitialBcIntegrationState(
            metadata.order_ingestion_state_updated_at as string
          )
        );
        expect(metadata.canonical_order).toBeDefined();
        expect(metadata).not.toHaveProperty("bc_integration_state");
      });
```

(Name it TC-7 in the file: the existing file has TC-1..TC-4 and Task 01 adds TC-5/TC-6.)

### Test Skeleton — add to `enrich-order-event-chain.spec.ts` (inside the existing `describe`)

Add the import:

```typescript
import { BC_INTEGRATION_STATE_METADATA_KEY } from "../../../src/modules/order-ingestion/bc-integration-state";
```

```typescript
      it("TC-4: enrichOrderWorkflow preserves the Business Central integration state (read-merge-write)", async () => {
        const container = getContainer();
        const orderModuleService = container.resolve<IOrderModuleService>(
          Modules.ORDER
        );
        const order = await createTestOrder(
          container,
          "tc4-bc-state-customer",
          "TC4-BC-STATE-ORDER"
        );

        const before = await orderModuleService.retrieveOrder(order.id, {
          select: ["id", "metadata"],
        });

        await enrichOrderWorkflow(container).run({
          input: { order_id: order.id },
        });

        const after = await orderModuleService.retrieveOrder(order.id, {
          select: ["id", "metadata"],
        });

        expect(after.metadata?.order_ingestion_state).toEqual(
          "ready_for_business_central"
        );
        expect(after.metadata?.[BC_INTEGRATION_STATE_METADATA_KEY]).toEqual(
          before.metadata?.[BC_INTEGRATION_STATE_METADATA_KEY]
        );
      });
```

(Named TC-4 in that file: it already has TC-1..TC-3. This is plan TC-3.)

## Implementation Steps

1. Create `bc-integration-state.ts` exactly as shown — field names and the key string are a
   cross-story contract; do not rename anything.
2. Create `bc-integration-state.unit.spec.ts` exactly as shown.
3. Edit `create-ingested-order.ts`: add the import, introduce `const now`, add the new metadata key.
4. Add the two workflow test cases and their imports.
5. Run `pnpm test:unit`, then `pnpm test:integration:http` (run the order-ingestion suites
   individually if the known hook-timeout flake appears).
6. Run `pnpm build` and `pnpm lint` from the repo root.
