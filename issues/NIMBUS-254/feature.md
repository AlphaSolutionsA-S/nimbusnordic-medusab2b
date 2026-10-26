# Sync a company from Business Central now, from the Admin company page

- Tracker: Jira (NIMBUS) — [NIMBUS-254](https://alphasolutionsdk.atlassian.net/browse/NIMBUS-254) (parent epic NIMBUS-128, Customer Login)
- Priority: Should (Jira priority Medium; Jira has no MoSCoW values)
- Size: S
- Area: Medusa Admin company detail page; Business Central company sync
- Requested by: Klaus Petersen
- Requested at: 2026-10-26T00:00:00Z

## Description
On the Medusa Admin company page, an administrator can choose an action in the company's "..." menu
that updates the company from Business Central straight away, instead of waiting until a customer
from that company logs in or opens the company page in the storefront. The administrator sees
whether the update succeeded, and the page shows the refreshed Business Central values.

## Why
Business Central is the source of truth for a company's name, contact details, address, blocked
status, credit limit, VAT number and currency. Today Medusa only picks up changes when one of the
company's customers logs in or views the company page, so an administrator who has just changed a
customer in Business Central (for example blocked it or changed its credit limit) cannot make Medusa
reflect that until a customer happens to visit.

## Acceptance criteria
- [ ] The company page's action menu has an action to sync the company from Business Central now.
- [ ] Running it updates the company's Business Central-managed fields with the current Business
      Central values and records when the company was last synced.
- [ ] The administrator is told the outcome: updated, nothing to sync (to define: no Business
      Central customer number, no matching customer), or failed.
- [ ] After a successful sync the page shows the new values without a manual reload.
- [ ] Medusa-only fields (order API setting, customer group, approval settings) are unchanged.
- [ ] Only Admin users can run it.

## Out of scope
- Syncing all companies at once, or a scheduled sync.
- Changing which fields are Business Central-managed.
- Changing the existing sync on customer login and on viewing the storefront company page.

## Open questions
- "asap": read as "sync now, on demand" rather than an urgency signal. Confirm.
- Should the action be shown (or enabled) for a company without a Business Central customer number?
- Should the page show when the company was last synced from Business Central?
- If Business Central marks the customer as blocked, is the immediate effect in the storefront
  (blocked company) intended to follow from an Admin-triggered sync as it does from login?
- Is a guard against repeated clicks or a sync running at the same time as a login sync needed?

## Mockups / references
- Screenshot pasted in the request: Admin company detail page with the Business Central-authoritative
  banner and the action menu (Edit details, Manage customer group, Approval settings, Delete).
- Related: NIMBUS-156 (sync on login), NIMBUS-160 (freshness sync on the company page), NIMBUS-161
  (freshness sync could refresh the wrong company).

## Technical notes
Triage look at the code (area only, not a design):
- Workflow `apps/backend/src/workflows/company/workflows/sync-company-from-business-central.ts`
  with step `steps/prepare-company-bc-sync.ts`: input is a customer id (optional expected company
  id); it resolves the company through the customer's employee record, reads the BC customer by the
  company's BC customer number and updates the company via `updateCompaniesStep`. Result status:
  updated / skipped / failed. No company-id entry point today, so an Admin trigger needs one.
- Triggers today: `POST /store/customers/me/company/sync-business-central` (storefront login, via
  `apps/storefront/src/lib/data/customer.ts`) and the 10-minute freshness check in
  `GET /store/companies/:id` (`apps/backend/src/api/store/companies/[id]/route.ts`).
- No admin sync route and no lock around the company sync.
- Admin UI: `apps/backend/src/admin/routes/companies/components/company-actions-menu.tsx`; admin
  routes under `apps/backend/src/api/admin/companies/`.
- Existing coverage: `apps/backend/integration-tests/http/customers/company-sync.spec.ts`.
