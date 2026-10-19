# 07: Shipment checks
**App:** backend · **Layer:** L3/L4 (`workflows/shipment-notice/`) · **Depends on:** 02, 03, 04, 05

**Goal:** Plan flow C. Check at most 200 due tracking rows per run against BC, decide, store each
revision against its expected revision, and reschedule or close each row.
**Files / areas:** `apps/backend/src/workflows/shipment-notice/{steps,workflows}/`.
**Seam contracts:**
- Constants: batch 200; 20 numbers per BC request.
- Input `{ deadline: Date }`. Output: `{ checked, recorded, unchanged, conflicts, errors,
  backlog_due, oldest_due_age_ms }` and `status` `completed` | `completed_with_errors`.
- The expected revision is read before the BC read.
- The store step has no compensation.
- `last_error` holds a code (`unpairable`, `not_returned`, `bc_error`), never BC text.
- Run by task 08's orchestration workflow.
**Test intent (HTTP integration, BC adapter stubbed at the module boundary, real Postgres):**
- A due open row with a settled shipment → one `shipped` notice and a 15-minute reschedule; the next
  run with unchanged BC → nothing new.
- An undo on re-read → `revised`, or `cancelled` with the row closed.
- **Stale observation (F1):** the BC stub returns an older positive snapshot after a `cancelled`
  revision was stored by another run → `conflict`, nothing stored, row due now.
- Superseded BC number → closed `superseded`, nothing stored (decision 10).
- **Unpairable (F5):** back-off; after the window, closed `gave_up`; other shipments in the batch
  still stored; run `completed_with_errors`. The log line and `last_error` hold numbers and codes
  only, no name or address.
- **Final check (F6):** a row whose window ended while the job was down gets one check, then closes
  `window_ended`.
- Batch bound: 250 due rows → 200 checked oldest first, the rest next run.
**Done when:** workflow and steps written; tests written; lint and typecheck at or below the baseline.
**Verify after deploy:** after the TestDK end-to-end shipment, one `shipment_notice` row for that
order with `status` `shipped` and its `shipment_tracking` row open.
**Also update:** none found.
