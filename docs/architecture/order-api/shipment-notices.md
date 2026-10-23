# Shipment Notices Architecture

**Last updated:** 2026-10-23
**Related work:** NIMBUS-130, NIMBUS-191, NIMBUS-216, NIMBUS-217

## Overview

Medusa finds the shipments Business Central posts for orders received through the
[order API](./overview.md), re-checks them for changes, stores each observed change as a numbered
shipment notice and serves the notices to the Logic App through
`GET /orderapi/shipment-notices`. Only companies switched on for the order API
(`company.order_api_enabled`) are discovered, checked and served (NIMBUS-217).

## Components

Paths are relative to `apps/backend/src/`.

| Component | Responsibility |
|-----------|----------------|
| `jobs/poll-shipment-notices.ts` | Every minute; single run via the `shipment-notice-poll` lock (TTL 600 s); disabled under `NODE_ENV=test` |
| `workflows/shipment-notice/workflows/poll-shipment-notices.ts` | One run: discovery, then the due checks, under one deadline; skips BC entirely during a throttling back-off |
| `workflows/shipment-notice/workflows/discover-shipments.ts`, `steps/scan-shipment-windows.ts` | Scans posted BC shipment headers by modification time and creates `shipment_tracking` rows for headers that match an API order of an enabled company |
| `workflows/shipment-notice/workflows/check-shipments.ts`, `steps/prepare-shipment-checks.ts`, `steps/check-shipments.ts` | Up to 200 due tracking rows per run: close, read BC, decide, store a notice, reschedule |
| `workflows/shipment-notice/utils/` | Pure rules: header-to-order match, line netting and notice decision, check schedule, scan windows, notice paging |
| `workflows/shipment-notice/workflows/list-shipment-notices.ts` | The endpoint read: shared company resolve step (404/403), then one page |
| `workflows/shipment-notice/workflows/reopen-shipment-tracking.ts` | Admin retry of a row that gave up; refuses switched-off companies first |
| `modules/order-ingestion` | Tables `shipment_tracking`, `shipment_notice`, `shipment_notice_state` (poll cursors, go-live, back-off); wire contract in `shipment-notice-contract.ts` |
| `api/admin/shipment-tracking/**`, `admin/routes/shipment-tracking/page.tsx` | Admin list of gave-up rows with Retry, and the overview of all tracked shipments with their close reason |

## Data Flow

```mermaid
flowchart TD
  J[Poll job, lock held] --> D[Discovery: lead and trail scans of BC headers]
  D --> M{Header matches an API order<br/>of an enabled company?}
  M -- no --> S[Skipped; cursor moves past it]
  M -- yes --> T[shipment_tracking row, open]
  D -- complete --> C[Check run: due rows]
  C --> E{Company enabled?}
  E -- no or gone --> X[Close company_not_enabled, no BC read]
  E -- yes --> B{Current BC order number?}
  B -- no --> Y[Close superseded]
  B -- yes --> R[Read BC shipment, decide, store notice]
  R --> N[Reschedule, or close window_ended / cancelled / gave_up]
  N --> G[GET /orderapi/shipment-notices serves stored notices]
```

### Discovery

- The lead scan follows the clock 15 minutes behind (settling time); the trail scan re-reads 30
  minutes further back for headers BC made visible late. A window over 1000 headers is halved.
- A header matches when its customer number is an enabled company's
  `business_central_customer_number`, its external document number is that company's API order,
  and its order number is the order's current BC order number. Shipments posted before the go-live
  day are never matched.
- Headers of switched-off companies are filtered in memory after the existing company query (no
  extra BC request); the cursors still pass them, so they are not back-filled when the company is
  switched on later. Exception: a company switched on before the trail scan passes a header (up to
  about 45 minutes after the header's last change) still gets it tracked; accepted.

### Check run

- Due rows are read oldest first, with each row's latest stored revision and, in one query, each
  row's company setting.
- A row whose company is switched off or no longer exists closes with `company_not_enabled` before
  any BC read and before the superseded check. It counts as checked and sets `last_checked_at`.
- Other rows: shipments under a replaced BC order number close `superseded`; the rest are read from
  BC, decided (netting undo corrections) and stored as a `shipped`, `revised` or `cancelled` notice
  against the revision read before the BC read (a newer one makes it a conflict and re-due).
- Schedule: first check 15 minutes after the header's last change, then every 15 minutes until 14
  days after posting; failures back off 15 min, 1 h, 4 h, 6 h, and give up 3 days after the later of
  the window's end and an Admin reopen.

### Tracking row states

| State | Event | Outcome |
|---|---|---|
| open, company on | comes due | checked as above |
| open, company off or gone | comes due | closed `company_not_enabled` |
| closed `company_not_enabled` | company switched on | stays closed; only new shipments are found |
| closed `gave_up`, company on | Admin Retry | reopened, due now (`reopened_by` = Admin user) |
| closed `gave_up`, company off | Admin Retry | 400 "The company is not enabled for the order API"; row unchanged |
| not `gave_up` (open or another reason), company on | Admin Retry | 400 "Only a shipment that gave up can be retried" |
| not `gave_up`, company off | Admin Retry | 400 company message (the company check runs first) |
| no such row | Admin Retry | 404 |

Close reasons: `cancelled`, `window_ended`, `superseded`, `gave_up`, `company_not_enabled`. Only
`gave_up` can be reopened.

### Reading notices

`GET /orderapi/shipment-notices` takes `customerNumber`, `limit` (1–200, default 50) and either
`after` (a decimal cursor) or `since` (ISO timestamp), never both. Notices are ordered by their
stored sequence; the response is `{ shipment_notices, next_cursor, has_more }`, and an empty page
echoes `after`. Access is decided by the shared resolve step: unknown customer 404, switched-off
company 403 (see [overview.md](./overview.md#responses)). Notices stored before a switch-off are
kept and served again once the company is switched back on.

## Key Decisions & Constraints

- **The rule has one home.** Discovery, the check run and the Admin retry all call
  `isCompanyEnabledForOrderApi` (`utils/order-api-access.ts`) on rows selected with
  `ORDER_API_COMPANY_FIELDS`; `OrderApiCompanyRow` requires `order_api_enabled`, so a selection that
  omits the column fails to compile instead of silently closing every open row.
- **No added BC load.** Filtering by the setting adds one `companies` query per batch and no BC
  request.
- **Closing is final.** A switched-off company's rows close when they next come due (normally
  within 15 minutes, up to 6 hours in back-off); switching it on again never reopens them.
- **Single run.** The job holds an in-memory lock (no Redis), so it does not guard across
  instances (`ai/architecture/boundaries.md`, Locks).
- **No personal data in logs.** Job log lines carry shipment and BC order numbers and error codes
  only, never BC response text, company contact data or customer numbers.
- The wire contract (`shipment-notice-contract.ts`) is mirrored by the customer-facing JSON Schema
  and the XSD of APIM's XML rendering; change them together.

## Extension Points

- A new close reason: add it to `SHIPMENT_TRACKING_CLOSE_REASONS`, generate the `orderIngestion`
  migration (the check constraint is dropped and re-created), add the outcome to
  `scheduleShipmentCheck` and the Admin label map in `admin/routes/shipment-tracking/page.tsx`.
- A new reason to skip a company: extend the rule in `utils/order-api-access.ts`, not the
  individual consumers.
- Matching, netting and scheduling are pure functions in `workflows/shipment-notice/utils/` with
  unit tests; change the rule there and keep steps as I/O.
