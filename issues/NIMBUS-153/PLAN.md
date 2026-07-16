# NIMBUS-153: Migrate Business Central Client to Medusa Module

**Issue:** https://alphasolutionsdk.atlassian.net/browse/NIMBUS-153

## Objective

Migrate the Business Central HTTP client utility into a dedicated Medusa module, improving architectural consistency and enabling DI-based access from route handlers.

## Analysis

The current implementation lives in `apps/backend/src/utils/business-central-client.ts` as a standalone utility function (`getBusinessCentralOperations`). It handles OAuth2 token acquisition and BC API calls. The single consumer is `apps/backend/src/api/store/business-central/operations/route.ts`.

Existing modules (company, quote, approval) all extend `MedusaService({...models})` because they manage database entities. The Business Central module is different — it's a pure integration adapter with no data models. The service will be a plain class implementing a custom interface, registered via `Module()` the same way.

The route middleware for `/store/business-central*` currently has authentication commented out — this is unchanged by this migration (out of scope per SCOPE.md).

## Execution Plan

1. **Create module structure** — `modules/business-central/` with `index.ts`, `service.ts`, `types.ts`
2. **Wire in medusa-config** — Import and register `BUSINESS_CENTRAL_MODULE`
3. **Update route consumer** — Resolve service from DI container instead of direct utility import
4. **Delete old utility** — Remove `utils/business-central-client.ts`
5. **Verify** — Build, lint, startup, and endpoint smoke test

## Decisions & Trade-offs

- **No `MedusaService` base class** — The module has no data models, so extending `MedusaService({})` adds no value. A plain class implementing a typed interface is cleaner and follows the "simplicity first" principle.
- **Full removal of old utility** — Per scope decision: the old file is deleted (not kept as a shim) since there's only one consumer.
- **No token caching** — The existing utility fetches a fresh token on every call. This migration preserves that behavior exactly; caching would be a follow-up enhancement.
- **Module name `"businessCentral"`** — camelCase to match Medusa's module naming convention.

## Verification

- [ ] `pnpm build` passes with zero errors
- [ ] `pnpm lint` passes with no new errors
- [ ] Backend starts without module resolution errors
- [ ] `GET /store/business-central/operations` returns same response shape as before
- [ ] `grep -r "business-central-client" apps/` returns no active imports
