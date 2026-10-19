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
