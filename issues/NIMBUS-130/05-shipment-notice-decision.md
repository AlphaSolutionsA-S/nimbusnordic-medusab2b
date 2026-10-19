# 05: Shipment notice decision and schedule
**App:** backend · **Layer:** L5 (`workflows/shipment-notice/utils/`) · **Depends on:** 01, 04

**Goal:** One pure home for R1–R2 matching, R5–R7 and the check schedule. It turns one BC shipment, the
order's line map and the latest stored revision into "record", "nothing" or "unpairable", and computes
each tracking row's next state.
**Files / areas:** `apps/backend/src/workflows/shipment-notice/utils/`.
**Seam contracts:**
- **Match:** BC header + candidate order references + each order's parsed BC state → the matched
  reference or none (R1 API order, R2 current BC number, R4 posting date ≥ go-live).
- **Decide:**
  - input: BC shipment record (task 04), order fields with `bc_lines`, the latest revision
    `{ revision, content_hash, listed bc line numbers }` or null;
  - output: `{ kind: "record", status, content_hash, payload }` | `{ kind: "nothing" }` |
    `{ kind: "unpairable", sequence }`.
- **Schedule:** row + check outcome + now → next due, attempts, final-check flag, close reason. Steps:
  15 min while open; back-off 15 min, 1 h, 4 h, then 6 h; the first success after `recheck_until`
  closes `window_ended`; no success within 3 days of the later of the window's end and `reopened_at`
  (task 11) closes `gave_up`; `cancelled`
  and `superseded` close at once.
**Test intent (unit):**
- **Netting:** pairs with the nearest preceding positive line by BC line number; offsets 5000, 2500
  and 10000 (last line); the same item on several lines nets each line separately (TestDK 30947055
  shape); a mismatching item, unit or quantity → `unpairable`.
- **Order independence (F8):** every permutation of a line set gives the same result and the same
  hash.
- **Outcome:**
  - no revision: net > 0 lines listed as `shipped`; all zero → `nothing`;
  - latest exists: equal hash → `nothing`; changed → `revised` listing every previously listed line,
    0 where undone; all zero → `cancelled`;
  - only `item` lines are listed.
- **Line match:** a line in `bc_lines` gets `line_number` and `ean_no`; freight, BC-added lines and a
  null `bc_sequence` give nulls.
- **Payload:** no price, salesperson, phone or email field.
- **Match:** an earlier BC number, another company's external number, or a posting date before
  go-live → none.
- **Schedule:** each row of the plan's tracking state table, including the final check after
  downtime (F6: day 12 checked, down until day 15 → the next success closes `window_ended`, after a
  recorded revision if it changed) and back-off then `gave_up` (F5).
**Done when:** functions exported and unit-tested; lint and typecheck at or below the baseline.
**Also update:** `ai/architecture/decisions.md` (new row: shipment notice matching, netting, revision
and check schedule, owning folder `workflows/shipment-notice/utils/`).

## Deviations

- Added export `initialShipmentSchedule({ postingDate, lastModifiedDateTime })` → `{ next_check_at,
  recheck_until }` (last-modified + 15 min; end of posting day + 14, UTC): discovery (task 06) needs
  these schedule values and the task makes this folder their one home.
- Added export `isCurrentBcOrder(bcOrderNumber, state)` (R2), used by the match and meant for task 07's
  `superseded` check, so R2 has one home.
- Match (R2) compares only the order's current `bc_order_number`, not delivery status `sent` (scope
  wording): the plan's flow B step 6 names only the number, and a failed force resend keeps the old
  number, whose shipments must still be matched.
- Schedule input "check outcome" is `checked | cancelled | superseded | conflict | failed(error)`;
  output is the storage seam `ShipmentTrackingSchedule` (task 02), so task 07 passes it straight to
  `storeShipmentNotice` / `rescheduleShipmentTracking` / `closeShipmentTracking`. A conflict keeps
  attempts and error unchanged and is due now.
- Decide input `order` is the tracking row's `order_id`, `external_order_number`, `bc_order_number`,
  `posting_date` plus `bc_lines`; the payload's `bc_order_number` and `shipment_date` come from it
  (non-null), and a line without a BC shipment date falls back to the posting date (contract requires
  a date).
- Netting skips a positive line already corrected when looking for "the nearest preceding positive
  line", so consecutive undone lines each pair with their own original.
- Content hash covers only lines with net > 0 (sorted), so a revision's stored hash equals what the
  next check computes regardless of which lines it listed; `cancelled` stores the hash of no lines.
- Added unpairable cases: a previously listed BC line missing from the shipment, and a shipped item
  line without an item number (neither can be represented in the contract).
- `gave_up` threshold is inclusive (`now >= later of window end and reopened_at + 3 days`).
- `pnpm ai:check` reports AGENTS.md at 32,947 bytes (over 32,768) on this Windows checkout: the file is
  CRLF on disk and was exactly 32,768 before, so any new Tier 0 row trips it. With LF (as committed)
  it is 32,433 bytes. Needs a human decision: trim Tier 0 elsewhere or accept (not done here).

## Done-when evidence

- Functions exported: `matchShipmentToOrder`, `isCurrentBcOrder`
  (`utils/match-shipment-order.ts`), `decideShipmentNotice` (`utils/decide-shipment-notice.ts`),
  `initialShipmentSchedule`, `scheduleShipmentCheck` (`utils/shipment-check-schedule.ts`).
- Netting: `decide-shipment-notice.unit.spec.ts` "decideShipmentNotice: netting" (offsets 5000,
  2500, 10000; same item on several lines; item/unit/quantity mismatch and no preceding line →
  unpairable).
- Order independence (F8): "gives the same result and hash for every permutation of the lines" and
  "gives the same 'nothing' for every permutation once a revision holds that content".
- Outcome: "decideShipmentNotice: outcome" (shipped; all zero → nothing; equal hash → nothing;
  revised with 0 where undone; cancelled; only item lines).
- Line match: "decideShipmentNotice: line match" (map hit, freight / BC-added / null `bc_sequence`
  → nulls, older order without map).
- Payload: "builds a contract payload with no price, salesperson, phone or email field" (strict
  `ShipmentNoticePayloadSchema` parse plus forbidden-key check).
- Match: `match-shipment-order.unit.spec.ts` (earlier BC number, other company's external number,
  posting before go-live → null; go-live day matches).
- Schedule: `shipment-check-schedule.unit.spec.ts` (each tracking-table row: 15 min, window_ended,
  cancelled, superseded, conflict due now, back-off 15 min/1 h/4 h/6 h, gave_up incl. reopen;
  F6 "still runs a final check after downtime past the window"; F5 "backs off on repeated failures
  and gives up 3 days after the window with no success"). Plan ids were removed from code comments
  and test names after review (`no-plan-id-comments`).
- Lint: `pnpm --filter @b2b-starter/backend lint` 0 errors (13 pre-existing warnings, none in new
  files). Typecheck: 22 errors, all in integration-tests (baseline 22).
- Also update: `ai/architecture/decisions.md` row added; `AGENTS.md` and
  `.github/copilot-instructions.md` regenerated by `pnpm ai:check --fix` (see the size deviation).
