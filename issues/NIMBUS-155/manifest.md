# Implementation Manifest: Make BC Customer Number Read-Only in Storefront

**Project ID:** NIMBUS-155
**Date:** 2026-08-19
**Ready for Dispatch:** true

## Branch

Work directly on `develop` (small fix — no feature branch, per requester).

## Tasks

| # | Title | File | App | Depends On | Status |
|---|-------|------|-----|------------|--------|
| 01 | Storefront read-only BC number (UI, type, payload, test) | `01-storefront-bc-number-read-only-implementation.md` | storefront | None | Complete |
| 02 | Store API rejects BC number on create + update + integration tests | `02-backend-store-bc-number-reject-implementation.md` | backend | None | Validation blocked |
| 03 | Verification (lint, build, focused tests) | `03-verification-implementation.md` | both | 01, 02 | Validation blocked |
