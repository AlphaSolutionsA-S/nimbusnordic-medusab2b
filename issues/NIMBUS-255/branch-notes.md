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
