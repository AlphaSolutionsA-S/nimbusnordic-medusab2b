# Overview list of all Business Central shipments on the Admin shipment tracking page

- Tracker: Jira (NIMBUS) — https://alphasolutionsdk.atlassian.net/browse/NIMBUS-216
- Priority: Should
- Size: S
- Area: Medusa Admin, Shipment tracking page (backend app, order-ingestion read side)
- Requested by: Klaus Petersen
- Requested at: 2026-10-23T09:23:00Z

## Description

On the Shipment tracking page in Medusa Admin, show a simple overview list of all shipments
received from Business Central for API orders, not only the ones whose automatic checks gave up.
A list only: no detail view per shipment.

Original request (Danish): "kan du på shipment tracking siden lave en simpel oversigt (liste - jeg
skal ikke se detaljer)".

## Why

Today the page shows only shipments that need a manual retry. There are about 160 shipments from
Business Central, and staff have no way in Admin to see which shipments have arrived, for which
order and customer, and whether they are still being checked. The only full list is the order API,
per customer, which is meant for the integration and not for people.

## Acceptance criteria

- [ ] The Shipment tracking page shows a list of all Business Central shipments received, one row per shipment.
- [ ] Each row shows enough to recognise the shipment at a glance (for example shipment number, order number, customer, shipment date and whether it is still being checked).
- [ ] The list can be paged through, so all shipments can be reached.
- [ ] The existing list of shipments that gave up, and its retry action, keep working as before.
- [ ] The list is read-only: no detail view and no new actions.

## Out of scope

- A detail view of a shipment (lines, packages, revisions, payload).
- Filtering, searching or exporting the list.
- Any change to how shipments are fetched from Business Central, checked or served through the order API.
- New actions on shipments (the existing retry for given-up shipments stays as it is).

## Open questions

- Columns: which fields per row? Candidates: shipment number, BC order number, external (customer) order number, customer (company name), shipment/posting date, latest revision, check state (open, or closed with reason: cancelled, window ended, superseded, gave up), last checked at.
- One row per shipment or per revision? Assumed one row per BC shipment (latest revision), not one per stored notice revision.
- Sort order: newest shipment first (posting date or last change in BC)?
- Page size: 20 like the existing list, or larger (50) given about 160 shipments?
- States: include every shipment regardless of state (open and all closed reasons)? Assumed yes.
- Should the given-up list stay as a separate section above the overview, or become a filter of the new list? Assumed it stays separate.

### Answers (Klaus Petersen, 2026-10-23: accepted all proposed answers)

1. Columns: shipment number, BC order number, customer (external) order number, company name, shipment/posting date, status (check state: open, or closed with its reason).
2. One row per BC shipment (latest revision), not one per stored notice revision.
3. Sort: newest shipment (posting) date first.
4. Page size: 50.
5. Every shipment is included, whatever its state (open and all closed reasons).
6. The existing given-up list with its Retry action stays as a separate section at the top; the new overview list goes below it.

List only, no detail view.

## Mockups / references

- Existing page: `apps/backend/src/admin/routes/shipment-tracking/page.tsx` (NIMBUS-191).
- Related: NIMBUS-130 (shipment notices epic), NIMBUS-191 (Admin retry page for given-up shipments).

## Technical notes

Triage notes (code area only, no design):

- Admin page `apps/backend/src/admin/routes/shipment-tracking/page.tsx`, hook
  `apps/backend/src/admin/hooks/api/shipment-tracking.tsx`.
- `GET /admin/shipment-tracking` (`apps/backend/src/api/admin/shipment-tracking/route.ts`) lists only
  `shipment_tracking` rows with `state = closed`, `close_reason = gave_up`, via `query.graph`, plus a
  company-name lookup.
- Data lives in the `orderIngestion` module: `shipment_tracking` (one row per BC shipment, with
  state, close reason, latest revision, posting date) and `shipment_notice` (one row per revision).
  No data-model change is expected.
- The order API (`/orderapi/shipment-notices`, `listShipmentNoticesWorkflow`) is not touched.
