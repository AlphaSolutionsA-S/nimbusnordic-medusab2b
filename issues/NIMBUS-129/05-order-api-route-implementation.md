# Task 05: Order API Route + Middleware (NIMBUS-144 endpoint) — Implementation Plan

**Status:** TODO
**App:** backend
**App Root:** apps/backend
**Task ID:** 05
**Date:** 2026-09-02
**Branch:** feature/NIMBUS-129-order-ingestion (from develop)
**Depends on:** Task 01, Task 02, Task 03, Task 04

---

## Project Environment

- **App root:** `apps/backend`
- **Build command:** `pnpm build` (from repo root) or `cd apps/backend && pnpm build`
- **Lint command:** `pnpm lint` (from repo root)
- **Test command:** `cd apps/backend && pnpm test:integration:http`
- **Test framework:** Jest, `medusaIntegrationTestRunner` from `@medusajs/test-utils`
- **Test location:** `apps/backend/integration-tests/http/**/*.spec.ts`
- **Naming conventions:** kebab-case directories/files, `@medusajs/framework` import path for
  `MiddlewareRoute`/`validateAndTransformBody`/`validateAndTransformQuery`/`authenticate` (this
  repo's actual import path for the admin-route case — verified in
  `apps/backend/src/api/admin/approvals/middlewares.ts`).

## Context — the redesign this task reflects

**Response contract changed.** An earlier revision of this plan returned `201` with a placeholder
tracking reference (`IncomingOrder.id`) because order creation happened asynchronously, after the
response. **That is no longer true.** Task 03's order creation is now synchronous — by the time
this route responds, a real Medusa `Order` exists (on success) or nothing was created at all (on
failure). This fully resolves that earlier plan's explicitly-flagged placeholder-reference
problem: **the response now returns the real Medusa order id**, not a stand-in.

**What's still asynchronous, and why the route still has exactly one fire-and-forget call**: only
Task 04's post-creation enrichment/event chain runs after the response. That call must remain
genuinely non-blocking regardless of the order's outcome being known synchronously now — see Task
04's doc for why the event emission itself, not just "the processing," has to be the thing that's
never awaited.

**Auth mechanism is unchanged from the previous revision** — Medusa's built-in secret API key
(`authenticate("user", ["api-key"])`, HTTP Basic auth). That decision and its full reasoning are
recorded in PLAN.md's "Decisions & Trade-offs" and are not revisited by this redesign.

**Body validation schema changed**: this route now validates the body directly against Task 02's
`CanonicalOrderSchema` (the single schema — see Task 02's doc for why the old two-schema
"envelope vs. canonical" split no longer applies). There is no separate `OrderEnvelopeSchema`
anymore.

### Resolved decisions

- **Endpoint path**: `POST /orderapi/orders`, under a new `/orderapi` namespace (unchanged from
  the previous revision).
- **Query parameter name**: `customerNumber` (unchanged).
- **Response contract on success**: `201`, body `{ order_id: string, status: string }`, where
  `order_id` is the real Medusa `Order.id` and `status` is the Order's own `status` field (Medusa
  defaults new orders to `"pending"`).
- **Response contract on failure**: no custom handling needed — Task 03's workflow steps throw
  correctly-typed `MedusaError`s (`NOT_FOUND` for an unrecognized `customerNumber` → `404`,
  `DUPLICATE_ERROR` for a repeat `externalOrderNumber` within the same company → `422`), and
  Medusa's own `validateAndTransformBody`/`validateAndTransformQuery` middleware already produces
  `400` for structural/schema validation failures before the route handler runs at all. **Do not
  add a try/catch around the workflow call** — see Task 03's doc for why.
- **`/orderapi` outside `/admin` — no CORS or routing implications** (unchanged reasoning from
  the previous revision — CORS is a browser-enforced mechanism, irrelevant to this
  Logic-App-to-Medusa server-to-server call).

## Solution Design

```
apps/backend/src/api/orderapi/
├── middlewares.ts                     # aggregator for this namespace (spread into root middlewares.ts)
└── orders/
    ├── route.ts                       # POST handler
    └── validators.ts                  # query schema only now (see Task 02)
```

Route handler flow:
1. `authenticate("user", ["api-key"])` middleware runs first (matches `/orderapi/orders*`, method
   `ALL`) — `401` on a missing/invalid/malformed secret key.
2. `validateAndTransformQuery(OrderApiOrdersQuerySchema)` — `400` if `customerNumber`
   missing/empty.
3. `validateAndTransformBody(CanonicalOrderSchema)` (Task 02's schema, imported directly — this
   route no longer defines its own body schema) — `400` if the canonical contract isn't satisfied.
4. Route handler: `await` Task 03's `createOrderFromCanonicalPayloadWorkflow` — this is fully
   synchronous now; the response genuinely waits for it, on purpose, because the response needs
   to report the real outcome.
5. Fire (without awaiting) Task 04's `emitOrderIngestionCreatedEventWorkflow` — the one remaining
   asynchronous step, deliberately never awaited, with a `.catch()` that logs any error.
6. Respond `201` with `{ order_id, status }` from the order Task 03's workflow returned.

## Code Skeletons

### New File: `apps/backend/src/api/orderapi/orders/validators.ts`

```typescript
import { z } from '@medusajs/framework/zod';

export const OrderApiOrdersQuerySchema = z
  .object({
    customerNumber: z.string().min(1),
  })
  .strict();

export type OrderApiOrdersQueryType = z.infer<typeof OrderApiOrdersQuerySchema>;
```

(This file previously also exported `OrderEnvelopeSchema` — that's gone. Body validation now uses
Task 02's `CanonicalOrderSchema` directly, imported from
`apps/backend/src/modules/order-ingestion/canonical-order-schema.ts` in `middlewares.ts` below.)

### New File: `apps/backend/src/api/orderapi/middlewares.ts`

```typescript
import {
  authenticate,
  MiddlewareRoute,
  validateAndTransformBody,
  validateAndTransformQuery,
} from '@medusajs/framework';
import { CanonicalOrderSchema } from '../../modules/order-ingestion/canonical-order-schema';
import { OrderApiOrdersQuerySchema } from './orders/validators';

export const orderApiMiddlewares: MiddlewareRoute[] = [
  {
    method: 'ALL',
    matcher: '/orderapi/orders*',
    // Secret API key only (HTTP Basic auth: `Authorization: Basic <sk_...>`). This key is
    // issued to and used exclusively by the Logic App (NIMBUS-146) — an internal Azure
    // credential, never distributed to external B2B customer systems — so authenticating it as
    // a full Medusa admin user (Medusa's only supported secret-API-key actor type) is an
    // accepted trade-off. See PLAN.md's "Decisions & Trade-offs" for the full reasoning.
    middlewares: [authenticate('user', ['api-key'])],
  },
  {
    method: ['POST'],
    matcher: '/orderapi/orders',
    middlewares: [
      validateAndTransformQuery(OrderApiOrdersQuerySchema, {}),
      validateAndTransformBody(CanonicalOrderSchema),
    ],
  },
];
```

### New File: `apps/backend/src/api/orderapi/orders/route.ts`

```typescript
import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { createOrderFromCanonicalPayloadWorkflow } from '../../../workflows/order-ingestion/workflows/create-order-from-canonical-payload';
import { emitOrderIngestionCreatedEventWorkflow } from '../../../workflows/order-ingestion/workflows/emit-order-ingestion-created-event';
import type { CanonicalOrder } from '../../../modules/order-ingestion/canonical-order-schema';
import type { OrderApiOrdersQueryType } from './validators';

export async function POST(
  req: MedusaRequest<CanonicalOrder>,
  res: MedusaResponse
): Promise<void> {
  // Cast justified: this repo has no existing example of a second MedusaRequest query generic
  // wired through validateAndTransformQuery's runtime-set req.validatedQuery — the middleware
  // guarantees this shape at runtime (see validators.ts), this cast just gives it back to TS.
  const { customerNumber } = req.validatedQuery as unknown as OrderApiOrdersQueryType;
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER);

  // Synchronous and awaited on purpose: Task 03's workflow throws a correctly-typed MedusaError
  // (404 unknown customer, 422 duplicate) if it can't create the order — do not wrap this in
  // try/catch (see Task 03's doc). If it succeeds, `order` is a real, persisted Medusa Order.
  const { result: order } = await createOrderFromCanonicalPayloadWorkflow(req.scope).run({
    input: {
      customer_number: customerNumber,
      canonicalOrder: req.validatedBody,
    },
  });

  // Deliberate fire-and-forget: only the event *emission* is unawaited, not the order creation
  // itself (which already completed above). This must never block the response, regardless of
  // how the local event bus schedules subscriber execution internally — see Task 04's doc.
  void emitOrderIngestionCreatedEventWorkflow(req.scope)
    .run({ input: { order_id: order.id } })
    .catch((error: Error) => {
      logger.error(
        `Failed to emit order_ingestion.order_created for order ${order.id}: ${error.message}`
      );
    });

  res.status(201).json({
    order_id: order.id,
    status: order.status,
  });
}
```

## Impacted Files

### Modified: `apps/backend/src/api/middlewares.ts`

Current file (verbatim):

```typescript
import {
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework";
import { defineMiddlewares } from "@medusajs/medusa";
import { adminMiddlewares } from "./admin/middlewares";
import { storeMiddlewares } from "./store/middlewares";

export default defineMiddlewares({
  routes: [
    ...adminMiddlewares,
    ...storeMiddlewares,
    {
      matcher: "/store/customers/me",
      middlewares: [
        (req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) => {
          req.allowed = ["employee"];
          next();
        },
      ],
    },
  ],
});
```

Change to (add one import, spread `orderApiMiddlewares` — do not touch anything else):

```typescript
import {
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework";
import { defineMiddlewares } from "@medusajs/medusa";
import { adminMiddlewares } from "./admin/middlewares";
import { storeMiddlewares } from "./store/middlewares";
import { orderApiMiddlewares } from "./orderapi/middlewares";

export default defineMiddlewares({
  routes: [
    ...adminMiddlewares,
    ...storeMiddlewares,
    ...orderApiMiddlewares,
    {
      matcher: "/store/customers/me",
      middlewares: [
        (req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) => {
          req.allowed = ["employee"];
          next();
        },
      ],
    },
  ],
});
```

No `.env`/`.env.template` changes (unchanged from the previous revision — the secret API key is
managed via `/admin/api-keys`, not an env var).

## Test Cases

### New File: `apps/backend/integration-tests/http/orderapi/orders.spec.ts`

Uses `medusaIntegrationTestRunner` exactly as proven in
`apps/backend/integration-tests/http/companies/companies.spec.ts`. Creating a secret API key for
tests follows the exact same in-repo pattern as `generatePublishableKey` in
`apps/backend/integration-tests/utils/store.ts` (which calls
`apiKeyModule.createApiKeys({ title, type: ApiKeyType.PUBLISHABLE, created_by: "test" })`
directly via `Modules.API_KEY`) — this file does the same with `ApiKeyType.SECRET` instead.

**Most tests below no longer need to poll for anything** — the order's existence and its
`status` are known synchronously now. TC-7 is the one exception: it confirms the fire-and-forget
event chain (Task 04) actually runs end-to-end starting from a real HTTP request, which is
inherently asynchronous by design, so it still polls with a bounded timeout.

```typescript
import { medusaIntegrationTestRunner } from '@medusajs/test-utils';
import { ApiKeyType, Modules } from '@medusajs/framework/utils';
import type { IApiKeyModuleService, IOrderModuleService, OrderDTO } from '@medusajs/framework/types';
import { COMPANY_MODULE } from '../../../src/modules/company';
import type { ICompanyModuleService } from '../../../src/types';
import { singleLineCanonicalOrder } from '../../../src/modules/order-ingestion/__tests__/canonical-order-fixtures';

jest.setTimeout(60 * 1000);

async function generateSecretApiKeyHeaders(container: any) {
  const apiKeyModule = container.resolve<IApiKeyModuleService>(Modules.API_KEY);
  const secretKey = await apiKeyModule.createApiKeys({
    title: 'test orderapi secret key',
    type: ApiKeyType.SECRET,
    created_by: 'test',
  });

  return { headers: { authorization: `Basic ${secretKey.token}` } };
}

async function waitForOrderIngestionState(
  orderModuleService: IOrderModuleService,
  orderId: string,
  expectedState: string,
  timeoutMs = 5000
): Promise<OrderDTO> {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const order = await orderModuleService.retrieveOrder(orderId, { select: ['id', 'metadata'] });
    if (order.metadata?.order_ingestion_state === expectedState) {
      return order;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  throw new Error(
    `Timed out waiting for order ${orderId} to reach order_ingestion_state="${expectedState}"`
  );
}

medusaIntegrationTestRunner({
  inApp: true,
  testSuite: ({ api, getContainer }) => {
    describe('POST /orderapi/orders', () => {
      it('TC-1: accepts a valid order for a known customer and returns 201 with the real order id (happy path)', async () => {
        const container = getContainer();
        const companyService = container.resolve<ICompanyModuleService>(COMPANY_MODULE);
        const secretHeaders = await generateSecretApiKeyHeaders(container);

        await companyService.createCompanies({
          name: 'TC-1 HTTP Company',
          email: 'tc1-http@example.com',
          business_central_customer_number: 'tc1-http-customer',
        });

        const response = await api.post(
          '/orderapi/orders?customerNumber=tc1-http-customer',
          singleLineCanonicalOrder,
          secretHeaders
        );

        expect(response.status).toEqual(201);
        expect(response.data.order_id).toEqual(expect.stringMatching(/^order_/));
        expect(typeof response.data.status).toEqual('string');
      });

      it('TC-2: rejects a request with a missing or invalid secret API key (auth enforcement)', async () => {
        await expect(
          api.post('/orderapi/orders?customerNumber=whatever', singleLineCanonicalOrder)
        ).rejects.toMatchObject({ response: { status: 401 } });

        await expect(
          api.post('/orderapi/orders?customerNumber=whatever', singleLineCanonicalOrder, {
            headers: { authorization: 'Basic sk_not_a_real_key' },
          })
        ).rejects.toMatchObject({ response: { status: 401 } });
      });

      it('TC-3: rejects a structurally invalid body missing a required canonical field', async () => {
        const container = getContainer();
        const secretHeaders = await generateSecretApiKeyHeaders(container);
        const { externalOrderNumber, ...invalidBody } = singleLineCanonicalOrder;

        await expect(
          api.post('/orderapi/orders?customerNumber=whatever', invalidBody, secretHeaders)
        ).rejects.toMatchObject({ response: { status: 400 } });
      });

      it('TC-4: rejects a request missing the customerNumber query parameter', async () => {
        const container = getContainer();
        const secretHeaders = await generateSecretApiKeyHeaders(container);

        await expect(
          api.post('/orderapi/orders', singleLineCanonicalOrder, secretHeaders)
        ).rejects.toMatchObject({ response: { status: 400 } });
      });

      it('TC-5: rejects a request for an unrecognized customerNumber with a 404, synchronously — no order is created', async () => {
        const container = getContainer();
        const secretHeaders = await generateSecretApiKeyHeaders(container);

        await expect(
          api.post(
            '/orderapi/orders?customerNumber=no-such-customer-http',
            { ...singleLineCanonicalOrder, externalOrderNumber: 'UNKNOWN-CUSTOMER-HTTP-1' },
            secretHeaders
          )
        ).rejects.toMatchObject({ response: { status: 404 } });
      });

      it('TC-6: rejects a duplicate externalOrderNumber for the same company with a 422, synchronously', async () => {
        const container = getContainer();
        const companyService = container.resolve<ICompanyModuleService>(COMPANY_MODULE);
        const secretHeaders = await generateSecretApiKeyHeaders(container);

        await companyService.createCompanies({
          name: 'TC-6 HTTP Company',
          email: 'tc6-http@example.com',
          business_central_customer_number: 'tc6-http-customer',
        });

        const payload = { ...singleLineCanonicalOrder, externalOrderNumber: 'DUP-ORDER-HTTP-1' };

        const first = await api.post(
          '/orderapi/orders?customerNumber=tc6-http-customer',
          payload,
          secretHeaders
        );
        expect(first.status).toEqual(201);

        await expect(
          api.post('/orderapi/orders?customerNumber=tc6-http-customer', payload, secretHeaders)
        ).rejects.toMatchObject({ response: { status: 422 } });
      });

      it('TC-7: the full pipeline eventually reaches ready_for_business_central after a successful POST (integration/wiring: route → sync order creation → fire-and-forget event → subscriber → enrich workflow)', async () => {
        const container = getContainer();
        const companyService = container.resolve<ICompanyModuleService>(COMPANY_MODULE);
        const orderModuleService = container.resolve<IOrderModuleService>(Modules.ORDER);
        const secretHeaders = await generateSecretApiKeyHeaders(container);

        await companyService.createCompanies({
          name: 'TC-7 HTTP Company',
          email: 'tc7-http@example.com',
          business_central_customer_number: 'tc7-http-customer',
        });

        const response = await api.post(
          '/orderapi/orders?customerNumber=tc7-http-customer',
          { ...singleLineCanonicalOrder, externalOrderNumber: 'EVENT-CHAIN-HTTP-1' },
          secretHeaders
        );

        expect(response.status).toEqual(201);

        const finalOrder = await waitForOrderIngestionState(
          orderModuleService,
          response.data.order_id,
          'ready_for_business_central'
        );
        expect(finalOrder.id).toEqual(response.data.order_id);
      });
    });
  },
});
```

Run with: `cd apps/backend && pnpm test:integration:http`.

## Implementation Steps

1. Create `apps/backend/src/api/orderapi/orders/validators.ts` exactly as shown above (if it
   already exists from an earlier revision with an `OrderEnvelopeSchema`, replace its content
   entirely — that schema no longer exists anywhere in this project).
2. Create `apps/backend/src/api/orderapi/middlewares.ts` exactly as shown above (note it now
   imports `CanonicalOrderSchema` from Task 02's module file, not a local schema).
3. Create `apps/backend/src/api/orderapi/orders/route.ts` exactly as shown above.
4. Edit `apps/backend/src/api/middlewares.ts` exactly as shown in "Impacted Files" — add the
   import and the one spread entry only (if already added by an earlier revision, no change
   needed here).
5. Create `apps/backend/integration-tests/http/orderapi/orders.spec.ts` exactly as shown above
   (if a stale version from an earlier revision exists, replace it entirely — the response
   contract and several status codes changed).
6. Run `cd apps/backend && pnpm test:integration:http` and confirm all seven test cases pass.
7. Run `pnpm build` from the repo root and fix any type errors before marking this task done.
8. Run `pnpm lint` from the repo root and fix any lint errors before marking this task done.

## Manual Verification (optional, after automated tests pass)

1. Start the dev server (`pnpm backend:dev` from repo root) and log into the Admin dashboard
   (`http://localhost:9000/app`).
2. Go to Settings → API Key Management (`/admin/api-keys`) and create a new **Secret** key
   (title e.g. "Order Ingestion — Logic App"). Copy the plaintext key shown once
   (`sk_...`) — this is the credential to hand to whoever configures the Logic App
   (NIMBUS-146) connection, e.g. stored in Azure Key Vault, not in this repo.
3. With an existing `Company` row that has `business_central_customer_number` set:

```bash
curl -X POST "http://localhost:9000/orderapi/orders?customerNumber=<that company's number>" \
  -H "Content-Type: application/json" \
  -u "sk_your_secret_key_here:" \
  -d '{"externalOrderNumber":"MANUAL-TEST-1","orderDate":"2026-09-02","currencyCode":"DKK","lines":[{"lineNumber":1,"itemNumber":"ITEM-1","eanNo":"1234567890123","description":"Test item","quantity":1,"unitPrice":10}]}'
```

Expect `201` with `{"order_id":"order_...","status":"pending"}` immediately (no waiting). Query
the order's `metadata` a moment later (Admin dashboard's order detail page, or the DB directly —
there is no admin widget surfacing this yet, that's NIMBUS-158's future job) and confirm
`order_ingestion_state` has advanced to `"ready_for_business_central"`.
