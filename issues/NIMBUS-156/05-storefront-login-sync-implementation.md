# Task 05 — Storefront login sync helper

**App:** storefront
**Depends on:** 04 (sync endpoint contract)
**Base branch:** `develop`

## Goal
Add an SDK helper that calls the protected sync endpoint using the stored auth headers, and invoke
it exactly once immediately after each successful login. Await token persistence before the
protected call. Keep synchronization failures non-fatal — the existing
customer/cart/cache/transfer flow must continue regardless — and revalidate the customers cache
tag after a successful request so the authenticated view does not retain stale company data.

## Files

### Modify: `apps/storefront/src/lib/data/customer.ts`
Add a helper and call it inside the existing `login` server action immediately after the token is
stored. The helper handles endpoint/transport failures with a fixed, non-sensitive warning.

```typescript
// New helper (place near retrieveCustomer / updatePassword):
export const syncCompanyFromBusinessCentral = async (): Promise<void> => {
  const authHeaders = await getAuthHeaders();

  if (!authHeaders || !("authorization" in authHeaders)) {
    return;
  }

  try {
    await sdk.client.fetch(`/store/customers/me/company/sync-business-central`, {
      method: "POST",
      headers: authHeaders,
    });

    const customerCacheTag = await getCacheTag("customers");
    revalidateTag(customerCacheTag);
  } catch {
    // Non-fatal and non-sensitive: authentication has already succeeded.
    console.warn("Business Central company sync request failed after login");
  }
};
```

Invoke once inside `login(...)` immediately after awaiting `setAuthToken`. This ordering ensures
every successful explicit login attempts synchronization even if later customer/cart work fails:

```typescript
        await setAuthToken(token as string)
        await syncCompanyFromBusinessCentral()

        const customer = await retrieveCustomer()
        const cart = await retrieveCart()

        if (customer?.employee?.company_id) {
          await updateCart({
            metadata: {
              ...cart?.metadata,
              company_id: customer.employee.company_id,
            },
          })
        }
```

Notes:
- Reuse the already-imported `getAuthHeaders`, `getCacheTag`, and `revalidateTag`.
- Change the existing unawaited `setAuthToken(token as string)` call in `login` to
  `await setAuthToken(token as string)`; otherwise the helper can race token persistence and skip
  the protected request.
- Do not add the helper to `signup` (login trigger only, per scope).
- The narrow `try/catch` around only the secondary SDK request and its cache revalidation
  guarantees a failure does not change the login return value; emit only the fixed warning.
- Exactly one attempt per successful login.

## Test cases (`apps/storefront` jest, mirror `src/__tests__/lib/data/cms.test.ts`)

### TC-1: one sync attempt after successful login
- **Given** `getAuthHeaders` returns an authorization header
- **When** `syncCompanyFromBusinessCentral()` runs and the mocked `sdk.client.fetch` resolves
- **Then** `fetch` is called exactly once with `POST` to
  `/store/customers/me/company/sync-business-central` and the customers cache tag is revalidated

### TC-2: failure is non-fatal
- **Given** the mocked `sdk.client.fetch` rejects
- **Then** `syncCompanyFromBusinessCentral()` resolves without throwing and does not revalidate

### TC-3: skipped when unauthenticated
- **Given** `getAuthHeaders` returns `{}` (no authorization)
- **Then** `fetch` is not called

### TC-4: login awaits token persistence before synchronization
- **Given** authentication succeeds
- **Then** `setAuthToken` completes before the single sync helper call, and customer/cart work
  follows regardless of the sync result

## Validation
- `pnpm --filter <storefront-package> test` (storefront jest)
- Storefront type-check / build for the modified login data layer.
- Manually confirm the login flow still transfers the cart and revalidates products/carts tags.
