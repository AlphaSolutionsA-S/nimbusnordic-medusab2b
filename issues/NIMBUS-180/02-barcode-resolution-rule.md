# 02: Barcode resolution rule and the two new line-failure reasons
**App:** backend · **Layer:** L5 (decision fn); state contract in `orderIngestion`; Admin UI labels · **Depends on:** 01

**Goal:** One pure function decides a line's item and size from the evidence, enforcing every rule in
`plan.md` section 6; the state contract and Admin widget learn the reasons `size_unresolved` and
`unit_mismatch`.
**Files / areas:** `apps/backend/src/workflows/business-central-order/utils/` (new rule file) and
`__tests__/`; `apps/backend/src/modules/order-ingestion/bc-integration-state.ts`;
`apps/backend/src/admin/widgets/bc-order-status.tsx`; `ai/architecture/decisions.md` (new row).
**Seam contracts:**
- `resolveOrderLineItem(line: { eanNo: string; itemNumber?: string; custItemNo?: string; unitOfMeasureCode?: string }, evidence: BCItemLookupEvidence)`
  returns `{ resolved: true; itemId: string; itemVariantId: string | null; matchedBy: BCItemMatchSource }`
  or `{ resolved: false; reason: Exclude<BcOrderLineFailureReason, "rejected_by_bc"> }`.
- `BcOrderLineFailureReason` gains `"size_unresolved"` and `"unit_mismatch"` (wire values, also in
  the parsed list). Labels: "Size could not be determined", "Barcode is for a different unit of
  measure".
- The rule never applies the 20-character limit (the adapter's); it only sees what was read.
**Test intent:** (unit, `*.unit.spec.ts`, TestDK rows as fixtures)
- Each row 1-12 of the state table, asserting `itemId`, `itemVariantId` and `matchedBy` or `reason`.
- TestDK `5712094132141` with its three rows → HEND-L-MIDNBLUE + id of `L`, `itemReference`; the blank
  type row alone → treated as no reference.
- Unit: empty-unit row counts for any line unit; `PCS` row counts for `pcs` and for no line unit
  (base `PCS`); only a `CTN` row → `unit_mismatch`.
- Negatives: item card and reference disagree on item → `ambiguous`; ambiguous barcode does not fall
  back to an item number that would match; item with sizes reached by item number → `size_unresolved`.
- Metz-style item-card barcode on an item without sizes → resolved, no size (scope F3).
- `parseBcIntegrationState` keeps both new reasons; an unknown reason still parses as `not_found`;
  widget renders both new labels (`test:admin`).
**Done when:** rule, contract and labels as in the seam; decisions.md row "Order line barcode
resolution to BC item and size" (owning file, verdict via line failures, consumer the prepare step);
tests, lint, typecheck pass; `pnpm ai:check` passes.
**Also update:** `src/modules/order-ingestion/__tests__/bc-integration-state.unit.spec.ts`,
`src/admin/widgets/__tests__/bc-order-status.test.tsx`, `src/workflows/business-central-order/__tests__/admin-bc-integration.unit.spec.ts`
(DTO keeps known reasons), `ai/architecture/decisions.md`.

## Deviations

- BLOCKING (needs a human): `pnpm ai:check` fails on size. The `decisions.md` row pushes the
  generated root `AGENTS.md` to 32 880 bytes, over the 32 768-byte limit Codex reads (it was about
  32 710 at HEAD, so no row fits). The row is already cut to the minimum the done-when needs. Room
  has to come from trimming other Tier 0 text (about 112 bytes), which is outside this task.
  `ai:check --fix` was run, so the Tier 0 blocks in `AGENTS.md` and `.github/copilot-instructions.md`
  are current.
- Unit rule, line with no unit: a row whose named item the number read did not return is kept in R'
  (its base unit is unknown), so the line is refused as `not_found` (row 9), not `unit_mismatch`.
- Item numbers and size codes are compared trimmed and case-insensitively, like units (decision 4).
  The plan states this only for units; BC stores all three upper-case.
- A size code on an item without sizes refuses as `size_unresolved` (plan section 8 decisions; the
  state table's row 6 covers it only implicitly). Tested.
- Added cases: a row for another unit ignored when a fitting row exists; two item cards with the
  barcode → `ambiguous`; blank barcode never matches a blank item-card `gtin`; a later number that
  matches exactly one item still resolves after an ambiguous earlier one; the same item listed twice
  counts once.
- The widget label test was not run red separately; without the labels the rendered text is
  "Line 1: " and the assertion fails.

## Done-when evidence

- Rule as in the seam: `resolveOrderLineItem` in
  `apps/backend/src/workflows/business-central-order/utils/resolve-order-line-item.ts`; signature and
  result union checked by typecheck; behaviour by
  `__tests__/resolve-order-line-item.unit.spec.ts` (rows 1-12, TestDK L barcode, units, negatives,
  Metz case).
- Contract: `BcOrderLineFailureReason` and the parsed list gain both reasons;
  `bc-integration-state.unit.spec.ts` "keeps the size and unit refusal reasons"; unknown reason →
  `not_found` still covered by "TC-4: keeps usable line failures and drops malformed ones".
- Labels: `bc-order-status.test.tsx` "labels size and unit refusals" (`test:admin`).
- No 20-character limit in the rule: the rule never checks length; documented in its doc comment.
- decisions.md row "Order line barcode resolution to BC item and size": added (owning file, line
  failures, BC order prepare step).
- Tests, lint, typecheck: 45 unit + 9 admin pass; lint 0 errors (no warnings in touched files);
  typecheck 22 errors = baseline.
- `pnpm ai:check` passes: NOT met, see the blocking deviation (size limit only).
- Also update `bc-integration-state.unit.spec.ts`: new test for both reasons.
- Also update `bc-order-status.test.tsx`: new label test.
- Also update `admin-bc-integration.unit.spec.ts`: "keeps every known line failure reason".
- Also update `ai/architecture/decisions.md`: row added; `AGENTS.md` and
  `.github/copilot-instructions.md` regenerated by `ai:check --fix`.
