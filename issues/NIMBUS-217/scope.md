# Only companies enabled for the order API can place orders and receive shipment notices

**Date:** 2026-10-23
**Status:** Approved (Klaus Petersen, 2026-10-23)
**Type:** Story
**Priority:** Medium (Should)
**Issue:** NIMBUS-217
**Key:** NIMBUS-217
**Case folder:** issues/NIMBUS-217/
**Base Branch:** develop

## Background

Since NIMBUS-129 and NIMBUS-130, every company with a Business Central customer number can send orders
through the order API (`POST /orderapi/orders?customerNumber=…`). Medusa also finds the shipments
Business Central posts for those orders, checks them, stores shipment notices and serves them to the
Logic App (`GET /orderapi/shipment-notices?customerNumber=…`). Every company takes part automatically.

Nimbus Nordic wants to decide per customer who may use the order API, so it can be rolled out
customer by customer and switched off for one customer without changing the integration. Two things
will be required:

1. a valid key, checked outside Medusa in APIM and the Logic App (NIMBUS-178), and
2. a new setting on the company in Medusa, "enabled for the order API", switched on.

Medusa only checks the setting; it does not validate a customer key. Both order API endpoints resolve
the company through the same step today (the customer number from the query string, matched to
`company.business_central_customer_number`), so the setting is checked in one place for both.

## Requirements

### Functional

- F1. A company has a setting "enabled for the order API", off by default, including for every company
  that exists at deploy.
- F2. Staff see and change the setting on the company in Medusa Admin (company detail and edit form).
  A new company starts with the setting off.
- F3. Order intake (`POST /orderapi/orders`) refuses a known company with the setting off: no order,
  no external reference and no company link is created.
- F4. The shipment-notices endpoint (`GET /orderapi/shipment-notices`) refuses a known company with
  the setting off and serves no notices.
- F5. Shipment discovery (the Business Central job from NIMBUS-130) only finds and tracks shipments for
  companies with the setting on.
- F6. Shipment checks stop for the tracked shipments of a company with the setting off.
- F7. Go-live operations step: right after deploy, an admin switches on the companies that use the
  order API today (R13).

### Non-functional

- N1. The refusal contains no customer number, company id or other identifier (same principle as
  NIMBUS-192).
- N2. Logs for a refused request or a skipped shipment carry the company id or shipment and order
  numbers only, never company contact data or the BC customer number (sole traders).
- N3. The setting is read fresh on every request and every job run; switching it takes effect at the
  next request or the next run of the shipment job (no extra cache).
- N4. Discovery and check runs keep their current Business Central request budget; filtering by the
  setting adds no Business Central request.

## Business rules

Decided by Klaus Petersen, 2026-10-23 (triage answers, then answers to the scope questions):

- R1. The setting governs the whole order API: order intake, the shipment-notices endpoint, and the
  Business Central shipment job (discovery and checks). A company with the setting off cannot place
  orders through the order API, and is neither discovered, tracked nor served shipment notices.
- R2. The customer key is checked outside Medusa (APIM / Logic App, NIMBUS-178). Medusa checks only
  the setting. The order API keeps its single secret API key used by the Logic App.
- R3. A request to either order API endpoint for a known company with the setting off → refused with
  **HTTP 403** and the fixed message **"Customer not registered for the order API"**. Klaus accepted
  that this response differs from the unknown-customer 404 (see Security properties).
- R4. A request for an unknown customer number → unchanged: HTTP 404 "Customer not found"
  (NIMBUS-192/193). The unknown check runs first, so an unknown number never gets the 403. Request
  validation (400 for an invalid query or order body) still runs before both, as today.
- R5. A request for a known company with the setting on → unchanged: order intake 201 or 422 for a
  duplicate; shipment notices 200 with its notices.
- R6. A company switched off, or never switched on → tracking stops for its shipments: open tracked
  shipments are no longer checked against Business Central and are closed as "company not enabled" at
  the next check run; new shipments are not discovered.
- R7. Shipments Business Central posts while a company is switched off are not picked up when it is
  switched on again: discovery moves on and does not back-fill (same as the NIMBUS-130 go-live rule).
- R8. Notices already stored for a company that is switched off are kept, not deleted, and not served
  while it is off. Switching it back on serves them again through the normal endpoint.
- R9. Switching a company back on does not reopen its tracked shipments closed under R6; only new
  shipments are found.
- R10. The Admin "retry" of a tracked shipment (NIMBUS-191) for a company with the setting off →
  refused with a clear message.
- R11. Orders a company placed through the order API before it was switched off are not touched:
  they stay as they are and continue through the existing Business Central submission. Only their
  shipment tracking stops (R6). Proposed by the scoper; follows from R1 limiting new intake.
- R12. The setting is written only by Admin users through Medusa Admin. It is a Medusa-only field: not
  BC-managed, never written by the Business Central company sync, and not readable or writable from
  the storefront (store company endpoints neither return nor accept it).
- R13. Default off at creation (Admin, storefront company registration, BC sync) and off for every
  existing company after the migration. Go-live: right after deploy, an admin switches on the
  companies that use the order API today, so they keep placing orders and receiving shipment notices.
  **Consequence:** between deploy and that step, those companies' orders are refused with 403 (not
  queued in Medusa), their shipment-notice requests are refused, open tracking of their shipments
  closes at the first check run, and shipments posted in that gap are never delivered (R7). The step
  must therefore follow the deploy immediately, ideally before the next shipment job run (every 15
  minutes), or in a quiet window agreed with the API customers. Who identifies those companies: open
  item O1.
- R14. Actor: the Admin user who changed the setting. No change history is kept (Klaus, Q6: not needed
  now), as for other company fields.
- R15. One home for the rule "a company is enabled for the order API" in
  `ai/architecture/decisions.md`; order intake, the shipment-notices endpoint, discovery, checks and
  the Admin retry consume its verdict and never re-derive it.

## Data model (draft)

| Entity / field | Meaning | Owner | Written by | Stored / derived | Sensitive? | Retention |
|---|---|---|---|---|---|---|
| `company.order_api_enabled` (name proposed; broader than shipment notices since R1) | company may use the order API: order intake and shipment notices | `company` module | Admin users via Admin company update | stored, boolean, not null, default `false`; generated migration | no | life of the company |
| `shipment_tracking` close reason, new value "company not enabled" (name ?) | why tracking stopped (R6) | `orderIngestion` module | shipment check run | stored | no | as existing tracking rows |
| `shipment_notice` rows of a disabled company | stored notices (R8) | `orderIngestion` module | unchanged (check run) | stored | holds BC delivery data (names, addresses) as today | unchanged: kept; no new deletion |
| Orders, external references of a disabled company | earlier API orders (R11) | Medusa order module; `orderIngestion` | unchanged | stored | as today | unchanged |

## Security properties (draft)

| Property | Intended control | Trust root | Failure behaviour |
|---|---|---|---|
| Only enabled companies place API orders | Order intake checks the setting of the company resolved from `customerNumber` before the duplicate check and before anything is created | Company row in Medusa; customer number set by the Logic App from the caller's APIM token (NIMBUS-178) | 403 fixed message; no order, reference or link created |
| Only enabled companies receive notices | The shipment-notices endpoint checks the same setting before reading notices | as above | 403 fixed message, no notices |
| Customer key | Checked in APIM / Logic App, not Medusa (R2) | APIM subscription key | outside this repo; Medusa trusts the single secret API key as today |
| Existence of a customer number | Unknown → 404 generic, known-but-off → 403 generic: the responses differ. Accepted by Klaus (Q1): the key is admin-equivalent and held only by the Logic App, and in production a caller cannot choose the customer number | Secret API key; APIM token mapping | a key holder can tell "exists, not enabled" from "unknown"; accepted |
| Only staff change the setting | Field accepted only by the Admin company update; rejected by the store routes' strict validation | Admin authentication | store request with the field → 400; storefront never sees the field |
| BC sync cannot switch it on | Sync writes only BC-managed fields | sync code | field unchanged by any sync run |
| No personal data in errors or logs (N1, N2) | fixed messages; logs with company id / shipment numbers | — | — |
| Cross-company | Unchanged: the company comes only from the customer number (NIMBUS-130) | — | — |

Negative cases belong in `integration-tests/http/security/security-boundaries.spec.ts` or the order
API specs (planner decides): a switched-off company gets 403 on both endpoints and nothing is created
or served; a store route cannot set the setting.

## Affected apps

- Backend (`apps/backend`): company model and migration, Admin company validators and form, the shared
  company-resolution step of the order API, order intake and shipment-notices workflows, shipment
  discovery and check workflows, Admin shipment retry, the business-rule registry.
- Storefront, CMS: none.
- APIM / Logic App (outside this repo): pass the new 403 and its message through to the caller, as
  they do the 404; see O2.

## Proposed structure

Story, high-level tasks:

1. Company setting: new field (default off), generated migration, Admin update validator, kept out of
   store routes and BC sync.
2. Admin UI: show and edit the setting on the company page.
3. Rule home: the "company is enabled for the order API" decision and its registry row.
4. Order API: both endpoints refuse a company with the setting off (403), unknown stays 404; HTTP
   contract and security tests for order intake and shipment notices.
5. Shipment job: discovery skips companies with the setting off; the check run closes tracked
   shipments of such companies; the Admin retry refuses them.
6. Docs and go-live: `docs/architecture/` section on the order API and shipment notices (error table,
   the setting); the operations step of R13 in the release notes.

## Open questions

All scope questions Q1–Q6 were answered by Klaus on 2026-10-23. Open items:

- O1. Who identifies the companies that use the order API today, to switch on at go-live? The planner
  can provide a list of companies with orders received through the order API as an aid, but the
  decision which ones to switch on is Nimbus Nordic's.
- O2. What does the Logic App do with a 403 from order intake: pass it back to the customer's system,
  retry, or alert? A refused order is not stored in Medusa, so it must not be retried silently and
  dropped. To confirm with the NIMBUS-178 owner.

## Dependencies

- NIMBUS-129 (order intake) and NIMBUS-130 (shipment notices), shipped.
- NIMBUS-178 (APIM / Logic App key check; must handle and pass on the new 403).
- NIMBUS-191 (Admin retry of tracked shipments), NIMBUS-192/193 (generic 404).
- NIMBUS-216 (Admin shipment overview), in progress on `feature/NIMBUS-216`: may want to show the
  setting; not part of this story.
