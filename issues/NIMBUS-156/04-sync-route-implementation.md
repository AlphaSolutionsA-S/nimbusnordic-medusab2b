# Task 04 — Protected sync route + middleware

**App:** backend
**Depends on:** 03 (`syncCompanyFromBusinessCentralWorkflow`)
**Base branch:** `develop`

## Goal
Add a protected, bodyless `POST /store/customers/me/company/sync-business-central` route that
derives the actor from `req.auth_context`, runs the sync workflow with only the customer id, and
returns the workflow's minimal status. Expected BC failures are already contained by the workflow
as `failed`; the route must not broadly catch programming or database failures. The storefront
still treats any endpoint failure as non-fatal after authentication. Register the route with
`authenticate("customer", ["session", "bearer"])`.

## Files

### New: `apps/backend/src/api/store/customers/me/company/sync-business-central/route.ts`

```typescript
import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework";
import { syncCompanyFromBusinessCentralWorkflow } from "../../../../../../workflows/company/workflows/sync-company-from-business-central";

export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
): Promise<void> => {
  const { customer_id } = req.auth_context.app_metadata as {
    customer_id: string;
  };

  const { result } = await syncCompanyFromBusinessCentralWorkflow(req.scope).run({
    input: { customerId: customer_id },
  });

  // Minimal, customer-safe response: no BC endpoint, token, raw error, or BC record.
  res.status(200).json({ status: result.status });
};
```

Notes:
- Bodyless: no validator, no `req.validatedBody`. Accepts no company id, BC number, or field
  values (OWASP: authority is derived server-side only).
- `customer_id` comes from `req.auth_context.app_metadata`, mirroring `bc-orders` and
  `me/password`.
- Verify the relative import depth to `workflows/company/workflows/...`
  (route is at `store/customers/me/company/sync-business-central/route.ts`).

### Modify: `apps/backend/src/api/store/customers/middlewares.ts`
Add the authenticate guard for the new route.

```typescript
import { validateAndTransformBody } from "@medusajs/framework";
import { authenticate, MiddlewareRoute } from "@medusajs/medusa";
import { StoreUpdatePassword } from "./me/password/validators";

export const storeCustomersMiddlewares: MiddlewareRoute[] = [
  {
    method: ["POST"],
    matcher: "/store/customers/me/password",
    middlewares: [
      authenticate("customer", ["session", "bearer"]),
      validateAndTransformBody(StoreUpdatePassword),
    ],
  },
  {
    method: ["POST"],
    matcher: "/store/customers/me/company/sync-business-central",
    middlewares: [authenticate("customer", ["session", "bearer"])],
  },
];
```

> The existing global `/store/customers/me` middleware in `src/api/middlewares.ts` sets
> `req.allowed = ["employee"]`; it matches that exact path and does not authenticate the new
> sub-route, so the explicit `authenticate` above is required. Do not modify the global entry.

## Test cases (integration HTTP — `medusaIntegrationTestRunner`)

### TC-1: unauthenticated request rejected
- **Given** no auth header
- **When** `POST /store/customers/me/company/sync-business-central`
- **Then** the response is `401` (authenticate middleware)

### TC-2: authenticated actor selects its own company
- **Given** a store user linked to a company with no BC number configured
- **When** the authenticated POST runs
- **Then** the response is `200` with `{ status: "skipped" }` and the company is unchanged
  (proves the actor's company is resolved server-side, no authority in the request)

### TC-3: BC failure is non-fatal
- **Given** a company with a BC number but the BC service throws (mock/stub the module or env)
- **When** the authenticated POST runs
- **Then** the response is `200` with `{ status: "failed" }` and no secret/BC record is returned

### TC-4: unexpected backend failure remains visible
- **Given** the workflow fails outside the contained BC service call
- **When** the authenticated POST runs
- **Then** the response is non-2xx, while the storefront login test proves this secondary failure
  does not alter the completed login result

## Validation
- `pnpm --filter @b2b-starter/backend test:integration:http`
- `pnpm --filter @b2b-starter/backend build`
- Confirm the response body never contains a BC endpoint, token, raw error, or customer record.
