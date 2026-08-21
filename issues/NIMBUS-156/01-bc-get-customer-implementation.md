# Task 01 — Business Central `getCustomer` + typed contract

**App:** backend
**Depends on:** None
**Base branch:** `develop`

## Goal
Add a typed `BCCustomer` contract and a public `getCustomer(customerNumber)` method to the
Business Central module. The method queries the BC `customers()` endpoint by escaped `number`,
limits to one result, expands the `currency` navigation property, and validates the response at
the external-service boundary — normalizing empty/null/`_x0020_` to `"not_blocked"`, rejecting unknown blocked enum
values, and reading `currency.code` from the expanded navigation (null when absent, no fallback).

## Files

### Modify: `apps/backend/src/modules/business-central/types.ts`
Add the blocked-state and customer types and extend the service interface.

```typescript
export type BCCustomerBlockedState = "not_blocked" | "Ship" | "Invoice" | "All";

export type BCCustomer = {
  number: string;
  displayName: string;
  email: string;
  phoneNumber: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  blocked: BCCustomerBlockedState;
  creditLimit: number | null;
  taxRegistrationNumber: string;
  currencyCode: string | null;
};

export interface IBusinessCentralModuleService {
  getOperations(): Promise<unknown>;
  listOrders(params: BCListOrdersParams): Promise<BCListOrdersResult>;
  getOrder(params: BCGetOrderParams): Promise<BCOrderDetail | null>;
  // IMPLEMENT: add getCustomer to the existing interface (keep all existing members)
  getCustomer(customerNumber: string): Promise<BCCustomer | null>;
  createReturnFromSalesOrder(
    params: BCCreateReturnParams
  ): Promise<BCReturnOrder>;
  listReturnReasons(): Promise<BCReturnReason[]>;
}
```

### Modify: `apps/backend/src/modules/business-central/service.ts`
Import the new types and implement `getCustomer`. Reuse `getDiscoveryUrl`, `getTenantId`,
`getClientCredentials`, `requestToken`, and `escapeODataString`. Do **not** refactor the existing
HTTP client beyond what customer retrieval needs.

```typescript
// Add near the top-level helpers:
const BC_BLOCKED_UNBLOCKED_WIRE_VALUE = "_x0020_";
const BC_BLOCKED_STATES: readonly BCCustomerBlockedState[] = [
  "not_blocked",
  "Ship",
  "Invoice",
  "All",
];

function normalizeBlockedState(value: unknown): BCCustomerBlockedState {
  // IMPLEMENT:
  // - if value === BC_BLOCKED_UNBLOCKED_WIRE_VALUE OR value == null/"" -> return "not_blocked"
  // - if value is one of BC_BLOCKED_STATES -> return it
  // - otherwise throw MedusaError(UNEXPECTED_STATE, "unsupported Business Central blocked value")
  //   (do NOT coerce unknown values to "not_blocked")
}

function parseCreditLimit(value: unknown): number | null {
  // IMPLEMENT:
  // - null/undefined -> null
  // - number -> return as-is (preserve decimal; never multiply/round to minor units)
  // - otherwise throw MedusaError(UNEXPECTED_STATE, "malformed Business Central creditLimit")
}
```

```typescript
// Add as a public method on BusinessCentralModuleService:
async getCustomer(customerNumber: string): Promise<BCCustomer | null> {
  const discoveryUrl = this.getDiscoveryUrl();
  const tenantId = this.getTenantId(discoveryUrl);
  const { clientId, clientSecret } = this.getClientCredentials();
  const accessToken = await this.requestToken(tenantId, clientId, clientSecret);

  const customersUrl = new URL(`${discoveryUrl.toString()}/customers()`);
  customersUrl.searchParams.set(
    "$filter",
    `number eq '${escapeODataString(customerNumber)}'`
  );
  customersUrl.searchParams.set("$top", "1");
  customersUrl.searchParams.set("$expand", "currency");

  const customersResponse = await fetch(customersUrl.toString(), {
    method: "GET",
    headers: {
      authorization: `Bearer ${accessToken}`,
      accept: "application/json",
    },
  });

  if (!customersResponse.ok) {
    throw new MedusaError(
      MedusaError.Types.UNEXPECTED_STATE,
      `Business Central customer request failed with status ${customersResponse.status}`
    );
  }

  type BCCustomerRaw = {
    number?: unknown;
    displayName?: unknown;
    email?: unknown;
    phoneNumber?: unknown;
    addressLine1?: unknown;
    addressLine2?: unknown;
    city?: unknown;
    state?: unknown;
    postalCode?: unknown;
    country?: unknown;
    blocked?: unknown;
    creditLimit?: unknown;
    taxRegistrationNumber?: unknown;
    currency?: { code?: unknown } | null;
  };

  const body = (await customersResponse.json()) as { value?: BCCustomerRaw[] };
  const raw = body.value?.[0];

  if (!raw) {
    return null;
  }

  // IMPLEMENT: build and return the BCCustomer:
  // - string fields via a small "optionalString(value) -> string" coercion (default "")
  //   Reuse/extend requireBusinessCentralString-style helpers; empty string is allowed here.
  // - blocked: normalizeBlockedState(raw.blocked)
  // - creditLimit: parseCreditLimit(raw.creditLimit)
  // - currencyCode: typeof raw.currency?.code === "string" ? raw.currency.code : null
  //   (do NOT fall back to any other BC currency field)
}
```

### Modify: `apps/backend/src/modules/business-central/__tests__/service.spec.ts`
Add a `describe("BusinessCentralModuleService.getCustomer", ...)` block mirroring the existing
fetch-mock style (token response first, then the customers response).

## Test cases

### TC-1: builds the customer request correctly
- **Given** env is configured and BC returns one customer with an expanded currency
- **When** `getCustomer("00011551")` runs
- **Then** the customers request URL contains `customers()`, the escaped
  `number+eq+%2700011551%27` filter, `%24top=1`, and `%24expand=currency`

### TC-2: full mapping
- **Given** BC returns `displayName`, `email`, `phoneNumber`, `addressLine1/2`, `city`, `state`,
  `postalCode`, `country`, `blocked`, `creditLimit`, `taxRegistrationNumber`, and
  `currency: { code: "SEK" }`
- **Then** the returned `BCCustomer` maps every field and `currencyCode === "SEK"`

### TC-3: no match returns null
- **Given** BC returns `{ value: [] }`
- **Then** `getCustomer` resolves to `null`

### TC-4: non-OK response throws
- **Given** the customers response status is 500
- **Then** `getCustomer` rejects with a `MedusaError`

### TC-5: `_x0020_` normalization
- **Given** BC `blocked` is `"_x0020_"`
- **Then** the returned `blocked` is `"not_blocked"`

### TC-6: unknown blocked value throws
- **Given** BC `blocked` is `"Frozen"`
- **Then** `getCustomer` rejects (not coerced to `"not_blocked"`)

### TC-7: missing expanded currency
- **Given** the response has no `currency` object
- **Then** `currencyCode` is `null`

### TC-8: decimal credit limit preserved
- **Given** BC `creditLimit` is `12345.67`
- **Then** `creditLimit === 12345.67` (no minor-unit/integer conversion)

## Validation
- `pnpm --filter @b2b-starter/backend test:integration:modules`
- Do not log tokens, headers, secrets, or full BC responses.
