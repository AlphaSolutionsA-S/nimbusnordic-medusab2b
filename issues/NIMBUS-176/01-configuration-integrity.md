# 01: Persist assignments and protect language integrity
**App:** Backend · **Layer:** L0–L1 · **Depends on:** None

**Goal:** Own a versioned singleton assignment document in storefrontTranslation; enforce active targets, English protection and assignment/deactivation atomicity with shared database transactions.
**Files / areas:** apps/backend/src/modules/storefront-translation/{models,service.ts,migrations,__tests__}; apps/backend/src/types/storefront-translation.ts; ai/architecture/{data-ownership,decisions}.md.
**Seam contracts:** Configuration {assignments: Record<lowercase country code, canonical locale>, version: positive integer}; missing singleton is uninitialized. Assignment input {country_code, locale, expected_version, configured_country_codes}; create only if configured, retained edits require existing key. Service returns committed document. Bootstrap accepts validated initial assignments and never overwrites an existing singleton. Activation shares config lock before locale lock; English or any explicit references refuse deactivation with sorted affected codes in the message. No unsafe compensation of committed CAS.
**Test intent:**
- Real-PG integration: unique singleton, bootstrap repeated/failed prerequisites, valid ninth-language target, no hidden activation and no partial initialization.
- Real-PG integration: expected-version replay/conflict; failed target leaves previous document/version intact; bounds and canonical country/locale values.
- Real-PG integration on independent connections/service instances: concurrent same-version saves and assignment/deactivation in both orders; assert stored target active and one serial outcome, including retained entries.
- Real-PG integration: English cannot deactivate; retained-reference deactivation blocked until explicit reassignment; lock timeout/rollback permits later successful operation without leaked locks.
**Done when:** Generated migration applies on test database; stored document and active-state invariants pass integration assertions; no other module table is accessed by this service.
**Verify after deploy:** Read country_language_configuration.assignments and version for singleton country_language_configuration; compare dk language with bootstrap output and subsequent Admin save.
**Also update:** Existing src/modules/storefront-translation/__tests__/storefront-translation.spec.ts activation expectations; module registration stays existing; data-ownership and business-rule registry entries. Do not edit frozen NIMBUS-175 files.

## Deviations

- Scoped test command: the manifest's `test:unit -- <path>` cannot run real-PG module specs (its testMatch is `*.unit.spec`); used `pnpm --filter @b2b-starter/backend test:integration:modules -- <path>`.
- `CountryLanguageConfiguration` model is deliberately not passed to `MedusaService({...})`, so no generated CRUD (`update…`/`delete…`) can bypass the CAS and lock; `db:generate` still picks it up from `models/`. All access is raw SQL inside the owning service.
- Added module methods beyond the listed seam, from the plan's "publication reads" and the 02 contracts: `getCountryLanguageConfiguration`, `previewCountryLanguageBootstrap` (dry-run report), `getCountryLanguageManagement`, `publishCountryLanguages`. The effective-language rule lives once in `country-languages.ts`.
- Error types chosen (seam left them open): uninitialized save, stale version, missing/inactive target, English/referenced deactivation and bootstrap prerequisites → `CONFLICT`; malformed input and unconfigured new country → `INVALID_DATA`; uninitialized or broken-invariant publication/management read → `UNEXPECTED_STATE` (task 02 maps to 503); configuration lock wait over 5 s (`SET LOCAL lock_timeout`, SQLSTATE 55P03) → `CONFLICT` "being changed by someone else".
- Bootstrap against an existing singleton returns `{ created: false, configuration }` (unchanged document) instead of failing, so the operator script stays idempotent.
- Singleton uniqueness is the fixed primary key plus the configuration lock; a "one row only" check constraint is not expressible in a generated migration.
- Existing `storefront-translation.spec.ts` needed no change: none of its activation assertions deactivates English or an assigned language, and all 23 still pass. The new behaviour is covered in the new spec.
- "Independent service instances" are a second module instance created with `initModules` (distinct options, own connection pool) inside the module spec.
- `pnpm ai:check` reports AGENTS.md over 32 KiB on this Windows checkout because of CRLF line endings (HEAD's file was already 32,940 bytes on disk); the LF blob that gets committed is 32,633 bytes, under the limit. Kept the registry row short for that reason.
- `medusa db:migrate` on the local database printed "Migrations completed" for `Migration20261020125711` but the process did not exit within ~7 minutes and was stopped; the migration itself is applied.

## Done-when evidence

- Generated migration applies on test database: `src/modules/storefront-translation/__tests__/country-language-configuration.spec.ts` runs with `pathToMigrations` (all 23 tests build their schema from `Migration20261020125711`); also applied locally by `medusa db:migrate` (`✔ Migrated Migration20261020125711`).
- Stored document invariants: same spec, "bootstrap" (`starts uninitialized…`, `repeated bootstrap never overwrites…`, `concurrent bootstraps … exactly one singleton`, `refuses missing or inactive prerequisites…`, `rejects non-canonical…`, `accepts a valid ninth language…`) and "assignment" (`returns the committed document and conflicts on a replayed expected version`, `a missing or inactive target leaves the previous document…`, `rejects non-canonical or out-of-bounds input…`, `creates only for configured countries but lets retained entries be reassigned`, `concurrent same-version saves on independent instances…`).
- Active-state invariants: same spec, "deactivation integrity" (`never deactivates English…`, `retained references block deactivation until explicitly reassigned`, `assignment committed first…`, `deactivation committed first…`, `racing assignment and deactivation on independent instances…`, `a lock timeout and rollback leave no leaked lock…`) and "reads" (`fails publication closed…`). Removing the configuration lock from activation makes both ordered tests fail (mutation check run).
- No other module table accessed: service SQL touches only `country_language_configuration`, `storefront_translation`, `translation_missing_key` (review of `service.ts`); no cross-module import.
- Also update, existing spec activation expectations: no change needed (see Deviations); suite re-run, 23/23 pass.
- Also update, module registration: unchanged (`index.ts`, `medusa-config.ts` untouched); the model is loaded from `models/`.
- Also update, data-ownership: `ai/architecture/data-ownership.md` registry row now lists `country_language_configuration`.
- Also update, business-rule registry: `ai/architecture/decisions.md` row "Country language assignment and deactivation guard"; root `AGENTS.md` and `.github/copilot-instructions.md` regenerated by `pnpm ai:check --fix`.
