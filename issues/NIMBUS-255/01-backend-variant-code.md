# 01: Backend: variant code on BC order detail lines
**App:** backend · **Layer:** L2 infra adapter (`businessCentral`) · **Depends on:** None

**Goal:** The BC order detail read expands the item variant on invoice lines too, and every order line carries the variant code as `variantCode` when it has one.
**Files / areas:** `apps/backend/src/modules/business-central/service.ts` (`getOrder`, invoice line raw type, both line mappers), `apps/backend/src/modules/business-central/types.ts` (`BCOrderLine`).
**Seam contracts:** `GET /store/bc-orders/:id` response `order.lines[].variantCode?: string`, present only when the BC line's `itemVariant.code` is a non-empty string; absent otherwise. No other response field changes.
**Test intent:** (unit, `service.spec.ts`, existing `getOrder` fetch mocks)
- Invoice request `$expand` is `salesInvoiceLines($expand=item,itemVariant)`; order request unchanged; no additional BC request is made.
- Open order line with `itemVariant.code` "L" → `variantCode` "L"; invoice line with `itemVariant.code` "XL" → `variantCode` "XL" (both the open-plus-invoiced and the invoice-only path).
- Line with `itemVariant` null, missing, or code "" → no `variantCode` key.
- Comment line → no `variantCode`; description, quantities and reservations mapping unchanged.
**Done when:** the tests above pass; lint and typecheck at or below baseline.
**Verify after deploy:** `GET /store/bc-orders/SO330301` as a customer of that company: `order.lines[]` line 20000 from invoice SIN29817 has `variantCode` "XL" (production BC; TestDK already confirmed).
**Also update:** `apps/backend/src/modules/business-central/__tests__/service.spec.ts` (order detail expectations and the `$expand` assertion); no `docs/architecture/` section covers order detail lines; no contract test exists for `/store/bc-orders/:id`.
