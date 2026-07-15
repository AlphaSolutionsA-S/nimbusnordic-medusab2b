# NIMBUS-153: Create Medusa module for Business Central connectivity and migrate bc-utility

- **Date:** 2026-07-15
- **Status:** Scoped
- **Type:** Story
- **Tracker:** JIRA - https://alphasolutionsdk.atlassian.net/browse/NIMBUS-153
- **Priority:** Medium
- **Project Folder:** issues/NIMBUS-153/
- **Size:** M
- **Area:** Backend / Business Central integration boundary
- **Base Branch:** develop

## Objective

Establish a dedicated Medusa backend module for Business Central connectivity, migrate the
current `business-central-client` utility logic into that module, and keep externally visible
behavior unchanged for existing consumers.

## Scope

### In scope
- Create a new backend module (e.g. `businessCentral`) under `apps/backend/src/modules/`.
- Move Business Central connectivity responsibilities from utility code into module service
  methods:
  - discovery URL and tenant parsing
  - credential validation
  - token retrieval
  - Business Central operations fetch
- Register the new module in `apps/backend/medusa-config.ts`.
- Update backend consumers to use the module interface instead of direct utility imports.
- Keep current API contract of `GET /store/business-central/operations` intact.
- Preserve existing environment variable contract:
  - `BUSINESS_CENTRAL_CLIENT_ID`
  - `BUSINESS_CENTRAL_CLIENT_SECRET`
  - `BUSINESS_CENTRAL_DISCOVERY_URL`

### Out of scope
- Functional redesign of Business Central integration behavior.
- New Business Central endpoints/features beyond current operations retrieval.
- Storefront UX changes (except compatibility verification).
- Authentication/authorization policy redesign for `/store/business-central*` routes.
- Replacing current env var names or introducing new secrets management mechanisms.

## Acceptance Criteria Refinement

1. **Module exists and is wired**
   - A dedicated Business Central Medusa module is present and registered in Medusa config.
2. **Logic migration completed**
   - Existing logic from `apps/backend/src/utils/business-central-client.ts` is migrated into
     module service methods (or equivalent module-internal structure).
3. **Configuration managed via module usage**
   - Module reads and validates the existing Business Central env configuration and throws
     equivalent Medusa errors for invalid/missing config.
4. **Consumers moved to module interface**
   - Route-level consumer(s), including store Business Central operations route, no longer
     import the old utility directly.
5. **Behavior parity maintained**
   - Response shape and error behavior for core connectivity flow remain compatible from a
     business perspective.
6. **Verification completed**
   - Build passes and manual/automated verification confirms module startup and successful
     operations fetch flow in configured environment.

## Affected Apps / Files / Modules

### Backend (primary)
- Existing files to migrate/refactor:
  - `apps/backend/src/utils/business-central-client.ts`
  - `apps/backend/src/api/store/business-central/operations/route.ts`
  - `apps/backend/src/api/store/business-central/middlewares.ts`
  - `apps/backend/src/api/store/middlewares.ts`
  - `apps/backend/medusa-config.ts`
  - `apps/backend/.env.template` (documentation alignment only if required)
- New module footprint (expected):
  - `apps/backend/src/modules/business-central/index.ts`
  - `apps/backend/src/modules/business-central/service.ts`
  - optional module-internal helpers/types as needed

### Storefront (verification surface)
- `apps/storefront/src/lib/data/business-central.ts` (compatibility check)
- `apps/storefront/src/app/[countryCode]/(main)/bctest/page.tsx` (smoke verification target)

## Dependencies

- Medusa module registration and dependency resolution in backend runtime.
- Existing environment configuration in deployment/local setup.
- Existing store API route `/store/business-central/operations` as integration contract.

## Risks and Mitigations

- **Risk:** Behavior drift during migration (different errors/response semantics).  
  **Mitigation:** Keep route contract stable and compare representative success/failure paths.
- **Risk:** Module registration/config mistakes causing startup failure.  
  **Mitigation:** Validate backend startup/build after module wiring.
- **Risk:** Hidden consumers of old utility path.  
  **Mitigation:** repo-wide search and replace with explicit verification of import graph.
- **Risk:** Auth assumptions remain unclear on store route.  
  **Mitigation:** treat auth policy as unchanged in this story and document follow-up if needed.

## Rollout and Verification Expectations

1. Build backend (and workspace build if required by pipeline) successfully.
2. Verify backend boots with module registered.
3. Execute/store-route smoke test for `GET /store/business-central/operations` in an
   environment with valid BC credentials.
4. Confirm storefront `bctest` page still resolves expected payload/error behavior.
5. Confirm no remaining runtime imports of `src/utils/business-central-client` from active
   consumer paths targeted by this story.

## Open Questions

- Should `business-central-client.ts` be fully removed in this story, or temporarily retained
  as a compatibility shim delegating to the new module until follow-up cleanup?
- Is route authentication for `/store/business-central*` intentionally open in this scope, or
  should a separate hardening story be created?
