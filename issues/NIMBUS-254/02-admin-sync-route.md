# 02: Admin sync route and last-synced time in the Admin company read
**App:** backend · **Layer:** L6 API route · **Depends on:** 01

**Goal:** `POST /admin/companies/:id/sync-business-central` runs the task 01 workflow with
`{ companyId: :id }` and returns `{ status }`. `GET /admin/companies[/:id]` returns
`business_central_synced_at`.
**Files / areas:** `apps/backend/src/api/admin/companies/[id]/sync-business-central/route.ts` (new),
`apps/backend/src/api/admin/companies/{middlewares,validators,query-config}.ts`,
`apps/backend/src/types/company/http.ts`,
`apps/backend/integration-tests/http/companies/companies.spec.ts`,
`apps/backend/integration-tests/http/security/security-boundaries.spec.ts`.
**Seam contracts:** request body `{}` only (strict schema; any key gives 400). Response 200
`{ status: "updated" | "skipped" | "failed" }`, exported as a response type in `types/company/http.ts`
for the Admin hook. 404 for an unknown id and 401 for a non-admin. Admin read field
`business_central_synced_at`: ISO string or `null`.
**Test intent:** (contract, `companies.spec.ts`, admin headers, `getCustomer` spied):
- `updated` with a body of `{}`. The response is exactly `{ status: "updated" }`, and a follow-up
  `GET /admin/companies/:id` returns the new name and a `business_central_synced_at` string. A
  second company stays unchanged.
- Each of `skipped` (no BC number) and `failed` returns 200 with its status. Unknown id: 404 and no
  BC call.
- A body with `name` or `business_central_customer_number` gives 400, and the company is unchanged.
- `GET` returns `business_central_synced_at` as `null` for a never-synced company.
- Security-boundaries: no auth gives 401, and a storefront customer bearer token gives 401. In both
  cases the company is unchanged and `getCustomer` is not called.
**Done when:** the route body has no `if` and makes no direct service or BC call, and the middleware
entry is registered. Lint passes and typecheck adds no new errors. The `decisions.md` row is added
and `pnpm ai:check` passes.
**Verify after deploy:** `company.business_central_synced_at` for one company with a BC customer
number (pick it in Admin) changes from its prior value to the time of the Admin sync. On a company
without a BC number the action is disabled.
**Also update:** `ai/architecture/decisions.md`: a new row. The rule is "BC company sync: fields
written, outcomes updated/skipped/failed". The owner is
`B/workflows/company/steps/prepare-company-bc-sync.ts`. The verdict goes out through the workflow
status. The consumers are the login route, the store company read (freshness) and the Admin sync
route. Status: ok. `ai/skills/medusa-admin/project.md` needs no change (searched).

## Deviations

- **Blocking: `pnpm ai:check` fails.** The new `decisions.md` row pushes the generated root
  `AGENTS.md` to 32930 bytes, over the 32768 Codex limit (`limits.agents_md_bytes`, `ai/harness.json`).
  At HEAD it had 19 bytes of headroom, so any new Tier 0 row exceeds it. The row is already cut to
  its shortest faithful form. Raising the limit, or trimming other teams' Tier 0 text, is a
  harness and contract decision for the human. It was not made here. `--fix` regenerated
  `AGENTS.md` and `.github/copilot-instructions.md`.
- Touched task 01's workflow (`sync-company-from-business-central.ts`): its result `transform`
  now declares `SyncCompanyFromBusinessCentralResult` as its return type. Without that, `status`
  widened to `string`, and the route's typed response (`MedusaResponse<AdminSyncCompanyBusinessCentralResponse>`)
  did not compile. This is a type annotation only, with no behaviour change and no cast.
- Added cases: the 400 cases also assert no BC call. The `updated` case also asserts the
  security-matrix row "Medusa-only fields never change" (`order_api_enabled`, `logo_url`,
  `spending_limit_reset_frequency`, BC number), which the plan assigns to this task. The
  never-synced case checks the list read as well as the single read.
- Test companies in the new describe are created through the company service with no employees
  (not via `/store/companies`), so the cases exercise the company-id path the Admin uses.
- The contract and security cases are written, not run (plan section 2: no `.env`, BC
  test-environment guard, NIMBUS-236).

## Done-when evidence

- The route body has no `if` and makes no direct service or BC call:
  `apps/backend/src/api/admin/companies/[id]/sync-business-central/route.ts` is one workflow
  run and `res.json`, with no imports from `modules/`. Code review.
- Middleware entry registered: `POST /admin/companies/:id/sync-business-central` with
  `validateAndTransformBody(AdminSyncCompanyBusinessCentral)` (`z.object({}).strict()`) in
  `apps/backend/src/api/admin/companies/middlewares.ts`. Proven by `companies.spec.ts`
  "refuses a body of %j and leaves the company unchanged" (written, not run).
- `updated` / `skipped` / `failed` / 404 / GET `null`: `companies.spec.ts`, describe
  "POST /admin/companies/:id/sync-business-central" and "GET /admin/companies - Business Central
  last-synced time" (written, not run; plan section 2).
- 401 for no auth and a customer token, with the company unchanged and no `getCustomer` call:
  `security-boundaries.spec.ts` "denies %s credentials on the Admin company Business Central sync"
  (written, not run).
- Lint passes: `corepack pnpm --filter @b2b-starter/backend lint` gives 0 errors and no warnings in
  touched files.
- Typecheck adds no new errors: 22 errors, the same set as `tsc-baseline.txt` (diffed).
- `decisions.md` row added: yes. `pnpm ai:check` passes: **no**, see the blocking deviation.
- Also update `ai/architecture/decisions.md`: row "BC company sync: fields written;
  updated/skipped/failed" added. Generated copies were refreshed by `ai:check --fix`.
- Also update `ai/skills/medusa-admin/project.md`: no change needed (per the task, searched).
