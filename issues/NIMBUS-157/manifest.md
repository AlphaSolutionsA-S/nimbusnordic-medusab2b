# Implementation Manifest: NIMBUS-157 — Make company information read-only in the storefront

**Project ID:** NIMBUS-157
**Date:** 2026-09-16
**Ready for Dispatch:** true

## Dependency status

NIMBUS-156's synchronized company fields and login-sync workflow are implemented in the current
workspace. Its tracker status is Internal review; no further API contract is required before
starting this issue.

## Branch

\`feature/NIMBUS-157\` (from \`develop\`)

## Tasks

| # | Title | File | App | Depends On | Status |
|---|-------|------|-----|------------|--------|
| 01 | Store company authorization and response projection | \`01-store-company-authorization-implementation.md\` | backend | NIMBUS-156 | TODO |
| 02 | Read-only storefront company profile | \`02-storefront-readonly-profile-implementation.md\` | storefront | 01 | TODO |
| 03 | Admin BC warning, indicators, and editable fields | \`03-admin-bc-indicators-implementation.md\` | backend Admin | NIMBUS-156 | TODO |
| 04 | Cross-application tests and validation | \`04-validation-implementation.md\` | backend + storefront | 01, 02, 03 | TODO |

## Dispatch order

1. Tasks **01** and **03** may run in parallel.
2. Task **02** starts after Task 01 establishes the store response contract.
3. Task **04** is the final validation gate.

## Cross-task wiring

- Task 01 owns the customer-safe store response shape. Task 02 must consume that shape without
  client-side role logic or a mutation helper.
- Task 03 expands only Admin validation and presentation. It must not add BC-managed fields to
  store validators or store write payloads.
- Task 04 tests the API boundary directly, then verifies the corresponding storefront and Admin
  behavior.

## Environment and dependencies

No database migration, environment variable, or package installation is expected. Existing
\`@medusajs/ui\`, React Query, and Medusa SDK patterns are reused.
