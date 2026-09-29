# Task 01: Add `listReturns` to the Business Central module service — Implementation Plan

**Status:** Done
**App:** backend
**App Root:** apps/backend
**Task ID:** 01
**Date:** 2026-09-15 (reconciled 2026-09-29 against develop after NIMBUS-138/170)
**Branch:** feature/NIMBUS-140 (from develop)
**Depends on:** None

> **Reconciliation note (2026-09-29):** `service.ts` changed substantially since the first
> plan (NIMBUS-170 merged order history, NIMBUS-138 real return action + reservations). The
> import-block and `listReturnReasons` anchors below were re-verified against develop. Do
> **not** touch any `TEMP (NIMBUS-138)` code or the existing `listOrders`/`getOrder`/
> `createReturnFromSalesOrder`/`listReturnReasons` methods.
> **User decisions (2026-09-29):** Q1: there is **no related-order-number field**. BC's
> External Document No. holds the portal's `requestId` (`RET-<hash>` from
> `prepare-bc-return.ts`), not an order number, so it is neither mapped nor displayed. Q2:
> only open (unposted) `salesReturnOrders` are listed, and posted-return history is out of
> scope.

---

## Project Environment

- **App root:** `apps/backend`
- **Build command:** `pnpm build` (from repo root) or `cd apps/backend && pnpm build`
- **Lint command:** `pnpm lint` (from repo root)
- **Test command:** `cd apps/backend && pnpm test:integration:modules` (module-level service tests; matches `**/src/modules/*/__tests__/**/*.[jt]s`)
- **Test framework:** Jest (`@swc/jest`, node environment)
- **Test location:** `apps/backend/src/modules/business-central/__tests__/service.spec.ts` (existing file — extend it, do not create a new file)
- **Naming conventions:** camelCase functions/variables, PascalCase types/classes, kebab-case files. Module names must be camelCase (no dashes). Double-quoted strings, semicolons (match this file's existing style exactly).

## Solution Design

Business Central exposes a `salesReturnOrders` OData entity set (`Microsoft.NAV.salesReturnOrder`) that can be listed and filtered directly, confirmed in `issues/NIMBUS-129/bc metadata/std odata metadata.xml` (EntityType at line 6500, EntitySet at line 10643). This task adds a `listReturns` method to `IBusinessCentralModuleService` and its implementation in `BusinessCentralModuleService`, following the exact structural pattern of the existing `listOrders` method (auth token → build OData filter → fetch → map → return paginated result).

**Key deviation from `listOrders`, and why:** `listOrders` first resolves the company's `customerNumber` to a BC customer GUID (`getCustomerId`) because the `salesOrder` entity type has a `customerId` (`Edm.Guid`) property that it filters on. The `salesReturnOrder` entity type has **no `customerId` field at all** — only `sellToCustomerNumber` (`Edm.String`, directly filterable). So `listReturns` filters `sellToCustomerNumber eq '<customerNumber>'` directly, with **no customer-GUID lookup round trip**. This is simpler than `listOrders`, not a shortcut — verified against the metadata, not assumed.

**Which endpoint (decided):** Use the standard v2.0 path `${discoveryUrl}/salesReturnOrders()`, the same base URL, token and company scoping as `listOrders`/`getOrder`. The tenant's Abakion customer-portal API (`api/abakion/customerPortal/v2.0/companies({BUSINESS_CENTRAL_COMPANY_ID})/salesReturnOrders`, see `issues/NIMBUS-138/abakion api metadata.xml`, which NIMBUS-138 uses for `salesOrderReservationEntries`) exposes an **identical** `salesReturnOrder` schema. Use it only if the sandbox walkthrough shows that the tenant's v2.0 API does not serve `salesReturnOrders`. The switch would change only the URL line. It would add a `BUSINESS_CENTRAL_COMPANY_ID` dependency through `this.getEnvironmentBaseUrl(...)` and `this.getCompanyId()`, the same way `listOrderReservations` does.

**No related order number (decided, Q1):** `salesReturnOrder` has no source-sales-order field. The user confirmed that BC's `externalDocumentNumber` (External Document No.) holds the portal's `requestId`, the `RET-<hash>` idempotency key generated in `apps/backend/src/workflows/business-central-return/steps/prepare-bc-return.ts`. It is **not** an order number. `BCReturnListItem` therefore has no `relatedOrderNumber`, and `externalDocumentNumber` is neither requested nor mapped. It is not kept as a hidden `requestId` either, because nothing consumes it. TC-1's strict `toEqual` fails if an extra property is ever mapped.

**Status wire values (decided):** BC serialises enum members by their XML-encoded names. The existing code already handles this for `customer.blocked` (`"_x0020_"`, see `BC_BLOCKED_UNBLOCKED_WIRE_VALUE`). `salesDocumentStatus` has `Pending_x0020_Approval` and `Pending_x0020_Prepayment`. The mapper therefore decodes `_x0020_` to a space so that the storefront shows "Pending Approval". The storefront status filter offers only `Open` and `Released`, whose wire values need no encoding (Task 04). This mirrors how `bc-order-filters` limits its options to `Open`/`Draft`.

**Only open (unposted) returns are listed (decided, Q2):** BC deletes a Sales Return Order once it is fully received and credited, the same way it deletes fully posted sales orders. A return therefore disappears from the list once BC posts it. The user chose "just open": list `salesReturnOrders` only, with no posted-return history and no follow-up story for now.

Item count per return (for the "Item count" list column) is computed by expanding `salesReturnOrderLines` on the same list query (`$expand=salesReturnOrderLines`) and counting only lines where `lineType === "Item"` (excluding comment/other line types) — mirroring how `prepare-bc-return.ts` already distinguishes real item lines via `line.lineType === "Item"`.

## Impacted Files

### `apps/backend/src/modules/business-central/types.ts` (edit)

Add three new types and one new interface method.

**Edit 1 — insert new types before the interface.**

Old:
```typescript
export type BCReturnReason = {
  id: string;
  description: string;
};

export interface IBusinessCentralModuleService {
```

New:
```typescript
export type BCReturnReason = {
  id: string;
  description: string;
};

export type BCListReturnsParams = {
  customerNumber: string;
  limit: number;
  offset: number;
  status?: string;
  date_from?: string;
  date_to?: string;
  search?: string;
};

export type BCReturnListItem = {
  id: string;
  number: string;
  documentDate: string;
  status: string;
  itemCount: number;
};

export type BCListReturnsResult = {
  returns: BCReturnListItem[];
  count: number;
  offset: number;
  limit: number;
};

export interface IBusinessCentralModuleService {
```

**Edit 2 — add the new method to the interface.**

Old:
```typescript
  createReturnFromSalesOrder(
    params: BCCreateReturnParams
  ): Promise<BCReturnOrder>;
  listReturnReasons(): Promise<BCReturnReason[]>;
}
```

New:
```typescript
  createReturnFromSalesOrder(
    params: BCCreateReturnParams
  ): Promise<BCReturnOrder>;
  listReturnReasons(): Promise<BCReturnReason[]>;
  listReturns(params: BCListReturnsParams): Promise<BCListReturnsResult>;
}
```

### `apps/backend/src/modules/business-central/service.ts` (edit)

**Edit 1 — add new type imports.**

Old (verified on develop 2026-09-29; `BCGetOrderBySalesOrderIdParams` was removed by NIMBUS-138, `BCOrderLineReservation` was added):
```typescript
import type {
  BCGetOrderParams,
  BCListOrdersParams,
  BCListOrdersResult,
  BCOrder,
  BCOrderDetail,
  BCOrderInvoiceSummary,
  BCOrderLine,
  BCOrderLineReservation,
  BCCreateReturnParams,
  BCCustomer,
  BCCustomerBlockedState,
  BCReturnOrder,
  BCReturnReason,
  IBusinessCentralModuleService,
} from "./types";
```

New:
```typescript
import type {
  BCGetOrderParams,
  BCListOrdersParams,
  BCListOrdersResult,
  BCListReturnsParams,
  BCListReturnsResult,
  BCOrder,
  BCOrderDetail,
  BCOrderInvoiceSummary,
  BCOrderLine,
  BCOrderLineReservation,
  BCCreateReturnParams,
  BCCustomer,
  BCCustomerBlockedState,
  BCReturnListItem,
  BCReturnOrder,
  BCReturnReason,
  IBusinessCentralModuleService,
} from "./types";
```

**Edit 2 — add a raw response type and mapper function, right before the class declaration.**

Old:
```typescript
function mapSalesInvoiceToSummary(invoice: BCSalesInvoiceRaw): BCOrderInvoiceSummary {
  return {
    id: invoice.id,
    number: requireBusinessCentralString(invoice.number, "number"),
    invoiceDate: invoice.invoiceDate,
    status: invoice.status,
    totalAmountExcludingTax: invoice.totalAmountExcludingTax ?? 0,
    totalAmountIncludingTax: invoice.totalAmountIncludingTax ?? 0,
  };
}

class BusinessCentralModuleService implements IBusinessCentralModuleService {
```

New:
```typescript
function mapSalesInvoiceToSummary(invoice: BCSalesInvoiceRaw): BCOrderInvoiceSummary {
  return {
    id: invoice.id,
    number: requireBusinessCentralString(invoice.number, "number"),
    invoiceDate: invoice.invoiceDate,
    status: invoice.status,
    totalAmountExcludingTax: invoice.totalAmountExcludingTax ?? 0,
    totalAmountIncludingTax: invoice.totalAmountIncludingTax ?? 0,
  };
}

type BCSalesReturnOrderLineRaw = {
  id: string;
  lineType?: string;
};

type BCSalesReturnOrderRaw = {
  id: string;
  number: unknown;
  documentDate: string;
  status: string;
  salesReturnOrderLines?: BCSalesReturnOrderLineRaw[];
};

function mapSalesReturnOrderToListItem(
  item: BCSalesReturnOrderRaw
): BCReturnListItem {
  return {
    id: item.id,
    number: requireBusinessCentralString(item.number, "number"),
    documentDate: item.documentDate,
    // BC sends enum members XML-encoded, e.g. "Pending_x0020_Approval".
    status: optionalString(item.status).replace(/_x0020_/g, " "),
    itemCount: (item.salesReturnOrderLines ?? []).filter(
      (line) => line.lineType === "Item"
    ).length,
  };
}

class BusinessCentralModuleService implements IBusinessCentralModuleService {
```

**Edit 3 — add the `listReturns` method, right after the end of the (real, NIMBUS-138) `listReturnReasons` method and before the `getCustomerId` private helper.**

Old (the tail of `listReturnReasons`, verified on develop 2026-09-29):
```typescript
    return [...reasons.values()];
  }

  private async getCustomerId(
```

New:
```typescript
    return [...reasons.values()];
  }

  // Filters directly on sellToCustomerNumber: unlike salesOrder, the
  // salesReturnOrder OData entity has no customerId (GUID) field, so there is
  // no customer lookup round trip to make here (contrast with listOrders,
  // which must resolve customerNumber -> customerId first).
  async listReturns(params: BCListReturnsParams): Promise<BCListReturnsResult> {
    const discoveryUrl = this.getDiscoveryUrl();
    const tenantId = this.getTenantId(discoveryUrl);
    const { clientId, clientSecret } = this.getClientCredentials();
    const accessToken = await this.requestToken(tenantId, clientId, clientSecret);

    const returnFilters: string[] = [
      `sellToCustomerNumber eq '${escapeODataString(params.customerNumber)}'`,
    ];
    if (params.status) {
      returnFilters.push(`status eq '${escapeODataString(params.status)}'`);
    }
    if (params.date_from) {
      returnFilters.push(`documentDate ge ${params.date_from}`);
    }
    if (params.date_to) {
      returnFilters.push(`documentDate le ${params.date_to}`);
    }
    if (params.search) {
      returnFilters.push(`contains(number,'${escapeODataString(params.search)}')`);
    }

    const odataUrl = new URL(`${discoveryUrl.toString()}/salesReturnOrders()`);
    odataUrl.searchParams.set("$filter", returnFilters.join(" and "));
    odataUrl.searchParams.set("$top", String(params.limit));
    odataUrl.searchParams.set("$skip", String(params.offset));
    odataUrl.searchParams.set("$count", "true");
    odataUrl.searchParams.set("$orderby", "documentDate desc");
    odataUrl.searchParams.set("$expand", "salesReturnOrderLines");

    const returnsResponse = await fetch(odataUrl.toString(), {
      method: "GET",
      headers: {
        authorization: `Bearer ${accessToken}`,
        accept: "application/json",
      },
    });

    if (!returnsResponse.ok) {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        `Business Central returns request failed with status ${returnsResponse.status}`
      );
    }

    const returnsBody = (await returnsResponse.json()) as {
      "@odata.count"?: number;
      value: BCSalesReturnOrderRaw[];
    };

    return {
      returns: (returnsBody.value ?? []).map(mapSalesReturnOrderToListItem),
      count: returnsBody["@odata.count"] ?? 0,
      offset: params.offset,
      limit: params.limit,
    };
  }

  private async getCustomerId(
```

### `apps/backend/src/modules/business-central/__tests__/service.spec.ts` (edit)

Append a new `describe` block at the **end of the file** (after the closing `});` of `describe("BusinessCentralModuleService.listOrders", ...)`), following the exact `jsonResponse` helper pattern already used in the `listOrders` and `getOrder` describe blocks in this same file.

```typescript
describe("BusinessCentralModuleService.listReturns", () => {
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

  function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), { status });
  }

  // TC-1: happy path — maps salesReturnOrders rows, counting only "Item" lines.
  it("returns mapped return summaries with item counts from expanded lines", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse({ access_token: "access-token" }))
      .mockResolvedValueOnce(
        jsonResponse({
          "@odata.count": 1,
          value: [
            {
              id: "return-1",
              number: "RET-1000",
              // External Document No. holds the portal requestId; it must not be mapped.
              externalDocumentNumber: "RET-3f2a9c1b",
              documentDate: "2026-08-01",
              status: "Open",
              salesReturnOrderLines: [
                { id: "line-1", lineType: "Item" },
                { id: "line-2", lineType: "Item" },
                { id: "line-3", lineType: "Comment" },
              ],
            },
          ],
        })
      );

    const service = new BusinessCentralModuleService();

    await expect(
      service.listReturns({ customerNumber: "10000", limit: 20, offset: 0 })
    ).resolves.toEqual({
      returns: [
        {
          id: "return-1",
          number: "RET-1000",
          documentDate: "2026-08-01",
          status: "Open",
          itemCount: 2,
        },
      ],
      count: 1,
      offset: 0,
      limit: 20,
    });

    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  // TC-2: edge case — no matching returns for the customer.
  it("returns an empty page when the customer has no returns", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse({ access_token: "access-token" }))
      .mockResolvedValueOnce(jsonResponse({ "@odata.count": 0, value: [] }));

    const service = new BusinessCentralModuleService();

    await expect(
      service.listReturns({ customerNumber: "10000", limit: 20, offset: 0 })
    ).resolves.toEqual({ returns: [], count: 0, offset: 0, limit: 20 });
  });

  // TC-3: error condition — a non-OK response throws a MedusaError.
  it("throws when the returns request fails", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse({ access_token: "access-token" }))
      .mockResolvedValueOnce(jsonResponse({}, 500));

    const service = new BusinessCentralModuleService();

    await expect(
      service.listReturns({ customerNumber: "10000", limit: 20, offset: 0 })
    ).rejects.toThrow(
      "Business Central returns request failed with status 500"
    );
  });

  // TC-4: wiring — the OData $filter combines customer, status, date range and search.
  it("builds the OData filter from the customer number, status, date range and search", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse({ access_token: "access-token" }))
      .mockResolvedValueOnce(jsonResponse({ "@odata.count": 0, value: [] }));

    const service = new BusinessCentralModuleService();

    await service.listReturns({
      customerNumber: "10000",
      limit: 20,
      offset: 0,
      status: "Open",
      date_from: "2026-01-01",
      date_to: "2026-12-31",
      search: "RET-1",
    });

    const returnsRequest = (global.fetch as jest.Mock).mock.calls[1][0] as string;
    expect(returnsRequest).toContain("salesReturnOrders()");
    expect(returnsRequest).toContain("sellToCustomerNumber+eq+%2710000%27");
    expect(returnsRequest).toContain("status+eq+%27Open%27");
    expect(returnsRequest).toContain("documentDate+ge+2026-01-01");
    expect(returnsRequest).toContain("documentDate+le+2026-12-31");
    expect(returnsRequest).toContain("contains%28number%2C%27RET-1%27%29");
    expect(returnsRequest).toContain("%24expand=salesReturnOrderLines");
  });

  // TC-5: edge case — XML-encoded enum statuses are decoded; missing lines give itemCount 0.
  it("decodes XML-encoded status values and counts zero items when no lines are expanded", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse({ access_token: "access-token" }))
      .mockResolvedValueOnce(
        jsonResponse({
          "@odata.count": 1,
          value: [
            {
              id: "return-2",
              number: "RET-1001",
              documentDate: "2026-08-02",
              status: "Pending_x0020_Approval",
            },
          ],
        })
      );

    const service = new BusinessCentralModuleService();

    const result = await service.listReturns({
      customerNumber: "10000",
      limit: 20,
      offset: 0,
    });

    expect(result.returns[0]).toEqual({
      id: "return-2",
      number: "RET-1001",
      documentDate: "2026-08-02",
      status: "Pending Approval",
      itemCount: 0,
    });
  });
});
```

## Test Cases

### TC-1: Happy path — maps a return with mixed line types
- **Given:** BC returns one `salesReturnOrder` row with 2 "Item" lines and 1 "Comment" line, for a customer number.
- **When:** `listReturns({ customerNumber, limit: 20, offset: 0 })` is called.
- **Then:** The result contains one `BCReturnListItem` with `itemCount: 2` (comment line excluded) and no property derived from `externalDocumentNumber` (which holds the portal `requestId`), and exactly 2 `fetch` calls are made (token + list — no customer-GUID lookup).

### TC-2: Edge case — customer has no returns
- **Given:** BC returns `{ "@odata.count": 0, value: [] }` for the filtered query.
- **When:** `listReturns` is called.
- **Then:** The result is `{ returns: [], count: 0, offset: 0, limit: 20 }` with no error thrown.

### TC-3: Error condition — BC request fails
- **Given:** The `salesReturnOrders` request responds with HTTP 500.
- **When:** `listReturns` is called.
- **Then:** It rejects with a `MedusaError` whose message contains `"Business Central returns request failed with status 500"`.

### TC-4: Integration/wiring — filter composition
- **Given:** `status`, `date_from`, `date_to`, and `search` are all provided alongside `customerNumber`.
- **When:** `listReturns` is called.
- **Then:** The outgoing request URL's `$filter` contains all five conditions ANDed together, and `$expand=salesReturnOrderLines` is present.

### TC-5: Edge case — encoded status and no lines
- **Given:** BC returns a row with `status: "Pending_x0020_Approval"` and no expanded lines.
- **When:** `listReturns` is called.
- **Then:** The item has `status: "Pending Approval"` and `itemCount: 0`.

## Implementation Steps

1. Open `apps/backend/src/modules/business-central/types.ts` and apply Edit 1 and Edit 2 exactly as specified above.
2. Open `apps/backend/src/modules/business-central/service.ts` and apply Edit 1, Edit 2, and Edit 3 exactly as specified above. Do not modify any other method.
3. Open `apps/backend/src/modules/business-central/__tests__/service.spec.ts` and append the new `describe("BusinessCentralModuleService.listReturns", ...)` block at the end of the file, after the existing `describe("BusinessCentralModuleService.listOrders", ...)` block's closing `});`.
4. Run `cd apps/backend && pnpm test:integration:modules` and confirm the 5 new `listReturns` tests pass. Known baseline (verified 2026-09-29 on develop): `listOrders › stops filling from salesInvoices after the round-trip guardrail even if the page stays short` already fails, and it is reported twice because Jest also picks up the compiled copy under `.medusa/server/`. Do not fix it in this task. Every other pre-existing BC module test must still pass.
5. Run `pnpm build` from the repo root (or `cd apps/backend && pnpm build`) and confirm no TypeScript errors.
6. Run `pnpm lint` from the repo root and confirm no new lint errors in the changed files.
