# Scheduled Jobs

Scheduled jobs are async functions that run automatically at set intervals while the Medusa application runs.

## When to Use Scheduled Jobs

Use them for periodic work: syncing with third-party services on a schedule, periodic reports (daily, weekly), cleaning up stale data (expired carts, old sessions), batch exports, recalculating aggregates.

Don't use them for:
- reacting to events: use [subscribers](subscribers-and-events.md) (e.g. react to `order.placed` and send an email). For most event-reaction cases subscribers are preferred.
- one-time tasks: run workflows directly.
- real-time processing: use API routes + workflows.

Polling example: find carts updated more than 24h ago and email them.

## Creating a Scheduled Job

A file in `src/jobs/` exporting a default function that receives the container, plus a `config`:

```typescript
// src/jobs/send-weekly-newsletter.ts
import type { Logger, MedusaContainer, RemoteQueryFunction } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { sendNewsletterWorkflow } from "../workflows/send-newsletter"

export default async function sendNewsletterJob(container: MedusaContainer) {
  const logger: Logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query: Omit<RemoteQueryFunction, symbol> = container.resolve(ContainerRegistrationKeys.QUERY)
  const startTime = Date.now()
  try {
    const { data: customers } = await query.graph({
      entity: "customer",
      fields: ["id", "email"],
      filters: { has_account: true }, // filter on a real column (Customer has no newsletter flag)
    })
    await sendNewsletterWorkflow(container).run({
      input: { customer_ids: customers.map((c) => c.id) },
    })
    logger.info(`Newsletter sent to ${customers.length} subscribers in ${Date.now() - startTime}ms`)
  } catch (error) {
    logger.error(`Newsletter job failed: ${error.message}`, { error })
    // don't throw: the job completes and runs again on the next schedule
  }
}

export const config = {
  name: "send-weekly-newsletter", // required: unique across the application
  schedule: "0 0 * * 0",          // required: cron expression (every Sunday at midnight)
  // numberOfExecutions: 3,       // optional: max number of scheduled runs
}
```

## Configuration Options

| Property | Required | Meaning |
|---|---|---|
| `name` | yes | Unique identifier for the job across the application |
| `schedule` | yes | Cron expression for when to run |
| `numberOfExecutions` | no | Max number of times the job runs on its schedule |

`numberOfExecutions` doesn't make the job run on server start. The job waits for its first scheduled time, and after the limit is reached it stops permanently. For example, `numberOfExecutions: 1` with a daily schedule runs once, at the next midnight. To test a job, use a frequent schedule with a limit:

```typescript
// ✗ { schedule: "0 0 * * *", numberOfExecutions: 1 }    // runs once at next midnight, not now
// ✓ { schedule: "* * * * *", numberOfExecutions: 1 }    // runs once at the next minute
// ✓ { schedule: "*/5 * * * *", numberOfExecutions: 3 }  // runs at 0, 5, 10 min, then stops
```

## Jobs, routes and the event hop

The home of `arch-job-runs-workflow` and `arch-route-emits-long-work`. Do mutations through
workflows, for proper error handling and rollback.

- A job runs its workflow directly with `myWorkflow(container).run({ input })`. It does not emit an
  event for a subscriber to run it: a job already runs off the request path, so that hop adds
  indirection, hides the schedule→work link, and buys nothing.
- The event → subscriber → workflow hop exists only for API routes, which must return a fast HTTP
  response and can't block on long work. A route whose work cannot finish within the request emits
  the event (never `setImmediate` or an unawaited call); an admin route that triggers a long-running
  sync or batch emits and returns 202. Every other route runs its workflow and awaits the result
  (`arch-workflow-required`).
- A job and a sync-trigger route share one orchestration workflow. Multi-phase work (batching, error
  collection, sync-status tracking such as `markSyncStarted` / `markSyncCompleted` /
  `markSyncCompletedWithErrors`) belongs in that workflow, not in the job or subscriber. The job gets
  a predictable synchronous run, the trigger a non-blocking 202.
- A job or subscriber that must not overlap takes the single-run lock around the run
  (`lock-single-run`, Tier 0 `boundaries.md`).

```typescript
// ✓ job
export default async function nightlyDataSync(container: MedusaContainer) {
  await syncDataOrchestrationWorkflow(container).run({ input: {} })
}
// ✓ sync-trigger route; a subscriber on "data-sync.requested" runs the same workflow
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const eventBus: IEventBusModuleService = req.scope.resolve(Modules.EVENT_BUS)
  await eventBus.emit({ name: "data-sync.requested", data: { operationType: OPERATION_TYPES.FULL } })
  res.status(202).json({ status: "triggered" })
}
// ✗ await container.resolve(Modules.EVENT_BUS).emit({ name: "my-job.requested", data: {} })  // in a job
// ✗ a job with 100+ lines of batching; ✗ a sync-trigger route awaiting the sync workflow
```

When processing items one by one, wrap each workflow run in its own `try/catch` so one failure doesn't stop the rest:

```typescript
// src/jobs/send-abandoned-cart-emails.ts — schedule "0 */6 * * *"
const { data: carts } = await query.graph({
  entity: "cart",
  fields: ["id", "email", "customer_id"],
  filters: {
    updated_at: { $lte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    completed_at: null,
    email: { $ne: null },
  },
})
for (const cart of carts) {
  try {
    await sendAbandonedCartEmailWorkflow(container).run({ input: { cart_id: cart.id, email: cart.email } })
  } catch (error) {
    logger.error(`Failed to send email for cart ${cart.id}: ${error.message}`) // continue with other carts
  }
}
```

## Cron Expression Examples

Format: `minute hour day-of-month month day-of-week`. Validate with [crontab.guru](https://crontab.guru).

| Schedule | Meaning |
|---|---|
| `* * * * *` | every minute |
| `*/5 * * * *` | every 5 minutes |
| `0 * * * *` | every hour at minute 0 |
| `0 */6 * * *` | every 6 hours |
| `0 0 * * *` | every day at midnight |
| `30 2 * * *` | every day at 2:30 AM |
| `0 0 * * 0` | every Sunday at midnight |
| `0 9 * * 1` | every Monday at 9 AM |
| `0 18 * * 1-5` | weekdays (Mon–Fri) at 6 PM |
| `0 0 1 * *` | first day of every month at midnight |

## Best Practices

Logging, catching errors without throwing, idempotency and workflows for mutations are shared with subscribers: see [subscribers-and-events.md → Best Practices](subscribers-and-events.md#best-practices). For jobs specifically:

- Catch errors at the top level. An uncaught throw stops the job's execution; a caught one lets the job complete and retry on the next schedule.
- Make jobs safely re-runnable. Track a last-sync time, fetch only records updated since then (`filters: { updated_at: { $gte: lastSyncTime } }`), upsert rather than insert into external systems, then store the new sync time.
- Log metrics: items processed and duration (`Date.now() - startTime`), on success and on failure.
- Test with a frequent schedule and limited `numberOfExecutions` (see Configuration Options).
