# 02: Storefront: size field and description rule on order detail and return table
**App:** storefront · **Layer:** S1 helper (`lib/util/`), S4 components · **Depends on:** 01

**Goal:** Item lines on the BC order detail page and in its return table show the product name once, the description only when it adds something, and the size as its own labelled value.
**Files / areas:** `apps/storefront/src/types/bc-order.ts`, a new pure helper in `apps/storefront/src/lib/util/`, `modules/account/templates/bc-order-detail-template.tsx`, `modules/account/components/bc-order-return/index.tsx`, `apps/storefront/messages/*.json` (8 locales), `ai/architecture/decisions.md`.
**Seam contracts:** consumes `BCOrderLine.variantCode?: string` from 01. One translation key for the size label under `Account.bcOrderReturn` (texts in plan section 8); no literal UI text in JSX.
**Test intent:**
- Helper (unit): description equal to the name or to the size, trimmed and case-insensitive, is hidden; a different description is kept; empty description is hidden; size is the variant code or none; name falls back as today (display name, description, item number) without then repeating the description.
- Template (unit): invoice line (name = description, `variantCode` "XL") renders the name once and the size; open line (description "M", `variantCode` "M") renders name and size, not "M" twice; item line without `variantCode` renders no size label; comment line unchanged.
- Return table (unit): eligible line shows the same name, description and size; quantity input's accessible label names the product; the submitted lines are still line number, quantity and reason only.
**Done when:** the tests pass; lint (`react/jsx-no-literals` clean for new code) and typecheck at or below baseline; the key exists in all 8 locale files.
**Verify after deploy:** storefront page for SO330301 shows "Franklin Unisex - Grey Melange" once with "Size: XL"; SO347954 shows "Camden Men - Midnight Blue" with "Size: M"; the size key is present in the database-backed UI translations for each active locale (Admin Translations page).
**Also update:** `apps/storefront/src/__tests__/modules/account/templates/bc-order-detail-template.test.tsx`, `apps/storefront/src/__tests__/modules/account/components/bc-order-return/index.test.tsx`, `ai/architecture/decisions.md` (new row: BC order line display rule, owning file the new helper, consumers the two components); no `docs/` section found.
