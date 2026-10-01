# Querying Data in Medusa

`query.graph()` is the primary way to read data, especially across modules.

## Contents
- [When to Use Query vs Module Services](#when-to-use-query-vs-module-services)
- [Basic Query Structure](#basic-query-structure)
- [In Workflows vs Outside Workflows](#in-workflows-vs-outside-workflows)
- [Field Selection](#field-selection) — includes silent-`undefined` traps and computed fields
- [Core Read Workflows](#core-read-workflows) — read this before `query.graph()` on a core entity
- [Filtering](#filtering)
- [Important Filtering Limitation](#important-filtering-limitation)
- [Pagination](#pagination)
- [Querying Linked Data](#querying-linked-data) — `query.graph()` vs `query.index()`
- [Validation with throwIfKeyNotFound](#validation-with-throwifkeynotfound)
- [Performance Best Practices](#performance-best-practices)
- [Common Patterns](#common-patterns)

## When to Use Query vs Module Services

| Use Query (`query.graph`) | Use module services |
|---|---|
| Data across modules (products with linked brands, orders with customers) | Data within one module (products with variants) |
| Reading entities with links or several relations | `listAndCount` pagination within one module |
| Storefront and admin data retrieval | Mutations — always module services or workflows |

```typescript
await query.graph({ entity: "product", fields: ["id", "title", "brand.*"] }) // brand: other module
const [products, count] = await productService.listAndCountProducts(
  { status: "active" }, { take: 10, skip: 0 }
)
```

## Basic Query Structure

```typescript
const query: Omit<RemoteQueryFunction, symbol> = req.scope.resolve(ContainerRegistrationKeys.QUERY)
const { data, metadata } = await query.graph({
  entity: "entity_name",
  fields: ["id", "name"],
  filters: { status: "active" },
  pagination: { take: 10, skip: 0 }, // optional
})
```

## In Workflows vs Outside Workflows

- API routes resolve Query from `req.scope`, subscribers / scheduled jobs from `container`: `const query: Omit<RemoteQueryFunction, symbol> = container.resolve(ContainerRegistrationKeys.QUERY)` (`RemoteQueryFunction` from `@medusajs/framework/types`).
- Inside a workflow composition function use `useQueryGraphStep` (same arguments as `query.graph`):

```typescript
import { useQueryGraphStep } from "@medusajs/medusa/core-flows"

const { data: products } = useQueryGraphStep({
  entity: "product",
  fields: ["id", "title"],
  filters: { id: input.product_id },
})
```

## Field Selection

Dot notation selects relations: `"variants.*"` (all fields), `"variants.sku"` (one field).

### Order line items: use `items.detail.quantity`, never `items.quantity`

A selected field can silently resolve to `undefined` instead of erroring. On orders, `quantity`
lives on the `OrderItem` join entity. Selecting `items.quantity` alongside any other explicit item
field is rewritten to `items.item.quantity`, which reads `OrderLineItem` — which has no such column —
and yields `undefined` rather than throwing
([medusajs/medusa#16578](https://github.com/medusajs/medusa/issues/16578)).

```typescript
fields: ["id", "items.id", "items.title", "items.quantity"]        // ✗ quantity undefined on every item
fields: ["id", "items.id", "items.title", "items.detail.quantity"] // ✓ maps onto OrderItem
```

This once shipped twice in one project (a whole-order fulfillment default, and a daily purchase-limit
check that consequently summed to zero). Both times the unit test mocked `query.graph` with the flat
shape the code expected, so it passed either way.

Never assume a selection's result shape; verify it once and mock only the verified shape (Tier 0
`medusa-boundary.md`, "Verify, don't assume"). A mock built from the same assumption as the code
cannot falsify it.

### The category behind it: computed fields, and where they are computed

Many core fields are declared in a module's remote-query schema but absent from its model, and are
populated after the fetch. Absence from the model is not by itself the problem — `order.total` has
no column and resolves fine. What decides whether `query.graph()` sees the value is where the
computation lives:

| Case | Via `query.graph()`? | Example |
|---|---|---|
| Computed inside the module service | Yes — `query.graph` routes through the service, which detects the requested field and loads what it needs | `order.total` (`shouldIncludeTotals` in `order-module-service.js` pulls in `items`, `shipping_methods`, … and calls `decorateCartTotals`) |
| Computed outside the module, in a `@medusajs/core-flows` workflow | Never — no selection can reach it | `order.payment_status`, `order.fulfillment_status` |
| Computed in the module but reached by the wrong path | Silent `undefined` | `items.quantity` → use `items.detail.quantity` |

Only the middle row forces you to a workflow; the third is a selection bug you fix in place.

Line-item mechanism, in `@medusajs/order/dist/utils/transform-order.js`:

```js
// formatOrder() — runs after the fetch
return {
  ...orderItem.item,                  // the OrderLineItem columns
  quantity: detail.quantity,          // hoisted from OrderItem
  raw_quantity: detail.raw_quantity,
  detail,
}
```

`OrderLineItem` has no quantity column; the value exists only because `formatOrder` copies it up
from `detail`, so there is nothing to hoist unless the detail's column was loaded.

`order.payment_status` / `order.fulfillment_status` are the same pattern one level up: declared on
`OrderDetail` in the schema, backed by no column, computed post-fetch by `getLastPaymentStatus` /
`getLastFulfillmentStatus` inside the core read workflows. Read off a raw `query.graph` row they are
`not_paid` / `not_fulfilled` on every order, forever.

How to tell before you ship:

| Check | Where | Meaning |
|---|---|---|
| Field on the model? | `@medusajs/<module>/dist/models/*.js` — the `model.define(...)` block | Real column — always safe |
| If not, does the module service mention it? | `@medusajs/<module>/dist/services/*.js` | Computed in-module → `query.graph` gets it |
| Assigned in a core-flows workflow? | `@medusajs/core-flows/dist/**/workflows/*.js` — a `transform()` writing `order_.<field> = …` | Unreachable via `query.graph` → use the workflow |
| Hoisted by a transform from a relation? | `@medusajs/<module>/dist/utils/transform-*.js` | Select what the transform reads, not the hoisted name |

Presence in the generated types is not evidence: `.medusa/types/query-entry-points.d.ts` lists all
of these exactly like real columns. When the computation happens outside the module, read through
the workflow that performs it (see [Core Read Workflows](#core-read-workflows)).

Reading these files under pnpm (a plain `grep -r` searches nothing): see the installed-source
recipe in [medusa-boundary.md](medusa-boundary.md#verify-dont-assume).

## Core Read Workflows

For core entities, check whether Medusa ships a read workflow before writing `query.graph()`. They
exist because some fields cannot be selected:

| Workflow | Replaces |
|---|---|
| `getOrderDetailWorkflow` | `query.graph({ entity: "order", filters: { id } })` |
| `getOrdersListWorkflow` | `query.graph({ entity: "order", ... })` for lists |

Both are documented for use in custom API routes (the reference page's own example is a custom
route), and both accept a `fields` array passed straight to Query, so linked-module fields (your own
models linked to the order) work exactly as with `query.graph`.

```typescript
import { getOrderDetailWorkflow } from "@medusajs/medusa/core-flows"

const { result } = await getOrderDetailWorkflow(req.scope).run({
  input: { order_id: id, fields: ["id", "status", "my_custom_link.some_field"] },
})
// result.payment_status / result.fulfillment_status are populated here — not selectable via query.graph
```

Why not call the helpers yourself: `getLastPaymentStatus` / `getLastFulfillmentStatus` are public
exports, but calling them on a `query.graph` row means supplying their inputs, i.e. hand-maintaining
a copy of a field list that lives upstream next to the consuming function. When the copy drifts, the
getter reads the missing field as absent and returns `not_paid` — silently. The workflows append
their own inputs via `deduplicate([...fields, ...])`, so the list stays Medusa's problem.

What the workflows do not supply: they append inputs for their own computation only.
`getOrderDetailWorkflow` appends `payment_collections.*` and `fulfillments.*` but no items;
`getOrdersListWorkflow` appends `items.*`, which does not expand the `detail` relation. So the
partial-fulfilment inputs (`items.detail.raw_quantity`, `items.detail.raw_fulfilled_quantity`) stay
caller-side — core's own admin routes supply them from their query-config, not from the workflow.
Check what the workflow appends before assuming a field is covered.

Caveats:
- `getOrderDetailWorkflow` queries with `throwIfKeyNotFound`, so an unknown id throws
  (`MedusaError.Types.NOT_FOUND`) instead of returning empty. Map it to your own error shape if you
  have one.
- `getOrdersListWorkflow` takes filters and pagination in `variables`
  (`{ filters: {...}, take, skip, order }`), not top-level `filters`/`pagination`, and returns
  `{ rows, metadata }` when paginated.
- Fields computed post-fetch cannot be DB filters — they are not columns. Filter on a real column to
  narrow, then match the computed value in memory.

## Filtering

```typescript
filters: {
  email: "user@example.com",                 // exact match
  id: ["id1", "id2"],                        // IN
  created_at: { $gte: startDate, $lte: endDate },
  name: { $like: "%search%" },               // contains; "search%" starts with, "%search" ends with
  status: { $ne: "deleted" },
}
```

Filter on same-module relations with object notation:

```typescript
// Product and ProductVariant are both in the Product Module
await query.graph({
  entity: "product",
  fields: ["id", "title", "variants.*"],
  filters: { variants: { sku: "ABC1234" } }, // operators work too, e.g. { sku: { $like: "ABC%" } }. Stock is not a variant column (it lives in the Inventory Module)
})
```

## Important Filtering Limitation

`query.graph()` cannot filter by fields of linked data models in other modules; it filters only on
models within the queried entity's module.

- Same module (filterable with `query.graph()`): Product/ProductVariant, Order/LineItem, Cart/CartItem.
- Different modules (not filterable with `query.graph()`): Product/Brand (custom), Product/Customer,
  Review/Product. These are filterable with `query.index()`.

```typescript
// ✗ Neither form works with query.graph() — brand is in another module
filters: { "brand.name": "Nike" }
filters: { brand: { name: "Nike" } }
```

Solutions, in order of preference:

| # | Approach | When | Notes |
|---|---|---|---|
| 1 | `query.index()` (Index Module) | Recommended | DB-level filtering, proper pagination, fetches only what you need. Needs the Index Module installed and `filterable` on the link — see [Querying Linked Data](#querying-linked-data) |
| 2 | Query from the other side with `query.graph()` | No Index Module, or the other side is the logical primary entity, or you need a quick fix without setup | Still DB filtering |
| 3 | Fetch, then filter in JavaScript | Last resort: very small datasets (< 100 records), no Index Module, other side makes no sense, or temporary | Fetches unneeded data, no DB-level pagination, more memory and bandwidth |

```typescript
// 1. query.index()
await query.index({ entity: "product", fields: ["*", "brand.*"], filters: { brand: { name: "Nike" } } })

// 2. From the other side
const { data: brands } = await query.graph({
  entity: "brand", fields: ["id", "name", "products.*"], filters: { name: "Nike" },
})
const nikeProducts = brands[0]?.products || []

// Reviews example: approved reviews of one product — query reviews directly
await query.graph({
  entity: "review",
  fields: ["id", "rating", "comment", "product.*"],
  filters: { product_id: productId, status: "approved" },
})
// Reviews of active products from the product side: filter products by status, then
// products.flatMap(p => p.reviews)

// 3. In JS (last resort)
const nike = products.filter(p => p.brand?.name === "Nike")
```

## Pagination

```typescript
const { data, metadata } = await query.graph({
  entity: "product",
  fields: ["id", "title", "created_at"],
  pagination: {
    skip: 0,  // offset
    take: 10, // limit
    order: { status: "ASC", created_at: "DESC" }, // one or more fields
  },
})
metadata.count // total count
```

## Querying Linked Data

For entities linked via [module links](module-links.md):

| Need | Use |
|---|---|
| Retrieve linked data; filter only on the primary entity's module (incl. same-module relations such as `product.variants`) | `query.graph()` — faster, simpler, enough for most queries |
| Filter by properties of a linked model in a different module (product → brand, product → review ratings, customer → custom loyalty tier) | `query.index()` — requires Index Module setup and `filterable` properties |

### Option 1: query.graph() - Retrieve Linked Data Without Cross-Module Filters

```typescript
const { data: products } = await query.graph({
  entity: "product",
  fields: ["id", "title", "brand.*"],
  filters: { id: "prod_123" }, // product's own module
})
products[0].brand.name

// Reverse direction: brands with their linked products
await query.graph({ entity: "brand", fields: ["id", "name", "products.*"] })
```

### Option 2: query.index() - Filter Across Linked Modules (Index Module)

Setup:
1. Install `@medusajs/index` with the project's package manager.
2. Register in `medusa-config.ts`: `modules: [{ resolve: "@medusajs/index" }]` inside `defineConfig`.
3. Enable the feature flag in `.env`: `MEDUSA_FF_INDEX_ENGINE=true`
4. Run migrations: `medusa db:migrate`
5. Mark linked properties as filterable in the link definition — `filterable` lists the fields
   queryable across modules:
   ```typescript
   // src/links/product-brand.ts
   defineLink(
     { linkable: ProductModule.linkable.product, isList: true },
     { linkable: BrandModule.linkable.brand, filterable: ["id", "name"] }
   )
   ```
6. Start the application to trigger data ingestion into the Index Module.

`query.index()` takes the same shape as `query.graph()`, including `pagination` and operators:

```typescript
await query.index({
  entity: "product",
  fields: ["id", "title", "reviews.*"],
  filters: {
    reviews: { rating: { $gte: 4 } },
    status: { $ne: "deleted" },
  },
  pagination: { take: 20, skip: 0 },
})
```

Notes:
- The Index Module pre-ingests data on startup, which is what makes cross-module filtering efficient.
- Data syncs automatically, but there may be a brief delay after mutations.
- If you don't need cross-module filtering, `query.graph()` is sufficient; always use it for
  same-module relations (product → variants, order → line items).

## Validation with throwIfKeyNotFound

Pass `throwIfKeyNotFound: true` to throw when the filtered record doesn't exist — use it before
updating/deleting, or whenever the record must exist, instead of a manual empty-result check.

```typescript
// Outside workflows: second argument
const { data } = await query.graph(
  { entity: "product", fields: ["id", "title"], filters: { id: productId } },
  { throwIfKeyNotFound: true }
)
const product = data[0] // exists

// In workflows
useQueryGraphStep({
  entity: "product",
  fields: ["id", "title"],
  filters: { id: input.product_id },
  options: { throwIfKeyNotFound: true },
})
```

## Performance Best Practices

- Select only the fields and relations you use; avoid `"*"` and whole relations like `"product.*"`
  when you need two fields (`["id", "title", "product.id", "product.title"]`).
- There is no hard limit on relation depth, but deeper is slower. Skip circular paths
  (`variants.product.*`) and whole nested relations you don't need; select leaf fields
  (`variants.prices.amount`, `variants.prices.currency_code`).
- Paginate large result sets (e.g. `take: 50`) rather than fetching thousands at once.
- Filter early so filters shrink the result set before fields and relations are retrieved.
- Use separate queries per use case: minimal fields for listings, fuller fields for detail pages.

## Common Patterns

Route handlers typically combine the above with request query config (see
[api-routes.md](api-routes.md#request-query-config-for-list-endpoints)):

```typescript
// List with search
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const query: Omit<RemoteQueryFunction, symbol> = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { q } = req.validatedQuery
  const filters: Record<string, unknown> = {}
  if (q) filters.title = { $like: `%${q}%` }

  const { data: products } = await query.graph({
    entity: "product",
    filters,
    ...req.queryConfig, // fields come from the middleware defaults, e.g. ["id", "title", "thumbnail"]
  })
  return res.json({ products })
}
```

- Retrieve one: filter `{ id: req.params.id }` with `throwIfKeyNotFound: true` (throws 404), return `data[0]`.
- Count: select `["id"]` only and return `metadata.count`.
- Recent items: `pagination: { take: 10, skip: 0, order: { created_at: "DESC" } }`.
