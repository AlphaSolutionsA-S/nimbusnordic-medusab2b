# Task 03: Synchronous Validate + Create Order Workflow — Implementation Plan

**Status:** TODO
**App:** backend
**App Root:** apps/backend
**Task ID:** 03
**Date:** 2026-09-02
**Branch:** feature/NIMBUS-129-order-ingestion (from develop)
**Depends on:** Task 01, Task 02

---

**Note on task file renaming**: this task was previously named "Receive-Order Workflow"
(`03-receive-order-workflow-implementation.md`) and implemented only NIMBUS-144's fast/shallow
idempotency check. That file is superseded and deleted — this is a full architectural
replacement, not an incremental edit. If you have already implemented the old version, delete
its files (`apps/backend/src/workflows/order-ingestion/steps/find-or-create-incoming-order.ts`
and `apps/backend/src/workflows/order-ingestion/workflows/receive-order.ts`) before starting this
version.

## Project Environment

- **App root:** `apps/backend`
- **Build command:** `pnpm build` (from repo root) or `cd apps/backend && pnpm build`
- **Lint command:** `pnpm lint` (from repo root)
- **Test command:** `cd apps/backend && pnpm test:integration:http`
- **Test framework:** Jest, `medusaIntegrationTestRunner` from `@medusajs/test-utils`
- **Test location:** `apps/backend/integration-tests/http/**/*.spec.ts`
- **Naming conventions:** workflow/step files kebab-case, workflows/steps as **named exports**.

## Context — the redesign this task implements

**What changed and why**: the original plan had NIMBUS-144 do a synchronous "fast/shallow"
idempotency pre-check and hand off to an asynchronous NIMBUS-147 workflow for deep validation,
company matching, the real duplicate check, and (eventually, in a future story) order creation.
After review, the user redirected this: **canonical validation, company matching, the
per-company duplicate check, and real Medusa order creation must all happen synchronously,
inside the request**. If validation fails for any reason, the caller gets an error response
immediately and nothing is left running or persisted. If it succeeds, a real Medusa `Order`
exists by the time the response is sent.

**This pulls a slice of NIMBUS-149 into this plan.** NIMBUS-149 ("Create and persist the Medusa
order") was scoped as a separate, later, unscoped story under the assumption that order creation
would happen asynchronously, well after NIMBUS-144's response. That assumption is no longer
true. This task implements the minimal slice needed to return a real order id synchronously — a
**header-only** order (no `OrderLineItem` records, per the epic's confirmed "no product catalog
behind these items" constraint) with the canonical order's line data retained in `metadata`.
**This is explicitly not the full NIMBUS-149** — traceability/normalized-source-info
requirements and the integration-state fields NIMBUS-158's widget will need are not built here.
Whoever eventually scopes NIMBUS-149 properly needs to reconcile with what this task actually
built, not start from a blank slate. See PLAN.md's "Decisions & Trade-offs" for the full
record of this scope-crossing decision.

**Two implementation choices below were verified directly against this repo's installed Medusa
v2.18.0 packages, not assumed** — getting them wrong would either crash at runtime or silently
skip the existing Order↔Company link mechanism:

### Choice 1 — creating the order via `Modules.ORDER` directly, NOT `createOrderWorkflow`

Medusa's standard `createOrderWorkflow` (from `@medusajs/medusa/core-flows`) technically accepts
an empty/omitted `items` array (verified: its internal `validateLineItemPricesStep` and
`confirmVariantInventoryWorkflow` both no-op when `items` is empty). **However**, reading its
actual composition (`create-order.js` in the installed package), it unconditionally evaluates
`region_id: data.region.id` where `data.region` comes from a region-lookup step that returns
`null` if no `region_id` is given and the store has no working default region — **this throws a
`TypeError` at runtime**, a risk not visible from the workflow's TypeScript input types (every
field on `CreateOrderDTO` is typed optional). This repo's seed data/store configuration was not
verified to guarantee a resolvable default region for every environment this route will run in.

Calling `container.resolve(Modules.ORDER).createOrders(...)` directly (the same module-service
method `createOrderWorkflow` itself calls at the bottom of its own composition, per
`create-orders.js`'s step body) skips all of that — verified against the `Order` entity's actual
model definition (`@medusajs/order`'s `models/order.js`), the **only** DB-required field is
`currency_code` (`model.text()`, not nullable, no default). `region_id`, `sales_channel_id`,
`customer_id`, `email`, `items` are all nullable/optional at the schema level, and `items` being
empty/omitted is fully supported (it's a `hasMany` relation with no minimum-count constraint).
This is the lower-risk path for a header-only order and is what this task uses.

### Choice 2 — replicating the Order↔Company link creation manually

The existing `apps/backend/src/workflows/hooks/order-created.ts` hook
(`createOrderWorkflow.hooks.orderCreated`) only fires when `createOrderWorkflow` itself runs.
Since this task deliberately does NOT use that workflow (Choice 1 above), **that hook will not
fire for these orders**, and the Order↔Company remote link it creates would silently not happen
unless this task replicates it. Verified: the link-creation mechanism itself
(`container.resolve(ContainerRegistrationKeys.LINK)` + `.create(...)` / `.dismiss(...)`) has no
dependency on which code path created the `Order` row — it only needs valid `order.id` and
`company.id` strings. This task's own step therefore calls the exact same two lines the existing
hook uses, directly, so the pre-existing `apps/backend/src/links/order-company.ts` link keeps
working identically for these orders. **`apps/backend/src/workflows/hooks/order-created.ts`
itself is not modified by this task** — it remains exactly as-is, simply inert for orders created
by this workflow (which is expected and fine).

## Solution Design

Two steps, one workflow:

1. **`matchCompanyAndCheckDuplicateStep`** — read-only. Looks up the `Company` whose
   `business_central_customer_number` matches the request's `customer_number` (the resolved
   value NIMBUS-146/Task 05 passes through). Throws `MedusaError.Types.NOT_FOUND` if no company
   matches. If a company is found, checks Task 01's `OrderExternalReference` table for an
   existing row with the same `(company_id, external_order_number)` — throws
   `MedusaError.Types.DUPLICATE_ERROR` if one exists (per-company scoping, confirmed: the same
   `externalOrderNumber` from two different companies is NOT a duplicate).
2. **`createOrderAndReferenceStep`** — only reached if step 1 didn't throw. Creates the
   header-only `Order` (Choice 1), creates the Order↔Company remote link (Choice 2), and creates
   the `OrderExternalReference` dedupe row — all three as one step, since they are transactionally
   coupled from a business perspective (either all three exist, or none do). Compensation
   reverses all three in the opposite order on failure.

**Resolved error status codes** (an open question in NIMBUS-147's SCOPE.md, resolved here):
`MedusaError.Types.NOT_FOUND` → `404` for an unrecognized customer number,
`MedusaError.Types.DUPLICATE_ERROR` → `422` for a duplicate `externalOrderNumber` within the same
company. Structural/schema validation failures never reach this workflow at all — they're
rejected with `400` by Task 05's `validateAndTransformBody(CanonicalOrderSchema)` middleware
before the route handler runs.

**Do not wrap this workflow's `.run()` call in try/catch in Task 05's route** — these steps
already throw correctly-typed `MedusaError`s, and Medusa's own HTTP error-formatting middleware
converts them to the right status code automatically (this is the same pattern already used
elsewhere in this repo, e.g. `apps/backend/src/modules/business-central/service.ts` throwing
`MedusaError` directly with no caller-side try/catch). This is the same behavior documented in
the `building-with-medusa` skill's error-handling reference for simple cases. **One residual
uncertainty, flagged rather than silently assumed**: whether Medusa's workflow engine could wrap
a step's thrown error in a way that loses its `MedusaError` type/instanceof before it reaches the
route. This wasn't independently re-verified against this exact Medusa version's workflow-engine
internals (only against the step/route error-handling pattern already used elsewhere in this
repo). Task 03's own tests (below) and Task 05's HTTP tests both assert on the exact resulting
error, so if this assumption is wrong, it will surface as a failing test rather than a silent bug
— if that happens, catch the error in the route and inspect `error.type`/`error.message`
explicitly instead of relying on the thrown status code alone.

## Code Skeletons

### New File: `apps/backend/src/workflows/order-ingestion/steps/match-company-and-check-duplicate.ts`

```typescript
import { createStep, StepResponse } from '@medusajs/framework/workflows-sdk';
import { ContainerRegistrationKeys, MedusaError } from '@medusajs/framework/utils';
import { ORDER_INGESTION_MODULE } from '../../../modules/order-ingestion';
import OrderIngestionModuleService from '../../../modules/order-ingestion/service';
import type { CanonicalOrder } from '../../../modules/order-ingestion/canonical-order-schema';

export type MatchCompanyAndCheckDuplicateInput = {
  customer_number: string;
  canonicalOrder: CanonicalOrder;
};

export type MatchCompanyAndCheckDuplicateOutput = {
  companyId: string;
};

export const matchCompanyAndCheckDuplicateStep = createStep(
  'match-company-and-check-duplicate',
  async (
    input: MatchCompanyAndCheckDuplicateInput,
    { container }
  ): Promise<StepResponse<MatchCompanyAndCheckDuplicateOutput>> => {
    const query = container.resolve(ContainerRegistrationKeys.QUERY);

    const { data: companies } = await query.graph({
      entity: 'companies',
      fields: ['id'],
      filters: { business_central_customer_number: input.customer_number },
    });

    const company = companies[0];

    if (!company) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        `No company found for customer number '${input.customer_number}'`
      );
    }

    const orderIngestionService = container.resolve<OrderIngestionModuleService>(
      ORDER_INGESTION_MODULE
    );

    const duplicates = await orderIngestionService.listOrderExternalReferences({
      external_order_number: input.canonicalOrder.externalOrderNumber,
      company_id: company.id,
    });

    if (duplicates.length > 0) {
      throw new MedusaError(
        MedusaError.Types.DUPLICATE_ERROR,
        `Order '${input.canonicalOrder.externalOrderNumber}' was already accepted for this company`
      );
    }

    return new StepResponse({ companyId: company.id });
  }
);
```

Note: no compensation function — this step never mutates anything (it only reads and, on
failure, throws), so there's nothing to roll back.

### New File: `apps/backend/src/workflows/order-ingestion/steps/create-order-and-reference.ts`

```typescript
import { createStep, StepResponse } from '@medusajs/framework/workflows-sdk';
import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils';
import type { IOrderModuleService, OrderDTO } from '@medusajs/framework/types';
import { COMPANY_MODULE } from '../../../modules/company';
import { ORDER_INGESTION_MODULE } from '../../../modules/order-ingestion';
import OrderIngestionModuleService from '../../../modules/order-ingestion/service';
import type { CanonicalOrder } from '../../../modules/order-ingestion/canonical-order-schema';

export type CreateOrderAndReferenceInput = {
  companyId: string;
  canonicalOrder: CanonicalOrder;
};

type CreateOrderAndReferenceCompensationData = {
  orderId: string;
  referenceId: string;
};

export const createOrderAndReferenceStep = createStep(
  'create-order-and-reference',
  async (
    input: CreateOrderAndReferenceInput,
    { container }
  ): Promise<StepResponse<OrderDTO, CreateOrderAndReferenceCompensationData>> => {
    const orderModuleService = container.resolve<IOrderModuleService>(Modules.ORDER);
    const remoteLink = container.resolve(ContainerRegistrationKeys.LINK);
    const orderIngestionService = container.resolve<OrderIngestionModuleService>(
      ORDER_INGESTION_MODULE
    );

    // Header-only order: no items are created (Medusa has no product catalog behind these
    // order lines — see this task doc's "Context" and PLAN.md). The full canonical payload
    // (including `lines`) is retained in metadata for NIMBUS-148's future Business Central
    // line-building to consume, and `order_ingestion_state` starts the async chain Task 04
    // continues after this workflow returns.
    const order = await orderModuleService.createOrders({
      currency_code: input.canonicalOrder.currencyCode,
      email: input.canonicalOrder.email,
      metadata: {
        company_id: input.companyId,
        canonical_order: input.canonicalOrder,
        order_ingestion_state: 'created',
        order_ingestion_state_updated_at: new Date().toISOString(),
      },
    });

    // Replicates apps/backend/src/workflows/hooks/order-created.ts's link-creation logic
    // directly — that hook only fires for createOrderWorkflow, which this step deliberately does
    // not use (see this task doc's "Choice 1"/"Choice 2").
    await remoteLink.create({
      [Modules.ORDER]: { order_id: order.id },
      [COMPANY_MODULE]: { company_id: input.companyId },
    });

    const reference = await orderIngestionService.createOrderExternalReferences({
      external_order_number: input.canonicalOrder.externalOrderNumber,
      company_id: input.companyId,
      order_id: order.id,
    });

    return new StepResponse(order, { orderId: order.id, referenceId: reference.id });
  },
  async (compensationData, { container }) => {
    if (!compensationData) {
      return;
    }

    const orderModuleService = container.resolve<IOrderModuleService>(Modules.ORDER);
    const remoteLink = container.resolve(ContainerRegistrationKeys.LINK);
    const orderIngestionService = container.resolve<OrderIngestionModuleService>(
      ORDER_INGESTION_MODULE
    );

    await orderIngestionService.deleteOrderExternalReferences(compensationData.referenceId);
    await remoteLink.dismiss({ [Modules.ORDER]: { order_id: compensationData.orderId } });
    await orderModuleService.deleteOrders(compensationData.orderId);
  }
);
```

**Important, verified against this repo's own code (`apps/backend/src/workflows/order/steps/update-order.ts`)
and worth remembering for Task 04**: `IOrderModuleService`'s own methods do not all follow the
same call shape as custom `MedusaService`-generated modules. `createOrders(data)` here takes a
single object (matches convention). But `updateOrders` on the CORE order module uses a
**two-argument** form, `updateOrders(id, data)` — NOT a single merged
`{ id, ...data }` object like `OrderIngestionModuleService.updateOrderExternalReferences` would.
This doesn't come up in this task's step (`createOrders` only), but it matters for Task 04, which
does update an order — noted here since this is where the distinction was first discovered.

### New File: `apps/backend/src/workflows/order-ingestion/workflows/create-order-from-canonical-payload.ts`

```typescript
import { createWorkflow, transform, WorkflowResponse } from '@medusajs/framework/workflows-sdk';
import { matchCompanyAndCheckDuplicateStep } from '../steps/match-company-and-check-duplicate';
import { createOrderAndReferenceStep } from '../steps/create-order-and-reference';
import type { CanonicalOrder } from '../../../modules/order-ingestion/canonical-order-schema';

export type CreateOrderFromCanonicalPayloadInput = {
  customer_number: string;
  canonicalOrder: CanonicalOrder;
};

export const createOrderFromCanonicalPayloadWorkflow = createWorkflow(
  'create-order-from-canonical-payload',
  function (input: CreateOrderFromCanonicalPayloadInput) {
    const matched = matchCompanyAndCheckDuplicateStep(input);

    const createOrderInput = transform({ matched, input }, (data) => ({
      companyId: data.matched.companyId,
      canonicalOrder: data.input.canonicalOrder,
    }));

    const order = createOrderAndReferenceStep(createOrderInput);

    return new WorkflowResponse(order);
  }
);
```

Note the two different patterns used here, both deliberate: `matchCompanyAndCheckDuplicateStep(input)`
passes the workflow's entire input straight through (no reconstruction needed — its type already
matches). `createOrderInput` genuinely combines two different proxies (`matched`'s step output and
the original `input`), so it goes through `transform()` — per workflow composition rules, object
construction combining values from multiple sources must go through `transform()`, not be written
inline in the composition function body.

## Impacted Files

None modified — this task only adds new files (plus deleting the superseded files from the old
version of this task, see the note at the top of this document).

## Test Cases

### New File: `apps/backend/integration-tests/http/order-ingestion/create-order-workflow.spec.ts`

Calls the workflow directly via the test runner's `getContainer()` — no HTTP request is made
(the route doesn't exist until Task 05), same pattern already proven in this repo's
`apps/backend/integration-tests/http/companies/companies.spec.ts`.

```typescript
import { medusaIntegrationTestRunner } from '@medusajs/test-utils';
import { createOrderFromCanonicalPayloadWorkflow } from '../../../src/workflows/order-ingestion/workflows/create-order-from-canonical-payload';
import { ORDER_INGESTION_MODULE } from '../../../src/modules/order-ingestion';
import type OrderIngestionModuleService from '../../../src/modules/order-ingestion/service';
import { COMPANY_MODULE } from '../../../src/modules/company';
import type { ICompanyModuleService } from '../../../src/types';
import { Modules } from '@medusajs/framework/utils';
import type { IOrderModuleService } from '@medusajs/framework/types';
import {
  singleLineCanonicalOrder,
  sampleCustomerNumber,
} from '../../../src/modules/order-ingestion/__tests__/canonical-order-fixtures';

jest.setTimeout(60 * 1000);

medusaIntegrationTestRunner({
  inApp: true,
  testSuite: ({ getContainer }) => {
    describe('createOrderFromCanonicalPayloadWorkflow', () => {
      it('TC-1: creates a header-only order, links it to the matched company, and records the external reference (happy path)', async () => {
        const container = getContainer();
        const companyService = container.resolve<ICompanyModuleService>(COMPANY_MODULE);
        const orderModuleService = container.resolve<IOrderModuleService>(Modules.ORDER);
        const orderIngestionService = container.resolve<OrderIngestionModuleService>(
          ORDER_INGESTION_MODULE
        );

        const company = await companyService.createCompanies({
          name: 'TC-1 Company',
          email: 'tc1@example.com',
          business_central_customer_number: sampleCustomerNumber,
        });

        const { result: order } = await createOrderFromCanonicalPayloadWorkflow(container).run({
          input: {
            customer_number: sampleCustomerNumber,
            canonicalOrder: singleLineCanonicalOrder,
          },
        });

        expect(order.currency_code).toEqual('DKK');
        expect(order.metadata?.company_id).toEqual(company.id);
        expect(order.metadata?.order_ingestion_state).toEqual('created');

        const persistedOrder = await orderModuleService.retrieveOrder(order.id);
        expect(persistedOrder.id).toEqual(order.id);

        const references = await orderIngestionService.listOrderExternalReferences({
          external_order_number: 'FLS190518',
          company_id: company.id,
        });
        expect(references).toHaveLength(1);
        expect(references[0].order_id).toEqual(order.id);
      });

      it('TC-2: rejects with a 404-mapped NOT_FOUND error when the customer_number matches no company', async () => {
        const container = getContainer();

        await expect(
          createOrderFromCanonicalPayloadWorkflow(container).run({
            input: {
              customer_number: 'no-such-customer-number',
              canonicalOrder: { ...singleLineCanonicalOrder, externalOrderNumber: 'UNKNOWN-CUST-1' },
            },
          })
        ).rejects.toThrow(/No company found/);
      });

      it('TC-3: rejects a second submission of the same externalOrderNumber for the same company with a DUPLICATE_ERROR (per-company duplicate rule)', async () => {
        const container = getContainer();
        const companyService = container.resolve<ICompanyModuleService>(COMPANY_MODULE);

        await companyService.createCompanies({
          name: 'TC-3 Company',
          email: 'tc3@example.com',
          business_central_customer_number: 'tc3-customer-number',
        });

        const payload = { ...singleLineCanonicalOrder, externalOrderNumber: 'DUP-ORDER-1' };

        await createOrderFromCanonicalPayloadWorkflow(container).run({
          input: { customer_number: 'tc3-customer-number', canonicalOrder: payload },
        });

        await expect(
          createOrderFromCanonicalPayloadWorkflow(container).run({
            input: { customer_number: 'tc3-customer-number', canonicalOrder: payload },
          })
        ).rejects.toThrow(/already accepted/);
      });

      it('TC-4: does NOT treat the same externalOrderNumber as a duplicate across two different companies (integration/wiring: confirms per-company scoping end to end)', async () => {
        const container = getContainer();
        const companyService = container.resolve<ICompanyModuleService>(COMPANY_MODULE);

        await companyService.createCompanies({
          name: 'TC-4 Company A',
          email: 'tc4a@example.com',
          business_central_customer_number: 'tc4-customer-a',
        });
        await companyService.createCompanies({
          name: 'TC-4 Company B',
          email: 'tc4b@example.com',
          business_central_customer_number: 'tc4-customer-b',
        });

        const payload = { ...singleLineCanonicalOrder, externalOrderNumber: 'CROSS-COMPANY-2' };

        const { result: orderA } = await createOrderFromCanonicalPayloadWorkflow(container).run({
          input: { customer_number: 'tc4-customer-a', canonicalOrder: payload },
        });
        const { result: orderB } = await createOrderFromCanonicalPayloadWorkflow(container).run({
          input: { customer_number: 'tc4-customer-b', canonicalOrder: payload },
        });

        expect(orderA.id).not.toEqual(orderB.id);
      });
    });
  },
});
```

Run with: `cd apps/backend && pnpm test:integration:http`.

## Implementation Steps

1. If they exist from an earlier revision of this plan, delete
   `apps/backend/src/workflows/order-ingestion/steps/find-or-create-incoming-order.ts` and
   `apps/backend/src/workflows/order-ingestion/workflows/receive-order.ts` — superseded.
2. Create `apps/backend/src/workflows/order-ingestion/steps/match-company-and-check-duplicate.ts`
   exactly as shown above.
3. Create `apps/backend/src/workflows/order-ingestion/steps/create-order-and-reference.ts`
   exactly as shown above.
4. Create `apps/backend/src/workflows/order-ingestion/workflows/create-order-from-canonical-payload.ts`
   exactly as shown above.
5. Create `apps/backend/integration-tests/http/order-ingestion/create-order-workflow.spec.ts`
   exactly as shown above. (If a stale `receive-order-workflow.spec.ts` exists from an earlier
   revision, delete it.)
6. Run `cd apps/backend && pnpm test:integration:http` and confirm all four test cases pass.
7. Run `pnpm build` from the repo root and fix any type errors before marking this task done.
