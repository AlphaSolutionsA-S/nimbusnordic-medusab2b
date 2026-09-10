# Implementation Manifest: Region Switcher

**Project ID:** NIMBUS-166
**Date:** 2026-08-31
**Ready for Dispatch:** true

## Branch

`feature/NIMBUS-166` (from `develop`)

## Tasks

| # | Title | File | App | Depends On | Status |
|---|-------|------|-----|------------|--------|
| 01 | Region switcher component | `01-region-switcher-component-implementation.md` | storefront | None (NIMBUS-164 Task 01 for language labels) | TODO |
| 02 | Mobile layout & country-select conflict check | `02-mobile-layout-and-conflict-check-implementation.md` | storefront | Task 01 | TODO |

## Cross-Project Dependency

Depends on **NIMBUS-164 Task 01** (`country-language-map.ts`) for `getLocaleForCountry`, used to
show each region's language in the switcher. Does **not** hard-depend on NIMBUS-163/165 (i18n
foundation/string extraction) — if implemented first, use a hardcoded `aria-label` with a
`// TODO(NIMBUS-165)` comment per Task 01's note, rather than blocking on those stories.
