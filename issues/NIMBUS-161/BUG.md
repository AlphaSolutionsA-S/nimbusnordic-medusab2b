# Company freshness sync can refresh the wrong company

- **Tracker:** JIRA — [NIMBUS-161](https://alphasolutionsdk.atlassian.net/browse/NIMBUS-161) (relates to NIMBUS-160)
- **Severity:** Major
- **Area:** Backend — `apps/backend/src/api/store/companies/[id]/route.ts` (Business Central freshness sync, introduced in NIMBUS-160)
- **Reported by:** Claude Code (code review of NIMBUS-160), on behalf of klp@alpha-solutions.dk
- **Reported at:** 2026-08-24T11:59:36Z

## Summary
The `GET /store/companies/:id` freshness check reads the staleness of the company identified by the URL `:id`, but the Business Central sync it triggers always refreshes the company linked to the **authenticated customer** (via `customer.employee.company`), not the company identified by `:id`. There is no check that these are the same company, and `/store/companies/:id` has no ownership/role middleware restricting `:id` to the caller's own company. In today's single-flow storefront usage the two happen to always match, but nothing enforces it, so the route silently does the wrong thing whenever they diverge.

## Steps to reproduce
1. Authenticate as a customer belonging to Company A, with `business_central_synced_at` fresh (< 10 minutes old).
2. Find or guess the id of another company, Company B, whose `business_central_synced_at` is stale (or null).
3. Call `GET /store/companies/{companyB.id}` using Company A's session.
4. Observe: the route reads Company B's stale timestamp, decides to sync, and calls `syncCompanyFromBusinessCentralWorkflow({ customerId: companyA.customer.id })` — which resolves and updates **Company A**, not Company B.

## Expected
Either the sync should target the company being requested (`:id`), or the route should refuse/ignore requests where `:id` doesn't match the caller's own linked company.

## Actual
- Company B's data is never actually refreshed through this path (its `business_central_synced_at` never advances), even though the route repeatedly detects it as stale.
- Company A gets an extra, spurious Business Central sync call it didn't ask for, triggered purely by another customer viewing an unrelated company id.
- Any authenticated customer can trigger a real outbound Business Central API call for their own company just by requesting an arbitrary company id, since `/store/companies/:id` has no ownership check (`apps/backend/src/api/store/companies/middlewares.ts` only requires `authenticate("customer", ...)` on the whole matcher).

## Environment
- OS: N/A (backend API logic issue, environment-independent)
- Browser / runtime: Medusa v2 backend, Node
- Build / commit: found on `feature/NIMBUS-160` at commit `b95b99c` (branched from `develop`)
- Tenant / data context: any store tenant with more than one company

## Evidence
- [`apps/backend/src/api/store/companies/[id]/route.ts:36-62`](https://github.com/AlphaSolutionsA-S/nimbusnordic-medusab2b/blob/develop/apps/backend/src/api/store/companies/%5Bid%5D/route.ts#L36-L62) — staleness check reads `:id`, then calls `syncCompanyFromBusinessCentralWorkflow(req.scope).run({ input: { customerId: customer_id } })`.
- [`apps/backend/src/workflows/company/steps/prepare-company-bc-sync.ts:33-46`](https://github.com/AlphaSolutionsA-S/nimbusnordic-medusab2b/blob/develop/apps/backend/src/workflows/company/steps/prepare-company-bc-sync.ts#L33-L46) — the step resolves the company from `customerId` via `customer.employee.company`, ignoring any target id.
- [`apps/backend/src/api/store/companies/middlewares.ts:51-60`](https://github.com/AlphaSolutionsA-S/nimbusnordic-medusab2b/blob/develop/apps/backend/src/api/store/companies/middlewares.ts#L51-L60) — `GET /store/companies/:id` has no ownership/role middleware beyond `authenticate("customer", ...)`.
- Confirmed intended usage today is always same-company: [`apps/storefront/src/app/[countryCode]/(main)/account/@dashboard/company/page.tsx:17`](https://github.com/AlphaSolutionsA-S/nimbusnordic-medusab2b/blob/develop/apps/storefront/src/app/%5BcountryCode%5D/\(main\)/account/@dashboard/company/page.tsx#L17) calls `retrieveCompany(customer.employee.company.id)`.

## Analysis
*(Leave empty initially. Fill in `ANALYSIS.md` when investigation starts and link from here.)*

## Suggested fix direction
Before triggering the sync in the GET route, verify that the authenticated customer's own company id equals the requested `:id` (e.g. resolve it via the same `customer.employee.company` lookup used in `prepare-company-bc-sync.ts`), and skip the sync (or reject the request) when they differ — rather than syncing whatever company the caller happens to belong to.
