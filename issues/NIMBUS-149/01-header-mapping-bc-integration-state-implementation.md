# Task 01: Header Field Mapping + BC Integration-State Metadata

**Status:** TODO
**App:** backend
**App Root:** apps/backend
**Task ID:** 01
**Date:** 2026-09-02
**Branch:** feature/NIMBUS-149 (from develop)
**Depends on:** NIMBUS-129 Task 03 (order-creation workflow)

---

## Project Environment

- **App root:** `apps/backend`
- **Build command:** `pnpm build` (from repo root) or `cd apps/backend && pnpm build`
- **Lint command:** `pnpm lint` (from repo root)
- **Test command:** `cd apps/backend && pnpm test:integration:http`
- **Test framework:** Jest, `medusaIntegrationTestRunner` from `@medusajs/test-utils`
- **Test location:** `apps/backend/integration-tests/http/**/*.spec.ts`

## Context

NIMBUS-129 Task 03's `createOrderAndReferenceStep` creates a header-only order with a minimal
`createOrders` call:

```typescript
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
```

This task enriches that call with:

1. **Address mapping** — `canonicalOrder.shipTo` and `canonicalOrder.billTo` mapped to inline
   `CreateOrderAddressDTO` objects.
2. **Phone mapping** — `canonicalOrder.phoneNumber` mapped to `shipping_address.phone`.
3. **BC integration-state metadata** — a `bc_integration_state` key in `metadata`.

### Field mapping table (canonical → Medusa Order)

| Canonical field | Medusa Order path | Mapping |
|-----------------|-------------------|---------|
| `currencyCode` | `currency_code` | Direct (already done by Task 03) |
| `email` | `email` | Direct (already done by Task 03) |
| `phoneNumber` | `shipping_address.phone` | If `shipTo` present, set on shipping address |
| `shipTo.name` | `shipping_address.first_name` | Full name in `first_name`, `last_name` empty |
| `shipTo.contact` | (not mapped) | No corresponding field on `OrderAddress` |
| `shipTo.addressLine1` | `shipping_address.address_1` | Direct |
| `shipTo.addressLine2` | `shipping_address.address_2` | Direct |
| `shipTo.city` | `shipping_address.city` | Direct |
| `shipTo.state` | `shipping_address.province` | Direct |
| `shipTo.postCode` | `shipping_address.postal_code` | Direct |
| `shipTo.country` | `shipping_address.country_code` | Lowercase |
| `billTo.name` | `billing_address.first_name` | Full name in `first_name`, `last_name` empty |
| `billTo.addressLine1` | `billing_address.address_1` | Direct |
| `billTo.addressLine2` | `billing_address.address_2` | Direct |
| `billTo.city` | `billing_address.city` | Direct |
| `billTo.state` | `billing_address.province` | Direct |
| `billTo.postCode` | `billing_address.postal_code` | Direct |
| `billTo.country` | `billing_address.country_code` | Lowercase |

Fields not listed here (e.g. `salesperson`, `discountAmount`, `requestedDeliveryDate`) have no
corresponding Medusa Order column and are already preserved verbatim in the `canonical_order`
metadata key — no additional mapping needed.

### BC integration-state object

```typescript
const bcIntegrationState = {
  bc_order_id: null,
  status: 'pending',
  timestamp: new Date().toISOString(),
  retry_count: 0,
};
```

Stored under `metadata.bc_integration_state` — a separate key from `canonical_order`,
`order_ingestion_state`, and `company_id`.

## Solution Design

### Modified File: `apps/backend/src/workflows/order-ingestion/steps/create-order-and-reference.ts`

The existing `createOrderAndReferenceStep` (from NIMBUS-129 Task 03) is modified to enrich the
`createOrders` call. The step's input type, output type, and compensation function do not
change — only the `createOrders` arguments are enriched.

```typescript
// ...existing code from NIMBUS-129 Task 03...

// Helper: map canonical address to CreateOrderAddressDTO
const mapAddress = (address: CanonicalOrderAddress | undefined) => {
  if (!address) {
    return undefined;
  }
  return {
    first_name: address.name,
    last_name: undefined,
    address_1: address.addressLine1,
    address_2: address.addressLine2,
    city: address.city,
    province: address.state,
    postal_code: address.postCode,
    country_code: address.country?.toLowerCase(),
  };
};

// Inside createOrderAndReferenceStep's async body:
const shippingAddress = mapAddress(input.canonicalOrder.shipTo);
const billingAddress = mapAddress(input.canonicalOrder.billTo);

// Add phone to shipping address if present
if (shippingAddress && input.canonicalOrder.phoneNumber) {
  shippingAddress.phone = input.canonicalOrder.phoneNumber;
}

const bcIntegrationState = {
  bc_order_id: null,
  status: 'pending' as const,
  timestamp: new Date().toISOString(),
  retry_count: 0,
};

const order = await orderModuleService.createOrders({
  currency_code: input.canonicalOrder.currencyCode,
  email: input.canonicalOrder.email,
  shipping_address: shippingAddress,
  billing_address: billingAddress,
  metadata: {
    company_id: input.companyId,
    canonical_order: input.canonicalOrder,
    order_ingestion_state: 'created',
    order_ingestion_state_updated_at: new Date().toISOString(),
    bc_integration_state: bcIntegrationState,
  },
});

// ...existing code: remote link, external reference, StepResponse, compensation...
```

**Note:** The `mapAddress` helper and `bcIntegrationState` object are defined inside the step's
async body (or as module-level helpers in the same file), not as separate exports — they are
internal to this step and not consumed elsewhere.

### Type import

The step file needs to import `CanonicalOrderAddress` from the canonical-order schema:

```typescript
import type { CanonicalOrder, CanonicalOrderAddress } from '../../../modules/order-ingestion/canonical-order-schema';
```

If `CanonicalOrderAddress` is not already exported, add it to
`canonical-order-schema.ts` (it is exported in NIMBUS-129 Task 02's plan).

## Impacted Files

- **Modified:** `apps/backend/src/workflows/order-ingestion/steps/create-order-and-reference.ts`
  — enrich the `createOrders` call with address mapping and BC integration-state metadata.

No other files are modified. The workflow composition
(`create-order-from-canonical-payload.ts`), the matching step
(`match-company-and-check-duplicate.ts`), and the route (Task 05) are unchanged — the workflow's
input/output contract is not affected.

## Open Items

- **Reconcile with NIMBUS-129 Task 03's implementation status** — if Task 03 has already been
  implemented, modify the existing file. If not, add these requirements to Task 03's task file or
  implement them together.
- **Verify `country` field format** — confirm real submissions use ISO 3166-1 alpha-2 codes.
- **Verify `last_name` handling** — confirm the admin UI displays `first_name` alone correctly.
- **Verify `phoneNumber` placement** — confirm `shipping_address.phone` is the right location.
- **Verify `CreateOrderAddressDTO` accepts `last_name: undefined`** — if the type requires
  `string | null` rather than `undefined`, use `null` instead.
