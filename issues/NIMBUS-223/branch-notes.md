# Branch notes: NIMBUS-223

## Task 01
- Page keys: `apps/backend/src/admin/lib/page-keys.ts` exports `COMPANY_DETAILS_PAGE_KEY`, `QUOTE_DETAILS_PAGE_KEY`, `SHIPMENT_TRACKING_LIST_PAGE_KEY` (and the list-page keys). The Translations key is `storefront_translation.list`, not the plan's `translation.list` (Medusa's own Translations page uses that); new keys must not clash by prefix with core `widgetsZonePrefix` values either. Its test treats every string export as a key, so do not add other string exports there.
- Stand-in: `src/admin/__tests__/dashboard-components.tsx`, mapped for `^@medusajs/dashboard/components$` in `jest.admin.config.js`. Root `data-testid="layout-composer"` with `data-page-key` and `data-layout-id`; each section `data-layout-section="main|side"` (main first); each `LayoutComposer.Entry` a `div[data-layout-entry="<id>"]` (raw id, no `core:`). `data`, `hasOutlet`, widgets ignored.
- Children of a section that are not `LayoutComposer.Entry` get no attribute in the stand-in; wrap every section child in an Entry if a test should see it.
- Imports used: `CORE_LAYOUT_IDS` from `@medusajs/admin-shared`, `LayoutComposer` from `@medusajs/dashboard/components`; both resolve and typecheck from `apps/backend` (Node16 resolution). `sections` is typed per layout id (`main` for single column, `main` + `side` for two column).
- Typecheck after task 01: 22 errors, identical set to the baseline (the baseline file has a BOM on its first line; compare sorted lines, not the raw file).

## Task 02
- `routes/shipment-tracking/page.tsx`: `main` holds a fragment of two `LayoutComposer.Entry` (`given-up-shipments`, `all-shipments`); Medusa unwraps fragments into entries (plan section 9, row 2), and the stand-in renders them in order. A fragment is fine for multi-entry sections.
- Page test pattern for layout: `screen.getByTestId("layout-composer")`, check `data-page-key` / `data-layout-id`, then `querySelectorAll("[data-layout-entry]")` mapped to ids for default order; `within(entry)` to check what each entry holds.
- Typecheck after task 02: 22 errors, same set as task 01 (`tsc-02.txt` in the run scratchpad).

## Task 03
- `routes/companies/[companyId]/page.tsx`: early `return <div>Company not found</div>` stays before the layout; `LayoutComposer` gets `data={company}`, `main` is a fragment of three entries (`business-central-warning`, `company-information`, `employees`); `<Toaster />` sits after `LayoutComposer` in an outer fragment.
- The stand-in's `data-layout-id` is the full id `core:single-column`; assert against `CORE_LAYOUT_IDS.SINGLE_COLUMN`, not a literal.
- `LayoutComposer`'s `data` prop is generic (`data?: TData`), so a record passes without a cast.
- Detail-page test pattern: `routes/companies/__tests__/company-details-layout.test.tsx` (mock only `lib/client`, `MemoryRouter` + `Route` with the param, `document.querySelector('[data-layout-entry="<id>"]')` then `within`).
- `company-order-api-setting.test.tsx` failed once at the create-drawer Save click in a combined run, then passed 3 times; if it recurs in finalization, it is timing, not the layout.
- Typecheck after task 03: 22 errors, same set (`tsc-03.txt` holds only `error TS` lines; `tsc-02.txt` holds full output, so compare `error TS` lines).
