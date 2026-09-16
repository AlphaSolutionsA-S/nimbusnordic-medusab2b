# Task 01 — Store company authorization and response projection

**App:** backend
**Depends on:** NIMBUS-156
**Base branch:** \`develop\`

## Goal

Make \`GET /store/companies/:id\` and customer-accessible employee reads safe for a linked
company member. The server, not the browser, decides whether the actor may receive financial
company information.

## Files

### Modify: \`apps/backend/src/api/store/companies/[id]/route.ts\`

- Preserve the existing Business Central freshness synchronization.
- Resolve \`customer_id\` from the authenticated request and load its employee/company link.
- Return 403/404 according to the repository's existing not-found/access-control convention when
  the route id is not the actor's linked company; never rely on the requested id as authority.
- Resolve the established \`company_admin\` role from the authenticated identity using the same
  source as \`ensureRole\`.
- Return an allowlisted profile DTO. Non-admin DTOs must omit \`credit_limit\`, \`blocked\`,
  \`spending_limit_reset_frequency\`, and every employee \`spending_limit\`; admin DTOs include them.
- Remove or reject \`POST /store/companies/:id\` for customer callers once the usage search proves
  \`apps/storefront/src/lib/data/companies.ts:updateCompany\` is its only caller. Do not affect
  \`/admin/companies/:id\` mutations.

### Modify: \`apps/backend/src/api/store/companies/query-config.ts\`, \`middlewares.ts\`, and employee read routes

- Keep query fields internal to the route; do not allow a caller-provided \`fields\` selection to
  bypass the DTO projection.
- Apply the same target-company ownership check and restricted-field projection to
  \`GET /store/companies/:id/employees\` and
  \`GET /store/companies/:id/employees/:employeeId\`, or remove unused customer read endpoints if
  the usage search proves they are not needed.
- Do not add any restricted field to \`StoreCreateCompany\` or \`StoreUpdateCompany\` validators.

### Modify: \`apps/backend/integration-tests/http/companies/companies.spec.ts\`

Add fixtures for a company admin, a regular linked employee, and a customer linked to another
company. Test direct company retrieval and each retained employee read endpoint.

## Test cases

- **TC-1:** a linked regular employee receives basic company data and no \`credit_limit\`,
  \`blocked\`, \`spending_limit_reset_frequency\`, or nested \`spending_limit\` property.
- **TC-2:** a linked \`company_admin\` receives all four authorized financial values.
- **TC-3:** another authenticated company's member cannot retrieve the target company or its
  employee data.
- **TC-4:** the selected-fields query parameter cannot restore a redacted value.
- **TC-5:** the existing freshness-sync behavior still returns the latest permitted basic fields.
- **TC-6:** the removed/rejected store company update path cannot mutate a company; Admin updates
  remain covered by their existing route tests.

## Validation

- \`pnpm --filter @b2b-starter/backend test:integration:http\`
- \`pnpm --filter @b2b-starter/backend build\`
- Review every returned JSON object and error body for restricted values, tokens, or raw BC data.
