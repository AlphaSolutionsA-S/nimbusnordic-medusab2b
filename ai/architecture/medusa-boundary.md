# Medusa boundary

Where our code meets Medusa (2.21.0, every `@medusajs/*` package in `apps/backend`) and vendor
packages. Code examples and detail: the `medusa-backend` skill (`reference/medusa-boundary.md`,
`reference/querying-data.md`).

## Verify, don't assume

- A framework or vendor behaviour a design relies on is verified before use, from installed source
  or the `medusa` MCP (otherwise the Medusa documentation). Record the primitive, the evidence and
  the behaviours checked (repeated invocation, invalid or missing input, concurrent races). An
  unverified claim is marked UNVERIFIED in the plan and blocks dispatch.
- Security-relevant vendor claims (signatures, lock ownership, replay, token checks) are verified
  from dist code or a runnable probe, never type-doc or README prose.
- `query.graph` selection is string-based and weakly typed, so a wrong path fails silently. Verify a
  result shape once against real data and mock only the shape you verified.
- Installed source: `apps/backend` uses `node-linker=hoisted` (`apps/backend/.npmrc`), so read
  `apps/backend/node_modules/@medusajs/<pkg>/dist/...`; if a package is missing there, grep the
  store `node_modules/.pnpm/@medusajs+<pkg>@*/node_modules/@medusajs/<pkg>`. A no-match grep is
  evidence only once it has provably searched a real path.

## OOTB first

Use Medusa's workflow or step before writing your own; core workflows emit the events that raw
service calls skip. Add no pre-check, dedup, retry or compensation around an OOTB primitive unless
verified evidence shows it lacks that guarantee. Extend core flows through the hooks in
`apps/backend/src/workflows/hooks/`, not by copying the flow.

## Reading core data

- `data-schema-vs-model`: presence in the generated types does not mean `query.graph()` resolves a
  field; where the value is computed does (module service: yes; core-flows workflow: never, e.g.
  `order.payment_status`; wrong path: silent `undefined`, e.g. `items.detail.quantity` on an order).
- `data-core-read-workflows`: a substantive read of a core entity goes through its core read
  workflow (`getOrderDetailWorkflow`, `getOrdersListWorkflow`); `query.graph()` stays right for our
  own models and narrow existence or scope checks, each commented as a deliberate exemption.
- `data-no-core-internals`: call the workflow, not the core internal it wraps.

## Types

- Never `as unknown as` (`NO_UNKNOWN_CAST`). If an escape is unavoidable, there is exactly one, in a
  named helper, with a comment stating the verified runtime shape.
- A declared type matches the runtime value: `model.dateTime()` is a `Date`.
- `apps/backend/tsconfig.json` sets only `strictNullChecks` (not `strict`): implicit `any` compiles,
  so `type-no-any` is a review rule here.

## Module-service constraints

- `data-service-async`: every public module-service method is `async` or returns a Promise.
- `data-service-transaction`: a custom method that touches the database is a public
  `@InjectManager()` method calling a protected `name_` method with `@InjectTransactionManager()`,
  both taking a last optional `@MedusaContext() sharedContext?: Context`.

## Workflow failures

A failed workflow rejects with a serialised object, not an `Error`. In a test, assert with
`rejects.toMatchObject({ message })`; when logging, read `.message` defensively.

## Pitfalls

- `fields` expansions deeper than Medusa's relation-depth limit fail at runtime
  (`api/store/quotes/query-config.ts`).
