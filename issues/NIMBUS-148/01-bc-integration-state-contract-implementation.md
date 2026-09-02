# Task 01: BC Integration-State Metadata Contract + Defensive Payload Reader — Implementation Plan

**Status:** TODO
**App:** backend
**App Root:** apps/backend
**Task ID:** 01
**Date:** 2026-09-02
**Branch:** feature/NIMBUS-148-bc-order-submission (from develop)
**Depends on:** None

---

## Project Environment

- **App root:** `apps/backend`
- **Build command:** `pnpm build` (from repo root) or `cd apps/backend && pnpm build`
- **Lint command:** `pnpm lint` (from repo root)
- **Test command:** `cd apps/backend && pnpm test:unit`
- **Test framework:** Jest (`@swc/jest`, node environment, no DB needed for this task)
- **Test location:** `apps/backend/src/**/__tests__/**/*.unit.spec.ts`. **Naming is load-bearing** —
  the file MUST end in exactly `.unit.spec.ts` or `pnpm test:unit` will not pick it up.
- **Naming conventions:** kebab-case file names, named exports (no default exports for
  non-component modules), `type` aliases for unions, 2-space indent.
- **Quote style:** **double quotes**. Every file this story touches or sits next to
  (`src/modules/business-central/*.ts`, `src/workflows/business-central-return/**`) uses double
  quotes. Match that, not the single quotes used in the NIMBUS-129 task files.
- **zod import path:** `import { z } from "@medusajs/framework/zod";` — NOT the bare `zod`
  package, even though `zod` is a direct dependency. Every zod usage in this repo goes through
  the framework re-export. Installed zod version is **4.2.0**.

## Why this task exists (read this before writing code)

This task defines the **contract** that everything else in NIMBUS-148 reads and writes, and it is
the single most important task in this story to get right.

### The contract this story is supposed to consume does not exist yet

NIMBUS-148's SCOPE.md says this story "updates NIMBUS-149's BC integration-state metadata object".
**NIMBUS-149 is scoped but not planned and not implemented**, and its SCOPE.md explicitly leaves
"exact `metadata` key names and field types" as an open planner decision. There is therefore no
contract to consume. Rather than guessing at NIMBUS-149's future choice and hoping it matches,
**this task defines the contract explicitly, in one file, that NIMBUS-149 and NIMBUS-158 must
import and adopt.** See PLAN.md's risk section — this is the story's biggest risk.

### And the raw payload it reads is untyped `jsonb`

`Order.metadata` is a single free-form `jsonb` column typed as `Record<string, unknown>`. Reading
the canonical order's `lines` array out of it is a **trust boundary**: there is no compile-time
guarantee about what is actually in there. Per this repo's TypeScript style rules ("Validate input
at trust boundaries with a schema, not ad-hoc" and "Never use `any`"), the payload must be
runtime-validated on read. That is what `bc-order-payload.ts` below does.

A useful side effect: because NIMBUS-148 validates the metadata at runtime instead of importing
NIMBUS-129's `CanonicalOrder` type, **tasks 01–04 of this story compile and test with no dependency
on NIMBUS-129 or NIMBUS-149 being implemented at all.** Only Task 05 (the trigger subscriber) has a
hard dependency on NIMBUS-129. Do not "improve" this by importing
`src/modules/order-ingestion/canonical-order-schema.ts` — that would create a build-time dependency
on unbuilt code and remove the runtime safety.

### Where these files live, and why

`apps/backend/src/modules/order-ingestion/` — co-located with the canonical-order contract that
NIMBUS-129's Task 02 puts in that same directory (`canonical-order-schema.ts`). These are shared
order-ingestion metadata contracts read and written by three stories (149 initializes, 148 updates,
158 displays), so they belong with the ingestion contract rather than inside the
`business-central` module (which knows about BC, not about Medusa order metadata) or inside this
story's workflow folder (which would make 149 and 158 import from a workflow directory).

**If `apps/backend/src/modules/order-ingestion/` does not exist yet, create the directory.** A bare
directory there is harmless: Medusa v2 only loads modules that are explicitly registered in
`medusa-config.ts`, and neither of this task's files is a module definition. Do NOT create an
`index.ts`, a `service.ts`, or a `medusa-config.ts` entry — those are NIMBUS-129 Task 01's job.

### Jest pattern hazard — do NOT put fixtures under `src/modules/*/__tests__/`

`apps/backend/jest.config.js` uses `testMatch: ["**/src/modules/*/__tests__/**/*.[jt]s"]` when
`TEST_TYPE=integration:modules`. That pattern matches **every** `.ts` file in such a directory, not
just spec files — a non-spec helper/fixture file placed there is collected as a test suite and
fails with "Your test suite must contain at least one test." For this reason **every fixture in
NIMBUS-148 is declared inline inside its own spec file**; this story adds no shared fixture file.
Do not extract them. (This same hazard applies to NIMBUS-129 Task 02's planned
`canonical-order-fixtures.ts` — flagged in PLAN.md as an observation for that plan, not something
this story fixes.)

## Solution Design

Two new files, no changes to existing files.

1. **`bc-integration-state.ts`** — the BC integration-state metadata contract: the metadata key
   name, the state type, the status union, the per-line failure record type, a factory for the
   initial (pending) state that NIMBUS-149 will call, and a defensive parser that turns an unknown
   `metadata` value into a well-formed state object.
2. **`bc-order-payload.ts`** — the metadata key name for the raw canonical payload plus a
   **deliberately narrow, non-strict** zod schema covering only the fields NIMBUS-148 actually
   needs to build a BC sales order, and a parser returning a discriminated result.

### Design decisions made here (all were open questions in SCOPE.md)

| Decision | Value | Reasoning |
|---|---|---|
| Raw-payload metadata key | `canonical_order` | Already the key NIMBUS-129's Task 03 writes (`metadata: { company_id, canonical_order, order_ingestion_state, ... }`). Reusing it means NIMBUS-149 has nothing to change. |
| Integration-state metadata key | `business_central_integration` | Distinct top-level key, per NIMBUS-149's "never merged into one blob" requirement. |
| Retry counter field | `attempt_count` (number) | NIMBUS-149's scope calls it "a retry count", but NIMBUS-148's scope redefines the semantics as *total* attempts including the first automatic one — so the first successful send leaves it at `1`, not `0`. `attempt_count` names that honestly; `retry_count` would be actively misleading. **NIMBUS-149 must adopt this name.** |
| Order-level partial flag | `partial: boolean` | Scope requires an order-level flag that the submission was partial. |
| Per-line failure records | `line_failures: BcOrderLineFailure[]` | Scope requires which line failed and why. Keyed by `line_number` (the canonical `lineNumber`), carrying the three identifiers that were tried plus a machine-readable `reason` and an optional human `message`. |
| Status values | `"pending" \| "sent" \| "failed"` | `pending` is NIMBUS-149's initial value; this story only ever writes `sent` or `failed`. |
| Timestamps | `initialized_at`, `last_attempt_at`, `sent_at` | NIMBUS-149 sets `initialized_at`. This story sets `last_attempt_at` on every attempt and `sent_at` only on success. Three fields rather than one so NIMBUS-158 can show "first seen / last tried / delivered" without ambiguity. |

### Security note (SCOPE.md non-functional requirement)

Nothing in either type carries a token, credential, or secret. `line_failures[].message` holds a
BC-supplied or lookup-supplied reason string only. Do **not** widen it to hold raw HTTP response
bodies or request headers.

## Code Skeletons

### New File: `apps/backend/src/modules/order-ingestion/bc-integration-state.ts`

```typescript
/**
 * Business Central integration-state contract stored on `Order.metadata`.
 *
 * Ownership note (NIMBUS-148): NIMBUS-149 initializes this object to its pending state when it
 * persists the Medusa order; NIMBUS-148 updates it with the delivery outcome; NIMBUS-158 reads it
 * for the Medusa Admin status/retry widget. This file is the single source of truth for its shape —
 * all three stories import from here rather than restating field names.
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
 * state object. Anything missing or malformed falls back to the initial pending state, so a
 * partially-written or absent state can never crash the submission path — an absent state simply
 * means "never attempted", which is exactly how this story treats it.
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
 * The duplicate-submission guard (NIMBUS-148 SCOPE.md). True once a real Business Central sales
 * order exists for this Medusa order — either because the last attempt reported `sent`, or because
 * a BC order id was recorded at all (which can also happen on a `failed` outcome where the BC
 * header was created but every line was rejected; see Task 03).
 */
export function hasBusinessCentralOrder(state: BcIntegrationState): boolean {
  return state.bc_order_id !== null || state.status === "sent";
}
```

### New File: `apps/backend/src/modules/order-ingestion/bc-order-payload.ts`

```typescript
import { z } from "@medusajs/framework/zod";

/**
 * The `Order.metadata` key holding the complete, verbatim canonical order JSON that NIMBUS-149
 * persists (and that NIMBUS-129's Task 03 already writes under this same name). This is the
 * source of truth for order-line detail: no `OrderLineItem` records exist for these orders,
 * because Medusa has no product catalog behind these items.
 */
export const CANONICAL_ORDER_METADATA_KEY = "canonical_order";

/**
 * The `Order.metadata` key holding the id of the matched Medusa company (written by NIMBUS-129's
 * Task 03 / NIMBUS-149, and already the convention used by
 * `apps/backend/src/workflows/hooks/order-created.ts`).
 */
export const COMPANY_ID_METADATA_KEY = "company_id";

/**
 * Deliberately NARROW and NON-STRICT view of the canonical order (NIMBUS-147's contract): only
 * the fields NIMBUS-148 needs in order to build a Business Central sales order.
 *
 * Non-strict on purpose — plain `z.object` in zod 4 strips unknown keys instead of rejecting them,
 * so a canonical payload carrying fields this story does not care about (or fields added later)
 * still parses. Do NOT add `.strict()`: validating the full canonical contract is NIMBUS-147's
 * job, not this story's, and re-asserting it here would make NIMBUS-148 break every time
 * NIMBUS-147's schema grows a field.
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
  itemNumber: z.string().optional(),
  custItemNo: z.string().optional(),
  eanNo: z.string().optional(),
  description: z.string().optional(),
  unitOfMeasureCode: z.string().optional(),
  quantity: z.number(),
  unitPrice: z.number().optional(),
  discountPercent: z.number().optional(),
  discountAmount: z.number().optional(),
  taxCode: z.string().optional(),
});

export type BcOrderPayloadLine = z.infer<typeof BcOrderPayloadLineSchema>;

export const BcOrderPayloadSchema = z.object({
  externalOrderNumber: z.string(),
  orderDate: z.string().optional(),
  requestedDeliveryDate: z.string().optional(),
  currencyCode: z.string().optional(),
  salesperson: z.string().optional(),
  email: z.string().optional(),
  phoneNumber: z.string().optional(),
  discountAmount: z.number().optional(),
  discountAppliedBeforeTax: z.boolean().optional(),
  pricesIncludeTax: z.boolean().optional(),
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
 * Returns a result rather than throwing: a missing or malformed payload is a recordable
 * *submission failure* for this order (status `failed`, see Task 04), not an exception that
 * should abort the workflow and leave the integration state stuck at `pending`.
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
```

## Impacted Files

None modified. This task only adds two new files (and, if absent, the
`apps/backend/src/modules/order-ingestion/` directory).

## Test Cases

### TC-1: initial state is pending with a zero attempt count
- **Given:** a timestamp string
- **When:** `createInitialBcIntegrationState(timestamp)` is called
- **Then:** status is `"pending"`, `bc_order_id` and `bc_order_number` are `null`,
  `attempt_count` is `0`, `initialized_at` is the timestamp, `partial` is `false`, and
  `line_failures` is empty

### TC-2: the parser round-trips a well-formed state, line failures included
- **Given:** a fully-populated `BcIntegrationState`-shaped plain object with one line failure
- **When:** `parseBcIntegrationState` is called with it
- **Then:** the result deep-equals the input

### TC-3: the parser falls back to pending for absent/garbage input (edge case)
- **Given:** `undefined`, `null`, a string, and an object with an unrecognized `status` and a
  negative `attempt_count`
- **When:** `parseBcIntegrationState` is called with each
- **Then:** every result has status `"pending"`, `attempt_count` `0`, `bc_order_id` `null`, and an
  empty `line_failures` array — no throw

### TC-4: the parser drops malformed line-failure entries but keeps good ones (edge case)
- **Given:** a state whose `line_failures` contains one valid entry, one `null`, one object with no
  `line_number`, and one object with an unrecognized `reason`
- **When:** `parseBcIntegrationState` is called
- **Then:** two entries survive — the valid one unchanged, and the unrecognized-`reason` one
  coerced to `"not_found"`

### TC-5: the duplicate-submission guard fires on either signal (wiring)
- **Given:** four states — pending/no id, `sent`/with id, `sent`/no id, `failed`/with id
- **When:** `hasBusinessCentralOrder` is called on each
- **Then:** `false` for the first and `true` for the other three

### TC-6: the payload reader accepts a real-EDI-derived canonical order (happy path)
- **Given:** metadata containing a `canonical_order` value derived from
  `issues/NIMBUS-129/example edi files/order2.xml` (two lines, a `shipTo`, `eanNo` on every line)
- **When:** `parseBcOrderPayload` is called
- **Then:** `ok` is `true` and both lines' `eanNo`, `itemNumber`, `quantity`, and `unitPrice`
  survive

### TC-7: the payload reader tolerates unknown canonical fields (non-strict on purpose)
- **Given:** the same payload plus extra header and line fields this story does not model
  (`taxPercent`, `description2`, `requestedShipmentDate`, `discountAppliedBeforeTax` on a line)
- **When:** `parseBcOrderPayload` is called
- **Then:** `ok` is `true` — the unknown fields are stripped, not rejected

### TC-8: the payload reader reports missing/unusable payloads as a result, not a throw (edge case)
- **Given:** metadata that is `null`; metadata with no `canonical_order` key; metadata whose
  `canonical_order` has an empty `lines` array; metadata whose `canonical_order` is a string
- **When:** `parseBcOrderPayload` is called with each
- **Then:** every call returns `{ ok: false }` with a non-empty `message` and does not throw

### TC-9: the company-id reader is strict about usable values (edge case)
- **Given:** metadata with `company_id: "comp_01"`; with `company_id: ""`; with `company_id: 42`;
  with no `company_id`; and `null` metadata
- **When:** `readCompanyIdFromMetadata` is called with each
- **Then:** `"comp_01"` for the first, `null` for the rest

### New File: `apps/backend/src/modules/order-ingestion/__tests__/bc-integration-state.unit.spec.ts`

```typescript
import {
  createInitialBcIntegrationState,
  hasBusinessCentralOrder,
  parseBcIntegrationState,
} from "../bc-integration-state";
import type { BcIntegrationState } from "../bc-integration-state";

describe("createInitialBcIntegrationState", () => {
  it("TC-1: starts pending with a zero attempt count and no BC order", () => {
    const state = createInitialBcIntegrationState("2026-09-02T10:00:00.000Z");

    expect(state).toEqual({
      status: "pending",
      bc_order_id: null,
      bc_order_number: null,
      attempt_count: 0,
      initialized_at: "2026-09-02T10:00:00.000Z",
      last_attempt_at: null,
      sent_at: null,
      partial: false,
      failure_reason: null,
      line_failures: [],
    });
  });
});

describe("parseBcIntegrationState", () => {
  it("TC-2: round-trips a well-formed state including line failures", () => {
    const state: BcIntegrationState = {
      status: "sent",
      bc_order_id: "11111111-1111-1111-1111-111111111111",
      bc_order_number: "SO-001234",
      attempt_count: 2,
      initialized_at: "2026-09-02T10:00:00.000Z",
      last_attempt_at: "2026-09-02T10:05:00.000Z",
      sent_at: "2026-09-02T10:05:00.000Z",
      partial: true,
      failure_reason: null,
      line_failures: [
        {
          line_number: 2,
          ean_no: "5712094143635",
          item_number: "NKT-NIM-TELLURIDENA-M",
          cust_item_no: null,
          reason: "not_found",
          message: "No Business Central item matched",
        },
      ],
    };

    expect(parseBcIntegrationState(state)).toEqual(state);
  });

  it("TC-3: falls back to the pending state for absent or malformed input", () => {
    // IMPLEMENT: assert each of undefined, null, "nope", and
    // { status: "exploded", attempt_count: -5, bc_order_id: 7 } parses to a state whose
    // status is "pending", attempt_count is 0, bc_order_id is null, and line_failures is [].
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
          message: "2 items matched",
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
    const base = createInitialBcIntegrationState("2026-09-02T10:00:00.000Z");

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
  parseBcOrderPayload,
  readCompanyIdFromMetadata,
} from "../bc-order-payload";

// Inline fixture derived from `issues/NIMBUS-129/example edi files/order2.xml`.
// Declared inline on purpose — see this task's "Jest pattern hazard" note: a shared fixture file
// under src/modules/*/__tests__/ would be collected as an empty test suite and fail.
const canonicalOrder = {
  externalOrderNumber: "NKT004061",
  orderDate: "2026-08-26",
  currencyCode: "DKK",
  shipTo: {
    name: "JK Tryk",
    contact: "3. Parts Nimbus",
    addressLine1: "Industrikrogen 11B",
    city: "Rønnede",
    postCode: "4683",
    country: "DK",
  },
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

describe("parseBcOrderPayload", () => {
  it("TC-6: reads a real-EDI-derived canonical order out of metadata", () => {
    const result = parseBcOrderPayload({ canonical_order: canonicalOrder });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payload.externalOrderNumber).toEqual("NKT004061");
      expect(result.payload.lines).toHaveLength(2);
      expect(result.payload.lines[1].eanNo).toEqual("5712094143635");
      expect(result.payload.lines[1].quantity).toEqual(10);
      expect(result.payload.lines[1].unitPrice).toEqual(209.25);
    }
  });

  it("TC-7: tolerates canonical fields this story does not model", () => {
    // IMPLEMENT: spread `canonicalOrder`, add an unmodelled header field (e.g.
    // discountAppliedBeforeTax: false) and unmodelled line fields (description2,
    // requestedShipmentDate, taxPercent) onto line 1, and assert result.ok is true.
  });

  it("TC-8: reports missing or unusable payloads as a failed result rather than throwing", () => {
    expect(parseBcOrderPayload(null).ok).toBe(false);
    expect(parseBcOrderPayload({}).ok).toBe(false);
    expect(
      parseBcOrderPayload({ canonical_order: { ...canonicalOrder, lines: [] } }).ok
    ).toBe(false);
    expect(parseBcOrderPayload({ canonical_order: "not-an-order" }).ok).toBe(false);
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
```

## Implementation Steps

1. Create the directory `apps/backend/src/modules/order-ingestion/` if it does not already exist.
   Do not add an `index.ts`, a `service.ts`, a model, or a `medusa-config.ts` entry.
2. Create `apps/backend/src/modules/order-ingestion/bc-integration-state.ts` exactly as shown.
3. Create `apps/backend/src/modules/order-ingestion/bc-order-payload.ts` exactly as shown.
4. Create `apps/backend/src/modules/order-ingestion/__tests__/bc-integration-state.unit.spec.ts`
   exactly as shown, filling in the one `// IMPLEMENT:` block (TC-3).
5. Create `apps/backend/src/modules/order-ingestion/__tests__/bc-order-payload.unit.spec.ts`
   exactly as shown, filling in the one `// IMPLEMENT:` block (TC-7).
6. Run `cd apps/backend && pnpm test:unit` and confirm all nine test cases pass.
7. Run `cd apps/backend && pnpm test:integration:modules`. These two spec files also match that
   pattern (`**/src/modules/*/__tests__/**/*.[jt]s`) — that is expected and harmless, since
   neither test touches a database. Confirm they still pass there and that no non-spec file in
   `src/modules/order-ingestion/__tests__/` was collected.
8. Run `pnpm build` from the repo root and fix any type errors before marking this task done.
