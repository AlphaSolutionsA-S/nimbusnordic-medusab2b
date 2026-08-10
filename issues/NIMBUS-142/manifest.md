# Implementation Manifest: NIMBUS-142 — Payload-managed Claim information page

**Project ID:** NIMBUS-142
**Date:** 2026-08-10
**Ready for Dispatch:** true

## Branch

`feature/NIMBUS-142` (from `develop`)

## Test strategy

Option B (pragmatic). New automated coverage for the new surface only:

- **CMS (`apps/cms`):** Vitest — URL allowlist, media validation, singleton guard,
  access control (published-only service reads, admin-only writes).
- **Storefront (`apps/storefront`):** Jest + React Testing Library (newly wired) — CMS
  client, Claims block renderer (fail-closed), Claims route unavailable state, account-nav
  links.
- No backfill of pre-existing untested storefront components.
- Deployment/security verification runs manually in a deployed environment (task 07).

## Tasks

| # | Title | File | App | Depends On | Status |
|---|-------|------|-----|------------|--------|
| 01 | Payload CMS app scaffold | `01-cms-app-scaffold-implementation.md` | cms | None | TODO |
| 02 | Collections, access control, media validation + CMS tests | `02-cms-collections-access-tests-implementation.md` | cms | 01 | TODO |
| 03 | Storefront Jest + RTL infrastructure | `03-storefront-test-infra-implementation.md` | storefront | None | TODO |
| 04 | Storefront server-only CMS client + types + tests | `04-storefront-cms-client-implementation.md` | storefront | 03 | TODO |
| 05 | Claims block renderer + `/account/claims` route | `05-storefront-claims-route-implementation.md` | storefront | 04 | TODO |
| 06 | Account-nav Claims links + navigation tests | `06-storefront-account-nav-implementation.md` | storefront | 05, 03 | TODO |
| 07 | Deployment, secrets & security verification | `07-deployment-security-verification-implementation.md` | cms + storefront | 02, 05 | TODO |

## Suggested execution order

1. **01 → 02** (CMS track) and **03 → 04 → 05 → 06** (storefront track) can proceed in
   parallel; the storefront client (04) can be built against the Payload API contract
   from 02 using mocks.
2. **07** last — it depends on both a working CMS (02) and the storefront route (05).

## Apps affected

- `apps/cms` (new Payload 3 service)
- `apps/storefront` (Claims route, nav, server-only CMS client, Jest infra)
- Deployment/config only: separate Linux Azure App Service (Node 22), Azure PostgreSQL,
  Azure Blob Storage; storefront deployment env vars. No `apps/backend` changes.
