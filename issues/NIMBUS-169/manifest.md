# Implementation Manifest: Cross-locale QA

**Project ID:** NIMBUS-169
**Date:** 2026-08-31
**Ready for Dispatch:** true (Task 04 is inherently reactive — see PLAN.md)

## Branch

`feature/NIMBUS-169` (from `develop`)

## Tasks

| # | Title | File | App | Depends On | Status |
|---|-------|------|-----|------------|--------|
| 01 | Playwright visual regression setup | `01-playwright-setup-implementation.md` | storefront | None | DONE |
| 02 | Baseline screenshots for key flows | `02-baseline-screenshots-implementation.md` | storefront | Task 01 | DONE |
| 03 | Functional checks (region switcher, locale links) | `03-functional-checks-implementation.md` | storefront | Task 01, NIMBUS-166 | DONE |
| 04 | Triage and fix layout breaks | `04-triage-and-fix-layout-breaks-implementation.md` | storefront | Task 02, Task 03 | TODO |

## Cross-Project Dependency

This is the epic's final verification pass — depends on **NIMBUS-163 through NIMBUS-168** being
substantially complete. Task 01 (tooling setup) can be dispatched independently/early since it
doesn't depend on any translated content existing yet; Tasks 02–04 need real translated,
region-switcher-enabled, SEO-tagged pages to test against.
