# Implementation Task 04: Store Return Routes + Validators + Middlewares

> **Depends on tasks 01 and 03.** Two thin HTTP boundaries: (a) `GET` return reasons for the UI
> dropdown, (b) `POST` create-return. Authenticate, resolve company scope server-side, run the
> workflow / call the reasons provider, map errors. No business logic here.

## Project Environment

- **App root:** `apps/backend`
- **Build command:** `pnpm build`
- **Test command:** `cd apps/backend && pnpm test:integration:http`
- **Test location:** `apps/backend/integration-tests/http/bc-orders/`
- **HTTP methods:** GET for reasons, POST for create (never PUT/PATCH).

## Solution Design

1. `GET /store/bc-orders/return-reasons` → `bcService.listReturnReasons()` (task 01 dummy provider).
   Auth-only; no company scope needed (reasons are catalogue data). Returns
   `{ return_reasons: BCReturnReason[] }`.
2. `POST /store/bc-orders/:id/returns` → `:id` is the source sales order OData id. Resolve
   `employee.company.id` + `business_central_customer_number` server-side via `query.graph` exactly
   as `[id]/route.ts` does (400 if no BC number). Run `createBcReturnWorkflow` with server-derived
   scope + validated body. Map `NOT_FOUND`→404 (customer-safe "Order not found."),
   `INVALID_DATA`→400 (customer-safe message), else→500 generic. Never leak BC tokens, IDs, URLs, or
   raw exception text.

The client supplies **only** the per-line selection (`source_line_no`, `quantity`,
`return_reason_code`). It never supplies company/customer numbers, `sourceOrderNo`, `requestId`,
prices, or item numbers — all server-derived.

## Code Skeletons

### New File: `apps/backend/src/api/store/bc-orders/[id]/returns/validators.ts`

```typescript
import { z } from "@medusajs/framework/zod";

export type StoreCreateBCReturnType = z.infer<typeof StoreCreateBCReturn>;

export const StoreCreateBCReturn = z
  .object({
    lines: z
      .array(
        z
          .object({
            source_line_no: z.number().int().positive(),
            quantity: z.number().positive().max(1_000_000),
            return_reason_code: z.string().min(1).max(50),
          })
          .strict()
      )
      .min(1)
      .max(50),
  })
  .strict()
  .superRefine((val, ctx) => {
    const nos = val.lines.map((l) => l.source_line_no);
    if (new Set(nos).size !== nos.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Duplicate source_line_no is not allowed.",
      });
    }
  });
```

### Modified File: `apps/backend/src/api/store/bc-orders/middlewares.ts`

Keep the existing `ALL` auth matcher and the GET list validator; add the POST body validator for
the returns path. (The reasons `GET` needs no query validator, only the auth matcher, which already
covers `/store/bc-orders*`.)

```typescript
import {
  authenticate,
  validateAndTransformBody,
  validateAndTransformQuery,
} from "@medusajs/framework";
import { MiddlewareRoute } from "@medusajs/medusa";
import { StoreBCOrdersQuery } from "./validators";
import { StoreCreateBCReturn } from "./[id]/returns/validators";

export const storeBCOrdersMiddlewares: MiddlewareRoute[] = [
  {
    method: "ALL",
    matcher: "/store/bc-orders*",
    middlewares: [authenticate("customer", ["session", "bearer"])],
  },
  {
    method: ["GET"],
    matcher: "/store/bc-orders",
    middlewares: [
      validateAndTransformQuery(StoreBCOrdersQuery, {
        defaults: ["limit", "offset", "status", "date_from", "date_to", "search"],
        isList: true,
      }),
    ],
  },
  {
    method: ["POST"],
    matcher: "/store/bc-orders/:id/returns",
    middlewares: [validateAndTransformBody(StoreCreateBCReturn)],
  },
];
```

> Route-collision note: `/store/bc-orders/return-reasons` and `/store/bc-orders/[id]` both sit at the
> same path depth. Medusa file-based routing resolves the static `return-reasons` segment before the
> dynamic `[id]`, but confirm during implementation that a `GET /store/bc-orders/return-reasons`
> does not get captured by `[id]/route.ts`. If it does, nest reasons under a non-colliding path
> (e.g. `/store/bc-orders/returns/reasons`) and update task 05 accordingly.

### New File: `apps/backend/src/api/store/bc-orders/return-reasons/route.ts`

```typescript
import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework";
import { BUSINESS_CENTRAL_MODULE } from "../../../../modules/business-central";
import type { IBusinessCentralModuleService } from "../../../../modules/business-central/types";

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
): Promise<void> => {
  const bcService = req.scope.resolve<IBusinessCentralModuleService>(
    BUSINESS_CENTRAL_MODULE
  );
  const reasons = await bcService.listReturnReasons();
  res.json({ return_reasons: reasons });
};
```

### New File: `apps/backend/src/api/store/bc-orders/[id]/returns/route.ts`

```typescript
import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework";
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils";
import { createBcReturnWorkflow } from "../../../../../workflows/business-central-return/workflows/create-bc-return";
import type { StoreCreateBCReturnType } from "./validators";

export const POST = async (
  req: AuthenticatedMedusaRequest<StoreCreateBCReturnType>,
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

  const companyId = customer?.employee?.company?.id as string | undefined;
  const bcCustomerNumber =
    customer?.employee?.company?.business_central_customer_number as
      | string
      | undefined
      | null;

  if (!companyId || !bcCustomerNumber) {
    res.status(400).json({
      message: "No Business Central customer number configured for this company.",
    });
    return;
  }

  const body = req.validatedBody;

  // IMPLEMENT:
  // 1. try {
  //      const { result } = await createBcReturnWorkflow(req.scope).run({ input: {
  //        customerId: customer_id, companyId, bcCustomerNumber,
  //        sourceSalesOrderId: req.params.id,
  //        lines: body.lines.map((l) => ({
  //          sourceLineNo: l.source_line_no,
  //          quantityToReturn: l.quantity,
  //          returnReasonCode: l.return_reason_code })) } });
  //      res.json({ return: result });
  //    } catch (e) {
  //      NOT_FOUND -> 404 "Order not found."; INVALID_DATA -> 400 e.message;
  //      else -> 500 generic message. Never expose BC tokens/IDs/URLs/raw text.
  //    }
};
```

## Test Cases (HTTP integration; the BC service create seam is the offline task-01 stub)

- **TC-1 Unauthenticated:** POST or GET reasons without a customer token → 401.
- **TC-2 Reasons happy path:** authenticated GET → 200 `{ return_reasons: [{id, description}, ...] }`.
- **TC-3 No BC number:** authenticated customer whose company lacks a BC number, POST → 400.
- **TC-4 Strict payload rejection:** unknown field / empty `lines` / non-positive quantity /
  duplicate `source_line_no` / missing `return_reason_code` → 400, no side effects.
- **TC-5 Cross-company source order:** `getOrder` mocked to `null` → 404 "Order not found.".
- **TC-6 Happy path:** valid body → 200 `{ return: {...} }` with the stub's return number.

## Implementation Steps

1. Add the validator, extend `middlewares.ts`, add both routes (resolve the route-collision note).
2. Add `integration-tests/http/bc-orders/bc-returns.spec.ts` covering TC-1..TC-6 (mock `getOrder`
   for scope cases; the create/reasons seams are the offline stub).
3. Run `pnpm test:integration:http` and `pnpm build`.
