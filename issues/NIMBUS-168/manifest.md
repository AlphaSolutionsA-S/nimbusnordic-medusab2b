# Implementation Manifest: SEO Metadata and hreflang

**Project ID:** NIMBUS-168
**Date:** 2026-08-31
**Ready for Dispatch:** true

## Branch

`feature/NIMBUS-168` (from `develop`)

## Tasks

| # | Title | File | App | Depends On | Status |
|---|-------|------|-----|------------|--------|
| 01 | hreflang helper & alternates on public pages | `01-hreflang-helper-and-root-metadata-implementation.md` | storefront | None | TODO |
| 02 | Localize page title/description generation | `02-localized-metadata-implementation.md` | storefront | Task 01 (same files) | TODO |

## Cross-Project Dependency

Depends on **NIMBUS-163** (locale resolution: `getLocaleForCountry`) and **NIMBUS-164** (country
list: `COUNTRY_LANGUAGE_MAP`) already existing. Does not depend on NIMBUS-165/167 (string
extraction/translation) — Task 02 adds its own small `MetaDescription` namespace independently.
