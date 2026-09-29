# Task 03: Canonical Header Field Mapping onto Native Order Columns — Implementation Plan

**Status:** DONE (2026-09-29)
**App:** backend
**App Root:** apps/backend
**Task ID:** 03
**Date:** 2026-09-29
**Branch:** feature/NIMBUS-149 (from develop)
**Depends on:** Task 02 (modifies the same `createOrders` call in `create-ingested-order.ts`)

---

## Project Environment

- **App root:** `apps/backend`
- **Build command:** `pnpm build` (from repo root)
- **Lint command:** `pnpm lint` (from repo root)
- **Test commands:** `cd apps/backend && pnpm test:unit` (mapper) and
  `cd apps/backend && pnpm test:integration:http` (workflow)
- **Test locations:** `apps/backend/src/workflows/order-ingestion/__tests__/*.unit.spec.ts` (new
  directory; matches the unit glob `**/src/**/__tests__/**/*.unit.spec.[jt]s` and is outside the
  `src/modules/*/__tests__` module-integration glob) and
  `apps/backend/integration-tests/http/order-ingestion/create-order-workflow.spec.ts`
- **Conventions:** double quotes, 2-space indent, named exports, explicit return type on the
  exported function.

## Why this task exists

The scope requires mapping canonical header fields onto native Medusa Order columns where they
reasonably fit. Today only `currency_code` and `email` are mapped. The canonical `shipTo`/`billTo`
addresses and `phoneNumber` exist only inside `metadata.canonical_order`, so the order shows no
addresses in Medusa Admin.

Mapping happens **synchronously, inline in `createOrders`** (inline `shipping_address` /
`billing_address` objects are accepted by `CreateOrderDTO` and created atomically with the order;
`deleteOrders` removes them again on compensation). The alternative — a later update inside
`enrichOrderWorkflow`, whose placeholder comment names this as a candidate — was rejected: it
would leave a window where the order exists without addresses and adds a second write for no
benefit. The placeholder comment in `enrich-order.ts` is updated so it no longer points at work
that is now done.

## Verified types (from `@medusajs/types` 2.21, re-exported by `@medusajs/framework/types`)

```typescript
// CreateOrderDTO (subset)
currency_code?: string;
email?: string;
shipping_address?: CreateOrderAddressDTO | UpdateOrderAddressDTO;
billing_address?: CreateOrderAddressDTO | UpdateOrderAddressDTO;

// CreateOrderAddressDTO extends UpsertOrderAddressDTO
customer_id?: string;
company?: string | null;
first_name?: string | null;
last_name?: string | null;
address_1?: string | null;
address_2?: string | null;
city?: string | null;
country_code?: string | null;
province?: string | null;
postal_code?: string | null;
phone?: string | null;
metadata?: Record<string, unknown> | null;
```

`order_address.country_code` is plain nullable text (no FK to the region/country tables), so an
unexpected country value cannot make order creation fail — it is stored as given (lowercased).

Canonical address (`CanonicalOrderAddress` in `canonical-order-schema.ts`): `name` (required),
`contact?`, `addressLine1` (required), `addressLine2?`, `city` (required), `state?`, `postCode`
(required), `country` (required, free string; the EDI samples use `"DK"`).

## Field mapping (decided)

| Canonical | Order column | Rule |
|---|---|---|
| `currencyCode` | `currency_code` | as-is (Medusa lowercases on write — already asserted `"dkk"`) |
| `email` | `email` | as-is |
| `shipTo` | `shipping_address` | only when present; otherwise the key is `undefined` (no address) |
| `billTo` | `billing_address` | only when present; otherwise `undefined` |
| `*.name` | `*.company` | the canonical `name` is the receiving business ("JK Tryk") |
| `*.contact` | `*.first_name` | the attention/contact person ("3. Parts Nimbus"); `null` if absent |
| — | `*.last_name` | not set (no reliable split) |
| `*.addressLine1` / `addressLine2` | `address_1` / `address_2` | `addressLine2` → `null` if absent |
| `*.city` | `city` | as-is |
| `*.state` | `province` | `null` if absent |
| `*.postCode` | `postal_code` | as-is |
| `*.country` | `country_code` | `.toLowerCase()` |
| `phoneNumber` | `phone` on **each** created address | `null` if absent; the order has no header phone column |

Stays metadata-only (no native column; already preserved verbatim in `canonical_order`):
`externalOrderNumber`, `orderDate`, `requestedDeliveryDate`, `salesperson`, `discountAmount`,
`discountAppliedBeforeTax`, `pricesIncludeTax`, `lines`. Company association stays as
`metadata.company_id` + the Order↔Company link. `customer_id` stays unset — NIMBUS-147 resolves a
company, not a customer.

This deviates from the earlier plan's `name → first_name` decision: `OrderAddress` has a
`company` column, and the canonical `name`/`contact` pair maps onto `company`/`first_name`
without losing the contact.

## Code Skeletons

### New File: `apps/backend/src/workflows/order-ingestion/utils/map-canonical-order-header.ts`

```typescript
import type {
  CreateOrderAddressDTO,
  CreateOrderDTO,
} from "@medusajs/framework/types";
import type {
  CanonicalOrder,
  CanonicalOrderAddress,
} from "../../../modules/order-ingestion/canonical-order-schema";

export type CanonicalOrderHeaderColumns = Pick<
  CreateOrderDTO,
  "currency_code" | "email" | "shipping_address" | "billing_address"
>;

function mapCanonicalAddress(
  address: CanonicalOrderAddress,
  phoneNumber: string | undefined
): CreateOrderAddressDTO {
  return {
    company: address.name,
    first_name: address.contact ?? null,
    address_1: address.addressLine1,
    address_2: address.addressLine2 ?? null,
    city: address.city,
    province: address.state ?? null,
    postal_code: address.postCode,
    country_code: address.country.toLowerCase(),
    phone: phoneNumber ?? null,
  };
}

/*
  Maps the canonical order header onto the native Medusa Order columns it fits. Everything else —
  including the order lines — lives only in metadata.canonical_order.
*/
export function mapCanonicalOrderHeader(
  canonicalOrder: CanonicalOrder
): CanonicalOrderHeaderColumns {
  return {
    currency_code: canonicalOrder.currencyCode,
    email: canonicalOrder.email,
    shipping_address: canonicalOrder.shipTo
      ? mapCanonicalAddress(canonicalOrder.shipTo, canonicalOrder.phoneNumber)
      : undefined,
    billing_address: canonicalOrder.billTo
      ? mapCanonicalAddress(canonicalOrder.billTo, canonicalOrder.phoneNumber)
      : undefined,
  };
}
```

### Modified File: `apps/backend/src/workflows/order-ingestion/steps/create-ingested-order.ts`

Add the import:

```typescript
import { mapCanonicalOrderHeader } from "../utils/map-canonical-order-header";
```

Replace the two header lines of the `createOrders` call (`currency_code: ...`, `email: ...`) with
the spread; the `metadata` block from Task 02 is unchanged:

```typescript
    const order = await orderModuleService.createOrders({
      ...mapCanonicalOrderHeader(input.canonicalOrder),
      metadata: {
        company_id: input.companyId,
        canonical_order: input.canonicalOrder,
        order_ingestion_state: "created",
        order_ingestion_state_updated_at: now,
        [BC_INTEGRATION_STATE_METADATA_KEY]:
          createInitialBcIntegrationState(now),
      },
    });
```

In the step's leading comment, add that mapped header fields (currency, email, addresses, phone)
become native columns.

### Modified File: `apps/backend/src/workflows/order-ingestion/workflows/enrich-order.ts`

Replace only the `// IMPLEMENT:` comment block (lines 19–26) with:

```typescript
    // Header fields (currency, email, shipping/billing address, phone) are mapped onto the order
    // at creation time — see createIngestedOrderStep. Add further enrichment steps here, before
    // the state transition below, if a later story needs them.
```

No code change in that file.

## Impacted Files

| File | Change |
|---|---|
| `apps/backend/src/workflows/order-ingestion/utils/map-canonical-order-header.ts` | **New** — `mapCanonicalOrderHeader(canonicalOrder: CanonicalOrder): CanonicalOrderHeaderColumns` |
| `apps/backend/src/workflows/order-ingestion/__tests__/map-canonical-order-header.unit.spec.ts` | **New** — TC-1, TC-2 |
| `apps/backend/src/workflows/order-ingestion/steps/create-ingested-order.ts` | `createOrders` uses the mapper spread |
| `apps/backend/src/workflows/order-ingestion/workflows/enrich-order.ts` | Stale placeholder comment replaced (comment only) |
| `apps/backend/integration-tests/http/order-ingestion/create-order-workflow.spec.ts` | Add TC-3, TC-4 |

## Test Cases

### TC-1 (unit, happy path): a full shipTo + billTo + phone maps onto both addresses
- **Given:** a canonical order with `shipTo` (with `contact`), `billTo` (without `contact`,
  `addressLine2`, `state`), `phoneNumber` and `email`
- **When:** `mapCanonicalOrderHeader` is called
- **Then:** `shipping_address` has `company` = shipTo name, `first_name` = contact,
  `country_code` = `"dk"`, `phone` = phoneNumber; `billing_address` has `first_name`,
  `address_2`, `province` all `null` and the same phone; `currency_code` / `email` pass through

### TC-2 (unit, edge case): no addresses and no phone
- **Given:** `singleLineCanonicalOrder` (no `shipTo`, `billTo`, `email`, `phoneNumber`)
- **When:** `mapCanonicalOrderHeader` is called
- **Then:** `shipping_address` and `billing_address` are `undefined`; `currency_code` is `"DKK"`

### TC-3 (workflow, wiring): a persisted order carries the mapped shipping address and no line items
- **Given:** a company and `multiLineCanonicalOrder` (has `shipTo`, 2 lines)
- **When:** `createOrderFromCanonicalPayloadWorkflow` runs and the order is re-read with
  `relations: ["shipping_address", "billing_address", "items"]`
- **Then:** `shipping_address` has `company: "JK Tryk"`, `first_name: "3. Parts Nimbus"`,
  `address_1: "Industrikrogen 11B"`, `city: "Rønnede"`, `postal_code: "4683"`,
  `country_code: "dk"`; `billing_address` is absent (`null`/`undefined`); `items` is empty; and
  `metadata.canonical_order` deep-equals the submitted payload (verbatim, both lines present)

### TC-4 (workflow, edge case): an order without addresses is still created
- **Given:** `singleLineCanonicalOrder` with a unique external number
- **When:** the workflow runs
- **Then:** the order exists with no shipping or billing address and `currency_code: "dkk"`

### New File: `apps/backend/src/workflows/order-ingestion/__tests__/map-canonical-order-header.unit.spec.ts`

```typescript
import { mapCanonicalOrderHeader } from "../utils/map-canonical-order-header";
import {
  multiLineCanonicalOrder,
  singleLineCanonicalOrder,
} from "../../../modules/order-ingestion/__fixtures__/canonical-order-fixtures";

describe("mapCanonicalOrderHeader", () => {
  it("TC-1: maps shipTo and billTo onto shipping/billing addresses with the order phone on both", () => {
    const header = mapCanonicalOrderHeader({
      ...multiLineCanonicalOrder,
      email: "orders@example.com",
      phoneNumber: "+45 12 34 56 78",
      billTo: {
        name: "METZ A/S",
        addressLine1: "Skelstedet 9",
        city: "Vedbæk",
        postCode: "2950",
        country: "DK",
      },
    });

    expect(header.currency_code).toEqual("DKK");
    expect(header.email).toEqual("orders@example.com");
    expect(header.shipping_address).toEqual({
      company: "JK Tryk",
      first_name: "3. Parts Nimbus",
      address_1: "Industrikrogen 11B",
      address_2: null,
      city: "Rønnede",
      province: null,
      postal_code: "4683",
      country_code: "dk",
      phone: "+45 12 34 56 78",
    });
    expect(header.billing_address).toEqual({
      company: "METZ A/S",
      first_name: null,
      address_1: "Skelstedet 9",
      address_2: null,
      city: "Vedbæk",
      province: null,
      postal_code: "2950",
      country_code: "dk",
      phone: "+45 12 34 56 78",
    });
  });

  it("TC-2: leaves both addresses undefined when the canonical order has none", () => {
    const header = mapCanonicalOrderHeader(singleLineCanonicalOrder);

    expect(header.currency_code).toEqual("DKK");
    expect(header.shipping_address).toBeUndefined();
    expect(header.billing_address).toBeUndefined();
  });
});
```

### Test Skeleton — add to `create-order-workflow.spec.ts` (inside the existing `describe`)

Extend the fixtures import to include `multiLineCanonicalOrder`:

```typescript
import {
  multiLineCanonicalOrder,
  singleLineCanonicalOrder,
  sampleCustomerNumber,
} from "../../../src/modules/order-ingestion/__fixtures__/canonical-order-fixtures";
```

```typescript
      it("TC-8: maps shipTo onto the order's shipping address, creates no line items, and keeps the canonical payload verbatim", async () => {
        const container = getContainer();
        const companyService =
          container.resolve<ICompanyModuleService>(COMPANY_MODULE);
        const orderModuleService = container.resolve<IOrderModuleService>(
          Modules.ORDER
        );

        await companyService.createCompanies({
          name: "TC-8 Company",
          email: "tc8@example.com",
          business_central_customer_number: "tc8-customer-number",
        });

        const { result: order } = await createOrderFromCanonicalPayloadWorkflow(
          container
        ).run({
          input: {
            customer_number: "tc8-customer-number",
            canonicalOrder: multiLineCanonicalOrder,
          },
        });

        const persisted = await orderModuleService.retrieveOrder(order.id, {
          relations: ["shipping_address", "billing_address", "items"],
        });

        expect(persisted.shipping_address).toEqual(
          expect.objectContaining({
            company: "JK Tryk",
            first_name: "3. Parts Nimbus",
            address_1: "Industrikrogen 11B",
            city: "Rønnede",
            postal_code: "4683",
            country_code: "dk",
          })
        );
        expect(persisted.billing_address ?? null).toBeNull();
        expect(persisted.items ?? []).toHaveLength(0);
        expect(persisted.metadata?.canonical_order).toEqual(
          multiLineCanonicalOrder
        );
      });

      it("TC-9: creates the order without addresses when the canonical order has none", async () => {
        const container = getContainer();
        const companyService =
          container.resolve<ICompanyModuleService>(COMPANY_MODULE);
        const orderModuleService = container.resolve<IOrderModuleService>(
          Modules.ORDER
        );

        await companyService.createCompanies({
          name: "TC-9 Company",
          email: "tc9@example.com",
          business_central_customer_number: "tc9-customer-number",
        });

        const { result: order } = await createOrderFromCanonicalPayloadWorkflow(
          container
        ).run({
          input: {
            customer_number: "tc9-customer-number",
            canonicalOrder: {
              ...singleLineCanonicalOrder,
              externalOrderNumber: "NO-ADDRESS-1",
            },
          },
        });

        const persisted = await orderModuleService.retrieveOrder(order.id, {
          relations: ["shipping_address", "billing_address"],
        });

        expect(persisted.currency_code).toEqual("dkk");
        expect(persisted.shipping_address ?? null).toBeNull();
        expect(persisted.billing_address ?? null).toBeNull();
      });
```

(Named TC-8/TC-9 in the file, after Task 02's TC-7.) If `retrieveOrder` rejects the `items`
relation name at runtime, use `query.graph({ entity: "order", fields: ["id", "items.id"], filters:
{ id: order.id } })` for the item assertion instead — do not change production code.

## Implementation Steps

1. Create `utils/map-canonical-order-header.ts` exactly as shown.
2. Create `__tests__/map-canonical-order-header.unit.spec.ts` exactly as shown; run
   `pnpm test:unit`.
3. Edit `create-ingested-order.ts` to spread `mapCanonicalOrderHeader(...)` in place of the two
   header lines; update its leading comment.
4. Replace the placeholder comment in `enrich-order.ts`.
5. Add TC-8/TC-9 to the workflow spec; run `pnpm test:integration:http` (individually per suite
   if the known hook-timeout flake appears).
6. Run `pnpm build` and `pnpm lint` from the repo root.
