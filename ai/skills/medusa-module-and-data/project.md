# Modules and data: Nimbus Nordic

Paths under `apps/backend/src/`.

- Canonical service: `modules/quote/service.ts` (plain `MedusaService`); with a custom method:
  `modules/approval/service.ts` (`hasPendingApprovals`).
- Canonical model: `modules/order-ingestion/models/order-external-reference.ts` (id prefix, partial
  unique index).
- Canonical links: `links/employee-customer.ts`; list with cascade: `links/cart-approvals.ts`.
- Do not copy: `links/quote-links.ts` (`MedusaModule.setCustomLink`; use `defineLink`);
  `modules/company/models/company.ts` defining two models in one file while `employee.ts` only
  re-exports (one model per file in new code); the stray `.snapshot-*.json` files in the company,
  quote and approval migrations.
- `modules/storefront-translation/service.ts` uses raw SQL with `pg_advisory_xact_lock` on its own
  tables; allowed there, not a pattern for other modules.
