# Task 02: Canonical Order Contract (zod schema) — Implementation Plan

**Status:** TODO
**App:** backend
**App Root:** apps/backend
**Task ID:** 02
**Date:** 2026-09-02
**Branch:** feature/NIMBUS-129-order-ingestion (from develop)
**Depends on:** None

---

## Project Environment

- **App root:** `apps/backend`
- **Build command:** `pnpm build` (from repo root) or `cd apps/backend && pnpm build`
- **Lint command:** `pnpm lint` (from repo root)
- **Test command:** `cd apps/backend && pnpm test:unit`
- **Test framework:** Jest (`@swc/jest`, node environment)
- **Test location:** `apps/backend/src/**/__tests__/**/*.unit.spec.ts` (matched by
  `**/src/**/__tests__/**/*.unit.spec.[jt]s`). **Naming is load-bearing**: the file MUST end in
  exactly `.unit.spec.ts` or jest will not pick it up under `pnpm test:unit`.
- **Naming conventions:** 2-space indent, single quotes, `type` for unions/inferred types,
  `@medusajs/framework/zod` import path (NOT the bare `zod` package, even though `zod` is a
  direct dependency — every zod usage in this repo imports from the framework re-export).

## Context — this task was simplified during a redesign; read before implementing

**Earlier revision of this plan defined two schemas** (`OrderEnvelopeSchema`, loose, and
`CanonicalOrderSchema`, strict) because canonical validation was going to run **asynchronously**,
after a synchronous "structural/envelope" check had already responded to the caller. **That
two-depth split no longer exists.** Canonical validation, company matching, the duplicate check,
and real Medusa order creation are now all **synchronous**, inside one request (see Task 03) —
there is nothing left to defer, so there is no reason to validate the same payload twice at two
different strictness levels. **This task now defines exactly one schema**, `CanonicalOrderSchema`,
used directly as the `validateAndTransformBody` schema on the route (Task 05) — if it fails, the
framework's own validation-error handling returns `400` before the route handler (and therefore
before Task 03's workflow) ever runs.

**Resolved field list and required/optional flags** (this was an explicit open question in
NIMBUS-147's SCOPE.md — resolved here, informed by the two real EDI sample files in
`issues/NIMBUS-129/example edi files/order1.xml` and `order2.xml`, both of which populate every
field below except `billTo`, `custItemNo`, and `unitOfMeasureCode`):

**Order header** — required: `externalOrderNumber`, `orderDate`, `currencyCode`, `lines`.
Optional: `requestedDeliveryDate`, `salesperson`, `email`, `phoneNumber`, `discountAmount`,
`discountAppliedBeforeTax`, `pricesIncludeTax`, `billTo`, `shipTo`.

**Address** (`billTo`/`shipTo`, shared shape — the real scope text gives `shipTo` an extra
`contact` field that `billTo` doesn't have; this schema gives both an optional `contact` field
rather than defining two near-identical schemas — `billTo` payloads simply never populate it):
required when the address object itself is present: `name`, `addressLine1`, `city`, `postCode`,
`country`. Optional: `contact`, `addressLine2`, `state`.

**Order line** — required: `lineNumber`, `itemNumber`, `eanNo`, `description`, `quantity`,
`unitPrice`. Optional: `custItemNo`, `description2`, `unitOfMeasureCode`, `discountPercent`,
`discountAmount`, `discountAppliedBeforeTax`, `taxCode`, `taxPercent`, `requestedShipmentDate`.

**Assumption carried from NIMBUS-147's SCOPE.md "Findings from Real EDI Samples"**: by the time a
payload reaches this schema, `unitPrice` (and any other numeric field) is already a JSON number,
not a comma-decimal string like `"209,25"` — that normalization is explicitly NIMBUS-145's
concern (the APIM XML→JSON transform), not this contract's. `quantity` and `unitPrice` are
therefore typed as `z.number()`, not `z.string()`.

## Code Skeletons

### New File: `apps/backend/src/modules/order-ingestion/canonical-order-schema.ts`

```typescript
import { z } from '@medusajs/framework/zod';

export const CanonicalOrderAddressSchema = z
  .object({
    name: z.string().min(1),
    contact: z.string().optional(),
    addressLine1: z.string().min(1),
    addressLine2: z.string().optional(),
    city: z.string().min(1),
    state: z.string().optional(),
    postCode: z.string().min(1),
    country: z.string().min(1),
  })
  .strict();

export type CanonicalOrderAddress = z.infer<typeof CanonicalOrderAddressSchema>;

export const CanonicalOrderLineSchema = z
  .object({
    lineNumber: z.number().int().nonnegative(),
    itemNumber: z.string().min(1),
    custItemNo: z.string().optional(),
    eanNo: z.string().min(1),
    description: z.string().min(1),
    description2: z.string().optional(),
    unitOfMeasureCode: z.string().optional(),
    quantity: z.number().positive(),
    unitPrice: z.number().nonnegative(),
    discountPercent: z.number().min(0).max(100).optional(),
    discountAmount: z.number().optional(),
    discountAppliedBeforeTax: z.boolean().optional(),
    taxCode: z.string().optional(),
    taxPercent: z.number().min(0).optional(),
    requestedShipmentDate: z.string().optional(),
  })
  .strict();

export type CanonicalOrderLine = z.infer<typeof CanonicalOrderLineSchema>;

export const CanonicalOrderSchema = z
  .object({
    externalOrderNumber: z.string().min(1),
    orderDate: z.string().min(1),
    requestedDeliveryDate: z.string().optional(),
    currencyCode: z.string().min(1),
    salesperson: z.string().optional(),
    email: z.string().email().optional(),
    phoneNumber: z.string().optional(),
    discountAmount: z.number().optional(),
    discountAppliedBeforeTax: z.boolean().optional(),
    pricesIncludeTax: z.boolean().optional(),
    billTo: CanonicalOrderAddressSchema.optional(),
    shipTo: CanonicalOrderAddressSchema.optional(),
    lines: z.array(CanonicalOrderLineSchema).min(1),
  })
  .strict();

export type CanonicalOrder = z.infer<typeof CanonicalOrderSchema>;
```

(This file's content is unchanged from the pre-redesign plan except that `OrderEnvelopeSchema`,
which used to live in Task 05's `validators.ts`, no longer exists anywhere in this project — Task
05 now imports `CanonicalOrderSchema` from this file directly for body validation.)

### New File: `apps/backend/src/modules/order-ingestion/__tests__/canonical-order-fixtures.ts`

Shared realistic fixtures derived from the two real EDI sample files, converted to canonical JSON
shape. **Tasks 03, 04, and 05 all import this file** for their test cases — do not rename the
exported constants without updating those tasks' test files to match.

```typescript
import type { CanonicalOrder } from '../canonical-order-schema';

// Derived from issues/NIMBUS-129/example edi files/order1.xml
export const singleLineCanonicalOrder: CanonicalOrder = {
  externalOrderNumber: 'FLS190518',
  orderDate: '2026-08-27',
  currencyCode: 'DKK',
  lines: [
    {
      lineNumber: 1,
      itemNumber: 'FLS-NIM-VESPERMNA-XL',
      custItemNo: 'FLS-NIM-VESPERMNA-XL',
      eanNo: '5712094145752',
      description: 'Vesper Vest Unisex, Navy - XL',
      quantity: 1,
      unitPrice: 134.75,
    },
  ],
};

// Derived from issues/NIMBUS-129/example edi files/order2.xml
export const multiLineCanonicalOrder: CanonicalOrder = {
  externalOrderNumber: 'NKT004061',
  orderDate: '2026-08-26',
  currencyCode: 'DKK',
  shipTo: {
    name: 'JK Tryk',
    contact: '3. Parts Nimbus',
    addressLine1: 'Industrikrogen 11B',
    city: 'Rønnede',
    postCode: '4683',
    country: 'DK',
  },
  lines: [
    {
      lineNumber: 1,
      itemNumber: 'NKT-NIM-TELLURIDENA-S',
      custItemNo: 'NKT-NIM-TELLURIDENA-S',
      eanNo: '5712094143628',
      description: 'Telluride Jacket, Unisex, Navy - S',
      quantity: 1,
      unitPrice: 209.25,
    },
    {
      lineNumber: 2,
      itemNumber: 'NKT-NIM-TELLURIDENA-M',
      custItemNo: 'NKT-NIM-TELLURIDENA-M',
      eanNo: '5712094143635',
      description: 'Telluride Jacket, Unisex, Navy - M',
      quantity: 10,
      unitPrice: 209.25,
    },
  ],
};

// The sender EAN endpoint id from both sample files' <SenderEndpointID qualifier="EAN">.
export const sampleCustomerNumber = '579000283084';
```

## Impacted Files

None modified — this task only adds new files.

## Test Cases

### New File: `apps/backend/src/modules/order-ingestion/__tests__/canonical-order-schema.unit.spec.ts`

```typescript
import { CanonicalOrderSchema } from '../canonical-order-schema';
import { singleLineCanonicalOrder, multiLineCanonicalOrder } from './canonical-order-fixtures';

describe('CanonicalOrderSchema', () => {
  it('TC-1: accepts a valid single-line order derived from a real EDI sample (happy path)', () => {
    const result = CanonicalOrderSchema.safeParse(singleLineCanonicalOrder);
    expect(result.success).toBe(true);
  });

  it('TC-2: accepts a valid multi-line order with an optional shipTo address', () => {
    const result = CanonicalOrderSchema.safeParse(multiLineCanonicalOrder);
    expect(result.success).toBe(true);
  });

  it('TC-3: rejects a payload missing externalOrderNumber (edge case: required header field)', () => {
    const { externalOrderNumber, ...withoutExternalOrderNumber } = singleLineCanonicalOrder;
    const result = CanonicalOrderSchema.safeParse(withoutExternalOrderNumber);
    expect(result.success).toBe(false);
  });

  it('TC-4: rejects a payload with an empty lines array (NIMBUS-147 "at least one order line" rule)', () => {
    const result = CanonicalOrderSchema.safeParse({
      ...singleLineCanonicalOrder,
      lines: [],
    });
    expect(result.success).toBe(false);
  });

  it('TC-5: accepts a payload that omits billTo and shipTo entirely (both optional per NIMBUS-147)', () => {
    const result = CanonicalOrderSchema.safeParse(singleLineCanonicalOrder);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.billTo).toBeUndefined();
      expect(result.data.shipTo).toBeUndefined();
    }
  });

  it('TC-6: rejects an unknown top-level field (schema is .strict() — there is no looser "envelope" tier anymore)', () => {
    const result = CanonicalOrderSchema.safeParse({
      ...singleLineCanonicalOrder,
      unexpectedField: 'should not be accepted',
    });
    expect(result.success).toBe(false);
  });
});
```

Run with: `cd apps/backend && pnpm test:unit`.

## Implementation Steps

1. Create `apps/backend/src/modules/order-ingestion/canonical-order-schema.ts` exactly as shown
   above. (If Task 01 has not yet been implemented, create the
   `apps/backend/src/modules/order-ingestion/` directory yourself — this task does not depend on
   Task 01's files existing. If an earlier revision of this plan already created this exact file,
   no change is needed — its content is unchanged by this redesign.)
2. Create `apps/backend/src/modules/order-ingestion/__tests__/canonical-order-fixtures.ts` exactly
   as shown above.
3. Create `apps/backend/src/modules/order-ingestion/__tests__/canonical-order-schema.unit.spec.ts`
   exactly as shown above (note: TC-6 is new in this revision — add it even if the file already
   exists from an earlier pass).
4. If a file named `apps/backend/src/api/orderapi/orders/validators.ts` already exists containing
   an `OrderEnvelopeSchema` from an earlier revision of this plan, that schema is superseded —
   Task 05's rewrite replaces that file's content entirely (see Task 05's doc); do not maintain
   both schemas.
5. Run `cd apps/backend && pnpm test:unit` and confirm all six test cases pass.
6. Run `pnpm build` from the repo root and fix any type errors before marking this task done.
