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

## Deviations

- Superseded rows are closed before any BC read and are not read at all: the outcome (closed
  `superseded`, nothing stored) is the same and it saves a BC request.
- Read, decide, store and reschedule run in one step (`check-shipments`) rather than one step each:
  BC data (names, addresses) never becomes a persisted step result, and workflow composition has no
  per-row loop; every rule stays in the L5 utils of task 05.
- BC failure handling, which the task left open: a non-throttling failure of one 20-number request
  backs off those rows with `bc_error` (attempts + 1) and the run continues with the next request;
  throttling leaves the unread rows unchanged, sets the poll back-off (at least 1 min) and stops BC
  reads for the run; rows not read by the deadline are left unchanged and stay due.
- The stale-observation case is split in two tests: "stores nothing for a stale snapshot after
  another run cancelled" (the row is then closed by the other run's `cancelled`, so it cannot be
  due now) and "leaves an open row due now after a store conflict" (another run stored `revised`).
- The `bc_error` log line holds the shipment and BC order numbers and the code only, not the
  adapter's error message: a token failure's message can carry response text. Backed by the
  `bc_error` test (the stub's message contains a name; the log must not).
- Counting: `checked` counts every row whose check completed, including superseded and failed ones;
  rows not read (throttling, deadline) are not counted; `unchanged` = decision "nothing" plus a store
  that returned `unchanged`; throttling is not an error (`errors` stays 0).
- `backlog_due` and `oldest_due_age_ms` are measured after the run (what is still due).
- The expected revision is the highest stored notice revision for the shipment, read in
  `prepare-shipment-checks` before the BC read.
- Added tests beyond the intent: `not_returned`, `bc_error`, throttling, and no BC request after the
  deadline.
- Red step: the previous worker's red run was not recorded; red was shown after the fact by breaking
  the code (re-reading the expected revision after the BC read; batch size 250): both conflict tests
  and the batch-bound test failed on the expected assertions, then the code was restored.

## Done-when evidence

- Workflow and steps written: `apps/backend/src/workflows/shipment-notice/workflows/check-shipments.ts`
  (`checkShipmentsWorkflow`), `steps/prepare-shipment-checks.ts`, `steps/check-shipments.ts`,
  `steps/measure-shipment-backlog.ts`; the throttle back-off reuses `steps/set-shipment-poll-backoff.ts`.
- Tests written, `integration-tests/http/shipment-notice/check-shipments.spec.ts`, 12 passed:
  - shipped notice + 15-minute reschedule, then nothing new: "records one shipped notice, then
    nothing for an unchanged re-read"
  - undo → revised / cancelled and closed: "records an undo as revised, and the undo of every line
    as cancelled"
  - stale observation, expected revision read before the BC read: "stores nothing for a stale
    snapshot after another run cancelled", "leaves an open row due now after a store conflict"
  - superseded: "closes a superseded shipment without reading or storing it"
  - unpairable back-off, `gave_up`, other shipment stored, `completed_with_errors`, logs and
    `last_error` with numbers and codes only: "backs off an unpairable shipment, then gives up after
    the window"
  - final check after the window: "gives a shipment past its window one final check, then closes it"
  - batch bound and 20 numbers per request: "checks the 200 oldest of 250 due shipments, the rest
    next run"
  - `last_error` codes `not_returned` / `bc_error`: "backs off a shipment BC no longer returns",
    "backs off the shipments of a failed BC read with a code"
- Store step has no compensation: `checkShipmentsStep` is created without a compensation function
  (code: `steps/check-shipments.ts`).
- Lint: `pnpm --filter @b2b-starter/backend lint` 0 errors (13 warnings, none in these files).
- Typecheck: `tsc --noEmit -p apps/backend` 22 errors, baseline 22.
- Run by task 08: not provable in this task (task 08 wires it).
- Also update: none found; nothing needed a change.
