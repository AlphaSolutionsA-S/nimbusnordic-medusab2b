# Implementation Manifest: Validate country codes in submitted orders

**Project ID:** NIMBUS-171
**Date:** 2026-09-30
**Ready for Dispatch:** true (the user approved PLAN.md on 2026-09-30; see its "Resolved decisions")

## Branch

`feature/NIMBUS-171` (from `develop`). Created and checked out during planning; nothing committed.

## Tasks

| # | Title | File | App | Depends On | Status |
|---|-------|------|-----|------------|--------|
| 01 | Backend country-code rule on canonical addresses | `01-country-code-rule-implementation.md` | backend | None | TODO |
| 02 | HTTP and workflow integration tests for the country rule | `02-country-code-integration-tests-implementation.md` | backend | 01 | TODO |
| 03 | APIM shape check and contract docs for `country` | `03-contract-artifacts-implementation.md` | backend (contract artifacts) | 01 | TODO |

Tasks 02 and 03 are independent of each other and can run in either order after 01.

## Out of implementor scope

- Re-registering the two schemas in Azure APIM (NIMBUS-145 deployment instructions, section 2)
  and running the manual test payloads TC-16, TC-17 and TC-13c.
- Any Jira change.
- Commits and pushes.
