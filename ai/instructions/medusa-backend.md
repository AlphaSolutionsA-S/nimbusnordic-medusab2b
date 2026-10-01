
# Medusa backend — coding conventions

Layers, boundaries, locks, the Medusa boundary, data ownership, verification and the rule index are
Tier 0 (`ai/architecture/*.md`) and are not repeated here. Medusa API patterns, rule IDs and the
architecture audit checklist are in the `medusa-backend` skill; load it for any backend work.

## Project structure and configuration

```
src/
  admin/              # admin dashboard customizations (Vite + React)
  api/                # custom routes: admin/ (admin-only), store/ (storefront-facing)
  jobs/               # scheduled/background jobs
  links/              # module link definitions
  migration-scripts/  # database seed and migration scripts
  modules/            # custom Medusa modules
  subscribers/        # event subscribers
  workflows/          # workflow definitions
```

- `medusa-config.ts`: database, CORS, secrets. PostgreSQL via `DATABASE_URL`; CORS per environment
  via `STORE_CORS`, `ADMIN_CORS`, `AUTH_CORS`.
- For Medusa v2 patterns defer to the Medusa MCP server (`https://docs.medusajs.com/mcp`) and the
  `medusa-backend` skill rather than reinventing them.
- A storefront calls this backend through `@medusajs/js-sdk` (see the `medusa-storefront` skill).

## Commands

Run through the project's package manager, from the backend package.

| Command | Description |
|---------|-------------|
| `medusa develop` (the `dev` script) | Start the dev server: API at `http://localhost:9000`, admin at `/app` |
| `test:unit`, `test:integration:http`, `test:integration:modules` | Normal verification |

- On Windows, running `tsc` through a workspace filter (`pnpm --filter <backend> exec tsc`) can report
  "tsc not found"; call `<backend>/node_modules/.bin/tsc` directly.

## Naming and comments

- Directories kebab-case; files kebab-case for modules/services, PascalCase for React admin
  components; variables/functions camelCase; types/interfaces PascalCase.
- Comments follow the comment rule in `ai/AGENTS.md`; the lint rule `no-plan-id-comments` enforces
  its ban on plan ids.

## Architectural patterns

These patterns govern sync operations, error handling and concurrency; breaking them has caused data
corruption and production incidents.

### 1. Sync triggers and jobs share one orchestration workflow

The rules (`arch-job-runs-workflow`, `arch-route-emits-long-work`, one orchestration workflow for a
job and its sync-trigger route) and their example are in the `medusa-backend` skill's
`reference/scheduled-jobs.md`, "Jobs, routes and the event hop".

### 2. Distributed locking

Rules `lock-single-run`, `lock-critical-section`, `lock-ttl` in Tier 0 `boundaries.md`; never in a
route (`NO_LOCKING_IN_ROUTES`). For a critical section use Medusa's `acquireLockStep` /
`releaseLockStep` or a custom acquire step.

```typescript
// single run, in the trigger: acquire throws when the key is held
const ownerId = randomUUID()
try { await locking.acquire(SYNC_LOCK_KEY, { expire: 7200, ownerId }) } catch { return }
try { await syncWorkflow(container).run({ input: {} }) }
finally { await locking.release(SYNC_LOCK_KEY, { ownerId }).catch(() => undefined) }

// critical section, in the workflow
const lockOwnerId = transform({}, () => randomUUID())
acquireLockStep({ key: lockKey, ttl: 30, ownerId: lockOwnerId })
// …steps that read and change the locked data…
releaseLockStep({ key: lockKey, ownerId: lockOwnerId })
```

### 3. Error handling with retry

Wrap external API calls in the project's retry helper for transient failures, and collect
per-resource errors without stopping the sync.

A failed workflow rejects with a serialised object, not an `Error`: how to assert and log it is in
Tier 0 `medusa-boundary.md`, "Workflow failures".

### 4. Batch parallelization

Run independent operations (per store, per feed) in parallel batches of bounded size with the
project's batching helper rather than awaiting them one at a time in a `for…of`. Keep a sequential
loop only where order or a rate limit requires it.

### 5. Testing services that extend MedusaService

`MedusaService` generates its CRUD methods dynamically behind `@InjectManager`, so in unit tests
mock the generated methods on the instance; don't mock `manager_` or `baseRepository_`.

```typescript
service = new BlogModuleService({} as any)
service.listPosts = mockListPosts as any
// ✗ Object.defineProperty(service, "manager_", { get: () => mockManager })
```

### 6. Payment provider webhooks

Standard Medusa payment webhooks use `/hooks/payment/:provider`. A custom route is justified only
when the provider needs a custom signature format, IP allowlisting or other source validation, or
the raw body for signature verification. A custom route implements equivalent security checks, and
the provider's architecture doc records why the standard route is insufficient.

### 7. Typing `query.graph()` result rows

The cast rule is Tier 0 (`medusa-boundary.md` Types, `NO_UNKNOWN_CAST`). Declare one row type per
selection as a structural subset of the generated type, covering only the fields selected, so a
real row assigns to it with no cast. Share that type (and its field list) across every call site
instead of hand-rolling a row type per route. A value the row cannot carry (a computed field, see
`data-schema-vs-model`) is not declared on the row; it arrives as a separate input.

```typescript
export type RawOrderStatusRow = {          // subset of the real order row: every field is a column
  id: string
  status: string                           // order.status
  fulfillments?: ({ packed_at: Date | string | null; shipped_at: Date | string | null } | null)[] | null
}
export function assembleStatusInput(row: RawOrderStatusRow, derived: DerivedInputs) { /* … */ }
// ✗ const row = data[0] as unknown as OrderRow   (a per-route type that drifts from `fields`)
```

A refactor once swapped per-route `as unknown as X` for direct `as X` without keeping each route's
row type in sync with its selected fields, and produced 50 typecheck errors across 30 files. With
one shared row type a mismatch fails in one place.

### 8. External service integration (fire-and-forget subscribers)

A subscriber that pushes to an external service (search, analytics) logs a failure and doesn't
throw, so a failed push never blocks the sync that emitted the event.

```typescript
export default async function searchProductUpdateHandler({ event, container }) {
  try {
    await searchClient.sendProducts([await fetchProduct(event.data.id)])
  } catch (error) {
    logger.error(`Search sync failed: ${error.message}`)
  }
}
```

### 9. Never assert on source code as text

The rule and its order of alternatives are in Tier 0 `verification.md`; this adds the Medusa-side
reasons. Why: such a test fails on
rename and passes on defect; a grep for `timingSafeEqual` matches a comment and can't tell a
reachable call from dead code, and a ban on a column name fires on the comment explaining that the
file avoids it. That covers `fs.readFileSync` with `toContain`, regex over file text, and `indexOf`
standing in for call order. An absence claim over a set of files belongs in a rule in the project's
lint config: a test covers only the files someone named, the linter all of them. If behaviour,
exports and a lint rule all fail, drop the test and say why in the task's test intent. Data
artefacts (a fixture, a registered metadata document, a generated asset) are the exception.

## Pattern enforcement

The project's lint config checks these patterns in every file, and each rule's message names the
defect class it came from. Don't `eslint-disable` a rule or weaken it to pass a task (Tier 0
`rules.md`).
