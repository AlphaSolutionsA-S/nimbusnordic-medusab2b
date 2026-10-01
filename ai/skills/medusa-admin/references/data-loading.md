# Data Loading Principles and Patterns

SDK client setup, the pnpm install of `@tanstack/react-query`, why the SDK is required (headers), and the canonical display-vs-modal query example are in `SKILL.md`. Full widget with separate queries: [table-selection.md](table-selection.md).

## Fundamental rules

The rules are the `sdk-*` and `data-*` IDs in `SKILL.md`'s Quick Reference. One more: when you store
IDs or references (metadata or elsewhere), fetch the full entities to display them.

Before building a data widget, answer: what must be visible immediately; where is it stored (metadata, separate endpoint, related entities); how will stored IDs become full entities; which queries need invalidation after updates.

## SDK method selection

- Built-in endpoints: existing methods (`sdk.admin.product.list()`, `sdk.store.product.list()`, …) — typed, autocompleted. Docs: https://docs.medusajs.com/resources/medusa-js-sdk
- Custom routes: `sdk.client.fetch()`, which still adds the auth and API-key headers.

```tsx
import { sdk } from "../lib/client"
const product = await sdk.admin.product.retrieve(productId, { fields: "+metadata,+variants.*" })
const reviews = await sdk.client.fetch(`/admin/products/${productId}/reviews`)
```

## useQuery

```tsx
import { useQuery, keepPreviousData } from "@tanstack/react-query" // v5 (dashboard ships 5.x)

const { data, isLoading, error } = useQuery({
  queryFn: () => sdk.admin.product.retrieve(productId, { fields: "+metadata,+variants.*" }),
  queryKey: ["product", productId],
})

// Paginated + search (search is server-side via `q`)
const limit = 15
const offset = pagination.pageIndex * limit
useQuery({
  queryFn: () => sdk.admin.product.list({ limit, offset, q: searchTerm }),
  queryKey: ["products", limit, offset, searchTerm],
  placeholderData: keepPreviousData, // prevents UI flicker during pagination (v4's `keepPreviousData: true` no longer exists)
})

// Dependent query
useQuery({ queryFn: () => sdk.admin.product.retrieve(productId), queryKey: ["product", productId], enabled: !!productId })

// Display by stored IDs
useQuery({
  queryFn: async () => {
    if (selectedIds.length === 0) return { products: [] }
    return sdk.admin.product.list({ id: selectedIds, limit: selectedIds.length })
  },
  queryKey: ["related-products-display", selectedIds],
  enabled: selectedIds.length > 0,
})
```

Search with debounce (under pnpm the dashboard's own `lodash.debounce` is not importable; unless the project already has a debounce library, use a local hook):

```tsx
import { useEffect, useState } from "react"

const useDebouncedValue = <T,>(value: T, ms: number) => {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return debounced
}

const [search, setSearch] = useState("")
const debouncedSearch = useDebouncedValue(search, 300)
useQuery({ queryFn: () => sdk.admin.product.list({ q: debouncedSearch }), queryKey: ["products", debouncedSearch] })
```

## useMutation

```tsx
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "@medusajs/ui"

const queryClient = useQueryClient()
const updateProduct = useMutation({
  mutationFn: (payload) => sdk.admin.product.update(productId, payload),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["product", productId] })
    toast.success("Product updated successfully")
  },
  onError: (error) => toast.error(error.message || "Failed to update product"),
})

<Button onClick={handleSave} isLoading={updateProduct.isPending}>Save</Button>
```

Create/delete follow the same shape: `sdk.admin.product.create(data)` / `sdk.admin.product.delete(id)`, invalidate `["products"]`, toast, and close the modal (`setOpen(false)`) on create.

## Cache invalidation

- Invalidate the entity query if it stores the data (`["product", productId]`) and the display-specific queries (`["related-products", productId]`).
- Modal/selection queries (`["products-list"]`) typically need no invalidation.
- Use specific keys with IDs for targeted invalidation; include every dependency (search, pagination, …) in query keys.

## Metadata

- Stored as JSONB. Medusa doesn't merge nested objects: pass the entire object, spreading existing metadata.
- To remove a property, set it to an empty string (not null/undefined).

```tsx
updateProduct.mutate({ metadata: { ...product.metadata, new_field: "value" } }) // ✓
updateProduct.mutate({ metadata: { new_field: "value" } })                      // ✗ all other fields lost
```

## Troubleshooting

| Symptom | Cause / fix |
|---------|-------------|
| 401/403, "Missing x-publishable-api-key header", "Unauthorized" | Using plain `fetch()`; switch to SDK method or `sdk.client.fetch('/admin/custom-route')` |
| "No QueryClient set, use QueryClientProvider to set one" | pnpm: `@tanstack/react-query` not installed — install at the dashboard's exact version. Non-pnpm: it was incorrectly installed — remove it from package.json. Never add a QueryClientProvider |
| Search not filtering | Pass the value in queryFn: `sdk.admin.product.list({ q: searchValue })` |
| Metadata updates not working | Pass the complete object; remove fields with `""` |
| Widget not refreshing after mutation | Invalidate with the correct key; key includes all dependencies |
| Data empty on page refresh | Query has `enabled: modalOpen` or similar; never gate display data on UI state — keep conditional queries in modals/forms only |
