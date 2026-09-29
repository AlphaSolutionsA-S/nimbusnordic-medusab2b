# Task 01: Atomic Order-Creation Steps + DB-Level Duplicate Guard — Implementation Plan

**Status:** DONE (2026-09-29)
**App:** backend
**App Root:** apps/backend
**Task ID:** 01
**Date:** 2026-09-29
**Branch:** feature/NIMBUS-149 (from develop)
**Depends on:** None (builds on NIMBUS-129 Task 03, which is DONE and on `develop`)

---

## Project Environment

- **App root:** `apps/backend`
- **Build command:** `pnpm build` (from repo root) or `cd apps/backend && pnpm build`
- **Lint command:** `pnpm lint` (from repo root)
- **Test commands:**
  - `cd apps/backend && pnpm test:integration:modules` (module service + unique index)
  - `cd apps/backend && pnpm test:integration:http` (workflow tests)
- **Test framework:** Jest (`@swc/jest`), `moduleIntegrationTestRunner` / `medusaIntegrationTestRunner`
  from `@medusajs/test-utils`
- **Test locations:** `apps/backend/src/modules/order-ingestion/__tests__/` (module) and
  `apps/backend/integration-tests/http/order-ingestion/` (workflow)
- **Conventions (match the existing order-ingestion files exactly):** double quotes, 2-space
  indent, semicolons, named exports, `import type` for types, kebab-case file names.
- **Skill:** follow `.claude/skills/building-with-medusa` (one mutation per step, each with its own
  compensation; no `async`/arrow/conditionals in the workflow composition function; use
  `transform()` for derived data).

## Why this task exists

NIMBUS-149 requires that (a) an order-creation failure is recoverable, never leaving a half-created
order behind, and (b) the same validated order is never double-created. The code built by
NIMBUS-129 Task 03 has two real gaps against those requirements, both verified against the
installed Medusa 2.21 packages:

1. **Partial failure inside `createOrderAndReferenceStep` leaves orphans.** That one step performs
   three mutations (create order → create Order↔Company link → create `OrderExternalReference`).
   When a step throws, Medusa's orchestrator does run that step's compensation (a
   `PERMANENT_FAILURE` step is flagged for revert in
   `@medusajs/orchestration/dist/transaction/transaction-orchestrator.js` `flagStepsToRevert`),
   **but with `undefined` compensation data**, because no `StepResponse` was returned. The existing
   compensation starts with `if (!compensationData) return;` — so if the link or the reference
   insert fails, the already-created order (and possibly the link) is never deleted. The caller gets
   an error, retries, and a second order is created while the first is orphaned.
2. **The duplicate check is read-then-write with no DB constraint.** Two concurrent identical
   submissions can both pass `matchCompanyAndCheckDuplicateStep` before either writes its
   `OrderExternalReference` row. NIMBUS-129's PLAN.md recorded this as "Known limitation, not
   solved: no DB-level uniqueness constraint on `OrderExternalReference(company_id,
   external_order_number)`" and flagged it as follow-up hardening.

Fix, following the Medusa convention of one mutation per step:

- Split `createOrderAndReferenceStep` into `createIngestedOrderStep` (order only, compensation
  deletes the order) + Medusa's built-in `createRemoteLinkStep` (link, built-in dismiss
  compensation) + `createOrderExternalReferenceStep` (reference only, compensation deletes it).
- Add a composite **unique** index on `order_external_reference (company_id,
  external_order_number)` so a concurrent duplicate fails at the reference insert, which now rolls
  back the order and link cleanly.

The workflow's input and output contract does **not** change: input
`{ customer_number, canonicalOrder }`, output the created `OrderDTO`. The route
(`src/api/orderapi/orders/route.ts`) is not touched.

## Verified facts (do not re-discover)

- `createRemoteLinkStep` is exported from `@medusajs/medusa/core-flows` (already used in
  `src/workflows/company/workflows/create-companies.ts` and
  `src/workflows/approval/workflows/create-approvals.ts`). Signature:
  `StepFunction<LinkDefinition[], LinkDefinition[]>` — it takes an **array** of link definitions and
  has its own compensation that dismisses them.
- The Order↔Company link is defined in `src/links/order-company.ts`; the link definition shape is
  `{ [Modules.ORDER]: { order_id }, [COMPANY_MODULE]: { company_id } }` (exactly what the current
  step passes to `remoteLink.create`).
- `IOrderModuleService.deleteOrders(id)` also deletes the order's shipping/billing address rows
  (verified in `@medusajs/order/dist/services/order-module-service.js`), so compensation stays
  clean once Task 03 adds addresses.
- Medusa DML composite index syntax (as used by `@medusajs/order`'s own models):
  `.indexes([{ name, on: [...columns], unique: true, where: "deleted_at IS NULL" }])`.
- A Postgres unique violation (`23505`) raised through a MedusaService method is mapped by
  `@medusajs/utils/dist/dal/mikro-orm/db-error-mapper.js` to
  `MedusaError(INVALID_DATA, "<Table> with <keys>, already exists.")`. On the HTTP route this
  surfaces as a 400. That only happens on a genuine concurrent race — the sequential duplicate
  case is still caught first by `matchCompanyAndCheckDuplicateStep` and returns 422 as today.
- Workflow rejections are serialized plain objects (not `MedusaError` instances) — assert with
  `.rejects.toMatchObject(...)` or `Promise.allSettled`, never `.rejects.toThrow()`
  (NIMBUS-129 manifest, Deviation 3).

## Code Skeletons

### New File: `apps/backend/src/workflows/order-ingestion/steps/create-ingested-order.ts`

Body of the `createOrders` call is moved **unchanged** from the current
`create-order-and-reference.ts` (Tasks 02 and 03 extend it later).

```typescript
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import { Modules } from "@medusajs/framework/utils";
import type { IOrderModuleService, OrderDTO } from "@medusajs/framework/types";
import type { CanonicalOrder } from "../../../modules/order-ingestion/canonical-order-schema";

export type CreateIngestedOrderInput = {
  companyId: string;
  canonicalOrder: CanonicalOrder;
};

export const createIngestedOrderStep = createStep(
  "create-ingested-order",
  async (
    input: CreateIngestedOrderInput,
    { container }
  ): Promise<StepResponse<OrderDTO, string>> => {
    const orderModuleService = container.resolve<IOrderModuleService>(
      Modules.ORDER
    );

    // Header-only order: no items are created (Medusa has no product catalog behind these
    // order lines). The full canonical payload (including `lines`) is retained in metadata for
    // the Business Central line-building to consume, and `order_ingestion_state` starts the
    // async chain that continues after this workflow returns.
    const order = await orderModuleService.createOrders({
      currency_code: input.canonicalOrder.currencyCode,
      email: input.canonicalOrder.email,
      metadata: {
        company_id: input.companyId,
        canonical_order: input.canonicalOrder,
        order_ingestion_state: "created",
        order_ingestion_state_updated_at: new Date().toISOString(),
      },
    });

    return new StepResponse(order, order.id);
  },
  async (orderId, { container }) => {
    if (!orderId) {
      return;
    }

    const orderModuleService = container.resolve<IOrderModuleService>(
      Modules.ORDER
    );

    await orderModuleService.deleteOrders(orderId);
  }
);
```

### New File: `apps/backend/src/workflows/order-ingestion/steps/create-order-external-reference.ts`

```typescript
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import { ORDER_INGESTION_MODULE } from "../../../modules/order-ingestion";
import OrderIngestionModuleService from "../../../modules/order-ingestion/service";

export type CreateOrderExternalReferenceInput = {
  external_order_number: string;
  company_id: string;
  order_id: string;
};

/*
  Records the per-company external order number. The (company_id, external_order_number) unique
  index makes this insert the atomic duplicate guard: a concurrent duplicate that slipped past
  matchCompanyAndCheckDuplicateStep fails here, and the workflow rolls back the order and link.
*/
export const createOrderExternalReferenceStep = createStep(
  "create-order-external-reference",
  async (
    input: CreateOrderExternalReferenceInput,
    { container }
  ): Promise<StepResponse<{ id: string }, string>> => {
    const orderIngestionService =
      container.resolve<OrderIngestionModuleService>(ORDER_INGESTION_MODULE);

    const reference =
      await orderIngestionService.createOrderExternalReferences(input);

    return new StepResponse({ id: reference.id }, reference.id);
  },
  async (referenceId, { container }) => {
    if (!referenceId) {
      return;
    }

    const orderIngestionService =
      container.resolve<OrderIngestionModuleService>(ORDER_INGESTION_MODULE);

    await orderIngestionService.deleteOrderExternalReferences(referenceId);
  }
);
```

### Modified File: `apps/backend/src/workflows/order-ingestion/workflows/create-order-from-canonical-payload.ts`

Full replacement content:

```typescript
import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";
import { Modules } from "@medusajs/framework/utils";
import { createRemoteLinkStep } from "@medusajs/medusa/core-flows";
import { COMPANY_MODULE } from "../../../modules/company";
import { matchCompanyAndCheckDuplicateStep } from "../steps/match-company-and-check-duplicate";
import { createIngestedOrderStep } from "../steps/create-ingested-order";
import { createOrderExternalReferenceStep } from "../steps/create-order-external-reference";
import type { CanonicalOrder } from "../../../modules/order-ingestion/canonical-order-schema";

export type CreateOrderFromCanonicalPayloadInput = {
  customer_number: string;
  canonicalOrder: CanonicalOrder;
};

export const createOrderFromCanonicalPayloadWorkflow = createWorkflow(
  "create-order-from-canonical-payload",
  function (input: CreateOrderFromCanonicalPayloadInput) {
    const matched = matchCompanyAndCheckDuplicateStep(input);

    const createOrderInput = transform({ matched, input }, (data) => ({
      companyId: data.matched.companyId,
      canonicalOrder: data.input.canonicalOrder,
    }));

    const order = createIngestedOrderStep(createOrderInput);

    // Replicates src/workflows/hooks/order-created.ts's link directly — that hook only fires for
    // createOrderWorkflow, which this workflow deliberately does not use.
    const linkData = transform({ order, matched }, (data) => [
      {
        [Modules.ORDER]: {
          order_id: data.order.id,
        },
        [COMPANY_MODULE]: {
          company_id: data.matched.companyId,
        },
      },
    ]);

    createRemoteLinkStep(linkData);

    const referenceInput = transform({ order, matched, input }, (data) => ({
      external_order_number: data.input.canonicalOrder.externalOrderNumber,
      company_id: data.matched.companyId,
      order_id: data.order.id,
    }));

    createOrderExternalReferenceStep(referenceInput);

    return new WorkflowResponse(order);
  }
);
```

### Deleted File: `apps/backend/src/workflows/order-ingestion/steps/create-order-and-reference.ts`

Delete it — its three responsibilities now live in the two new steps plus `createRemoteLinkStep`.
Confirm nothing else imports it first:
`grep -rn "create-order-and-reference\|createOrderAndReferenceStep" apps/backend/src apps/backend/integration-tests`
(expected: only the workflow file above, which is being replaced).

### Modified File: `apps/backend/src/modules/order-ingestion/models/order-external-reference.ts`

Full replacement content:

```typescript
import { model } from "@medusajs/framework/utils";

export const OrderExternalReference = model
  .define("order_external_reference", {
    id: model
      .id({
        prefix: "oref",
      })
      .primaryKey(),
    external_order_number: model.text(),
    company_id: model.text(),
    order_id: model.text(),
  })
  .indexes([
    {
      name: "IDX_order_external_reference_company_external_order_unique",
      on: ["company_id", "external_order_number"],
      unique: true,
      where: "deleted_at IS NULL",
    },
  ]);
```

Keep the named export only (no default export — NIMBUS-129 Deviation 2: a default export makes
MikroORM discover the entity twice).

### New Migration (generated, not hand-written)

Run the `db-generate` skill for the `orderIngestion` module:

```bash
cd apps/backend && npx medusa db:generate orderIngestion
```

Expected result: a new `apps/backend/src/modules/order-ingestion/migrations/Migration<timestamp>.ts`
whose `up()` contains (name may differ only if the generator normalises it):

```sql
CREATE UNIQUE INDEX IF NOT EXISTS "IDX_order_external_reference_company_external_order_unique"
  ON "order_external_reference" ("company_id", "external_order_number") WHERE deleted_at IS NULL;
```

and whose `down()` drops that index. The `.snapshot-order-ingestion.json` file is updated by the
generator — commit it. Do not edit `Migration20260916091913.ts`. Then run the `db-migrate` skill
(`npx medusa db:migrate`) against the local DB.

**Deployment note:** the migration fails on any environment that already holds two
`order_external_reference` rows for the same `(company_id, external_order_number)`. Before
deploying, run
`SELECT company_id, external_order_number, count(*) FROM order_external_reference WHERE deleted_at IS NULL GROUP BY 1, 2 HAVING count(*) > 1;`
against each target DB and report any rows to the user rather than deleting them.

## Impacted Files

| File | Change |
|---|---|
| `apps/backend/src/workflows/order-ingestion/steps/create-ingested-order.ts` | **New** — `createIngestedOrderStep(input: CreateIngestedOrderInput): OrderDTO`, compensation `deleteOrders(orderId)` |
| `apps/backend/src/workflows/order-ingestion/steps/create-order-external-reference.ts` | **New** — `createOrderExternalReferenceStep(input: CreateOrderExternalReferenceInput): { id: string }`, compensation `deleteOrderExternalReferences(referenceId)` |
| `apps/backend/src/workflows/order-ingestion/workflows/create-order-from-canonical-payload.ts` | Composition: check → order → `createRemoteLinkStep` → reference. Exported name, input type and output unchanged |
| `apps/backend/src/workflows/order-ingestion/steps/create-order-and-reference.ts` | **Deleted** |
| `apps/backend/src/modules/order-ingestion/models/order-external-reference.ts` | Composite unique index added |
| `apps/backend/src/modules/order-ingestion/migrations/Migration<timestamp>.ts` + `.snapshot-order-ingestion.json` | **Generated** |
| `apps/backend/src/modules/order-ingestion/__tests__/order-ingestion.spec.ts` | Add TC-4 below |
| `apps/backend/integration-tests/http/order-ingestion/create-order-workflow.spec.ts` | Add TC-5 and TC-6 below |

Not touched: `src/api/orderapi/**`, `src/subscribers/**`, `match-company-and-check-duplicate.ts`,
`update-order-ingestion-state.ts`, `enrich-order.ts`, `src/workflows/hooks/order-created.ts`,
`medusa-config.ts`.

## Test Cases

### TC-1 (regression): existing workflow suite still passes unchanged
- **Given:** the four existing cases in `create-order-workflow.spec.ts`, the seven in
  `integration-tests/http/orderapi/orders.spec.ts`, and the three in
  `enrich-order-event-chain.spec.ts`
- **When:** `pnpm test:integration:http` runs
- **Then:** all pass without modification (happy path, 404 unknown customer, 422 sequential
  duplicate, per-company scoping, HTTP auth/validation, event chain)

### TC-4 (module, edge case): the unique index rejects a second row for the same pair
- **Given:** a reference row for `("comp_U", "UNIQUE-1")`
- **When:** a second `createOrderExternalReferences` with the same pair is attempted
- **Then:** it rejects; a row for `("comp_V", "UNIQUE-1")` is still accepted (per-company, not
  global)

### TC-5 (workflow, failure handling): a failure after the order is created rolls the order back
- **Given:** a company and a pre-seeded `OrderExternalReference` for
  `(company.id, "ROLLBACK-1")`, and a probe workflow that runs `createIngestedOrderStep` →
  `createRemoteLinkStep` → `createOrderExternalReferenceStep` **without** the duplicate check
- **When:** the probe workflow runs for `externalOrderNumber: "ROLLBACK-1"`
- **Then:** the run rejects, and no order whose `metadata.canonical_order.externalOrderNumber` is
  `"ROLLBACK-1"` remains; exactly one reference row for the pair remains (the pre-seeded one)

### TC-6 (workflow, idempotency/wiring): concurrent identical submissions create exactly one order
- **Given:** one company and one payload with `externalOrderNumber: "RACE-1"`
- **When:** `createOrderFromCanonicalPayloadWorkflow` is run twice concurrently with
  `Promise.allSettled`
- **Then:** exactly one run is fulfilled and one rejected; exactly one reference row and exactly
  one order exist for `"RACE-1"` (whichever interleaving occurs — sequential duplicate check or the
  unique index — the outcome is the same)

### Test Skeleton — append inside `describe("OrderIngestionModuleService", ...)` in `apps/backend/src/modules/order-ingestion/__tests__/order-ingestion.spec.ts`

```typescript
      it("TC-4: rejects a second reference for the same (company_id, external_order_number) but accepts the same number for another company (unique index)", async () => {
        await service.createOrderExternalReferences({
          external_order_number: "UNIQUE-1",
          company_id: "comp_U",
          order_id: "order_U1",
        });

        await expect(
          service.createOrderExternalReferences({
            external_order_number: "UNIQUE-1",
            company_id: "comp_U",
            order_id: "order_U2",
          })
        ).rejects.toBeDefined();

        const other = await service.createOrderExternalReferences({
          external_order_number: "UNIQUE-1",
          company_id: "comp_V",
          order_id: "order_V1",
        });
        expect(other.id).toEqual(expect.stringMatching(/^oref_/));
      });
```

### Test Skeleton — additions to `apps/backend/integration-tests/http/order-ingestion/create-order-workflow.spec.ts`

Add these imports at the top (keep the existing ones):

```typescript
import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";
import { createRemoteLinkStep } from "@medusajs/medusa/core-flows";
import { createIngestedOrderStep } from "../../../src/workflows/order-ingestion/steps/create-ingested-order";
import type { CreateIngestedOrderInput } from "../../../src/workflows/order-ingestion/steps/create-ingested-order";
import { createOrderExternalReferenceStep } from "../../../src/workflows/order-ingestion/steps/create-order-external-reference";
import type { CanonicalOrder } from "../../../src/modules/order-ingestion/canonical-order-schema";
```

Add at module level, above `medusaIntegrationTestRunner(...)`:

```typescript
// Test-only probe: the production step sequence WITHOUT the duplicate-check step, so the
// reference insert can be made to fail deterministically after the order already exists.
const rollbackProbeWorkflow = createWorkflow(
  "nimbus-149-rollback-probe",
  function (input: CreateIngestedOrderInput) {
    const order = createIngestedOrderStep(input);

    const linkData = transform({ order, input }, (data) => [
      {
        [Modules.ORDER]: { order_id: data.order.id },
        [COMPANY_MODULE]: { company_id: data.input.companyId },
      },
    ]);
    createRemoteLinkStep(linkData);

    const referenceInput = transform({ order, input }, (data) => ({
      external_order_number: data.input.canonicalOrder.externalOrderNumber,
      company_id: data.input.companyId,
      order_id: data.order.id,
    }));
    createOrderExternalReferenceStep(referenceInput);

    return new WorkflowResponse(order);
  }
);

async function listOrdersForExternalNumber(
  orderModuleService: IOrderModuleService,
  externalOrderNumber: string
) {
  const orders = await orderModuleService.listOrders(
    {},
    { select: ["id", "metadata"], take: 1000 }
  );

  // Test-only JS filter: the order has no native external-number column.
  return orders.filter(
    (order) =>
      (order.metadata?.canonical_order as CanonicalOrder | undefined)
        ?.externalOrderNumber === externalOrderNumber
  );
}
```

Add inside the existing `describe("createOrderFromCanonicalPayloadWorkflow", ...)`:

```typescript
      it("TC-5: rolls back the created order when a later step fails (failure handling: no orphaned order)", async () => {
        const container = getContainer();
        const companyService =
          container.resolve<ICompanyModuleService>(COMPANY_MODULE);
        const orderModuleService = container.resolve<IOrderModuleService>(
          Modules.ORDER
        );
        const orderIngestionService =
          container.resolve<OrderIngestionModuleService>(
            ORDER_INGESTION_MODULE
          );

        const company = await companyService.createCompanies({
          name: "TC-5 Company",
          email: "tc5@example.com",
          business_central_customer_number: "tc5-customer-number",
        });

        await orderIngestionService.createOrderExternalReferences({
          external_order_number: "ROLLBACK-1",
          company_id: company.id,
          order_id: "order_preexisting",
        });

        await expect(
          rollbackProbeWorkflow(container).run({
            input: {
              companyId: company.id,
              canonicalOrder: {
                ...singleLineCanonicalOrder,
                externalOrderNumber: "ROLLBACK-1",
              },
            },
          })
        ).rejects.toBeDefined();

        expect(
          await listOrdersForExternalNumber(orderModuleService, "ROLLBACK-1")
        ).toHaveLength(0);

        const references =
          await orderIngestionService.listOrderExternalReferences({
            external_order_number: "ROLLBACK-1",
            company_id: company.id,
          });
        expect(references).toHaveLength(1);
        expect(references[0].order_id).toEqual("order_preexisting");
      });

      it("TC-6: two concurrent identical submissions create exactly one order (idempotency under concurrency)", async () => {
        const container = getContainer();
        const companyService =
          container.resolve<ICompanyModuleService>(COMPANY_MODULE);
        const orderModuleService = container.resolve<IOrderModuleService>(
          Modules.ORDER
        );
        const orderIngestionService =
          container.resolve<OrderIngestionModuleService>(
            ORDER_INGESTION_MODULE
          );

        const company = await companyService.createCompanies({
          name: "TC-6 Company",
          email: "tc6@example.com",
          business_central_customer_number: "tc6-customer-number",
        });

        const input = {
          customer_number: "tc6-customer-number",
          canonicalOrder: {
            ...singleLineCanonicalOrder,
            externalOrderNumber: "RACE-1",
          },
        };

        const results = await Promise.allSettled([
          createOrderFromCanonicalPayloadWorkflow(container).run({ input }),
          createOrderFromCanonicalPayloadWorkflow(container).run({ input }),
        ]);

        expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
        expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);

        const references =
          await orderIngestionService.listOrderExternalReferences({
            external_order_number: "RACE-1",
            company_id: company.id,
          });
        expect(references).toHaveLength(1);
        expect(
          await listOrdersForExternalNumber(orderModuleService, "RACE-1")
        ).toHaveLength(1);
      });
```

## Implementation Steps

1. Create `steps/create-ingested-order.ts` and `steps/create-order-external-reference.ts` exactly
   as shown.
2. Replace `workflows/create-order-from-canonical-payload.ts` with the content shown.
3. Grep for other importers of `create-order-and-reference`; then delete that file.
4. Update `models/order-external-reference.ts` with the composite unique index.
5. Generate the migration (`db-generate` skill, module `orderIngestion`) and apply it
   (`db-migrate` skill). Inspect the generated SQL matches the expected index.
6. Add TC-4 to the module spec and TC-5/TC-6 (plus imports and helpers) to the workflow spec.
7. Run `pnpm test:integration:modules`, then `pnpm test:integration:http`. If the three
   order-ingestion HTTP suites time out in a `beforeAll` hook when run together, rerun them
   individually (known runner-bootstrap flake recorded in NIMBUS-129's PROGRESS.md) — do not
   change production code for it.
8. Run `pnpm build` and `pnpm lint` from the repo root.
