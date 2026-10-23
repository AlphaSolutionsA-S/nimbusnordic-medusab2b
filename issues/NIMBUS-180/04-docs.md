# 04: Documentation and schema comment
**App:** backend · **Layer:** docs · **Depends on:** 03

**Goal:** Describe how an order line's BC item and size are resolved, and correct the stale schema
comment.
**Files / areas:** `docs/architecture/business-central-order.md` (new section "Item and size
resolution"; bump "Last updated" and "Related work"); `apps/backend/src/modules/order-ingestion/canonical-order-schema.ts`
(comment on `itemNumber`/`description`: the item is identified by `eanNo`, and the item number and
customer item number are a fallback for items without sizes).
**Seam contracts:** none.
**Test intent:** none (docs and a comment); `ai/architecture/decisions.md` row from task 02 checked
against the final file names.
**Done when:** the doc names the three evidence reads and their request budget, the rule's home, the
refusal reasons and their Admin labels, and the 20-character item-number limit; it says live
behaviour against BC is verified only after deploy.
**Also update:** none found beyond the files above (`docs/architecture/order-api/` does not describe
item lookup).

## Deviations

- Added two rows to the doc's Components table (`getItemLookupEvidence` / `item-lookup-evidence.ts`
  and `resolveOrderLineItem`): the new section names both, and the table lists the doc's components.
- The request budget also counts the token request and the ODataV4 company-name read
  (`getODataV4Url` → `getCompanyName`, not cached), which the plan's "three reads" leaves implicit.
- No `ai/` file changed; the `decisions.md` row from task 02 already names the final file
  (`B/workflows/business-central-order/utils/resolve-order-line-item.ts`). Byte effect on the
  generated root `AGENTS.md`: 0.

## Done-when evidence

- Three evidence reads and their request budget: `docs/architecture/business-central-order.md`,
  "Item and size resolution", "Evidence" and "Request budget" paragraphs (checked against
  `getItemLookupEvidence` and `fetchItemLookupRows` in `modules/business-central/service.ts`).
- Rule's home: same section, "Rule" paragraph, plus a Components row.
- Refusal reasons and Admin labels: reason table in the section (labels copied from
  `admin/widgets/bc-order-status.tsx`).
- 20-character item-number limit: "Evidence" paragraph.
- Live behaviour verified only after deploy: last paragraph of the section.
- Schema comment: `canonical-order-schema.ts` comment on `itemNumber`/`description` now says the
  item is identified by `eanNo` and item number / customer item number are the fallback for items
  without sizes. Lint: 0 errors (13 pre-existing warnings); typecheck 22 errors (baseline 22).
- `decisions.md` row checked: path and function file match the final code; no change needed.
- Also update: none found, as the task states (`docs/architecture/order-api/` has no item lookup).
