# Task 02: Mobile Layout & Country-Select Conflict Check — Implementation Plan

**Status:** TODO
**App:** storefront
**App Root:** apps/storefront
**Task ID:** 02
**Date:** 2026-08-31
**Branch:** feature/NIMBUS-166 (from develop)
**Depends on:** Task 01 (`RegionSwitcher` component must exist)

---

## Project Environment

- **App root:** `apps/storefront`
- **Build command:** `pnpm build`
- **Lint command:** `pnpm lint`
- **Test command:** `cd apps/storefront && pnpm test`
- **Test framework:** Jest + React Testing Library
- **Test location:** `apps/storefront/src/__tests__/modules/layout/`
- **Naming conventions:** per `apps/storefront/copilot-instructions.md`

## Solution Design

Two non-functional requirements from scope.md need explicit follow-through beyond Task 01's core
component:

1. **Mobile usability** — `NavigationHeader` is a Server Component rendering a `<header>` with
   limited horizontal space; check whether the existing header already has a responsive/mobile nav
   pattern (e.g. a hamburger menu) that `RegionSwitcher` should be placed inside, rather than
   competing for space in the always-visible top bar on small viewports. This requires reading
   `nav/index.tsx`'s full JSX (not just the excerpts captured during exploration) to find any
   existing responsive breakpoint classes (Tailwind `md:`/`lg:` prefixes) or mobile-menu
   components.
2. **Visual/functional distinction from checkout country-select** — verified via Task 01's TC-4,
   but this task adds an explicit manual QA pass and Tailwind styling confirmation (e.g. the
   header switcher should sit in the header's chrome styling, not resemble a form field).

## Code Skeletons

No new component skeleton — this task adjusts `RegionSwitcher`'s placement/styling within the
existing header markup based on what Step 1 above finds. If a mobile menu component already
exists (e.g. a `Suspense`-wrapped mobile nav drawer), add `RegionSwitcher` there for small
viewports, and hide/show via Tailwind responsive classes (`hidden md:block` on the desktop
instance, the mobile-menu copy shown only below `md`), following whatever responsive pattern
`nav/index.tsx` already uses for its other elements (the worker must match the existing pattern
rather than invent a new responsive convention).

## Impacted Files

- `apps/storefront/src/modules/layout/templates/nav/index.tsx`: adjust `RegionSwitcher`
  placement/wrapper classes per whatever responsive pattern is found.
- `apps/storefront/src/modules/layout/components/region-switcher/index.tsx`: add/adjust Tailwind
  classes for mobile-friendly sizing (touch target size, no horizontal overflow) if needed.

## Test Cases

### TC-1: Region switcher is present and usable at mobile viewport width
- **Given:** a test render at a mobile viewport size (e.g. using `@testing-library/react` with a
  resized `window.innerWidth` or a dedicated responsive test utility already used elsewhere in
  this repo — check for precedent before introducing a new one)
- **When:** the header renders
- **Then:** `RegionSwitcher` (or its mobile-menu equivalent) is present in the accessible DOM and
  not visually clipped/hidden unintentionally

### TC-2: No accidental style/behavior bleed into checkout country-select
- **Given:** both components rendered together (extends Task 01's TC-4)
- **When:** inspecting computed class lists
- **Then:** `RegionSwitcher` does not share a CSS class that would cause the checkout
  country-select to inherit header-specific styling, and vice versa

## Implementation Steps

1. Read the full `nav/index.tsx` file to identify existing responsive/mobile patterns.
2. Place/style `RegionSwitcher` accordingly — reusing an existing mobile menu if one exists, or
   confirming the header's flex/wrap behavior already accommodates it if not.
3. Add tests for TC-1–TC-2.
4. Manually verify at common mobile breakpoints (375px, 414px widths) in dev tools.
5. Run `pnpm lint`, `pnpm test`, `pnpm build`.

## Risks

- If no existing mobile-menu pattern exists in this header, introducing one is a larger change
  than this story's scope implies ("mobile layout check" in scope.md, not "build a mobile nav").
  If the header's current layout already reflows acceptably (e.g. via flex-wrap) without a
  dedicated mobile menu, prefer minimal CSS adjustments over introducing new mobile-menu
  infrastructure — flag to the user if a larger mobile-nav rework looks necessary.
