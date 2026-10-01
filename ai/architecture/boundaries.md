# Boundaries

The import edges of `layers.md` as rules. `B` = `apps/backend/src`, `S` = `apps/storefront/src`,
`<m>` is one module, `<other>` any other. Tests (`**/__tests__/**`, `*.spec.ts`, `*.test.ts`) are
exempt. "Value import" excludes `import type`. Existing violations get a baseline, not a retrofit.

No import-boundary lint runs yet: every row is enforced by review. `@medusajs/eslint-plugin`
(`medusa lint`) adds `link-no-cross-module-relationship` (error) and
`no-service-mutations-in-api-route` (warning), which back `bound-module-isolation` and
`bound-route-no-service`.

| ID | From | To | Verdict |
|---|---|---|---|
| `bound-model-private` | `B/**` outside `B/modules/<m>/**` | `B/modules/<m>/models/**` | forbidden |
| `bound-module-isolation` | `B/modules/<m>/**` | `B/modules/<other>/**` | forbidden |
| `bound-module-no-upward` | `B/modules/**` | `B/{workflows,api,subscribers,jobs,links}/**` | forbidden |
| `bound-links-index-only` | `B/links/**` | `B/modules/*/index.ts`, `@medusajs/medusa/*` | only these allowed |
| `bound-workflow-no-upward` | `B/workflows/**` | `B/{api,subscribers,jobs}/**` | forbidden |
| `bound-helper-pure` | `B/workflows/<domain>/utils/**` | `B/modules/*/service.ts`, `B/**/steps/**`, `@medusajs/framework/workflows-sdk` (all value) | forbidden |
| `bound-route-no-service` | `B/api/**` | `B/modules/*/service.ts` (value) | forbidden |
| `bound-api-private` | `B/**` outside `B/api/**` | `B/api/**` | forbidden |
| `bound-trigger-thin` | `B/{subscribers,jobs}/**` | `B/modules/*/service.ts` (value), `B/**/steps/**` | forbidden |
| `bound-app-isolation` | any app (`apps/backend`, `apps/storefront`, `apps/cms`) | another app's source | forbidden |
| `bound-sf-transport-private` | `S/**` outside `S/lib/config.ts`, `S/lib/data/**`, `S/middleware.ts` | `@medusajs/js-sdk`, `S/lib/config.ts` | forbidden |
| `bound-sf-server-only` | `S/lib/data/cms.ts`, `S/lib/data/ui-translations.ts` | `server-only` | required |

Baseline: `bound-route-no-service` in `B/api/store/bc-orders/[id]/returns/route.ts`,
`B/api/store/ui-translations/[locale]/route.ts` and `B/api/admin/ui-translations/*`;
`bound-sf-transport-private` in `S/app/[countryCode]/(main)/products/[handle]/page.tsx`.

## Locks

No Redis is configured, so locks are in memory and don't hold across instances (unverified for
production, `docs/security-remediation.md`).

- `lock-single-run`: a lock that keeps a sync or batch to one run at a time is acquired in the L7
  trigger that starts the workflow: try once, skip if held, release in `finally`.
- `lock-critical-section`: a lock around changing specific data (an order, a cart, a shared
  configuration) is acquired by a workflow step whose compensation releases it and released by a
  later step; a step that acquires and releases in its own body uses try/finally.
  `acquireLockStep` skips itself under `runAsStep` unless `executeOnSubWorkflow: true`.
- `lock-ttl`: every lock sets a TTL (`expire`/`ttl`) longer than the worst-case run, and an
  `ownerId` wherever a release could free another run's lock; without one the in-memory provider
  never expires the lock.
- `NO_LOCKING_IN_ROUTES`: no `.acquire()` in `B/api/**`.
