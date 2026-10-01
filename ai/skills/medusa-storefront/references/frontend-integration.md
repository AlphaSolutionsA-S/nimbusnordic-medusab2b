# Frontend SDK Integration

## Contents
- [Frontend SDK Pattern](#frontend-sdk-pattern)
  - [Locating the SDK](#locating-the-sdk)
  - [Using sdk.client.fetch()](#using-sdkclientfetch)
  - [What the SDK does to a request](#what-the-sdk-does-to-a-request)
- [React Query Pattern](#react-query-pattern)
- [Query Key Best Practices](#query-key-best-practices)
- [Error Handling](#error-handling)
- [Optimistic Updates](#optimistic-updates)

Calling Medusa API routes ("endpoints"; the terms are interchangeable) from a frontend with the
Medusa SDK and React Query.

## Frontend SDK Pattern

### Locating the SDK

Never hardcode the SDK import path. Find where `@medusajs/js-sdk` is instantiated in the project;
the instance is usually exported as `sdk`, but a project may name it otherwise and keep it
`server-only` beside a cached GET wrapper (`project.md` says where). The examples below say `sdk`.

### Using sdk.client.fetch()

The rules (`sdk-always-use`, `sdk-existing-methods`, `sdk-client-fetch`, `sdk-required-headers`,
`sdk-no-json-stringify`, `sdk-plain-objects`) are in `SKILL.md`. Built-in SDK methods give better
type safety and autocomplete than `sdk.client.fetch` on the same route.

```typescript
import { sdk } from "[LOCATE SDK INSTANCE IN PROJECT]"

// ✓
const products = await sdk.store.product.list({ limit: 10, offset: 0 })
const reviews = await sdk.client.fetch("/store/products/prod_123/reviews")
await sdk.client.fetch("/store/my-route", {
  method: "POST",
  body: { email: "user@example.com", name: "John Doe" },
})

// ✗ plain fetch: missing publishable API key header
await fetch("http://localhost:9000/store/products")
// ✗ sdk.client.fetch for a built-in route that has an SDK method: less type-safe
await sdk.client.fetch("/store/products")
// ✗ stringified body
await sdk.client.fetch("/store/my-route", { method: "POST", body: JSON.stringify({ email }) })
```

### What the SDK does to a request

Verified in `@medusajs/js-sdk` 2.17.2 (`dist/client.js`):

- Default headers include `content-type: application/json` and, when `publishableKey` is
  configured, `x-publishable-api-key`. When the content type is JSON the SDK runs
  `JSON.stringify(body)` itself, which is why a pre-stringified body is double-encoded.
- `query` accepts an object; the SDK encodes it with `qs` (`skipNulls: true`) and merges it with
  any query string already in the path.
- Auth: an `apiKey` becomes `Authorization: Basic …`; JWT auth sends `Authorization: Bearer
  <token>`; session auth sets `credentials: "include"` (or `auth.fetchCredentials`), other modes
  `"omit"`.
- Other fetch init fields (`signal`, Next.js `next: { revalidate, tags }`) pass through to the
  underlying `fetch`.

## React Query Pattern

A Next.js App Router storefront that reads in Server Components and writes through server actions
does not need React Query. Use this section and the ones below when building a client-side query
layer. The examples use the TanStack Query v5 API (`isPending` on mutations).

`useQuery` for GET, `useMutation` for POST/DELETE, invalidate related queries on success.

```typescript
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"

function MyComponent({ userId }: { userId: string }) {
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ["my-data", userId],
    queryFn: () => sdk.client.fetch(`/store/my-route?userId=${userId}`),
    enabled: !!userId,
  })

  const mutation = useMutation({
    mutationFn: (input: { email: string }) =>
      sdk.client.fetch("/store/my-route", { method: "POST", body: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["my-data"] }),
  })

  if (isLoading) return <p>Loading...</p>
  return (
    <div>
      <p>{data?.title}</p>
      <button onClick={() => mutation.mutate({ email: "test@example.com" })} disabled={mutation.isPending}>
        {mutation.isPending ? "Loading..." : "Submit"}
      </button>
      {mutation.isError && <p>Error occurred</p>}
    </div>
  )
}
```

Key states: `isLoading`, `isPending`, `isSuccess`, `isError`, `error`.

## Query Key Best Practices

```typescript
queryKey: ["products", productId]
queryKey: ["products", "list", { page, filters }]

queryClient.invalidateQueries({ queryKey: ["products"] })            // all product queries
queryClient.invalidateQueries({ queryKey: ["products", productId] }) // one product
```

## Error Handling

```typescript
const mutation = useMutation({
  mutationFn: (input) => sdk.client.fetch("/store/my-route", { method: "POST", body: input }),
  onError: (error) => {
    console.error("Mutation failed:", error)
    // show error message to user
  },
})

{mutation.isError && <p className="error">{mutation.error?.message || "An error occurred"}</p>}
```

## Optimistic Updates

```typescript
const mutation = useMutation({
  mutationFn: (newItem) => sdk.client.fetch("/store/items", { method: "POST", body: newItem }),
  onMutate: async (newItem) => {
    await queryClient.cancelQueries({ queryKey: ["items"] })       // cancel outgoing refetches
    const previousItems = queryClient.getQueryData(["items"])      // snapshot
    queryClient.setQueryData(["items"], (old) => [...old, newItem])
    return { previousItems }
  },
  onError: (err, newItem, context) => {
    queryClient.setQueryData(["items"], context.previousItems)     // rollback
  },
  onSettled: () => queryClient.invalidateQueries({ queryKey: ["items"] }),
})
```
