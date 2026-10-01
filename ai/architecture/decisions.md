# Business-rule registry

Each business rule has one home; consumers render its verdict and never re-derive it. Before adding a
rule, find its row here; a second implementation is a defect. Paths: `B` = `apps/backend/src`,
`S` = `apps/storefront/src`.

| Rule | Owning file | Verdict exposed via | Consumers | Status |
|------|-------------|---------------------|-----------|--------|
| Spending limit (per order only, finding 7) | `B/utils/check-spending-limit.ts` | checkout error (`B/workflows/hooks/validate-cart-completion.ts`) | storefront cart, checkout | duplicate: `S/lib/util/check-spending-limit.ts` |
| Cart approval status | `B/utils/get-cart-approval-status.ts`, `validate-cart-approvals.ts` | cart approvals | storefront cart, checkout, approvals | divergent duplicate: `S/lib/util/get-cart-approval-status.ts` (approved = all vs any) |
| BC-managed company fields are read-only | `B/admin/routes/companies/bc-managed-fields.ts` | admin form; BC sync | storefront company card | ok |
| Free-shipping threshold | `B/api/store/free-shipping/utils.ts` | `/store/free-shipping/prices` | `S/lib/data/fulfillment.ts` | ok |
| Supported and reference (`en`) locales | `B/modules/storefront-translation/service.ts` | `/store/ui-translations/:locale` | `B/admin/lib/translations.ts`, `S/lib/i18n/country-language-map.ts` | duplicate |
| Runtime UI text from the database, not `S/messages/*.json` | `B/modules/storefront-translation` | `/store/ui-translations/:locale` (300 s cache) | `S/lib/data/ui-translations.ts` | ok |

Domain types are duplicated in `B/types/` and `S/types/` (no shared package yet).
