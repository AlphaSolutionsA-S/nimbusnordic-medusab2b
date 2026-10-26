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
