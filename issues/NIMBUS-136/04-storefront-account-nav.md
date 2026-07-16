# Implementation Task 04: Storefront Account Nav — BC Orders Link

## Project Environment

- **App root:** `apps/storefront`
- **Build command:** `pnpm build` (from repo root) or `cd apps/storefront && pnpm build`
- **Lint command:** `pnpm lint` (from repo root)
- **Test command:** N/A — verify via `pnpm build`
- **Naming conventions:** Follow `apps/storefront/copilot-instructions.md`

## Solution Design

Add a `BC Orders` nav item that links to `/account/bcorders` in both the **mobile** nav list and the **desktop** nav list inside `AccountNav`. Place it immediately after the existing `Orders` item in both lists. Keep all other nav items and their behavior unchanged. The link must be visible to all authenticated customers (no `is_admin` gate).

## Code Skeletons

No new files. The skeleton below shows the exact insertion points for the two new `<li>` blocks.

### Modified File: `apps/storefront/src/modules/account/components/account-nav/index.tsx`

**Mobile nav — insert after the `Orders` `<li>` (after line 108, before the `{customer?.employee?.is_admin && ...}` block):**

```tsx
<li>
  <LocalizedClientLink
    href="/account/bcorders"
    className="flex items-center justify-between py-4 border-b border-gray-200 px-8"
    data-testid="bc-orders-link"
  >
    <div className="flex items-center gap-x-2">
      <Package size={20} />
      <span>BC Orders</span>
    </div>
    <ChevronDown className="transform -rotate-90" />
  </LocalizedClientLink>
</li>
```

**Desktop nav — insert after the `Orders` `<AccountNavLink>` `<li>` (after line ~203, before the `{customer?.employee?.is_admin && ...}` block):**

```tsx
<li>
  <AccountNavLink
    href="/account/bcorders"
    route={route!}
    data-testid="bc-orders-link"
  >
    BC Orders
  </AccountNavLink>
</li>
```

## Impacted Files

- `apps/storefront/src/modules/account/components/account-nav/index.tsx`
  - **Change:** Two `<li>` insertions — one in the mobile nav block, one in the desktop nav block — both immediately after the existing `Orders` item.
  - **No other changes.** Do not reorder existing items, add imports, or change styling.

## Test Cases

### TC-1: BC Orders link appears in desktop nav
- **Given:** Authenticated customer on any account page.
- **When:** The desktop account nav is rendered.
- **Then:** A nav item labeled "BC Orders" with `data-testid="bc-orders-link"` is present.

### TC-2: BC Orders link appears in mobile nav
- **Given:** Authenticated customer on the account overview page (mobile viewport).
- **Then:** A list item labeled "BC Orders" with `data-testid="bc-orders-link"` is present.

### TC-3: BC Orders link is active when on `/account/bcorders`
- **Given:** Current route is `/{countryCode}/account/bcorders`.
- **When:** Desktop nav renders.
- **Then:** The `BC Orders` `AccountNavLink` receives the active text styling (`text-neutral-950`).

### TC-4: Existing `Orders` link is unchanged
- **Given:** Any account page.
- **Then:** The `Orders` nav item still links to `/account/orders`, has `data-testid="orders-link"`, and its behavior is unmodified.

### TC-5: BC Orders link is visible to non-admin customers
- **Given:** Authenticated customer with `is_admin = false`.
- **Then:** "BC Orders" nav item is visible (it is not behind an `is_admin` gate).

## Implementation Steps

1. Open `apps/storefront/src/modules/account/components/account-nav/index.tsx`.
2. In the **mobile nav** `<ul>` block, locate the `<li>` containing the `href="/account/orders"` link. Insert the new mobile `<li>` for BC Orders immediately after it (before the `{customer?.employee?.is_admin && ...}` conditional).
3. In the **desktop nav** `<ul>` block, locate the `<li>` containing the `AccountNavLink` for `/account/orders`. Insert the new desktop `<li>` for BC Orders immediately after it (before the `{customer?.employee?.is_admin && ...}` conditional).
4. Run `cd apps/storefront && pnpm build` — fix any TypeScript errors.
5. Run `pnpm lint` — fix any lint issues.
