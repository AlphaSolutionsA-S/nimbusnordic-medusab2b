# Task 01: Extend the BC Integration-State Contract + Add the Defensive Payload Reader — Implementation Plan

**Status:** TODO
**App:** backend
**App Root:** apps/backend
**Task ID:** 01
**Date:** 2026-09-29 (revised; supersedes the 2026-09-02 version)
**Branch:** feature/NIMBUS-148 (from develop)
**Depends on:** None (NIMBUS-149 is merged on `develop` and already created the file this task extends)

---

## Project Environment

- **App root:** `apps/backend`
- **Build command:** `pnpm build` (from repo root) or `cd apps/backend && pnpm build`
- **Lint command:** `pnpm lint` (from repo root)
- **Test command:** `cd apps/backend && pnpm test:unit`
- **Test framework:** Jest (`@swc/jest`, node environment, no DB needed for this task)
- **Test location:** `apps/backend/src/**/__tests__/**/*.unit.spec.ts`. **Naming is load-bearing**:
  the file MUST end in exactly `.unit.spec.ts` or `pnpm test:unit` will not pick it up.
- **Shared fixtures:** `apps/backend/src/modules/order-ingestion/__fixtures__/canonical-order-fixtures.ts`
  (NIMBUS-129). It lives outside `__tests__/` on purpose — `test:integration:modules` collects every
  `.ts` file under `src/modules/*/__tests__/`. Import from it; never add a fixture file under
  `__tests__/`.
- **Naming conventions:** kebab-case file names, named exports, `type` aliases for unions, 2-space
  indent, **double quotes** (matches every `src/modules/order-ingestion/*.ts` file).
- **zod import path:** `import { z } from "@medusajs/framework/zod";` — never the bare `zod` package.

## What changed since the 2026-09-02 plan (read first)

1. **`bc-integration-state.ts` already exists on `develop`.** NIMBUS-149 (merged, `dca2852`) created
   it with NIMBUS-148's exact contract: `BC_INTEGRATION_STATE_METADATA_KEY =
   "business_central_integration"`, `BcIntegrationStatus`, `BcOrderLineFailureReason`,
   `BcOrderLineFailure`, `BcIntegrationState`, and `createInitialBcIntegrationState`. Every new order
   gets `metadata.business_central_integration = createInitialBcIntegrationState(now)` in
   `createIngestedOrderStep`. **This task APPENDS to that file. Do not recreate it, do not rename or
   reorder anything already in it, and do not change `createInitialBcIntegrationState`.**
2. **`bc-integration-state.unit.spec.ts` already exists** with TC-1 (the initial state). This task
   appends TC-2..TC-5 to it.
3. **Canonical dates are `DD-MM-YYYY`** (`CanonicalDateSchema` in `canonical-order-schema.ts`, user
   decision 2026-09-16). Business Central's `Edm.Date` needs `YYYY-MM-DD`. The old plan's inline
   fixtures used ISO dates and its date helper would have silently dropped every real date. This
   task adds the conversion helper `canonicalDateToBcDate` and validates dates with the canonical
   `CanonicalDateSchema`.
4. **The narrow payload schema no longer carries pricing or description fields.** Per the user
   decision recorded in `issues/NIMBUS-129/PROGRESS.md` (2026-09-16), a submitted `unitPrice` must
   not be sent to BC (see PLAN.md Decision 6). The payload reader models only what Task 04 actually
   sends. Unmodelled fields — `unitPrice`, discounts, tax, `description` — are stripped on parse and
   remain untouched in `metadata.canonical_order`.
5. **`currencyCode` is modelled** (required, as in the canonical contract). Task 04 sends it to BC
   only as an override when it differs from the BC customer's own currency (user decision
   2026-09-29, PLAN.md Decision 15).
6. **`requestedShipmentDate` is now modelled** (submitter-owned "when" fact per the same decision;
   Task 03 sends it as the BC line's `shipmentDate`).

## Solution Design

1. **Append to `bc-integration-state.ts`:** the status/reason allow-lists, a defensive
   `parseBcIntegrationState` that turns an untrusted metadata value into a well-formed state, and the
   duplicate-submission guard `hasBusinessCentralOrder`.
2. **Create `bc-order-payload.ts`:** metadata key constants, a **narrow, non-strict** zod schema over
   `metadata.canonical_order` covering only the fields NIMBUS-148 sends, a discriminated-result
   parser, a company-id reader, and `canonicalDateToBcDate`.

### Why a narrow schema instead of importing `CanonicalOrderSchema`

`CanonicalOrderSchema` exists now, so the old "unbuilt code" argument is gone. The narrow schema is
still the right choice at this trust boundary:
- `CanonicalOrderSchema` is `.strict()`. `Order.metadata.canonical_order` is stored data that
  outlives contract changes; if NIMBUS-147 later adds a required field, every previously stored order
  would fail a strict re-parse and be recorded `canonical_payload_unavailable`.
- Only a handful of fields matter for BC submission.

It does reuse `CanonicalDateSchema` from `canonical-order-schema.ts`, so the date rule is defined once.

### Security note

Nothing in either file carries a token, credential, or secret. `line_failures[].message` holds a
short BC-status or lookup reason string only — never a raw HTTP body or header.

## Code Skeletons

### Modified File: `apps/backend/src/modules/order-ingestion/bc-integration-state.ts`

**Append** the following below the existing `createInitialBcIntegrationState` function. Leave the
existing file content (doc comment, key, types, factory) exactly as it is.

```typescript
/**
 * The fixed set of values NIMBUS-148 writes to `BcIntegrationState.failure_reason` (the state's
 * field stays `string | null` so older or foreign values still parse). NIMBUS-158 can switch on
 * these. Meanings are documented in Task 04 / PLAN.md.
 */
export type BcSubmissionFailureReason =
  | "canonical_payload_unavailable"
  | "company_unresolved"
  | "bc_customer_number_missing"
  | "bc_customer_lookup_failed"
  | "bc_customer_not_found"
  | "bc_item_lookup_failed"
  | "no_lines_resolved"
  | "bc_submission_failed"
  | "bc_submission_outcome_unknown"
  | "all_lines_rejected_by_bc"
  | "partial_lines_submitted";

const BC_INTEGRATION_STATUSES: readonly BcIntegrationStatus[] = [
  "pending",
  "sent",
  "failed",
];

const BC_ORDER_LINE_FAILURE_REASONS: readonly BcOrderLineFailureReason[] = [
  "no_identifiers",
  "not_found",
  "ambiguous",
  "rejected_by_bc",
];

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function parseLineFailure(value: unknown): BcOrderLineFailure | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const raw = value as Record<string, unknown>;

  if (typeof raw.line_number !== "number") {
    return null;
  }

  const reason = BC_ORDER_LINE_FAILURE_REASONS.includes(
    raw.reason as BcOrderLineFailureReason
  )
    ? (raw.reason as BcOrderLineFailureReason)
    : "not_found";

  return {
    line_number: raw.line_number,
    ean_no: optionalString(raw.ean_no),
    item_number: optionalString(raw.item_number),
    cust_item_no: optionalString(raw.cust_item_no),
    reason,
    message: optionalString(raw.message),
  };
}

/**
 * Reads an untrusted `Order.metadata[BC_INTEGRATION_STATE_METADATA_KEY]` value into a well-formed
 * state object. Anything missing or malformed falls back to the pending state, so a partially
 * written or absent state can never crash the submission path — an absent state means "never
 * attempted". NIMBUS-158 reads the state through this function too.
 */
export function parseBcIntegrationState(value: unknown): BcIntegrationState {
  if (typeof value !== "object" || value === null) {
    return {
      status: "pending",
      bc_order_id: null,
      bc_order_number: null,
      attempt_count: 0,
      initialized_at: null,
      last_attempt_at: null,
      sent_at: null,
      partial: false,
      failure_reason: null,
      line_failures: [],
    };
  }

  const raw = value as Record<string, unknown>;
  const status = BC_INTEGRATION_STATUSES.includes(raw.status as BcIntegrationStatus)
    ? (raw.status as BcIntegrationStatus)
    : "pending";
  const lineFailures = Array.isArray(raw.line_failures)
    ? raw.line_failures
        .map(parseLineFailure)
        .filter((failure): failure is BcOrderLineFailure => failure !== null)
    : [];

  return {
    status,
    bc_order_id: optionalString(raw.bc_order_id),
    bc_order_number: optionalString(raw.bc_order_number),
    attempt_count:
      typeof raw.attempt_count === "number" && raw.attempt_count >= 0
        ? raw.attempt_count
        : 0,
    initialized_at: optionalString(raw.initialized_at),
    last_attempt_at: optionalString(raw.last_attempt_at),
    sent_at: optionalString(raw.sent_at),
    partial: raw.partial === true,
    failure_reason: optionalString(raw.failure_reason),
    line_failures: lineFailures,
  };
}

/**
 * The duplicate-submission guard. True once a real Business Central sales order exists for this
 * Medusa order — either the last attempt reported `sent`, or a BC order id was recorded at all
 * (which also happens on a `failed` outcome where BC created the header but rejected every line).
 */
export function hasBusinessCentralOrder(state: BcIntegrationState): boolean {
  return state.bc_order_id !== null || state.status === "sent";
}
```

### New File: `apps/backend/src/modules/order-ingestion/bc-order-payload.ts`

```typescript
import { z } from "@medusajs/framework/zod";
import { CanonicalDateSchema } from "./canonical-order-schema";

/**
 * The `Order.metadata` key holding the verbatim canonical order JSON written by
 * `createIngestedOrderStep` (src/workflows/order-ingestion/steps/create-ingested-order.ts). It is
 * the only source of order-line detail: these orders have no `OrderLineItem` records.
 */
export const CANONICAL_ORDER_METADATA_KEY = "canonical_order";

/**
 * The `Order.metadata` key holding the matched Medusa company id, written by the same step.
 */
export const COMPANY_ID_METADATA_KEY = "company_id";

/**
 * Deliberately NARROW and NON-STRICT view of the canonical order: only the fields NIMBUS-148 sends
 * to Business Central. Plain `z.object` strips unknown keys instead of rejecting them, so pricing,
 * discount, tax and description fields (which are not sent — see PLAN.md Decision 6) and any field
 * NIMBUS-147 adds later do not break parsing. Do NOT add `.strict()`.
 */
export const BcOrderPayloadAddressSchema = z.object({
  name: z.string().optional(),
  contact: z.string().optional(),
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postCode: z.string().optional(),
  country: z.string().optional(),
});

export type BcOrderPayloadAddress = z.infer<typeof BcOrderPayloadAddressSchema>;

export const BcOrderPayloadLineSchema = z.object({
  lineNumber: z.number(),
  eanNo: z.string(),
  itemNumber: z.string().optional(),
  custItemNo: z.string().optional(),
  unitOfMeasureCode: z.string().optional(),
  quantity: z.number(),
  requestedShipmentDate: CanonicalDateSchema.optional(),
});

export type BcOrderPayloadLine = z.infer<typeof BcOrderPayloadLineSchema>;

export const BcOrderPayloadSchema = z.object({
  externalOrderNumber: z.string(),
  orderDate: CanonicalDateSchema,
  currencyCode: z.string(),
  requestedDeliveryDate: CanonicalDateSchema.optional(),
  email: z.string().optional(),
  phoneNumber: z.string().optional(),
  billTo: BcOrderPayloadAddressSchema.optional(),
  shipTo: BcOrderPayloadAddressSchema.optional(),
  lines: z.array(BcOrderPayloadLineSchema).min(1),
});

export type BcOrderPayload = z.infer<typeof BcOrderPayloadSchema>;

export type BcOrderPayloadParseResult =
  | { ok: true; payload: BcOrderPayload }
  | { ok: false; message: string };

/**
 * Reads the canonical order payload out of an untrusted `Order.metadata` value.
 *
 * Returns a result rather than throwing: a missing or malformed payload is a recordable submission
 * failure (status `failed`, Task 04), not an exception that would leave the state at `pending`.
 */
export function parseBcOrderPayload(
  metadata: Record<string, unknown> | null | undefined
): BcOrderPayloadParseResult {
  const raw = metadata?.[CANONICAL_ORDER_METADATA_KEY];

  if (raw === undefined || raw === null) {
    return {
      ok: false,
      message: `Order metadata has no '${CANONICAL_ORDER_METADATA_KEY}' payload`,
    };
  }

  const parsed = BcOrderPayloadSchema.safeParse(raw);

  if (!parsed.success) {
    return {
      ok: false,
      message: `Order metadata '${CANONICAL_ORDER_METADATA_KEY}' payload is not a usable canonical order`,
    };
  }

  return { ok: true, payload: parsed.data };
}

/**
 * Reads the matched company id out of an untrusted `Order.metadata` value.
 */
export function readCompanyIdFromMetadata(
  metadata: Record<string, unknown> | null | undefined
): string | null {
  const raw = metadata?.[COMPANY_ID_METADATA_KEY];

  return typeof raw === "string" && raw.length > 0 ? raw : null;
}

/**
 * Converts a canonical `DD-MM-YYYY` date (already validated by `CanonicalDateSchema`) into the
 * `YYYY-MM-DD` form Business Central's `Edm.Date` fields require.
 */
export function canonicalDateToBcDate(value: string): string {
  const [day, month, year] = value.split("-");

  return `${year}-${month}-${day}`;
}
```

## Impacted Files

| File | Change |
|---|---|
| `apps/backend/src/modules/order-ingestion/bc-integration-state.ts` | **Append** `export type BcSubmissionFailureReason`, `BC_INTEGRATION_STATUSES`, `BC_ORDER_LINE_FAILURE_REASONS`, `optionalString`, `parseLineFailure`, `export function parseBcIntegrationState(value: unknown): BcIntegrationState`, `export function hasBusinessCentralOrder(state: BcIntegrationState): boolean`. Nothing existing changes. |
| `apps/backend/src/modules/order-ingestion/__tests__/bc-integration-state.unit.spec.ts` | Extend the import line; **append** TC-2..TC-5. Existing TC-1 unchanged. |
| `apps/backend/src/modules/order-ingestion/bc-order-payload.ts` | **New** |
| `apps/backend/src/modules/order-ingestion/__tests__/bc-order-payload.unit.spec.ts` | **New** |

## Test Cases

### TC-1 (existing, unchanged): initial state is pending with a zero attempt count

### TC-2: the parser round-trips a well-formed state, line failures included
- **Given:** a fully populated `BcIntegrationState` object with one line failure
- **When:** `parseBcIntegrationState` is called with it
- **Then:** the result deep-equals the input

### TC-3: the parser falls back to pending for absent or garbage input (edge case)
- **Given:** `undefined`, `null`, a string, and `{ status: "exploded", attempt_count: -5, bc_order_id: 7 }`
- **When:** `parseBcIntegrationState` is called with each
- **Then:** each result has status `"pending"`, `attempt_count` `0`, `bc_order_id` `null`, empty
  `line_failures`; nothing throws

### TC-4: the parser drops malformed line failures and coerces unknown reasons (edge case)
- **Given:** `line_failures` with one valid entry, `null`, an entry without `line_number`, and an
  entry with an unknown `reason`
- **When:** `parseBcIntegrationState` is called
- **Then:** two entries survive; the unknown-reason one is coerced to `"not_found"`

### TC-5: the duplicate guard fires on either signal (wiring)
- **Given:** pending/no id, sent/with id, sent/no id, failed/with id
- **When:** `hasBusinessCentralOrder` is called on each
- **Then:** `false`, `true`, `true`, `true`

### TC-6: the payload reader accepts the real-EDI-derived fixture (happy path)
- **Given:** metadata `{ canonical_order: multiLineCanonicalOrder }` (dates `26-08-2026`)
- **When:** `parseBcOrderPayload` is called
- **Then:** `ok` is `true`; both lines keep `eanNo`, `itemNumber`, `quantity`; `orderDate` is
  `"26-08-2026"`; `currencyCode` is `"DKK"`

### TC-7: the reader strips unmodelled fields instead of rejecting them (non-strict on purpose)
- **Given:** the fixture plus header `pricesIncludeTax` and line `description2`, `taxPercent`
  (the fixture already carries `unitPrice` and `description`)
- **When:** `parseBcOrderPayload` is called
- **Then:** `ok` is `true` and the parsed line has no `unitPrice` and no `description` key

### TC-8: missing or unusable payloads are a result, not a throw (edge case)
- **Given:** `null` metadata; `{}`; `lines: []`; `canonical_order: "not-an-order"`; and an ISO
  `orderDate: "2026-08-26"` (not the canonical format)
- **When:** `parseBcOrderPayload` is called with each
- **Then:** every call returns `{ ok: false }` with a non-empty `message`

### TC-9: the company-id reader only accepts a non-empty string (edge case)
- **Given:** `"comp_01"`, `""`, `42`, no key, `null` metadata
- **When:** `readCompanyIdFromMetadata` is called
- **Then:** `"comp_01"` for the first, `null` for the rest

### TC-10: canonical dates convert to Business Central dates (happy path)
- **Given:** `"26-08-2026"` and `"29-02-2028"`
- **When:** `canonicalDateToBcDate` is called
- **Then:** `"2026-08-26"` and `"2028-02-29"`

### Modified File: `apps/backend/src/modules/order-ingestion/__tests__/bc-integration-state.unit.spec.ts`

Replace the first import line with the block below and append the three `describe` blocks after the
existing `describe("createInitialBcIntegrationState", ...)`:

```typescript
import {
  createInitialBcIntegrationState,
  hasBusinessCentralOrder,
  parseBcIntegrationState,
} from "../bc-integration-state";
import type { BcIntegrationState } from "../bc-integration-state";
```

```typescript
describe("parseBcIntegrationState", () => {
  it("TC-2: round-trips a well-formed state including line failures", () => {
    const state: BcIntegrationState = {
      status: "sent",
      bc_order_id: "11111111-1111-1111-1111-111111111111",
      bc_order_number: "SO-001234",
      attempt_count: 2,
      initialized_at: "2026-09-29T10:00:00.000Z",
      last_attempt_at: "2026-09-29T10:05:00.000Z",
      sent_at: "2026-09-29T10:05:00.000Z",
      partial: true,
      failure_reason: "partial_lines_submitted",
      line_failures: [
        {
          line_number: 2,
          ean_no: "5712094143635",
          item_number: "NKT-NIM-TELLURIDENA-M",
          cust_item_no: null,
          reason: "not_found",
          message: null,
        },
      ],
    };

    expect(parseBcIntegrationState(state)).toEqual(state);
  });

  it("TC-3: falls back to the pending state for absent or malformed input", () => {
    // IMPLEMENT: for each of undefined, null, "nope", and
    // { status: "exploded", attempt_count: -5, bc_order_id: 7 }, assert the parsed state has
    // status "pending", attempt_count 0, bc_order_id null, and line_failures [].
  });

  it("TC-4: keeps usable line failures and drops malformed ones", () => {
    const parsed = parseBcIntegrationState({
      status: "failed",
      line_failures: [
        {
          line_number: 1,
          ean_no: "5712094145752",
          item_number: "FLS-NIM-VESPERMNA-XL",
          cust_item_no: "FLS-NIM-VESPERMNA-XL",
          reason: "ambiguous",
          message: null,
        },
        null,
        { reason: "not_found" },
        { line_number: 3, reason: "who-knows" },
      ],
    });

    expect(parsed.status).toEqual("failed");
    expect(parsed.line_failures).toHaveLength(2);
    expect(parsed.line_failures[0].reason).toEqual("ambiguous");
    expect(parsed.line_failures[1]).toEqual({
      line_number: 3,
      ean_no: null,
      item_number: null,
      cust_item_no: null,
      reason: "not_found",
      message: null,
    });
  });
});

describe("hasBusinessCentralOrder", () => {
  it("TC-5: reports an existing BC order from either the id or a sent status", () => {
    const base = createInitialBcIntegrationState("2026-09-29T10:00:00.000Z");

    expect(hasBusinessCentralOrder(base)).toBe(false);
    expect(
      hasBusinessCentralOrder({ ...base, status: "sent", bc_order_id: "bc-1" })
    ).toBe(true);
    expect(hasBusinessCentralOrder({ ...base, status: "sent" })).toBe(true);
    expect(
      hasBusinessCentralOrder({ ...base, status: "failed", bc_order_id: "bc-1" })
    ).toBe(true);
  });
});
```

### New File: `apps/backend/src/modules/order-ingestion/__tests__/bc-order-payload.unit.spec.ts`

```typescript
import {
  canonicalDateToBcDate,
  parseBcOrderPayload,
  readCompanyIdFromMetadata,
} from "../bc-order-payload";
import { multiLineCanonicalOrder } from "../__fixtures__/canonical-order-fixtures";

describe("parseBcOrderPayload", () => {
  it("TC-6: reads the real-EDI-derived canonical order out of metadata", () => {
    const result = parseBcOrderPayload({ canonical_order: multiLineCanonicalOrder });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payload.externalOrderNumber).toEqual("NKT004061");
      expect(result.payload.orderDate).toEqual("26-08-2026");
      expect(result.payload.currencyCode).toEqual("DKK");
      expect(result.payload.lines).toHaveLength(2);
      expect(result.payload.lines[1].eanNo).toEqual("5712094143635");
      expect(result.payload.lines[1].itemNumber).toEqual("NKT-NIM-TELLURIDENA-M");
      expect(result.payload.lines[1].quantity).toEqual(10);
    }
  });

  it("TC-7: strips fields this story does not send instead of rejecting them", () => {
    const result = parseBcOrderPayload({
      canonical_order: {
        ...multiLineCanonicalOrder,
        pricesIncludeTax: false,
        lines: [
          {
            ...multiLineCanonicalOrder.lines[0],
            description2: "Embroidered",
            taxPercent: 25,
          },
        ],
      },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(Object.keys(result.payload.lines[0])).not.toContain("unitPrice");
      expect(Object.keys(result.payload.lines[0])).not.toContain("description");
    }
  });

  it("TC-8: reports missing or unusable payloads as a failed result rather than throwing", () => {
    expect(parseBcOrderPayload(null).ok).toBe(false);
    expect(parseBcOrderPayload({}).ok).toBe(false);
    expect(
      parseBcOrderPayload({
        canonical_order: { ...multiLineCanonicalOrder, lines: [] },
      }).ok
    ).toBe(false);
    expect(parseBcOrderPayload({ canonical_order: "not-an-order" }).ok).toBe(false);
    // IMPLEMENT: assert a payload whose orderDate is the ISO string "2026-08-26" returns
    // ok false, and that every failed result above carries a non-empty message.
  });
});

describe("readCompanyIdFromMetadata", () => {
  it("TC-9: only accepts a non-empty string company id", () => {
    expect(readCompanyIdFromMetadata({ company_id: "comp_01" })).toEqual("comp_01");
    expect(readCompanyIdFromMetadata({ company_id: "" })).toBeNull();
    expect(readCompanyIdFromMetadata({ company_id: 42 })).toBeNull();
    expect(readCompanyIdFromMetadata({})).toBeNull();
    expect(readCompanyIdFromMetadata(null)).toBeNull();
  });
});

describe("canonicalDateToBcDate", () => {
  it("TC-10: converts DD-MM-YYYY to YYYY-MM-DD", () => {
    expect(canonicalDateToBcDate("26-08-2026")).toEqual("2026-08-26");
    expect(canonicalDateToBcDate("29-02-2028")).toEqual("2028-02-29");
  });
});
```

## Implementation Steps

1. Append the block shown above to `apps/backend/src/modules/order-ingestion/bc-integration-state.ts`
   after `createInitialBcIntegrationState`. Do not touch any existing line.
2. Update the import in `__tests__/bc-integration-state.unit.spec.ts` and append TC-2..TC-5, filling
   in the TC-3 `// IMPLEMENT:` block.
3. Create `apps/backend/src/modules/order-ingestion/bc-order-payload.ts` exactly as shown.
4. Create `__tests__/bc-order-payload.unit.spec.ts` exactly as shown, filling in the TC-8
   `// IMPLEMENT:` block.
5. Run `cd apps/backend && pnpm test:unit` — all order-ingestion unit specs pass (existing
   `canonical-order-schema.unit.spec.ts` and `map-canonical-order-header.unit.spec.ts` included).
6. Run `cd apps/backend && pnpm test:integration:modules`. These spec files also match that glob;
   they touch no DB and must pass there too.
7. Run `pnpm build` from the repo root and fix any type errors.
