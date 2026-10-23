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
