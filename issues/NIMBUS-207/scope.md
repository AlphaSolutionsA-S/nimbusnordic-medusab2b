# Quote responses expose the company's financial details

**Date:** 2026-10-21
**Status:** Implemented
**Type:** Bug
**Priority:** Medium (Jira; `bug.md` registered it as Major)
**Issue:** NIMBUS-207 (relates to NIMBUS-177)
**Key:** NIMBUS-207
**Case folder:** issues/NIMBUS-207/
**Base Branch:** develop (work branch `feature/NIMBUS-207`)

## Background

When a signed-in customer lists, opens, creates, accepts, rejects, previews or messages one of their
quotes, the backend returns the customer's whole company record with the quote. That record holds
the company's credit limit, blocked status, spending-limit reset frequency and Business Central sync
time. The storefront shows only the company name.

The portal already has a rule for who sees which company data, implemented in the store company
profile (`apps/backend/src/api/store/companies/company-projection.ts`, from NIMBUS-157):

- Every employee of the company sees the basic company profile (name, logo, contact, address,
  currency, VAT number, Business Central customer number) and colleagues' names and contact details.
- Only a company administrator sees the credit limit, blocked status, spending-limit reset frequency
  and colleagues' spending limits.

The quote routes bypass that rule: any employee, administrator or not, receives the
administrator-only fields with every quote. The cart routes were closed against the same exposure
on purpose (`apps/backend/src/api/middlewares.ts`, company fields listed one by one).

A second, wider gap was found while scoping: the store quote routes have no field allowlist. In the
installed Medusa (2.21.0, `@medusajs/framework/dist/http/utils/get-query-config.js`,
`prepareListQuery`) caller-supplied `fields` are filtered only when the route config sets `allowed`
or `restricted`, or when the `rbac_filter_fields` flag and request policies apply. So narrowing the
defaults alone would not close the leak: a customer can ask for
`?fields=*customer.employee.company` or `*customer.employee.company.employees` (colleagues'
spending limits) on any quote route. Verified from installed source; not yet probed against a
running backend.

Correction to `bug.md`: it lists the VAT number and the Business Central customer number among the
exposed financial data. Under the shipped rule above every employee may already see those two fields
on the company profile, so returning them is not by itself a breach; they are still unneeded on a
quote and are dropped there.

## Requirements

### Functional

1. The store quote routes (list, create, retrieve, accept, reject, preview, messages) return the
   company only as far as the storefront uses it: the company name (see open question 1 on `id`).
2. The administrator-only company fields (credit limit, blocked status, spending-limit reset
   frequency) and the Business Central sync time are never returned by a store quote route, for
   any role.
3. A caller cannot widen a quote response with the `fields` query parameter to reach company data,
   colleagues (employees of the company) or other data outside the permitted quote field set.
4. What the storefront shows on the quote pages today keeps working: quote list, quote details
   (own email, own phone, own spending limit, company name), quote messages (author names), the
   draft-order totals and items, accept, reject and preview.

### Non-functional

- No data-model or migration change.
- The rule for which company fields a role may see keeps one home (the store company projection);
  the quote routes do not re-implement the administrator tier, they just never carry those fields.
- Negative contract tests in `apps/backend/integration-tests/http/security/security-boundaries.spec.ts`
  per property below.

## Business rules

- Employee (administrator or not) reads one of their own quotes → the quote's company carries the
  company name only (plus `id` if open question 1 says so).
- Any role, any store quote route → credit limit, blocked status, spending-limit reset frequency and
  Business Central sync time are never in the response.
- Any role passes `fields` asking for more company data, for colleagues, or for any relation outside
  the permitted set → those fields are not returned (stripped or refused, see security table).
- Employee reads their own quote → their own contact details and their own spending limit are shown,
  as today (their own data, also available from `/store/customers/me`).
- Company administrator who needs the credit limit or blocked status → reads it from the company
  profile, not from a quote (unchanged).
- Customer reads another customer's quote → refused, as today (all routes filter by the caller's
  customer id); unchanged by this work.
- No writes change: nothing new is written, no actor is recorded.

## Data model (draft)

No stored data changes. The rows describe what the store quote response may carry.

| Field reached through a quote | Owner | Stored or derived | Sensitive? | In a store quote response after the fix |
|---|---|---|---|---|
| `company.name` | company module (BC-managed) | stored | low | yes |
| `company.id` | company module | stored | low | ? (open question 1) |
| `company.credit_limit`, `blocked`, `spending_limit_reset_frequency` | company module | stored, synced from BC | financial, admin-only | no |
| `company.business_central_synced_at` | company module | stored | internal | no |
| `company.vat_number`, `business_central_customer_number`, contact and address | company module | stored | company data, visible to all members via profile | no (not needed) |
| `company.employees` (colleagues, their spending limits) | company module | stored | admin-only spending limits | no |
| `customer.employee.spending_limit`, `is_admin` (the caller's own) | company module | stored | own data | yes (shown on quote details) |
| `customer` email, phone, names (the caller's own) | Medusa customer | stored | personal, own | yes |
| `messages.admin` (the merchant user who wrote a message) | Medusa user | stored | personal (staff) | first and last name; other fields ? (open question 3) |
| `messages.customer` (message author) | Medusa customer | stored | personal | ? names only (open question 3) |

Retention: unchanged; no new storage.

## Security properties (draft)

| Property | Intended control | Trust root | Failure behaviour |
|---|---|---|---|
| Quote owner only | Every store quote route filters by the authenticated customer id (existing) | Medusa customer session or bearer token | Not found or forbidden (existing tests: "denies foreign quote ...") |
| No administrator-only company fields via quotes | The quote field set excludes them, for every role | Server-side route config, not the client | Field absent from the response |
| `fields` cannot widen the response | An allowlist (or equivalent restriction) on the store quote query config | Server-side config; Medusa's field filter (verify the exact behaviour) | Disallowed fields stripped silently or 400; to be confirmed from installed source and pinned by a test |
| No colleague data via quotes | `company.employees` and deeper paths outside the permitted set | Same | Absent |
| Personal data on failure | Errors log the message only (existing rule) | — | No company or customer data in logs |

Not affected: auth trust anchor, replay, cross-instance, CSRF, logout (no change to authentication).

## Affected apps

- Backend: `apps/backend/src/api/store/quotes/` (query config and middlewares); security and quote
  HTTP specs.
- Storefront: no code change expected; the quote pages read only fields that stay. The planner or
  fixer confirms against `apps/storefront/src/lib/data/quotes.ts` and the quote components.
- Admin quote routes (`apps/backend/src/api/admin/quotes/`): out of scope.

## Proposed structure

Bug, about two tasks in one app:

1. Restrict the store quote field set: narrow the company selection to what the storefront uses and
   stop caller-supplied `fields` from widening the response; contract tests for a non-admin
   employee, an administrator and a widening attempt.
2. Confirm the storefront quote pages against the narrowed response (type check and the quote page
   reads); update any existing quote spec that asserts the full company.

"Also update" candidates: `apps/backend/integration-tests/http/quotes/quotes.spec.ts` (fails today
per the baseline), `security-boundaries.spec.ts`, and `ai/architecture/decisions.md` if the human
wants the role-based company field visibility registered as a rule (open question 4).

## Open questions

1. Should the quote's company carry `id` as well as `name`? The storefront reads only `name`; the
   cart routes allow `id`, `name`, `approval_settings`. Proposed: `name` only, add `id` only if a
   consumer needs it.
2. When a customer asks for a field outside the permitted set, should the request fail (400) or the
   field just be left out? Proposed: whatever Medusa's allowlist does natively (to be confirmed),
   pinned by a test.
3. The quote also returns the full merchant user record on messages (`*messages.admin`: likely
   including the staff member's email; column list UNVERIFIED) and the full customer record of each
   message author. The storefront shows only first and last names. Include narrowing these in this
   bug, or register a separate one? Proposed: include, since the same allowlist covers it.
4. Register "company field visibility by role" (basic vs administrator tier, owned by
   `company-projection.ts`) in `ai/architecture/decisions.md`? It is a business rule with no row
   today.
5. Priority: Jira says Medium, `bug.md` says Major. Any employee can read their company's credit
   limit and blocked status today, and colleagues' spending limits through `fields`. Keep Medium?

Answers (Klaus Petersen, 2026-10-21): all five as proposed. 1: `name` only. 2: Medusa's native
allowlist behaviour, pinned by a test. 3: include narrowing message authors to names. 4: add the
row to `decisions.md`. 5: keep Medium.

## Dependencies

- Relates to NIMBUS-177 (company-linked cart protection), whose planner found this bug; no ordering
  dependency.
- Builds on the company field tiers from NIMBUS-157 (company information read-only in the storefront).
- Baseline: quote HTTP specs fail today (`ai/architecture/verification.md`); a new security spec
  case must run green on its own.

## Documentation

- [docs/architecture/store-access.md](../../../docs/architecture/store-access.md) — Shared quote projection, field filtering and extension constraints (updated).
- [docs/architecture/order-api/overview.md](../../../docs/architecture/order-api/overview.md) — Quote responses no longer expose the Order API flag (updated).

AI base files updated: `ai/architecture/decisions.md` (company field visibility owner),
`ai/skills/medusa-api-route/project.md` (exact-path allowlist and local relation depth), with
generated `AGENTS.md` and `.github/copilot-instructions.md` refreshed during implementation.

Implementation is complete. HTTP/database verification remains blocked by the guarded test
environment configuration; Klaus Petersen accepted proceeding with that recorded gap on
2026-10-24. Controlled response and quote/conversation display verification is still required
after deployment, as recorded in `deviation-report.md`.
