# Task 02: Merge salesOrders + salesInvoices in `listOrders` — Implementation Plan

**Status:** TODO
**App:** backend
**App Root:** apps/backend
**Task ID:** 02
**Date:** 2026-09-11
**Branch:** feature/nimbus-170 (from develop)
**Depends on:** Task 01

---

## Project Environment

- **App root:** `apps/backend`
- **Build command:** `pnpm build` (from repo root) or `cd apps/backend && pnpm build`
- **Lint command:** `pnpm lint` (from repo root)
- **Test command:** `cd apps/backend && pnpm test:integration:modules`
- **Test framework:** Jest (`@swc/jest`), matches `**/src/modules/*/__tests__/**/*.[jt]s`
- **Test location:** `apps/backend/src/modules/business-central/__tests__/service.spec.ts` (existing file — edit the `describe("BusinessCentralModuleService.listOrders"...)` block; do not create a new file)
- **Naming conventions:** kebab-case files, camelCase functions/vars, PascalCase types (per `apps/backend/copilot-instructions.md`)

## Background — read this before writing code

Today `listOrders` in `apps/backend/src/modules/business-central/service.ts` (lines ~487-611) queries only BC's `salesOrders` OData entity set. Once a sales order is **fully invoiced**, BC removes it from `salesOrders` entirely — it survives only as one or more `salesInvoices` rows, joined back to the original order via `salesInvoice.orderNumber == salesOrder.number` (their `id` fields are **unrelated GUIDs** — never join on `id`). Today's code silently drops these orders. This task changes `listOrders` to return the union.

**Decisions already made for you (do not re-derive, do not re-litigate — see `issues/NIMBUS-170/SCOPE.md` and `PLAN.md` for full rationale):**

- **D1 — Join key:** `salesOrder.number == salesInvoice.orderNumber`.
- **D2 — Multiple invoices per order (list view only):** when a fully-invoiced order has more than one linked invoice, the **most recently issued** invoice (`invoiceDate` descending, first-seen wins) is the representative row shown in the list.
- **D5 — Status:** raw passthrough of whichever BC enum produced the row (`status: string`, already widened in Task 01). Do **not** attempt to unify the two BC status enums — that is explicitly out of scope.
- **D8 — Pagination total (`count`):** approximate. `count = salesOrdersTotal + invoicesRawCountApprox`, where `invoicesRawCountApprox` is the **raw** (non-deduped) `@odata.count` from a single always-on, cheap `salesInvoices` count query. This can overcount slightly (an order with 2 invoices counts twice; an invoice for an order still open in `salesOrders` counts once extra) — that is an accepted approximation, not a bug. It keeps early-page requests to a fixed, small number of BC calls.
- **D12 — `invoiceStatus` at the list level:** rows sourced from `salesOrders` always get `invoiceStatus: "open"`; rows sourced from `salesInvoices` (invoice-only) always get `invoiceStatus: "fully_invoiced"`. The list **never** emits `"partially_invoiced"` — detecting a partial invoice for every row on a page would require an extra BC round trip per row, which defeats the "cheap early pages" requirement. Only `getOrder` (Task 03) computes the true partial-invoice state, since it already has both sources for one order at no extra cost. This is a deliberate simplification — flagged for product to revisit if a list-level partial-invoice badge is wanted later.
- **Pagination strategy (NFR, non-negotiable):** `salesOrders` (the smaller table) is the primary source. The existing `$top`/`$skip` query against `salesOrders` is **reused unchanged** — its own `$top`/`$skip` naturally yields fewer than `limit` rows once a page crosses the end of the table. Only when it does (`remainder = limit - orders.length > 0`) do we pay for extra BC round trips to fill the rest from `salesInvoices`. Early pages that are fully satisfied by `salesOrders` cost exactly the same number of BC calls as today, plus the one always-on invoices-count call (D8).
- **Guardrails (Open Question — "slow tail pages"):** two named constants bound the worst case: `SALES_ORDER_DEDUP_FETCH_CAP = 1000` (max salesOrders numbers fetched to build the dedup set) and `MAX_INVOICE_FILL_ROUND_TRIPS = 10` with `INVOICE_FILL_BATCH_SIZE = 50` (max extra BC calls fetching salesInvoices to fill a page). If the cap/round-trip budget is exhausted before the page is full, `listOrders` returns whatever it found — it never loops unboundedly.

## Solution Design

### New module-level constants (add near the top of `service.ts`, alongside `DEFAULT_BUSINESS_CENTRAL_DISCOVERY_URL` etc.)

```typescript
const SALES_ORDER_DEDUP_FETCH_CAP = 1000;
const INVOICE_FILL_BATCH_SIZE = 50;
const MAX_INVOICE_FILL_ROUND_TRIPS = 10;
```

### New module-level raw/DTO types (add near existing `formatAddress`, before the `BusinessCentralModuleService` class)

These consolidate the two near-duplicate inline `BCOrderRaw` types that exist today inside `listOrders` and `getOrder` into one shared type, since both methods (and this task's new helpers) need the exact same shape. `BCSalesInvoiceRaw` is new.

```typescript
type BCSalesOrderRaw = {
  id: string;
  number: unknown;
  orderDate: string;
  customerNumber: string;
  customerName: string;
  billToName?: string;
  billToAddressLine1?: string;
  billToAddressLine2?: string;
  billToCity?: string;
  billToPostalCode?: string;
  billToCountry?: string;
  shipToName?: string;
  shipToAddressLine1?: string;
  shipToAddressLine2?: string;
  shipToCity?: string;
  shipToPostalCode?: string;
  shipToCountry?: string;
  status: string;
  currencyCode: string;
  totalAmountExcludingTax?: number;
  totalAmountIncludingTax?: number;
};

type BCSalesInvoiceRaw = {
  id: string;
  number: unknown;
  orderNumber: unknown;
  invoiceDate: string;
  customerNumber: string;
  customerName: string;
  billToName?: string;
  billToAddressLine1?: string;
  billToAddressLine2?: string;
  billToCity?: string;
  billToPostCode?: string;
  billToCountry?: string;
  shipToName?: string;
  shipToAddressLine1?: string;
  shipToAddressLine2?: string;
  shipToCity?: string;
  shipToPostCode?: string;
  shipToCountry?: string;
  status: string;
  currencyCode: string;
  totalAmountExcludingTax?: number;
  totalAmountIncludingTax?: number;
};
```

**Note on field names:** `BCSalesOrderRaw` intentionally keeps the existing (pre-existing, already-shipped) field names `billToPostalCode`/`shipToPostalCode`, matching today's code exactly — do not change them, that is not in scope for this task. **Finding to flag, not fix:** per the verified BC OData metadata (`issues/NIMBUS-129/bc metadata/std odata metadata.xml`, `salesOrder` EntityType), the real property name is `billToPostCode`/`shipToPostCode` (no "al"), not `billToPostalCode`/`shipToPostalCode`. This means today's code has likely always silently dropped the postal code from order addresses (BC returns no property with that name, so it's `undefined`, and `formatAddress` filters out falsy lines). This is a **pre-existing bug that predates this story** — mention it, do not fix it here. `BCSalesInvoiceRaw` above uses the **metadata-correct** names (`billToPostCode`/`shipToPostCode`) because it is new code with no existing-convention constraint forcing it to replicate the bug.

### New module-level mapping functions (add after the raw types, before the class)

```typescript
function mapSalesOrderToBCOrder(item: BCSalesOrderRaw): BCOrder {
  return {
    id: item.id,
    number: requireBusinessCentralString(item.number, "number"),
    orderDate: item.orderDate,
    customerNumber: item.customerNumber,
    customerName: item.customerName,
    billToAddress: formatAddress(
      item.billToName,
      item.billToAddressLine1,
      item.billToAddressLine2,
      item.billToCity,
      item.billToPostalCode,
      item.billToCountry
    ),
    shipToAddress: formatAddress(
      item.shipToName,
      item.shipToAddressLine1,
      item.shipToAddressLine2,
      item.shipToCity,
      item.shipToPostalCode,
      item.shipToCountry
    ),
    status: item.status,
    invoiceStatus: "open",
    currencyCode: item.currencyCode,
    totalAmountExcludingTax: item.totalAmountExcludingTax ?? 0,
    totalAmountIncludingTax: item.totalAmountIncludingTax ?? 0,
  };
}

function mapSalesInvoiceToBCOrder(item: BCSalesInvoiceRaw): BCOrder {
  return {
    id: item.id,
    number: requireBusinessCentralString(item.orderNumber, "orderNumber"),
    orderDate: item.invoiceDate,
    customerNumber: item.customerNumber,
    customerName: item.customerName,
    billToAddress: formatAddress(
      item.billToName,
      item.billToAddressLine1,
      item.billToAddressLine2,
      item.billToCity,
      item.billToPostCode,
      item.billToCountry
    ),
    shipToAddress: formatAddress(
      item.shipToName,
      item.shipToAddressLine1,
      item.shipToAddressLine2,
      item.shipToCity,
      item.shipToPostCode,
      item.shipToCountry
    ),
    status: item.status,
    invoiceStatus: "fully_invoiced",
    currencyCode: item.currencyCode,
    totalAmountExcludingTax: item.totalAmountExcludingTax ?? 0,
    totalAmountIncludingTax: item.totalAmountIncludingTax ?? 0,
  };
}
```

`mapSalesInvoiceToBCOrder.number` reads `item.orderNumber` (the **commercial order's** number), never `item.number` (the invoice's own document number) — this is the D1 join key, and using the wrong field here would silently break dedup and the detail-page link. `orderDate` reads `item.invoiceDate` per the SCOPE.md finding that `salesInvoice` has no `orderDate` field at all (D4 — documented approximation, not a perfect semantic match, but the best available field).

**`BCSalesInvoiceRaw.number`** (the invoice's own document number, e.g. `"INV-1042"`, distinct from `orderNumber`) is unused by `mapSalesInvoiceToBCOrder`/this task's list-fill logic — it exists on the shared raw type solely so Task 03 can read it when building `BCOrderDetail.invoices` (D14). No behavior change in this task from adding it; both `listOrders` fetch URLs already return the full entity (no `$select` narrowing), so the field arrives in every response body regardless.

### New private helper methods (add inside the `BusinessCentralModuleService` class, near `getCustomerId`)

```typescript
private async fetchAllSalesOrderNumbers(
  discoveryUrl: URL,
  accessToken: string,
  orderFilters: string[]
): Promise<Set<string>> {
  const url = new URL(`${discoveryUrl.toString()}/salesOrders()`);
  url.searchParams.set("$filter", orderFilters.join(" and "));
  url.searchParams.set("$top", String(SALES_ORDER_DEDUP_FETCH_CAP));

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      authorization: `Bearer ${accessToken}`,
      accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new MedusaError(
      MedusaError.Types.UNEXPECTED_STATE,
      `Business Central orders request failed with status ${response.status}`
    );
  }

  const body = (await response.json()) as {
    value?: Array<{ number?: unknown }>;
  };
  const numbers = new Set<string>();

  for (const item of body.value ?? []) {
    if (typeof item.number === "string" && item.number.length > 0) {
      numbers.add(item.number);
    }
  }

  return numbers;
}

private async fetchSalesInvoicesBatch(
  discoveryUrl: URL,
  accessToken: string,
  invoiceFilters: string[],
  top: number,
  skip: number
): Promise<BCSalesInvoiceRaw[]> {
  const url = new URL(`${discoveryUrl.toString()}/salesInvoices()`);
  url.searchParams.set("$filter", invoiceFilters.join(" and "));
  url.searchParams.set("$top", String(top));
  url.searchParams.set("$skip", String(skip));
  url.searchParams.set("$orderby", "invoiceDate desc");

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      authorization: `Bearer ${accessToken}`,
      accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new MedusaError(
      MedusaError.Types.UNEXPECTED_STATE,
      `Business Central invoices request failed with status ${response.status}`
    );
  }

  const body = (await response.json()) as { value?: BCSalesInvoiceRaw[] };
  return body.value ?? [];
}
```

### Replace the existing `listOrders` method body

Replace the entire existing `listOrders` method (current lines ~487-611, from `async listOrders(params: BCListOrdersParams)` through its closing `}`) with:

```typescript
async listOrders(params: BCListOrdersParams): Promise<BCListOrdersResult> {
  const discoveryUrl = this.getDiscoveryUrl();
  const tenantId = this.getTenantId(discoveryUrl);
  const { clientId, clientSecret } = this.getClientCredentials();
  const accessToken = await this.requestToken(tenantId, clientId, clientSecret);
  const customerId = await this.getCustomerId(
    discoveryUrl,
    accessToken,
    params.customerNumber
  );

  if (!customerId) {
    return {
      orders: [],
      count: 0,
      offset: params.offset,
      limit: params.limit,
    };
  }

  const orderFilters: string[] = [`customerId eq ${escapeODataString(customerId)}`];
  if (params.status) {
    orderFilters.push(`status eq '${escapeODataString(params.status)}'`);
  }
  if (params.date_from) {
    orderFilters.push(`orderDate ge ${params.date_from}`);
  }
  if (params.date_to) {
    orderFilters.push(`orderDate le ${params.date_to}`);
  }
  if (params.search) {
    orderFilters.push(`contains(number,'${escapeODataString(params.search)}')`);
  }

  const invoiceFilters: string[] = [`customerId eq ${escapeODataString(customerId)}`];
  if (params.status) {
    invoiceFilters.push(`status eq '${escapeODataString(params.status)}'`);
  }
  if (params.date_from) {
    invoiceFilters.push(`invoiceDate ge ${params.date_from}`);
  }
  if (params.date_to) {
    invoiceFilters.push(`invoiceDate le ${params.date_to}`);
  }
  if (params.search) {
    invoiceFilters.push(`contains(orderNumber,'${escapeODataString(params.search)}')`);
  }

  const odataUrl = new URL(`${discoveryUrl.toString()}/salesOrders()`);
  odataUrl.searchParams.set("$filter", orderFilters.join(" and "));
  odataUrl.searchParams.set("$top", String(params.limit));
  odataUrl.searchParams.set("$skip", String(params.offset));
  odataUrl.searchParams.set("$count", "true");
  odataUrl.searchParams.set("$orderby", "orderDate desc");

  const ordersResponse = await fetch(odataUrl.toString(), {
    method: "GET",
    headers: {
      authorization: `Bearer ${accessToken}`,
      accept: "application/json",
    },
  });

  if (!ordersResponse.ok) {
    throw new MedusaError(
      MedusaError.Types.UNEXPECTED_STATE,
      `Business Central orders request failed with status ${ordersResponse.status}`
    );
  }

  const ordersBody = (await ordersResponse.json()) as {
    "@odata.count"?: number;
    value: BCSalesOrderRaw[];
  };
  const salesOrdersTotal = ordersBody["@odata.count"] ?? 0;
  const orders: BCOrder[] = (ordersBody.value ?? []).map(mapSalesOrderToBCOrder);

  const invoicesCountUrl = new URL(`${discoveryUrl.toString()}/salesInvoices()`);
  invoicesCountUrl.searchParams.set("$filter", invoiceFilters.join(" and "));
  invoicesCountUrl.searchParams.set("$top", "1");
  invoicesCountUrl.searchParams.set("$count", "true");

  const invoicesCountResponse = await fetch(invoicesCountUrl.toString(), {
    method: "GET",
    headers: {
      authorization: `Bearer ${accessToken}`,
      accept: "application/json",
    },
  });

  if (!invoicesCountResponse.ok) {
    throw new MedusaError(
      MedusaError.Types.UNEXPECTED_STATE,
      `Business Central invoices request failed with status ${invoicesCountResponse.status}`
    );
  }

  const invoicesCountBody = (await invoicesCountResponse.json()) as {
    "@odata.count"?: number;
  };
  const invoicesRawCountApprox = invoicesCountBody["@odata.count"] ?? 0;

  const remainder = params.limit - orders.length;
  let invoiceOnlyOrders: BCOrder[] = [];

  if (remainder > 0) {
    const dedupOrderNumbers = await this.fetchAllSalesOrderNumbers(
      discoveryUrl,
      accessToken,
      orderFilters
    );

    const skipPastInvoiceOnly = Math.max(0, params.offset - salesOrdersTotal);
    const seenInvoiceOrderNumbers = new Set<string>();
    const collected: BCOrder[] = [];
    let skippedSoFar = 0;
    let rawInvoiceSkip = 0;
    let roundTrips = 0;

    while (
      collected.length < remainder &&
      roundTrips < MAX_INVOICE_FILL_ROUND_TRIPS
    ) {
      const batch = await this.fetchSalesInvoicesBatch(
        discoveryUrl,
        accessToken,
        invoiceFilters,
        INVOICE_FILL_BATCH_SIZE,
        rawInvoiceSkip
      );
      roundTrips += 1;

      if (batch.length === 0) {
        break;
      }

      for (const raw of batch) {
        if (typeof raw.orderNumber !== "string" || raw.orderNumber.length === 0) {
          continue;
        }
        if (dedupOrderNumbers.has(raw.orderNumber)) {
          continue;
        }
        if (seenInvoiceOrderNumbers.has(raw.orderNumber)) {
          continue;
        }
        seenInvoiceOrderNumbers.add(raw.orderNumber);

        if (skippedSoFar < skipPastInvoiceOnly) {
          skippedSoFar += 1;
          continue;
        }

        collected.push(mapSalesInvoiceToBCOrder(raw));
        if (collected.length === remainder) {
          break;
        }
      }

      rawInvoiceSkip += batch.length;
      if (batch.length < INVOICE_FILL_BATCH_SIZE) {
        break;
      }
    }

    invoiceOnlyOrders = collected;
  }

  return {
    orders: [...orders, ...invoiceOnlyOrders],
    count: salesOrdersTotal + invoicesRawCountApprox,
    offset: params.offset,
    limit: params.limit,
  };
}
```

Notes on this replacement:
- The `salesOrders` query URL, filters (except being renamed from `filters` to `orderFilters`), and mapping are otherwise **unchanged in shape** from today's code — only the raw type name and the extraction into `mapSalesOrderToBCOrder` changed.
- `raw.orderNumber` is checked with `typeof raw.orderNumber !== "string"` rather than `requireBusinessCentralString` inside the loop, because a malformed/unlinked invoice (no `orderNumber`) must be silently skipped here, not thrown — throwing would fail the entire page over one bad row. `mapSalesInvoiceToBCOrder` is only called after this guard passes, so its internal `requireBusinessCentralString(item.orderNumber, "orderNumber")` never throws in this path.

## Test Cases

Edit `apps/backend/src/modules/business-central/__tests__/service.spec.ts`. The existing `describe("BusinessCentralModuleService.listOrders", ...)` block (bottom of the file) must be **replaced** — its one existing test needs additional mocks (see TC-1 below) because every `listOrders` call now always makes an invoices-count request too, and an empty-orders page now also triggers the dedup + invoice-fill path. Keep the existing `beforeEach`/`afterEach` (`process.env...`, `global.fetch = originalFetch`) unchanged.

Mock call order for **every** `listOrders` test: 1) token, 2) customer lookup, 3) `salesOrders()` page, 4) `salesInvoices()` count (`$top=1&$count=true`), 5+) only if `remainder > 0`: `salesOrders()` dedup fetch (no `$skip`, `$top=1000`), then one or more `salesInvoices()` batches (`$orderby=invoiceDate desc`, `$skip` increasing by `INVOICE_FILL_BATCH_SIZE` each round).

```typescript
describe("BusinessCentralModuleService.listOrders", () => {
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

  it("filters orders by the BC customer ID resolved from the company customer number", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse({ access_token: "access-token" }))
      .mockResolvedValueOnce(jsonResponse({ value: [{ id: "customer-id-1" }] }))
      .mockResolvedValueOnce(jsonResponse({ "@odata.count": 0, value: [] }))
      .mockResolvedValueOnce(jsonResponse({ "@odata.count": 0 }))
      .mockResolvedValueOnce(jsonResponse({ value: [] }))
      .mockResolvedValueOnce(jsonResponse({ value: [] }));

    const service = new BusinessCentralModuleService();

    await expect(
      service.listOrders({ customerNumber: "10000", limit: 20, offset: 0 })
    ).resolves.toEqual({ orders: [], count: 0, offset: 0, limit: 20 });

    const customerRequest = (global.fetch as jest.Mock).mock.calls[1][0] as string;
    expect(customerRequest).toContain("customers()");
    expect(customerRequest).toContain("number+eq+%2710000%27");

    const ordersRequest = (global.fetch as jest.Mock).mock.calls[2][0] as string;
    expect(ordersRequest).toContain("customerId+eq+customer-id-1");

    const invoicesCountRequest = (global.fetch as jest.Mock).mock.calls[3][0] as string;
    expect(invoicesCountRequest).toContain("salesInvoices()");
    expect(invoicesCountRequest).toContain("customerId+eq+customer-id-1");
  });

  // TC-1: happy path — salesOrders alone fills the page, no invoice fill needed.
  it("returns salesOrders rows unchanged when they fully satisfy the page", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse({ access_token: "access-token" }))
      .mockResolvedValueOnce(jsonResponse({ value: [{ id: "customer-id-1" }] }))
      .mockResolvedValueOnce(
        jsonResponse({
          "@odata.count": 1,
          value: [
            {
              id: "order-1",
              number: "SO-1000",
              orderDate: "2026-08-14",
              customerNumber: "10000",
              customerName: "Nimbus Nordic",
              status: "Open",
              currencyCode: "DKK",
              totalAmountExcludingTax: 100,
              totalAmountIncludingTax: 125,
            },
          ],
        })
      )
      .mockResolvedValueOnce(jsonResponse({ "@odata.count": 0 }));

    const service = new BusinessCentralModuleService();

    const result = await service.listOrders({
      customerNumber: "10000",
      limit: 20,
      offset: 0,
    });

    expect(result).toEqual({
      orders: [
        {
          id: "order-1",
          number: "SO-1000",
          orderDate: "2026-08-14",
          customerNumber: "10000",
          customerName: "Nimbus Nordic",
          billToAddress: [],
          shipToAddress: [],
          status: "Open",
          invoiceStatus: "open",
          currencyCode: "DKK",
          totalAmountExcludingTax: 100,
          totalAmountIncludingTax: 125,
        },
      ],
      count: 1,
      offset: 0,
      limit: 20,
    });
    // No dedup fetch or invoice batch calls — only 4 total.
    expect(global.fetch).toHaveBeenCalledTimes(4);
  });

  // TC-2: dedup — a fully-invoiced order (gone from salesOrders) appears once, from salesInvoices.
  it("fills the remainder of a page from salesInvoices when salesOrders runs out, excluding orders still open", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse({ access_token: "access-token" }))
      .mockResolvedValueOnce(jsonResponse({ value: [{ id: "customer-id-1" }] }))
      .mockResolvedValueOnce(
        jsonResponse({
          "@odata.count": 1,
          value: [
            {
              id: "order-open-1",
              number: "SO-2000",
              orderDate: "2026-08-20",
              customerNumber: "10000",
              customerName: "Nimbus Nordic",
              status: "Open",
              currencyCode: "DKK",
              totalAmountExcludingTax: 200,
              totalAmountIncludingTax: 250,
            },
          ],
        })
      )
      .mockResolvedValueOnce(jsonResponse({ "@odata.count": 1 }))
      // dedup fetch: only SO-2000 is currently open
      .mockResolvedValueOnce(jsonResponse({ value: [{ number: "SO-2000" }] }))
      // invoice batch: one fully-invoiced order (SO-1000), unrelated to SO-2000
      .mockResolvedValueOnce(
        jsonResponse({
          value: [
            {
              id: "invoice-1",
              orderNumber: "SO-1000",
              invoiceDate: "2026-08-10",
              customerNumber: "10000",
              customerName: "Nimbus Nordic",
              status: "Paid",
              currencyCode: "DKK",
              totalAmountExcludingTax: 100,
              totalAmountIncludingTax: 125,
            },
          ],
        })
      );

    const service = new BusinessCentralModuleService();

    const result = await service.listOrders({
      customerNumber: "10000",
      limit: 2,
      offset: 0,
    });

    expect(result.orders).toEqual([
      expect.objectContaining({ number: "SO-2000", invoiceStatus: "open" }),
      expect.objectContaining({
        number: "SO-1000",
        invoiceStatus: "fully_invoiced",
        orderDate: "2026-08-10",
        status: "Paid",
      }),
    ]);

    const dedupRequest = (global.fetch as jest.Mock).mock.calls[4][0] as string;
    expect(dedupRequest).toContain("salesOrders()");
    expect(dedupRequest).toContain("%24top=1000");

    const invoiceBatchRequest = (global.fetch as jest.Mock).mock.calls[5][0] as string;
    expect(invoiceBatchRequest).toContain("salesInvoices()");
    expect(invoiceBatchRequest).toContain("%24orderby=invoiceDate+desc");
  });

  // TC-3: an invoice belonging to an order still open in salesOrders must NOT be duplicated.
  it("excludes an invoice whose order number is still open in salesOrders from the invoice-only fill", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse({ access_token: "access-token" }))
      .mockResolvedValueOnce(jsonResponse({ value: [{ id: "customer-id-1" }] }))
      .mockResolvedValueOnce(
        jsonResponse({
          "@odata.count": 1,
          value: [
            {
              id: "order-open-1",
              number: "SO-3000",
              orderDate: "2026-08-20",
              customerNumber: "10000",
              customerName: "Nimbus Nordic",
              status: "Open",
              currencyCode: "DKK",
              totalAmountExcludingTax: 300,
              totalAmountIncludingTax: 375,
            },
          ],
        })
      )
      .mockResolvedValueOnce(jsonResponse({ "@odata.count": 1 }))
      .mockResolvedValueOnce(jsonResponse({ value: [{ number: "SO-3000" }] }))
      // The only invoice batch row belongs to the already-open SO-3000 (partial invoice) — must be excluded, not duplicated.
      .mockResolvedValueOnce(
        jsonResponse({
          value: [
            {
              id: "invoice-partial-1",
              orderNumber: "SO-3000",
              invoiceDate: "2026-08-18",
              customerNumber: "10000",
              customerName: "Nimbus Nordic",
              status: "Open",
              currencyCode: "DKK",
              totalAmountExcludingTax: 50,
              totalAmountIncludingTax: 62.5,
            },
          ],
        })
      );

    const service = new BusinessCentralModuleService();

    const result = await service.listOrders({
      customerNumber: "10000",
      limit: 2,
      offset: 0,
    });

    expect(result.orders).toHaveLength(1);
    expect(result.orders[0]).toEqual(
      expect.objectContaining({ number: "SO-3000", invoiceStatus: "open" })
    );
  });

  // TC-4: guardrail — the invoice-fill loop stops after MAX_INVOICE_FILL_ROUND_TRIPS batches, never hangs.
  it("stops filling from salesInvoices after the round-trip guardrail even if the page stays short", async () => {
    const mockFetch = jest.fn();
    mockFetch.mockResolvedValueOnce(jsonResponse({ access_token: "access-token" }));
    mockFetch.mockResolvedValueOnce(jsonResponse({ value: [{ id: "customer-id-1" }] }));
    mockFetch.mockResolvedValueOnce(jsonResponse({ "@odata.count": 0, value: [] }));
    mockFetch.mockResolvedValueOnce(jsonResponse({ "@odata.count": 0 }));
    mockFetch.mockResolvedValueOnce(jsonResponse({ value: [] })); // dedup fetch: no open orders
    // Every invoice batch returns exactly INVOICE_FILL_BATCH_SIZE (50) rows that all get deduped away
    // (simulated by reusing the same orderNumber repeatedly, which collapses to one after the first row
    // but each call still returns a full batch so the loop keeps going until the round-trip cap).
    for (let i = 0; i < 10; i += 1) {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({
          value: Array.from({ length: 50 }, (_, index) => ({
            id: `invoice-${i}-${index}`,
            orderNumber: "SO-REPEAT",
            invoiceDate: "2026-08-01",
            customerNumber: "10000",
            customerName: "Nimbus Nordic",
            status: "Paid",
            currencyCode: "DKK",
            totalAmountExcludingTax: 10,
            totalAmountIncludingTax: 12.5,
          })),
        })
      );
    }
    global.fetch = mockFetch;

    const service = new BusinessCentralModuleService();

    const result = await service.listOrders({
      customerNumber: "10000",
      limit: 5,
      offset: 0,
    });

    // Only the first occurrence of SO-REPEAT is kept (dedup within invoice-only rows); the loop
    // still must not exceed MAX_INVOICE_FILL_ROUND_TRIPS (10) additional salesInvoices calls.
    expect(result.orders).toEqual([
      expect.objectContaining({ number: "SO-REPEAT" }),
    ]);
    // 4 fixed calls (token, customer, orders, invoices-count) + 1 dedup fetch + 10 batch round trips = 15.
    expect(global.fetch).toHaveBeenCalledTimes(15);
  });
});
```

## Implementation Steps

1. Confirm Task 01 has landed (`types.ts` already has `invoiceStatus`/`BCOrderInvoiceStatus`/widened `status`).
2. In `apps/backend/src/modules/business-central/service.ts`:
   a. Add the three new constants near the top.
   b. Add `BCSalesOrderRaw` and `BCSalesInvoiceRaw` module-level types, and `mapSalesOrderToBCOrder`/`mapSalesInvoiceToBCOrder` module-level functions, placed after `formatAddress` and before `class BusinessCentralModuleService`.
   c. Add `fetchAllSalesOrderNumbers` and `fetchSalesInvoicesBatch` as new private methods on the class, near `getCustomerId`.
   d. Replace the entire `listOrders` method body with the version above. Delete the old inline `BCOrderRaw` type that lived inside the old `listOrders` (it is superseded by the shared `BCSalesOrderRaw`).
   e. Leave `getOrder` untouched in this task — it still references the old inline `BCOrderRaw` type and `params.orderId`, and will not compile cleanly until Task 03. That is expected; Task 03 fixes it immediately after this task.
3. Update `apps/backend/src/modules/business-central/__tests__/service.spec.ts`: replace the `describe("BusinessCentralModuleService.listOrders", ...)` block with the version above (keep the `getCustomer` and `getOrder` describe blocks as-is — Task 03 will update `getOrder`'s).
4. Run `cd apps/backend && pnpm test:integration:modules` and confirm the `listOrders` tests pass. `getOrder` tests will still fail until Task 03 — that's expected, do not attempt to fix them here.
5. Run `pnpm lint` from the repo root and fix any lint issues in the lines you touched only.
