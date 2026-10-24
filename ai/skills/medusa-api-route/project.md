# API routes: Nimbus Nordic

Paths under `apps/backend/src/api/`. Route roots: `store/`, `admin/`, `orderapi/` (Logic App, secret
API key), `internal/`. Middlewares aggregate from `middlewares.ts` through each root's
`middlewares.ts` to per-route `middlewares.ts`.

- Canonical: `store/quotes/route.ts` with `store/quotes/middlewares.ts` (authenticate +
  `validateAndTransform*`), `validators.ts` (strict zod from `@medusajs/framework/zod`) and
  `query-config.ts`.
- Invoke workflows one way in new code: `xWorkflow(req.scope).run({ input })` (both this and
  `.run({ container: req.scope })` exist today).
- Company-scoped store routes add `middlewares/ensure-role.ts`.
- Business Central reads (`store/bc-orders`, `store/bc-returns`, `store/business-central`) call the
  BC service directly: they are reads from an external system, not mutations.
- Store quote query configs use an exact-path allowlist and a route-local relation depth of four
  for the existing product expansion. Keep customer/employee/company and author selections at
  scalar leaves; allowing their bare parent paths also permits scalar wildcards.
