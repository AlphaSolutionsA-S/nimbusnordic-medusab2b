# Admin: Nimbus Nordic

Paths under `apps/backend/src/admin/`.

- Canonical: `routes/translations/page.tsx` with its data hook `hooks/api/ui-translations.tsx`
  (React Query over the SDK in `lib/client.ts`) and tests in `routes/translations/__tests__/`
  (`pnpm --filter @b2b-starter/backend test:admin`). Also `routes/quotes/page.tsx`.
- Order BC widget: `widgets/bc-order-status.tsx` with `hooks/api/bc-integration.tsx` and RTL behavior tests in `widgets/__tests__/bc-order-status.test.tsx`. It loads on mount and then refreshes only when the Admin selects Refresh; mutation invalidation and focus/reconnect/polling refresh are disabled per NIMBUS-158.
- Custom pages render through `LayoutComposer` from `@medusajs/dashboard/components` (layout id
  from `CORE_LAYOUT_IDS` in `@medusajs/admin-shared`) so "Customize page" works on them (`docs/architecture/admin-page-layout.md`).
  The page key (`widgetsZonePrefix`) comes from `lib/page-keys.ts`, whose test checks that keys are
  unique and none starts another. A new key must also not equal, start or be started by a
  `widgetsZonePrefix` of Medusa's own pages (e.g. `translation.list`, `order.list`), or the pages
  share saved arrangements and widgets; hence `storefront_translation.list`. Each section's content is a `LayoutComposer.Entry` with a fixed,
  hand-written `id` (renaming one drops users' saved position). `<Toaster />` and anything that must
  not be movable stay outside `sections`: every child of a section becomes an entry. Admin tests
  render pages through a Jest stand-in (`__tests__/dashboard-components.tsx`, mapped in
  `jest.admin.config.js`) that shows sections in default order and exposes `data-page-key`,
  `data-layout-id` and `data-layout-entry` (query them with `__tests__/layout-queries.ts`); edit
  mode and saving are checked in a browser.
- BC-managed company fields are read-only in the admin: `routes/companies/bc-managed-fields.ts`.
- Shipment recovery: `routes/shipment-tracking/page.tsx` lists gave-up shipment checks and, below
  them, all shipments in any state (`GET /admin/shipment-tracking/overview`); its hook
  `hooks/api/shipment-tracking.tsx` invalidates both paginated display queries after Retry.
- Admin translation locales: `lib/translations.ts` (`INITIAL_IMPORT_LOCALES`, `REFERENCE_LOCALE`),
  duplicated in the storefront (Tier 0 `decisions.md`).
