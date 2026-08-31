# Task 01: Region Switcher Component — Implementation Plan

**Status:** TODO
**App:** storefront
**App Root:** apps/storefront
**Task ID:** 01
**Date:** 2026-08-31
**Branch:** feature/NIMBUS-166 (from develop)
**Depends on:** NIMBUS-164 Task 01 (`country-language-map.ts`, for language labels)

---

## Project Environment

- **App root:** `apps/storefront`
- **Build command:** `pnpm build`
- **Lint command:** `pnpm lint`
- **Test command:** `cd apps/storefront && pnpm test`
- **Test framework:** Jest + React Testing Library
- **Test location:** `apps/storefront/src/__tests__/modules/layout/`
- **Naming conventions:** kebab-case directories, PascalCase component files (per
  `apps/storefront/copilot-instructions.md`)

## Solution Design

Add a new component `RegionSwitcher` to `apps/storefront/src/modules/layout/components/region-switcher/`
(sibling to the existing `mega-menu` and `cart-mismatch-banner` client components under
`modules/layout/components/`). Render it inside `NavigationHeader`
(`apps/storefront/src/modules/layout/templates/nav/index.tsx`), which is a Server Component —
`RegionSwitcher` itself must be a Client Component (it needs `onClick`/navigation interactivity),
following the same "client child inside server parent" pattern already used for `MegaMenuWrapper`.

**No existing Radix/shadcn Select or Dropdown primitive exists in this codebase** (confirmed by
exploration — only `@radix-ui/react-dialog` is a dependency). Rather than introduce a new Radix
dependency for a single dropdown, reuse the existing **`NativeSelect`** component
(`apps/storefront/src/modules/common/components/native-select/index.tsx`) — the same primitive the
checkout/account country-select already uses — for consistency with the codebase's current pattern
and to avoid a new dependency. This also naturally satisfies the "keep visually/functionally
distinct from the checkout country-select" requirement: same underlying primitive, different
component, different behavior (redirect to homepage vs. set a form field), different location
(header vs. form), and distinct labeling (shows language alongside country name).

Selection redirects via `window.location.href = /${newCountryCode}` (a full navigation, not a
Next.js client-side route change) — because switching region must re-trigger `middleware.ts`'s
region/cookie logic for the new country code, a plain `router.push` could leave stale
region-derived cookies/state from the previous country.

Region/country list is fetched via the existing `listRegions()` from `apps/storefront/src/lib/data/regions.ts`.
Since `NavigationHeader` is already a Server Component performing async data fetching, fetch
regions there and pass the flattened country list down as a prop to `RegionSwitcher` — avoids a
second client-side fetch and matches the "fetch at route/parent level, pass as props" rule in
`copilot-instructions.md`.

## Code Skeletons

### New File: `apps/storefront/src/modules/layout/components/region-switcher/index.tsx`

```tsx
'use client'

import { useTranslations } from 'next-intl'
import { useParams } from 'next/navigation'

import { NativeSelect } from '@/modules/common/components/native-select'
import { getLocaleForCountry } from '@/lib/i18n/country-language-map'

export type RegionSwitcherOption = {
  countryCode: string
  countryName: string
}

type RegionSwitcherProps = {
  options: RegionSwitcherOption[]
}

export function RegionSwitcher({ options }: RegionSwitcherProps) {
  const t = useTranslations('Layout.regionSwitcher')
  const params = useParams<{ countryCode: string }>()

  const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newCountryCode = event.target.value
    if (newCountryCode && newCountryCode !== params.countryCode) {
      window.location.href = `/${newCountryCode}`
    }
  }

  return (
    <NativeSelect
      aria-label={t('label')}
      value={params.countryCode}
      onChange={handleChange}
    >
      {options.map((option) => (
        <option key={option.countryCode} value={option.countryCode}>
          {option.countryName} ({getLocaleForCountry(option.countryCode)})
        </option>
      ))}
    </NativeSelect>
  )
}
```

> **Worker note:** confirm `NativeSelect`'s exact prop names (`value`, `onChange`,
> `aria-label`/`placeholder`) against `apps/storefront/src/modules/common/components/native-select/index.tsx`
> before finalizing — it's a `forwardRef` component with a specific `NativeSelectProps` type;
> match that type exactly rather than assuming a plain `<select>`-compatible prop set.

### Modified File: `apps/storefront/src/modules/layout/templates/nav/index.tsx` (excerpt)

```tsx
import { RegionSwitcher } from '@/modules/layout/components/region-switcher'
import { listRegions } from '@/lib/data/regions'
// ...existing imports...

export async function NavigationHeader() {
  // ...existing customer/cart fetching unchanged...
  const regions = await listRegions()
  const regionOptions = regions.flatMap((region) =>
    (region.countries ?? []).map((country) => ({
      countryCode: country.iso_2 ?? '',
      countryName: country.display_name ?? country.iso_2 ?? '',
    }))
  )

  return (
    <header>
      {/* ...existing structure... */}
      <RegionSwitcher options={regionOptions} />
    </header>
  )
}
```

### Added keys: `apps/storefront/messages/en.json` (merge — depends on NIMBUS-163/165 catalogs existing)

```json
{
  "Layout": {
    "regionSwitcher": {
      "label": "Select your region"
    }
  }
}
```

## Impacted Files

- New: `apps/storefront/src/modules/layout/components/region-switcher/index.tsx`.
- `apps/storefront/src/modules/layout/templates/nav/index.tsx`: fetch regions via `listRegions()`
  and render `<RegionSwitcher />` with the flattened options.
- `apps/storefront/messages/{da,en,sv,no,pl,it,fr,de}.json`: add `Layout.regionSwitcher.label` (if
  NIMBUS-163/165 have landed; if this issue is implemented before those, use a plain hardcoded
  string for `aria-label` instead and leave a `// TODO(NIMBUS-165): extract to translation key`
  comment — do not block this story on i18n extraction being complete elsewhere).

## Test Cases

### TC-1: Renders all 8 target regions with language shown
- **Given:** `options` containing the 8 target countries (DK, GB, SE, NO, PL, IT, FR, DE)
- **When:** `RegionSwitcher` renders
- **Then:** all 8 appear as `<option>`s, each showing its language code per
  `getLocaleForCountry`

### TC-2: Selecting a region redirects to that region's homepage
- **Given:** the switcher is rendered with `params.countryCode = 'gb'`
- **When:** the user selects `dk` from the dropdown
- **Then:** `window.location.href` is set to `/dk` (mock `window.location` in the test and assert
  the assignment, not an actual navigation)

### TC-3: Selecting the currently-active region is a no-op
- **Given:** `params.countryCode = 'gb'`
- **When:** the user "re-selects" `gb` (e.g. programmatically firing a change event with the same
  value)
- **Then:** no navigation is triggered (`window.location.href` is not reassigned)

### TC-4: Distinct from checkout country-select (wiring/integration check)
- **Given:** both `RegionSwitcher` (header) and `CountrySelect` (checkout address form) are
  rendered in the same test tree
- **Then:** they resolve to different DOM elements with different `aria-label`s / accessible
  names, confirming no ID collision or accidental prop leakage between the two

## Implementation Steps

1. Read `native-select/index.tsx` in full to confirm exact prop types.
2. Create `region-switcher/index.tsx` per the skeleton, adjusting to `NativeSelect`'s real API.
3. Update `nav/index.tsx` to fetch regions and render the switcher.
4. Add message catalog keys (or the TODO-commented hardcoded fallback if i18n extraction hasn't
   landed yet — see Impacted Files note).
5. Add tests for TC-1–TC-4.
6. Manually verify in dev: switching region from any page navigates to the new region's homepage
   (not the equivalent page), confirming the "redirect to homepage, not equivalent page" behavior
   from scope.md.
7. Run `pnpm lint`, `pnpm test`, `pnpm build`.

## Risks

- Guardrail check: this does not modify `middleware.ts` — the switcher relies on the existing
  redirect-and-cookie logic there being re-triggered by a full page navigation to `/{countryCode}`.
