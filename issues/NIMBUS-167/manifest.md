# Implementation Manifest: Translated Content for All Locales

**Project ID:** NIMBUS-167
**Date:** 2026-08-31
**Ready for Dispatch:** true

## Branch

`feature/NIMBUS-167` (from `develop`)

## Tasks

| # | Title | File | App | Depends On | Status |
|---|-------|------|-----|------------|--------|
| 01 | Machine translation script for message catalogs (DeepL) | `01-machine-translation-script-implementation.md` | storefront | NIMBUS-165 (English keys extracted) | TODO |
| 02 | MT output sanity spot-check | `02-mt-quality-spotcheck-implementation.md` | storefront | Task 01 | TODO |

## Cross-Project Dependency

Hard-depends on **NIMBUS-165** being complete — all UI strings must already be extracted into
`apps/storefront/messages/en.json` before this story's translation pass has anything to translate.

## Provider Decision

MT provider: **DeepL API** (`deepl-node` SDK, `DEEPL_API_KEY` env var) — chosen for its
strength on European-language pairs, which covers all 7 target locales here. Requires a DeepL API
key to be provisioned (Free tier likely sufficient) before Task 01 can run against the real API —
see Task 01's Implementation Steps.
