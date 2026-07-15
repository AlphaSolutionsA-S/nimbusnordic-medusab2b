# Create Medusa module for Business Central connectivity and migrate bc-utility

- **Date:** 2026-07-15
- **Status:** Feature captured
- **Type:** Story
- **Tracker:** JIRA — https://alphasolutionsdk.atlassian.net/browse/NIMBUS-153
- **Priority:** Medium
- **Project Folder:** issues/NIMBUS-153/
- **Size:** M
- **Area:** Backend / Business Central Integration
- **Base Branch:** develop
- **Requested by:** Project stakeholder
- **Requested at:** 2026-07-15T12:14:30Z

## Description
Create a dedicated Medusa module that encapsulates Business Central connectivity and move the current bc-utility logic into that module.

## Why
This improves maintainability by centralizing integration logic, reduces coupling across backend code, and creates a cleaner interface for future Business Central enhancements.

## Acceptance criteria
- [ ] A new Medusa module exists for Business Central connectivity.
- [ ] Existing bc-utility logic is migrated into the module.
- [ ] Business Central authentication and configuration are managed through module configuration.
- [ ] Existing consumers are updated to use the module interface.
- [ ] Existing Business Central-related behavior remains functionally unchanged after migration.
- [ ] Verification covers module initialization and core connectivity paths.

## Out of scope
- Re-designing Business Central business logic behavior.
- Adding new Business Central features beyond the migration.
- Storefront-facing feature changes unrelated to integration encapsulation.

## Open questions
- Should this be split into multiple stories for migration vs. refactor hardening?
- Are there environment-specific credentials/config differences that need separate rollout handling?

## Mockups / references
- Engineering detail: https://github.com/AlphaSolutionsA-S/nimbusnordic-medusab2b/blob/develop/issues/NIMBUS-153/FEATURE.md

## Technical notes

