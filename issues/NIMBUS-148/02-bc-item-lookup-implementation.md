# Task 02: Business Central Item Lookup (`business-central` module) — Implementation Plan

**Status:** TODO
**App:** backend
**App Root:** apps/backend
**Task ID:** 02
**Date:** 2026-09-02
**Branch:** feature/NIMBUS-148-bc-order-submission (from develop)
**Depends on:** None

---

## Project Environment

- **App root:** `apps/backend`
- **Build command:** `pnpm build` (from repo root) or `cd apps/backend && pnpm build`
- **Lint command:** `pnpm lint` (from repo root)
- **Test command:** `cd apps/backend && pnpm test:integration:modules`
- **Test framework:** Jest (`@swc/jest`, node environment). **No database is used** by this task's
  tests — they instantiate `BusinessCentralModuleService` directly and mock `global.fetch`, exactly
  like the existing `apps/backend/src/modules/business-central/__tests__/service.spec.ts`.
- **Test location:** `apps/backend/src/modules/business-central/__tests__/*.spec.ts`
  (matched by `**/src/modules/*/__tests__/**/*.[jt]s` when `TEST_TYPE=integration:modules`).
  Do NOT name it `*.unit.spec.ts` — the existing BC module specs don't, and the unit runner is
  reserved for pure-function specs.
- **Naming conventions:** kebab-case files, named exports, `type` aliases for unions,
  **double quotes**, 2-space indent — match `service.ts` and `types.ts` exactly.

## Verified Business Central facts this task is built on

Checked directly against `issues/NIMBUS-129/bc metadata/std odata metadata.xml` (the real BC OData
v2.0 `$metadata` for this tenant), not assumed:

- **The BC `Item` field holding the EAN/GTIN is `gtin`** — `<Property Name="gtin"
  Type="Edm.String" MaxLength="14" />` on `<EntityType Name="item">`. This resolves SCOPE.md's open
  question "which BC Item entity field holds the GTIN/EAN value". The canonical `eanNo` values in
  the real EDI samples are 13-digit GTIN-13 strings (e.g. `5712094145752`), which fit.
- **The item entity set is `items`, exposed at the root of the configured discovery URL** — the
  `<EntityContainer>` declares `<EntitySet Name="items" EntityType="Microsoft.NAV.item" />`
  alongside `customers` and `salesOrders`. This is the same root-level addressing the existing
  `getCustomer` / `listOrders` / `getOrder` methods already use (`${base}/customers()`,
  `${base}/SalesOrders()`), so no company-scoping path segment is introduced.
- **Other `item` fields available and worth selecting:** `id` (`Edm.Guid`, the key — this is what a
  sales order line's `itemId` needs), `number` (`MaxLength="20"`), `displayName`,
  `baseUnitOfMeasureCode` (`MaxLength="10"`), `blocked` (`Edm.Boolean`).
- **There is no customer-item-cross-reference entity in this API surface.** BC's "Item
  Reference"/"Item Cross Reference" table is not exposed by the standard OData v2.0 API, and the
  custom `metadata masterdata.xml` API surface only exposes customers, prices, contacts and
  `itemAvailByVariants` — no item-reference entity. **Consequence:** the `custItemNo` fallback
  required by SCOPE.md can only be matched against `item.number` (same field as `itemNumber`), not
  against a genuine customer-item-number table. This is a real limitation, not an oversight — see
  PLAN.md's flagged items. In practice the real EDI samples set `custItemNo` equal to `itemNumber`
  on every line, so the fallback is currently a no-op in the happy path; it exists because
  SCOPE.md requires the third attempt.

## Solution Design

Add **one** method to the `business-central` module: a batch lookup that resolves many canonical
order lines to BC items in a single call.

### Why batch, not per-line

`BusinessCentralModuleService` has **no token caching** — every public method today runs the full
`getDiscoveryUrl` → `getTenantId` → `getClientCredentials` → `requestToken` dance before its first
data request. A per-line lookup method would therefore perform one Azure AD token request *per
order line*: a 20-line order would mint 20 tokens. A batch method acquires the token once and then
issues only the item requests. This keeps the existing convention intact (no new HTTP client, no
new caching layer — the SCOPE.md non-functional requirement) while avoiding the obvious pathology.

### Resolution algorithm (per line)

Try candidates in the SCOPE.md-mandated order, stopping at the first unambiguous single match:

| Order | Canonical field | BC filter |
|---|---|---|
| 1 | `eanNo` | `gtin eq '<escaped>'` |
| 2 | `itemNumber` | `number eq '<escaped>'` |
| 3 | `custItemNo` | `number eq '<escaped>'` |

- Each request sets `$top=2` and `$select=id,number,displayName,gtin,baseUnitOfMeasureCode`.
  `$top=2` is the cheapest way to distinguish "exactly one match" from "more than one" without
  fetching the whole result set.
- Exactly one row → **matched**, recording which canonical field matched (`matchedBy`).
- Two rows → **ambiguous** for that candidate; continue to the next candidate.
- Zero rows → continue to the next candidate.
- Blank/absent identifiers are skipped. A candidate whose value duplicates an
  already-tried value is skipped too (avoids a second identical request when
  `custItemNo === itemNumber`, which is the norm in the real samples).
- All candidates exhausted → **unmatched**, with `reason`:
  - `"no_identifiers"` if the line carried no usable identifier at all,
  - `"ambiguous"` if any attempted candidate returned more than one row (more informative than
    `not_found`, and it tells operations the data problem is in BC, not in the order),
  - `"not_found"` otherwise.
- A **transport/HTTP failure** (non-2xx, unparseable body, network error) throws `MedusaError`,
  exactly like every other method in this service. It is not turned into an unmatched line: a BC
  outage is a submission failure, not a data problem with the order. Task 04's step catches it and
  records the order as `failed`.

`blocked` items are **not** rejected. SCOPE.md says nothing about blocked items, and inventing that
rule would be speculative. Noted in PLAN.md as a question for the business, not implemented.

## Code Skeletons

### Modified File: `apps/backend/src/modules/business-central/types.ts`

**Append** the following to the end of the file, then add the new method to the existing
`IBusinessCentralModuleService` interface (shown separately below). Do not reorder or reformat
anything already in the file.

```typescript
export type BCItem = {
  id: string;
  number: string;
  displayName: string;
  gtin: string;
  baseUnitOfMeasureCode: string;
};

export type BCItemMatchSource = "eanNo" | "itemNumber" | "custItemNo";

export type BCItemLookupFailureReason =
  | "no_identifiers"
  | "not_found"
  | "ambiguous";

export type BCItemLookupInput = {
  lineNumber: number;
  eanNo?: string;
  itemNumber?: string;
  custItemNo?: string;
};

export type BCItemLookupResult =
  | {
      lineNumber: number;
      matched: true;
      item: BCItem;
      matchedBy: BCItemMatchSource;
    }
  | {
      lineNumber: number;
      matched: false;
      reason: BCItemLookupFailureReason;
    };
```

The existing interface gains one member (add it after `getCustomer`, keeping the rest untouched):

```typescript
export interface IBusinessCentralModuleService {
  getOperations(): Promise<unknown>;
  listOrders(params: BCListOrdersParams): Promise<BCListOrdersResult>;
  getOrder(params: BCGetOrderParams): Promise<BCOrderDetail | null>;
  getCustomer(customerNumber: string): Promise<BCCustomer | null>;
  findItemsForOrderLines(
    lines: BCItemLookupInput[]
  ): Promise<BCItemLookupResult[]>;
  createReturnFromSalesOrder(
    params: BCCreateReturnParams
  ): Promise<BCReturnOrder>;
  listReturnReasons(): Promise<BCReturnReason[]>;
}
```

### Modified File: `apps/backend/src/modules/business-central/service.ts`

Add `BCItem`, `BCItemLookupInput`, `BCItemLookupResult`, and `BCItemMatchSource` to the existing
`import type { ... } from "./types";` block (keep it alphabetised the way the existing block is
loosely ordered — the exact order does not matter, but do not create a second import statement).

Add these two module-level helpers next to the existing `escapeODataString` / `formatAddress`
helpers, above the `class BusinessCentralModuleService` declaration:

```typescript
const BC_ITEM_SELECT = "id,number,displayName,gtin,baseUnitOfMeasureCode";

type BCItemLookupCandidate = {
  source: BCItemMatchSource;
  field: "gtin" | "number";
  value: string;
};

function buildItemLookupCandidates(
  line: BCItemLookupInput
): BCItemLookupCandidate[] {
  const ordered: BCItemLookupCandidate[] = [
    { source: "eanNo", field: "gtin", value: (line.eanNo ?? "").trim() },
    {
      source: "itemNumber",
      field: "number",
      value: (line.itemNumber ?? "").trim(),
    },
    {
      source: "custItemNo",
      field: "number",
      value: (line.custItemNo ?? "").trim(),
    },
  ];
  const seen = new Set<string>();

  return ordered.filter((candidate) => {
    if (!candidate.value) {
      return false;
    }

    const key = `${candidate.field}:${candidate.value}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);

    return true;
  });
}
```

Add these two methods to the class. Put them immediately after `getCustomer` so the read-oriented
methods stay together:

```typescript
  private async findItemsByFilter(
    discoveryUrl: URL,
    accessToken: string,
    field: "gtin" | "number",
    value: string
  ): Promise<BCItem[]> {
    const itemsUrl = new URL(`${discoveryUrl.toString()}/items()`);
    itemsUrl.searchParams.set(
      "$filter",
      `${field} eq '${escapeODataString(value)}'`
    );
    itemsUrl.searchParams.set("$select", BC_ITEM_SELECT);
    itemsUrl.searchParams.set("$top", "2");

    let itemsResponse: Response;

    try {
      itemsResponse = await fetch(itemsUrl.toString(), {
        method: "GET",
        headers: {
          authorization: `Bearer ${accessToken}`,
          accept: "application/json",
        },
      });
    } catch {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        "Business Central item request failed"
      );
    }

    if (!itemsResponse.ok) {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        `Business Central item request failed with status ${itemsResponse.status}`
      );
    }

    type BCItemRaw = {
      id?: unknown;
      number?: unknown;
      displayName?: unknown;
      gtin?: unknown;
      baseUnitOfMeasureCode?: unknown;
    };

    let body: { value?: BCItemRaw[] };

    try {
      body = (await itemsResponse.json()) as { value?: BCItemRaw[] };
    } catch {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        "Malformed Business Central item response"
      );
    }

    return (body.value ?? []).map((raw) => ({
      id: requireBusinessCentralString(raw.id, "item.id"),
      number: optionalString(raw.number),
      displayName: optionalString(raw.displayName),
      gtin: optionalString(raw.gtin),
      baseUnitOfMeasureCode: optionalString(raw.baseUnitOfMeasureCode),
    }));
  }

  async findItemsForOrderLines(
    lines: BCItemLookupInput[]
  ): Promise<BCItemLookupResult[]> {
    if (lines.length === 0) {
      return [];
    }

    const discoveryUrl = this.getDiscoveryUrl();
    const tenantId = this.getTenantId(discoveryUrl);
    const { clientId, clientSecret } = this.getClientCredentials();
    const accessToken = await this.requestToken(tenantId, clientId, clientSecret);
    const results: BCItemLookupResult[] = [];

    for (const line of lines) {
      const candidates = buildItemLookupCandidates(line);

      if (candidates.length === 0) {
        results.push({
          lineNumber: line.lineNumber,
          matched: false,
          reason: "no_identifiers",
        });
        continue;
      }

      let sawAmbiguousMatch = false;
      let resolved: BCItemLookupResult | null = null;

      for (const candidate of candidates) {
        const items = await this.findItemsByFilter(
          discoveryUrl,
          accessToken,
          candidate.field,
          candidate.value
        );

        if (items.length === 1) {
          resolved = {
            lineNumber: line.lineNumber,
            matched: true,
            item: items[0],
            matchedBy: candidate.source,
          };
          break;
        }

        if (items.length > 1) {
          sawAmbiguousMatch = true;
        }
      }

      results.push(
        resolved ?? {
          lineNumber: line.lineNumber,
          matched: false,
          reason: sawAmbiguousMatch ? "ambiguous" : "not_found",
        }
      );
    }

    return results;
  }
```

Notes for the implementer:

- `requireBusinessCentralString` and `optionalString` already exist as module-level functions in
  `service.ts` — reuse them, do not redefine them.
- `escapeODataString` already exists — reuse it. It is the OData single-quote escape
  (`'` → `''`) and is the only injection guard this code path needs, matching the existing
  `getCustomer`/`listOrders` filters.
- The sequential `for`/`await` loops are deliberate. Do **not** convert them to `Promise.all`: the
  per-line candidate chain must short-circuit on the first single match (that is the whole point
  of the EAN-first-then-fallback rule), and firing every candidate for every line in parallel would
  both defeat that and multiply BC request volume.

## Impacted Files

| File | Change | Signature |
|---|---|---|
| `apps/backend/src/modules/business-central/types.ts` | Append 5 new exported types; add 1 member to the existing `IBusinessCentralModuleService` interface | `findItemsForOrderLines(lines: BCItemLookupInput[]): Promise<BCItemLookupResult[]>` |
| `apps/backend/src/modules/business-central/service.ts` | Extend the existing `import type` block; add 2 module-level helpers (`BC_ITEM_SELECT`, `buildItemLookupCandidates`) + 1 type (`BCItemLookupCandidate`); add 2 class methods | `private async findItemsByFilter(discoveryUrl: URL, accessToken: string, field: "gtin" \| "number", value: string): Promise<BCItem[]>` and `async findItemsForOrderLines(lines: BCItemLookupInput[]): Promise<BCItemLookupResult[]>` |

Nothing else is modified. In particular: do **not** touch `createReturnFromSalesOrder` or
`listReturnReasons` (they remain the NIMBUS-138 stubs they are today — out of scope), and do not
touch `apps/backend/src/workflows/business-central-return/**`.

## Test Cases

### TC-1: resolves a line by `eanNo` on the first attempt (happy path)
- **Given:** BC returns exactly one item for `gtin eq '5712094145752'`
- **When:** `findItemsForOrderLines` is called with a line carrying that `eanNo` plus an
  `itemNumber` and a `custItemNo`
- **Then:** the result is matched with `matchedBy: "eanNo"`, the item's `id`/`number` are mapped,
  and **only one** item request was made (the fallbacks were never attempted)

### TC-2: falls back to `itemNumber` when the EAN finds nothing
- **Given:** BC returns zero items for the `gtin` filter and exactly one for
  `number eq 'FLS-NIM-VESPERMNA-XL'`
- **When:** `findItemsForOrderLines` is called
- **Then:** the result is matched with `matchedBy: "itemNumber"`, and the first request used a
  `gtin` filter while the second used a `number` filter

### TC-3: falls back past an *ambiguous* EAN, not just a missing one
- **Given:** BC returns two items for the `gtin` filter and exactly one for the `number` filter
- **When:** `findItemsForOrderLines` is called
- **Then:** the result is matched with `matchedBy: "itemNumber"` — an ambiguous EAN does not abort
  the line (this is the specific SCOPE.md rule "if the EAN lookup fails **or is ambiguous**")

### TC-4: falls back to `custItemNo` when it differs from `itemNumber`
- **Given:** zero items for `gtin`, zero for `number eq '<itemNumber>'`, one for
  `number eq '<custItemNo>'`, and `custItemNo !== itemNumber`
- **When:** `findItemsForOrderLines` is called
- **Then:** the result is matched with `matchedBy: "custItemNo"` after exactly three item requests

### TC-5: does not repeat an identical filter when `custItemNo === itemNumber` (edge case)
- **Given:** zero items for `gtin` and zero for `number`, with `custItemNo === itemNumber`
- **When:** `findItemsForOrderLines` is called
- **Then:** the result is unmatched with `reason: "not_found"` after exactly **two** item requests,
  not three

### TC-6: reports `ambiguous` when every candidate was ambiguous (edge case)
- **Given:** BC returns two items for every filter
- **When:** `findItemsForOrderLines` is called
- **Then:** the result is unmatched with `reason: "ambiguous"`

### TC-7: reports `no_identifiers` and makes no item request for an identifier-less line (edge case)
- **Given:** a line whose `eanNo`, `itemNumber`, and `custItemNo` are all absent or blank/whitespace
- **When:** `findItemsForOrderLines` is called with only that line
- **Then:** the result is unmatched with `reason: "no_identifiers"` and **no** item request was made
  (only the token request)

### TC-8: resolves a mixed batch in one call, one token, preserving line order (integration/wiring)
- **Given:** a two-line batch where line 1 resolves by `eanNo` and line 2 resolves by nothing
- **When:** `findItemsForOrderLines` is called once
- **Then:** two results come back in input order, the first matched and the second unmatched, and
  the Azure AD token endpoint was called exactly **once** for the whole batch

### TC-9: a failing BC item request throws rather than reporting an unmatched line (edge case)
- **Given:** BC responds `500` to the item request
- **When:** `findItemsForOrderLines` is called
- **Then:** it rejects with `Business Central item request failed with status 500`

### TC-10: an empty batch short-circuits with no HTTP calls at all (edge case)
- **Given:** an empty `lines` array
- **When:** `findItemsForOrderLines([])` is called
- **Then:** it resolves to `[]` and `global.fetch` was never called (not even for a token)

### New File: `apps/backend/src/modules/business-central/__tests__/item-lookup.spec.ts`

```typescript
import BusinessCentralModuleService from "../service";

const originalFetch = global.fetch;

const TOKEN_URL = "https://login.microsoftonline.com";

function tokenResponse(): Response {
  return new Response(JSON.stringify({ access_token: "access-token" }), {
    status: 200,
  });
}

function itemsResponse(
  value: Record<string, unknown>[],
  status = 200
): Response {
  return new Response(JSON.stringify({ value }), { status });
}

/**
 * Mocks the token request followed by one response per expected item request, in order.
 */
function mockBusinessCentral(itemResponses: Response[]): jest.Mock {
  const fetchMock = jest.fn();

  fetchMock.mockResolvedValueOnce(tokenResponse());

  for (const response of itemResponses) {
    fetchMock.mockResolvedValueOnce(response);
  }

  global.fetch = fetchMock;

  return fetchMock;
}

function itemRequestUrls(fetchMock: jest.Mock): string[] {
  return fetchMock.mock.calls
    .map((call) => String(call[0]))
    .filter((url) => !url.startsWith(TOKEN_URL));
}

const NIMBUS_ITEM = {
  id: "11111111-1111-1111-1111-111111111111",
  number: "FLS-NIM-VESPERMNA-XL",
  displayName: "Vesper Vest Unisex, Navy - XL",
  gtin: "5712094145752",
  baseUnitOfMeasureCode: "PCS",
};

describe("BusinessCentralModuleService.findItemsForOrderLines", () => {
  beforeEach(() => {
    process.env.BUSINESS_CENTRAL_DISCOVERY_URL =
      "https://api.businesscentral.dynamics.com/v2.0/tenant-id/Sandbox/api/v2.0";
    process.env.BUSINESS_CENTRAL_CLIENT_ID =
      "00000000-0000-0000-0000-000000000001";
    process.env.BUSINESS_CENTRAL_CLIENT_SECRET = "client-secret";
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("TC-1: resolves a line by eanNo without attempting the fallbacks", async () => {
    const fetchMock = mockBusinessCentral([itemsResponse([NIMBUS_ITEM])]);
    const service = new BusinessCentralModuleService();

    const results = await service.findItemsForOrderLines([
      {
        lineNumber: 1,
        eanNo: "5712094145752",
        itemNumber: "FLS-NIM-VESPERMNA-XL",
        custItemNo: "CUST-XL",
      },
    ]);

    expect(results).toEqual([
      {
        lineNumber: 1,
        matched: true,
        matchedBy: "eanNo",
        item: NIMBUS_ITEM,
      },
    ]);

    const urls = itemRequestUrls(fetchMock);
    expect(urls).toHaveLength(1);
    expect(urls[0]).toContain("items()");
    expect(urls[0]).toContain("gtin+eq+%275712094145752%27");
    expect(urls[0]).toContain("%24top=2");
  });

  it("TC-2: falls back to itemNumber when the EAN matches nothing", async () => {
    const fetchMock = mockBusinessCentral([
      itemsResponse([]),
      itemsResponse([NIMBUS_ITEM]),
    ]);
    const service = new BusinessCentralModuleService();

    const results = await service.findItemsForOrderLines([
      {
        lineNumber: 1,
        eanNo: "0000000000000",
        itemNumber: "FLS-NIM-VESPERMNA-XL",
      },
    ]);

    expect(results[0]).toMatchObject({ matched: true, matchedBy: "itemNumber" });

    const urls = itemRequestUrls(fetchMock);
    expect(urls).toHaveLength(2);
    expect(urls[0]).toContain("gtin+eq+");
    expect(urls[1]).toContain("number+eq+%27FLS-NIM-VESPERMNA-XL%27");
  });

  it("TC-3: falls back past an ambiguous EAN match", async () => {
    // IMPLEMENT: mock the gtin request with TWO items and the number request with one
    // (NIMBUS_ITEM), then assert matched with matchedBy "itemNumber".
  });

  it("TC-4: falls back to custItemNo when it differs from itemNumber", async () => {
    const fetchMock = mockBusinessCentral([
      itemsResponse([]),
      itemsResponse([]),
      itemsResponse([NIMBUS_ITEM]),
    ]);
    const service = new BusinessCentralModuleService();

    const results = await service.findItemsForOrderLines([
      {
        lineNumber: 1,
        eanNo: "0000000000000",
        itemNumber: "UNKNOWN-ITEM",
        custItemNo: "CUST-XL",
      },
    ]);

    expect(results[0]).toMatchObject({ matched: true, matchedBy: "custItemNo" });
    expect(itemRequestUrls(fetchMock)).toHaveLength(3);
  });

  it("TC-5: does not repeat the identical filter when custItemNo equals itemNumber", async () => {
    const fetchMock = mockBusinessCentral([itemsResponse([]), itemsResponse([])]);
    const service = new BusinessCentralModuleService();

    const results = await service.findItemsForOrderLines([
      {
        lineNumber: 1,
        eanNo: "0000000000000",
        itemNumber: "FLS-NIM-VESPERMNA-XL",
        custItemNo: "FLS-NIM-VESPERMNA-XL",
      },
    ]);

    expect(results[0]).toEqual({
      lineNumber: 1,
      matched: false,
      reason: "not_found",
    });
    expect(itemRequestUrls(fetchMock)).toHaveLength(2);
  });

  it("TC-6: reports ambiguous when every candidate matched more than one item", async () => {
    // IMPLEMENT: mock both requests with two items each; assert
    // { lineNumber: 1, matched: false, reason: "ambiguous" }.
  });

  it("TC-7: reports no_identifiers without issuing an item request", async () => {
    const fetchMock = mockBusinessCentral([]);
    const service = new BusinessCentralModuleService();

    const results = await service.findItemsForOrderLines([
      { lineNumber: 7, eanNo: "", itemNumber: "   " },
    ]);

    expect(results).toEqual([
      { lineNumber: 7, matched: false, reason: "no_identifiers" },
    ]);
    expect(itemRequestUrls(fetchMock)).toHaveLength(0);
  });

  it("TC-8: resolves a mixed batch with a single token request, preserving line order", async () => {
    const fetchMock = mockBusinessCentral([
      itemsResponse([NIMBUS_ITEM]),
      itemsResponse([]),
      itemsResponse([]),
    ]);
    const service = new BusinessCentralModuleService();

    const results = await service.findItemsForOrderLines([
      { lineNumber: 1, eanNo: "5712094145752" },
      { lineNumber: 2, eanNo: "9999999999999", itemNumber: "GONE" },
    ]);

    expect(results.map((result) => result.lineNumber)).toEqual([1, 2]);
    expect(results[0].matched).toBe(true);
    expect(results[1]).toEqual({
      lineNumber: 2,
      matched: false,
      reason: "not_found",
    });

    const tokenCalls = fetchMock.mock.calls.filter((call) =>
      String(call[0]).startsWith(TOKEN_URL)
    );
    expect(tokenCalls).toHaveLength(1);
  });

  it("TC-9: throws when the Business Central item request fails", async () => {
    mockBusinessCentral([itemsResponse([], 500)]);
    const service = new BusinessCentralModuleService();

    await expect(
      service.findItemsForOrderLines([
        { lineNumber: 1, eanNo: "5712094145752" },
      ])
    ).rejects.toThrow("Business Central item request failed with status 500");
  });

  it("TC-10: short-circuits an empty batch without any HTTP call", async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock;
    const service = new BusinessCentralModuleService();

    await expect(service.findItemsForOrderLines([])).resolves.toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
```

Run with: `cd apps/backend && pnpm test:integration:modules`.

**Note on the URL assertions**: `URLSearchParams` percent-encodes and turns spaces into `+`, which
is why the expected filter strings look like `gtin+eq+%275712094145752%27`. This matches the
assertion style already used in the existing `service.spec.ts`
(`expect(customerRequest).toContain("number+eq+%2700011551%27")`) — copy that style rather than
inventing a new one.

## Implementation Steps

1. Append the five new types to `apps/backend/src/modules/business-central/types.ts` and add the
   `findItemsForOrderLines` member to `IBusinessCentralModuleService`.
2. Extend the `import type` block at the top of
   `apps/backend/src/modules/business-central/service.ts` with `BCItem`, `BCItemLookupInput`,
   `BCItemLookupResult`, and `BCItemMatchSource`.
3. Add `BC_ITEM_SELECT`, the `BCItemLookupCandidate` type, and `buildItemLookupCandidates` at
   module level in `service.ts`, next to the existing helpers.
4. Add `findItemsByFilter` and `findItemsForOrderLines` to the class, immediately after
   `getCustomer`.
5. Create `apps/backend/src/modules/business-central/__tests__/item-lookup.spec.ts` exactly as
   shown, filling in the two `// IMPLEMENT:` blocks (TC-3 and TC-6).
6. Run `cd apps/backend && pnpm test:integration:modules` and confirm all ten new test cases pass
   **and** the two pre-existing BC module specs (`service.spec.ts`, `return-stub.spec.ts`) still
   pass.
7. Run `pnpm build` from the repo root and fix any type errors before marking this task done.
