# Implementation Manifest: Translated Content for All Locales

**Project ID:** NIMBUS-167
**Date:** 2026-08-31
**Ready for Dispatch:** false — blocked on the open MT-provider question in Task 01

## Branch

`feature/NIMBUS-167` (from `develop`)

## Tasks

| # | Title | File | App | Depends On | Status |
|---|-------|------|-----|------------|--------|
| 01 | Machine translation script for message catalogs | `01-machine-translation-script-implementation.md` | storefront | NIMBUS-165 (English keys extracted) | TODO |
| 02 | MT output sanity spot-check | `02-mt-quality-spotcheck-implementation.md` | storefront | Task 01 | TODO |

## Cross-Project Dependency

Hard-depends on **NIMBUS-165** being complete — all UI strings must already be extracted into
`apps/storefront/messages/en.json` before this story's translation pass has anything to translate.

## Blocking Open Question

Task 01 requires an MT provider/API decision (DeepL, Google Cloud Translate, Azure Translator,
etc.) that this plan does not make unilaterally — see Task 01's Risks section. Resolve this with
the user before dispatching Task 01.
