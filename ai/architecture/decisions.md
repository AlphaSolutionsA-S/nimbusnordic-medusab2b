# Business-rule registry

One home per rule; consumers render its verdict. Check here before adding one.
Paths: `B` = `apps/backend/src`, `S` = `apps/storefront/src`.

| Rule | Owning file | Verdict exposed via | Consumers | Status |
|------|-------------|---------------------|-----------|--------|
| Password recovery: 15-minute customer proof, latest-link, sequential single use (NIMBUS-133) | Medusa Auth; `B/api/auth/middlewares.ts` (validation); `B/workflows/customer/workflows/send-password-reset.ts` (email) | Core Auth reset/update; Notification `email` | `S/lib/data/password-recovery.ts` | ok; concurrent reuse/token persistence/logging accepted; default sessions |
| Spending limit (per order only, finding 7) | `B/utils/check-spending-limit.ts` | checkout error (`B/workflows/hooks/validate-cart-completion.ts`) | storefront cart, checkout | duplicate: `S/lib/util/check-spending-limit.ts` |
| Cart approval status | `B/utils/get-cart-approval-status.ts`, `validate-cart-approvals.ts` | cart approvals | storefront cart, checkout, approvals | divergent duplicate: `S/lib/util/get-cart-approval-status.ts` (approved = all vs any) |
| Cart access, verified cart–company association | `B/workflows/cart/utils/cart-access.ts` | 404 (`authorizeCartAccessWorkflow`) | cart guard; approvals list and decision | ok |
| Store order read and return: owner, or company admin of the approved source cart (NIMBUS-177) | `B/workflows/order/utils/order-access.ts` | 404 (`B/api/middlewares/ensure-order-access.ts`) | `GET /store/orders/:id`, `POST /store/returns` | ok |
| Order API enabled per company (NIMBUS-217) | `B/utils/order-api-access.ts` | 403 | order API; shipment jobs; Admin retry | ok |
| Order transfer only without an account owner (NIMBUS-177) | `B/workflows/order/utils/order-transfer.ts` | 400 | `POST /store/orders/:id/transfer/request` | ok |
| BC-managed company fields are read-only | `B/admin/routes/companies/bc-managed-fields.ts` | admin form; BC sync | storefront company card | ok |
| Company credit/blocked/reset fields and colleague spending limits: admin-only | `B/api/store/companies/company-projection.ts` | store profiles | storefront | ok; quotes: name only (`B/api/store/quotes/query-config.ts`) |
| Sent or recorded BC orders require duplicate protection and a force warning | `B/modules/order-ingestion/bc-integration-state.ts` (`hasBusinessCentralOrder`) | pure verdict | Admin widget; submission guard | ok |
| BC submission skips existing orders unless force is explicit | `B/workflows/business-central-order/utils/admin-bc-integration.ts` (`shouldSkipBcSubmission`) | preparation outcome | automatic and Admin workflows | ok |
| Order line barcode resolution to BC item and size | `B/workflows/business-central-order/utils/resolve-order-line-item.ts` | line failures | BC order prepare step | ok |
| Shipment notice match (R1, R2, R4), netting, revision and check schedule | `B/workflows/shipment-notice/utils/` | pure verdicts | shipment discovery and check workflows | ok |
| Free-shipping threshold | `B/api/store/free-shipping/utils.ts` | `/store/free-shipping/prices` | `S/lib/data/fulfillment.ts` | ok |
| Supported and reference (`en`) locales | `B/modules/storefront-translation/service.ts` | `/store/ui-translations/:locale`; `default_locale` of `/store/country-languages` | `B/admin/lib/translations.ts`, `S/lib/data/country-languages.ts` | duplicate: `REFERENCE_LOCALE` in the admin consumer; `DEFAULT_LOCALE` in `S/lib/i18n/country-language-map.ts` (cold-outage fallback only) |
| Deploy country-language bootstrap skips countries whose legacy language is unavailable (English default) | `B/workflows/storefront-translation/utils/country-language-scope.ts` (`skipUnavailableAssignments`) | `skipped` in the workflow result | `B/migration-scripts/seed-country-languages.ts` | ok |
| Runtime UI text from the database, not `S/messages/*.json` | `B/modules/storefront-translation` | `/store/ui-translations/:locale` (300 s cache) | `S/lib/data/ui-translations.ts` | ok |
| Country language assignment and deactivation guard | `B/modules/storefront-translation/country-languages.ts`, `service.ts` | `/admin/country-languages`, `/store/country-languages` | Admin Translations page; `S/lib/data/country-languages.ts` (request config, layouts, metadata, switcher, text refresh) | ok; `COUNTRY_LANGUAGE_MAP` in `S/lib/i18n/country-language-map.ts`: approved cold-outage fallback, not a second rule |
| Formatting tag and hreflang key of a country's language | `S/lib/i18n/formatting-locale.ts`, `S/lib/seo/locale-alternates.ts` | pure helpers | prices and dates; product, collection and category metadata | ok |

Domain types are duplicated in `B/types/` and `S/types/` (no shared package yet).
