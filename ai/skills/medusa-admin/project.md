# Admin: Nimbus Nordic

Paths under `apps/backend/src/admin/`.

- Canonical: `routes/translations/page.tsx` with its data hook `hooks/api/ui-translations.tsx`
  (React Query over the SDK in `lib/client.ts`) and tests in `routes/translations/__tests__/`
  (`pnpm --filter @b2b-starter/backend test:admin`). Also `routes/quotes/page.tsx`.
- No widgets exist yet; only UI routes.
- BC-managed company fields are read-only in the admin: `routes/companies/bc-managed-fields.ts`.
- Admin translation locales: `lib/translations.ts` (`INITIAL_IMPORT_LOCALES`, `REFERENCE_LOCALE`),
  duplicated in the storefront (Tier 0 `decisions.md`).
