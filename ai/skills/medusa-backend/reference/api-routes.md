# Custom API Routes

API routes ("endpoints") expose custom functionality to storefronts and admin dashboards.

## Contents
- [Path Conventions](#path-conventions)
- [Middleware Validation](#middleware-validation)
- [Query Parameter Validation](#query-parameter-validation)
- [Request Query Config for List Endpoints](#request-query-config-for-list-endpoints)
- [Import Organization](#import-organization)
- [API Route Structure](#api-route-structure)
- [Error Handling](#error-handling)
- [Protected Routes](#protected-routes)
- [Using Workflows in API Routes](#using-workflows-in-api-routes)
- [API Route Organization](#api-route-organization)
- [Common Patterns](#common-patterns)

## Path Conventions

| Prefix | For | Examples | Auth |
|---|---|---|---|
| `/store/<rest-of-path>` | Storefront | `/store/newsletter-signup`, `/store/custom-search` | SDK automatically sends the publishable API key |
| `/admin/<rest-of-path>` | Admin dashboard | `/admin/custom-reports`, `/admin/bulk-operations` | SDK automatically sends auth headers (bearer/session) |

Detailed authentication patterns: [authentication.md](authentication.md).

## Middleware Validation

Always validate request bodies with a Zod schema and the `validateAndTransformBody` middleware.

When a route needs both authentication and validation, pass both in the `middlewares` array,
`authenticate` first so it runs first. Don't nest the validator inside `authenticate`:

```typescript
middlewares: [
  authenticate("customer", ["session", "bearer"]),
  validateAndTransformBody(CreateReviewSchema),
]
// ✗ authenticate("customer", ["session", "bearer"], { validator: CreateReviewSchema }) — doesn't work
```

### Step 1: Create Middleware File

Feature middleware files export a named `MiddlewareRoute[]` array, plus the schema and its inferred type:

```typescript
// src/api/store/[feature]/middlewares.ts
import { MiddlewareRoute, validateAndTransformBody } from "@medusajs/framework/http"
import { z } from "zod"

export const CreateMySchema = z.object({
  email: z.string().email(),
  name: z.string().min(2),
})
export type CreateMySchema = z.infer<typeof CreateMySchema> // for route handlers

export const myMiddlewares: MiddlewareRoute[] = [
  { matcher: "/store/my-route", method: "POST", middlewares: [validateAndTransformBody(CreateMySchema)] },
]
```

### Step 2: Register in src/api/middlewares.ts

```typescript
// src/api/middlewares.ts
import { defineMiddlewares } from "@medusajs/framework/http"
import { myMiddlewares } from "./store/[feature]/middlewares"

export default defineMiddlewares({ routes: [...myMiddlewares] })
```

Middleware files export arrays directly, not default-exported config objects. Don't confuse this
with route files (`route.ts`), which use `export const config = defineRouteConfig(...)`.

```typescript
// ✗ in the feature file:   export default { config: { routes: [...] } }
// ✗ in src/api/middlewares.ts: routes: [...reviewMiddlewares.config.routes]
```

### Step 3: Use Typed req.validatedBody in Route

Pass the inferred Zod type as the type argument to `MedusaRequest`; without it, accessing
`req.validatedBody` is a type error.

```typescript
// src/api/store/my-route/route.ts
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { CreateMySchema } from "./middlewares"

export async function POST(req: MedusaRequest<CreateMySchema>, res: MedusaResponse) {
  const { email, name } = req.validatedBody
  // ✗ req: MedusaRequest → type error on req.validatedBody
}
```

## Query Parameter Validation

Validate query parameters with the `validateAndTransformQuery` middleware, then read them from
`req.validatedQuery`, not `req.query`. Query params arrive as strings or string arrays, so use
`z.preprocess` to convert non-string types:

```typescript
// src/api/custom/validators.ts
export const GetMyRouteSchema = z.object({
  cart_id: z.string(), // strings need no preprocessing
  limit: z.preprocess(
    (val) => (val && typeof val === "string" ? parseInt(val) : val),
    z.number().optional()
  ),
  status: z.enum(["active", "pending", "completed"]).optional(),
})

// src/api/middlewares.ts
import { validateAndTransformQuery, defineMiddlewares } from "@medusajs/framework/http"
// …
{ matcher: "/store/my-route", method: "GET", middlewares: [validateAndTransformQuery(GetMyRouteSchema, {})] }

// route.ts
const { cart_id, limit, status } = req.validatedQuery // string, number, enum
```

## Request Query Config for List Endpoints

Best practice for list routes: use request query config so clients control fields/relations,
pagination and ordering, with sensible defaults.

### Step 1: Add Middleware with createFindParams

```typescript
// src/api/store/products/middlewares.ts — spread into src/api/middlewares.ts like any feature file
import { MiddlewareRoute, validateAndTransformQuery } from "@medusajs/framework/http"
import { createFindParams } from "@medusajs/medusa/api/utils/validators"

// Accepts: fields (fields/relations), offset, limit, order (ASC/DESC)
export const GetProductsSchema = createFindParams()

export const productListMiddlewares: MiddlewareRoute[] = [{
  matcher: "/store/products",
  method: "GET",
  middlewares: [
    validateAndTransformQuery(GetProductsSchema, {
      defaults: ["id", "title", "variants.*"],
      isList: true,
      defaultLimit: 15,
    }),
  ],
}]
```

| Option | Meaning |
|---|---|
| `defaults` | Default fields and relations to retrieve |
| `isList` | Whether the route returns a list (affects pagination); `false` for single-resource routes |
| `allowed` | Optional: fields/relations allowed in the `fields` query param |
| `defaultLimit` | Optional: default limit when none is given (default: 50) |

Custom params merge in: `createFindParams().merge(z.object({ category_id: z.string().optional(), discountable: z.preprocess((val) => val === "true", z.boolean().optional()) }))`,
read from `req.validatedQuery` and turned into `filters` on real columns or same-module relations
(`filters.categories = { id: category_id }` — products have a many-to-many `categories` relation, no
`category_id` column; `filters.discountable = discountable`).

### Step 2: Use Query Config in Route

Spread `...req.queryConfig` into the query. It is
`{ fields: string[], pagination: { skip, take?, order? }, withDeleted? }`. Don't also set `fields` —
the spread overwrites it and TypeScript reports it (TS2783, "specified more than once"). Adding
`filters` is fine.

```typescript
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const query: Omit<RemoteQueryFunction, symbol> = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data: products } = await query.graph({
    entity: "product",
    filters: { id: req.params.id }, // ✓ extra filters OK
    ...req.queryConfig,
    // ✗ fields: ["id", "title"] — type error
  })
  return res.json({ products })
}
```

### Step 3: Client Usage Examples

```
GET /store/products                                   → middleware defaults (id, title, variants.*)
GET /store/products?fields=id,title,description       → only those fields
GET /store/products?limit=10&offset=20                → 10 items, skipping 20
GET /store/products?order=title                       → title ascending
GET /store/products?order=-created_at                 → created_at descending ("-" prefix)
GET /store/products?fields=id,title,brand.*&limit=5&order=-created_at
```

## Import Organization

Import workflows, modules and other dependencies at the top of the file, never with dynamic
`await import(...)` inside the handler. Dynamic imports add overhead to every request, hurt
readability, break static analysis and TypeScript checking, and can cause module resolution issues
in production.

```typescript
import { createReviewWorkflow } from "../../../workflows/create-review" // ✓ top of file
// ✗ inside POST: const { createReviewWorkflow } = await import("../../../workflows/create-review")
```

## API Route Structure

Medusa uses only GET (reads), POST (create/update) and DELETE (deletions) by convention. Don't use
PUT or PATCH.

```typescript
// src/api/store/my-route/route.ts
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import type { RemoteQueryFunction } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { MyRouteSchema } from "./middlewares"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const query: Omit<RemoteQueryFunction, symbol> = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data: items } = await query.graph({ entity: "entity_name", fields: ["id", "name"] })
  return res.status(200).json({ items })
}

export async function POST(req: MedusaRequest<MyRouteSchema>, res: MedusaResponse) {
  // mutations always go through workflows
  const { result } = await myWorkflow(req.scope).run({ input: { field: req.validatedBody.field } })
  return res.status(200).json({ result })
}
```

Request data: `req.validatedBody` (from middleware), `req.query` (raw query params), `req.params`
(route params), `req.scope.resolve(...)` with a type annotation (services; see `type-container-resolve`).

## Error Handling

Throw `MedusaError` (`@medusajs/framework/utils`) for consistent error responses:

```typescript
throw new MedusaError(MedusaError.Types.NOT_FOUND, "Resource not found")
```

Types and their HTTP statuses: [error-handling.md](error-handling.md) (there is no `INVALID_STATE`;
`NOT_ALLOWED` is a 400, `FORBIDDEN` a 403). Medusa formats the response automatically:
`{ "type": "not_found", "message": "Resource not found" }`.

## Protected Routes

Protected by default:
- `/admin/*` — authenticated admin user
- `/store/customers/me/*` — authenticated customer

Protect other prefixes with the `authenticate` middleware:

```typescript
import { defineMiddlewares, authenticate } from "@medusajs/framework/http"

export default defineMiddlewares({
  routes: [
    { matcher: "/custom/admin*", middlewares: [authenticate("user", ["session", "bearer", "api-key"])] },
    { matcher: "/store/reviews*", middlewares: [authenticate("customer", ["session", "bearer"])] },
  ],
})
```

In routes protected by `authenticate`, type the request as `AuthenticatedMedusaRequest`; with
`MedusaRequest`, accessing `req.auth_context.actor_id` is a type error. `actor_id` is the admin user
ID on admin routes and the customer ID on customer routes; when a secret API key authenticated the
request, `auth_context.actor_type` is `"api-key"` and `actor_id` is the API key's ID.

```typescript
import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const actorId = req.auth_context.actor_id
}
```

Complete authentication patterns: [authentication.md](authentication.md).

## Using Workflows in API Routes

Workflows are the standard way to mutate (create, update, delete). Routes execute a workflow and
return its result. Built-in workflows exist for customers, products, orders, carts and more — ask
the `medusa` MCP for exact names and input parameters.

```typescript
import { createCustomersWorkflow } from "@medusajs/medusa/core-flows"

export async function POST(req: MedusaRequest<CreateCustomerSchema>, res: MedusaResponse) {
  const { result } = await createCustomersWorkflow(req.scope).run({
    input: { customersData: [{ email: req.validatedBody.email, has_account: false }] },
  })
  return res.json({ customer: result[0] })
}
```

Let workflow errors propagate: `.run()` rethrows the failing step's error with its `MedusaError`
type intact. Catch and re-type only where the route owns a contract that needs a specific code (see
[error-handling.md](error-handling.md)).

## API Route Organization

Organize by feature/domain, one folder per route with its `middlewares.ts`:

```
src/api/
├── admin/
│   ├── custom-reports/{route.ts, middlewares.ts}
│   └── bulk-operations/{route.ts, middlewares.ts}
└── store/
    ├── newsletter/{route.ts, middlewares.ts}
    └── reviews/
        ├── route.ts
        ├── [id]/route.ts
        └── middlewares.ts
```

## Common Patterns

### Pattern: List with Query Config (Recommended)

```typescript
// middlewares.ts (named MiddlewareRoute[] array): validateAndTransformQuery(createFindParams(), { defaults: ["id", "name", "created_at"], isList: true, defaultLimit: 15 })

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const query: Omit<RemoteQueryFunction, symbol> = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data, metadata } = await query.graph({ entity: "my_entity", ...req.queryConfig })
  return res.json({
    items: data,
    count: metadata.count,
    limit: req.queryConfig.pagination.take,
    offset: req.queryConfig.pagination.skip,
  })
}
```

### Other patterns

- Single resource with relations: query config still applies — `isList: false`, defaults such as
  `["id", "name", "variants.*", "brand.*"]`, `filters: { id: req.params.id }`, and pass
  `{ throwIfKeyNotFound: true }` as `query.graph`'s second argument (throws `NOT_FOUND` for an unknown
  id) instead of a manual empty-result check; return `data[0]`.
- Search + query config: merge `q` and `status` into `createFindParams()`; build
  `filters.name = { $like: \`%${q}%\` }` and `filters.status`; spread `...req.queryConfig` so the
  client still controls fields and pagination.
- Manual query: when client-controlled fields/pagination aren't needed, set `fields`, `filters` and
  `pagination` directly in `query.graph` (see [querying-data.md](querying-data.md)).
