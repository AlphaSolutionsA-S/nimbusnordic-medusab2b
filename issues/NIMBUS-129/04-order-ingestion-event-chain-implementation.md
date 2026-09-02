# Task 04: Post-Creation Async Event Chain — Implementation Plan

**Status:** TODO
**App:** backend
**App Root:** apps/backend
**Task ID:** 04
**Date:** 2026-09-02
**Branch:** feature/NIMBUS-129-order-ingestion (from develop)
**Depends on:** Task 01, Task 03

---

**Note on task file renaming**: this task was previously named "Process-Incoming-Order Workflow"
(`04-process-incoming-order-workflow-implementation.md`) and implemented NIMBUS-147's deep
validation/company-matching/duplicate-check as one async fire-and-forget workflow. That entire
design is superseded — validation/matching/duplicate-check now happen synchronously in Task 03.
This task is new content: the asynchronous chain that runs **after** a real order already exists.
If you previously implemented the old version, delete
`apps/backend/src/workflows/order-ingestion/steps/validate-and-match-incoming-order.ts` and
`apps/backend/src/workflows/order-ingestion/workflows/process-incoming-order.ts` before starting
this version.

## Project Environment

- **App root:** `apps/backend`
- **Build command:** `pnpm build` (from repo root) or `cd apps/backend && pnpm build`
- **Lint command:** `pnpm lint` (from repo root)
- **Test command:** `cd apps/backend && pnpm test:integration:http`
- **Test framework:** Jest, `medusaIntegrationTestRunner` from `@medusajs/test-utils`
- **Test location:** `apps/backend/integration-tests/http/**/*.spec.ts`
- **Naming conventions:** workflow/step/subscriber files kebab-case, workflows/steps as **named
  exports**, subscribers as **default exports** (Medusa's required convention for subscriber
  handler functions — different from every other file type in this repo).

## Context — why this task exists and what changed

By the time Task 03's workflow returns, a real, header-only Medusa `Order` exists. This task
implements what happens **after** that, using genuine Medusa domain events — a deliberate,
explicit choice by the user, not a workaround this plan should second-guess. (An earlier revision
of this plan used a single fire-and-forget workflow call for the equivalent post-response
processing, justified at the time by this repo having zero existing event/subscriber usage. That
justification no longer applies — the user has explicitly directed the use of Medusa's real
event-bus primitives for this chain, as a deliberate new pattern for this integration. Do not
re-litigate that decision or fall back to a bespoke mechanism.)

**Verified Medusa v2.18.0 primitives this task is built on** (checked directly against the
installed `@medusajs/core-flows`, `@medusajs/framework`, and `@medusajs/medusa` packages in
`apps/backend/node_modules`, not assumed from general Medusa knowledge):

- **`emitEventStep`**, from `@medusajs/medusa/core-flows`. Signature:
  `emitEventStep({ eventName: string, data: object | ((ctx) => Promise<object>), options?, metadata? })`.
  It only actually emits **after the workflow it's used in completes successfully** — if any
  earlier step in that same workflow throws, the event is never emitted. One event name per call
  (to emit several different event names, call it multiple times).
- **`Modules.EVENT_BUS`** is a Medusa core module that is **always registered by default**
  (verified in `@medusajs/utils`'s `defaultModules` list) — `apps/backend/medusa-config.ts` does
  not need any change for this to work, exactly like `Modules.API_KEY` and `Modules.ORDER`
  already didn't. The active provider in this repo's local dev/test setup is the default
  **local, in-memory event bus** (`@medusajs/medusa/event-bus-local`) — there is no
  `REDIS_URL`-driven override active in `apps/backend/medusa-config.ts`, so subscribers run
  in-process, with no separate worker/queue process needed for this to work in dev or in the
  `pnpm test:integration:http` test run.
- **Subscribers** are plain files under `apps/backend/src/subscribers/*.ts` — a default-exported
  async handler function plus a named `config` export (`{ event: string | string[] }`). Medusa
  auto-discovers and registers every file in that directory at startup; **no `medusa-config.ts`
  edit and no manual registration array is needed** (verified against
  `@medusajs/framework`'s `SubscriberLoader` — it scans the directory, validates each file has a
  function default export and a `config.event`, and calls `eventBus.subscribe(...)` for you).
  Custom, non-core event names (e.g. `order_ingestion.order_created`) work exactly like built-in
  ones — there is no pre-registration requirement anywhere in this code path; the event bus is a
  plain string-keyed pub/sub.
- This repo already has `apps/backend/src/subscribers/README.md` as boilerplate documentation for
  this exact convention, but **zero actual subscriber files exist yet** — this task's subscriber
  is the first one in this codebase.

**Why the very first event emission must still be fire-and-forget from the route (Task 05), not
from inside Task 03's workflow**: emitting the event from inside `createOrderFromCanonicalPayloadWorkflow`
itself (the workflow Task 05's route `await`s before responding) would mean the response could
end up waiting on however long the local event bus takes to run every subscriber for that event —
directly defeating the point of making this chain asynchronous. This is why the event emission
is its own tiny, separate workflow (below), invoked from the route **without** being awaited —
regardless of whether the local event bus happens to process subscribers synchronously in-process
or defers them, the HTTP response is never blocked, because the response-sending code path never
awaits that call at all.

**Extensibility, and the "flag, don't invent" boundary with NIMBUS-148**: this chain is designed
so that adding a further stage is: define a new event-name constant, add a step/workflow that
does the stage's work and ends with `emitEventStep` for the *next* stage, and add a subscriber for
the *previous* stage's event. No schema migration is needed to add a stage, because the
`order_ingestion_state` tracking field lives in `Order.metadata` (free-form JSON), not a
database enum column. This task defines and emits `order_ingestion.ready_for_business_central` as
the **boundary event NIMBUS-148 will eventually hang off of** — but does **not** write a
subscriber for it. Writing a stub subscriber that does nothing (or worse, guessing at NIMBUS-148's
actual BC-integration logic) would be implementing NIMBUS-148 prematurely, which is explicitly
out of scope. When NIMBUS-148 is scoped, its own subscriber file should have
`config.event: 'order_ingestion.ready_for_business_central'`.

**"Event 1" content is intentionally left partly unspecified — flagged, not invented.** The user
described this stage as "further data mapping onto the order's header fields and whatever other
enrichment isn't needed for the synchronous response," explicitly without full specificity. This
task implements the state-transition and event-emission mechanics in full (fully specified,
tested, and buildable), but the actual enrichment *content* is left as a clearly marked
`// IMPLEMENT:` block in `enrich-order.ts` below, with candidate work items noted — a
product/business decision to confirm during implementation, not something to guess at here. One
concrete candidate flagged for consideration: mapping the canonical `billTo`/`shipTo` address
objects onto the Order's proper address relations (Medusa's Order module does support real
address sub-records, separate from line items — addresses aren't excluded by the "no product
catalog" constraint, which is specifically about order *lines*) — but the exact `CreateOrderDTO`/
update-address field shape for this was not verified in this planning pass, so it is **not**
implemented here; verify the actual field shape in `@medusajs/types` before attempting it.

**Recoverability note carried into PLAN.md, not solved here**: storing `order_ingestion_state` in
`metadata` (rather than the old plan's now-removed `IncomingOrder.status` column) is what makes
future recovery possible — a scheduled job or admin action could eventually scan for orders stuck
in an intermediate state past some threshold and retry/alert. Building that recovery job is
explicitly out of scope for this plan (the user confirmed this), but doing so later would face the
same JSON-metadata-filtering uncertainty flagged in Task 01 — querying "all orders where
`metadata.order_ingestion_state = 'created'` and `created_at` is older than X" via `query.graph()`
is not a verified-reliable pattern in this codebase. Flagging this now so it isn't rediscovered
from scratch later.

## Solution Design

```
apps/backend/src/workflows/order-ingestion/
├── steps/
│   └── update-order-ingestion-state.ts   # generic, reusable read-merge-write metadata step
└── workflows/
    ├── emit-order-ingestion-created-event.ts   # tiny: fired (unawaited) by Task 05's route
    └── enrich-order.ts                          # runs from the subscriber below

apps/backend/src/subscribers/
└── order-ingestion-created.ts   # listens for order_ingestion.order_created, runs enrich-order
```

Chain, end to end:

1. Task 05's route creates the order (Task 03, awaited) and responds `201`.
2. Task 05's route also fires (without awaiting) `emitOrderIngestionCreatedEventWorkflow`, which
   emits `order_ingestion.order_created` with `{ order_id }`.
3. `order-ingestion-created.ts` subscriber (this task) receives that event and runs
   `enrichOrderWorkflow`.
4. `enrichOrderWorkflow` (this task) does its (currently placeholder) enrichment work, transitions
   `order.metadata.order_ingestion_state` to `'ready_for_business_central'`, and emits
   `order_ingestion.ready_for_business_central` — the boundary NIMBUS-148 will subscribe to in
   the future.

## Code Skeletons

### New File: `apps/backend/src/workflows/order-ingestion/steps/update-order-ingestion-state.ts`

```typescript
import { createStep, StepResponse } from '@medusajs/framework/workflows-sdk';
import { Modules } from '@medusajs/framework/utils';
import type { IOrderModuleService } from '@medusajs/framework/types';

export type UpdateOrderIngestionStateInput = {
  order_id: string;
  state: string;
};

type UpdateOrderIngestionStateCompensationData = {
  order_id: string;
  previousState: unknown;
};

export const updateOrderIngestionStateStep = createStep(
  'update-order-ingestion-state',
  async (
    input: UpdateOrderIngestionStateInput,
    { container }
  ): Promise<StepResponse<{ order_id: string; state: string }, UpdateOrderIngestionStateCompensationData>> => {
    const orderModuleService = container.resolve<IOrderModuleService>(Modules.ORDER);

    // IOrderModuleService.updateOrders uses a two-argument (id, data) form — NOT the
    // single-merged-object form used by custom MedusaService-generated modules (e.g.
    // OrderIngestionModuleService.updateOrderExternalReferences). Verified directly against
    // apps/backend/src/workflows/order/steps/update-order.ts's real call
    // (`orderModule.updateOrders(id, rest as any)`), not assumed — do not "fix" this to a
    // single-object call.
    const [existingOrder] = await orderModuleService.listOrders(
      { id: input.order_id },
      { select: ['id', 'metadata'] }
    );

    const previousMetadata = (existingOrder?.metadata ?? {}) as Record<string, unknown>;
    const previousState = previousMetadata.order_ingestion_state;

    // metadata is a single jsonb column — read-merge-write, or an update here would silently
    // wipe out every other metadata key (including canonical_order and company_id from Task 03).
    await orderModuleService.updateOrders(input.order_id, {
      metadata: {
        ...previousMetadata,
        order_ingestion_state: input.state,
        order_ingestion_state_updated_at: new Date().toISOString(),
      },
    });

    return new StepResponse(
      { order_id: input.order_id, state: input.state },
      { order_id: input.order_id, previousState }
    );
  },
  async (compensationData, { container }) => {
    if (!compensationData) {
      return;
    }

    const orderModuleService = container.resolve<IOrderModuleService>(Modules.ORDER);
    const [existingOrder] = await orderModuleService.listOrders(
      { id: compensationData.order_id },
      { select: ['id', 'metadata'] }
    );
    const currentMetadata = (existingOrder?.metadata ?? {}) as Record<string, unknown>;

    await orderModuleService.updateOrders(compensationData.order_id, {
      metadata: {
        ...currentMetadata,
        order_ingestion_state: compensationData.previousState,
      },
    });
  }
);
```

### New File: `apps/backend/src/workflows/order-ingestion/workflows/emit-order-ingestion-created-event.ts`

```typescript
import { createWorkflow, WorkflowResponse } from '@medusajs/framework/workflows-sdk';
import { emitEventStep } from '@medusajs/medusa/core-flows';

export const ORDER_INGESTION_CREATED_EVENT = 'order_ingestion.order_created';

export type EmitOrderIngestionCreatedEventInput = {
  order_id: string;
};

export const emitOrderIngestionCreatedEventWorkflow = createWorkflow(
  'emit-order-ingestion-created-event',
  function (input: EmitOrderIngestionCreatedEventInput) {
    emitEventStep({
      eventName: ORDER_INGESTION_CREATED_EVENT,
      data: input,
    });

    return new WorkflowResponse(input);
  }
);
```

### New File: `apps/backend/src/workflows/order-ingestion/workflows/enrich-order.ts`

```typescript
import { createWorkflow, transform, WorkflowResponse } from '@medusajs/framework/workflows-sdk';
import { emitEventStep } from '@medusajs/medusa/core-flows';
import { updateOrderIngestionStateStep } from '../steps/update-order-ingestion-state';

export const READY_FOR_BUSINESS_CENTRAL_EVENT = 'order_ingestion.ready_for_business_central';

export type EnrichOrderInput = {
  order_id: string;
};

export const enrichOrderWorkflow = createWorkflow(
  'enrich-order',
  function (input: EnrichOrderInput) {
    // IMPLEMENT: this is where further data mapping / enrichment onto the order's header
    // fields belongs — content intentionally not specified yet (see this task's doc, "Event 1
    // content is intentionally left partly unspecified"). Candidate work items to confirm during
    // implementation: mapping canonical billTo/shipTo onto the Order's real address relations
    // (verify the exact field shape in @medusajs/types before attempting — not verified in this
    // planning pass), or any other header-field mapping that turned out not to be needed for
    // Task 03's synchronous response. Add further steps here, before the state transition below,
    // once the content is decided. If it's a single mutation, it may be simpler to fold directly
    // into updateOrderIngestionStateStep's own metadata write instead of adding a new step.
    const stateInput = transform({ input }, (data) => ({
      order_id: data.input.order_id,
      state: 'ready_for_business_central',
    }));

    const updated = updateOrderIngestionStateStep(stateInput);

    emitEventStep({
      eventName: READY_FOR_BUSINESS_CENTRAL_EVENT,
      data: input,
    });

    return new WorkflowResponse(updated);
  }
);
```

### New File: `apps/backend/src/subscribers/order-ingestion-created.ts`

```typescript
import type { SubscriberArgs, SubscriberConfig } from '@medusajs/medusa';
import { enrichOrderWorkflow } from '../workflows/order-ingestion/workflows/enrich-order';
import { ORDER_INGESTION_CREATED_EVENT } from '../workflows/order-ingestion/workflows/emit-order-ingestion-created-event';

type OrderIngestionCreatedEventData = {
  order_id: string;
};

export default async function orderIngestionCreatedHandler({
  event: { data },
  container,
}: SubscriberArgs<OrderIngestionCreatedEventData>) {
  await enrichOrderWorkflow(container).run({
    input: { order_id: data.order_id },
  });
}

export const config: SubscriberConfig = {
  event: ORDER_INGESTION_CREATED_EVENT,
};
```

## Impacted Files

None modified — this task only adds new files (plus deleting the superseded files from the old
version of this task, see the note at the top of this document).

## Test Cases

### New File: `apps/backend/integration-tests/http/order-ingestion/enrich-order-event-chain.spec.ts`

Uses Task 03's workflow directly to create a real order fixture (this task depends on Task 03),
then exercises the event chain two ways: calling `enrichOrderWorkflow` directly (to test its own
logic in isolation), and emitting the real event and polling for the subscriber-driven result (to
prove the actual event → subscriber → workflow wiring works, not just the workflow's internal
logic). The polling helper exists because this repo's local event bus's exact subscriber-timing
guarantees were not independently verified in this planning pass (see this task's "Context"
section) — polling is correct regardless of whether subscriber invocation happens synchronously
within the `emit()` call or is deferred by a tick.

```typescript
import { medusaIntegrationTestRunner } from '@medusajs/test-utils';
import { Modules } from '@medusajs/framework/utils';
import type { IOrderModuleService, OrderDTO } from '@medusajs/framework/types';
import { createOrderFromCanonicalPayloadWorkflow } from '../../../src/workflows/order-ingestion/workflows/create-order-from-canonical-payload';
import { enrichOrderWorkflow } from '../../../src/workflows/order-ingestion/workflows/enrich-order';
import { emitOrderIngestionCreatedEventWorkflow } from '../../../src/workflows/order-ingestion/workflows/emit-order-ingestion-created-event';
import { COMPANY_MODULE } from '../../../src/modules/company';
import type { ICompanyModuleService } from '../../../src/types';
import { singleLineCanonicalOrder } from '../../../src/modules/order-ingestion/__tests__/canonical-order-fixtures';

jest.setTimeout(60 * 1000);

async function waitForOrderIngestionState(
  orderModuleService: IOrderModuleService,
  orderId: string,
  expectedState: string,
  timeoutMs = 5000
): Promise<OrderDTO> {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const order = await orderModuleService.retrieveOrder(orderId, { select: ['id', 'metadata'] });
    if (order.metadata?.order_ingestion_state === expectedState) {
      return order;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  throw new Error(
    `Timed out waiting for order ${orderId} to reach order_ingestion_state="${expectedState}"`
  );
}

async function createTestOrder(container: any, customerNumber: string, externalOrderNumber: string) {
  const companyService = container.resolve<ICompanyModuleService>(COMPANY_MODULE);
  await companyService.createCompanies({
    name: `Company for ${customerNumber}`,
    email: `${customerNumber}@example.com`,
    business_central_customer_number: customerNumber,
  });

  const { result: order } = await createOrderFromCanonicalPayloadWorkflow(container).run({
    input: {
      customer_number: customerNumber,
      canonicalOrder: { ...singleLineCanonicalOrder, externalOrderNumber },
    },
  });

  return order;
}

medusaIntegrationTestRunner({
  inApp: true,
  testSuite: ({ getContainer }) => {
    describe('order ingestion async event chain', () => {
      it('TC-1: enrichOrderWorkflow transitions order_ingestion_state to ready_for_business_central (happy path, direct workflow call)', async () => {
        const container = getContainer();
        const orderModuleService = container.resolve<IOrderModuleService>(Modules.ORDER);
        const order = await createTestOrder(container, 'tc1-enrich-customer', 'TC1-ENRICH-ORDER');

        await enrichOrderWorkflow(container).run({ input: { order_id: order.id } });

        const updatedOrder = await orderModuleService.retrieveOrder(order.id, {
          select: ['id', 'metadata'],
        });
        expect(updatedOrder.metadata?.order_ingestion_state).toEqual('ready_for_business_central');
      });

      it('TC-2: emitting order_ingestion.order_created (as Task 05 does) triggers the subscriber and the same transition, end to end', async () => {
        const container = getContainer();
        const orderModuleService = container.resolve<IOrderModuleService>(Modules.ORDER);
        const order = await createTestOrder(container, 'tc2-event-customer', 'TC2-EVENT-ORDER');

        await emitOrderIngestionCreatedEventWorkflow(container).run({
          input: { order_id: order.id },
        });

        const finalOrder = await waitForOrderIngestionState(
          orderModuleService,
          order.id,
          'ready_for_business_central'
        );
        expect(finalOrder.id).toEqual(order.id);
      });

      it('TC-3: updateOrderIngestionStateStep handles an order with no pre-existing order_ingestion metadata gracefully (edge case: read-merge-write against sparse metadata)', async () => {
        const container = getContainer();
        const orderModuleService = container.resolve<IOrderModuleService>(Modules.ORDER);

        const order = await orderModuleService.createOrders({
          currency_code: 'DKK',
        });

        await enrichOrderWorkflow(container).run({ input: { order_id: order.id } });

        const updatedOrder = await orderModuleService.retrieveOrder(order.id, {
          select: ['id', 'metadata'],
        });
        expect(updatedOrder.metadata?.order_ingestion_state).toEqual('ready_for_business_central');
      });
    });
  },
});
```

Run with: `cd apps/backend && pnpm test:integration:http`.

## Implementation Steps

1. If they exist from an earlier revision of this plan, delete
   `apps/backend/src/workflows/order-ingestion/steps/validate-and-match-incoming-order.ts` and
   `apps/backend/src/workflows/order-ingestion/workflows/process-incoming-order.ts` — superseded.
2. Create `apps/backend/src/workflows/order-ingestion/steps/update-order-ingestion-state.ts`
   exactly as shown above.
3. Create `apps/backend/src/workflows/order-ingestion/workflows/emit-order-ingestion-created-event.ts`
   exactly as shown above.
4. Create `apps/backend/src/workflows/order-ingestion/workflows/enrich-order.ts` exactly as shown
   above, including the `// IMPLEMENT:` comment block — do not fill in enrichment content that
   wasn't specified; leave it flagged.
5. Create `apps/backend/src/subscribers/order-ingestion-created.ts` exactly as shown above.
6. Create `apps/backend/integration-tests/http/order-ingestion/enrich-order-event-chain.spec.ts`
   exactly as shown above. (If a stale `process-incoming-order-workflow.spec.ts` exists from an
   earlier revision, delete it.)
7. Run `cd apps/backend && pnpm test:integration:http` and confirm all three test cases pass. If
   TC-2 fails to reach the expected state within the timeout, this is the "residual uncertainty"
   flagged in this task's Context section (local event bus subscriber-timing behavior) actually
   manifesting — increase the timeout first to rule out a slow CI environment; if it still never
   transitions, the subscriber registration itself likely isn't firing (check for a typo in the
   event name string, which must match exactly between `emit-order-ingestion-created-event.ts`
   and `order-ingestion-created.ts`'s `config.event`).
8. Run `pnpm build` from the repo root and fix any type errors before marking this task done.
