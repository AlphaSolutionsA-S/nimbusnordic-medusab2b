# Region Switcher

- **Date:** 2026-08-31
- **Status:** Scoped (draft — pending approval)
- **Type:** Story
- **Tracker:** JIRA — https://alphasolutionsdk.atlassian.net/browse/NIMBUS-166
- **Epic:** NIMBUS-159 (Multi-lingual Storefront) — see `issues/NIMBUS-159/SCOPE.md` for shared
  decisions.
- **Priority:** Medium
- **Project Folder:** issues/NIMBUS-166/
- **Size:** M
- **Area:** Storefront (Next.js) — global UI component
- **Base Branch:** develop

## Background

Only country-select components inside checkout/account address forms were found during epic
scoping (`modules/checkout/components/country-select`) — no site-wide way to change
country/region (and therefore language) exists today. This story adds one.

## Requirements

### Functional

- Add a region switcher to the **site header**, visible on all pages.
- Lists the 8 supported countries/regions (DK, GB, SE, NO, PL, IT, FR, DE — per NIMBUS-164's
  mapping), showing each region's associated language.
- Selecting a region **redirects the visitor to that region's homepage** (not the equivalent
  page they were on).
- Reuses the existing `/{countryCode}/...` routing in `middleware.ts` — switching region means
  navigating to `/{newCountryCode}`.

### Non-Functional

- Must be usable on mobile viewports (header space is limited).
- Should not be confused with the existing checkout/account country-select (which sets a
  shipping/billing country, not the browsing region) — keep them visually and functionally
  distinct.

## Affected Apps

- **storefront** only.

## Proposed Tasks

1. Design/build a header region-switcher component (dropdown or similar).
2. Wire selection to redirect to `/{selectedCountryCode}` (homepage).
3. Verify no conflict/confusion with the existing checkout/account address country-select.
4. Mobile layout check.

## Open Questions

- None. Placement (header) and switch behavior (redirect to homepage) resolved during
  scoping.

## Dependencies

- Depends on **NIMBUS-164** (country→language mapping) for the list of regions/languages to
  display.
- Parent epic: **NIMBUS-159**.
