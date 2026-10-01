# Authentication in Medusa

## Default Protected Routes

| Prefix | Who | Methods |
|---|---|---|
| `/admin/*` (e.g. `/admin/products`, `/admin/custom-reports`) | authenticated admin users | session, bearer, API key |
| `/store/customers/me/*` (e.g. `/store/customers/me/orders`, `/store/customers/me/addresses`) | authenticated customers | session, bearer |

These need no configuration; Medusa authenticates them automatically.

## Authentication Methods

| Method | Notes |
|---|---|
| Session | Cookie-based, used after email/password login; handled automatically by the Medusa SDK |
| Bearer token (JWT) | `Authorization: Bearer <token>` header; used by frontend apps |
| Secret API key | Admin (`user`) only; server-to-server; `Authorization: Basic <base64("sk_…:")>` (`Basic sk_…` unencoded is also accepted). The request's `auth_context` then has `actor_type: "api-key"` and `actor_id` = the API key ID, not a user ID |

## Custom Protected Routes

Add the `authenticate` middleware only to routes outside the default prefixes. On `/admin/*` or `/store/customers/me/*` it is redundant.

```typescript
// src/api/middlewares.ts
import { defineMiddlewares, authenticate } from "@medusajs/framework/http"

export default defineMiddlewares({
  routes: [
    { matcher: "/custom/admin*",    middlewares: [authenticate("user", ["session", "bearer", "api-key"])] },
    { matcher: "/store/reviews*",   middlewares: [authenticate("customer", ["session", "bearer"])] },
    { matcher: "/store/wishlists*", middlewares: [authenticate("customer", ["session", "bearer"])] },
    // ✗ { matcher: "/admin/reports*", middlewares: [authenticate("user", …)] }  — already protected
  ],
})
```

`authenticate(actorType, methods, options?)`: `actorType` is `"user"` (admin) or `"customer"`; `methods` lists the allowed authentication methods. Admin routes may allow all three methods. Customer routes use `session`/`bearer` only, because API keys are admin-only (`authenticate("customer", ["api-key"])` is wrong).

## Accessing Authenticated User

In a protected route the actor is at `req.auth_context.actor_id`.

- Type the request as `AuthenticatedMedusaRequest`. `MedusaRequest` declares no `auth_context`, so accessing `req.auth_context.actor_id` is a type error.
- Don't check authentication manually (`if (!req.auth_context?.actor_id) throw …`). If authentication failed, the request never reaches the handler, so the check is redundant code that invites bugs.
- Always take the actor ID from `req.auth_context`, never from the request body (`req.validatedBody.customer_id` can be spoofed).
- Pass the actor ID into the workflow. Ownership validation is business logic and belongs in a workflow step, not the route (see [workflows.md → Business Logic and Validation Placement](workflows.md#business-logic-and-validation-placement)).

```typescript
// src/api/store/reviews/[id]/route.ts — authenticate("customer", ["session", "bearer"]) applied
import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { deleteReviewWorkflow } from "../../../../workflows/delete-review"

export async function DELETE(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const customerId = req.auth_context.actor_id   // guaranteed by the middleware
  await deleteReviewWorkflow(req.scope).run({
    input: { reviewId: req.params.id, customerId }, // the workflow checks the review belongs to this customer
  })
  return res.json({ success: true })
}
```

## Authentication Patterns

The same `actor_id` feeds every pattern:

| Pattern | Use of `actor_id` |
|---|---|
| User-specific data | Filter a query: `filters: { created_by: userId }` (admin), `filters: { customer_id: customerId }` (customer) |
| Customer profile routes | Routes under `/store/customers/me/*` (e.g. `.../me/wishlist/route.ts`) are protected automatically; use `actor_id` for GET queries and as workflow input on POST (`addToWishlistWorkflow({ customer_id, product_id })`) |
| Admin action tracking | Pass it as workflow input (e.g. `archived_by: adminUserId`) and log it |
| Ownership validation | Pass it to the workflow, which validates (above) |

### Pattern: Optional Authentication

For routes that benefit from authentication but don't require it, pass `allowUnauthenticated: true`. Every `/store/*` route already gets this by default (`authenticate("customer", ["bearer", "session"], { allowUnauthenticated: true })`), so add it yourself only for other prefixes. `MedusaRequest` has no `auth_context`; type the handler as `MedusaStoreRequest` (store routes; `auth_context?` optional) and treat the actor as optional. This is the one place reading `req.auth_context?.actor_id` is correct — it's not a manual auth check:

```typescript
// src/api/store/products/middlewares.ts — entry in the exported MiddlewareRoute[] array
{
  matcher: "/store/products/*/reviews",
  middlewares: [authenticate("customer", ["session", "bearer"], { allowUnauthenticated: true })],
}

// src/api/store/products/[id]/reviews/route.ts
export async function GET(req: MedusaStoreRequest, res: MedusaResponse) {
  const customerId = req.auth_context?.actor_id   // may be undefined
  // … query reviews; if customerId, mark review.is_own = review.customer_id === customerId
}
```

## Frontend Integration

With the Medusa JS SDK, log in once; the SDK then sends auth on subsequent requests (JWT in the `Authorization` header).

```typescript
import { sdk } from "./lib/sdk"
await sdk.auth.login("customer", "emailpass", { email, password })  // storefront
const { customer } = await sdk.store.customer.retrieve()
const { orders } = await sdk.store.customer.listOrders()

await sdk.auth.login("user", "emailpass", { email, password })      // admin app
const { products } = await sdk.admin.product.list()
```

## Security Best Practices

- Use the actor ID from context, and choose the authentication methods appropriate to the actor type (see above).
- Don't expose sensitive data: strip internal fields before responding (e.g. `metadata.internal_notes`). Credentials never live on the customer/user entity; they are in the Auth Module's auth identity.
