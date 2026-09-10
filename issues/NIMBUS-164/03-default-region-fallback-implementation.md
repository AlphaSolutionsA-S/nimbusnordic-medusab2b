# Task 03: Update DEFAULT_REGION Fallback to English/GB — Implementation Plan

**Status:** TODO
**App:** storefront
**App Root:** apps/storefront
**Task ID:** 03
**Date:** 2026-08-31
**Branch:** feature/NIMBUS-164 (from develop)
**Depends on:** None

---

## Project Environment

- **App root:** `apps/storefront`
- **Build command:** `pnpm build` (from repo root) or `cd apps/storefront && pnpm build`
- **Lint command:** `pnpm lint` (from repo root)
- **Test command:** `cd apps/storefront && pnpm test`
- **Test framework:** Jest + React Testing Library
- **Test location:** `apps/storefront/src/__tests__/middleware.test.ts` (new — `middleware.ts` has
  no existing test file)
- **Naming conventions:** per `apps/storefront/copilot-instructions.md`

## Solution Design

`apps/storefront/src/middleware.ts:6` currently defaults to `"us"`, which is not one of the 8
target locales/countries and doesn't match any Medusa region after this epic ships. Change the
**code-level fallback default** to `"gb"` (English, per NIMBUS-159's resolved "en → GB" mapping
decision, consistent with `COUNTRY_LANGUAGE_MAP` from Task 01).

This only changes the fallback used when `NEXT_PUBLIC_DEFAULT_REGION` is unset. Deployed
environments (staging/production) that have `NEXT_PUBLIC_DEFAULT_REGION=us` set explicitly in
their environment variables will keep resolving to `us` until that variable is updated — this is a
manual ops step, called out explicitly in Risks below.

## Impacted Files

- `apps/storefront/src/middleware.ts:6`:
  - Before: `const DEFAULT_REGION = process.env.NEXT_PUBLIC_DEFAULT_REGION || "us"`
  - After: `const DEFAULT_REGION = process.env.NEXT_PUBLIC_DEFAULT_REGION || "gb"`
- `apps/storefront/.env.template:10-11`:
  - Update the documented default value for `NEXT_PUBLIC_DEFAULT_REGION` from `us` to `gb`
    (keep the existing "ISO-2 lowercase format" comment).
- `README.md:157`:
  - Update the table entry `NEXT_PUBLIC_DEFAULT_REGION | Default region code (e.g. us)` to
    reference `gb` instead of `us`.

## Test Cases

### TC-1: Fallback resolves to gb when env var is unset
- **Given:** `NEXT_PUBLIC_DEFAULT_REGION` is not set in the test environment
- **When:** the middleware's `getCountryCode` runs with a region map that includes `gb` and a
  request with no URL country segment and no geo-IP header match
- **Then:** it resolves `countryCode` to `"gb"`

### TC-2: Explicit env var still overrides the new default
- **Given:** `NEXT_PUBLIC_DEFAULT_REGION=dk` is set
- **When:** `getCountryCode` runs under the same no-match conditions as TC-1
- **Then:** it resolves `countryCode` to `"dk"`, confirming the fallback constant doesn't shadow
  an explicitly configured value

## Implementation Steps

1. Change line 6 in `middleware.ts` as specified.
2. Update `.env.template` and `README.md` documentation as specified.
3. Add `apps/storefront/src/__tests__/middleware.test.ts` covering TC-1 and TC-2. If
   `getCountryCode`/`getRegionMap` are not currently exported from `middleware.ts` (they are
   private functions today), either export them for testability or write the test against the
   exported `middleware` function with a mocked `fetch` for `/store/regions` — follow whichever
   pattern keeps the change minimal; do not restructure `middleware.ts` beyond what's needed to
   make these two functions testable.
4. Run `pnpm test` and `pnpm lint`.

## Risks

- **Deployed environments with `NEXT_PUBLIC_DEFAULT_REGION=us` set explicitly are unaffected by
  this code change** — the env var takes precedence over the fallback constant. Document in the PR
  description that staging/production environment variables should be updated to `gb` (or removed,
  to pick up the new code default) as part of this rollout; this is an infrastructure/ops action,
  not something this PR can perform.
