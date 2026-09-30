# Task 02: Models, migration, and atomic persistence

**Status:** TODO
**App:** backend
**App Root:** apps/backend
**Task ID:** 02
**Date:** 2026-09-30
**Branch:** feature/NIMBUS-175 (from develop)
**Depends on:** 01

## Environment and references

Load building-with-medusa references `custom-modules.md`, `data-models.md`, and
`querying-data.md`, plus db-generate/db-migrate before executing those operations.
Follow `src/modules/order-ingestion/models/order-external-reference.ts` for indexes.
Use disposable PostgreSQL; retain the existing Business Central test guard.
Tests: `src/modules/storefront-translation/__tests__/storefront-translation.spec.ts`
via `moduleIntegrationTestRunner<StorefrontTranslationModuleService>`.

## Models and registration

`src/modules/storefront-translation/models/storefront-translation.ts`:

```ts
import { model } from '@medusajs/framework/utils';
export const StorefrontTranslation = model.define('storefront_translation', {
  id: model.id().primaryKey(),
  locale: model.text(),
  messages: model.json(),
  version: model.number().default(1),
  is_active: model.boolean().default(false),
}).indexes([{
  on: ['locale'], unique: true, where: 'deleted_at IS NULL',
}]);
```

`models/translation-missing-key.ts` uses the same import and exports
`TranslationMissingKey = model.define('translation_missing_key', {...})` with:
id primary key; locale/key text; count number default 1; first_seen_at/last_seen_at
dateTime; last_page_path text; dismissed boolean default false. Add a partial unique
index on `[locale,key]` where deleted_at is null and an index supporting locale,
dismissed, last_seen_at filtering. No FK is needed because whole-locale outage
reports can precede a first import. Dates created_at/updated_at/deleted_at are
provided by Medusa, not declared twice.

`index.ts`:

```ts
import { Module } from '@medusajs/framework/utils';
import StorefrontTranslationModuleService from './service';
export const STOREFRONT_TRANSLATION_MODULE = 'storefrontTranslation';
export default Module(STOREFRONT_TRANSLATION_MODULE, {
  service: StorefrontTranslationModuleService,
});
```

Modify `medusa-config.ts`: import this key and register
`[STOREFRONT_TRANSLATION_MODULE]: { resolve: './modules/storefront-translation' }`.
Generate a schema-only migration with `medusa db:generate storefrontTranslation`.
The generated migration subclass imports `Migration` from
`@mikro-orm/migrations` following existing generated files; inspect its up/down SQL,
unique constraints, and indexes. No data/locale seeding belongs in the migration.

## Service skeleton

Create `service.ts`:

```ts
import { InjectTransactionManager, MedusaContext, MedusaService }
  from '@medusajs/framework/utils';
import type { Context } from '@medusajs/framework/types';
import type { SqlEntityManager } from '@medusajs/framework/mikro-orm/knex';
import { StorefrontTranslation } from './models/storefront-translation';
import { TranslationMissingKey } from './models/translation-missing-key';
import type { MissingReport, MutationInput, MutationResult }
  from '../../types/storefront-translation';

export default class StorefrontTranslationModuleService extends MedusaService({
  StorefrontTranslation, TranslationMissingKey,
}) {
  @InjectTransactionManager()
  async mutateDocument(
    input: MutationInput,
    @MedusaContext() context: Context<SqlEntityManager> = {},
  ): Promise<MutationResult> {
    // IMPLEMENT: narrow transactionManager, locale advisory lock, validate
    // operation rules, atomic CAS/create, resolve missing rows, map DTO.
  }

  @InjectTransactionManager()
  async reportMissing(
    reports: MissingReport[],
    @MedusaContext() context: Context<SqlEntityManager> = {},
  ): Promise<{ accepted: number; ignored: number }> {
    // IMPLEMENT: reporting-cap lock then sorted locale locks; bounded upserts.
  }

  @InjectTransactionManager()
  async dismissMissing(
    locale: string, id: string,
    @MedusaContext() context: Context<SqlEntityManager> = {},
  ): Promise<void> {
    // IMPLEMENT: locale lock and locale-scoped update; 404 if absent.
  }
}
```

Use the transaction manager's parameterized `execute<T>(sql, params)`; never
interpolate locale/key/JSON into SQL. PostgreSQL advisory lock pattern:
`SELECT pg_advisory_xact_lock(hashtextextended(?, 0))`, using a namespaced locale
string. CAS core:

```sql
UPDATE storefront_translation
SET messages = ?::jsonb, version = version + 1, updated_at = now()
WHERE locale = ? AND version = ? AND deleted_at IS NULL
RETURNING id, locale, messages, version, is_active, updated_at
```

Activation uses an equivalent parameterized update for is_active. Creation always
sets inactive/version 1, never trusts those fields from clients. Map a duplicate
locale or stale existing version to MedusaError.Types.CONFLICT. Read/validate the
current key set under the lock before normal save; resolve allows only the reported
key. Import recomputes merge/removal checks, and copy verifies source_version.
Read a consistent source snapshot without taking locale locks in conflicting order.

Clear reports only for values that are nonempty after trimming. Import/activation
also clear the locale outage marker. Reports and mutations use coordinated locks
so late reports cannot recreate cleared entries. Dismissal persists until resolution
removes the record. Count increments saturate rather than overflowing.
No callback/network call inside these transactions and no persisted history.

## Tests

- **TC-1:** Given an empty database, when creating/copying/importing a language,
  then store canonical locale, messages, version 1 and inactive state. Duplicate
  canonical locales conflict, including simultaneous first imports.
- **TC-2:** Given version 1, when two independent service calls save version 1
  concurrently through real PostgreSQL connections, then exactly one succeeds,
  one conflicts, and version becomes 2 with a single writer's whole document.
- **TC-3:** Given an intervening save, when applying an old import/activation,
  then return conflict without partial changes or lost reports.
- **TC-4:** Given absent keys and duplicate reports, when reporting in parallel,
  then one row per locale/key exists and accepted counts are correct. Caps remain
  enforced across connections, and dismissed entries stay dismissed.
- **TC-5:** Given a report racing a value resolution, when both commit, then a
  nonempty saved value has no active missing report; another locale is untouched.
- **TC-6:** Given fresh schema, when running migration up/down/up on disposable
  PostgreSQL, then constraints work and no message rows were automatically seeded.

Run module tests and backend build. Task 03 is the only API consumer of these
custom persistence methods; the generated CRUD methods are not a bypass for CAS.
