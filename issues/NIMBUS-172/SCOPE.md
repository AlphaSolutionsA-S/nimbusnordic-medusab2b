# Show processed (posted) returns in the return overview

- **Date:** 2026-09-30
- **Status:** Draft — pending user approval
- **Type:** Story
- **Tracker:** JIRA — https://alphasolutionsdk.atlassian.net/browse/NIMBUS-172
- **Priority:** Medium
- **Project Folder:** issues/NIMBUS-172/
- **Size:** M
- **Area:** Storefront account / return overview and return detail page, Business Central module
- **Base Branch:** develop (branch `feature/NIMBUS-172` from develop after NIMBUS-140 is merged)
- **Requested by:** Klaus Petersen
- **Requested at:** 2026-09-29T12:45:00Z

> Draft. The clarification answers below were collected from the user by the main session on
> 2026-09-30 and passed on to the scoper. The user has not approved this scope yet.

## Background

The return overview in the customer portal (NIMBUS-140) only lists returns that are still open
in Business Central. Once Business Central has received and processed a return, it drops out of
the list, so customers lose track of it and contact support. The same gap was closed for orders
in NIMBUS-170 by also showing invoiced orders. This story does the same for returns, so the
overview becomes a complete return history.

## Clarification decisions (from the user, 2026-09-30)

| Question | Decision |
|---|---|
| Partial receipts | **Group under return order.** One row per return order, with its posted receipts listed under it. |
| Partly received return orders | A partly received return order **stays open** and shows the receipts posted so far. |
| Layout | **Same list + filter.** One combined list with a status badge and an open/processed filter, like NIMBUS-170. |
| "Received" date | **`Document_Date`** of the posted receipt. |
| Detail page | **Yes, link to detail.** Extend the NIMBUS-141 return detail page to handle processed returns and posted receipts. |
| Sequencing / base branch | **Wait for NIMBUS-140, base on develop.** Start after NIMBUS-140 is merged to develop, then branch `feature/NIMBUS-172` from develop. |
| Priority | **Medium.** Nothing is waiting on this. |

## Requirements

### Functional
- The return overview shows open and processed returns together in one list for the customer's
  company.
- There is one row per return order. Posted receipts for that return order are grouped under it,
  not shown as separate rows.
- A return order that is no longer open but has posted receipts is shown as **processed**.
- A return order that is still open is shown as **open**, including when it has been partly
  received. Its posted receipts so far are shown under it.
- No return order appears twice. Open return orders and posted receipts are matched by return
  order number.
- Each row has a status badge (open / processed). The list has a filter for all / open /
  processed.
- For each posted receipt, the customer can see the receipt number, the received date
  (`Document_Date`), and the items with quantities.
- A processed return opens the return detail page (NIMBUS-141). That page is extended to show
  processed returns and their posted receipts with items and quantities.
- A customer only ever sees returns that belong to their own company, in the list and on the
  detail page (including when opening a detail URL directly).
- All new texts are available in every storefront language.

### Non-Functional
- Only the fields needed for display are requested from Business Central. Posted receipt headers
  also carry names, addresses, phone and e-mail, which must not be fetched or exposed.
- The Business Central customer number is always taken from the signed-in customer's company on
  the server and is never accepted from the client.
- The free-text external document number (for example `AX 209475` or the portal's `RET-...`
  request id) is not shown as an order or return number.
- Performance is in line with the existing return overview and order history (NIMBUS-170).

## Affected Apps

- **backend** — read posted return receipts and their lines from Business Central, scoped to the
  customer. Combine them with open return orders, grouped by return order number with duplicates
  removed. Extend the return list and return detail responses to carry status and posted
  receipts.
- **storefront** — combined return list with status badge and open/processed filter, grouped
  receipts under each return order, extended return detail page for processed returns, and
  translations for all languages.

## Proposed Structure

Story. Expected high-level breakdown (the implementation-planner decides the details):
1. Backend: fetch posted return receipt headers and lines for the customer (only the needed
   fields).
2. Backend: merge with open return orders by return order number (open vs processed status,
   receipts grouped under their return order), for both the list and the detail view.
3. Storefront: combined list with status badge, open/processed filter and grouped receipts.
4. Storefront: extend the NIMBUS-141 detail page for processed returns and posted receipts.
5. Translations for all storefront languages.
6. Tests: customer scoping, no duplicates, partial receipts, processed-only return orders.

## Out of Scope

- Credit memos and refund amounts for returns.
- Creating or editing returns (NIMBUS-138 / NIMBUS-139).

## Open Questions

- **Scope approval:** the user has not approved this draft yet.
- **Sort order:** the combined list could be sorted by return order date or by latest received
  date. This question was not raised with the user. Default assumption to confirm: keep the
  NIMBUS-140 sort order.
- **Posted receipts with no matching return order:** older historic data may have posted
  receipts whose return order number is empty or unknown. It is not decided whether these are
  shown, for example as a processed row per receipt, or left out. This question was not raised
  with the user.
- **Item details shown per receipt:** the acceptance criteria say "items with quantities". It is
  not decided whether the return reason, unit of measure and variant are shown as well. The
  implementation-planner can propose a set that matches the NIMBUS-141 detail page.

## Dependencies

- **NIMBUS-140** (return overview): must be merged to develop first. It is In Progress and its
  latest progress entry is awaiting code review, commit and rebase.
- **NIMBUS-141** (return detail page): merged to develop and in Internal review. This story
  extends it.
- **NIMBUS-138** (Business Central return connection): In Progress. Provides the ODataV4 access
  that this story reuses.
- **NIMBUS-170** (merged sales orders and invoices in order history): pattern to follow for the
  combined list and filter. In Internal review.
- Technical findings from the Business Central check: `issues/NIMBUS-172/FEATURE.md`,
  Technical notes.
