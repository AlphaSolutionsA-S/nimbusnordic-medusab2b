# Creating Workflows

Workflows are the standard way to perform mutations (create, update, delete) on models in a module. Every custom-module mutation goes through a workflow.

## Creating Workflows - Implementation Checklist

Track these steps with your todo tool:

- Create the colocated folder `src/workflows/<workflow-name>/`
- Define the workflow input type
- Create step functions (one mutation per step) in `<workflow-name>/steps/`
- Add a compensation function to each step for rollback
- Put non-`createStep` helper logic in `<workflow-name>/helpers/`, never in `steps/`
- Write the composition function in `<workflow-name>/index.ts`, following the composition rules below
- Return a `WorkflowResponse`
- Make sure the workflow can be retried safely (idempotency)
- Run the build to validate (catches type errors)

## Basic Workflow Structure

```
src/workflows/<workflow-name>/
  index.ts              # createWorkflow composition (the only export other files import)
  steps/
    fetch-thing.ts       # createStep files — one mutation/read per step
    update-thing.ts
    __tests__/update-thing.unit.spec.ts
  helpers/               # non-createStep logic used only by this workflow's steps
    build-thing-payload.ts
    __tests__/build-thing-payload.unit.spec.ts
  __tests__/<workflow-name>.unit.spec.ts   # workflow-level composition tests
```

### Is It a Step or a Helper?

This is the part most often gotten wrong. The rule is about file placement; a small local `function` inside a step file, used only by that step, is fine.

- `steps/` holds only files that call `createStep()`. A separate file without `createStep()` is a helper, however workflow-specific it is.
- Helper logic a step calls (parsing, DTO mapping, batching, stats…) goes in `<workflow-name>/helpers/` once it warrants its own file. Create `helpers/` as soon as you add the first non-step utility; never park one in `steps/` "temporarily".
- Extract only pure helpers (plain data in, plain data out); keep I/O inline in the step. The `xxxLogic(input, deps)` seam is banned ("Workflow Step Testability" in this skill's `SKILL.md`), and two steps that do the same thing share the step (`file-shared-step`).
- Promote a helper to `src/workflows/helpers/[name].ts` when 2+ workflows need it, or when something outside the workflow imports it directly (a subscriber, route, or another workflow), rather than duplicating it. Being imported by an external subscriber does not by itself make it cross-domain: a helper used by one workflow's steps and by the subscriber that triggers that same workflow stays in that workflow's `helpers/`. Only sharing across 2+ workflows makes it cross-domain.

```typescript
// ✗ src/workflows/sync-stores/steps/batch-stores.ts   (no createStep() call)
// ✓ src/workflows/sync-stores/helpers/batch-stores.ts
export async function batchStoreOperations<T>(...) { /* … */ }
```

### Step and workflow

```typescript
// src/workflows/create-my-model/steps/create-my-model.ts
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { MY_MODULE } from "../../../modules/my"
import MyModuleService from "../../../modules/my/service"

// One mutation per step so rollback works; make steps idempotent for retried workflows
export const createMyModelStep = createStep(
  "create-my-model",
  async (input: { my_key: string }, { container }) => {
    const myModule: MyModuleService = container.resolve(MY_MODULE)
    const newMy = await myModule.createMyModels(input) // object in → object out; array in → array out
    return new StepResponse(newMy, newMy.id) // 2nd arg = compensation input (defaults to step output)
  },
  async (id, { container }) => {             // optional compensation
    const myModule: MyModuleService = container.resolve(MY_MODULE)
    await myModule.deleteMyModels(id)
  }
)

// src/workflows/create-my-model/index.ts
import { createWorkflow, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { createMyModelStep } from "./steps/create-my-model"

const createMyModel = createWorkflow(
  "create-my-model",
  function (input: { my_key: string }) {     // regular sync function — see composition rules
    const newMy = createMyModelStep(input)
    return new WorkflowResponse({ newMy })
  }
)
export default createMyModel
```

## Workflow Composition Rules

The composition function runs once at application load time to define the structure. Its variables have no values until execution, so all data logic goes through `transform()` (from `@medusajs/framework/workflows-sdk`), which runs at execution time.

| Not allowed in composition | Use instead |
|---|---|
| `async` functions | a synchronous function (regular or arrow; the composer runs once at definition time, so it can't await) |
| Direct variable manipulation / concatenation | `transform({ in }, ({ in }) => \`Transformed: ${in}\`)` |
| `new Date()` (frozen to load time) | wrap in `transform()` |
| `if`/`else` | `when(input, (input) => input.is_active).then(() => { /* steps */ })` |
| `? :`, `??`, `\|\|`, `?.`, `!!` | `transform()` |
| Object spread `...` (destructuring or spreading) | build the object inside `transform()` |
| `for`/`while` loops | see Loops below |
| `try`/`catch` | Medusa's workflow error-handling patterns (ask the `medusa` MCP) |
| Returning non-serializable values (Map, Set…) | primitives / plain objects only; return a buffer as an object property and recreate it with `Buffer.from()` when processing results |

```typescript
// ✗ const updated = { ...input.data, newField: "value" }
// ✓ const updated = transform({ input }, (data) => ({ ...data.input.data, newField: "value" }))
```

### Using Steps Multiple Times

Medusa tracks execution state by step name, so duplicate names conflict and fail at runtime. Rename every invocation after the first with `.config()`:

```typescript
const customer1 = fetchCustomerStep(customers[0])
const customer2 = fetchCustomerStep(customers[1]).config({ name: "fetch-customer-2" })
```

### Loops

A loop in the composition function runs at load time with no data. Two alternatives:

1. Repeat the whole workflow (each run keeps its own rollback): loop in the calling code.
   ```typescript
   // API route
   for (const item of items) {
     await myWorkflow(req.scope).run({ input: { item } })
   }
   ```
2. Prepare step inputs from an array inside one execution: map in `transform()`.
   ```typescript
   const stepInputs = transform({ input }, (data) => data.input.items.map((item) => ({ id: item.id })))
   step1(stepInputs)
   ```

## Reusing another workflow

Default: `runAsStep` in the workflow definition. It passes the container and the parent's workflow
context, so the nested workflow joins the parent's transaction and compensation.

```typescript
const order = getOrderDetailWorkflow.runAsStep({ input: { order_id: input.id, fields: ["id"] } })
```

Don't call `someWorkflow(container).run()` inside a step body. Medusa core does this zero times
across `core-flows` while using `runAsStep` in ~70 workflow files. `.run()` starts a fresh
execution without the parent's `StepExecutionContext` (`transactionId`, `eventGroupId`,
`idempotencyKey`, `parentStepIdempotencyKey`, `preventReleaseEvents`, `runId`): its events are
released independently instead of aggregated into the parent's group, it doesn't share the
parent's transaction context, and a retry of the enclosing step re-executes it from scratch.
Compensation is only one of the things lost, so "it's read-only, nothing to compensate" is not a
defence.

- Hoist the invariant, not the read. If a step-local invariant (usually a distributed lock) seems to
  force an in-step read: acquire the lock in a preceding step (with a compensation that releases
  it), compose the read with `runAsStep`, release in a following step. Read-then-decide atomicity
  holds and the read goes through the workflow.
- Reads that can't be composed (inside a loop over N records, or conditional on a caught error): use
  `query.graph()` in the step with a comment saying why — better than a nested `.run()`. Such a read
  cannot use post-fetch computed fields; if it ever needs one, the read has to move, not grow.
- Conditional dispatch is `when()`, not an `if` in a step. A workflow definition can't use `if`,
  which is the usual reason a mutation ends up wrapped in a step.
  `when(name, values, cond).then(() => { someWorkflow.runAsStep({ input }) })` returns the branch's
  value (or `undefined`); merge several branches with a final `transform`. Keep the step for the
  pure decision and compose the dispatch.
- Failure recovery is a compensation function, not a `catch`. A step that wraps a mutation only to
  `catch` and recover is the other common reason. Put recovery in the compensation of a preceding
  step; Medusa runs it if the composed mutation fails. The caller then sees the framework's error,
  not your typed one — if an API contract depends on a typed code, re-type it at the route that
  owns that contract.

Three exceptions where `.run(container)` in a step is the only option; comment each where it appears:
1. Compensation functions — they run outside the composition, so `runAsStep` is unavailable. Keep
   such a step's invoke/compensate pair together; composing only the invoke half orphans the rollback.
2. Loops over N records — a workflow definition has no N to iterate.
3. A dispatch whose `catch` is the logic — e.g. treating a specific failure as
   success-by-idempotency. `runAsStep` cannot be wrapped in try/catch.

Jobs, subscribers, API routes and scripts are not steps and use `workflow(container).run()`
normally. Only step bodies are constrained.

## Step Best Practices

1. One mutation per step, so rollback works.
2. Idempotent: safe to retry.
3. Pass explicit compensation input when the compensation needs something other than the step output.
4. Always return a `StepResponse`.

## Reusing Built-in Medusa Steps

OOTB first is a Tier 0 rule (`medusa-boundary.md`). `@medusajs/medusa/core-flows` has built-in workflows and steps for products, customers, orders, carts, pricing, inventory, fulfillment, payments, shipping and more; they are tested, include compensation and stay in sync with Medusa releases. To find one, ask the `medusa` MCP "What core-flows workflows are available for [domain]?" and "What is the input type for [workflowName]?". Create custom ones only when nothing built-in fits. Also look for built-in event emission, notification, inventory and payment steps.

| Need | Built-in step (from `@medusajs/medusa/core-flows`) | Don't |
|---|---|---|
| Create links | `createRemoteLinkStep` | write a custom step calling `link.create(...)` |
| Remove links | `dismissRemoteLinkStep` | custom dismiss step |
| Query data | `useQueryGraphStep({ entity, fields, filters })` → `{ data }` | custom step wrapping `query.graph` |

Link order: the module order in `createRemoteLinkStep` data must match the order in `defineLink()`; a mismatch is a runtime error.

```typescript
// src/links/review-product.ts — review FIRST, then product
export default defineLink({ linkable: ReviewModule.linkable.review, isList: true }, ProductModule.linkable.product)

// in the workflow — same order as defineLink
const linkData = transform({ review, input }, ({ review, input }) => [{
  [REVIEW_MODULE]: { review_id: review.id },          // REVIEW_MODULE from "../modules/review"
  [Modules.PRODUCT]: { product_id: input.product_id }, // Modules from "@medusajs/framework/utils"
}])
createRemoteLinkStep(linkData)

// removing — same order again (review first)
const unlink = transform({ input }, ({ input }) => [{
  [REVIEW_MODULE]: { review_id: input.review_id },
  [Modules.PRODUCT]: { product_id: input.product_id },
}])
dismissRemoteLinkStep(unlink)
deleteReviewStep(input)

// querying
const { data: products } = useQueryGraphStep({
  entity: "product", fields: ["id", "title", "reviews.*"], filters: { id: input.product_id },
})
```

## Business Logic and Validation Placement

All business logic and validation, including ownership checks, runs inside workflow steps, never in API routes. Workflows are the single source of truth for business logic; validating in a route bypasses rollback, makes logic harder to test and reuse, and breaks the Module → Workflow → API Route architecture. The route passes inputs (e.g. the authenticated actor id) and runs the workflow; it doesn't validate first and then call it.

```typescript
// src/workflows/delete-review/steps/delete-review.ts
export const deleteReviewStep = createStep(
  "delete-review",
  async ({ reviewId, customerId }: Input, { container }) => {
    const reviewModule: ReviewModuleService = container.resolve(REVIEW_MODULE)
    const review = await reviewModule.retrieveReview(reviewId)
    if (review.customer_id !== customerId) {
      throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "You can only delete your own reviews")
    }
    await reviewModule.deleteReviews(reviewId)
    return new StepResponse({ id: reviewId }, reviewId)
  },
  async (reviewId, { container }) => { /* restore the review if needed */ }
)
```

## Advanced Features

Workflows also support retries, async behavior, pausing for human confirmation and more. Ask the `medusa` MCP when relevant.
