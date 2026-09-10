# Implementation Manifest: Extract UI Text into Translation Keys

**Project ID:** NIMBUS-165
**Date:** 2026-08-31
**Ready for Dispatch:** true

## Branch

`feature/NIMBUS-165` (from `develop`)

## Tasks

| # | Title | File | App | Depends On | Status |
|---|-------|------|-----|------------|--------|
| 01 | Namespace convention & extraction checklist | `01-namespace-convention-and-checklist-implementation.md` | storefront | None | TODO |
| 02 | Extract layout (nav/header/footer) strings | `02-extract-layout-strings-implementation.md` | storefront | Task 01 | TODO |
| 03 | Extract checkout form strings | `03-extract-checkout-strings-implementation.md` | storefront | Task 01 | TODO |
| 04 | Extract account/auth strings (login, register) | `04-extract-account-strings-implementation.md` | storefront | Task 01 | TODO |
| 05 | Remaining modules sweep & regression check | `05-remaining-modules-sweep-implementation.md` | storefront | Task 01, 02, 03, 04 | TODO |

## Cross-Project Dependency

Depends on **NIMBUS-163** (message catalogs at `apps/storefront/messages/*.json` and the
`useTranslations`/`getTranslations` consumption pattern) being implemented first.
