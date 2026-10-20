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
