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

## Deviations

- BLOCKING (needs a human): `pnpm ai:check` fails after the new `decisions.md` row: generated
  `AGENTS.md` is 32891 bytes, over the 32768 Codex limit (it was 32749 at HEAD, so 19 bytes of
  headroom; no row fits). The row is kept, compacted to one short line. Choose: trim other Tier 0
  text by at least 123 bytes, or drop the row. `ai:check --fix` has regenerated the tier0 blocks in
  `AGENTS.md` and `.github/copilot-instructions.md`.
- Added helper case: a blank (whitespace-only) variant code yields no size, and descriptions and
  names are shown trimmed. Why: the same trim the comparison uses; the backend already omits empty
  codes.
- Added return-table case: a line whose description differs from name and size shows it (the
  intent's "same name, description and size"); the template has no separate case for it, since
  both use the same helper.
- Non-item, non-comment lines in the order detail keep today's text (description, else item
  number, else the fallback label) without size; the helper applies to item lines only, per the
  plan's state table.
- Size renders as `{sizeLabel}: {code}` in its own line under the name in the existing item column
  (no new table column). Why: the plan says "its own labelled value"; a column would be empty on
  most non-sized lines.

## Done-when evidence

- Tests pass: `src/__tests__/lib/util/bc-order-line-display.test.ts` (8 tests),
  `src/__tests__/modules/account/templates/bc-order-detail-template.test.tsx` ("item line name,
  description and size" block, 4 tests), `src/__tests__/modules/account/components/bc-order-return/index.test.tsx`
  ("item name, description and size" block, 3 tests): 23 passed, 0 failed.
- Helper intent: "hides a description equal to the name…", "…equal to the size…", "keeps a
  description that differs…", "hides an empty description and has no size without a variant
  code", "falls back to the description for the name without repeating it", "falls back to the
  item number for the name".
- Template intent: "shows an invoice line's name once and its size", "shows an open line's name and
  size without repeating the size", "shows no size label on an item line without a variant code",
  "renders a comment line's description across the row as before".
- Return table intent: "shows each eligible line's name once, an extra description and the size",
  "names the product, not the size, in the quantity field's accessible label", "still submits only
  line number, quantity and reason".
- Lint: `pnpm --filter @b2b-starter/storefront lint` exit 0; no finding in touched files (no
  `react/jsx-no-literals`; the `:` separator is an allowed string).
- Typecheck: 8 errors, baseline 8; none in touched files.
- Key in all 8 locale files: `Account.bcOrderReturn.sizeLabel` in `apps/storefront/messages/{da,de,en,fr,it,no,pl,sv}.json`
  (texts per plan section 8; each file parsed as JSON after the edit).
- Also update, `bc-order-detail-template.test.tsx`: new describe block; existing tests unchanged and
  passing.
- Also update, `bc-order-return/index.test.tsx`: new describe block; existing tests unchanged and
  passing (their lines have no description, so the old accessible-label wording was not asserted).
- Also update, `ai/architecture/decisions.md`: row "BC order line name, extra description, size
  (NIMBUS-255)" added; see the blocking deviation on the `AGENTS.md` size.
- Also update, `docs/`: none found (searched by the plan); no change.
- Verify after deploy (SO330301, SO347954, DB translation import): not provable in this task: needs
  the deployed storefront against production BC and the Admin Translations import.
