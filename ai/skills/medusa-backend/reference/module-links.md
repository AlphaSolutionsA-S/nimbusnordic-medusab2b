# Module Links

Links associate data models in different modules while keeping modules isolated and reusable —
e.g. brands on products, wishlists on customers, or one custom module to another.

## Checklist

Track these in your todo list:

1. Optional: add the linked ID to your custom data model
2. Define the link in `src/links/`
3. Configure list or delete-cascade options if needed
4. `medusa db:migrate` — never skip
5. Create links with `link.create()` or `createRemoteLinkStep`
6. Query linked data with `query.graph()`
7. Run the build to validate

## Optional: linked ID in the custom model

Only when the custom model belongs to or extends the linked model (one-to-one or one-to-many), e.g.
a review storing `customer_id: model.text()` and `product_id: model.text()`. Otherwise skip.

## 1. Define the link

One link definition per file in `src/links/`; exporting an array of links from one file doesn't
work. A model linked to several others gets several files (`review-product.ts`, `review-customer.ts`).

```typescript
// src/links/product-brand.ts
import { defineLink } from "@medusajs/framework/utils"
import ProductModule from "@medusajs/medusa/product"
import BrandModule from "../modules/brand"

export default defineLink(ProductModule.linkable.product, BrandModule.linkable.brand)
// ✗ export default [defineLink(…), defineLink(…)]
```

Medusa adds `.linkable` to every module automatically: use `ReviewModule.linkable.review`. Adding
`.linkable()` to a data model definition is unnecessary and causes errors.

Then run migrations (step 3) immediately.

## 2. Options

```typescript
// isList: many products can link to one brand (one-to-many)
defineLink({ linkable: ProductModule.linkable.product, isList: true }, BrandModule.linkable.brand)

// deleteCascade: delete links automatically when a record is deleted
defineLink(ProductModule.linkable.product, { linkable: BrandModule.linkable.brand, deleteCascade: true })

// extra columns on the link table
defineLink(ProductModule.linkable.product, BrandModule.linkable.brand, {
  database: { extraColumns: { featured: { type: "boolean", defaultValue: "false" } } },
})
```

## 3. Sync links (migrate)

```bash
medusa db:migrate
```

Links store relationships in their own tables, which `db:migrate` syncs; links need no
`db:generate` (that command only generates module migrations). Until you migrate, those tables don't exist and
every link operation or linked query fails at runtime. The usual mistake is using a link in a
workflow or query right after defining it.

## 4. Manage links

The module order in create/dismiss data must match the order in `defineLink()`; a mismatch is a
runtime error (link direction mismatch). For the definition above, product comes first.

In a workflow composition, use `createRemoteLinkStep` / `dismissRemoteLinkStep`:

```typescript
import { Modules } from "@medusajs/framework/utils"
import { createRemoteLinkStep, dismissRemoteLinkStep } from "@medusajs/medusa/core-flows"
import { createWorkflow, transform } from "@medusajs/framework/workflows-sdk"

const BRAND_MODULE = "brand"

export const myWorkflow = createWorkflow("my-workflow", function (input) {
  const linkData = transform({ input }, ({ input }) => [{
    [Modules.PRODUCT]: { product_id: input.product_id }, // product first, as in defineLink
    [BRAND_MODULE]: { brand_id: input.brand_id },
  }])
  createRemoteLinkStep(linkData) // or dismissRemoteLinkStep(linkData)
})
```

Outside workflows, or inside a step, use the `link` utility (same ordering rule):

```typescript
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import type { Link } from "@medusajs/framework/modules-sdk"

const link: Link = container.resolve(ContainerRegistrationKeys.LINK)
await link.create({
  [Modules.PRODUCT]: { product_id: "prod_123" },
  [BRAND_MODULE]: { brand_id: "brand_456" },
})
await link.dismiss({ /* same shape and order */ })

// with extra columns
await link.create({
  product: { product_id: "prod_123" },
  brand: { brand_id: "brand_456" },
  data: { featured: true },
})
```

## 5. Query linked data

`query.graph()` retrieves linked data but cannot filter by properties of a model in another module:

```typescript
const query: Omit<RemoteQueryFunction, symbol> = container.resolve(ContainerRegistrationKeys.QUERY)

await query.graph({ entity: "product", fields: ["id", "title", "brand.*"], filters: { id: "prod_123" } }) // ✓
await query.graph({ entity: "brand", fields: ["id", "name", "products.*"] })                               // ✓
await query.graph({ entity: "product", fields: ["id", "brand.*"], filters: { brand: { name: "Nike" } } }) // ✗ brand is another module
```

To filter by linked-module properties, use `query.index()` (Index Module):

```typescript
await query.index({ entity: "product", fields: ["*", "brand.*"], filters: { brand: { name: "Nike" } } })
```

Same-module relations (Product → ProductVariant) filter fine with `query.graph()`; separate-module
links (Product → Brand) need `query.index()`.

Index Module setup:
1. Install `@medusajs/index`
2. Add it to `medusa-config.ts`
3. Set `MEDUSA_FF_INDEX_ENGINE=true` in `.env`
4. `medusa db:migrate`
5. Mark properties `filterable` in the link definition:

```typescript
defineLink(
  { linkable: ProductModule.linkable.product, isList: true },
  { linkable: BrandModule.linkable.brand, filterable: ["id", "name"] }
)
```

Full details on both methods: [querying-data.md](querying-data.md) (querying linked data).
