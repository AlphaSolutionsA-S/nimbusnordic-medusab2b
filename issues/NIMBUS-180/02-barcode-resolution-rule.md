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
