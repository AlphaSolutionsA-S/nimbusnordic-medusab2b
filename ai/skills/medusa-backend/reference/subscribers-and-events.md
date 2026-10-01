# Subscribers and Events

Subscribers are async functions that run when an event is emitted, for non-blocking side effects after commerce operations (e.g. a confirmation email on `order.placed`).

## When to Use Subscribers

| Use a… | For |
|---|---|
| Subscriber (event-driven) | Reacting to events: confirmation emails, syncing to external systems on update, webhooks, analytics, other non-blocking side effects. E.g. react to `order.placed` and send an email. |
| [Scheduled job](scheduled-jobs.md) (polling) | Periodic tasks. E.g. find abandoned carts every 6 hours and email them. |
| Workflow | Operations that must block the main flow. |

Subscribers execute immediately; they can't schedule future work.

## Creating a Subscriber

A file in `src/subscribers/` with a default-export handler and a `config`:

```typescript
// src/subscribers/product-changes.ts
import { SubscriberArgs, type SubscriberConfig } from "@medusajs/framework"
import type { Logger } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

export default async function productChangesHandler({
  event: { eventName, data },   // eventName e.g. "product.created"; data usually { id: string }
  container,                    // MedusaContainer (DI)
}: SubscriberArgs<{ id: string }>) {
  const logger: Logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  logger.info(`Product event: ${eventName} for product ${data.id}`)
  switch (eventName) {
    case "product.created": /* … */ break
    case "product.updated": /* … */ break
    case "product.deleted": /* … */ break
  }
}

export const config: SubscriberConfig = {
  event: ["product.created", "product.updated", "product.deleted"], // or a single string: "order.placed"
}
```

## Common Commerce Events

| Domain | Events |
|---|---|
| Order | `order.placed`, `order.updated`, `order.canceled`, `order.completed`. For new orders subscribe to `order.placed` — `order.created` is not one of Medusa's order workflow events |
| Fulfillment | `shipment.created` (shipment created for an order fulfillment) |
| Product | `product.created`, `product.updated`, `product.deleted` |
| Customer | `customer.created`, `customer.updated` |
| Cart | `cart.created`, `cart.updated` |
| Auth | `auth.password_reset` (password reset requested) |
| Invite | `invite.created` (admin user invite) |

For the full list, ask the `medusa` MCP for the specific module's events.

## Accessing Event Data

Event `data` usually contains only the affected entity's ID. Retrieve the full entity with Query or the module service:

```typescript
// Query
const query: Omit<RemoteQueryFunction, symbol> = container.resolve(ContainerRegistrationKeys.QUERY)
const { data: orders } = await query.graph({
  entity: "order",
  fields: ["id", "email", "total", "customer.*", "items.*", "items.product.*"],
  filters: { id: data.id },
})
const order = orders[0]   // check for empty result before use

// Module service
const productModule: IProductModuleService = container.resolve(Modules.PRODUCT)
const product = await productModule.retrieveProduct(data.id, {
  select: ["id", "title", "status"],
  relations: ["variants"],
})
```

## Triggering Custom Events

Emit from a workflow with `emitEventStep`, then subscribe to the event name:

```typescript
// src/workflows/create-review/index.ts
import { emitEventStep } from "@medusajs/medusa/core-flows"
// … inside the composition function, after createReviewStep:
emitEventStep({
  eventName: "review.created",
  data: { id: review.id, product_id: input.product_id, rating: input.rating },
})

// src/subscribers/review-created.ts
export default async function reviewCreatedHandler({
  event: { data }, container,
}: SubscriberArgs<{ id: string; product_id: string; rating: number }>) {
  if (data.rating <= 2) {
    const notification: INotificationModuleService = container.resolve(Modules.NOTIFICATION)
    await notification.createNotifications({
      to: "support@example.com", template: "low-rating-alert", channel: "email",
      data: { review_id: data.id, product_id: data.product_id, rating: data.rating },
    })
  }
}
export const config: SubscriberConfig = { event: "review.created" }
```

## Best Practices

These apply to subscribers and to [scheduled jobs](scheduled-jobs.md).

1. Log start, success and failure via the logger (`Logger` ← `ContainerRegistrationKeys.LOGGER`).
2. Handle errors gracefully: wrap the body in `try/catch`, log the error, and don't throw. Subscribers run asynchronously and don't block the main flow. Catching means the event bus treats the subscriber as done and never retries it. Retries happen only on the Redis event bus, only when `attempts` > 1 (set per emit or in the module's job options; default 1), and only for subscribers that threw — so let the error propagate when you want that retry.
3. Keep subscribers fast. For long-running work, queue it for background processing, use a scheduled job, or break it into smaller steps. Creating a notification (which queues the email) is a quick operation.
4. Do mutations through a workflow: `await myWorkflow(container).run({ input: { product_id: data.id } })`, inside the `try/catch`.
5. Avoid infinite event loops. A `product.updated` handler that updates the product emits another `product.updated`. Add a guard: read the current state first and only update when needed (e.g. skip if `product.metadata?.processed` is already set), and make the update itself through a workflow (e.g. `updateProductsWorkflow` from `@medusajs/medusa/core-flows`), not a direct module-service call.
6. Make subscribers idempotent: they may be called more than once for the same event. For custom logic that isn't idempotent on its own, check state first, then act, then mark done:
   ```typescript
   if (await myService.isOrderProcessed(data.id)) {
     logger.info(`Order ${data.id} already processed, skipping`)
     return
   }
   await myService.processOrder(data.id)
   await myService.markOrderAsProcessed(data.id)
   ```
   This check-then-act pattern is not a template for every subscriber: around an OOTB core workflow or step, add a pre-check only as Tier 0 `medusa-boundary.md` ("OOTB first") allows; a redundant `query.graph` pre-check only adds a round-trip.

## Complete Example: Order Confirmation Email

```typescript
// src/subscribers/order-placed.ts
import { SubscriberArgs, type SubscriberConfig } from "@medusajs/framework"
import type { Logger, RemoteQueryFunction, INotificationModuleService } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

export default async function sendOrderConfirmationEmail({
  event: { data }, container,
}: SubscriberArgs<{ id: string }>) {
  const logger: Logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  try {
    const query: Omit<RemoteQueryFunction, symbol> = container.resolve(ContainerRegistrationKeys.QUERY)
    const { data: orders } = await query.graph({
      entity: "order",
      fields: ["id", "display_id", "email", "total", "currency_code",
        "customer.first_name", "customer.last_name", "items.*", "items.product.title", "shipping_address.*"],
      filters: { id: data.id },
    })
    if (!orders?.length) {
      logger.error(`Order ${data.id} not found`)
      return
    }
    const order = orders[0]
    const notification: INotificationModuleService = container.resolve(Modules.NOTIFICATION)
    await notification.createNotifications({
      to: order.email,
      template: "order-confirmation",
      channel: "email",
      data: {
        order_id: order.display_id,
        customer_name: `${order.customer.first_name} ${order.customer.last_name}`,
        items: order.items, total: order.total, currency: order.currency_code,
        shipping_address: order.shipping_address,
      },
    })
    logger.info(`Order confirmation email sent to ${order.email}`)
  } catch (error) {
    logger.error(`Failed to send order confirmation for ${data.id}: ${error.message}`)
  }
}

export const config: SubscriberConfig = { event: "order.placed" }
```
