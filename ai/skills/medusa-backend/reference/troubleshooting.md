# Troubleshooting Common Medusa Backend Issues

## Modules

**`AwilixResolutionError: Could not resolve 'blog'.`** (when resolving a custom module) — the module
isn't in `medusa-config.ts` (`modules: [{ resolve: "./src/modules/blog" }]`), the server wasn't
restarted, or the key doesn't match the name passed to `Module()`. Module names are camelCase
(`type-module-name-camelcase`). Add it and restart.

**`Error: Cannot find module './modules/blog'`** — wrong path or incomplete structure. Check for
`models/`, `service.ts` and `index.ts`, that `index.ts` exports the module correctly, and that the
path in `medusa-config.ts` matches the directory.

## API routes

**validatedBody is undefined** (`TypeError: Cannot read property 'email' of undefined`) — no
validation middleware ran for this route (missing, or its matcher/method doesn't match), so
`req.validatedBody` was never set. Add `validateAndTransformBody(MySchema)` for the route's matcher
and method in its `middlewares.ts`, and read `req.validatedBody` (typed via `MedusaRequest<MySchema>`),
not `req.body`.

**queryConfig is undefined** (`TypeError: Cannot spread undefined`) — `...req.queryConfig` used
without query config middleware. Add it to the feature's middleware array:

```typescript
import { MiddlewareRoute, validateAndTransformQuery } from "@medusajs/framework/http"
import { createFindParams } from "@medusajs/medusa/api/utils/validators"

export const GetMyItemsSchema = createFindParams()

export const myItemsMiddlewares: MiddlewareRoute[] = [{
  matcher: "/store/my-items",
  method: "GET",
  middlewares: [validateAndTransformQuery(GetMyItemsSchema, { defaults: ["id", "name"], isList: true })],
}]
```

**Unexpected 500 `unknown_error`** (`"An unknown error occurred."`) — a plain `Error` (no `type`)
was thrown; the error handler only maps `MedusaError` types to 4xx statuses. Throw
`new MedusaError(MedusaError.Types.NOT_FOUND, "Not found")` (import from `@medusajs/framework/utils`).
Status mapping: [error-handling.md](error-handling.md).

**Middleware not applying** (route not validated) — the matcher doesn't match or the middleware
isn't registered. `matcher: "/store/my-route"` is exact; `"/store/my-route*"` also matches
`/store/my-route/123`. The feature's middleware array must be exported and spread into
`src/api/middlewares.ts`.

## Authentication

**auth_context is undefined** (`TypeError: Cannot read property 'actor_id' of undefined`) — the
route is unprotected or the user isn't authenticated. `/admin/*` and `/store/customers/me/*` are
protected by default; for a custom prefix add the middleware:

```typescript
{ matcher: "/custom/admin*", middlewares: [authenticate("user", ["session", "bearer", "api-key"])] }
```

Only on optional-auth routes (`allowUnauthenticated: true`, which every `/store/*` route has by
default) is `req.auth_context?.actor_id` legitimately absent; there, handle the unauthenticated case
(see [authentication.md](authentication.md#pattern-optional-authentication)). On protected routes,
trust the middleware (`data-auth-middleware`).

## Debugging

- Debug logging: `LOG_LEVEL=debug medusa develop`
- To log values inside a workflow, log inside a `transform()` (the composition body runs at load
  time):

```typescript
import { createStep, createWorkflow, StepResponse, WorkflowResponse, transform } from "@medusajs/framework/workflows-sdk"

const step1 = createStep("step-1", async () => new StepResponse("Hello from step 1!"))

export const myWorkflow = createWorkflow("my-workflow", function () {
  const response = step1()
  const transformedMessage = transform({ response }, (data) => {
    const upperCase = data.response.toUpperCase()
    console.log("Transformed Data:", upperCase)
    return upperCase
  })
  return new WorkflowResponse({ response: transformedMessage })
})
```
