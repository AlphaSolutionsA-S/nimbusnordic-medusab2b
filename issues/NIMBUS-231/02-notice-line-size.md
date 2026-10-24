# 02: `variant_code` on notice lines
**App:** backend · **Layer:** contract (`orderIngestion`), L5 decision fn, L3 step · **Depends on:** 01

**Goal:** Every notice line recorded from the release on carries the posted BC variant code; undo pairing includes it; a missing row fails only that shipment's check; the content hash is unchanged.
**Files / areas:** `src/modules/order-ingestion/shipment-notice-contract.ts` and `__fixtures__/shipment-notice-fixtures.ts`; `src/workflows/shipment-notice/utils/decide-shipment-notice.ts`; `src/workflows/shipment-notice/steps/check-shipments.ts`; `ai/architecture/decisions.md`
**Seam contracts:** `ShipmentNoticeLineSchema` gains `variant_code: string | null` (required key, after `item_number`). The decision input gains the shipment's `BCShipmentLineVariant[]` (task 01); the decision gains the outcome `{ kind: "variant_missing"; sequence }`. `ShipmentCheckErrorCode` gains `variant_missing`. The step calls `getShipmentLineVariants` per batch after `getShipmentsByNumbers`, inside the same failure handling.
**Test intent:**
- Unit (decision): a line with variant `M` → `variant_code: "M"`; empty → null; quantity-0 lines of `revised` and `cancelled` notices keep their size (B1, F4).
- Unit: a correction with the same item, unit and opposite quantity but another variant → `unpairable`; the 30947879 shape (one item in five sizes, each undone) nets to zero per size (B3).
- Unit: an item line with no row → `variant_missing` with its BC line number; a comment line needs no row; rows for other lines or shipments are ignored (B4).
- Unit: the content hash of a fixed shipment equals a golden value captured from the code before this change, and adding variants does not change it, so a pre-release revision yields `nothing` (B2).
- Contract unit: the example (now with a sized and an unsized line) parses; a line without the key is rejected by the wire schema; `variant_code: 5` is rejected.
- Integration (`check-shipments.spec.ts`, finalization): a sized shipment is stored with its variant; variant read throttled → back-off set, row untouched; variant read 500 → every row of the batch `bc_error`; missing row → only that row `variant_missing`, nothing stored; log line and `last_error` carry no BC text.
**Done when:** the cases above pass; lint and typecheck at or below baseline.
**Verify after deploy:** `GET /orderapi/shipment-notices` (JSON and XML via APIM) for a TestDK shipment of a sized item (e.g. `HEND-L-MIDNBLUE`) recorded after deploy: `lines[].variant_code` equals the shipped size; an open shipment notified before the release gets no extra `revised` notice (`shipment_notice` row count for its `bc_shipment_id` unchanged).
**Also update:** `src/workflows/shipment-notice/__tests__/decide-shipment-notice.unit.spec.ts` (every case needs variant rows); `src/modules/order-ingestion/__tests__/shipment-notice-contract.unit.spec.ts`; `__fixtures__/shipment-notice-fixtures.ts` (also used by `integration-tests/utils/shipment-notices.ts`); integration specs that spy on `getShipmentsByNumbers` must also stub `getShipmentLineVariants`, or they call TestDK: `integration-tests/http/shipment-notice/check-shipments.spec.ts`, `poll-shipment-notices.spec.ts`, `integration-tests/http/admin/shipment-tracking.spec.ts`; `ai/architecture/decisions.md` row "Shipment notice match … netting" (add the size join and pairing). Docs: task 04.

## Deviations

- The missing-row check (B4) runs before netting: a shipment with both an item line without a row and an unpairable correction fails `variant_missing` (lowest such BC line number), since pairing needs the sizes. The plan did not order the two.
- Only `item` lines need a row; `comment` and `other` (G/L, freight) lines need none and are never listed. The plan says "every item line"; the test intent named only comment lines.
- The decision also turns an empty variant code into null (the adapter already does), so B1 holds in the L5 rule on its own.
- Added an integration case the intent did not list: the deadline passing before the size read leaves the row due and unchanged (state-table row "deadline before the size read starts").
- Stale comment updated outside the listed files: `src/workflows/shipment-notice/utils/shipment-check-schedule.ts` (`failed` outcome codes now name the missing size row and failed BC read).
- The fixture's header comment now says `variant_code` was added (NIMBUS-231); the example is no longer identical to the NIMBUS-130 customer file (task 04 publishes the new one).
- `pnpm ai:check --fix` regenerated the Tier 0 blocks in `AGENTS.md` and `.github/copilot-instructions.md` after the `decisions.md` edit.
- Integration specs written but not run (finalization only, `verification.md`); they compile in the whole-app typecheck.

## Done-when evidence

- B1 size on lines: `decide-shipment-notice.unit.spec.ts` "decideShipmentNotice: size" › "carries the posted variant code of each line, null for an item without sizes", "gives null for an empty variant code"; payload test "builds a contract payload…" now expects `variant_code: "M"`.
- F4 quantity-0 lines keep their size: "keeps the size on the quantity-0 lines of a revised and a cancelled notice".
- B3 pairing: "gives unpairable for a correction of another size than the line it would undo"; "nets one item in five sizes, each undone, to zero per size (shipment 30947879)".
- B4: "decideShipmentNotice: missing size row" › "gives variant_missing with the BC line number of an item line that has no row", "gives variant_missing when the shipment has no rows at all", "needs no row for a comment or other non-item line", "ignores rows of other lines and other shipments".
- B2 hash: "decideShipmentNotice: content hash" › "keeps the hash of a shipment as it was before sizes, with or without sizes" (golden `c4d492f8…920d` captured by running the test against the unchanged rule; it passed there before the change), "records nothing for a sized shipment whose revision was stored before the release".
- Contract: `shipment-notice-contract.unit.spec.ts` › "accepts the contract's JSON example", "carries a sized and an unsized line in the example", "rejects a line without variant_code", "rejects a variant_code that is not a string"; "accepts null in every nullable field" now includes `variant_code`.
- Integration (B5, security matrix rows "no BC text" and "missing size never guessed"): `integration-tests/http/shipment-notice/check-shipments.spec.ts` › "records the posted size of each line", "fails only the shipment with an item line that has no size row, storing nothing for it", "backs off every shipment of the batch when the size read fails, without its text", "sets the poll back-off when the size read is throttled and leaves the row due", "leaves the rows due when the deadline passes before the size read". Not run in this task: finalization (local Postgres).
- Lint: `pnpm --filter @b2b-starter/backend lint` 0 errors, no finding in touched files. Typecheck: 22 errors, baseline 22, same set.
- Also update › `decide-shipment-notice.unit.spec.ts`: `decide()` passes one row per item line by default (`variantsOf`); the direct call passes rows.
- Also update › `shipment-notice-contract.unit.spec.ts`: three cases added, null case extended.
- Also update › `__fixtures__/shipment-notice-fixtures.ts`: `variant_code` "M" on NN-1001 lines, null on NN-2040 lines (both notices); `shipment-notice-page.unit.spec.ts` and `integration-tests/utils/shipment-notices.ts` consume it unchanged (page spec passes).
- Also update › `check-shipments.spec.ts`, `poll-shipment-notices.spec.ts`, `admin/shipment-tracking.spec.ts`: each now stubs `getShipmentLineVariants` next to `getShipmentsByNumbers`; `storeAsAnotherRun` passes rows to the decision.
- Also update › `ai/architecture/decisions.md`: shipment notice row names the size join, the missing-row failure and size in undo pairing.
