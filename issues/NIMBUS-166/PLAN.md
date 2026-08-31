# NIMBUS-166: Region Switcher

**Issue:** https://alphasolutionsdk.atlassian.net/browse/NIMBUS-166

## Objective
Add a site-wide, header-based way to switch country/region (and therefore language), redirecting
to the new region's homepage.

## Analysis
- No shadcn/Radix Select/Dropdown primitive exists in this codebase — only
  `@radix-ui/react-dialog` is installed. Reusing the existing `NativeSelect` component (the same
  primitive already powering the checkout/account country-select) avoids adding a new dependency
  and matches current conventions.
- `NavigationHeader` (`modules/layout/templates/nav/index.tsx`) is a Server Component with no
  existing `countryCode`/region prop-passing from any parent layout — data fetching happens inside
  it directly today (customer, cart). This task follows that same pattern: fetch regions inside
  `NavigationHeader` and pass them down as props to the new client `RegionSwitcher`.
- Selection must trigger a full page navigation (`window.location.href`), not a Next.js
  client-side route change, so `middleware.ts`'s cookie/region logic re-runs for the new country.
- Distinctness from the existing checkout country-select (a scope.md non-functional requirement)
  is satisfied structurally: different component, different location, different behavior (redirect
  home vs. set a form field), same underlying `NativeSelect` primitive for visual consistency with
  the rest of the app.

## Execution Plan
1. **Task 01:** build `RegionSwitcher` (client component, `NativeSelect`-based), wire it into
   `NavigationHeader`, fetching regions via the existing `listRegions()` data function.
2. **Task 02:** verify/adjust mobile layout placement, and do an explicit conflict check against
   the checkout country-select's styling/behavior.

## Decisions & Trade-offs
- Reused `NativeSelect` instead of introducing a new dropdown dependency — keeps the change
  minimal and consistent with the one existing select-style component in this codebase.
- Redirect uses `window.location.href`, not `router.push`, specifically to force `middleware.ts`'s
  region-resolution logic to re-run — a deliberate trade-off of a full-page reload for correctness
  over a marginally smoother client-side transition.
- Does not hard-depend on the i18n foundation stories (163/165) landing first — ships with a
  hardcoded, TODO-flagged label if those aren't yet in place, so this story isn't blocked on their
  sequencing.

## Verification
- [ ] All 8 target regions appear in the switcher with their language shown (TC-1, Task 01).
- [ ] Selecting a different region redirects to `/{newCountryCode}` (TC-2, Task 01).
- [ ] Re-selecting the current region is a no-op (TC-3, Task 01).
- [ ] Header switcher and checkout country-select remain visually/functionally distinct (TC-4,
      Task 01; TC-2, Task 02).
- [ ] Usable at mobile viewport widths without layout breakage (TC-1, Task 02).
- [ ] `pnpm lint`, `pnpm test`, `pnpm build` all pass.
