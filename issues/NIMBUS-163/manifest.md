# Implementation Manifest: i18n Foundation & Routing Integration

**Project ID:** NIMBUS-163
**Date:** 2026-08-31
**Ready for Dispatch:** true

## Branch

`feature/NIMBUS-163` (from `develop`)

## Tasks

| # | Title | File | App | Depends On | Status |
|---|-------|------|-----|------------|--------|
| 01 | Install next-intl and wire provider config | `01-nextintl-setup-implementation.md` | storefront | NIMBUS-164 Task 01 | TODO |
| 02 | Message catalog scaffolding (8 locales) | `02-message-catalog-scaffolding-implementation.md` | storefront | Task 01 | TODO |
| 03 | Shared locale layout & provider wiring | `03-locale-provider-wiring-implementation.md` | storefront | Task 01, Task 02 | TODO |

## Cross-Project Dependency

This project depends on **NIMBUS-164 Task 01** (`apps/storefront/src/lib/i18n/country-language-map.ts`)
existing before Task 01 can import `getLocaleForCountry`. If NIMBUS-164 has not been implemented
yet, dispatch it first or implement its Task 01 as a prerequisite step of this branch.
