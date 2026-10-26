# Branch notes: NIMBUS-255

## 01 Backend: variant code on BC order detail lines

- `BCOrderLine.variantCode?: string` added in `apps/backend/src/modules/business-central/types.ts`;
  the key is absent (not `""`, not `undefined`-valued) when BC has no variant or an empty code.
  Comment and other non-item lines never carry it.
- Both mappers in `apps/backend/src/modules/business-central/service.ts` (`mapSalesOrderLine`,
  `mapSalesInvoiceLine`) spread the private helper `variantCodeOf(line)`.
- `GET /store/bc-orders/:id` passes `BCOrderLine` through unchanged, so the storefront's
  `order.lines[].variantCode` mirrors the backend field; no route change was needed.
- Pitfall: `__tests__/service.spec.ts` is matched only by `test:integration:modules`, not by
  `test:unit` (which needs `*.unit.spec.ts`). It needs no database.
- Pre-existing failure in that file: `listOrders › stops filling from salesInvoices after the
  round-trip guardrail…` (fails on unchanged code; verification.md baseline).

## 02 Storefront: size field and description rule

- `getBcOrderLineDisplay(line)` and type `BcOrderLineDisplay` (`{ name?, description?, size? }`,
  all trimmed, absent when empty) in `apps/storefront/src/lib/util/bc-order-line-display.ts`; used by
  the order detail template (item lines only) and the return table.
- Translation key `Account.bcOrderReturn.sizeLabel` in all 8 `messages/*.json`; rendered as
  `{sizeLabel}: {code}` under the name in the item column.
- Storefront tests resolve `next-intl` through `apps/storefront/__mocks__/next-intl.tsx` against the
  real `en.json`, so a new key must exist there or the test shows the key name.
- Direct `pnpm --filter … exec eslint <files>` crashes on a jiti version; use the `lint` script.
- `AGENTS.md` (generated from Tier 0) is at the 32768-byte Codex limit; any Tier 0 addition makes
  `ai:check` fail until something is trimmed.

## fix-01 Size label as one ICU message

- `Account.bcOrderReturn.sizeLabel` replaced by `Account.bcOrderReturn.size` (`"Size: {size}"`, per
  locale punctuation, fr `"Taille : {size}"`) in all 8 `messages/*.json`; both components render
  `t("size", { size: display.size })`. The DB import before release uses the new key.

## fix-02 Tier 0 headroom

- `AGENTS.md` 32803 bytes before (HEAD d210389), 31225 after: 1543 bytes under the 32768 limit.
  `.github/copilot-instructions.md` 30832 to 29708. Headroom is thin: budget any Tier 0 addition.
- Edit `ai/architecture/*.md` / `ai/AGENTS.md` only, then `pnpm ai:check --fix`; the system-prompt
  copy of Tier 0 can be stale after a merge, so read the files fresh before rewriting them.
- Tier 0 and context tables now use unpadded cells (`|a|b|`); keep that style when adding rows.
