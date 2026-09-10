# Task 04: Reusable BC Order-Submission Workflow (`prepare` / `submit` / `record`) — Implementation Plan

**Status:** TODO
**App:** backend
**App Root:** apps/backend
**Task ID:** 04
**Date:** 2026-09-02
**Branch:** feature/NIMBUS-148-bc-order-submission (from develop)
**Depends on:** Task 01, Task 02, Task 03

---

## Project Environment

- **App root:** `apps/backend`
- **Build command:** `pnpm build` (from repo root)
- **Lint command:** `pnpm lint` (from repo root)
- **Test command:** `cd apps/backend && pnpm test:integration:http`
- **Test framework:** Jest with `medusaIntegrationTestRunner` from `@medusajs/test-utils`
  (`inApp: true`) — a real database and container are required, same as
  `apps/backend/integration-tests/http/companies/companies.spec.ts`.
- **Test location:** `apps/backend/integration-tests/http/**/*.spec.ts`
- **Naming conventions:** kebab-case files; workflows and steps as **named** exports; folder layout
  `steps/` + `workflows/` each with an `index.ts` barrel — copied exactly from
  `apps/backend/src/workflows/business-central-return/`.
- **Quote style:** **double quotes**, 2-space indent — match `business-central-return/**`.

## Solution Design

This task builds the **reusable piece** SCOPE.md requires: "a single reusable workflow/step, not
tied to a one-shot trigger — the same piece both the initial send (this story) and NIMBUS-158's
future manual retry invoke." Task 05 adds this story's automatic trigger on top of it. NIMBUS-158
will later call the same workflow from an admin route. **Nothing in this task knows how it was
invoked.**

```
apps/backend/src/workflows/business-central-order/
├── steps/
│   ├── index.ts
│   ├── prepare-bc-order.ts          # read-only: metadata + company + item resolution
│   ├── submit-bc-order.ts           # the BC write
│   └── record-bc-order-outcome.ts   # the Medusa metadata write
└── workflows/
    ├── index.ts
    └── send-order-to-business-central.ts
```

### Why three steps and not two

The existing `business-central-return` convention is a `prepare-*` / `submit-*` pair. This story
needs a third step because it has a **second mutation**: after writing to BC it must write the
outcome back onto the Medusa order's metadata. Medusa's own guidance is one mutation per step so
compensation works correctly, so the metadata write gets its own step with its own compensation
(restore the previous integration-state object). The `prepare-*` / `submit-*` naming and the
`steps/` + `workflows/` layout are preserved exactly.

### Why no `when()` and no thrown errors on the business paths

Workflow composition functions cannot contain conditionals, and `when()` blocks would make the
workflow's return value awkward across three mutually-exclusive outcomes. Instead the steps run
**unconditionally** and each one no-ops based on a discriminator carried in its input:

- `prepareBcOrderStep` returns `outcome: "skip" | "abort" | "submit"`.
- `submitBcOrderStep` calls BC only when `outcome === "submit"`; otherwise it passes the decision
  through.
- `recordBcOrderOutcomeStep` writes metadata only when `status !== "skipped"`.

Business failures (no company, unusable payload, zero lines resolved, BC rejected the submission)
are **returned as data, not thrown**. If they were thrown, the workflow would abort before the
record step and the integration state would be stranded at `pending` — the exact opposite of what
SCOPE.md asks for ("On a failed submission … set status to `failed`"). Only a genuinely
exceptional condition throws: the Medusa order id not existing at all (`MedusaError.NOT_FOUND`),
because there is then no metadata to record anything onto.

### Resolved SCOPE.md open questions

**Duplicate-submission guard** — short-circuit in `prepareBcOrderStep` on
`hasBusinessCentralOrder(state)` from Task 01, which is true when `bc_order_id` is set **or**
`status === "sent"`. Rationale over the alternative (a dedicated idempotency key): the BC order id
*is* the natural idempotency token, it is already required to be stored for NIMBUS-158, and it
needs no extra field, no extra table, and no extra migration. Checking `bc_order_id` as well as
`status` also covers the Task 03 edge case where BC accepted the header but rejected every line —
a BC order exists, so a re-invocation must not create another one even though the recorded status
is `failed`.

**Retry-count semantics** — `attempt_count` is incremented by `recordBcOrderOutcomeStep`, which
runs on every invocation that got past the duplicate guard, whether it succeeded or failed. So this
story's own first automatic attempt takes the counter from `0` to `1`, exactly as SCOPE.md
requires. A **short-circuited** (duplicate-guarded) invocation deliberately does **not** increment
and does **not** touch the status or timestamps: it made no attempt, and SCOPE.md's own rule that
"`pending` is left untouched if this story's logic never actually attempts a submission" is the
same principle. Flagged in PLAN.md as a resolved interpretation, since SCOPE.md's phrase "on every
invocation" read literally could also mean "including no-ops".

**Partial-failure recording, at both levels** — order level: `partial: true` plus a
`failure_reason` string. Line level: one `line_failures[]` entry per unsubmitted line, carrying
`line_number`, all three identifiers that were tried, a machine-readable `reason`, and an optional
`message`. Both live in the one `business_central_integration` metadata object from Task 01.

### Failure-reason strings written to `failure_reason`

Fixed set, so NIMBUS-158 can switch on them:

| Value | Meaning | Resulting status |
|---|---|---|
| `canonical_payload_unavailable` | `metadata.canonical_order` missing or unusable | `failed` |
| `company_unresolved` | `metadata.company_id` absent, or no such company | `failed` |
| `bc_customer_number_missing` | matched company has no `business_central_customer_number` | `failed` |
| `no_lines_resolved` | every line failed item lookup — no BC order is created | `failed` |
| `bc_submission_failed` | the BC header POST itself failed | `failed` |
| `all_lines_rejected_by_bc` | BC created the header but rejected every line | `failed` |
| `partial_lines_submitted` | at least one line submitted, at least one did not | `sent` |
| `null` | every line submitted | `sent` |

## Code Skeletons

### New File: `apps/backend/src/workflows/business-central-order/steps/prepare-bc-order.ts`

```typescript
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import {
  ContainerRegistrationKeys,
  MedusaError,
  Modules,
} from "@medusajs/framework/utils";
import type { IOrderModuleService } from "@medusajs/framework/types";
import { BUSINESS_CENTRAL_MODULE } from "../../../modules/business-central";
import type {
  BCCreateSalesOrderLineInput,
  BCCreateSalesOrderParams,
  BCItemLookupInput,
  BCItemLookupResult,
  IBusinessCentralModuleService,
} from "../../../modules/business-central/types";
import {
  BC_INTEGRATION_STATE_METADATA_KEY,
  hasBusinessCentralOrder,
  parseBcIntegrationState,
} from "../../../modules/order-ingestion/bc-integration-state";
import type { BcOrderLineFailure } from "../../../modules/order-ingestion/bc-integration-state";
import {
  parseBcOrderPayload,
  readCompanyIdFromMetadata,
} from "../../../modules/order-ingestion/bc-order-payload";
import type {
  BcOrderPayload,
  BcOrderPayloadAddress,
} from "../../../modules/order-ingestion/bc-order-payload";

export type PrepareBcOrderInput = {
  order_id: string;
};

export type PreparedBcOrderOutcome = "skip" | "abort" | "submit";

export type PreparedBcOrder = {
  orderId: string;
  outcome: PreparedBcOrderOutcome;
  failureReason: string | null;
  lineFailures: BcOrderLineFailure[];
  params: BCCreateSalesOrderParams | null;
};

function toBcDate(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  return /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : undefined;
}

function toBcAddress(
  address: BcOrderPayloadAddress | undefined
): BCCreateSalesOrderParams["billTo"] {
  if (!address) {
    return undefined;
  }

  return {
    name: address.name,
    contact: address.contact,
    addressLine1: address.addressLine1,
    addressLine2: address.addressLine2,
    city: address.city,
    state: address.state,
    postCode: address.postCode,
    country: address.country,
  };
}

function toLineFailure(
  payload: BcOrderPayload,
  result: Extract<BCItemLookupResult, { matched: false }>
): BcOrderLineFailure {
  const line = payload.lines.find(
    (candidate) => candidate.lineNumber === result.lineNumber
  );

  return {
    line_number: result.lineNumber,
    ean_no: line?.eanNo ?? null,
    item_number: line?.itemNumber ?? null,
    cust_item_no: line?.custItemNo ?? null,
    reason: result.reason,
    message: null,
  };
}

function aborted(
  orderId: string,
  failureReason: string,
  lineFailures: BcOrderLineFailure[] = []
): StepResponse<PreparedBcOrder> {
  return new StepResponse({
    orderId,
    outcome: "abort",
    failureReason,
    lineFailures,
    params: null,
  });
}

export const prepareBcOrderStep = createStep(
  "prepare-bc-order",
  async (
    input: PrepareBcOrderInput,
    { container }
  ): Promise<StepResponse<PreparedBcOrder>> => {
    const orderModuleService = container.resolve<IOrderModuleService>(
      Modules.ORDER
    );
    const query = container.resolve(ContainerRegistrationKeys.QUERY);
    const bcService = container.resolve<IBusinessCentralModuleService>(
      BUSINESS_CENTRAL_MODULE
    );

    const [order] = await orderModuleService.listOrders(
      { id: input.order_id },
      { select: ["id", "metadata"] }
    );

    if (!order) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        `Order '${input.order_id}' was not found`
      );
    }

    const metadata = (order.metadata ?? {}) as Record<string, unknown>;
    const integrationState = parseBcIntegrationState(
      metadata[BC_INTEGRATION_STATE_METADATA_KEY]
    );

    // Duplicate-submission guard: a Business Central sales order already exists for this Medusa
    // order, so do not create a second one. No attempt is made, so nothing is recorded.
    if (hasBusinessCentralOrder(integrationState)) {
      return new StepResponse({
        orderId: order.id,
        outcome: "skip",
        failureReason: null,
        lineFailures: [],
        params: null,
      });
    }

    const payloadResult = parseBcOrderPayload(metadata);

    if (!payloadResult.ok) {
      return aborted(order.id, "canonical_payload_unavailable");
    }

    const payload = payloadResult.payload;
    const companyId = readCompanyIdFromMetadata(metadata);

    if (!companyId) {
      return aborted(order.id, "company_unresolved");
    }

    const { data: companies } = await query.graph({
      entity: "companies",
      fields: ["id", "business_central_customer_number"],
      filters: { id: companyId },
    });
    const company = companies[0];

    if (!company) {
      return aborted(order.id, "company_unresolved");
    }

    const customerNumber = company.business_central_customer_number;

    if (typeof customerNumber !== "string" || customerNumber.length === 0) {
      return aborted(order.id, "bc_customer_number_missing");
    }

    const lookupInput: BCItemLookupInput[] = payload.lines.map((line) => ({
      lineNumber: line.lineNumber,
      eanNo: line.eanNo,
      itemNumber: line.itemNumber,
      custItemNo: line.custItemNo,
    }));
    const lookupResults = await bcService.findItemsForOrderLines(lookupInput);
    const lineFailures: BcOrderLineFailure[] = [];
    const resolvedLines: BCCreateSalesOrderLineInput[] = [];

    for (const result of lookupResults) {
      if (!result.matched) {
        lineFailures.push(toLineFailure(payload, result));
        continue;
      }

      const line = payload.lines.find(
        (candidate) => candidate.lineNumber === result.lineNumber
      );

      if (!line) {
        continue;
      }

      resolvedLines.push({
        lineNumber: line.lineNumber,
        itemId: result.item.id,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        description: line.description,
        unitOfMeasureCode: line.unitOfMeasureCode,
        discountPercent: line.discountPercent,
        discountAmount: line.discountAmount,
        taxCode: line.taxCode,
      });
    }

    // SCOPE.md: if NO lines resolve, the submission fails rather than creating an empty BC order.
    if (resolvedLines.length === 0) {
      return aborted(order.id, "no_lines_resolved", lineFailures);
    }

    return new StepResponse({
      orderId: order.id,
      outcome: "submit",
      failureReason: null,
      lineFailures,
      params: {
        customerNumber,
        externalDocumentNumber: payload.externalOrderNumber,
        orderDate: toBcDate(payload.orderDate),
        requestedDeliveryDate: toBcDate(payload.requestedDeliveryDate),
        currencyCode: payload.currencyCode,
        salesperson: payload.salesperson,
        pricesIncludeTax: payload.pricesIncludeTax,
        discountAmount: payload.discountAmount,
        discountAppliedBeforeTax: payload.discountAppliedBeforeTax,
        email: payload.email,
        phoneNumber: payload.phoneNumber,
        billTo: toBcAddress(payload.billTo),
        shipTo: toBcAddress(payload.shipTo),
        lines: resolvedLines,
      },
    });
  }
);
```

No compensation function: this step only reads and, at worst, throws — there is nothing to roll
back. (Same reasoning as NIMBUS-129's `matchCompanyAndCheckDuplicateStep`.)

### New File: `apps/backend/src/workflows/business-central-order/steps/submit-bc-order.ts`

```typescript
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { BUSINESS_CENTRAL_MODULE } from "../../../modules/business-central";
import type { IBusinessCentralModuleService } from "../../../modules/business-central/types";
import type { BcOrderLineFailure } from "../../../modules/order-ingestion/bc-integration-state";
import type { PreparedBcOrder } from "./prepare-bc-order";

export type BcSubmissionStatus = "skipped" | "sent" | "failed";

export type BcSubmissionOutcome = {
  orderId: string;
  status: BcSubmissionStatus;
  bcOrderId: string | null;
  bcOrderNumber: string | null;
  partial: boolean;
  failureReason: string | null;
  lineFailures: BcOrderLineFailure[];
};

export const submitBcOrderStep = createStep(
  "submit-bc-order",
  async (
    input: PreparedBcOrder,
    { container }
  ): Promise<StepResponse<BcSubmissionOutcome>> => {
    if (input.outcome === "skip") {
      return new StepResponse({
        orderId: input.orderId,
        status: "skipped",
        bcOrderId: null,
        bcOrderNumber: null,
        partial: false,
        failureReason: null,
        lineFailures: [],
      });
    }

    if (input.outcome === "abort" || !input.params) {
      return new StepResponse({
        orderId: input.orderId,
        status: "failed",
        bcOrderId: null,
        bcOrderNumber: null,
        partial: input.lineFailures.length > 0,
        failureReason: input.failureReason ?? "bc_submission_failed",
        lineFailures: input.lineFailures,
      });
    }

    const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
    const bcService = container.resolve<IBusinessCentralModuleService>(
      BUSINESS_CENTRAL_MODULE
    );

    try {
      const created = await bcService.createSalesOrder(input.params);

      // Logged immediately so the real BC order id is recoverable from logs even if the
      // outcome-recording step below fails to persist it (see this task's "Known limitation").
      logger.info(
        `Business Central sales order ${created.number} (${created.id}) created for Medusa order ${input.orderId}`
      );

      const lineFailures: BcOrderLineFailure[] = [...input.lineFailures];

      for (const rejection of created.rejectedLines) {
        const original = input.params.lines.find(
          (line) => line.lineNumber === rejection.lineNumber
        );

        lineFailures.push({
          line_number: rejection.lineNumber,
          ean_no: null,
          item_number: null,
          cust_item_no: null,
          reason: "rejected_by_bc",
          message: rejection.message,
        });

        if (!original) {
          continue;
        }
      }

      const allRejected = created.acceptedLineNumbers.length === 0;

      return new StepResponse({
        orderId: input.orderId,
        status: allRejected ? "failed" : "sent",
        bcOrderId: created.id,
        bcOrderNumber: created.number,
        partial: lineFailures.length > 0,
        failureReason: allRejected
          ? "all_lines_rejected_by_bc"
          : lineFailures.length > 0
            ? "partial_lines_submitted"
            : null,
        lineFailures,
      });
    } catch (error) {
      logger.error(
        `Business Central sales order submission failed for Medusa order ${input.orderId}: ${
          error instanceof Error ? error.message : "unknown error"
        }`
      );

      return new StepResponse({
        orderId: input.orderId,
        status: "failed",
        bcOrderId: null,
        bcOrderNumber: null,
        partial: input.lineFailures.length > 0,
        failureReason: "bc_submission_failed",
        lineFailures: input.lineFailures,
      });
    }
  }
);
```

Implementer notes:

- **No compensation function, deliberately.** A created Business Central sales order is externally
  visible business data in another system; silently deleting it on a downstream failure would be
  worse than leaving it. The `logger.info` above is the mitigation — see "Known limitation" below.
- The `if (!original) { continue; }` tail is dead weight; **delete the `original` lookup and that
  block entirely** if the linter flags the unused variable. It is shown only to make clear that the
  original line's identifiers are deliberately *not* re-attached to a `rejected_by_bc` failure —
  the line resolved fine, BC rejected the write, so the identifiers are not the problem.
- `ContainerRegistrationKeys.LOGGER` is the repo-standard logger handle; do not use `console.*`.

### New File: `apps/backend/src/workflows/business-central-order/steps/record-bc-order-outcome.ts`

```typescript
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import { Modules } from "@medusajs/framework/utils";
import type { IOrderModuleService } from "@medusajs/framework/types";
import {
  BC_INTEGRATION_STATE_METADATA_KEY,
  parseBcIntegrationState,
} from "../../../modules/order-ingestion/bc-integration-state";
import type { BcIntegrationState } from "../../../modules/order-ingestion/bc-integration-state";
import type { BcSubmissionOutcome } from "./submit-bc-order";

export type RecordBcOrderOutcomeCompensationData = {
  orderId: string;
  previousState: unknown;
};

export const recordBcOrderOutcomeStep = createStep(
  "record-bc-order-outcome",
  async (
    input: BcSubmissionOutcome,
    { container }
  ): Promise<
    StepResponse<BcIntegrationState, RecordBcOrderOutcomeCompensationData>
  > => {
    const orderModuleService = container.resolve<IOrderModuleService>(
      Modules.ORDER
    );
    const [order] = await orderModuleService.listOrders(
      { id: input.orderId },
      { select: ["id", "metadata"] }
    );
    const previousMetadata = (order?.metadata ?? {}) as Record<string, unknown>;
    const previousState = parseBcIntegrationState(
      previousMetadata[BC_INTEGRATION_STATE_METADATA_KEY]
    );

    // A short-circuited (duplicate-guarded) invocation made no attempt: leave the recorded state,
    // the attempt count, and every timestamp exactly as they were.
    if (input.status === "skipped") {
      return new StepResponse(previousState, {
        orderId: input.orderId,
        previousState: previousMetadata[BC_INTEGRATION_STATE_METADATA_KEY],
      });
    }

    const now = new Date().toISOString();
    const nextState: BcIntegrationState = {
      status: input.status,
      bc_order_id: input.bcOrderId,
      bc_order_number: input.bcOrderNumber,
      attempt_count: previousState.attempt_count + 1,
      initialized_at: previousState.initialized_at,
      last_attempt_at: now,
      sent_at: input.status === "sent" ? now : previousState.sent_at,
      partial: input.partial,
      failure_reason: input.failureReason,
      line_failures: input.lineFailures,
    };

    // `metadata` is one jsonb column: read-merge-write, or this update would wipe out
    // `canonical_order`, `company_id`, and `order_ingestion_state`.
    // IOrderModuleService.updateOrders takes a TWO-argument (id, data) form — not the single
    // merged-object form used by custom MedusaService-generated modules. Verified against
    // apps/backend/src/workflows/order/steps/update-order.ts. Do not "fix" this to one object.
    await orderModuleService.updateOrders(input.orderId, {
      metadata: {
        ...previousMetadata,
        [BC_INTEGRATION_STATE_METADATA_KEY]: nextState,
      },
    });

    return new StepResponse(nextState, {
      orderId: input.orderId,
      previousState: previousMetadata[BC_INTEGRATION_STATE_METADATA_KEY],
    });
  },
  async (compensationData, { container }) => {
    if (!compensationData) {
      return;
    }

    const orderModuleService = container.resolve<IOrderModuleService>(
      Modules.ORDER
    );
    const [order] = await orderModuleService.listOrders(
      { id: compensationData.orderId },
      { select: ["id", "metadata"] }
    );
    const currentMetadata = (order?.metadata ?? {}) as Record<string, unknown>;

    await orderModuleService.updateOrders(compensationData.orderId, {
      metadata: {
        ...currentMetadata,
        [BC_INTEGRATION_STATE_METADATA_KEY]: compensationData.previousState,
      },
    });
  }
);
```

### New File: `apps/backend/src/workflows/business-central-order/steps/index.ts`

```typescript
export * from "./prepare-bc-order";
export * from "./record-bc-order-outcome";
export * from "./submit-bc-order";
```

### New File: `apps/backend/src/workflows/business-central-order/workflows/send-order-to-business-central.ts`

```typescript
import {
  createWorkflow,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";
import { prepareBcOrderStep } from "../steps/prepare-bc-order";
import { recordBcOrderOutcomeStep } from "../steps/record-bc-order-outcome";
import { submitBcOrderStep } from "../steps/submit-bc-order";
import type { PrepareBcOrderInput } from "../steps/prepare-bc-order";

/**
 * Reusable Business Central order submission (NIMBUS-148).
 *
 * Invoked by this story's `order_ingestion.ready_for_business_central` subscriber for the initial
 * automatic send, and later by NIMBUS-158's manual-retry action. It is deliberately unaware of
 * which one called it: the duplicate-submission guard and the attempt counter live in the steps,
 * so every caller gets the same behaviour.
 */
export const sendOrderToBusinessCentralWorkflow = createWorkflow(
  "send-order-to-business-central",
  function (input: PrepareBcOrderInput) {
    const prepared = prepareBcOrderStep(input);
    const submitted = submitBcOrderStep(prepared);
    const recorded = recordBcOrderOutcomeStep(submitted);

    return new WorkflowResponse(recorded);
  }
);
```

Note: each step's output type already matches the next step's input type exactly, so **no
`transform()` is needed anywhere in this composition** — the step proxies are passed straight
through. Do not add a `transform()` "for consistency"; it would only add a failure surface.

### New File: `apps/backend/src/workflows/business-central-order/workflows/index.ts`

```typescript
export * from "./send-order-to-business-central";
```

## Impacted Files

None modified. This task adds six new files under
`apps/backend/src/workflows/business-central-order/`.

## Known limitation (flagged, not solved)

If `recordBcOrderOutcomeStep` fails **after** `submitBcOrderStep` created a real BC sales order,
the workflow's compensation restores the previous metadata and the integration state stays
`pending` — while a real BC order exists. A subsequent invocation would then create a duplicate BC
order, because the duplicate guard has nothing recorded to short-circuit on. Mitigation: the BC
order id and number are logged at `info` level the instant they are known, so the id is recoverable
from logs and can be reconciled manually. A durable fix (writing the BC order id in its own step
before computing the rest of the outcome, or an outbox row) is out of scope for this story and is
recorded in PLAN.md.

## Test Cases

### TC-1: full resolution — every line submitted, status `sent`, BC order id stored (happy path)
- **Given:** a company with `business_central_customer_number`, an order whose metadata carries a
  two-line `canonical_order` and a pending integration state, and a BC service stubbed to resolve
  both lines and accept both
- **When:** `sendOrderToBusinessCentralWorkflow` runs
- **Then:** the persisted `business_central_integration` has `status: "sent"`, the real
  `bc_order_id`/`bc_order_number`, `attempt_count: 1`, a `sent_at` and `last_attempt_at`,
  `partial: false`, `failure_reason: null`, and an empty `line_failures`

### TC-2: partial resolution — resolved subset submitted, both failure levels recorded, status `sent`
- **Given:** the same setup but line 2 fails item lookup with `not_found`
- **When:** the workflow runs
- **Then:** BC was called with **one** line only; the persisted state has `status: "sent"`,
  `partial: true`, `failure_reason: "partial_lines_submitted"`, and exactly one `line_failures`
  entry for `line_number: 2` carrying that line's `ean_no`/`item_number` and
  `reason: "not_found"`

### TC-3: zero lines resolved — no BC order created, status `failed`, no BC order id
- **Given:** both lines fail item lookup
- **When:** the workflow runs
- **Then:** `createSalesOrder` was **never called**; the persisted state has `status: "failed"`,
  `bc_order_id: null`, `failure_reason: "no_lines_resolved"`, `attempt_count: 1`, and two
  `line_failures` entries

### TC-4: the BC call itself fails — status `failed`, no fabricated BC order id
- **Given:** both lines resolve but `createSalesOrder` rejects
- **When:** the workflow runs
- **Then:** the persisted state has `status: "failed"`, `bc_order_id: null`,
  `bc_order_number: null`, `failure_reason: "bc_submission_failed"`, and `attempt_count: 1`

### TC-5: attempt count increments across repeated invocations
- **Given:** an order whose first invocation failed (`status: "failed"`, no `bc_order_id`) and a BC
  service that fails again
- **When:** the workflow runs a second and third time
- **Then:** `attempt_count` reaches `2` then `3`, and `last_attempt_at` moves forward each time

### TC-6: no duplicate BC order when invoked twice for the same Medusa order (the guard)
- **Given:** a first invocation that succeeded (`status: "sent"` with a `bc_order_id`)
- **When:** the workflow runs again
- **Then:** `createSalesOrder` was called exactly **once in total**, and the persisted state is
  byte-for-byte unchanged — same `bc_order_id`, same `attempt_count: 1`, same `last_attempt_at`

### TC-7: unusable canonical payload — recorded as `failed`, never left at `pending` (edge case)
- **Given:** an order whose metadata has an integration state but **no** `canonical_order` key
- **When:** the workflow runs
- **Then:** the persisted state has `status: "failed"`,
  `failure_reason: "canonical_payload_unavailable"`, `attempt_count: 1`, and no BC call was made

### TC-8: company with no BC customer number — recorded as `failed` (edge case)
- **Given:** a company whose `business_central_customer_number` is `null`
- **When:** the workflow runs
- **Then:** the persisted state has `failure_reason: "bc_customer_number_missing"` and no BC call
  was made

### TC-9: an unknown order id throws instead of silently no-opping (edge case)
- **Given:** an order id that does not exist
- **When:** the workflow runs
- **Then:** it rejects with a message containing `was not found`

### TC-10: recording the outcome preserves every other metadata key (integration/wiring)
- **Given:** an order whose metadata carries `canonical_order`, `company_id`,
  `order_ingestion_state`, and the integration state
- **When:** a successful workflow run records the outcome
- **Then:** `canonical_order`, `company_id`, and `order_ingestion_state` are all still present and
  unchanged on the persisted order

### New File: `apps/backend/integration-tests/http/business-central-order/send-order-to-bc.spec.ts`

```typescript
import { medusaIntegrationTestRunner } from "@medusajs/test-utils";
import { Modules } from "@medusajs/framework/utils";
import type { IOrderModuleService } from "@medusajs/framework/types";
import { sendOrderToBusinessCentralWorkflow } from "../../../src/workflows/business-central-order/workflows/send-order-to-business-central";
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

const ITEM_ONE = {
  id: "11111111-1111-1111-1111-111111111111",
  number: "NKT-NIM-TELLURIDENA-S",
  displayName: "Telluride Jacket, Unisex, Navy - S",
  gtin: "5712094143628",
  baseUnitOfMeasureCode: "PCS",
};

const ITEM_TWO = {
  id: "33333333-3333-3333-3333-333333333333",
  number: "NKT-NIM-TELLURIDENA-M",
  displayName: "Telluride Jacket, Unisex, Navy - M",
  gtin: "5712094143635",
  baseUnitOfMeasureCode: "PCS",
};

// Inline fixture derived from `issues/NIMBUS-129/example edi files/order2.xml`.
function canonicalOrder(externalOrderNumber: string) {
  return {
    externalOrderNumber,
    orderDate: "2026-08-26",
    currencyCode: "DKK",
    lines: [
      {
        lineNumber: 1,
        itemNumber: "NKT-NIM-TELLURIDENA-S",
        custItemNo: "NKT-NIM-TELLURIDENA-S",
        eanNo: "5712094143628",
        description: "Telluride Jacket, Unisex, Navy - S",
        quantity: 1,
        unitPrice: 209.25,
      },
      {
        lineNumber: 2,
        itemNumber: "NKT-NIM-TELLURIDENA-M",
        custItemNo: "NKT-NIM-TELLURIDENA-M",
        eanNo: "5712094143635",
        description: "Telluride Jacket, Unisex, Navy - M",
        quantity: 10,
        unitPrice: 209.25,
      },
    ],
  };
}

const matchedLine = (
  lineNumber: number,
  item: typeof ITEM_ONE
): BCItemLookupResult => ({
  lineNumber,
  matched: true,
  item,
  matchedBy: "eanNo",
});

const unmatchedLine = (lineNumber: number): BCItemLookupResult => ({
  lineNumber,
  matched: false,
  reason: "not_found",
});

const createdSalesOrder = (
  acceptedLineNumbers: number[]
): BCCreatedSalesOrder => ({
  id: "22222222-2222-2222-2222-222222222222",
  number: "SO-001234",
  status: "Draft",
  acceptedLineNumbers,
  rejectedLines: [],
});

medusaIntegrationTestRunner({
  inApp: true,
  testSuite: ({ getContainer }) => {
    describe("sendOrderToBusinessCentralWorkflow", () => {
      let counter = 0;

      /**
       * Creates a company + a header-only Medusa order carrying the metadata NIMBUS-149 will
       * initialize (raw canonical payload, company id, pending BC integration state). Built
       * directly via Modules.ORDER so this suite has no dependency on NIMBUS-129/149 code.
       */
      async function seedOrder(
        options: { businessCentralCustomerNumber: string | null; withCanonicalOrder?: boolean } = {
          businessCentralCustomerNumber: "579000283084",
        }
      ) {
        counter += 1;
        const container = getContainer();
        const companyService =
          container.resolve<ICompanyModuleService>(COMPANY_MODULE);
        const orderModuleService = container.resolve<IOrderModuleService>(
          Modules.ORDER
        );

        const company = await companyService.createCompanies({
          name: `BC Order Co ${counter}`,
          email: `bc-order-${counter}@example.com`,
          business_central_customer_number:
            options.businessCentralCustomerNumber,
        });

        const metadata: Record<string, unknown> = {
          company_id: company.id,
          order_ingestion_state: "ready_for_business_central",
          [BC_INTEGRATION_STATE_METADATA_KEY]: createInitialBcIntegrationState(
            "2026-09-02T10:00:00.000Z"
          ),
        };

        if (options.withCanonicalOrder !== false) {
          metadata.canonical_order = canonicalOrder(`NKT00${counter}`);
        }

        const order = await orderModuleService.createOrders({
          currency_code: "DKK",
          metadata,
        });

        return { company, order };
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

      /**
       * Stubs the two Business Central methods on the module service instance the workflow steps
       * resolve. The real HTTP behaviour of those methods is covered by Tasks 02/03's own
       * fetch-mocked module specs — this suite tests the workflow's decisions, not the wire format.
       */
      function stubBusinessCentral(
        lookupResults: BCItemLookupResult[],
        createResult: BCCreatedSalesOrder | Error
      ) {
        const bcService = getContainer().resolve<IBusinessCentralModuleService>(
          BUSINESS_CENTRAL_MODULE
        );
        const findItems = jest
          .spyOn(bcService, "findItemsForOrderLines")
          .mockResolvedValue(lookupResults);
        const createSalesOrder =
          createResult instanceof Error
            ? jest
                .spyOn(bcService, "createSalesOrder")
                .mockRejectedValue(createResult)
            : jest
                .spyOn(bcService, "createSalesOrder")
                .mockResolvedValue(createResult);

        return { findItems, createSalesOrder };
      }

      afterEach(() => {
        jest.restoreAllMocks();
      });

      it("TC-1: submits every line, records sent with the real BC order id", async () => {
        const { order } = await seedOrder();
        const { createSalesOrder } = stubBusinessCentral(
          [matchedLine(1, ITEM_ONE), matchedLine(2, ITEM_TWO)],
          createdSalesOrder([1, 2])
        );

        await sendOrderToBusinessCentralWorkflow(getContainer()).run({
          input: { order_id: order.id },
        });

        expect(createSalesOrder).toHaveBeenCalledTimes(1);
        expect(createSalesOrder.mock.calls[0][0].lines).toHaveLength(2);
        expect(createSalesOrder.mock.calls[0][0].customerNumber).toEqual(
          "579000283084"
        );

        const state = await readIntegrationState(order.id);
        expect(state.status).toEqual("sent");
        expect(state.bc_order_id).toEqual(
          "22222222-2222-2222-2222-222222222222"
        );
        expect(state.bc_order_number).toEqual("SO-001234");
        expect(state.attempt_count).toEqual(1);
        expect(state.partial).toBe(false);
        expect(state.failure_reason).toBeNull();
        expect(state.line_failures).toEqual([]);
        expect(state.sent_at).not.toBeNull();
        expect(state.last_attempt_at).not.toBeNull();
      });

      it("TC-2: submits the resolved subset and records both failure levels", async () => {
        const { order } = await seedOrder();
        const { createSalesOrder } = stubBusinessCentral(
          [matchedLine(1, ITEM_ONE), unmatchedLine(2)],
          createdSalesOrder([1])
        );

        await sendOrderToBusinessCentralWorkflow(getContainer()).run({
          input: { order_id: order.id },
        });

        expect(createSalesOrder.mock.calls[0][0].lines).toHaveLength(1);

        const state = await readIntegrationState(order.id);
        expect(state.status).toEqual("sent");
        expect(state.partial).toBe(true);
        expect(state.failure_reason).toEqual("partial_lines_submitted");
        expect(state.line_failures).toEqual([
          {
            line_number: 2,
            ean_no: "5712094143635",
            item_number: "NKT-NIM-TELLURIDENA-M",
            cust_item_no: "NKT-NIM-TELLURIDENA-M",
            reason: "not_found",
            message: null,
          },
        ]);
      });

      it("TC-3: creates no BC order at all when zero lines resolve", async () => {
        const { order } = await seedOrder();
        const { createSalesOrder } = stubBusinessCentral(
          [unmatchedLine(1), unmatchedLine(2)],
          createdSalesOrder([])
        );

        await sendOrderToBusinessCentralWorkflow(getContainer()).run({
          input: { order_id: order.id },
        });

        expect(createSalesOrder).not.toHaveBeenCalled();

        const state = await readIntegrationState(order.id);
        expect(state.status).toEqual("failed");
        expect(state.bc_order_id).toBeNull();
        expect(state.failure_reason).toEqual("no_lines_resolved");
        expect(state.attempt_count).toEqual(1);
        expect(state.line_failures).toHaveLength(2);
      });

      it("TC-4: records failed with no fabricated BC order id when the BC call fails", async () => {
        const { order } = await seedOrder();
        stubBusinessCentral(
          [matchedLine(1, ITEM_ONE), matchedLine(2, ITEM_TWO)],
          new Error("Business Central sales order request failed with status 500")
        );

        await sendOrderToBusinessCentralWorkflow(getContainer()).run({
          input: { order_id: order.id },
        });

        const state = await readIntegrationState(order.id);
        expect(state.status).toEqual("failed");
        expect(state.bc_order_id).toBeNull();
        expect(state.bc_order_number).toBeNull();
        expect(state.failure_reason).toEqual("bc_submission_failed");
        expect(state.attempt_count).toEqual(1);
      });

      it("TC-5: increments the attempt count on every repeated invocation", async () => {
        // IMPLEMENT: seed an order, stub findItemsForOrderLines to resolve both lines and
        // createSalesOrder to reject, then run the workflow three times, asserting
        // attempt_count is 1, then 2, then 3 after each run.
      });

      it("TC-6: does not create a second BC order when invoked twice for the same order", async () => {
        const { order } = await seedOrder();
        const { createSalesOrder } = stubBusinessCentral(
          [matchedLine(1, ITEM_ONE), matchedLine(2, ITEM_TWO)],
          createdSalesOrder([1, 2])
        );

        await sendOrderToBusinessCentralWorkflow(getContainer()).run({
          input: { order_id: order.id },
        });
        const firstState = await readIntegrationState(order.id);

        await sendOrderToBusinessCentralWorkflow(getContainer()).run({
          input: { order_id: order.id },
        });
        const secondState = await readIntegrationState(order.id);

        expect(createSalesOrder).toHaveBeenCalledTimes(1);
        expect(secondState).toEqual(firstState);
        expect(secondState.attempt_count).toEqual(1);
      });

      it("TC-7: records failed rather than leaving pending when the canonical payload is missing", async () => {
        const { order } = await seedOrder({
          businessCentralCustomerNumber: "579000283084",
          withCanonicalOrder: false,
        });
        const { createSalesOrder } = stubBusinessCentral(
          [],
          createdSalesOrder([])
        );

        await sendOrderToBusinessCentralWorkflow(getContainer()).run({
          input: { order_id: order.id },
        });

        expect(createSalesOrder).not.toHaveBeenCalled();

        const state = await readIntegrationState(order.id);
        expect(state.status).toEqual("failed");
        expect(state.failure_reason).toEqual("canonical_payload_unavailable");
        expect(state.attempt_count).toEqual(1);
      });

      it("TC-8: records failed when the matched company has no BC customer number", async () => {
        // IMPLEMENT: seedOrder({ businessCentralCustomerNumber: null }), stub BC, run the
        // workflow, then assert failure_reason is "bc_customer_number_missing" and
        // createSalesOrder was not called.
      });

      it("TC-9: throws for an order id that does not exist", async () => {
        await expect(
          sendOrderToBusinessCentralWorkflow(getContainer()).run({
            input: { order_id: "order_does_not_exist" },
          })
        ).rejects.toThrow(/was not found/);
      });

      it("TC-10: preserves every other metadata key when recording the outcome", async () => {
        const { company, order } = await seedOrder();
        stubBusinessCentral(
          [matchedLine(1, ITEM_ONE), matchedLine(2, ITEM_TWO)],
          createdSalesOrder([1, 2])
        );

        await sendOrderToBusinessCentralWorkflow(getContainer()).run({
          input: { order_id: order.id },
        });

        const orderModuleService = getContainer().resolve<IOrderModuleService>(
          Modules.ORDER
        );
        const persisted = await orderModuleService.retrieveOrder(order.id, {
          select: ["id", "metadata"],
        });
        const metadata = (persisted.metadata ?? {}) as Record<string, unknown>;

        expect(metadata.company_id).toEqual(company.id);
        expect(metadata.order_ingestion_state).toEqual(
          "ready_for_business_central"
        );
        expect(metadata.canonical_order).toBeDefined();
      });
    });
  },
});
```

Run with: `cd apps/backend && pnpm test:integration:http`.

### Residual uncertainty in this test suite — flagged, with a stated fallback

`stubBusinessCentral` assumes that `getContainer().resolve(BUSINESS_CENTRAL_MODULE)` and the
`container.resolve(BUSINESS_CENTRAL_MODULE)` inside a workflow step return **the same** service
instance, so a `jest.spyOn` on the former is observed by the latter. Medusa registers module
services as singletons, and a step's scoped container resolves through to the same registration, so
this should hold — but it was not independently verified against this exact Medusa version's
container internals during planning. **If TC-1 fails with the real `createSalesOrder` attempting an
actual HTTP request** (symptom: a `BUSINESS_CENTRAL_CLIENT_ID is required` or token error rather
than an assertion failure), fall back to mocking `global.fetch` in this suite the way Tasks 02/03's
specs do, setting the three `BUSINESS_CENTRAL_*` env vars in `beforeEach`, and asserting on request
URLs instead of on spy call counts. Do not change the production code to accommodate the test.

## Implementation Steps

1. Create the directories `apps/backend/src/workflows/business-central-order/steps/` and
   `apps/backend/src/workflows/business-central-order/workflows/`.
2. Create `steps/prepare-bc-order.ts` exactly as shown.
3. Create `steps/submit-bc-order.ts` exactly as shown, deleting the dead `original` lookup if the
   linter flags it (see the implementer note).
4. Create `steps/record-bc-order-outcome.ts` exactly as shown.
5. Create `steps/index.ts` and `workflows/index.ts` exactly as shown.
6. Create `workflows/send-order-to-business-central.ts` exactly as shown.
7. Create `apps/backend/integration-tests/http/business-central-order/send-order-to-bc.spec.ts`
   exactly as shown, filling in the two `// IMPLEMENT:` blocks (TC-5 and TC-8).
8. Run `cd apps/backend && pnpm test:integration:http` and confirm all ten test cases pass and the
   pre-existing HTTP suites still pass.
9. Run `pnpm build` from the repo root and fix any type errors before marking this task done.
