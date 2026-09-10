# Task 03: Integration Tests for Header Mapping and BC Integration-State

**Status:** TODO
**App:** backend
**App Root:** apps/backend
**Task ID:** 03
**Date:** 2026-09-02
**Branch:** feature/NIMBUS-149 (from develop)
**Depends on:** Task 01

---

## Project Environment

- **App root:** `apps/backend`
- **Test command:** `cd apps/backend && pnpm test:integration:http`
- **Test framework:** Jest, `medusaIntegrationTestRunner` from `@medusajs/test-utils`
- **Test location:** `apps/backend/integration-tests/http/**/*.spec.ts`

## Context

NIMBUS-129 Task 03 already defines test cases for the order-creation workflow
(`create-order-workflow.spec.ts`). This task extends those tests with assertions for the new
header mapping and BC integration-state metadata added in Task 01.

If NIMBUS-129 Task 03 has already been implemented, add the new test cases to the existing test
file. If not, create a new test file that covers both Task 03's original cases and this story's
additional cases.

## Test Cases

### TC-1: Order with `shipTo` address — address mapped to `shipping_address`

```typescript
it('TC-1: maps canonical shipTo to the order shipping_address', async () => {
  const { result: order } = await createOrderFromCanonicalPayloadWorkflow(container).run({
    input: {
      customer_number: sampleCustomerNumber,
      canonicalOrder: multiLineCanonicalOrder, // has shipTo
    },
  });

  const persistedOrder = await orderModuleService.retrieveOrder(order.id, {
    relations: ['shipping_address'],
  });

  expect(persistedOrder.shipping_address).toBeDefined();
  expect(persistedOrder.shipping_address?.first_name).toEqual('JK Tryk');
  expect(persistedOrder.shipping_address?.address_1).toEqual('Industrikrogen 11B');
  expect(persistedOrder.shipping_address?.city).toEqual('Rønnede');
  expect(persistedOrder.shipping_address?.postal_code).toEqual('4683');
  expect(persistedOrder.shipping_address?.country_code).toEqual('dk');
});
```

### TC-2: Order with `billTo` address — address mapped to `billing_address`

```typescript
it('TC-2: maps canonical billTo to the order billing_address', async () => {
  const orderWithBillTo: CanonicalOrder = {
    ...singleLineCanonicalOrder,
    billTo: {
      name: 'METZ A/S',
      addressLine1: 'Skelstedet 9',
      city: 'Vedbæk',
      postCode: '2950',
      country: 'DK',
    },
  };

  const { result: order } = await createOrderFromCanonicalPayloadWorkflow(container).run({
    input: { customer_number: sampleCustomerNumber, canonicalOrder: orderWithBillTo },
  });

  const persistedOrder = await orderModuleService.retrieveOrder(order.id, {
    relations: ['billing_address'],
  });

  expect(persistedOrder.billing_address).toBeDefined();
  expect(persistedOrder.billing_address?.first_name).toEqual('METZ A/S');
  expect(persistedOrder.billing_address?.address_1).toEqual('Skelstedet 9');
  expect(persistedOrder.billing_address?.city).toEqual('Vedbæk');
  expect(persistedOrder.billing_address?.postal_code).toEqual('2950');
  expect(persistedOrder.billing_address?.country_code).toEqual('dk');
});
```

### TC-3: Order without `billTo`/`shipTo` — no addresses set

```typescript
it('TC-3: creates an order without addresses when billTo and shipTo are absent', async () => {
  const { result: order } = await createOrderFromCanonicalPayloadWorkflow(container).run({
    input: {
      customer_number: sampleCustomerNumber,
      canonicalOrder: singleLineCanonicalOrder, // no billTo, no shipTo
    },
  });

  const persistedOrder = await orderModuleService.retrieveOrder(order.id, {
    relations: ['shipping_address', 'billing_address'],
  });

  expect(persistedOrder.shipping_address).toBeNull();
  expect(persistedOrder.billing_address).toBeNull();
});
```

### TC-4: `phoneNumber` mapped to `shipping_address.phone`

```typescript
it('TC-4: maps canonical phoneNumber to shipping_address.phone', async () => {
  const orderWithPhone: CanonicalOrder = {
    ...multiLineCanonicalOrder, // has shipTo
    phoneNumber: '+45 56720335',
  };

  const { result: order } = await createOrderFromCanonicalPayloadWorkflow(container).run({
    input: { customer_number: sampleCustomerNumber, canonicalOrder: orderWithPhone },
  });

  const persistedOrder = await orderModuleService.retrieveOrder(order.id, {
    relations: ['shipping_address'],
  });

  expect(persistedOrder.shipping_address?.phone).toEqual('+45 56720335');
});
```

### TC-5: `bc_integration_state` metadata present with correct initial values

```typescript
it('TC-5: initializes bc_integration_state metadata with pending status and zero retry count', async () => {
  const { result: order } = await createOrderFromCanonicalPayloadWorkflow(container).run({
    input: {
      customer_number: sampleCustomerNumber,
      canonicalOrder: singleLineCanonicalOrder,
    },
  });

  const persistedOrder = await orderModuleService.retrieveOrder(order.id, {
    select: ['id', 'metadata'],
  });

  const bcState = persistedOrder.metadata?.bc_integration_state;
  expect(bcState).toBeDefined();
  expect(bcState.bc_order_id).toBeNull();
  expect(bcState.status).toEqual('pending');
  expect(bcState.retry_count).toEqual(0);
  expect(bcState.timestamp).toBeDefined();
  // timestamp should be a valid ISO string
  expect(new Date(bcState.timestamp).toISOString()).toEqual(bcState.timestamp);
});
```

### TC-6: `canonical_order` metadata present and verbatim

```typescript
it('TC-6: persists the complete canonical order JSON verbatim in metadata', async () => {
  const { result: order } = await createOrderFromCanonicalPayloadWorkflow(container).run({
    input: {
      customer_number: sampleCustomerNumber,
      canonicalOrder: multiLineCanonicalOrder,
    },
  });

  const persistedOrder = await orderModuleService.retrieveOrder(order.id, {
    select: ['id', 'metadata'],
  });

  expect(persistedOrder.metadata?.canonical_order).toEqual(multiLineCanonicalOrder);
});
```

### TC-7: No `OrderLineItem` records created

```typescript
it('TC-7: does not create any OrderLineItem records', async () => {
  const { result: order } = await createOrderFromCanonicalPayloadWorkflow(container).run({
    input: {
      customer_number: sampleCustomerNumber,
      canonicalOrder: multiLineCanonicalOrder, // has 2 lines
    },
  });

  const persistedOrder = await orderModuleService.retrieveOrder(order.id, {
    relations: ['items'],
  });

  expect(persistedOrder.items).toHaveLength(0);
});
```

### TC-8: Duplicate `externalOrderNumber` for same company — rejected

*(Already covered by NIMBUS-129 Task 03's TC-2. Verify it exists and passes.)*

### TC-9: Order creation failure — compensation rolls back

*(Already covered by NIMBUS-129 Task 03's TC-3 or TC-4. Verify it exists and passes.)*

## Test Cases Summary

| # | Description | New? | Verifies |
|---|-------------|------|----------|
| TC-1 | `shipTo` mapped to `shipping_address` | Yes | Address mapping |
| TC-2 | `billTo` mapped to `billing_address` | Yes | Address mapping |
| TC-3 | No addresses when `billTo`/`shipTo` absent | Yes | Optional address handling |
| TC-4 | `phoneNumber` mapped to `shipping_address.phone` | Yes | Phone mapping |
| TC-5 | `bc_integration_state` initialized correctly | Yes | BC integration-state metadata |
| TC-6 | `canonical_order` metadata verbatim | Yes | Raw payload retention |
| TC-7 | No `OrderLineItem` records | Yes | Header-only constraint |
| TC-8 | Duplicate rejection | Existing | Idempotency (verify) |
| TC-9 | Failure rollback | Existing | Failure handling (verify) |

## Impacted Files

- **Modified or New:** `apps/backend/integration-tests/http/order-ingestion/create-order-workflow.spec.ts`
  — add TC-1 through TC-7. If the file already exists (from NIMBUS-129 Task 03), add the new test
  cases to it. If not, create it with all test cases (NIMBUS-129 Task 03's + this story's).

## Open Items

- **Reconcile with NIMBUS-129 Task 03's test file** — if Task 03's test file already exists, add
  the new test cases to it. If not, create a combined test file.
- **Verify `retrieveOrder` relations** — confirm that `relations: ['shipping_address']` and
  `relations: ['billing_address']` are the correct relation names for the installed Medusa
  version.
- **Verify `items` relation** — confirm that `relations: ['items']` returns the order's line
  items (empty array for header-only orders).
