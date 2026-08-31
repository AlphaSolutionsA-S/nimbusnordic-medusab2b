# Task 04: Triage and Fix Layout Breaks — Implementation Plan

**Status:** TODO
**App:** storefront
**App Root:** apps/storefront
**Task ID:** 04
**Date:** 2026-08-31
**Branch:** feature/NIMBUS-169 (from develop)
**Depends on:** Task 02 (baseline screenshots), Task 03 (functional checks) — this task acts on
their findings

---

## Project Environment

- **App root:** `apps/storefront`
- **Build command:** `pnpm build`
- **Lint command:** `pnpm lint`
- **Test command:** `cd apps/storefront && pnpm test:visual`
- **Test framework:** Playwright

## Solution Design

**This task is inherently reactive** — its content depends on what Tasks 02/03 actually find when
run against the real, fully-translated storefront (i.e. after NIMBUS-163–168 have landed). It
cannot be scoped as concrete file edits up front the way the other tasks in this epic can. Instead,
this task defines the **process**:

1. Run the full visual suite (`pnpm test:visual`) across all 8 locales, both viewports, with
   NIMBUS-163–168's changes in place.
2. For each failing screenshot comparison, open Playwright's HTML report
   (`playwright-report/index.html`) to see the actual/expected/diff images.
3. Classify each failure:
   - **Text overflow/truncation** (the scope's primary concern — German/French text expansion) —
     fix via CSS (e.g. allow wrapping, reduce font-size at breakpoint, widen a container,
     `text-overflow: ellipsis` if truncation is acceptable for that element) rather than shortening
     the translated string (translation content is NIMBUS-167's domain, not this task's).
   - **Layout shift/overlap** — fix via the specific component's Tailwind classes.
   - **False positive** (e.g. a dynamic timestamp/price rendering differently by locale's number
     formatting, which is expected and correct) — update the baseline screenshot instead of
     "fixing" a non-bug; document why in the PR description.
4. Re-run the suite after each fix batch; update baselines (`pnpm test:visual:update`) once a
   screenshot's new appearance is the accepted correct state.
5. Repeat until the suite is green (excluding accepted, documented false positives).

## Code Skeletons

Not applicable — fixes are CSS/markup adjustments to whatever components the triage identifies, in
their existing files, following each component's existing styling conventions (Tailwind utility
classes, matching the surrounding code's patterns — no new styling system introduced for this).

## Impacted Files

Not knowable in advance — determined by Task 02/03's actual findings. Document the final list of
touched files in the PR description when this task completes, along with a one-line note per fix
(e.g. "German nav label overflowed at mobile width — allowed wrapping instead of forcing single
line").

## Test Cases

### TC-1: Full suite passes (or documented exceptions only)
- **Given:** all fixes from this task applied
- **When:** `pnpm test:visual` runs across all 16 projects
- **Then:** all specs pass, or any remaining failures are explicitly documented as accepted
  locale-specific rendering differences (not bugs) with a comment in the spec or PR description

### TC-2: No fix altered translated content to "solve" overflow
- **Given:** any text-overflow fix made during triage
- **When:** reviewed
- **Then:** the fix is a CSS/layout change, not a shortened/altered translation string — confirms
  fixes address the layout, not the (out-of-scope) translation content

## Implementation Steps

1. Ensure NIMBUS-163–168 are merged/available on this branch (or a branch built on top of them) —
   this task has nothing meaningful to triage against unfinished prior stories.
2. Run the full suite, review the HTML report for every failure.
3. Fix genuine layout breaks; update baselines for accepted rendering differences.
4. Re-run until green (or only documented exceptions remain).
5. Run `pnpm lint`, `pnpm build`.

## Risks

- **This task's scope and duration are open-ended until Tasks 02/03 produce real findings.** If
  triage surfaces a large number of breaks (e.g. systemic issues with how German/French text wraps
  across many shared components), flag to the user that this may need to be split into its own
  follow-up work rather than absorbed silently into this task — do not silently under-deliver by
  fixing only the easiest breaks and calling the suite "green" via skipped/ignored tests.
