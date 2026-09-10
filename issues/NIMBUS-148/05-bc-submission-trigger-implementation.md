# Task 05: Trigger — Subscriber Wiring from the Ingestion Pipeline — Implementation Plan

**Status:** BLOCKED (see "Blocking dependency" below)
**App:** backend
**App Root:** apps/backend
**Task ID:** 05
**Date:** 2026-09-02
**Branch:** feature/NIMBUS-148-bc-order-submission (from develop)
**Depends on:** Task 04, **plus NIMBUS-129's Task 04 being implemented** (see below)

---

## Blocking dependency — read before starting

This is the **only** task in NIMBUS-148 that depends on code outside this story, and that code does
not exist yet.

`apps/backend/src/workflows/order-ingestion/` and `apps/backend/src/subscribers/*.ts` are both
empty today: NIMBUS-129's plan (`issues/NIMBUS-129/manifest.md`, tasks 01–05) is **approved but not
implemented** — verified by inspection, `apps/backend/src/modules/` contains only `approval`,
`business-central`, `company`, and `quote`, and `apps/backend/src/subscribers/` contains only
`README.md`.

**Do not start this task until NIMBUS-129 task 04
(`issues/NIMBUS-129/04-order-ingestion-event-chain-implementation.md`) is implemented and merged.**
Tasks 01–04 of NIMBUS-148 are unaffected and can ship without it; they leave a fully working,
fully tested, reusable workflow with no caller. That is a legitimate intermediate state — SCOPE.md's
deliverable is explicitly "the reusable piece plus its initial automatic trigger", and NIMBUS-158
will be the second caller.

If the plan is instead to ship NIMBUS-148 before NIMBUS-129, see "Fallback if NIMBUS-129 is not
coming soon" at the end of this document.

## Project Environment

- **App root:** `apps/backend`
- **Build command:** `pnpm build` (from repo root)
- **Lint command:** `pnpm lint` (from repo root)
- **Test command:** `cd apps/backend && pnpm test:integration:http`
- **Test framework:** Jest with `medusaIntegrationTestRunner` (`inApp: true`)
- **Test location:** `apps/backend/integration-tests/http/**/*.spec.ts`
- **Naming conventions:** subscriber files are kebab-case in `apps/backend/src/subscribers/` and
  use a **default export** for the handler plus a named `config` export — the only file type in
  this repo that uses a default export. Medusa auto-discovers every file in that directory at
  startup; there is no registration array and no `medusa-config.ts` change.
- **Quote style:** **double quotes**, 2-space indent.

## The trigger decision (SCOPE.md's explicitly-open question)

SCOPE.md leaves the 149→148 trigger mechanism open and warns "do not assume the NIMBUS-144→147
non-awaited-workflow convention applies". It does not, and it should not — that convention was
itself superseded.

**Chosen mechanism: a Medusa event subscriber on `order_ingestion.ready_for_business_central`.**

Reasoning, in order of weight:

1. **That event already exists in the approved design, specifically for this story.** NIMBUS-129's
   Task 04 defines `READY_FOR_BUSINESS_CENTRAL_EVENT =
   "order_ingestion.ready_for_business_central"` and emits it at the end of `enrichOrderWorkflow`,
   with the explicit note: *"This task defines and emits `order_ingestion.ready_for_business_central`
   as the boundary event NIMBUS-148 will eventually hang off of — but does not write a subscriber
   for it… When NIMBUS-148 is scoped, its own subscriber file should have
   `config.event: 'order_ingestion.ready_for_business_central'`."* Choosing anything else would
   leave a deliberately-provisioned boundary event with no consumer and invent a parallel path.
2. **The non-awaited-workflow-call convention SCOPE.md warns about is dead.** NIMBUS-129's
   architectural redesign replaced fire-and-forget workflow calls from route-handler code with real
   Medusa domain events (`emitEventStep` + `src/subscribers/*.ts`), on an explicit user directive.
   Re-introducing the old pattern here would be a regression.
3. **It satisfies the non-functional requirement without any extra machinery.** SCOPE.md requires
   that BC submission "never block or extend NIMBUS-144's synchronous 201 acknowledgment". The
   event is emitted from a workflow the route already does not await, so this story's work runs
   entirely off the response path.
4. **It keeps the reusable workflow caller-agnostic.** The subscriber is ~15 lines that resolve
   nothing but the workflow. NIMBUS-158 will add a second, independent caller (an admin route)
   against the same workflow with no change to this file.

Rejected alternatives, recorded so they are not re-litigated:

- *Calling `sendOrderToBusinessCentralWorkflow` directly from inside `enrichOrderWorkflow`* — makes
  BC submission a hard dependency of ingestion enrichment; a BC outage would then fail (and
  compensate) the enrichment workflow. It also couples two stories' workflows.
- *A scheduled job polling for orders whose integration state is `pending`* — this repo has no
  scheduled-job infrastructure in use, and NIMBUS-129 already flagged that filtering orders by a
  nested `metadata` JSON key via `query.graph()` is not a verified-reliable pattern here. It is a
  reasonable *recovery* mechanism to build later (it would also fix the "stuck mid-chain" gap
  NIMBUS-129 flagged), but it is not the primary trigger and is out of scope.

## Solution Design

One new file. The subscriber:

- imports `READY_FOR_BUSINESS_CENTRAL_EVENT` from NIMBUS-129's
  `workflows/order-ingestion/workflows/enrich-order` (importing the constant, not restating the
  string, so a rename cannot silently break the wiring),
- runs Task 04's `sendOrderToBusinessCentralWorkflow`,
- logs the outcome and **swallows** errors.

Swallowing is deliberate and follows the `building-with-medusa` skill's subscriber guidance
("Subscribers run asynchronously and don't block the main flow. Log errors but don't throw"). It is
also safe here specifically because Task 04's workflow already records every business failure into
the order's integration-state metadata — so a caught error is a genuinely exceptional case
(the order id vanished, the container failed), not a lost failure, and the recorded state is what
NIMBUS-158's widget reads either way.

## Code Skeletons

### New File: `apps/backend/src/subscribers/business-central-order-ready.ts`

```typescript
import type { SubscriberArgs, SubscriberConfig } from "@medusajs/medusa";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { READY_FOR_BUSINESS_CENTRAL_EVENT } from "../workflows/order-ingestion/workflows/enrich-order";
import { sendOrderToBusinessCentralWorkflow } from "../workflows/business-central-order/workflows/send-order-to-business-central";

type ReadyForBusinessCentralEventData = {
  order_id: string;
};

export default async function businessCentralOrderReadyHandler({
  event: { data },
  container,
}: SubscriberArgs<ReadyForBusinessCentralEventData>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);

  try {
    const { result } = await sendOrderToBusinessCentralWorkflow(container).run({
      input: { order_id: data.order_id },
    });

    logger.info(
      `Business Central submission for order ${data.order_id} finished with status ${result.status}`
    );
  } catch (error) {
    // Business failures are already recorded onto the order's integration-state metadata by the
    // workflow itself; reaching here means something exceptional happened. Log and stop — never
    // throw out of a subscriber.
    logger.error(
      `Business Central submission for order ${data.order_id} could not run: ${
        error instanceof Error ? error.message : "unknown error"
      }`
    );
  }
}

export const config: SubscriberConfig = {
  event: READY_FOR_BUSINESS_CENTRAL_EVENT,
};
```

Implementer notes:

- The default export is required by Medusa's `SubscriberLoader` — it validates that each file in
  `src/subscribers/` has a function default export and a `config.event`. This is the one place in
  this repo where a default export is correct, despite the repo-wide "avoid default exports" rule.
- `SubscriberArgs` / `SubscriberConfig` import from `@medusajs/medusa` here, matching NIMBUS-129
  Task 04's `order-ingestion-created.ts`. (`@medusajs/framework` also re-exports them; keep the two
  subscriber files consistent with each other.)
- Do **not** add a duplicate-submission check here. The guard lives inside
  `prepareBcOrderStep` (Task 04) precisely so that every caller — this subscriber and NIMBUS-158's
  future retry action — is protected by the same logic.

## Impacted Files

None modified. This task adds one new file.

## Test Cases

### TC-1: the subscriber handler runs the submission workflow for the event's order (happy path)
- **Given:** a seeded order (company with a BC customer number, canonical payload, pending
  integration state) and a stubbed BC service that resolves and accepts both lines
- **When:** the subscriber's default-exported handler is invoked directly with
  `{ event: { data: { order_id } }, container }`
- **Then:** the order's `business_central_integration` metadata reaches `status: "sent"` with a
  `bc_order_id` and `attempt_count: 1`

### TC-2: the subscriber never throws when the workflow throws (edge case)
- **Given:** an `order_id` that does not exist, which makes `prepareBcOrderStep` throw
  `MedusaError.NOT_FOUND`
- **When:** the handler is invoked
- **Then:** the returned promise **resolves** — the error is swallowed and logged, not propagated

### TC-3: the subscriber is registered for the exact boundary event NIMBUS-129 emits (wiring)
- **Given:** the subscriber module
- **When:** its `config` export is read
- **Then:** `config.event` strictly equals
  `"order_ingestion.ready_for_business_central"` — the same constant NIMBUS-129's
  `enrich-order.ts` exports

### TC-4: emitting the real event end-to-end drives the order to `sent` (integration/wiring)
- **Given:** the same seeded order, and NIMBUS-129's `emitOrderIngestionCreatedEventWorkflow` /
  `enrichOrderWorkflow` present
- **When:** `enrichOrderWorkflow` runs for that order (which emits
  `order_ingestion.ready_for_business_central` on completion)
- **Then:** polling the order's metadata reaches `business_central_integration.status === "sent"`
  within the timeout — proving the event → subscriber → workflow chain is really wired, not just
  the handler function

### New File: `apps/backend/integration-tests/http/business-central-order/bc-order-ready-subscriber.spec.ts`

```typescript
import { medusaIntegrationTestRunner } from "@medusajs/test-utils";
import { Modules } from "@medusajs/framework/utils";
import type { IOrderModuleService } from "@medusajs/framework/types";
import businessCentralOrderReadyHandler, {
  config as businessCentralOrderReadyConfig,
} from "../../../src/subscribers/business-central-order-ready";
import { enrichOrderWorkflow } from "../../../src/workflows/order-ingestion/workflows/enrich-order";
import { BUSINESS_CENTRAL_MODULE } from "../../../src/modules/business-central";
import type {
  BCCreatedSalesOrder,
  BCItemLookupResult,
  IBusinessCentralModuleService,
} from "../../../src/modules/business-central/types";
import { COMPANY_MODULE } from "../../../src/modules/company";
import type { ICompanyModuleService } from "../../../src/types";
import {
  BC_INTEGRATION_STATE_METADATA_KEY,
  createInitialBcIntegrationState,
} from "../../../src/modules/order-ingestion/bc-integration-state";
import type { BcIntegrationState } from "../../../src/modules/order-ingestion/bc-integration-state";

jest.setTimeout(60 * 1000);

const ITEM = {
  id: "11111111-1111-1111-1111-111111111111",
  number: "NKT-NIM-TELLURIDENA-S",
  displayName: "Telluride Jacket, Unisex, Navy - S",
  gtin: "5712094143628",
  baseUnitOfMeasureCode: "PCS",
};

const LOOKUP_RESULTS: BCItemLookupResult[] = [
  { lineNumber: 1, matched: true, item: ITEM, matchedBy: "eanNo" },
];

const CREATED: BCCreatedSalesOrder = {
  id: "22222222-2222-2222-2222-222222222222",
  number: "SO-009999",
  status: "Draft",
  acceptedLineNumbers: [1],
  rejectedLines: [],
};

medusaIntegrationTestRunner({
  inApp: true,
  testSuite: ({ getContainer }) => {
    describe("business-central-order-ready subscriber", () => {
      let counter = 0;

      async function seedOrder() {
        counter += 1;
        const container = getContainer();
        const companyService =
          container.resolve<ICompanyModuleService>(COMPANY_MODULE);
        const orderModuleService = container.resolve<IOrderModuleService>(
          Modules.ORDER
        );

        const company = await companyService.createCompanies({
          name: `BC Subscriber Co ${counter}`,
          email: `bc-sub-${counter}@example.com`,
          business_central_customer_number: "579000283084",
        });

        return orderModuleService.createOrders({
          currency_code: "DKK",
          metadata: {
            company_id: company.id,
            order_ingestion_state: "created",
            canonical_order: {
              externalOrderNumber: `SUB00${counter}`,
              orderDate: "2026-08-26",
              currencyCode: "DKK",
              lines: [
                {
                  lineNumber: 1,
                  itemNumber: "NKT-NIM-TELLURIDENA-S",
                  eanNo: "5712094143628",
                  description: "Telluride Jacket, Unisex, Navy - S",
                  quantity: 1,
                  unitPrice: 209.25,
                },
              ],
            },
            [BC_INTEGRATION_STATE_METADATA_KEY]:
              createInitialBcIntegrationState("2026-09-02T10:00:00.000Z"),
          },
        });
      }

      function stubBusinessCentral() {
        const bcService = getContainer().resolve<IBusinessCentralModuleService>(
          BUSINESS_CENTRAL_MODULE
        );

        jest
          .spyOn(bcService, "findItemsForOrderLines")
          .mockResolvedValue(LOOKUP_RESULTS);

        return jest
          .spyOn(bcService, "createSalesOrder")
          .mockResolvedValue(CREATED);
      }

      async function readIntegrationState(
        orderId: string
      ): Promise<BcIntegrationState> {
        const orderModuleService = getContainer().resolve<IOrderModuleService>(
          Modules.ORDER
        );
        const persisted = await orderModuleService.retrieveOrder(orderId, {
          select: ["id", "metadata"],
        });
        const metadata = (persisted.metadata ?? {}) as Record<string, unknown>;

        return metadata[
          BC_INTEGRATION_STATE_METADATA_KEY
        ] as BcIntegrationState;
      }

      async function waitForStatus(
        orderId: string,
        expected: string,
        timeoutMs = 10000
      ): Promise<BcIntegrationState> {
        const start = Date.now();

        while (Date.now() - start < timeoutMs) {
          const state = await readIntegrationState(orderId);

          if (state?.status === expected) {
            return state;
          }

          await new Promise((resolve) => setTimeout(resolve, 50));
        }

        throw new Error(
          `Timed out waiting for order ${orderId} to reach BC status "${expected}"`
        );
      }

      afterEach(() => {
        jest.restoreAllMocks();
      });

      it("TC-1: runs the submission workflow for the order in the event payload", async () => {
        const container = getContainer();
        const order = await seedOrder();
        const createSalesOrder = stubBusinessCentral();

        await businessCentralOrderReadyHandler({
          event: {
            eventName: businessCentralOrderReadyConfig.event as string,
            data: { order_id: order.id },
          },
          container,
        } as never);

        expect(createSalesOrder).toHaveBeenCalledTimes(1);

        const state = await readIntegrationState(order.id);
        expect(state.status).toEqual("sent");
        expect(state.bc_order_id).toEqual(CREATED.id);
        expect(state.attempt_count).toEqual(1);
      });

      it("TC-2: resolves instead of throwing when the workflow throws", async () => {
        // IMPLEMENT: invoke the handler with data.order_id = "order_does_not_exist" and assert
        // the returned promise resolves (use `await expect(...).resolves.toBeUndefined()`).
      });

      it("TC-3: is registered for the boundary event the ingestion chain emits", () => {
        expect(businessCentralOrderReadyConfig.event).toEqual(
          "order_ingestion.ready_for_business_central"
        );
      });

      it("TC-4: the real event chain drives the order to sent end to end", async () => {
        const order = await seedOrder();
        stubBusinessCentral();

        await enrichOrderWorkflow(getContainer()).run({
          input: { order_id: order.id },
        });

        const state = await waitForStatus(order.id, "sent");
        expect(state.bc_order_id).toEqual(CREATED.id);
      });
    });
  },
});
```

Run with: `cd apps/backend && pnpm test:integration:http`.

Notes on the test:

- TC-4 polls rather than asserting immediately, for the same reason NIMBUS-129 Task 04's own test
  does: the local in-memory event bus's subscriber-timing guarantees were not independently
  verified. Polling is correct whether subscribers run synchronously inside `emit()` or a tick
  later. **If TC-4 times out**, first raise the timeout to rule out a slow CI box; if it still never
  transitions, check that the event-name constant is genuinely shared (TC-3 covers the literal
  value) and that `enrichOrderWorkflow` actually emits on completion.
- The `as never` cast on the handler argument in TC-1 is there because `SubscriberArgs` carries
  more fields than a hand-built literal supplies. If it type-checks without the cast in the
  installed version, drop the cast — do not widen the handler's own signature to accommodate the
  test.

## Fallback if NIMBUS-129 is not coming soon

If NIMBUS-148 must ship a working trigger before NIMBUS-129's event chain lands, the minimum
change is:

1. Move the event-name constant into this story: declare
   `export const READY_FOR_BUSINESS_CENTRAL_EVENT = "order_ingestion.ready_for_business_central";`
   in `apps/backend/src/workflows/business-central-order/workflows/send-order-to-business-central.ts`
   and import it from there in the subscriber.
2. Drop TC-4 (there is no emitter to drive it) and keep TC-1/TC-2/TC-3.
3. Record in `issues/NIMBUS-129/PROGRESS.md` that NIMBUS-129's Task 04 must import that constant
   rather than declaring its own, so the two halves cannot drift apart.

This is strictly worse — a subscriber for an event nothing emits — so take it only if the sequencing
genuinely demands it. **Do not do this silently; it needs the user's decision.**

## Implementation Steps

1. **Confirm NIMBUS-129 Task 04 is implemented**: `apps/backend/src/workflows/order-ingestion/workflows/enrich-order.ts`
   exists and exports `READY_FOR_BUSINESS_CENTRAL_EVENT`. If it does not, stop and raise it — do
   not take the fallback path without the user's decision.
2. Create `apps/backend/src/subscribers/business-central-order-ready.ts` exactly as shown.
3. Create `apps/backend/integration-tests/http/business-central-order/bc-order-ready-subscriber.spec.ts`
   exactly as shown, filling in the one `// IMPLEMENT:` block (TC-2).
4. Run `cd apps/backend && pnpm test:integration:http` and confirm all four test cases pass
   alongside Task 04's suite and the pre-existing HTTP suites.
5. Run `pnpm build` from the repo root and fix any type errors before marking this task done.
