# Sync a company from Business Central now, from the Admin company page

> Record of NIMBUS-254, frozen when the work shipped. Not maintained: the code and docs/architecture/ describe current behaviour.

**Date:** 2026-10-26
**Status:** Implemented (2026-10-26)
**Type:** Story
**Priority:** Medium (MoSCoW: Should)
**Issue:** [NIMBUS-254](https://alphasolutionsdk.atlassian.net/browse/NIMBUS-254) (parent epic NIMBUS-128, Customer Login)
**Key:** NIMBUS-254
**Case folder:** issues/NIMBUS-254/
**Base Branch:** develop

## Background

Business Central (BC) is the source of truth for a company's name, contact details, address, blocked
status, credit limit, VAT number and currency. Medusa copies those values onto the company today only
when one of the company's customers logs in (NIMBUS-156) or opens the storefront company page while
the copy is more than 10 minutes old (NIMBUS-160, guarded by NIMBUS-161). An administrator who has
just changed a customer in BC cannot make Medusa reflect it until a customer happens to visit.

This story adds an on-demand "Sync from Business Central" action to the Admin company page.

What the code does today (checked 2026-10-26):

- One workflow does the sync, keyed on a **customer**: it finds the customer's company through their
  employee record, reads the BC customer by the company's BC customer number and overwrites the
  BC-managed fields plus the "last synced" time. Outcomes: updated, skipped (no company, no BC
  customer number, no matching BC customer, or the customer belongs to another company) or failed
  (an expected BC error). An unexpected error is not converted to "failed"; it fails the request.
- There is no way to start it from a company (a company with no employees cannot be synced at all),
  no Admin route for it, and no lock.
- The Admin company page does not load or show the "last synced" time; its banner says BC-managed
  fields are overwritten "when a customer from this company logs in".
- Blocked status and credit limit are **display-only** today: the storefront company card and the
  Admin page show them; no checkout, approval or spending-limit rule reads them.
- The storefront caches the company response per visitor for up to 120 seconds.

## Requirements

### Functional

1. The Admin company page's action menu has a "Sync from Business Central" action.
2. Running it reads the company's BC customer by the company's BC customer number and overwrites the
   same BC-managed fields the login sync overwrites (name, email, phone, address, city, state, zip,
   country, blocked, credit limit, VAT number, currency), and records the sync time.
3. The action is disabled, with a tooltip explaining why, when the company has no BC customer number.
4. The administrator is told the outcome:
   - **Updated**: the values were refreshed.
   - **Nothing to sync**: BC has no customer with that number (and, defensively, the company has no
     BC customer number).
   - **Failed**: BC could not be reached or returned an error; nothing was changed.
5. After a successful sync the page shows the new values and the new "last synced" time without a
   manual reload.
6. The page shows when the company was last synced from BC ("never" when it has not been).
7. Medusa-only fields are unchanged: order API setting, customer group, approval settings, employees,
   logo, BC customer number.
8. Only authenticated Admin users can run it.
9. The banner text on the page no longer says the overwrite happens only at customer login.

### Non-functional

- The sync works for a company with no employees.
- The existing triggers keep their behaviour: login sync (`POST /store/customers/me/company/sync-business-central`)
  and the 10-minute freshness sync in the storefront company read, including the NIMBUS-161
  wrong-company guard. Their existing tests stay green.
- One rule for "what a BC sync writes": the Admin action and the store triggers share it; no second
  copy of the field mapping.
- No personal data (company contact, address, VAT, credit) in logs; errors log the company id and
  message only.
- No new lock or repeat-click guard (human's decision, see Business rules).

## Business rules

Decided by Klaus Petersen, 2026-10-26, unless marked otherwise.

| # | Action or state | Outcome |
|---|---|---|
| R1 | "asap" in the request | Means "sync this company now, on demand", not an urgency level. |
| R2 | Admin user runs "Sync from Business Central" on a company with a BC customer number | Allowed. BC-managed fields are overwritten with BC's current values; the last-synced time is set. |
| R3 | Company has no BC customer number | Action shown but disabled, with a tooltip. If the call is made anyway, the outcome is "nothing to sync" and nothing changes. |
| R4 | BC has no customer with the company's number | Outcome "nothing to sync"; nothing changes, last-synced time unchanged. |
| R5 | BC unreachable or returns an error | Outcome "failed"; nothing changes, last-synced time unchanged. |
| R6 | Any sync (Admin or store) | Medusa-only fields are never written. BC is authoritative for the BC-managed fields (existing rule, `bc-managed-fields.ts`). |
| R7 | Non-admin caller (storefront customer, unauthenticated) | Refused by the Admin API's authentication. |
| R8 | BC blocked status or credit limit changed by an Admin sync | Takes effect in the storefront as it does after a login sync: the stored value changes at once. (Today these values are only displayed; see Open questions 1 and 2.) |
| R9 | Admin clicks repeatedly, or an Admin sync overlaps a login or freshness sync | No guard needed. Each run overwrites with BC's current values; the last writer wins. |
| R10 | Who ran the sync | Not recorded on the company. The last-synced time is the only stored trace (scoper's default; see Open question 3). |

## Data model (draft)

No new tables or columns.

| Entity.field | Meaning | Owner | Written by | Stored / derived | Sensitive? | Retention |
|---|---|---|---|---|---|---|
| `company.business_central_synced_at` | When the company's BC-managed fields were last copied from BC | `company` module | every BC company sync (login, freshness, Admin) | stored (exists) | no | life of the company |
| `company.<BC-managed fields>` | name, email, phone, address, city, state, zip, country, blocked, credit_limit, vat_number, currency_code | `company` module | BC company sync; Admin edit form for some | stored (exist) | yes: contact, address, VAT, credit data | life of the company |
| `company.business_central_customer_number` | Key of the BC customer | `company` module | Admin | stored (exists) | ? | life of the company |
| Admin company read response | adds `business_central_synced_at` | Admin API | — | derived (read) | no | — |
| Sync outcome | updated / nothing to sync / failed | Admin API response | — | derived, not stored | no | — |

## Security properties (draft)

The change touches personal and credit data (company contact, address, VAT, credit limit).

| Property | Intended control | Trust root | Failure behaviour |
|---|---|---|---|
| Only Admin users can trigger a sync | Route under the Admin API, which requires an authenticated admin user | Medusa admin auth (session or token) | 401, nothing changes |
| The sync writes only the target company | Company id from the route path; the company's own BC customer number decides which BC customer is read; no client-supplied BC number or field values | Medusa DB + BC | Unknown company id → 404; nothing changes |
| No client-controlled field values | Request has no body (or an empty one); values come only from BC | BC | Extra body fields rejected or ignored (planner to decide) |
| Medusa-only fields cannot be changed through this route | Same field mapping as the login sync | Shared mapping | — |
| No personal data in logs | Log company id and error message only | — | — |
| CSRF on the Admin API | Existing Medusa admin session protections; no new mechanism | Medusa | ? (planner to confirm nothing new is needed) |

## Affected apps

- Backend (`apps/backend`): company sync workflow and step, a new Admin route, Admin company read
  fields, Admin UI (action menu, page, hooks), integration tests.
- Storefront: no change.
- CMS: no change.

## Proposed structure

Story; high-level tasks (the planner decides the final breakdown):

1. A company-id entry point to the BC company sync, sharing the existing field mapping, without
   changing the customer-keyed triggers' behaviour.
2. An Admin route to sync one company now, returning the outcome; the Admin company read returns the
   last-synced time.
3. Admin UI: the "Sync from Business Central" action (disabled with tooltip without a BC customer
   number), outcome toasts, refreshed page data, a "Last synced from Business Central" row, banner
   text updated.
4. Tests: Admin route contract (admin only, updated, nothing to sync, failed, Medusa-only fields
   untouched, company without employees), security negative case, regression of the store triggers;
   Admin UI test for the disabled state.

Also update (to verify in planning): `apps/backend/src/admin/routes/companies/bc-managed-fields.ts`
(banner and comment wording), `ai/architecture/decisions.md` (BC-managed fields row: add the Admin
sync as a consumer), `docs/architecture/` company/BC sync section if one exists,
`integration-tests/http/security/security-boundaries.spec.ts`.

## Open questions

1. **Storefront delay.** The storefront caches a company for up to 120 seconds per visitor, and an
   Admin sync cannot clear that cache. A logged-in customer may see the old blocked status or credit
   limit for up to about two minutes after an Admin sync. Is that acceptable as "immediately" (R8)?
   Scoper's default: yes, accept and document; no storefront change.
   **Answer (Klaus Petersen, 2026-10-26):** Accepted. A customer may see the old blocked status or
   credit limit for up to about 120 seconds after an Admin sync; no storefront change.
2. **Blocked status and credit limit are display-only.** Nothing in checkout, approvals or spending
   limits reads them today, so "takes effect" means the storefront shows the new value. Confirm that
   enforcing a block or credit limit at checkout is out of scope for this story.
   **Answer (Klaus Petersen, 2026-10-26):** Confirmed. "Takes effect" means the storefront shows the
   new value; enforcing blocked status or credit limit at checkout is out of scope.
3. **Audit.** Should the Admin user who ran a sync be recorded anywhere (beyond a server log line)?
   Scoper's default: no.
   **Answer (Klaus Petersen, 2026-10-26):** No audit of which admin ran a sync (R10 stands).

Scope approved by Klaus Petersen on 2026-10-26.

## Dependencies

- Business Central customer API (existing client, `businessCentral` module).
- NIMBUS-156 (login sync), NIMBUS-160 (freshness sync), NIMBUS-161 (wrong-company guard): behaviour
  must not regress. The NIMBUS-161 guard (expected company id) is already on `develop`.

## Documentation

- [docs/architecture/business-central-company-sync.md](../../docs/architecture/business-central-company-sync.md) — BC company sync: login, freshness and Admin triggers (created)

AI base files updated: none (the `decisions.md` row was added by the branch itself; no Tier 0 budget for a link)
