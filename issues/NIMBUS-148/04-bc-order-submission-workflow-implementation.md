# Task 04: Reusable BC Order-Submission Workflow (`prepare` / `submit` / `record`) — Implementation Plan

**Status:** DONE
**App:** backend
**App Root:** apps/backend
**Task ID:** 04
**Date:** 2026-09-29 (revised; supersedes the 2026-09-02 version)
**Branch:** feature/NIMBUS-148 (from develop)
**Depends on:** Task 01, Task 02, Task 03

---

## Project Environment

- **App root:** `apps/backend`
- **Build command:** `pnpm build` (from repo root)
- **Lint command:** `pnpm lint` (from repo root)
- **Test command:** `cd apps/backend && pnpm test:integration:http` (run this suite alone with
  `npx cross-env TEST_TYPE=integration:http NODE_OPTIONS=--experimental-vm-modules jest --runInBand --forceExit integration-tests/http/business-central-order`
  if the known full-run hook-timeout flake appears)
- **Test framework:** Jest with `medusaIntegrationTestRunner` (`inApp: true`) — real DB + container.
- **Test location:** `apps/backend/integration-tests/http/**/*.spec.ts`
- **Naming conventions:** kebab-case files; workflows and steps as **named** exports; `steps/` +
  `workflows/` folders each with an `index.ts` barrel, copied from
  `apps/backend/src/workflows/business-central-return/`.
- **Quote style:** **double quotes**, 2-space indent.

## What changed since the 2026-09-02 plan (read first)

Verified against `develop` on 2026-09-29:

1. **Dates were broken in the old skeleton.** Canonical dates are `DD-MM-YYYY`; the old `toBcDate`
   only accepted a `YYYY-MM-DD` prefix, so every real `orderDate` would have been silently dropped.
   Dates are now converted with Task 01's `canonicalDateToBcDate`.
2. **No pricing, discount, tax, description or salesperson fields are mapped** (PLAN.md
   Decision 6, confirmed by the user 2026-09-29).
   Only `itemId`, `quantity`, `unitOfMeasureCode`, and `shipmentDate` (from
   `requestedShipmentDate`) go on a line.
3. **A failing BC item lookup is now recorded, not thrown.** The old `prepareBcOrderStep` called
   `findItemsForOrderLines` without a `try/catch`, so a BC outage during lookup aborted the workflow
   and stranded the state at `pending` with `attempt_count: 0` — contradicting the plan's own
   "failures are data" rule. It is now recorded as `failed` / `bc_item_lookup_failed`.
4. **Ambiguous BC outcomes get their own reason.** Task 03 throws
   `BusinessCentralAmbiguousOutcomeError` when BC may have created the order (timeout, 5xx/408, 2xx
   without id). `submitBcOrderStep` records it as `failed` / `bc_submission_outcome_unknown`, so
   NIMBUS-158 knows to check BC before retrying (user decision 2026-09-29).
5. **`rejected_by_bc` line failures now carry the line's identifiers** (`ean_no`, `item_number`,
   `cust_item_no`). NIMBUS-129's standing guidance for NIMBUS-158 is that the widget must be able to
   render a failed line from `eanNo` alone; a failure record with `ean_no: null` could not be shown.
   The old skeleton's dead `original` lookup is gone.
6. **The container-spy test approach is proven in this repo.** `integration-tests/http/customers/company-sync.spec.ts`
   already `jest.spyOn`s the container-resolved `BUSINESS_CENTRAL_MODULE` service and the spy is
   observed inside `prepare-company-bc-sync.ts`. The old "residual uncertainty" and its fetch-mock
   fallback are removed.
7. **Workflow rejections are serialized plain objects**, not `MedusaError` instances (NIMBUS-129
   finding, see `create-order-workflow.spec.ts`). TC-9 asserts with
   `.rejects.toMatchObject({ type, message })`, not `.toThrow()`.
8. **Metadata written by ingestion on `develop`** (`create-ingested-order.ts`): `company_id`,
   `canonical_order`, `order_ingestion_state`, `order_ingestion_state_updated_at`,
   `business_central_integration`. The order also has native `shipping_address` / `billing_address`
   (NIMBUS-149 `mapCanonicalOrderHeader`) and an Order↔Company link (`isList` on the order side).
   This workflow reads the company from `metadata.company_id` and BC addresses from
   `canonical_order` (the verbatim source) — it does not need the link or the native addresses.
9. **Currency is sent only as an override (user decision 2026-09-29, PLAN.md Decision 15).**
   `prepareBcOrderStep` reads the BC customer with the existing
   `IBusinessCentralModuleService.getCustomer(customerNumber)` (NIMBUS-156). It returns
   `currencyCode: string | null` via `$expand=currency` and reports BC faithfully. A blank BC
   currency means local currency and is resolved with the company sync's own
   `resolveCurrencyCode` (NIMBUS-147, commit `d90c26a`: `BUSINESS_CENTRAL_LCY_CODE`, default
   `DKK`), which this task exports and reuses instead of duplicating. The order's `currencyCode`
   is sent (uppercased) only when it differs, case-insensitively, from that resolved customer
   currency; otherwise it is omitted so BC applies the customer default. The live BC value is used,
   not `Company.currency_code`, because companies synced before `d90c26a` can still hold `null`.
   A customer BC does not know is recorded as `bc_customer_not_found`; a failing customer request
   as `bc_customer_lookup_failed`.
10. **Tests use the shared fixture** `multiLineCanonicalOrder` from
   `src/modules/order-ingestion/__fixtures__/canonical-order-fixtures.ts` instead of an inline copy.

## Solution Design

```
apps/backend/src/workflows/business-central-order/
├── utils/
│   └── resolve-bc-currency-override.ts   # pure: override-only currency rule
├── __tests__/
│   └── resolve-bc-currency-override.unit.spec.ts
├── steps/
│   ├── index.ts
│   ├── prepare-bc-order.ts          # read-only: metadata + company + BC customer + items
│   ├── submit-bc-order.ts           # the BC write
│   └── record-bc-order-outcome.ts   # the Medusa metadata write
└── workflows/
    ├── index.ts
    └── send-order-to-business-central.ts
```

This is the **reusable piece**: this story's subscriber (Task 05) and NIMBUS-158's manual retry both
call `sendOrderToBusinessCentralWorkflow`. Nothing in it knows who invoked it.

- **Three steps, one mutation each.** The `prepare-*` / `submit-*` pair follows
  `business-central-return`; the metadata write gets its own step with its own compensation.
- **No `when()`, no business-path throws.** Each step no-ops on a discriminator
  (`outcome: "skip" | "abort" | "submit"`, then `status: "skipped" | "sent" | "failed"`). Business
  failures are returned as data so the record step always runs. Only a missing Medusa order throws
  (`MedusaError.NOT_FOUND`) — there is nothing to record onto.
- **Duplicate guard:** `prepareBcOrderStep` short-circuits when `hasBusinessCentralOrder(state)`
  (`bc_order_id` set **or** `status === "sent"`). A short-circuit touches nothing (no
  `attempt_count` increment, no timestamps) — user decision 2026-09-29.
- **Attempt counting:** `recordBcOrderOutcomeStep` increments `attempt_count` on every
  non-skipped invocation, success or failure. The first automatic attempt takes it `0 → 1`.

### `failure_reason` values (type `BcSubmissionFailureReason`, Task 01)

| Value | Meaning | Status | `bc_order_id` |
|---|---|---|---|
| `canonical_payload_unavailable` | `metadata.canonical_order` missing or unusable | `failed` | null |
| `company_unresolved` | `metadata.company_id` absent or no such company | `failed` | null |
| `bc_customer_number_missing` | company has no `business_central_customer_number` | `failed` | null |
| `bc_customer_lookup_failed` | the BC customer request itself failed | `failed` | null |
| `bc_customer_not_found` | BC has no customer with that number | `failed` | null |
| `bc_item_lookup_failed` | the BC item lookup request itself failed | `failed` | null |
| `no_lines_resolved` | every line failed item lookup; no BC order created | `failed` | null |
| `bc_submission_failed` | BC definitively rejected the header (4xx) or the request could not be built | `failed` | null |
| `bc_submission_outcome_unknown` | BC may have created the order (timeout, 5xx/408, 2xx without id) | `failed` | null |
| `all_lines_rejected_by_bc` | BC created the header but rejected every line | `failed` | **set** |
| `partial_lines_submitted` | ≥1 line submitted and ≥1 not | `sent` | set |
| `null` | every line submitted | `sent` | set |

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
  BCCustomer,
  BCItemLookupResult,
  BCSalesOrderAddressInput,
  IBusinessCentralModuleService,
} from "../../../modules/business-central/types";
import {
  BC_INTEGRATION_STATE_METADATA_KEY,
  hasBusinessCentralOrder,
  parseBcIntegrationState,
} from "../../../modules/order-ingestion/bc-integration-state";
import type {
  BcOrderLineFailure,
  BcSubmissionFailureReason,
} from "../../../modules/order-ingestion/bc-integration-state";
import {
  canonicalDateToBcDate,
  parseBcOrderPayload,
  readCompanyIdFromMetadata,
} from "../../../modules/order-ingestion/bc-order-payload";
import type {
  BcOrderPayload,
  BcOrderPayloadAddress,
} from "../../../modules/order-ingestion/bc-order-payload";
import { resolveBcCurrencyOverride } from "../utils/resolve-bc-currency-override";

export type PrepareBcOrderInput = {
  order_id: string;
};

export type PreparedBcOrderOutcome = "skip" | "abort" | "submit";

export type BcLineIdentifiers = {
  line_number: number;
  ean_no: string | null;
  item_number: string | null;
  cust_item_no: string | null;
};

export type PreparedBcOrder = {
  orderId: string;
  outcome: PreparedBcOrderOutcome;
  failureReason: BcSubmissionFailureReason | null;
  lineFailures: BcOrderLineFailure[];
  lineIdentifiers: BcLineIdentifiers[];
  params: BCCreateSalesOrderParams | null;
};

function toBcAddress(
  address: BcOrderPayloadAddress | undefined
): BCSalesOrderAddressInput | undefined {
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

function toLineIdentifiers(payload: BcOrderPayload): BcLineIdentifiers[] {
  return payload.lines.map((line) => ({
    line_number: line.lineNumber,
    ean_no: line.eanNo || null,
    item_number: line.itemNumber || null,
    cust_item_no: line.custItemNo || null,
  }));
}

function toLineFailure(
  identifiers: BcLineIdentifiers[],
  result: Extract<BCItemLookupResult, { matched: false }>
): BcOrderLineFailure {
  const line = identifiers.find(
    (candidate) => candidate.line_number === result.lineNumber
  );

  return {
    line_number: result.lineNumber,
    ean_no: line?.ean_no ?? null,
    item_number: line?.item_number ?? null,
    cust_item_no: line?.cust_item_no ?? null,
    reason: result.reason,
    message: null,
  };
}

function aborted(
  orderId: string,
  failureReason: BcSubmissionFailureReason,
  lineFailures: BcOrderLineFailure[] = [],
  lineIdentifiers: BcLineIdentifiers[] = []
): StepResponse<PreparedBcOrder> {
  return new StepResponse({
    orderId,
    outcome: "abort",
    failureReason,
    lineFailures,
    lineIdentifiers,
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
    const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
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
        lineIdentifiers: [],
        params: null,
      });
    }

    const payloadResult = parseBcOrderPayload(metadata);

    if (!payloadResult.ok) {
      return aborted(order.id, "canonical_payload_unavailable");
    }

    const payload = payloadResult.payload;
    const lineIdentifiers = toLineIdentifiers(payload);
    const companyId = readCompanyIdFromMetadata(metadata);

    if (!companyId) {
      return aborted(order.id, "company_unresolved", [], lineIdentifiers);
    }

    const { data: companies } = await query.graph({
      entity: "companies",
      fields: ["id", "business_central_customer_number"],
      filters: { id: companyId },
    });
    const company = companies[0];

    if (!company) {
      return aborted(order.id, "company_unresolved", [], lineIdentifiers);
    }

    const customerNumber = company.business_central_customer_number;

    if (typeof customerNumber !== "string" || customerNumber.length === 0) {
      return aborted(order.id, "bc_customer_number_missing", [], lineIdentifiers);
    }

    let bcCustomer: BCCustomer | null;

    try {
      bcCustomer = await bcService.getCustomer(customerNumber);
    } catch (error) {
      logger.error(
        `Business Central customer lookup failed for Medusa order ${order.id}: ${
          error instanceof Error ? error.message : "unknown error"
        }`
      );

      return aborted(order.id, "bc_customer_lookup_failed", [], lineIdentifiers);
    }

    if (!bcCustomer) {
      return aborted(order.id, "bc_customer_not_found", [], lineIdentifiers);
    }

    let lookupResults: BCItemLookupResult[];

    try {
      lookupResults = await bcService.findItemsForOrderLines(
        payload.lines.map((line) => ({
          lineNumber: line.lineNumber,
          eanNo: line.eanNo,
          itemNumber: line.itemNumber,
          custItemNo: line.custItemNo,
        }))
      );
    } catch (error) {
      logger.error(
        `Business Central item lookup failed for Medusa order ${order.id}: ${
          error instanceof Error ? error.message : "unknown error"
        }`
      );

      return aborted(order.id, "bc_item_lookup_failed", [], lineIdentifiers);
    }

    const lineFailures: BcOrderLineFailure[] = [];
    const resolvedLines: BCCreateSalesOrderLineInput[] = [];

    for (const result of lookupResults) {
      if (!result.matched) {
        lineFailures.push(toLineFailure(lineIdentifiers, result));
        continue;
      }

      const line = payload.lines.find(
        (candidate) => candidate.lineNumber === result.lineNumber
      );

      if (!line) {
        continue;
      }

      // No unitPrice, discount, tax or description: Business Central prices and describes the
      // line from its own master data (NIMBUS-129 PROGRESS.md, 2026-09-16).
      resolvedLines.push({
        lineNumber: line.lineNumber,
        itemId: result.item.id,
        quantity: line.quantity,
        unitOfMeasureCode: line.unitOfMeasureCode,
        shipmentDate: line.requestedShipmentDate
          ? canonicalDateToBcDate(line.requestedShipmentDate)
          : undefined,
      });
    }

    // SCOPE.md: if NO lines resolve, the submission fails rather than creating an empty BC order.
    if (resolvedLines.length === 0) {
      return aborted(order.id, "no_lines_resolved", lineFailures, lineIdentifiers);
    }

    return new StepResponse({
      orderId: order.id,
      outcome: "submit",
      failureReason: null,
      lineFailures,
      lineIdentifiers,
      params: {
        customerNumber,
        externalDocumentNumber: payload.externalOrderNumber,
        orderDate: canonicalDateToBcDate(payload.orderDate),
        requestedDeliveryDate: payload.requestedDeliveryDate
          ? canonicalDateToBcDate(payload.requestedDeliveryDate)
          : undefined,
        // Override only: omitted when it matches the BC customer's own currency.
        currencyCode: resolveBcCurrencyOverride(
          payload.currencyCode,
          bcCustomer.currencyCode
        ),
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

No compensation: this step only reads.

### New File: `apps/backend/src/workflows/business-central-order/utils/resolve-bc-currency-override.ts`

```typescript
import { resolveCurrencyCode } from "../../company/steps/prepare-company-bc-sync";

/*
  The order's currency is sent to Business Central only as an override. When it matches the BC
  customer's own currency it is omitted, so BC applies the customer default. A blank BC customer
  currency means local currency (LCY) and is resolved exactly as the company sync resolves it
  (NIMBUS-147, d90c26a): BUSINESS_CENTRAL_LCY_CODE, default DKK.
*/
export function resolveBcCurrencyOverride(
  orderCurrencyCode: string,
  bcCustomerCurrencyCode: string | null
): string | undefined {
  const orderCurrency = orderCurrencyCode.trim().toUpperCase();
  const customerCurrency = resolveCurrencyCode(bcCustomerCurrencyCode).toUpperCase();

  return orderCurrency === customerCurrency ? undefined : orderCurrency;
}
```

### Modified File: `apps/backend/src/workflows/company/steps/prepare-company-bc-sync.ts`

One-word change so the LCY rule has a single definition. Change

```typescript
function resolveCurrencyCode(bcCurrencyCode: string | null): string {
```

to

```typescript
export function resolveCurrencyCode(bcCurrencyCode: string | null): string {
```

Nothing else in that file changes.

### New File: `apps/backend/src/workflows/business-central-order/__tests__/resolve-bc-currency-override.unit.spec.ts`

Runs under `pnpm test:unit` (`**/src/**/__tests__/**/*.unit.spec.ts`).

```typescript
import { resolveBcCurrencyOverride } from "../utils/resolve-bc-currency-override";

describe("resolveBcCurrencyOverride", () => {
  const originalLcy = process.env.BUSINESS_CENTRAL_LCY_CODE;

  afterEach(() => {
    if (originalLcy === undefined) {
      delete process.env.BUSINESS_CENTRAL_LCY_CODE;
    } else {
      process.env.BUSINESS_CENTRAL_LCY_CODE = originalLcy;
    }
  });

  it("CUR-1: omits the currency when it matches the BC customer currency", () => {
    expect(resolveBcCurrencyOverride("EUR", "EUR")).toBeUndefined();
  });

  it("CUR-2: compares case-insensitively", () => {
    expect(resolveBcCurrencyOverride("dkk", "DKK")).toBeUndefined();
  });

  it("CUR-3: sends the uppercased order currency when it differs", () => {
    expect(resolveBcCurrencyOverride("eur", "DKK")).toEqual("EUR");
  });

  it("CUR-4: treats a blank BC currency as the default local currency DKK", () => {
    delete process.env.BUSINESS_CENTRAL_LCY_CODE;

    expect(resolveBcCurrencyOverride("DKK", null)).toBeUndefined();
    expect(resolveBcCurrencyOverride("DKK", "  ")).toBeUndefined();
    expect(resolveBcCurrencyOverride("EUR", null)).toEqual("EUR");
  });

  it("CUR-5: honours BUSINESS_CENTRAL_LCY_CODE for a blank BC currency", () => {
    // IMPLEMENT: set process.env.BUSINESS_CENTRAL_LCY_CODE = "SEK"; assert
    // resolveBcCurrencyOverride("SEK", null) is undefined and
    // resolveBcCurrencyOverride("DKK", null) equals "DKK".
  });
});
```

### New File: `apps/backend/src/workflows/business-central-order/steps/submit-bc-order.ts`

```typescript
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { BUSINESS_CENTRAL_MODULE } from "../../../modules/business-central";
import { BusinessCentralAmbiguousOutcomeError } from "../../../modules/business-central/service";
import type { IBusinessCentralModuleService } from "../../../modules/business-central/types";
import type {
  BcOrderLineFailure,
  BcSubmissionFailureReason,
} from "../../../modules/order-ingestion/bc-integration-state";
import type { PreparedBcOrder } from "./prepare-bc-order";

export type BcSubmissionStatus = "skipped" | "sent" | "failed";

export type BcSubmissionOutcome = {
  orderId: string;
  status: BcSubmissionStatus;
  bcOrderId: string | null;
  bcOrderNumber: string | null;
  partial: boolean;
  failureReason: BcSubmissionFailureReason | null;
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
      // outcome-recording step fails to persist it (PLAN.md Decision 7).
      logger.info(
        `Business Central sales order ${created.number} (${created.id}) created for Medusa order ${input.orderId}`
      );

      const lineFailures: BcOrderLineFailure[] = [...input.lineFailures];

      for (const rejection of created.rejectedLines) {
        const identifiers = input.lineIdentifiers.find(
          (line) => line.line_number === rejection.lineNumber
        );

        lineFailures.push({
          line_number: rejection.lineNumber,
          ean_no: identifiers?.ean_no ?? null,
          item_number: identifiers?.item_number ?? null,
          cust_item_no: identifiers?.cust_item_no ?? null,
          reason: "rejected_by_bc",
          message: rejection.message,
        });
      }

      const allRejected = created.acceptedLineNumbers.length === 0;
      const failureReason: BcSubmissionFailureReason | null = allRejected
        ? "all_lines_rejected_by_bc"
        : lineFailures.length > 0
          ? "partial_lines_submitted"
          : null;

      return new StepResponse({
        orderId: input.orderId,
        status: allRejected ? "failed" : "sent",
        bcOrderId: created.id,
        bcOrderNumber: created.number,
        partial: lineFailures.length > 0,
        failureReason,
        lineFailures,
      });
    } catch (error) {
      const outcomeUnknown = error instanceof BusinessCentralAmbiguousOutcomeError;

      logger.error(
        `Business Central sales order submission ${
          outcomeUnknown ? "has an unknown outcome" : "failed"
        } for Medusa order ${input.orderId}: ${
          error instanceof Error ? error.message : "unknown error"
        }`
      );

      return new StepResponse({
        orderId: input.orderId,
        status: "failed",
        bcOrderId: null,
        bcOrderNumber: null,
        partial: input.lineFailures.length > 0,
        failureReason: outcomeUnknown
          ? "bc_submission_outcome_unknown"
          : "bc_submission_failed",
        lineFailures: input.lineFailures,
      });
    }
  }
);
```

- **No compensation, deliberately.** A created BC sales order is another system's business data.
- Use the container logger, never `console.*`.

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

    // A short-circuited (duplicate-guarded) invocation made no attempt: leave everything as it was.
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

    // metadata is one jsonb column: read-merge-write, or this update would wipe out
    // canonical_order, company_id and order_ingestion_state. IOrderModuleService.updateOrders takes
    // the TWO-argument (id, data) form — same as update-order-ingestion-state.ts.
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
 * Invoked by the `order_ingestion.ready_for_business_central` subscriber for the initial automatic
 * send, and later by NIMBUS-158's manual retry. It does not know which one called it: the duplicate
 * guard and the attempt counter live in the steps, so every caller gets the same behaviour.
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

Each step's output type is the next step's input type, so no `transform()` is needed. The
`new Date()` call lives inside a step body (runtime), not in the composition function.

### New File: `apps/backend/src/workflows/business-central-order/workflows/index.ts`

```typescript
export * from "./send-order-to-business-central";
```

## Impacted Files

One word changes in `apps/backend/src/workflows/company/steps/prepare-company-bc-sync.ts` (export
`resolveCurrencyCode`). Seven new source files and one unit spec under
`apps/backend/src/workflows/business-central-order/`, plus one HTTP test file.

## Known limitation (flagged, not solved)

If `recordBcOrderOutcomeStep` fails **after** a real BC order was created, compensation restores the
previous metadata, the state stays `pending`, and a later invocation would create a duplicate.
Mitigation: the BC id/number are logged at `info` the moment they are known. A durable fix (persist
the id in its own step first, or an outbox row) is out of scope.

## Test Cases

### TC-1: full resolution — every line submitted, status `sent`, BC id stored (happy path)
- **Given:** a company with a BC customer number and an order carrying `multiLineCanonicalOrder`
  (dates `26-08-2026`) plus a pending state; BC stubbed to resolve and accept both lines
- **When:** `sendOrderToBusinessCentralWorkflow` runs
- **Then:** `createSalesOrder` got `customerNumber`, `externalDocumentNumber`,
  `orderDate: "2026-08-26"`, no `currencyCode` (DKK order, DKK BC customer), the `shipTo` address, and two lines with **no `unitPrice` key**; the
  state is `sent`, real `bc_order_id`/`bc_order_number`, `attempt_count: 1`, `sent_at` and
  `last_attempt_at` set, `partial: false`, `failure_reason: null`, `line_failures: []`

### TC-2: partial resolution — resolved subset submitted, both levels recorded, status `sent`
- **Given:** line 2 fails lookup (`not_found`)
- **Then:** BC got one line; state `sent`, `partial: true`, `failure_reason:
  "partial_lines_submitted"`, one failure for line 2 with its `ean_no`/`item_number`/`cust_item_no`

### TC-3: zero lines resolved — no BC order, status `failed`
- **Then:** `createSalesOrder` never called; `failed`, `bc_order_id: null`,
  `failure_reason: "no_lines_resolved"`, `attempt_count: 1`, two line failures

### TC-4: BC definitively rejects the submission — `failed`, no fabricated id
- **Given:** `createSalesOrder` rejects with a plain `Error`
- **Then:** `failed`, `bc_order_id: null`, `bc_order_number: null`,
  `failure_reason: "bc_submission_failed"`, `attempt_count: 1`

### TC-5: `attempt_count` increments across repeated invocations
- **Given:** `createSalesOrder` keeps rejecting
- **When:** the workflow runs three times
- **Then:** `attempt_count` is 1, 2, 3 and `last_attempt_at` never moves backwards

### TC-6: no duplicate BC order when invoked twice (the guard)
- **Given:** a first run that succeeded
- **When:** the workflow runs again
- **Then:** `createSalesOrder` was called once in total and the state is unchanged
  (`attempt_count: 1`, same `last_attempt_at`)

### TC-7: missing canonical payload — `failed`, never left `pending` (edge case)
- **Then:** `failure_reason: "canonical_payload_unavailable"`, `attempt_count: 1`, no BC call

### TC-8: company without a BC customer number — `failed` (edge case)
- **Then:** `failure_reason: "bc_customer_number_missing"`, no BC call

### TC-9: unknown order id rejects (edge case)
- **Then:** rejects with `{ type: "not_found", message: containing "was not found" }`

### TC-10: recording preserves every other metadata key (wiring)
- **Then:** `canonical_order`, `company_id`, `order_ingestion_state` unchanged after a successful run

### TC-14: order currency differs from the BC customer's — sent as an override
- **Given:** fixture currency `DKK`, BC customer currency `EUR`
- **Then:** `createSalesOrder` got `currencyCode: "DKK"` (TC-1 covers the match case: omitted)

### TC-15: a blank BC customer currency is local currency
- **Given:** BC customer `currencyCode: null`, `BUSINESS_CENTRAL_LCY_CODE=DKK`
- **Then:** a `DKK` order sends no `currencyCode`; an `EUR` order sends `"EUR"`

### TC-16: BC has no such customer
- **Then:** `failed` / `bc_customer_not_found`; no item lookup and no create

### TC-17: the BC customer request fails
- **Then:** `failed` / `bc_customer_lookup_failed`; no create

### TC-11: BC item lookup request fails — recorded, not thrown (edge case)
- **Given:** `findItemsForOrderLines` rejects
- **Then:** the workflow resolves; `failed`, `failure_reason: "bc_item_lookup_failed"`,
  `attempt_count: 1`, `createSalesOrder` never called

### TC-12: ambiguous BC outcome gets its own reason (edge case)
- **Given:** `createSalesOrder` rejects with `BusinessCentralAmbiguousOutcomeError`
- **Then:** `failed`, `bc_order_id: null`, `failure_reason: "bc_submission_outcome_unknown"`

### TC-13: a line BC rejects is recorded with the line's identifiers (edge case)
- **Given:** both lines resolve; `createSalesOrder` returns `acceptedLineNumbers: [1]` and
  `rejectedLines: [{ lineNumber: 2, message: "Business Central rejected the sales order line with status 400" }]`
- **Then:** `sent`, `partial: true`, one failure `{ line_number: 2, ean_no: "5712094143635",
  item_number: "NKT-NIM-TELLURIDENA-M", cust_item_no: "NKT-NIM-TELLURIDENA-M",
  reason: "rejected_by_bc", message: ... }`

### New File: `apps/backend/integration-tests/http/business-central-order/send-order-to-bc.spec.ts`

```typescript
import { medusaIntegrationTestRunner } from "@medusajs/test-utils";
import { Modules } from "@medusajs/framework/utils";
import type { IOrderModuleService } from "@medusajs/framework/types";
import { sendOrderToBusinessCentralWorkflow } from "../../../src/workflows/business-central-order/workflows/send-order-to-business-central";
import { BUSINESS_CENTRAL_MODULE } from "../../../src/modules/business-central";
import { BusinessCentralAmbiguousOutcomeError } from "../../../src/modules/business-central/service";
import type {
  BCCreatedSalesOrder,
  BCCustomer,
  BCItem,
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
import { multiLineCanonicalOrder } from "../../../src/modules/order-ingestion/__fixtures__/canonical-order-fixtures";

jest.setTimeout(60 * 1000);

const ITEM_ONE: BCItem = {
  id: "11111111-1111-1111-1111-111111111111",
  number: "NKT-NIM-TELLURIDENA-S",
  displayName: "Telluride Jacket, Unisex, Navy - S",
  gtin: "5712094143628",
  baseUnitOfMeasureCode: "PCS",
};

const ITEM_TWO: BCItem = {
  id: "33333333-3333-3333-3333-333333333333",
  number: "NKT-NIM-TELLURIDENA-M",
  displayName: "Telluride Jacket, Unisex, Navy - M",
  gtin: "5712094143635",
  baseUnitOfMeasureCode: "PCS",
};

const matchedLine = (lineNumber: number, item: BCItem): BCItemLookupResult => ({
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
  acceptedLineNumbers: number[],
  rejectedLines: BCCreatedSalesOrder["rejectedLines"] = []
): BCCreatedSalesOrder => ({
  id: "22222222-2222-2222-2222-222222222222",
  number: "SO-001234",
  status: "Draft",
  acceptedLineNumbers,
  rejectedLines,
});

function bcCustomer(currencyCode: string | null): BCCustomer {
  return {
    number: "579000283084",
    displayName: "METZ A/S",
    email: "",
    phoneNumber: "",
    addressLine1: "Skelstedet 9",
    addressLine2: "",
    city: "Vedbæk",
    state: "",
    postalCode: "2950",
    country: "DK",
    blocked: "not_blocked",
    creditLimit: null,
    taxRegistrationNumber: "",
    currencyCode,
  };
}

medusaIntegrationTestRunner({
  inApp: true,
  testSuite: ({ getContainer }) => {
    describe("sendOrderToBusinessCentralWorkflow", () => {
      let counter = 0;

      /**
       * Creates a company and a header-only order carrying the metadata ingestion writes on
       * develop (company_id, canonical_order, order_ingestion_state, pending BC state). Built via
       * Modules.ORDER directly so individual keys can be omitted for edge cases.
       */
      async function seedOrder(
        options: {
          businessCentralCustomerNumber?: string | null;
          withCanonicalOrder?: boolean;
          currencyCode?: string;
        } = {}
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
            options.businessCentralCustomerNumber === undefined
              ? "579000283084"
              : options.businessCentralCustomerNumber,
        });

        const metadata: Record<string, unknown> = {
          company_id: company.id,
          order_ingestion_state: "ready_for_business_central",
          [BC_INTEGRATION_STATE_METADATA_KEY]: createInitialBcIntegrationState(
            "2026-09-29T10:00:00.000Z"
          ),
        };

        if (options.withCanonicalOrder !== false) {
          metadata.canonical_order = {
            ...multiLineCanonicalOrder,
            externalOrderNumber: `BC-ORDER-${counter}`,
            currencyCode: options.currencyCode ?? multiLineCanonicalOrder.currencyCode,
          };
        }

        const order = await orderModuleService.createOrders({
          currency_code: "dkk",
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

        return metadata[BC_INTEGRATION_STATE_METADATA_KEY] as BcIntegrationState;
      }

      /**
       * Stubs the two BC methods on the container-resolved module service (same pattern as
       * integration-tests/http/customers/company-sync.spec.ts). The HTTP behaviour of those methods
       * is covered by Tasks 02/03's fetch-mocked specs.
       */
      function stubBusinessCentral(
        lookupResults: BCItemLookupResult[] | Error,
        createResult: BCCreatedSalesOrder | Error,
        customer: BCCustomer | null | Error = bcCustomer("DKK")
      ) {
        const bcService = getContainer().resolve<IBusinessCentralModuleService>(
          BUSINESS_CENTRAL_MODULE
        );
        const getCustomer =
          customer instanceof Error
            ? jest.spyOn(bcService, "getCustomer").mockRejectedValue(customer)
            : jest.spyOn(bcService, "getCustomer").mockResolvedValue(customer);
        const findItems =
          lookupResults instanceof Error
            ? jest
                .spyOn(bcService, "findItemsForOrderLines")
                .mockRejectedValue(lookupResults)
            : jest
                .spyOn(bcService, "findItemsForOrderLines")
                .mockResolvedValue(lookupResults);
        const createSalesOrder =
          createResult instanceof Error
            ? jest.spyOn(bcService, "createSalesOrder").mockRejectedValue(createResult)
            : jest.spyOn(bcService, "createSalesOrder").mockResolvedValue(createResult);

        return { findItems, createSalesOrder, getCustomer };
      }

      async function run(orderId: string) {
        await sendOrderToBusinessCentralWorkflow(getContainer()).run({
          input: { order_id: orderId },
        });
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

        await run(order.id);

        expect(createSalesOrder).toHaveBeenCalledTimes(1);
        const params = createSalesOrder.mock.calls[0][0];
        expect(params.customerNumber).toEqual("579000283084");
        expect(params.externalDocumentNumber).toMatch(/^BC-ORDER-/);
        expect(params.orderDate).toEqual("2026-08-26");
        // Order currency DKK matches the BC customer's DKK: no override is sent.
        expect(params.currencyCode).toBeUndefined();
        expect(params.shipTo).toMatchObject({ name: "JK Tryk", country: "DK" });
        expect(params.lines).toHaveLength(2);
        for (const line of params.lines) {
          expect(Object.keys(line)).not.toContain("unitPrice");
        }

        const state = await readIntegrationState(order.id);
        expect(state.status).toEqual("sent");
        expect(state.bc_order_id).toEqual("22222222-2222-2222-2222-222222222222");
        expect(state.bc_order_number).toEqual("SO-001234");
        expect(state.attempt_count).toEqual(1);
        expect(state.partial).toBe(false);
        expect(state.failure_reason).toBeNull();
        expect(state.line_failures).toEqual([]);
        expect(state.sent_at).not.toBeNull();
        expect(state.last_attempt_at).not.toBeNull();
        expect(state.initialized_at).toEqual("2026-09-29T10:00:00.000Z");
      });

      it("TC-2: submits the resolved subset and records both failure levels", async () => {
        const { order } = await seedOrder();
        const { createSalesOrder } = stubBusinessCentral(
          [matchedLine(1, ITEM_ONE), unmatchedLine(2)],
          createdSalesOrder([1])
        );

        await run(order.id);

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

        await run(order.id);

        expect(createSalesOrder).not.toHaveBeenCalled();

        const state = await readIntegrationState(order.id);
        expect(state.status).toEqual("failed");
        expect(state.bc_order_id).toBeNull();
        expect(state.failure_reason).toEqual("no_lines_resolved");
        expect(state.attempt_count).toEqual(1);
        expect(state.line_failures).toHaveLength(2);
      });

      it("TC-4: records failed with no fabricated BC order id when BC rejects the order", async () => {
        const { order } = await seedOrder();
        stubBusinessCentral(
          [matchedLine(1, ITEM_ONE), matchedLine(2, ITEM_TWO)],
          new Error("Business Central sales order request failed with status 422")
        );

        await run(order.id);

        const state = await readIntegrationState(order.id);
        expect(state.status).toEqual("failed");
        expect(state.bc_order_id).toBeNull();
        expect(state.bc_order_number).toBeNull();
        expect(state.failure_reason).toEqual("bc_submission_failed");
        expect(state.attempt_count).toEqual(1);
      });

      it("TC-5: increments the attempt count on every repeated invocation", async () => {
        // IMPLEMENT: seed an order, stub lookups to resolve both lines and createSalesOrder to
        // reject with new Error("boom"); call run(order.id) three times, asserting
        // readIntegrationState(order.id).attempt_count is 1, then 2, then 3, and that each
        // last_attempt_at is >= the previous one (compare ISO strings).
      });

      it("TC-6: does not create a second BC order when invoked twice for the same order", async () => {
        const { order } = await seedOrder();
        const { createSalesOrder } = stubBusinessCentral(
          [matchedLine(1, ITEM_ONE), matchedLine(2, ITEM_TWO)],
          createdSalesOrder([1, 2])
        );

        await run(order.id);
        const firstState = await readIntegrationState(order.id);

        await run(order.id);
        const secondState = await readIntegrationState(order.id);

        expect(createSalesOrder).toHaveBeenCalledTimes(1);
        expect(secondState).toEqual(firstState);
        expect(secondState.attempt_count).toEqual(1);
      });

      it("TC-7: records failed rather than leaving pending when the canonical payload is missing", async () => {
        const { order } = await seedOrder({ withCanonicalOrder: false });
        const { createSalesOrder } = stubBusinessCentral([], createdSalesOrder([]));

        await run(order.id);

        expect(createSalesOrder).not.toHaveBeenCalled();

        const state = await readIntegrationState(order.id);
        expect(state.status).toEqual("failed");
        expect(state.failure_reason).toEqual("canonical_payload_unavailable");
        expect(state.attempt_count).toEqual(1);
      });

      it("TC-8: records failed when the matched company has no BC customer number", async () => {
        // IMPLEMENT: seedOrder({ businessCentralCustomerNumber: null }), stub BC with both lines
        // matched, run the workflow, then assert failure_reason is "bc_customer_number_missing",
        // status is "failed", and createSalesOrder was not called.
      });

      it("TC-9: rejects for an order id that does not exist", async () => {
        await expect(
          sendOrderToBusinessCentralWorkflow(getContainer()).run({
            input: { order_id: "order_does_not_exist" },
          })
        ).rejects.toMatchObject({
          type: "not_found",
          message: expect.stringContaining("was not found"),
        });
      });

      it("TC-10: preserves every other metadata key when recording the outcome", async () => {
        const { company, order } = await seedOrder();
        stubBusinessCentral(
          [matchedLine(1, ITEM_ONE), matchedLine(2, ITEM_TWO)],
          createdSalesOrder([1, 2])
        );

        await run(order.id);

        const orderModuleService = getContainer().resolve<IOrderModuleService>(
          Modules.ORDER
        );
        const persisted = await orderModuleService.retrieveOrder(order.id, {
          select: ["id", "metadata"],
        });
        const metadata = (persisted.metadata ?? {}) as Record<string, unknown>;

        expect(metadata.company_id).toEqual(company.id);
        expect(metadata.order_ingestion_state).toEqual("ready_for_business_central");
        expect(metadata.canonical_order).toEqual(order.metadata?.canonical_order);
      });

      it("TC-11: records bc_item_lookup_failed when the item lookup request fails", async () => {
        const { order } = await seedOrder();
        const { createSalesOrder } = stubBusinessCentral(
          new Error("Business Central item request failed with status 500"),
          createdSalesOrder([])
        );

        await run(order.id);

        expect(createSalesOrder).not.toHaveBeenCalled();

        const state = await readIntegrationState(order.id);
        expect(state.status).toEqual("failed");
        expect(state.failure_reason).toEqual("bc_item_lookup_failed");
        expect(state.attempt_count).toEqual(1);
      });

      it("TC-12: records bc_submission_outcome_unknown for an ambiguous BC outcome", async () => {
        // IMPLEMENT: seed an order, stub both lines matched and createSalesOrder rejecting with
        // new BusinessCentralAmbiguousOutcomeError("timeout", "BC-ORDER-x"); run; assert status
        // "failed", bc_order_id null, failure_reason "bc_submission_outcome_unknown".
      });

      it("TC-13: records a BC-rejected line with that line's identifiers", async () => {
        const { order } = await seedOrder();
        stubBusinessCentral(
          [matchedLine(1, ITEM_ONE), matchedLine(2, ITEM_TWO)],
          createdSalesOrder(
            [1],
            [
              {
                lineNumber: 2,
                message: "Business Central rejected the sales order line with status 400",
              },
            ]
          )
        );

        await run(order.id);

        const state = await readIntegrationState(order.id);
        expect(state.status).toEqual("sent");
        expect(state.partial).toBe(true);
        expect(state.line_failures).toEqual([
          {
            line_number: 2,
            ean_no: "5712094143635",
            item_number: "NKT-NIM-TELLURIDENA-M",
            cust_item_no: "NKT-NIM-TELLURIDENA-M",
            reason: "rejected_by_bc",
            message: "Business Central rejected the sales order line with status 400",
          },
        ]);
      });

      it("TC-14: sends the order currency as an override when it differs from the BC customer's", async () => {
        const { order } = await seedOrder();
        const { createSalesOrder } = stubBusinessCentral(
          [matchedLine(1, ITEM_ONE), matchedLine(2, ITEM_TWO)],
          createdSalesOrder([1, 2]),
          bcCustomer("EUR")
        );

        await run(order.id);

        expect(createSalesOrder.mock.calls[0][0].currencyCode).toEqual("DKK");
      });

      it("TC-15: treats a blank BC customer currency as local currency", async () => {
        const originalLcy = process.env.BUSINESS_CENTRAL_LCY_CODE;
        process.env.BUSINESS_CENTRAL_LCY_CODE = "DKK";

        try {
          const { order: dkkOrder } = await seedOrder();
          const { createSalesOrder } = stubBusinessCentral(
            [matchedLine(1, ITEM_ONE), matchedLine(2, ITEM_TWO)],
            createdSalesOrder([1, 2]),
            bcCustomer(null)
          );

          await run(dkkOrder.id);
          expect(createSalesOrder.mock.calls[0][0].currencyCode).toBeUndefined();

          // IMPLEMENT: seedOrder({ currencyCode: "EUR" }), run it with the same stubs, and assert
          // the second createSalesOrder call's params.currencyCode is "EUR".
        } finally {
          if (originalLcy === undefined) {
            delete process.env.BUSINESS_CENTRAL_LCY_CODE;
          } else {
            process.env.BUSINESS_CENTRAL_LCY_CODE = originalLcy;
          }
        }
      });

      it("TC-16: records bc_customer_not_found when BC has no such customer", async () => {
        const { order } = await seedOrder();
        const { createSalesOrder, findItems } = stubBusinessCentral(
          [matchedLine(1, ITEM_ONE), matchedLine(2, ITEM_TWO)],
          createdSalesOrder([1, 2]),
          null
        );

        await run(order.id);

        expect(findItems).not.toHaveBeenCalled();
        expect(createSalesOrder).not.toHaveBeenCalled();

        const state = await readIntegrationState(order.id);
        expect(state.status).toEqual("failed");
        expect(state.failure_reason).toEqual("bc_customer_not_found");
        expect(state.attempt_count).toEqual(1);
      });

      it("TC-17: records bc_customer_lookup_failed when the BC customer request fails", async () => {
        // IMPLEMENT: stubBusinessCentral(both lines matched, createdSalesOrder([1, 2]),
        // new Error("Business Central customer request failed with status 500")); run; assert
        // status "failed", failure_reason "bc_customer_lookup_failed", createSalesOrder not called.
      });
    });
  },
});
```

## Implementation Steps

1. Create `apps/backend/src/workflows/business-central-order/steps/` and `.../workflows/`.
2. Add `export` to `resolveCurrencyCode` in
   `apps/backend/src/workflows/company/steps/prepare-company-bc-sync.ts` (nothing else). Create
   `utils/resolve-bc-currency-override.ts` and `__tests__/resolve-bc-currency-override.unit.spec.ts`
   (fill in CUR-5), then run `cd apps/backend && pnpm test:unit`.
3. Create `steps/prepare-bc-order.ts`, `steps/submit-bc-order.ts`,
   `steps/record-bc-order-outcome.ts`, `steps/index.ts` exactly as shown.
4. Create `workflows/send-order-to-business-central.ts` and `workflows/index.ts` exactly as shown.
5. Create `integration-tests/http/business-central-order/send-order-to-bc.spec.ts` exactly as shown,
   filling in the five `// IMPLEMENT:` blocks (TC-5, TC-8, TC-12, TC-15, TC-17).
6. Run this suite (see Project Environment for the single-suite command), then
   `cd apps/backend && pnpm test:integration:http`. All 17 cases pass; pre-existing suites are no
   worse than before (NIMBUS-149 recorded pre-existing quotes `cartSeeder` 400s and a
   security-boundaries hook timeout — report, do not fix).
7. Run `pnpm build` from the repo root and fix any type errors.
