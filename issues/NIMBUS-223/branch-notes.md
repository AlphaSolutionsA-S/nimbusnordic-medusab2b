# Branch notes: NIMBUS-223

## Task 01
- Page keys: `apps/backend/src/admin/lib/page-keys.ts` exports `COMPANY_DETAILS_PAGE_KEY`, `QUOTE_DETAILS_PAGE_KEY`, `SHIPMENT_TRACKING_LIST_PAGE_KEY` (and the list-page keys). The Translations key is `storefront_translation.list`, not the plan's `translation.list` (Medusa's own Translations page uses that); new keys must not clash by prefix with core `widgetsZonePrefix` values either. Its test treats every string export as a key, so do not add other string exports there.
- Stand-in: `src/admin/__tests__/dashboard-components.tsx`, mapped for `^@medusajs/dashboard/components$` in `jest.admin.config.js`. Root `data-testid="layout-composer"` with `data-page-key` and `data-layout-id`; each section `data-layout-section="main|side"` (main first); each `LayoutComposer.Entry` a `div[data-layout-entry="<id>"]` (raw id, no `core:`). `data`, `hasOutlet`, widgets ignored.
- Children of a section that are not `LayoutComposer.Entry` get no attribute in the stand-in; wrap every section child in an Entry if a test should see it.
- Imports used: `CORE_LAYOUT_IDS` from `@medusajs/admin-shared`, `LayoutComposer` from `@medusajs/dashboard/components`; both resolve and typecheck from `apps/backend` (Node16 resolution). `sections` is typed per layout id (`main` for single column, `main` + `side` for two column).
- Typecheck after task 01: 22 errors, identical set to the baseline (the baseline file has a BOM on its first line; compare sorted lines, not the raw file).
