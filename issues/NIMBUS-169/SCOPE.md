# Cross-locale QA

- **Date:** 2026-08-31
- **Status:** Scoped (draft — pending approval)
- **Type:** Story
- **Tracker:** JIRA — https://alphasolutionsdk.atlassian.net/browse/NIMBUS-169
- **Epic:** NIMBUS-159 (Multi-lingual Storefront) — see `issues/NIMBUS-159/SCOPE.md` for shared
  decisions.
- **Priority:** Medium
- **Project Folder:** issues/NIMBUS-169/
- **Size:** L
- **Area:** Storefront (Next.js) — test tooling / QA
- **Base Branch:** develop

## Background

Text-expansion in longer languages (German, French) can break layouts that were only ever
designed/tested against the original single-language copy. This story verifies the storefront
holds up visually and functionally across all 8 locales before launch.

No visual-regression tooling exists in the storefront today (confirmed: no Playwright/Percy/
Chromatic/BackstopJS dependency) — this story is greenfield setup, not an extension of
existing tooling.

## Requirements

### Functional

- Stand up **automated visual regression testing** across the 8 target locales, covering key
  flows: home, PLP, PDP, cart, checkout, account pages.
- Cover both **desktop and mobile viewports** for each locale.
- Flag layout breaks caused by text expansion, overflow, or truncation.
- Verify functional correctness alongside visuals: links resolve to the correct locale,
  region switcher (NIMBUS-166) works from every starting locale.

### Non-Functional

- Regression suite should be re-runnable for future storefront changes, not a one-off manual
  exercise.

## Affected Apps

- **storefront** only (test tooling lives alongside the existing Jest/RTL setup, per
  `apps/storefront/copilot-instructions.md`).

## Proposed Tasks

1. Select and set up a visual regression tool (e.g. Playwright's built-in screenshot
   comparison) — no existing tool to extend.
2. Define baseline screenshots for key flows × 8 locales × desktop/mobile.
3. Run the suite, triage and fix layout breaks found.
4. Add functional checks (region switcher, locale-correct links) alongside visual checks.

## Open Questions

- Tool choice (e.g. Playwright screenshot comparison vs. a dedicated service) is left to the
  implementation-planner/implementor — no existing convention in this repo to follow.

## Dependencies

- Depends on **NIMBUS-163–168** being substantially complete — this is the epic's final
  verification pass.
- Parent epic: **NIMBUS-159**.
