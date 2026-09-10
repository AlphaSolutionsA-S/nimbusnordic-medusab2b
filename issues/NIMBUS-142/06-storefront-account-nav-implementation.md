# Task 06 — Account-nav Claims links + navigation tests

**App:** storefront · **Depends on:** 05, 03

## Project Environment

- **App root:** `apps/storefront`
- **File under change:**
  `apps/storefront/src/modules/account/components/account-nav/index.tsx`
- **Test command:** `pnpm --filter @b2b-starter/storefront test`

## Objective

Add a `Claims` entry to **both** account-navigation variants (mobile and desktop) so
every authenticated employee can reach `/account/claims`. No `is_admin` gate. Match the
existing link markup, `data-testid` convention, and icon usage exactly.

## Solution Design

`account-nav/index.tsx` renders two lists: a mobile list of `LocalizedClientLink` rows
(`data-testid="*-link"`) and a desktop list of `AccountNavLink`. The Claims entry mirrors
the existing `Orders`/`BC Orders` entries (visible to all employees, no admin guard),
placed consistently in both variants. Reuse an existing icon (e.g. `FilePlus` or
`Package`) already imported in the file to avoid a new import unless a distinct icon is
preferred.

## Impacted Files

### `apps/storefront/src/modules/account/components/account-nav/index.tsx`

**Mobile variant** — add after the `bc-orders-link` list item, before the admin-gated
`approvals` item:

```tsx
<li>
  <LocalizedClientLink
    href="/account/claims"
    className="flex items-center justify-between py-4 border-b border-gray-200 px-8"
    data-testid="claims-link"
  >
    <div className="flex items-center gap-x-2">
      <FilePlus size={16} />
      <span>Claims</span>
    </div>
    <ChevronDown className="transform -rotate-90" />
  </LocalizedClientLink>
</li>
```

**Desktop variant** — add after the `bc-orders-link` `AccountNavLink`, before the
admin-gated `approvals` entry:

```tsx
<li>
  <AccountNavLink
    href="/account/claims"
    route={route!}
    data-testid="claims-link"
  >
    Claims
  </AccountNavLink>
</li>
```

> IMPLEMENT: place both entries at the same logical position in their respective lists;
> reuse an already-imported icon. Do not add an `is_admin` condition.

## Test Cases

### TC-1: Desktop nav shows Claims for any employee
- **Given:** `AccountNav` with a non-admin `customer` (`employee.is_admin === false`)
- **When:** rendered
- **Then:** a `claims-link` targeting `/account/claims` is present in the desktop nav

### TC-2: Mobile nav shows Claims
- **Given:** `AccountNav` rendered at the account root (mobile list expanded)
- **When:** rendered
- **Then:** the mobile `claims-link` is present and targets `/account/claims`

### TC-3: No admin gating
- **Given:** a non-admin customer
- **When:** rendered
- **Then:** Claims is visible even though `approvals-link` is not

## Implementation Steps

1. Add the mobile and desktop Claims entries in `account-nav/index.tsx`, mirroring the
   existing non-admin entries and reusing an imported icon.
2. Add `src/__tests__/modules/account/components/account-nav.test.tsx` covering
   TC-1..TC-3, mocking `next/navigation` (`usePathname`, `useParams`) and the
   `signout` data function as needed.
3. Run the storefront test suite and lint; confirm green.

## Guardrails

- Touch only the two nav variants; no unrelated nav restructuring.
- Reuse existing imports/icons; add a new icon import only if genuinely needed.
- No `is_admin` condition on the Claims entry.
- Match existing `data-testid` and class conventions exactly.
