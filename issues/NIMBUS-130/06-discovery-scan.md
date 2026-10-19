# 06: Discovery scan
**App:** backend · **Layer:** L3/L4 (`workflows/shipment-notice/`) · **Depends on:** 02, 03, 04, 05

**Goal:** Plan flow B. Lead and trail scans walk count-sized windows to the end, match the headers to
API orders, upsert tracking rows, and advance each cursor only after its window is complete.
**Files / areas:** `apps/backend/src/workflows/shipment-notice/{steps,workflows}/`.
**Seam contracts:**
- Constants: settling 15 min; trail lag 30 min (bound now − 45 min); window budget 1,000 headers;
  window halving down to one timestamp.
- Input: `{ deadline: Date }`. Output: `{ headers, matched, tracked, lead_lag_ms, trail_lag_ms,
  complete: boolean }`.
- Throttling: on the adapter's throttling error the workflow sets the state back-off and ends.
- Order metadata is read through a narrow Query read by order id, commented as a deliberate exemption
  (`data-core-read-workflows`).
- Run by task 08's orchestration workflow.
**Test intent (HTTP integration, BC adapter stubbed at the module boundary, real Postgres):**
- **Progress (F2):**
  - 1,000 already-tracked headers inside the trail window plus one newer header → the newer one is
    tracked within two runs, and both cursors advance;
  - a tie group larger than the page size is read whole and the cursor passes it.
- First run initializes the state and makes no BC call.
- Partial failure: a failure on page 2 of a window leaves the cursor unchanged, and the next run
  re-reads the window and tracks every row.
- Matching:
  - a non-API order, an earlier BC number, another company's external number and a posting date
    before go-live → no tracking row;
  - a matching header → one open row due at last-modified + 15 min;
  - a newer header for an open row moves the due time earlier only.
- A deadline reached mid-window → the cursor is not advanced.
**Done when:** workflow and steps written; tests written; lint and typecheck at or below the baseline.
**Verify after deploy:** `shipment_notice_state.lead_cursor` follows the clock with a lag of about 15
minutes.
**Also update:** none found.

## Deviations

- Matching runs inside the scan step (through the pure `shipmentTrackingForHeaders`, which calls
  `matchShipmentToOrder`), not in a workflow `transform()`: a scan walks several windows per run and
  must upsert and advance the cursor per window, and workflow composition has no loop. The rule
  still has one home (`utils/match-shipment-order.ts`); the step only calls it.
- The scan step does two writes per window (tracking upsert, then the cursor) and has no
  compensation: the upsert is idempotent and the cursor only records completed windows.
- A BC failure other than throttling fails the workflow (rethrown) after keeping the cursor at the
  last complete window; only throttling ends the run normally with the back-off set. The seam's
  output has no error field, so the caller (task 08) sees the failure as a rejected run.
- The bc_backoff_until skip (plan flow B step 1) is left to task 08, whose seam owns it; discovery
  does not read the back-off.
- A first run (state created) reports `complete: true` with zero counts and lags.
- Window budget: a window with exactly 1,000 headers is read; more than 1,000 is halved.
- Progress test models "already tracked" as 1,000 shipments of one API order with open tracking
  rows seeded through `upsertShipmentTracking`; the tie-group test uses 1,002 headers at one
  timestamp (over the page size and the budget), so it also covers halving down to one timestamp.
- Added cases: Retry-After longer than a minute is honoured; the run reports both cursor lags.
- Added unit tests for the pure window helpers (`discovery-window.unit.spec.ts`).

## Done-when evidence

- Workflow and steps written: `apps/backend/src/workflows/shipment-notice/workflows/discover-shipments.ts`
  (`discoverShipmentsWorkflow`), steps `prepare-shipment-discovery.ts`, `scan-shipment-windows.ts`,
  `set-shipment-poll-backoff.ts`; L5 helpers `utils/discovery-window.ts`.
- Progress (1,000 headers + one newer): `integration-tests/http/shipment-notice/discover-shipments.spec.ts`
  "tracks a header behind 1,000 tracked ones and advances both cursors".
- Tie group larger than the page size read whole, cursor passes it: same spec, "reads a tie group
  over a page and the budget whole, then passes it"; unit "halves down to a window of one timestamp".
- First run initializes, no BC call: "initializes the poll state on the first run and makes no BC call".
- Partial failure: "keeps the cursor when a window fails part-way; a rerun tracks every row".
- Matching negatives and a match due at last-modified + 15 min: "tracks only shipments of the API
  order under its current BC order number"; unit `discovery-window.unit.spec.ts`.
- Newer header moves due time earlier only: "moves an open row's due time earlier for a newer header,
  never later".
- Deadline mid-window: "does not advance the cursor when the deadline is reached mid-window".
- Throttling sets the back-off and ends: "backs off at least a minute on throttling and makes no
  further BC call", "uses BC's Retry-After for the back-off when it is longer than a minute".
- Lint: `pnpm --filter @b2b-starter/backend lint` 0 errors, no warnings in the new files.
- Typecheck: 22 errors, baseline 22 (all in pre-existing integration-tests files).
- Verify after deploy (`lead_cursor` lag about 15 min): not provable in this task: needs the
  deployed job (task 08).
- Also update: none found (no existing test, doc or `ai/` row describes discovery).
