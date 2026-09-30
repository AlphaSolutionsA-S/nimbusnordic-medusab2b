# Implementation Manifest: Admin translation editor for storefront UI text

**Project ID:** NIMBUS-175
**Date:** 2026-09-30
**Ready for Dispatch:** true
**Approval:** Scope and plan explicitly approved by Klaus Petersen on 2026-09-30.

## Branch

`feature/NIMBUS-175` from `develop` (planning baseline `cdbc75a`).
Create the branch only when implementation starts.

## Tasks

| # | Title | File | App | Depends On | Status |
| --- | --- | --- | --- | --- | --- |
| 01 | Contracts and safe document helpers | `01-contracts-implementation.md` | backend | None | DONE |
| 02 | Models, migration, atomic persistence | `02-persistence-implementation.md` | backend | 01 | DONE |
| 03 | APIs and workflows | `03-api-implementation.md` | backend | 01, 02 | DONE |
| 04 | Admin harness and translation editor | `04-admin-editor-implementation.md` | backend Admin | 01, 03 | DONE |
| 05 | Admin language/import/missing-key tools | `05-admin-tools-implementation.md` | backend Admin | 04 | DONE |
| 06 | Storefront runtime and fallback | `06-storefront-runtime-implementation.md` | storefront | 03 | IN PROGRESS |
| 07 | Refresh and missing-key reporting | `07-reporting-refresh-implementation.md` | backend + storefront | 03, 06 | TODO |
| 08 | Verification and rollout | `08-verification-implementation.md` | backend + storefront | 05, 07 | TODO |

Read `PLAN.md` and `CONTRACTS.md` before any task. All tasks require their stated
tests; task completion is not inferred from a successful build. Tasks 04-05 and
06-07 can proceed independently after 03, with a single owner for shared files.
