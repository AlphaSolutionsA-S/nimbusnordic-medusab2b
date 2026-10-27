# Business-rule registry

One home per rule; consumers render its verdict. Check here before adding one.
`B`, `S` as in `boundaries.md`.

|Rule|Owning file|Verdict via|Consumers|Status|
|---|---|---|---|---|
|Password recovery: 15-min customer proof, latest link, sequential single use (NIMBUS-133)|Medusa Auth; `B/api/auth/middlewares.ts` (validation); `B/workflows/customer/workflows/send-password-reset.ts` (email)|Core Auth reset/update; Notification `email`|`S/lib/data/password-recovery.ts`|ok; concurrent reuse/token persistence/logging accepted; default sessions|
|Spending limit (per order only, finding 7)|`B/utils/check-spending-limit.ts`|checkout error (`B/workflows/hooks/validate-cart-completion.ts`)|storefront cart, checkout|duplicate: `S/lib/util/check-spending-limit.ts`|
|Cart approval status|`B/utils/get-cart-approval-status.ts`, `validate-cart-approvals.ts`|cart approvals|storefront cart, checkout, approvals|divergent duplicate: `S/lib/util/get-cart-approval-status.ts` (approved = all vs any)|
|Cart access, verified cart–company association|`B/workflows/cart/utils/cart-access.ts`|404 (`authorizeCartAccessWorkflow`)|cart guard; approvals list and decision|ok|
|Store order read and return: owner, or company admin of the approved source cart (NIMBUS-177)|`B/workflows/order/utils/order-access.ts`|404 (`B/api/middlewares/ensure-order-access.ts`)|`GET /store/orders/:id`, `POST /store/returns`|ok|
|Order API enabled per company (NIMBUS-217)|`B/utils/order-api-access.ts`|403|order API; shipment jobs; Admin retry|ok|
|Business Central environment of a company: stored `country` `NO` (trimmed, any case) → NO, else DK (NIMBUS-261)|`B/utils/business-central-environment.ts`|environment (`B/workflows/company/workflows/resolve-business-central-account.ts`)|store BC routes, return creation, company sync, Admin BC customer routes|ok|
|Order transfer only without an account owner (NIMBUS-177)|`B/workflows/order/utils/order-transfer.ts`|400|`POST /store/orders/:id/transfer/request`|ok|
|BC company sync: fields written; updated/skipped/failed|`B/workflows/company/steps/prepare-company-bc-sync.ts`|workflow status|login sync, store company read, Admin sync route|ok|
|BC-managed company fields are read-only|`B/admin/routes/companies/bc-managed-fields.ts`|admin form; BC sync|storefront company card|ok|
|Company credit/blocked/reset fields and colleague spending limits: admin-only|`B/api/store/companies/company-projection.ts`|store profiles|storefront|ok; quotes: name only (`B/api/store/quotes/query-config.ts`)|
|Sent or recorded BC orders: duplicate protection and a force warning|`B/modules/order-ingestion/bc-integration-state.ts` (`hasBusinessCentralOrder`)|pure verdict|Admin widget; submission guard|ok|
|BC submission skips existing orders unless forced|`B/workflows/business-central-order/utils/admin-bc-integration.ts` (`shouldSkipBcSubmission`)|preparation outcome|automatic and Admin workflows|ok|
|Order line barcode resolution to BC item and size|`B/workflows/business-central-order/utils/resolve-order-line-item.ts`|line failures|BC order prepare step|ok|
|Shipment notice match, netting, revision, check schedule, line size (`TRCShipmentLine`), undo pairing|`B/workflows/shipment-notice/utils/`|pure verdicts|shipment discovery and check workflows|ok|
|BC order line name, extra description, size (NIMBUS-255)|`S/lib/util/bc-order-line-display.ts`|pure helper|BC order detail, return table|ok|
|Free-shipping threshold|`B/api/store/free-shipping/utils.ts`|`/store/free-shipping/prices`|`S/lib/data/fulfillment.ts`|ok|
|Supported and reference (`en`) locales|`B/modules/storefront-translation/service.ts`|`/store/ui-translations/:locale`; `default_locale` of `/store/country-languages`|`B/admin/lib/translations.ts`, `S/lib/data/country-languages.ts`|duplicates: `REFERENCE_LOCALE` (admin); `DEFAULT_LOCALE` in `S/lib/i18n/country-language-map.ts` (cold-outage fallback only)|
|Country-language deploy bootstrap skips countries with an unavailable legacy language (English default)|`B/workflows/storefront-translation/utils/country-language-scope.ts` (`skipUnavailableAssignments`)|`skipped` in the workflow result|`B/migration-scripts/seed-country-languages.ts`|ok|
|Runtime UI text from the DB, not `S/messages/*.json`|`B/modules/storefront-translation`|`/store/ui-translations/:locale` (300 s cache)|`S/lib/data/ui-translations.ts`|ok|
|Country language assignment and deactivation guard|`B/modules/storefront-translation/country-languages.ts`, `service.ts`|`/admin/country-languages`, `/store/country-languages`|Admin Translations page; `S/lib/data/country-languages.ts`|ok; `COUNTRY_LANGUAGE_MAP` (beside `DEFAULT_LOCALE`): approved cold-outage fallback|
|Email language, link country, text fallback|`B/workflows/transactional-email/utils/email-language.ts`, `email-texts.ts`|pure verdicts|reset, invitation emails|ok; built-in English `Emails` copy: approved fallback|
|Formatting tag and hreflang key of a country's language|`S/lib/i18n/formatting-locale.ts`, `S/lib/seo/locale-alternates.ts`|pure helpers|prices, dates; product, collection, category metadata|ok|

Domain types are duplicated in `B/types/` and `S/types/` (no shared package).
