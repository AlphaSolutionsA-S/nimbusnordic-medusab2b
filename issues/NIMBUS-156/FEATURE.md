# Sync Business Central customer data to Medusa company on login

- **Date:** 2026-08-21
- **Status:** Feature captured
- **Type:** Story
- **Tracker:** JIRA — https://alphasolutionsdk.atlassian.net/browse/NIMBUS-156
- **Priority:** Medium
- **Project Folder:** issues/NIMBUS-156/
- **Size:** M
- **Area:** Backend / Business Central Integration
- **Base Branch:** develop
- **Requested by:** Klaus Petersen
- **Requested at:** 2026-08-21T12:00:00Z

## Description

When a Customer Portal user logs in, the backend should read the matching Business Central
customer record (resolved via the company's stored `business_central_customer_number`) and
update the Medusa company model with the direct field matches. This keeps the portal company
profile in sync with the authoritative BC customer master data.

## Why

The Medusa company model currently stores only a manually maintained BC customer number.
The BC Customer entity holds the authoritative name, address, currency, credit limit, VAT
number, and blocked status. Syncing these on login ensures the portal always reflects the
current state in BC without manual duplication, and surfaces financial/credit information
(blocked, credit limit) that the portal currently has no visibility into.

## Acceptance criteria

- [ ] On login, the backend fetches the BC Customer by the stored `business_central_customer_number`
- [ ] Direct field matches are written to the Medusa company: `name` (← `displayName`), `email`, `phone` (← `phoneNumber`), `city`, `state`, `zip` (← `postalCode`), `country`
- [ ] `address` is set to `addressLine1 + ", " + addressLine2` when `addressLine2` is non-empty, otherwise just `addressLine1`
- [ ] New fields are added to the Medusa company model: `blocked` (← BC `blocked` enum, mirrored as Medusa enum: `""`, `"Ship"`, `"Invoice"`, `"All"`), `credit_limit` (← BC `creditLimit`, bare decimal), `vat_number` (← BC `taxRegistrationNumber`)
- [ ] `currency_code` is updated from the BC `currency` navigation property (expand `currency` on the BC Customer GET)
- [ ] Fields not present in BC (`spending_limit_reset_frequency`, `employees`, `customer_group`, `logo_url`) are preserved and not overwritten
- [ ] The sync is read-only from BC to Medusa; no data flows back to BC
- [ ] The sync runs on every login (no `lastModifiedDateTime` comparison)
- [ ] If the BC customer number is not configured on the company, the sync is skipped silently (no error)
- [ ] If the BC API call fails, login is not blocked — the error is logged and the existing Medusa company data is preserved

## Out of scope

- Writing portal changes back to BC
- Syncing BC financial details (balanceDue, overdueAmount, agedAccountsReceivable) — these are real-time query, not stored
- Syncing BC payment terms, shipment method, payment method, salesperson code
- Syncing BC contacts, dimensions, document attachments
- Admin UI for viewing/editing the new fields
- Storefront UI for displaying the new fields
- Syncing on any trigger other than login (e.g. scheduled job, webhook)

## Resolved decisions

- **Sync frequency:** Every login — no `lastModifiedDateTime` comparison.
- **`blocked` representation:** Store as a Medusa enum mirroring the BC `customerBlocked` enum values: `""` (not blocked), `"Ship"`, `"Invoice"`, `"All"`.
- **`credit_limit` storage:** Bare decimal — currency is already on the company via `currency_code`.
- **`salespersonCode`:** Not synced (out of scope).
- **`website`:** Not synced (out of scope).
- **`taxAreaDisplayName`:** Not synced (out of scope).

## Mockups / references

- BC Customer entity schema: OData `$metadata` (pasted in session, `EntityType Name="customer"`)
- Sample BC Customer JSON: `Aplareds Konfektion AB` (number `00011551`, pasted in session)
- Medusa Company model: `apps/backend/src/modules/company/models/company.ts`
- Medusa Company types: `apps/backend/src/types/company/module.ts`
- BC module service: `apps/backend/src/modules/business-central/service.ts`
- BC module types: `apps/backend/src/modules/business-central/types.ts`

## Technical notes

*(Leave empty initially. Implementation plan goes in `PLAN.md` once work starts.)*
