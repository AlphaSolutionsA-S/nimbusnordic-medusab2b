# Task 01: Admin API Routes for BC Integration Status and Submission

**Status:** TODO
**App:** backend
**App Root:** apps/backend
**Task ID:** 01
**Date:** 2026-09-02
**Branch:** feature/NIMBUS-158 (from develop)
**Depends on:** NIMBUS-148 (workflow), NIMBUS-149 (metadata contract)

---

## Project Environment

- **App root:** `apps/backend`
- **Build command:** `pnpm build` (from repo root) or `cd apps/backend && pnpm build`
- **Lint command:** `pnpm lint` (from repo root)
- **Test command:** `cd apps/backend && pnpm test:integration:http`
- **Test framework:** Jest, `medusaIntegrationTestRunner` from `@medusajs/test-utils`
- **Test location:** `apps/backend/integration-tests/http/**/*.spec.ts`
- **Naming conventions:** route/validator files kebab-case, route handlers as **named exports**
  (`GET`, `POST`), Zod schemas as **named exports**.

## Context

NIMBUS-158 needs two admin API endpoints:

1. **GET** — read the order's BC integration state from `metadata` and return a sanitized
   response (no raw canonical payload, no secrets).
2. **POST** — start NIMBUS-148's reusable BC submission workflow asynchronously, with an optional
   `force_resend` flag.

These routes follow the existing admin API route patterns in `apps/backend/src/api/admin/`
(companies, quotes, approvals). Admin session authentication is applied by default to all
`/admin/*` routes by Medusa — no explicit auth middleware is needed.

### Dependency contracts (must be reconciled with actual implementations)

The exact metadata key name and field shapes depend on NIMBUS-149 and NIMBUS-148, which are
scoped but not yet implemented. This task uses the following placeholder contract based on their
SCOPE.md documents:

```typescript
// Order.metadata.bc_integration_state (exact key name TBD by NIMBUS-149)
interface BcIntegrationState {
  bc_order_id: string | null
  status: 'pending' | 'sent' | 'failed'
  timestamp: string
  retry_count: number
  // NIMBUS-148 may add: partial_submission: boolean, line_failures: Array<{ line_id, reason }>
}
```

The BC submission workflow (exact name TBD by NIMBUS-148):

```typescript
// Placeholder — replace with actual import from NIMBUS-148's workflow
export const submitOrderToBusinessCentralWorkflow = createWorkflow(...)
// Input: { order_id: string, force_resend?: boolean }
```

**The implementor MUST verify and reconcile these contracts against the actual implemented code
from NIMBUS-148 and NIMBUS-149 before writing the route handlers.**

## Solution Design

### Route structure

```
apps/backend/src/api/admin/orders/[id]/bc-integration/
├── route.ts              # GET /admin/orders/:id/bc-integration
├── validators.ts         # Zod schemas for request body
├── middlewares.ts        # MiddlewareRoute array
└── submit/
    └── route.ts           # POST /admin/orders/:id/bc-integration/submit
```

### GET handler — read BC integration state

Reads the order by ID, extracts `bc_integration_state` from `metadata`, and returns a sanitized
response. Does **not** return the raw `canonical_order` metadata key or any other metadata.

If the order has no `bc_integration_state` metadata (e.g. orders not created by the ingestion
pipeline), returns a default "not tracked" response with `status: null`.

If the order does not exist, returns 404 (Medusa's default behavior for `retrieveOrder`).

### POST handler — start BC submission

1. Validates the body: `{ force_resend?: boolean }` (defaults to `false`).
2. Reads the order's current `bc_integration_state` to check for an in-progress submission
   (concurrency guard). If `status` indicates a submission is already in progress, returns 409.
3. Fires NIMBUS-148's workflow **without awaiting it** (fire-and-forget, same pattern as
   NIMBUS-129 Task 05's event emission). Returns 202 immediately.
4. If the workflow cannot be started (e.g. module not registered), returns 500.

**Async trigger mechanism:** The implementor must verify how NIMBUS-148's workflow is triggered.
If it is a subscriber-based workflow (triggered by `order_ingestion.ready_for_business_central`),
the POST route should emit that event (or a new `order_ingestion.admin_retry_requested` event)
instead of calling the workflow directly. If it is a directly callable workflow, use
`workflow.run({ input, container: req.scope })` without awaiting the promise.

### Concurrency guard

The POST route checks `bc_integration_state.status` before starting. If the status is
`'pending'` and the timestamp is very recent (indicating a submission was just started), or if
NIMBUS-148 uses a dedicated in-progress status (e.g. `'submitting'`), the route returns 409.

The exact in-progress indicator depends on NIMBUS-148's implementation. The implementor must
verify what NIMBUS-148 writes to metadata at the start of its workflow and check for that.

### Sanitization

The GET response contains only:
- `status` — the BC integration status string
- `bc_order_id` — the BC order identifier or null
- `retry_count` — the number of submission attempts
- `timestamp` — the last-updated timestamp
- `partial_submission` — (if NIMBUS-148 records it) whether the last submission was partial
- `line_failures` — (if NIMBUS-148 records them) per-line resolution failure records

The GET response does **not** contain:
- The raw `canonical_order` payload
- Any credentials, tokens, or customer data
- Internal exception details or stack traces

## Code Skeletons

### New File: `apps/backend/src/api/admin/orders/[id]/bc-integration/validators.ts`

```typescript
import { z } from 'zod';

export const AdminSubmitOrderToBc = z.object({
  force_resend: z.boolean().optional().default(false),
});

export type AdminSubmitOrderToBcType = z.infer<typeof AdminSubmitOrderToBc>;
```

### New File: `apps/backend/src/api/admin/orders/[id]/bc-integration/route.ts`

```typescript
import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from '@medusajs/framework';
import { Modules } from '@medusajs/framework/utils';
import type { IOrderModuleService } from '@medusajs/framework/types';

// TODO: Replace with actual metadata key name from NIMBUS-149
const BC_INTEGRATION_STATE_KEY = 'bc_integration_state';

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const orderModuleService =
    req.scope.resolve<IOrderModuleService>(Modules.ORDER);

  const order = await orderModuleService.retrieveOrder(req.params.id, {
    select: ['id', 'metadata'],
  });

  const bcState = (order.metadata?.[BC_INTEGRATION_STATE_KEY] ?? null) as {
    bc_order_id: string | null;
    status: string | null;
    timestamp: string | null;
    retry_count: number;
    partial_submission?: boolean;
    line_failures?: Array<{ line_id: string; reason: string }>;
  } | null;

  res.json({
    bc_integration: {
      status: bcState?.status ?? null,
      bc_order_id: bcState?.bc_order_id ?? null,
      retry_count: bcState?.retry_count ?? 0,
      timestamp: bcState?.timestamp ?? null,
      partial_submission: bcState?.partial_submission ?? false,
      line_failures: bcState?.line_failures ?? [],
    },
  });
};
```

### New File: `apps/backend/src/api/admin/orders/[id]/bc-integration/submit/route.ts`

```typescript
import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from '@medusajs/framework';
import { MedusaError, Modules } from '@medusajs/framework/utils';
import type { IOrderModuleService } from '@medusajs/framework/types';
import type { AdminSubmitOrderToBcType } from '../validators';

// TODO: Replace with actual imports from NIMBUS-148
// import { submitOrderToBusinessCentralWorkflow } from '../../../../../workflows/business-central-order/workflows/submit-order-to-business-central';

// TODO: Replace with actual metadata key name from NIMBUS-149
const BC_INTEGRATION_STATE_KEY = 'bc_integration_state';

// TODO: Replace with actual in-progress status value from NIMBUS-148
const IN_PROGRESS_STATUSES = ['pending', 'submitting'];

export const POST = async (
  req: AuthenticatedMedusaRequest<AdminSubmitOrderToBcType>,
  res: MedusaResponse
) => {
  const orderModuleService =
    req.scope.resolve<IOrderModuleService>(Modules.ORDER);

  const order = await orderModuleService.retrieveOrder(req.params.id, {
    select: ['id', 'metadata'],
  });

  const bcState = (order.metadata?.[BC_INTEGRATION_STATE_KEY] ?? null) as {
    status: string | null;
    timestamp: string | null;
  } | null;

  // Concurrency guard: reject if a submission is already in progress
  if (bcState?.status && IN_PROGRESS_STATUSES.includes(bcState.status)) {
    res.status(409).json({
      message: 'A Business Central submission is already in progress. Use Refresh to check its status.',
      code: 'SUBMISSION_IN_PROGRESS',
    });
    return;
  }

  const forceResend = req.validatedBody.force_resend;

  // Fire-and-forget: start the workflow without awaiting it
  // TODO: Reconcile with NIMBUS-148's actual trigger mechanism.
  // If NIMBUS-148 uses a subscriber, emit the event instead:
  //   await emitEventStep... or eventBus.notify(...)
  // If NIMBUS-148's workflow is directly callable:
  //   void submitOrderToBusinessCentralWorkflow(req.scope).run({
  //     input: { order_id: req.params.id, force_resend: forceResend },
  //   });
  void Promise.resolve(); // placeholder — replace with actual trigger

  res.status(202).json({
    message: forceResend
      ? 'Force resend to Business Central has been started. Use Refresh to check the outcome.'
      : 'Submission to Business Central has been started. Use Refresh to check the outcome.',
  });
};
```

### New File: `apps/backend/src/api/admin/orders/[id]/bc-integration/middlewares.ts`

```typescript
import { validateAndTransformBody } from '@medusajs/framework';
import { MiddlewareRoute } from '@medusajs/medusa';
import { AdminSubmitOrderToBc } from './validators';

export const adminBcIntegrationMiddlewares: MiddlewareRoute[] = [
  {
    method: ['POST'],
    matcher: '/admin/orders/:id/bc-integration/submit',
    middlewares: [validateAndTransformBody(AdminSubmitOrderToBc)],
  },
];
```

### Modified File: `apps/backend/src/api/admin/middlewares.ts`

Add the new middleware array to the aggregator:

```typescript
// ...existing code...
import { adminBcIntegrationMiddlewares } from './orders/[id]/bc-integration/middlewares';

export const adminMiddlewares: MiddlewareRoute[] = [
  ...adminCompaniesMiddlewares,
  ...adminQuotesMiddlewares,
  ...adminApprovalsMiddlewares,
  ...adminBcIntegrationMiddlewares,
];
```

## Impacted Files

- **Modified:** `apps/backend/src/api/admin/middlewares.ts` — add `adminBcIntegrationMiddlewares`
  to the aggregated array.
- **New:** all files under `apps/backend/src/api/admin/orders/[id]/bc-integration/`.

## Test Cases

Test cases are defined in Task 03.

## Open Items

- **Reconcile `BC_INTEGRATION_STATE_KEY`** with the actual metadata key name from NIMBUS-149.
- **Reconcile `submitOrderToBusinessCentralWorkflow`** with the actual workflow name and input
  type from NIMBUS-148.
- **Reconcile `IN_PROGRESS_STATUSES`** with the actual status values NIMBUS-148 writes at the
  start of its workflow.
- **Reconcile the async-trigger mechanism** — if NIMBUS-148 is subscriber-based, the POST route
  emits an event instead of calling the workflow directly.
- **Reconcile partial-failure fields** — if NIMBUS-148 records `partial_submission` and
  `line_failures`, include them in the GET response. If not, remove them.
- **Verify `req.params.id`** — Medusa's admin route param naming may differ; check existing
  routes like `companies/[id]/route.ts` for the exact param access pattern.
