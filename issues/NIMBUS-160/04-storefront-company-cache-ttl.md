# Task 04 — Storefront company retrieve cache TTL

**App:** storefront
**Depends on:** 03 (backend freshness gate must exist)
**Base branch:** `develop`

## Goal
Ensure the backend's 10-minute freshness gate is actually reached. `retrieveCompany` currently
caches the company response by tag with **no `revalidate`**, so Next.js serves it indefinitely until
a tag is revalidated — which would bypass the backend check after the first render. Add a 2-minute
`revalidate` so the cache self-heals: worst case ≈ 10 min (backend window) + 2 min (storefront TTL)
= ~12 min of staleness, while keeping tag-based revalidation from update/create flows intact.

## Files

### Modify: `apps/storefront/src/lib/data/companies.ts`
Add `revalidate: 120` to the `next` options in `retrieveCompany` only. Do not change the shared
`getCacheOptions` helper (it is used generically) and do not touch the other functions.

```typescript
export const retrieveCompany = async (companyId: string) => {
  const headers = {
    ...(await getAuthHeaders()),
  }

  const next = {
    ...(await getCacheOptions("companies")),
    revalidate: 120,
  }

  const { company } = await sdk.client.fetch<StoreCompanyResponse>(
    `/store/companies/${companyId}`,
    {
      query: {
        fields:
          "+spending_limit_reset_frequency,*employees.customer,*approval_settings",
      },
      method: "GET",
      headers,
      next,
    }
  )

  return company
}
```

Notes:
- Tag-based revalidation from `createCompany` / `updateCompany` / employee mutations still applies —
  `revalidate` is an additional TTL, not a replacement for the tag.
- `revalidate: 120` is a literal seconds value; keep it inline (single use, no shared constant).

## Test cases

### TC-1: cache TTL present
- **Given** `retrieveCompany` is called
- **Then** the underlying `sdk.client.fetch` receives `next.revalidate === 120` alongside the
  companies cache tag

(No existing storefront test asserts `retrieveCompany` cache options; adding one is optional and
low value. If added, mirror the mocking style in `src/__tests__/lib/data/customer.test.ts`.)

## Validation
- `pnpm --filter <storefront-package> build` (type-check).
- Confirm no other function in `companies.ts` was modified.
