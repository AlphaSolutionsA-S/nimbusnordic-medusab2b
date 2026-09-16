# Task 02: Add `GET /store/bc-returns` API route — Implementation Plan

**Status:** TODO
**App:** backend
**App Root:** apps/backend
**Task ID:** 02
**Date:** 2026-09-15
**Branch:** feature/NIMBUS-140 (from develop)
**Depends on:** Task 01

---

## Project Environment

- **App root:** `apps/backend`
- **Build command:** `pnpm build` (from repo root) or `cd apps/backend && pnpm build`
- **Lint command:** `pnpm lint` (from repo root)
- **Test command:** `cd apps/backend && pnpm test:unit` (matches `**/src/**/__tests__/**/*.unit.spec.[jt]s`)
- **Test framework:** Jest (`@swc/jest`, node environment)
- **Test location:** `apps/backend/src/api/store/bc-returns/__tests__/validators.unit.spec.ts` (new file)
- **Naming conventions:** camelCase functions/variables, PascalCase types, kebab-case directories/files. Double-quoted strings, semicolons.

## Solution Design

Add a new store API route `GET /store/bc-returns`, mirroring the existing `GET /store/bc-orders` route (`apps/backend/src/api/store/bc-orders/route.ts`, `middlewares.ts`, `validators.ts`) field-for-field, but calling the new `bcService.listReturns(...)` from Task 01 instead of `listOrders`.

This is a **read-only GET route that calls the module service directly**, with no workflow — this exactly mirrors the existing `GET /store/bc-orders` and `GET /store/bc-orders/:id` routes, which also call `bcService.listOrders(...)` / `bcService.getOrder(...)` directly without a workflow (workflows are required for mutations; this is a read, consistent with existing precedent in this codebase).

The route resolves the caller's Business Central customer number the same way the existing `bc-orders` route does: via `query.graph()` on the `customer` entity, reading `employee.company.business_central_customer_number`. If that is not configured, respond `400` with the same message used by the existing route (do not invent a different message).

Graceful degradation on BC errors/timeouts (the SCOPE.md non-functional requirement) is handled entirely at the **storefront** layer (Task 05's page component wraps the fetch in try/catch, exactly like the existing `bcorders/page.tsx`) — no additional backend error handling is needed beyond the `MedusaError` already thrown by `listReturns` on a non-OK BC response.

## Code Skeletons

### New File: `apps/backend/src/api/store/bc-returns/validators.ts`

```typescript
import { z } from "@medusajs/framework/zod";

export type StoreBCReturnsQueryType = z.infer<typeof StoreBCReturnsQuery>;

export const StoreBCReturnsQuery = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(20),
    offset: z.coerce.number().int().min(0).default(0),
    status: z.string().optional(),
    date_from: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "date_from must be YYYY-MM-DD")
      .optional(),
    date_to: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "date_to must be YYYY-MM-DD")
      .optional(),
    search: z.string().max(200).optional(),
  })
  .strict();
```

### New File: `apps/backend/src/api/store/bc-returns/middlewares.ts`

```typescript
import {
  authenticate,
  validateAndTransformQuery,
} from "@medusajs/framework";
import { MiddlewareRoute } from "@medusajs/medusa";
import { StoreBCReturnsQuery } from "./validators";

export const storeBCReturnsMiddlewares: MiddlewareRoute[] = [
  {
    method: "ALL",
    matcher: "/store/bc-returns*",
    middlewares: [authenticate("customer", ["session", "bearer"])],
  },
  {
    method: ["GET"],
    matcher: "/store/bc-returns",
    middlewares: [
      validateAndTransformQuery(StoreBCReturnsQuery, {
        defaults: [
          "limit",
          "offset",
          "status",
          "date_from",
          "date_to",
          "search",
        ],
        isList: true,
      }),
    ],
  },
];
```

### New File: `apps/backend/src/api/store/bc-returns/route.ts`

```typescript
import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { BUSINESS_CENTRAL_MODULE } from "../../../modules/business-central";
import type {
  BCListReturnsParams,
  IBusinessCentralModuleService,
} from "../../../modules/business-central/types";
import type { StoreBCReturnsQueryType } from "./validators";

export const GET = async (
  req: AuthenticatedMedusaRequest<never, StoreBCReturnsQueryType>,
  res: MedusaResponse
): Promise<void> => {
  const { customer_id } = req.auth_context.app_metadata as {
    customer_id: string;
  };

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);

  const {
    data: [customer],
  } = await query.graph({
    entity: "customer",
    fields: [
      "employee.company.id",
      "employee.company.business_central_customer_number",
    ],
    filters: { id: customer_id },
  });

  const bcCustomerNumber =
    customer?.employee?.company?.business_central_customer_number as
      | string
      | undefined
      | null;

  if (!bcCustomerNumber) {
    res.status(400).json({
      message:
        "No Business Central customer number configured for this company.",
    });
    return;
  }

  const { limit, offset, status, date_from, date_to, search } =
    req.validatedQuery as StoreBCReturnsQueryType;

  const bcService =
    req.scope.resolve<IBusinessCentralModuleService>(BUSINESS_CENTRAL_MODULE);

  const bcParams: BCListReturnsParams = {
    customerNumber: bcCustomerNumber,
    limit: limit ?? 20,
    offset: offset ?? 0,
    status,
    date_from,
    date_to,
    search,
  };

  const result = await bcService.listReturns(bcParams);

  res.json(result);
};
```

### New File: `apps/backend/src/api/store/bc-returns/__tests__/validators.unit.spec.ts`

```typescript
import { StoreBCReturnsQuery } from "../validators";

describe("StoreBCReturnsQuery", () => {
  // TC-1: happy path — defaults are applied when no query params are given.
  it("defaults limit to 20 and offset to 0", () => {
    const result = StoreBCReturnsQuery.parse({});

    expect(result).toEqual({ limit: 20, offset: 0 });
  });

  // TC-2: edge case — an invalid date format is rejected.
  it("rejects a date_from that is not YYYY-MM-DD", () => {
    expect(() =>
      StoreBCReturnsQuery.parse({ date_from: "01-01-2026" })
    ).toThrow();
  });

  // TC-3: wiring — an unknown query param is rejected by .strict().
  it("rejects an unrecognized query parameter", () => {
    expect(() =>
      StoreBCReturnsQuery.parse({ unexpected: "value" })
    ).toThrow();
  });
});
```

## Impacted Files

### `apps/backend/src/api/store/middlewares.ts` (edit)

Register the new middleware array.

Old:
```typescript
import { MiddlewareRoute } from "@medusajs/medusa";
import { storeApprovalsMiddlewares } from "./approvals/middlewares";
import { storeBCOrdersMiddlewares } from "./bc-orders/middlewares";
import { storeBusinessCentralMiddlewares } from "./business-central/middlewares";
import { storeCartsMiddlewares } from "./carts/middlewares";
import { storeCompaniesMiddlewares } from "./companies/middlewares";
import { storeCustomersMiddlewares } from "./customers/middlewares";
import { storeFreeShippingMiddlewares } from "./free-shipping/middlewares";
import { storeQuotesMiddlewares } from "./quotes/middlewares";

export const storeMiddlewares: MiddlewareRoute[] = [
  ...storeBusinessCentralMiddlewares,
  ...storeBCOrdersMiddlewares,
  ...storeCartsMiddlewares,
  ...storeCompaniesMiddlewares,
  ...storeCustomersMiddlewares,
  ...storeQuotesMiddlewares,
  ...storeFreeShippingMiddlewares,
  ...storeApprovalsMiddlewares,
];
```

New:
```typescript
import { MiddlewareRoute } from "@medusajs/medusa";
import { storeApprovalsMiddlewares } from "./approvals/middlewares";
import { storeBCOrdersMiddlewares } from "./bc-orders/middlewares";
import { storeBCReturnsMiddlewares } from "./bc-returns/middlewares";
import { storeBusinessCentralMiddlewares } from "./business-central/middlewares";
import { storeCartsMiddlewares } from "./carts/middlewares";
import { storeCompaniesMiddlewares } from "./companies/middlewares";
import { storeCustomersMiddlewares } from "./customers/middlewares";
import { storeFreeShippingMiddlewares } from "./free-shipping/middlewares";
import { storeQuotesMiddlewares } from "./quotes/middlewares";

export const storeMiddlewares: MiddlewareRoute[] = [
  ...storeBusinessCentralMiddlewares,
  ...storeBCOrdersMiddlewares,
  ...storeBCReturnsMiddlewares,
  ...storeCartsMiddlewares,
  ...storeCompaniesMiddlewares,
  ...storeCustomersMiddlewares,
  ...storeQuotesMiddlewares,
  ...storeFreeShippingMiddlewares,
  ...storeApprovalsMiddlewares,
];
```

## Test Cases

### TC-1: Happy path — defaults applied
- **Given:** No query parameters are sent.
- **When:** `StoreBCReturnsQuery.parse({})` is called.
- **Then:** The result is `{ limit: 20, offset: 0 }`.

### TC-2: Edge case — invalid date format rejected
- **Given:** `date_from: "01-01-2026"` (wrong format).
- **When:** `StoreBCReturnsQuery.parse(...)` is called.
- **Then:** It throws a `ZodError`.

### TC-3: Integration/wiring — unknown params rejected
- **Given:** A query object with an unrecognized key.
- **When:** `StoreBCReturnsQuery.parse(...)` is called.
- **Then:** It throws, because the schema is `.strict()`.

## Implementation Steps

1. Create `apps/backend/src/api/store/bc-returns/validators.ts` exactly as specified.
2. Create `apps/backend/src/api/store/bc-returns/middlewares.ts` exactly as specified.
3. Create `apps/backend/src/api/store/bc-returns/route.ts` exactly as specified.
4. Edit `apps/backend/src/api/store/middlewares.ts` to register `storeBCReturnsMiddlewares` exactly as specified.
5. Create `apps/backend/src/api/store/bc-returns/__tests__/validators.unit.spec.ts` exactly as specified.
6. Run `cd apps/backend && pnpm test:unit` and confirm the 3 new tests pass and nothing else regresses.
7. Run `pnpm build` from the repo root and confirm no TypeScript errors (this will catch any mismatch between `BCListReturnsParams`/`BCListReturnsResult` from Task 01 and this route's usage).
8. Run `pnpm lint` from the repo root and confirm no new lint errors.
9. Do not add a workflow for this route — it is a read, matching the existing `GET /store/bc-orders` precedent exactly.
