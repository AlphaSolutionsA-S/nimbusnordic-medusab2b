# Boundaries

Import edges of `layers.md`. `B` = `apps/backend/src`, `S` = `apps/storefront/src`, `<m>` one
module, `<other>` any other. Tests (`**/__tests__/**`, `*.spec.ts`, `*.test.ts`) are exempt; "value"
excludes `import type`. Review enforces every row (no import-boundary lint); `medusa lint`
(`@medusajs/eslint-plugin`) backs `bound-module-isolation` and `bound-route-no-service` with
`link-no-cross-module-relationship` (error) and `no-service-mutations-in-api-route` (warning).

|ID|From|To (forbidden unless noted)|
|---|---|---|
|`bound-model-private`|`B/**` outside `B/modules/<m>/**`|`B/modules/<m>/models/**`|
|`bound-module-isolation`|`B/modules/<m>/**`|`B/modules/<other>/**`|
|`bound-module-no-upward`|`B/modules/**`|`B/{workflows,api,subscribers,jobs,links}/**`|
|`bound-links-index-only`|`B/links/**`|only `B/modules/*/index.ts`, `@medusajs/medusa/*` allowed|
|`bound-workflow-no-upward`|`B/workflows/**`|`B/{api,subscribers,jobs}/**`|
|`bound-helper-pure`|`B/workflows/<domain>/utils/**`|`B/modules/*/service.ts`, `B/**/steps/**`, `@medusajs/framework/workflows-sdk` (all value)|
|`bound-route-no-service`|`B/api/**`|`B/modules/*/service.ts` (value)|
|`bound-api-private`|`B/**` outside `B/api/**`|`B/api/**`|
|`bound-trigger-thin`|`B/{subscribers,jobs}/**`|`B/modules/*/service.ts` (value), `B/**/steps/**`|
|`bound-app-isolation`|any app (`apps/backend`, `apps/storefront`, `apps/cms`)|another app's source|
|`bound-sf-transport-private`|`S/**` outside `S/lib/config.ts`, `S/lib/data/**`, `S/middleware.ts`|`@medusajs/js-sdk`, `S/lib/config.ts`|
|`bound-sf-server-only`|`S/lib/data/cms.ts`, `S/lib/data/ui-translations.ts`, `S/lib/data/country-languages.ts`|`server-only` required|

Baseline: `bound-route-no-service` in `B/api/store/bc-orders/[id]/returns/route.ts`,
`B/api/store/ui-translations/[locale]/route.ts`, `B/api/admin/ui-translations/*`;
`bound-sf-transport-private` in `S/app/[countryCode]/(main)/products/[handle]/page.tsx`.

## Locks

No Redis: locks are in memory, not shared across instances (unverified in production,
`docs/security-remediation.md`).

- `lock-single-run`: a lock keeping a sync or batch to one run is taken in the L7 trigger: try
  once, skip if held, release in `finally`.
- `lock-critical-section`: a lock around changing specific data is taken by a step whose
  compensation releases it, and released by a later step (or try/finally in one step).
  `acquireLockStep` skips itself under `runAsStep` unless `executeOnSubWorkflow: true`.
- `lock-ttl`: every lock has a TTL above the worst-case run, and an `ownerId` where a release could
  free another run's lock.
- `NO_LOCKING_IN_ROUTES`: no `.acquire()` in `B/api/**`.
