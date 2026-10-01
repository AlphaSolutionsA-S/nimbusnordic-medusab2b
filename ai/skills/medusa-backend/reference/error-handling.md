# Error Handling in Medusa

Throw `MedusaError` from API routes, workflows and modules; Medusa's error handler maps its type to
an HTTP status and a consistent body. A plain `Error` has no type, so it becomes a 500 with
`{ "code": "unknown_error", "type": "unknown_error", "message": "An unknown error occurred." }` —
always use a specific `MedusaError` type.

```typescript
import { MedusaError } from "@medusajs/framework/utils"

throw new MedusaError(MedusaError.Types.NOT_FOUND, `Product with ID '${id}' not found`)
// → 404 { "type": "not_found", "message": "Product with ID 'prod_123' not found" }
```

| Type | HTTP | Use when |
|------|------|----------|
| `NOT_FOUND` | 404 | The requested resource doesn't exist |
| `INVALID_DATA` | 400 | Request data fails validation or is malformed |
| `UNAUTHORIZED` | 401 | Authentication is required but not provided |
| `FORBIDDEN` | 403 | Authenticated, but lacking permission |
| `NOT_ALLOWED` | 400 | The operation isn't allowed, e.g. the resource is in the wrong state (cancelling a fulfilled order) — core-flows uses it this way |
| `CONFLICT` | 409 | Concurrent-request conflicts; the handler replaces your message with a generic "retry with the Idempotency-Key" message, so don't use it for "already exists" |
| `DUPLICATE_ERROR` | 422 | Creating a duplicate resource (e.g. email already registered) |

There is no `INVALID_STATE` type. Zod validation failures from the validation middleware become 400
`invalid_data`.

## Practices

- Messages say what went wrong and include context such as the ID or field value:
  `"Cannot create product: title must be at least 3 characters long"`, not `"Invalid input"`.
- Let workflow errors propagate from the route. `workflow(container).run()` rethrows the failing
  step's error with its `type` intact, so a step's `NOT_FOUND` stays a 404. Don't wrap every workflow
  call in a `catch` that rethrows as `INVALID_DATA`: that turns every failure into a 400. Catch and
  re-type only at a route that owns an API contract needing a specific code.
- Leave input validation to middleware (`validateAndTransformBody(MySchema)` with Zod messages such
  as `z.string().email("Invalid email address")`); the route types the request as
  `MedusaRequest<MySchema>` and reads `req.validatedBody` without validating again.
