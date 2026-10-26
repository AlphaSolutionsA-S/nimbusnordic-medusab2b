# Medusa boundary

Where our code meets Medusa (2.21.0, every `@medusajs/*` package in `apps/backend`) and vendor
packages; examples in the `medusa-backend` skill (`reference/medusa-boundary.md`,
`reference/querying-data.md`).

## Verify, don't assume

- Verify each framework or vendor behaviour a design relies on before use (installed source or
  the `medusa` MCP, else the Medusa docs); record the primitive, evidence and behaviours checked
  (repeated calls, invalid or missing input, concurrent races); an unverified claim is marked
  UNVERIFIED in the plan and blocks dispatch.
- Security-relevant vendor claims: from dist code or a runnable probe, never docs.
- Installed source: `apps/backend/node_modules/@medusajs/<pkg>/dist/...` (`node-linker=hoisted`,
  `apps/backend/.npmrc`), else `node_modules/.pnpm/@medusajs+<pkg>@*/node_modules/@medusajs/<pkg>`;
  a no-match grep counts only once it provably searched a real path.

## OOTB first

Use Medusa's workflow or step before your own (core workflows emit events raw service calls skip);
add no pre-check, dedup, retry or compensation around it without evidence it lacks that guarantee.
Extend core flows through `apps/backend/src/workflows/hooks/`, never by copying them.

## Reading core data

- `data-schema-vs-model`: generated types don't prove `query.graph()` resolves a field; where it is
  computed does (module service: yes; core-flows workflow: never, e.g. `order.payment_status`). A
  wrong `query.graph` path is a silent `undefined` (e.g. `items.detail.quantity` on an order):
  verify the shape once on real data and mock only that.
- `data-core-read-workflows`: a substantive read of a core entity uses its core read workflow
  (`getOrderDetailWorkflow`, `getOrdersListWorkflow`); `query.graph()` suits our own models and
  narrow existence or scope checks, each commented as a deliberate exemption.
- `data-no-core-internals`: call the workflow, not the core internal it wraps.
- Pitfall: `fields` expansions deeper than Medusa's relation-depth limit fail at runtime
  (`api/store/quotes/query-config.ts`).

## Types

- Never `as unknown as` (`NO_UNKNOWN_CAST`); an unavoidable escape is exactly one, in a named
  helper, commented with the verified runtime shape.
- A declared type matches the runtime value: `model.dateTime()` is a `Date`.
- `apps/backend/tsconfig.json` sets only `strictNullChecks` (not `strict`), so implicit `any`
  compiles: review enforces `type-no-any`.

## Module-service constraints

- `data-service-async`: every public module-service method is `async` or returns a Promise.
- `data-service-transaction`: a custom method touching the database is a public `@InjectManager()`
  method calling a protected `name_` method with `@InjectTransactionManager()`, both taking a last
  optional `@MedusaContext() sharedContext?: Context`.

## Workflow failures

A failed workflow rejects with a serialised object, not an `Error`: in a test assert
`rejects.toMatchObject({ message })`; when logging, read `.message` defensively.
