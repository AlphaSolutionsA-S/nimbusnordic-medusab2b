---
name: medusa-backend
description: "Medusa v2 (Node/TypeScript) backend: custom modules, data models, module links, workflows and steps, API routes, subscribers, scheduled jobs and Query. Load before planning, researching or implementing any Medusa backend feature; holds the architecture rules, rule IDs and pitfalls the Medusa docs MCP does not."
---

# Medusa backend (v2.17)

Written against Medusa 2.17 (`@medusajs/framework`, `@medusajs/medusa`, `@medusajs/core-flows`
2.17.2). Use this skill for design, architecture and anti-patterns; use the `medusa` docs MCP
(`https://docs.medusajs.com/mcp`) for exact signatures, built-in module config and official types.
The `medusa` MCP is only available to Medusa Cloud users; where the project has none, "the `medusa` MCP" in
this skill means the documentation at `https://docs.medusajs.com` and the installed source.
Load `medusa-admin` for admin UI and `medusa-storefront` for storefront SDK calls. Commands are shown
as `medusa …`; run them through the project's package manager (`pnpm exec medusa …`, `npx medusa …`).

## Layer mapping

Layer ids are those of the project's Tier 0 `layers.md` (the Medusa starter in this skill's `tier0/`).
Each layer skill lists its allowed dependencies, forbidden rule IDs and canonical file; this skill
holds the Medusa detail they point to.

| Layer | Layer skill | References here |
|---|---|---|
| L0–L1 data model, module service | `medusa-module-and-data` | `custom-modules.md`, `data-models.md`, `module-links.md` |
| L2 infra adapter | `medusa-infra-adapter` | `custom-modules.md`; provider guides via the `medusa` MCP |
| L3–L5 step, workflow, decision fn | `medusa-workflow-and-steps` | `workflows.md`, `workflow-hooks.md`, `querying-data.md` |
| L6 API route | `medusa-api-route` | `api-routes.md`, `authentication.md`, `error-handling.md` |
| L7 subscriber, job | `medusa-triggers` | `subscribers-and-events.md`, `scheduled-jobs.md` |

## Reference files

The quick reference below is not enough to implement from. Before writing code for a component,
load its reference:

| Task | Reference |
|------|-----------|
| Module + data models | `reference/custom-modules.md`, `reference/data-models.md` |
| Workflows and steps, reusing workflows (`runAsStep`) | `reference/workflows.md`; hooks into core flows: `reference/workflow-hooks.md` |
| API routes and validation | `reference/api-routes.md` |
| Module links | `reference/module-links.md` |
| Querying and filtering | `reference/querying-data.md` |
| Detail and examples for the Tier 0 Medusa boundary (installed-source greps, type annotations) | `reference/medusa-boundary.md` |
| Protecting routes, accessing users | `reference/authentication.md` |
| `MedusaError` types | `reference/error-handling.md` |
| Cron jobs | `reference/scheduled-jobs.md` |
| Events and subscribers | `reference/subscribers-and-events.md` |
| Common errors | `reference/troubleshooting.md` |

## Architecture Audit Checklist

The implementation-planner verifies every planned design against this before writing task files; the
code-reviewer uses it on the diff. Each item is a rule ID from the Quick Reference below, a section of
this skill, or a Tier 0 rule (`lock-*` and `NO_LOCKING_IN_ROUTES` in `boundaries.md`;
`NO_UNKNOWN_CAST`, OOTB first and Types in `medusa-boundary.md`).

- API routes: `arch-http-methods`, `arch-workflow-required`, `arch-layer-bypass`,
  `type-authenticated-request`, `type-request-schema`, `data-auth-middleware`, `import-top-level`,
  `arch-route-emits-long-work`, `NO_LOCKING_IN_ROUTES`
- Workflows and steps: Workflow Composition Rules (below), `lock-critical-section`, `lock-ttl`,
  OOTB first (no pre-check, dedup, retry or compensation around an OOTB primitive without the
  recorded evidence Tier 0 asks for; recipe in `reference/medusa-boundary.md`)
- Container and types: `type-container-resolve`, `type-metadata-optional`, `type-no-any`,
  `NO_UNKNOWN_CAST`, declared types match the runtime value (Tier 0 Types)
- Background processing: `arch-job-runs-workflow`, `arch-route-emits-long-work`, `lock-single-run`,
  `logic-collect-item-errors`, `logic-partial-failure-status`, `logic-diff-batch-updates`,
  `logic-delta-since`
- Data access: `data-service-async`, `data-service-transaction`, `data-core-read-workflows`,
  `data-schema-vs-model`, `data-no-core-internals`, `arch-module-isolation`, `data-query-graph`,
  `data-query-index`, `data-linked-filtering`, `data-no-js-filter`, `data-no-computed-filter`,
  `data-price-format`, `data-dedup-set`, `data-migrations-required`
- Code organisation: `file-shared-step`, `file-named-constants`, `file-workflow-folder`,
  `file-workflow-steps`, `file-workflow-helpers-local`, `file-workflow-helpers-shared`

## Rule Categories by Priority

| Priority | Category | Impact | Prefix |
|----------|----------|--------|--------|
| 1 | Architecture Violations | CRITICAL | `arch-` |
| 2 | Type Safety | CRITICAL | `type-` |
| 3 | Business Logic Placement | HIGH | `logic-` |
| 4 | Import & Code Organization | HIGH | `import-` |
| 5 | Data Access Patterns | MEDIUM (includes CRITICAL price rule) | `data-` |
| 6 | File Organization | MEDIUM | `file-` |

## Quick Reference

### 1. Architecture Violations (CRITICAL)
- `arch-workflow-required` - Use workflows for all mutations; never call module services from routes
- `arch-layer-bypass` - Never bypass layers (route → service without workflow)
- `arch-http-methods` - Use only GET, POST, DELETE (never PUT/PATCH)
- `arch-module-isolation` - Use module links, not direct cross-module service calls
- `arch-query-config-fields` - Don't set explicit `fields` when using `req.queryConfig`
- `arch-job-runs-workflow` - A scheduled job runs its workflow directly and emits no event for a subscriber — `reference/scheduled-jobs.md#jobs-routes-and-the-event-hop`
- `arch-route-emits-long-work` - A route whose work cannot finish within the request emits an event that a subscriber turns into a workflow run (never `setImmediate` or an unawaited call); every other route runs its workflow and awaits it — `reference/scheduled-jobs.md#jobs-routes-and-the-event-hop`

### 2. Type Safety (CRITICAL)
- `type-request-schema` - Pass the Zod inferred type to `MedusaRequest<T>` when using `req.validatedBody`, and apply the schema with `validateAndTransformBody` in the route's middlewares
- `type-authenticated-request` - Use `AuthenticatedMedusaRequest` for protected routes (not `MedusaRequest`)
- `type-export-schema` - Export both the Zod schema and its inferred type from middlewares
- `type-linkable-auto` - Never add `.linkable()` to data models (added automatically)
- `type-module-name-camelcase` - Module names are camelCase, never dashes (dashes cause runtime errors)
- `type-container-resolve` - Annotate (`: Type`) when resolving from the container, never `as Type` or untyped (untyped causes TS18046) — `reference/medusa-boundary.md#types`
- `type-metadata-optional` - Use optional chaining (`?.`) for entity metadata access (otherwise TS18048) — `reference/medusa-boundary.md#types`
- `type-no-any` - No `any` on resolved services, query results, SDK request bodies or caught errors: use the framework's or the SDK's type, and treat a caught error as `unknown` (`error instanceof Error ? error.message : String(error)`)

### 3. Business Logic Placement (HIGH)
- `logic-workflow-validation` - Put business validation in workflow steps, not API routes
- `logic-ownership-checks` - Validate ownership/permissions in workflows, not routes
- `logic-module-service` - Keep modules simple (CRUD only); put logic in workflows
- `logic-collect-item-errors` - Errors inside per-item loops are collected, never silently swallowed
- `logic-partial-failure-status` - A partial failure is reported with a distinct status (e.g. `completed_with_errors`), not always `success`
- `logic-diff-batch-updates` - Batch updates use a create/update/delete diff, not delete-all and recreate
- `logic-delta-since` - A delta sync's `since` is `max(last_full_sync, last_delta_sync)`, not always `last_full_sync`

### 4. Import & Code Organization (HIGH)
- `import-top-level` - Import workflows/modules at file top; never `await import()` in a route body
- `import-static-only` - Use static imports for all dependencies
- `import-no-dynamic-routes` - Dynamic imports add overhead and break type checking

### 5. Data Access Patterns (MEDIUM)
- `data-price-format` - (CRITICAL) Medusa stores prices as-is (49.99 is stored as 49.99, not in cents). Never multiply by 100 when saving or divide by 100 when displaying
- `data-core-read-workflows` - A substantive read of a core entity goes through its core read workflow (`getOrderDetailWorkflow`, `getOrdersListWorkflow`, …), not `query.graph()`; narrow scope/existence checks are commented exemptions — `reference/medusa-boundary.md#reading-core-data`
- `data-schema-vs-model` - A field in the generated types is not evidence that `query.graph()` resolves it; what matters is where it is computed (module service: yes; core-flows workflow: never; wrong path: silent `undefined`) — `reference/medusa-boundary.md#reading-core-data`
- `data-service-async` - Every public module-service method is `async` or returns a Promise — `reference/medusa-boundary.md#module-service-constraints`
- `data-service-transaction` - A custom service method that touches the database is a public `@InjectManager()` method calling a protected `name_` method with `@InjectTransactionManager()`, both with a last `@MedusaContext() sharedContext` — `reference/custom-modules.md#2-service`
- `data-no-core-internals` - Call the workflow, not the core internal it wraps (e.g. `getOrderDetailWorkflow` rather than the `getLastPaymentStatus` helper it wraps) — `reference/medusa-boundary.md#reading-core-data`
- `data-query-method` - Use `query.graph()` for retrieving data; `query.index()` (Index Module) for filtering across linked modules
- `data-query-graph` - Use `query.graph()` for cross-module queries with dot notation (without cross-module filtering)
- `data-query-index` - Use `query.index()` when filtering by properties of linked data models in separate modules
- `data-list-and-count` - Use `listAndCount` for single-module paginated queries
- `data-linked-filtering` - `query.graph()` can't filter by linked-module fields; use `query.index()` or query from that entity directly. Check the direction first: filtering `product` by a linked custom `brand.name` is the unsupported case; querying `brand` by its own columns is an ordinary same-module filter (`data-same-module-ok`) needing no Index Module. The index is eventually consistent, so prefer querying the entity directly when you own it
- `data-no-js-filter` - Don't `.filter()` linked data in JavaScript; use database filters (`query.index()` or query the entity)
- `data-same-module-ok` - `query.graph()` can filter by same-module relations (e.g. product.variants)
- `data-no-computed-filter` - Never filter at the DB on a projected or post-fetch-computed value — it is not a column. A test asserting the filter object was built proves nothing about whether the database honoured it. Filter in memory, or narrow on a real column first
- `data-migrations-required` - After creating or changing a data model, run `medusa db:generate <module>` then `medusa db:migrate`; after creating or changing a module link, run `medusa db:migrate` (it syncs link tables; `db:generate` only generates module migrations). Never skip
- `data-dedup-set` - Deduplicate with a `Set` or `Map`, not array `includes`/`indexOf`
- `data-auth-middleware` - Protected routes get the `authenticate` middleware in their middlewares array; trust it, don't manually check `req.auth_context`

### 6. File Organization (MEDIUM)
- `file-shared-step` - Two steps that do the same thing are one `createStep` in `src/workflows/<domain>/steps/` (or `src/workflows/shared/steps/`), imported by both workflows; where they differ only in a rule, pass a discriminator through `transform()` and dispatch to the pure decision function. Never share them through a helper with injected dependencies: both step files remain, and the helper is the mocking seam Tier 0 bans (`layers.md` L5, `verification.md`). Pure logic shared by 2+ workflows is a shared helper (`file-workflow-helpers-shared`)
- `file-named-constants` - Operation names and status strings are constants, not inline string literals
- `file-workflow-folder` - Each workflow gets its own colocated folder: `src/workflows/<workflow-name>/`
- `file-workflow-composition` - Composition function goes in `src/workflows/<workflow-name>/index.ts`
- `file-workflow-steps` - Step files go in `src/workflows/<workflow-name>/steps/[step-name].ts`; every file here calls `createStep()`
- `file-workflow-helpers-local` - Non-`createStep` logic used by one workflow goes in `src/workflows/<workflow-name>/helpers/[name].ts`, never in `steps/`
- `file-workflow-helpers-shared` - Non-`createStep` logic shared by 2+ workflows (or imported directly by a subscriber/route) goes in `src/workflows/helpers/[name].ts`
- `file-workflow-tests` - Colocate tests under `__tests__/` next to what they test (`<workflow>/__tests__/`, `<workflow>/steps/__tests__/`, `<workflow>/helpers/__tests__/`); with Medusa's default Jest config only tests inside `__tests__/` folders are discovered
- `file-middleware-exports` - Export schemas and types from middleware files
- `file-links-directory` - Define module links in `src/links/[name].ts`

## Workflow Composition Rules

The composition function runs at load time, so:

```typescript
// ✗ async (input) => { const r = await myStep(input); if (input.flag) { … } }
// ✓
const myWorkflow = createWorkflow("name", function (input) { // synchronous: never async
  const result = myStep(input)                                 // no await
  return new WorkflowResponse(result)
})
```

- No async/await, no conditionals/ternaries (use `when()`), no variable manipulation or date
  creation (use `transform()`). Full table: `reference/workflows.md`.
- Calling the same step more than once needs `.config({ name: "unique-name" })`.
- Reuse another workflow with `runAsStep`, never `someWorkflow(container).run()` inside a step body
  (three commented exceptions): `reference/workflows.md#reusing-another-workflow`.

## Workflow Step Testability (Advanced Pattern)

Which test layer covers what is set in the project's Tier 0 `verification.md`. For complex
branch-heavy logic, extract a pure function (plain data in — fetched rows, DTOs, primitives — plain
data out), keep all I/O and `container.resolve` in the step, unit-test the pure function, and cover
the step's wiring through a route contract test or, for the cases HTTP can't see, an integration
test (`medusaIntegrationTestRunner` from `@medusajs/test-utils`).

Use it for multi-branch logic on plain data that needs no container and benefits from fast unit
tests. Skip it for simple CRUD, logic tightly coupled to services (leave it in the step), or when
integration tests suffice.

Anti-pattern, banned by Tier 0 (`verification.md`, the L5 row of `layers.md`): extracting the whole
step body into `xxxLogic(input, service)` or `xxxLogic(input, { fetchX, updateY })` so services can
be mocked. In Medusa terms it reinvents the container's dependency injection, usually forces
`as any`, and hollows the step so the fetch→decide→write flow is no longer visible in one place.

```typescript
// ✗ export async function transitionLogic(input: Input, deps: { fetchOrder: …; updateOrder: … }) { /* guard + rules + I/O */ }
// ✓ extract only the pure decision; do I/O inline in the step
export function computeTransition(input: Input, order: Row): { id: string; patch: Patch } { /* no I/O */ }

export const transitionStep = createStep("transition", async (input, { container }) => {
  const query: Omit<RemoteQueryFunction, symbol> = container.resolve(ContainerRegistrationKeys.QUERY)
  const service: MyModuleService = container.resolve(MY_MODULE)
  const { data } = await query.graph({ entity: "order", fields: [/* … */], filters: { id: input.id } })
  const { id, patch } = computeTransition(input, data[0]) // pure, unit-tested; Row matches the selected fields
  const [updated] = await service.updateOrders([{ id, ...patch }])
  return new StepResponse(updated)
})
```

If the extracted logic needs a service, it is not pure — leave it inline and cover it with an
integration test.

## Validating Implementation

After implementing, run the backend's build (`medusa build`) and typecheck (`tsc --noEmit`) through
the project's package manager. Typical failures: missing imports/exports, type mismatches (e.g. a
missing `MedusaRequest<T>` type argument), incorrect workflow composition (async functions,
conditionals). What runs per task and at finalization is in the project's Tier 0 `verification.md`.

## Integration with Frontend Applications

Frontends call the backend through the Medusa JS SDK: the `sdk-*` rules in `medusa-storefront`
(storefront, whose frontend-integration reference has the full patterns), which `medusa-admin`
applies to admin UI.

## Project specifics

If `project.md` exists next to this file, read it as well. It holds this project's paths, canonical examples, exceptions and extra rules, and it wins where the two differ.
