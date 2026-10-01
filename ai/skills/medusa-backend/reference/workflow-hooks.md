# Workflow Hooks (Advanced)

Hooks inject custom logic into existing Medusa workflows without recreating them. They run in-band
(synchronously within the workflow).

| Use a hook when | Use a subscriber when |
|-----------------|----------------------|
| The logic must complete before the workflow finishes | The logic can run in the background |
| You need rollback/compensation | You don't need to block the main workflow |
| The operation is critical to the workflow's success | Performance matters (hooks are synchronous; keep them lightweight) |

```typescript
// src/workflows/hooks/product-created.ts
import { createProductsWorkflow } from "@medusajs/medusa/core-flows"
import { StepResponse } from "@medusajs/framework/workflows-sdk"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import type { Link } from "@medusajs/framework/modules-sdk"

createProductsWorkflow.hooks.productsCreated(
  async ({ products, additional_data }, { container }) => {
    if (!additional_data?.brand_id) return new StepResponse([], []) // optional data missing: return early
    const link: Link = container.resolve(ContainerRegistrationKeys.LINK)
    const linkData = products.map((product) => ({
      product: { product_id: product.id },
      brand: { brand_id: additional_data.brand_id },
    }))
    await link.create(linkData)
    return new StepResponse(linkData, linkData) // always wrap the return in StepResponse
  },
  // compensation: runs if the workflow fails after this point
  async (linkData, { container }) => {
    const link: Link = container.resolve(ContainerRegistrationKeys.LINK)
    await link.dismiss(linkData)
  }
)
```

Common hooks: `createProductsWorkflow.hooks.productsCreated` (after products are created),
`createOrderWorkflow.hooks.orderCreated` (after an order is created). Ask the `medusa` MCP for
other hooks and their input parameters.
