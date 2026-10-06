# Admin: Nimbus Nordic

Paths under `apps/backend/src/admin/`.

- Canonical: `routes/translations/page.tsx` with its data hook `hooks/api/ui-translations.tsx`
  (React Query over the SDK in `lib/client.ts`) and tests in `routes/translations/__tests__/`
  (`pnpm --filter @b2b-starter/backend test:admin`). Also `routes/quotes/page.tsx`.
- Order BC widget: `widgets/bc-order-status.tsx` with `hooks/api/bc-integration.tsx` and RTL behavior tests in `widgets/__tests__/bc-order-status.test.tsx`. It loads on mount and then refreshes only when the Admin selects Refresh; mutation invalidation and focus/reconnect/polling refresh are disabled per NIMBUS-158.
- BC-managed company fields are read-only in the admin: `routes/companies/bc-managed-fields.ts`.
- Admin translation locales: `lib/translations.ts` (`INITIAL_IMPORT_LOCALES`, `REFERENCE_LOCALE`),
  duplicated in the storefront (Tier 0 `decisions.md`).
