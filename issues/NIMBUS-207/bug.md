# Quote responses in the storefront expose the company's financial details

- Tracker: Jira (NIMBUS) — https://alphasolutionsdk.atlassian.net/browse/NIMBUS-207 (relates to NIMBUS-177)
- Severity: Major
- Area: Backend, store quote API (`apps/backend/src/api/store/quotes/`); storefront quote details page
- Reported by: Klaus Petersen (found by the NIMBUS-177 implementation planner, `issues/NIMBUS-177/plan.md` section 10)
- Reported at: 2026-10-21T12:52:00Z

## Summary
When a signed-in customer opens or changes one of their quotes, the backend returns the full record
of the customer's company along with the quote, including the company's credit limit, blocked
status, VAT number and Business Central customer number. The storefront only shows the company
name. Cart responses already limit company data to the name, ID and approval settings on purpose, so
quotes are inconsistent with that rule and expose financial and company data the customer was not
meant to receive.

## Steps to reproduce
1. Sign in to the storefront as an employee of a company that has a quote.
2. Call `GET /store/quotes/:id` (or `GET /store/quotes`, or any of the quote POST routes) with the
   customer's session or bearer token and no `fields` parameter.
3. Inspect `quote.customer.employee.company` in the response.

Not yet reproduced against a running system; derived from the code below.

## Expected
The quote's company carries only what the storefront needs (today: `name`; the cart routes allow
`id`, `name`, `approval_settings`), consistent with the cart field list in
`apps/backend/src/api/middlewares.ts`.

## Actual
Every scalar column of the `company` model is selected and returned, among them `credit_limit`,
`blocked`, `vat_number`, `business_central_customer_number`, `business_central_synced_at`,
`spending_limit_reset_frequency`, `email`, `phone` and the address fields.

## Environment
- OS: any
- Browser / runtime: Medusa backend 2.21.0 store API
- Build / commit: `develop` at e4f7351
- Tenant / data context: any company-linked customer with a quote

## Evidence
- `apps/backend/src/api/store/quotes/query-config.ts:6`: `"*customer.employee.company"` in
  `quoteFields`, the `defaults` of both `retrieveQuoteTransformQueryConfig` (line 50-53) and
  `listQuotesTransformQueryConfig` (line 55-58).
- `apps/backend/src/api/store/quotes/middlewares.ts:29,37-40,47-50,58-61,69-72,79-82,90-93`: every
  store quote route (list, create, retrieve, accept, reject, preview, messages) uses these configs.
- `apps/backend/src/api/store/quotes/[id]/route.ts:20-32`: `query.graph` with
  `req.queryConfig.fields`, response `res.json({ quote })`, so the selection reaches the client
  unfiltered (scoped to `customer_id` = caller, so the owner sees their own company).
- `apps/backend/src/modules/company/models/company.ts:9-28`: the company columns, including
  `credit_limit` (24), `blocked` (21-23), `vat_number` (25), `business_central_customer_number` (19).
- `apps/backend/src/api/middlewares.ts:18-31`: the cart routes list company fields one by one; the
  comment at lines 21-22 states that `*company` would expose the admin-only financial fields.
- `apps/storefront/src/app/[countryCode]/(main)/account/@dashboard/quotes/components/quote-details/index.tsx:216`:
  the only storefront use found, `quote.customer?.employee?.company?.name`.

Not checked at triage: whether `GetQuoteParams` lets a client widen `fields` beyond the defaults,
the other storefront quote consumers, and what the existing quote HTTP specs
(`apps/backend/integration-tests/http/quotes/quotes.spec.ts`,
`apps/backend/integration-tests/http/security/security-boundaries.spec.ts`) assert about the company.
The admin quote config (`apps/backend/src/api/admin/quotes/query-config.ts`) is admin-only and out of
this case.

## Analysis
*(Leave empty initially. Fill in `analysis.md` when investigation starts and link from here.)*
