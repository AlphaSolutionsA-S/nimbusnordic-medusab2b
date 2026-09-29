# Task 02: Add `GET /store/bc-returns/:number` API route — Implementation Plan

**Status:** TODO
**App:** backend
**App Root:** apps/backend
**Task ID:** 02
**Date:** 2026-09-29
**Branch:** feature/NIMBUS-141 (from develop)
**Depends on:** Task 01; NIMBUS-140 Task 02 (merged to develop)

> **Hard dependency on NIMBUS-140 Task 02:** customer authentication for this route comes from
> NIMBUS-140's `apps/backend/src/api/store/bc-returns/middlewares.ts`. Its entry
> `{ method: "ALL", matcher: "/store/bc-returns*", middlewares: [authenticate("customer", ["session", "bearer"])] }`
> also matches `/store/bc-returns/31502910`. Before starting, confirm that the file exists, that
> it contains that exact matcher, and that `storeBCReturnsMiddlewares` is registered in
> `apps/backend/src/api/store/middlewares.ts`. If any of these is missing, **stop and report**.
> Do not add a second `authenticate` entry.

---

## Project Environment

- **App root:** `apps/backend`
- **Build command:** `pnpm build` (from repo root) or `cd apps/backend && pnpm build`
- **Lint command:** `pnpm lint` (from repo root)
- **Test command:** `cd apps/backend && pnpm test:unit` (matches `**/src/**/__tests__/**/*.unit.spec.[jt]s`)
- **Test framework:** Jest (`@swc/jest`, node environment)
- **Test location:** `apps/backend/src/api/store/bc-returns/__tests__/return-detail-route.unit.spec.ts` (new file; the `__tests__` folder exists after NIMBUS-140)
- **Naming conventions:** kebab-case folders and files; `[number]` is the Medusa dynamic route segment. Double quotes and semicolons. Use CRLF line endings, matching `bc-orders/[id]/route.ts`.

## Solution Design

This is a read-only GET route that calls the module service directly, with no workflow. That is
the same precedent as `GET /store/bc-orders/:id` (`apps/backend/src/api/store/bc-orders/[id]/route.ts`)
and NIMBUS-140's `GET /store/bc-returns`. Workflows are only required for mutations.

- **Authority comes only from the session.** The BC customer number is resolved from
  `req.auth_context.app_metadata.customer_id`, then
  `customer.employee.company.business_central_customer_number` via `query.graph`. It is never
  taken from the URL. Every employee of the company therefore sees all of the company's returns,
  with the same visibility as NIMBUS-140.
- **No BC customer number configured:** respond 400 with the same message as the other BC routes.
- **Input guard at the trust boundary:** BC document numbers are `Code[20]`. An empty value, or
  one longer than 20 characters, cannot match, so it gets the **same 404** as an unknown return
  and BC is not called. OData quote escaping already happens in `getReturn`.
- **Foreign, unknown and processed returns get an identical 404** (`{ message: "Return not found." }`),
  so the response does not reveal whether a return exists.
- **BC errors:** `getReturn` throws a `MedusaError` (`UNEXPECTED_STATE`). The route lets it
  propagate, the same as the existing BC routes, and Medusa's error handler returns a generic
  500. The storefront shows its friendly error state (Task 05). No BC body or token is ever
  echoed.
- **Response:** `{ return: BCReturnDetail }`, matching the `{ order }` shape of the order route.
  Task 03 consumes it.

No validator or middleware file is needed. There is no query or body, and the path parameter is
guarded inline.

## Code Skeletons

### New File: `apps/backend/src/api/store/bc-returns/[number]/route.ts`

Complete file:

```typescript
import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { BUSINESS_CENTRAL_MODULE } from "../../../../modules/business-central";
import type { IBusinessCentralModuleService } from "../../../../modules/business-central/types";

// Business Central document numbers are Code[20].
const BC_DOCUMENT_NUMBER_MAX_LENGTH = 20;

export const GET = async (
  req: AuthenticatedMedusaRequest,
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
    fields: ["employee.company.business_central_customer_number"],
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

  const returnNumber = req.params.number;

  // Foreign, unknown, processed and impossible numbers all get the same 404.
  if (!returnNumber || returnNumber.length > BC_DOCUMENT_NUMBER_MAX_LENGTH) {
    res.status(404).json({ message: "Return not found." });
    return;
  }

  const bcService =
    req.scope.resolve<IBusinessCentralModuleService>(BUSINESS_CENTRAL_MODULE);
  const bcReturn = await bcService.getReturn({
    customerNumber: bcCustomerNumber,
    returnNumber,
  });

  if (!bcReturn) {
    res.status(404).json({ message: "Return not found." });
    return;
  }

  res.json({ return: bcReturn });
};
```

### New File: `apps/backend/src/api/store/bc-returns/__tests__/return-detail-route.unit.spec.ts`

Complete file:

```typescript
import { GET } from "../[number]/route";

type MockResponse = {
  status: jest.Mock;
  json: jest.Mock;
};

function createResponse(): MockResponse {
  const res = {} as MockResponse;
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

function createRequest(options: {
  returnNumber: string;
  bcCustomerNumber: string | null;
  getReturn?: jest.Mock;
}) {
  const query = {
    graph: jest.fn().mockResolvedValue({
      data: [
        {
          employee: {
            company: {
              business_central_customer_number: options.bcCustomerNumber,
            },
          },
        },
      ],
    }),
  };
  const bcService = { getReturn: options.getReturn ?? jest.fn() };

  const req = {
    auth_context: { app_metadata: { customer_id: "cus_1" } },
    params: { number: options.returnNumber },
    scope: {
      resolve: jest.fn((key: string) => (key === "query" ? query : bcService)),
    },
  };

  return { req, query, bcService };
}

const bcReturn = {
  id: "return-1",
  number: "31502910",
  documentDate: "2026-09-27",
  status: "Open",
  lines: [],
  expectedCredit: {
    currencyCode: "DKK",
    amountIncludingTax: 1598.75,
    amountExcludingTax: 1279,
  },
};

describe("GET /store/bc-returns/:number", () => {
  // TC-1: happy path — the return is loaded for the session's BC customer number.
  it("returns the return scoped to the authenticated customer's company", async () => {
    const getReturn = jest.fn().mockResolvedValue(bcReturn);
    const { req, query } = createRequest({
      returnNumber: "31502910",
      bcCustomerNumber: "10000",
      getReturn,
    });
    const res = createResponse();

    await GET(req as never, res as never);

    expect(query.graph).toHaveBeenCalledWith({
      entity: "customer",
      fields: ["employee.company.business_central_customer_number"],
      filters: { id: "cus_1" },
    });
    expect(getReturn).toHaveBeenCalledWith({
      customerNumber: "10000",
      returnNumber: "31502910",
    });
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ return: bcReturn });
  });

  // TC-2: security — a foreign/unknown/processed return gives a non-disclosing 404.
  it("responds 404 when the return is not found for this customer", async () => {
    const getReturn = jest.fn().mockResolvedValue(null);
    const { req } = createRequest({
      returnNumber: "31502999",
      bcCustomerNumber: "10000",
      getReturn,
    });
    const res = createResponse();

    await GET(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: "Return not found." });
  });

  // TC-3: edge case — an impossible return number gets the same 404 without calling BC.
  it("responds 404 without calling Business Central for a number longer than 20 characters", async () => {
    const getReturn = jest.fn();
    const { req } = createRequest({
      returnNumber: "X".repeat(21),
      bcCustomerNumber: "10000",
      getReturn,
    });
    const res = createResponse();

    await GET(req as never, res as never);

    expect(getReturn).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: "Return not found." });
  });

  // TC-4: error condition — no BC customer number configured on the company.
  it("responds 400 when the company has no Business Central customer number", async () => {
    const getReturn = jest.fn();
    const { req } = createRequest({
      returnNumber: "31502910",
      bcCustomerNumber: null,
      getReturn,
    });
    const res = createResponse();

    await GET(req as never, res as never);

    expect(getReturn).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "No Business Central customer number configured for this company.",
    });
  });

  // TC-5: error condition — BC failures propagate to Medusa's error handler (no leak in body).
  it("propagates Business Central errors instead of responding with their details", async () => {
    const getReturn = jest
      .fn()
      .mockRejectedValue(new Error("Business Central return order request failed with status 500"));
    const { req } = createRequest({
      returnNumber: "31502910",
      bcCustomerNumber: "10000",
      getReturn,
    });
    const res = createResponse();

    await expect(GET(req as never, res as never)).rejects.toThrow(
      "Business Central return order request failed with status 500"
    );
    expect(res.json).not.toHaveBeenCalled();
  });
});
```

## Impacted Files

- New: `apps/backend/src/api/store/bc-returns/[number]/route.ts`
- New: `apps/backend/src/api/store/bc-returns/__tests__/return-detail-route.unit.spec.ts`
- **Not changed:** `apps/backend/src/api/store/bc-returns/middlewares.ts` and
  `apps/backend/src/api/store/middlewares.ts`. NIMBUS-140 owns them, and its `/store/bc-returns*`
  matcher already protects this path.

## Test Cases

### TC-1: Happy path
- **Given:** an authenticated customer whose company has BC customer number `10000`, and a `getReturn` that resolves a return.
- **When:** `GET /store/bc-returns/31502910` is handled.
- **Then:** `getReturn` is called with `{ customerNumber: "10000", returnNumber: "31502910" }` and the response is `{ return: … }`.

### TC-2: Security, non-disclosing 404
- **Given:** `getReturn` resolves `null`, which covers a foreign, unknown or processed return.
- **When:** the route is handled.
- **Then:** the response is 404 `{ message: "Return not found." }`.

### TC-3: Edge case, impossible number
- **Given:** a path number of 21 characters.
- **When:** the route is handled.
- **Then:** the same 404 is returned and BC is not called.

### TC-4: Error, no BC customer number
- **Given:** the company has no `business_central_customer_number`.
- **When:** the route is handled.
- **Then:** the response is 400 with the standard message, and BC is not called.

### TC-5: Error, BC failure
- **Given:** `getReturn` rejects.
- **When:** the route is handled.
- **Then:** the error propagates to Medusa's error handler, and the route writes no response body itself.

### TC-6: Integration, authentication (manual, in the Task 05 sandbox walkthrough)
- **Given:** the backend is running with NIMBUS-140 merged.
- **When:** `curl -i http://localhost:9000/store/bc-returns/31502910 -H "x-publishable-api-key: <pk>"` is sent without a customer session or bearer token.
- **Then:** the response is 401, which shows that NIMBUS-140's `/store/bc-returns*` authenticate matcher covers the detail route.

## Implementation Steps

1. Verify the NIMBUS-140 middleware prerequisites (see the note at the top).
2. Create `apps/backend/src/api/store/bc-returns/[number]/route.ts` exactly as specified.
3. Create `apps/backend/src/api/store/bc-returns/__tests__/return-detail-route.unit.spec.ts` exactly as specified.
4. Run `cd apps/backend && pnpm test:unit`. The 5 new tests must pass, along with NIMBUS-140's validator tests.
5. Run `pnpm build` (repo root) and `pnpm lint`. Neither may report new errors.
6. Do not add a workflow, validator or middleware for this route.
