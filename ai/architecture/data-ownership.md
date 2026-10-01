# Data ownership

Every table has one owning module. Core tables belong to their Medusa module. The CMS
(`apps/cms`) has its own Postgres database (`DATABASE_URI`), owned by Payload; no other app touches it.

- Only the owner's L1 service reads or writes its tables; other modules read them through
  `query.graph()` (or `query.index()` to filter by linked-module fields).
- Relationships across modules are module links in `apps/backend/src/links/`, never foreign keys.
- Migrations are generated (`medusa db:generate <module>`, then `medusa db:migrate`; CMS:
  `payload migrate:create`), never hand-written; a hand-written one is a blocking deviation.
- No raw SQL outside the owning module's service, and never against another module's tables.
- Personal data: company and employee contact, address, VAT and credit data (company module, synced
  from Business Central) and Medusa customers. Never log it: errors log the message only
  (`apps/storefront/src/lib/util/customer-error.ts`); page paths stored with missing translation keys
  are sanitized first (`apps/storefront/src/i18n/request.ts`).
- Business Central is the source of truth for the BC-managed company fields
  (`apps/backend/src/admin/routes/companies/bc-managed-fields.ts`); they are synced, not edited.

## Registry (`apps/backend/src/modules`)

| Module (container key) | Tables | Migrations |
|---|---|---|
| `company` | `company`, `employee` | `modules/company/migrations/` |
| `quote` | `quote`, `message` | `modules/quote/migrations/` |
| `approval` | `approval`, `approval_settings`, `approval_status` | `modules/approval/migrations/` |
| `orderIngestion` | `order_external_reference` | `modules/order-ingestion/migrations/` |
| `storefrontTranslation` | `storefront_translation`, `translation_missing_key` | `modules/storefront-translation/migrations/` |
| `businessCentral` | none (HTTP client for Dynamics 365 Business Central) | — |

Legacy exceptions: `medusa-module-and-data` `project.md`.
