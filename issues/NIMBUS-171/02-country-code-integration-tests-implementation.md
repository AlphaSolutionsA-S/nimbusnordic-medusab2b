# Task 02: HTTP and workflow integration tests for the country rule — Implementation Plan

**Status:** TODO
**App:** backend
**App Root:** apps/backend
**Task ID:** 02
**Date:** 2026-09-30
**Branch:** feature/NIMBUS-171 (from develop)
**Depends on:** Task 01
**Approved:** 2026-09-30 (Q1). TC-10 and TC-11 assert the approved storage: upper case in
`metadata.canonical_order`, lower case on the Medusa address.

---

## Project Environment

- **App root:** `apps/backend`
- **Build command:** `cd apps/backend && pnpm build`
- **Lint command:** `pnpm lint` (from repo root)
- **Test command:** `cd apps/backend && pnpm test:integration:http` (needs the local test
  PostgreSQL that `.env.test` points at, as for the existing HTTP suites)
- **Test framework:** Jest + `medusaIntegrationTestRunner` from `@medusajs/test-utils` (`inApp: true`)
- **Test location:** `apps/backend/integration-tests/http/`
- **Naming conventions:** existing files use double quotes and `TC-n:` test titles. Continue
  numbering after the last existing TC in each file.

## Solution Design

Task 01 makes the address country rule part of `CanonicalOrderSchema`, which the route already
runs through `validateAndTransformBody` (`apps/backend/src/api/orderapi/middlewares.ts`). No
production code changes in this task. It proves, end to end:

- an invalid country gives Medusa's existing 400 (`type: "invalid_data"`) naming the field path and
  the value sent, and nothing is created (no order, no external reference) even though the
  customer is known;
- a valid lower-case, padded country is accepted and stored lower case on the order address, while
  `metadata.canonical_order` holds the normalized upper-case code, which NIMBUS-148 sends to Business Central;
- the workflow persists **both** billing and shipping addresses from a schema-parsed payload.
  Existing workflow TC-8 only covers shipping.

`createOrderFromCanonicalPayloadWorkflow` does not re-validate, because the route is the only
production entry point. So the invalid-country rejection is tested at HTTP level, not workflow level.

## Code Skeletons

### Additions to `apps/backend/integration-tests/http/orderapi/orders.spec.ts`

Replace the fixture import line and add three imports. Final import block:

```typescript
import { medusaIntegrationTestRunner } from "@medusajs/test-utils";
import { ApiKeyType, Modules } from "@medusajs/framework/utils";
import type {
  IApiKeyModuleService,
  IOrderModuleService,
  OrderDTO,
} from "@medusajs/framework/types";
import { COMPANY_MODULE } from "../../../src/modules/company";
import type { ICompanyModuleService } from "../../../src/types";
import { ORDER_INGESTION_MODULE } from "../../../src/modules/order-ingestion";
import type OrderIngestionModuleService from "../../../src/modules/order-ingestion/service";
import type { CanonicalOrder } from "../../../src/modules/order-ingestion/canonical-order-schema";
import { singleLineCanonicalOrder } from "../../../src/modules/order-ingestion/__fixtures__/canonical-order-fixtures";
```

Add this helper below `waitForOrderIngestionState` (same test-only pattern as
`create-order-workflow.spec.ts`):

```typescript
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

const countryTestAddress = {
  name: "JK Tryk",
  contact: "3. Parts Nimbus",
  addressLine1: "Industrikrogen 11B",
  city: "Rønnede",
  postCode: "4683",
};
```

Append these tests inside `describe("POST /orderapi/orders", ...)` after TC-7:

```typescript
      it("TC-8: rejects an invalid shipTo.country with the existing 400, naming the field and the value sent, and creates nothing (NIMBUS-171)", async () => {
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
        const secretHeaders = await generateSecretApiKeyHeaders(container);

        const company = await companyService.createCompanies({
          name: "TC-8 HTTP Company",
          email: "tc8-http@example.com",
          business_central_customer_number: "tc8-http-customer",
        });

        const error = await api
          .post(
            "/orderapi/orders?customerNumber=tc8-http-customer",
            {
              ...singleLineCanonicalOrder,
              externalOrderNumber: "COUNTRY-INVALID-HTTP-1",
              shipTo: { ...countryTestAddress, country: "Denmark" },
            },
            secretHeaders
          )
          .catch((e) => e);

        expect(error.response.status).toEqual(400);
        expect(error.response.data.type).toEqual("invalid_data");
        expect(error.response.data.message).toEqual(
          "Invalid request: Field 'shipTo.country' must be an ISO 3166-1 alpha-2 country code, but got: 'Denmark'"
        );
        // Only the field path and the sent country are echoed — no other payload content.
        expect(error.response.data.message).not.toContain("JK Tryk");
        expect(error.response.data.message).not.toContain("COUNTRY-INVALID-HTTP-1");

        expect(
          await listOrdersForExternalNumber(
            orderModuleService,
            "COUNTRY-INVALID-HTTP-1"
          )
        ).toHaveLength(0);
        expect(
          await orderIngestionService.listOrderExternalReferences({
            external_order_number: "COUNTRY-INVALID-HTTP-1",
            company_id: company.id,
          })
        ).toHaveLength(0);
      });

      it("TC-9: rejects an unassigned two-letter billTo.country (XX) with a 400 naming billTo.country (NIMBUS-171)", async () => {
        const container = getContainer();
        const companyService =
          container.resolve<ICompanyModuleService>(COMPANY_MODULE);
        const secretHeaders = await generateSecretApiKeyHeaders(container);

        await companyService.createCompanies({
          name: "TC-9 HTTP Company",
          email: "tc9-http@example.com",
          business_central_customer_number: "tc9-http-customer",
        });

        await expect(
          api.post(
            "/orderapi/orders?customerNumber=tc9-http-customer",
            {
              ...singleLineCanonicalOrder,
              externalOrderNumber: "COUNTRY-INVALID-HTTP-2",
              billTo: { ...countryTestAddress, country: "XX" },
              shipTo: { ...countryTestAddress, country: "DK" },
            },
            secretHeaders
          )
        ).rejects.toMatchObject({
          response: {
            status: 400,
            data: {
              type: "invalid_data",
              message: expect.stringContaining(
                "Field 'billTo.country' must be an ISO 3166-1 alpha-2 country code, but got: 'XX'"
              ),
            },
          },
        });
      });

      it("TC-10: accepts a lower-case, padded country, stores it lower case on the order address and upper case in the canonical metadata (NIMBUS-171)", async () => {
        const container = getContainer();
        const companyService =
          container.resolve<ICompanyModuleService>(COMPANY_MODULE);
        const orderModuleService = container.resolve<IOrderModuleService>(
          Modules.ORDER
        );
        const secretHeaders = await generateSecretApiKeyHeaders(container);

        await companyService.createCompanies({
          name: "TC-10 HTTP Company",
          email: "tc10-http@example.com",
          business_central_customer_number: "tc10-http-customer",
        });

        const response = await api.post(
          "/orderapi/orders?customerNumber=tc10-http-customer",
          {
            ...singleLineCanonicalOrder,
            externalOrderNumber: "COUNTRY-VALID-HTTP-1",
            shipTo: { ...countryTestAddress, country: " se " },
          },
          secretHeaders
        );

        expect(response.status).toEqual(201);

        const persisted = await orderModuleService.retrieveOrder(
          response.data.order_id,
          { relations: ["shipping_address"] }
        );
        expect(persisted.shipping_address?.country_code).toEqual("se");
        expect(
          (persisted.metadata?.canonical_order as CanonicalOrder | undefined)
            ?.shipTo?.country
        ).toEqual("SE");
      });
```

Note on TC-8: `api.post(...).catch((e) => e)` is used so several fields of the axios error can be
asserted. If the request unexpectedly succeeds, `error.response` is undefined and the test fails
on the first `expect`, which is the desired outcome.

### Additions to `apps/backend/integration-tests/http/order-ingestion/create-order-workflow.spec.ts`

Add one import below the existing `import type { CanonicalOrder } ...` line:

```typescript
import { CanonicalOrderSchema } from "../../../src/modules/order-ingestion/canonical-order-schema";
```

Append inside `describe("createOrderFromCanonicalPayloadWorkflow", ...)` after TC-9:

```typescript
      it("TC-11: persists both addresses from a schema-normalized payload with lower-case country codes (NIMBUS-171)", async () => {
        const container = getContainer();
        const companyService =
          container.resolve<ICompanyModuleService>(COMPANY_MODULE);
        const orderModuleService = container.resolve<IOrderModuleService>(
          Modules.ORDER
        );

        await companyService.createCompanies({
          name: "TC-11 Company",
          email: "tc11@example.com",
          business_central_customer_number: "tc11-customer-number",
        });

        const address = {
          name: "METZ A/S",
          addressLine1: "Skelstedet 9",
          city: "Vedbæk",
          postCode: "2950",
        };
        const canonicalOrder = CanonicalOrderSchema.parse({
          ...singleLineCanonicalOrder,
          externalOrderNumber: "COUNTRY-WORKFLOW-1",
          billTo: { ...address, country: "dk " },
          shipTo: { ...address, country: "\tNo" },
        });

        const { result: order } = await createOrderFromCanonicalPayloadWorkflow(
          container
        ).run({
          input: {
            customer_number: "tc11-customer-number",
            canonicalOrder,
          },
        });

        const persisted = await orderModuleService.retrieveOrder(order.id, {
          relations: ["shipping_address", "billing_address"],
        });

        expect(persisted.billing_address?.country_code).toEqual("dk");
        expect(persisted.shipping_address?.country_code).toEqual("no");
        expect(
          (persisted.metadata?.canonical_order as CanonicalOrder | undefined)
            ?.billTo?.country
        ).toEqual("DK");
      });
```

## Impacted Files

| File | Change |
|------|--------|
| `apps/backend/integration-tests/http/orderapi/orders.spec.ts` | 3 imports, `listOrdersForExternalNumber` helper, `countryTestAddress` const, TC-8, TC-9, TC-10 |
| `apps/backend/integration-tests/http/order-ingestion/create-order-workflow.spec.ts` | 1 import, TC-11 |

No production files change in this task.

## Test Cases

### TC-8 (HTTP): Invalid country → 400, nothing created
- **Given:** a known company and a payload with `shipTo.country = "Denmark"`
- **When:** `POST /orderapi/orders?customerNumber=…`
- **Then:** 400, `type: "invalid_data"`, message exactly
  `Invalid request: Field 'shipTo.country' must be an ISO 3166-1 alpha-2 country code, but got: 'Denmark'`,
  no other payload values in the message, no order and no external reference exist for the number

### TC-9 (HTTP): Unassigned two-letter code on billTo → 400
- **Given:** `billTo.country = "XX"`, valid `shipTo`
- **When:** POST
- **Then:** 400 naming `billTo.country` and `'XX'`

### TC-10 (HTTP): Lower-case padded country accepted
- **Given:** `shipTo.country = " se "`
- **When:** POST
- **Then:** 201, order `shipping_address.country_code = "se"`, `metadata.canonical_order.shipTo.country = "SE"`

### TC-11 (workflow): Both addresses persisted lower case
- **Given:** a schema-parsed payload with `billTo.country = "dk "`, `shipTo.country = "\tNo"`
- **When:** the workflow runs
- **Then:** billing `dk`, shipping `no`, metadata billTo country `DK`

## Implementation Steps

1. Confirm Task 01 is done (`pnpm test:unit` green).
2. Edit `orders.spec.ts`: imports, helper, const, TC-8 to TC-10.
3. Edit `create-order-workflow.spec.ts`: import, TC-11.
4. Run `cd apps/backend && pnpm test:integration:http`. The existing TCs must stay green.
5. If the HTTP suite cannot run locally (no test database), say so in the handover and run at
   least `pnpm build`. Do not mark the task done without either a green run or an explicit note.
6. Do not commit.
