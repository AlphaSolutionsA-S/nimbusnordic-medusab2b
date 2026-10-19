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
