# Medusa backend: Nimbus Nordic

App `apps/backend` (`@b2b-starter/backend`), Medusa 2.21.0, Postgres (`DATABASE_URL`). Layers, module
registry and boundaries are Tier 0 (`ai/architecture/`); this file adds what the skill can't know.

- Config: `apps/backend/medusa-config.ts` registers the six custom modules and the core notification
  module with the `notification-local` email provider. CORS per environment (`STORE_CORS`,
  `ADMIN_CORS`, `AUTH_CORS`). No Redis: event bus, cache and locking are in memory.
- Backend at `http://localhost:9000`, Admin at `http://localhost:9000/app`. Start it with
  `pnpm --filter @b2b-starter/backend dev` (the root `pnpm backend:dev` filters a package name that
  doesn't exist).
- Migrations: `pnpm --filter @b2b-starter/backend exec medusa db:generate <module>`, then
  `pnpm --filter @b2b-starter/backend exec medusa db:migrate`.
- Validation: import `z` from `@medusajs/framework/zod` (backend has zod 4; the storefront has zod 3).
- Business Central (Dynamics 365, API v2.0 and OData v4, OAuth client credentials) is reached only
  through `modules/business-central/service.ts`. Tests run only against an allowed BC test
  environment (`integration-tests/global-setup.ts`, `src/utils/business-central-test-environment.ts`).
- Order API: `src/api/orderapi/**` is called by an Azure Logic App behind APIM with a secret API key
  authenticated as a Medusa user (`src/api/orderapi/middlewares.ts`). The canonical order schema is
  `src/modules/order-ingestion/canonical-order-schema.ts`; artifacts in `issues/NIMBUS-145/` and
  `issues/NIMBUS-146/`. Changing it is a contract change (full pipeline).
- Company authorization for store routes: `src/api/middlewares/ensure-role.ts`
  (`authorizeCompanyAccessWorkflow`); security negative tests in
  `integration-tests/http/security/security-boundaries.spec.ts`.
- Naming: kebab-case directories and files; PascalCase React admin components.
