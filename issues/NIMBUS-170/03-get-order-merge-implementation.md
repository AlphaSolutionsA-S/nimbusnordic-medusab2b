# Task 03: Merge salesOrder + salesInvoice lines in `getOrder` — Implementation Plan

**Status:** DONE
**App:** backend
**App Root:** apps/backend
**Task ID:** 03
**Date:** 2026-09-11
**Branch:** feature/nimbus-170 (from develop)
**Depends on:** Task 01, Task 02

---

## Project Environment

- **App root:** `apps/backend`
- **Build command:** `pnpm build` (from repo root) or `cd apps/backend && pnpm build`
- **Lint command:** `pnpm lint` (from repo root)
- **Test command:** `cd apps/backend && pnpm test:integration:modules`
- **Test framework:** Jest (`@swc/jest`), matches `**/src/modules/*/__tests__/**/*.[jt]s`
- **Test location:** `apps/backend/src/modules/business-central/__tests__/service.spec.ts` (existing file — edit the `describe("BusinessCentralModuleService.getOrder"...)` block)
- **Naming conventions:** kebab-case files, camelCase functions/vars, PascalCase types (per `apps/backend/copilot-instructions.md`)

## Background — read this before writing code

Today `getOrder` filters BC by `id eq params.orderId` against `salesOrders` only. This breaks for any order that is fully or partially invoiced, because (a) `salesOrder.id` and `salesInvoice.id` are unrelated GUIDs (D1 — the only valid join key is `salesOrder.number == salesInvoice.orderNumber`), and (b) a partially invoiced order's line items are split across `salesOrderLines` (still-open lines) and `salesInvoiceLines` (already-invoiced lines) — showing only `salesOrderLines` hides lines the customer already had invoiced.

This task depends on Task 02 landing first: it reuses `BCSalesOrderRaw`, `BCSalesInvoiceRaw`, `mapSalesOrderToBCOrder`, and `mapSalesInvoiceToBCOrder` defined there, and both tasks edit `service.ts`, so doing them in order avoids merge conflicts.

**Decisions already made for you (see `issues/NIMBUS-170/SCOPE.md` and `PLAN.md` for full rationale — do not re-derive):**

- **D1 — Join key:** lookup is now by **order number**, not `id`. `BCGetOrderParams.orderNumber` (Task 01) replaces `orderId`.
- **D3 — Total precedence for a partially-invoiced order:** the **order shell's own totals** (`salesOrder.totalAmountExcludingTax`/`totalAmountIncludingTax`) are shown, not any invoice's totals — the order row already reflects the full commercial order. This is a default call pending business sign-off; flagged, not blocking.
- **D6 — `id` field on the merged detail:** if a `salesOrder` row exists (open or partially invoiced), `id` is `salesOrder.id` — unchanged from today, which matters because the storefront's return-request flow (`bc-order-return`, explicitly out of scope for this story) still submits `order.id` as the source order id for `POST /store/bc-orders/:id/returns`, and that flow only makes sense for orders still open in `salesOrders`. If no `salesOrder` row exists (fully invoiced), `id` is the representative invoice's `id` — this is a new case; no existing consumer relied on a specific value there before, since fully-invoiced orders were previously invisible.
- **D7 — Line merge:** for a partially-invoiced order, lines = `salesOrder.salesOrderLines` (sorted by `sequence`, unchanged from today) **concatenated with** every linked invoice's `salesInvoiceLines` (each sorted by `sequence`; invoices themselves ordered oldest-to-newest by `invoiceDate`). For a fully-invoiced order, lines = every linked invoice's `salesInvoiceLines`, same ordering.
- **D10 — Fully-invoiced header fields (no `salesOrder` row at all):** non-total, non-date fields (`customerName`, addresses, `currencyCode`, `status`) come from the **most recently issued** invoice (latest `invoiceDate`) — consistent with Task 02's list-level representative-row rule (D2). `orderDate` comes from the **earliest** invoice's `invoiceDate` (closest proxy for when the order was originally placed). Totals are the **sum** across every linked invoice (there is no order shell to defer to, unlike D3's partial case).
- **`invoiceStatus`:** `"open"` if a `salesOrder` row exists with no linked invoices; `"partially_invoiced"` if a `salesOrder` row exists **and** at least one linked invoice; `"fully_invoiced"` if no `salesOrder` row exists but at least one invoice does. `null`/not-found (neither exists) returns `null` from `getOrder`, unchanged.
- **D14 — `invoices` on the detail (added after initial scoping, confirmed by the user):** besides the merged `lines`, the response must also expose the original source invoice(s) themselves, so a consumer can see e.g. that a split delivery produced two separate invoices. `BCOrderDetail.invoices: BCOrderInvoiceSummary[]` (Task 01) is populated from every invoice fetched for this order — `[]` when the order is still fully open with no linked invoices, one entry per invoice otherwise, ordered oldest-to-newest by `invoiceDate` (same ordering as the `invoicesUrl` query and the line-merge order in D7). This is cheap: it reuses the same `invoices` array already fetched for line-merging — no extra BC round trip.
- **Guardrail:** at most 50 invoices are fetched per order (`MAX_ORDER_DETAIL_INVOICES = 50`) — an order with more linked invoices than that will silently show only the 50 most recent; flagged as a pragmatic bound, not expected to matter for any real order.
- **Performance:** the `salesOrders` lookup and the `salesInvoices` lookup run **in parallel** (`Promise.all`), not sequentially — both are needed for every call regardless of outcome, so there is no "cheap path" to preserve here (unlike `listOrders`).

## Solution Design

### New constant (add near the other new constants from Task 02)

```typescript
const MAX_ORDER_DETAIL_INVOICES = 50;
```

### New module-level raw line types and mapping functions (add near `mapSalesOrderToBCOrder`/`mapSalesInvoiceToBCOrder` from Task 02)

```typescript
type BCSalesOrderLineRaw = {
  id: string;
  sequence: number;
  lineType?: string;
  itemId?: string;
  item?: { number?: string; displayName?: string };
  description?: string;
  quantity?: number;
  unitPrice?: number;
  amountExcludingTax?: number;
};

type BCSalesInvoiceLineRaw = {
  id: string;
  sequence: number;
  lineType?: string;
  itemId?: string;
  item?: { number?: string; displayName?: string };
  description?: string;
  quantity?: number;
  unitPrice?: number;
  amountExcludingTax?: number;
};

function mapSalesOrderLine(line: BCSalesOrderLineRaw): BCOrderLine {
  return {
    id: line.id,
    sequence: line.sequence,
    lineType: line.lineType ?? "",
    itemId: line.itemId,
    itemNumber: line.item?.number,
    itemDisplayName: line.item?.displayName,
    description: line.description ?? "",
    quantity: line.quantity ?? 0,
    unitPrice: line.unitPrice ?? 0,
    lineAmount: line.amountExcludingTax ?? 0,
  };
}

function mapSalesInvoiceLine(line: BCSalesInvoiceLineRaw): BCOrderLine {
  return {
    id: line.id,
    sequence: line.sequence,
    lineType: line.lineType ?? "",
    itemId: line.itemId,
    itemNumber: line.item?.number,
    itemDisplayName: line.item?.displayName,
    description: line.description ?? "",
    quantity: line.quantity ?? 0,
    unitPrice: line.unitPrice ?? 0,
    lineAmount: line.amountExcludingTax ?? 0,
  };
}
```

`BCSalesOrderLineRaw`/`BCSalesInvoiceLineRaw` and their mapping functions are intentionally **not** merged into one shared type/function even though their bodies are currently identical — they describe two independently-evolving BC entity types (`salesOrderLine` vs `salesInvoiceLine`) that already differ in the metadata (e.g. `salesOrderLine` has `shippedQuantity`/`invoicedQuantity` that `salesInvoiceLine` does not); collapsing them now would create an incorrect coupling the moment one diverges further. This mirrors the existing `BCOrderLineRaw` type that today's `getOrder` already declares inline — it is being promoted to module level and duplicated for the invoice side, not redesigned.

### New mapping function for D14 (add alongside `mapSalesInvoiceLine` above)

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
```

This reads `invoice.number` — the invoice's **own** document number (e.g. `"INV-1042"`) — never `invoice.orderNumber` (the parent order's number, already used elsewhere as the join key). Mixing these up would make every entry in `invoices` misleadingly show the same order number instead of each invoice's own identity.

### Replace the existing `getOrder` method body

Replace the entire existing `getOrder` method (current lines ~613-743, from `async getOrder(params: BCGetOrderParams)` through its closing `}`) with:

```typescript
async getOrder(params: BCGetOrderParams): Promise<BCOrderDetail | null> {
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
    return null;
  }

  const orderUrl = new URL(`${discoveryUrl.toString()}/salesOrders()`);
  orderUrl.searchParams.set(
    "$filter",
    [
      `customerId eq ${escapeODataString(customerId)}`,
      `number eq '${escapeODataString(params.orderNumber)}'`,
    ].join(" and ")
  );
  orderUrl.searchParams.set("$top", "1");
  orderUrl.searchParams.set("$expand", "salesOrderLines($expand=item)");

  const invoicesUrl = new URL(`${discoveryUrl.toString()}/salesInvoices()`);
  invoicesUrl.searchParams.set(
    "$filter",
    [
      `customerId eq ${escapeODataString(customerId)}`,
      `orderNumber eq '${escapeODataString(params.orderNumber)}'`,
    ].join(" and ")
  );
  invoicesUrl.searchParams.set("$top", String(MAX_ORDER_DETAIL_INVOICES));
  invoicesUrl.searchParams.set("$orderby", "invoiceDate asc");
  invoicesUrl.searchParams.set("$expand", "salesInvoiceLines($expand=item)");

  const [orderResponse, invoicesResponse] = await Promise.all([
    fetch(orderUrl.toString(), {
      method: "GET",
      headers: {
        authorization: `Bearer ${accessToken}`,
        accept: "application/json",
      },
    }),
    fetch(invoicesUrl.toString(), {
      method: "GET",
      headers: {
        authorization: `Bearer ${accessToken}`,
        accept: "application/json",
      },
    }),
  ]);

  if (!orderResponse.ok) {
    throw new MedusaError(
      MedusaError.Types.UNEXPECTED_STATE,
      `Business Central order request failed with status ${orderResponse.status}`
    );
  }

  if (!invoicesResponse.ok) {
    throw new MedusaError(
      MedusaError.Types.UNEXPECTED_STATE,
      `Business Central invoices request failed with status ${invoicesResponse.status}`
    );
  }

  type BCSalesOrderWithLinesRaw = BCSalesOrderRaw & {
    salesOrderLines?: BCSalesOrderLineRaw[];
  };
  type BCSalesInvoiceWithLinesRaw = BCSalesInvoiceRaw & {
    salesInvoiceLines?: BCSalesInvoiceLineRaw[];
  };

  const orderBody = (await orderResponse.json()) as {
    value?: BCSalesOrderWithLinesRaw[];
  };
  const invoicesBody = (await invoicesResponse.json()) as {
    value?: BCSalesInvoiceWithLinesRaw[];
  };

  const order = orderBody.value?.[0];
  const invoices = invoicesBody.value ?? [];

  if (!order && invoices.length === 0) {
    return null;
  }

  if (order) {
    const orderLines: BCOrderLine[] = [...(order.salesOrderLines ?? [])]
      .sort((left, right) => left.sequence - right.sequence)
      .map(mapSalesOrderLine);

    const invoiceLines: BCOrderLine[] = invoices.flatMap((invoice) =>
      [...(invoice.salesInvoiceLines ?? [])]
        .sort((left, right) => left.sequence - right.sequence)
        .map(mapSalesInvoiceLine)
    );

    const base = mapSalesOrderToBCOrder(order);

    return {
      ...base,
      invoiceStatus: invoices.length > 0 ? "partially_invoiced" : "open",
      lines: [...orderLines, ...invoiceLines],
      invoices: invoices.map(mapSalesInvoiceToSummary),
    };
  }

  const earliestInvoice = invoices[0];
  const latestInvoice = invoices[invoices.length - 1];
  const base = mapSalesInvoiceToBCOrder(latestInvoice);

  const lines: BCOrderLine[] = invoices.flatMap((invoice) =>
    [...(invoice.salesInvoiceLines ?? [])]
      .sort((left, right) => left.sequence - right.sequence)
      .map(mapSalesInvoiceLine)
  );

  return {
    ...base,
    orderDate: earliestInvoice.invoiceDate,
    totalAmountExcludingTax: invoices.reduce(
      (sum, invoice) => sum + (invoice.totalAmountExcludingTax ?? 0),
      0
    ),
    totalAmountIncludingTax: invoices.reduce(
      (sum, invoice) => sum + (invoice.totalAmountIncludingTax ?? 0),
      0
    ),
    invoiceStatus: "fully_invoiced",
    lines,
    invoices: invoices.map(mapSalesInvoiceToSummary),
  };
}
```

Delete the old inline `BCOrderLineRaw` and `BCOrderRaw` types that lived inside the old `getOrder` — they are superseded by the shared `BCSalesOrderLineRaw`/`BCSalesOrderRaw` (from Task 02) and the new `BCSalesInvoiceWithLinesRaw`/`BCSalesOrderWithLinesRaw` local types above.

## Impacted Files

### `apps/backend/src/api/store/bc-orders/[id]/route.ts`

Change the `getOrder` call from:

```typescript
  const order = await bcService.getOrder({
    customerNumber: bcCustomerNumber,
    orderId: req.params.id,
  });
```

to:

```typescript
  const order = await bcService.getOrder({
    customerNumber: bcCustomerNumber,
    orderNumber: req.params.id,
  });
```

Nothing else in this route changes — the URL path segment is still named `id` (no route folder rename needed; Next.js/Medusa dynamic-segment names are just internal parameter names, not part of the public URL shape). Its **value** now carries a BC order number instead of a GUID once the storefront link is updated in Task 04 — this file only needs the field rename to match the new `BCGetOrderParams` shape from Task 01.

**Do not touch** `apps/backend/src/api/store/bc-orders/[id]/returns/route.ts` — it reads `req.params.id` too, but forwards it as `sourceSalesOrderId` to `createBcReturnWorkflow`, which is populated by the storefront from `order.id` (not the page's URL parameter — see `bc-order-return/index.tsx`, line ~106: `createBCReturn(order.id, { lines })`). That value is unaffected by this story's changes (D6 above) and returns are explicitly out of scope.

## Test Cases

Edit `apps/backend/src/modules/business-central/__tests__/service.spec.ts`. The existing `describe("BusinessCentralModuleService.getOrder", ...)` block must be **replaced** — both existing tests use the removed `orderId` param and the old single-call shape; every `getOrder` call now always makes 4 fetches (token, customer, order, invoices — the last two in parallel, so call order between index 2 and 3 is deterministic because `Promise.all([fetch(orderUrl...), fetch(invoicesUrl...)])` evaluates and calls `fetch` on both arguments synchronously, in the array's left-to-right order, before awaiting either).

```typescript
describe("BusinessCentralModuleService.getOrder", () => {
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

  // TC-1: not found in either entity set.
  it("returns null when the order number matches neither salesOrders nor salesInvoices", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse({ access_token: "access-token" }))
      .mockResolvedValueOnce(jsonResponse({ value: [{ id: "customer-id-1" }] }))
      .mockResolvedValueOnce(jsonResponse({ value: [] }))
      .mockResolvedValueOnce(jsonResponse({ value: [] }));

    const service = new BusinessCentralModuleService();

    await expect(
      service.getOrder({ customerNumber: "10000", orderNumber: "SO-9999" })
    ).resolves.toBeNull();

    const orderRequest = (global.fetch as jest.Mock).mock.calls[2][0] as string;
    expect(orderRequest).toContain(
      "customerId+eq+customer-id-1+and+number+eq+%27SO-9999%27"
    );
    const invoicesRequest = (global.fetch as jest.Mock).mock.calls[3][0] as string;
    expect(invoicesRequest).toContain(
      "customerId+eq+customer-id-1+and+orderNumber+eq+%27SO-9999%27"
    );
  });

  // TC-2: happy path — an open order with no invoices, unchanged existing behavior.
  it("returns an open order's header and line items when it has no linked invoices", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse({ access_token: "access-token" }))
      .mockResolvedValueOnce(jsonResponse({ value: [{ id: "customer-id-1" }] }))
      .mockResolvedValueOnce(
        jsonResponse({
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
              salesOrderLines: [
                {
                  id: "line-1",
                  sequence: 10000,
                  lineType: "Item",
                  itemId: "item-1",
                  item: { number: "ITEM-1", displayName: "Widget" },
                  description: "Item description",
                  quantity: 2,
                  unitPrice: 50,
                  amountExcludingTax: 75,
                },
              ],
            },
          ],
        })
      )
      .mockResolvedValueOnce(jsonResponse({ value: [] }));

    const service = new BusinessCentralModuleService();

    await expect(
      service.getOrder({ customerNumber: "10000", orderNumber: "SO-1000" })
    ).resolves.toEqual(
      expect.objectContaining({
        id: "order-1",
        number: "SO-1000",
        invoiceStatus: "open",
        lines: [
          expect.objectContaining({ id: "line-1", quantity: 2 }),
        ],
        // D14: no linked invoices — empty array, not omitted.
        invoices: [],
      })
    );
  });

  // TC-3: partially invoiced — order shell wins the header/totals (D3), lines merge from both sources (D7).
  it("merges salesOrderLines and salesInvoiceLines for a partially invoiced order, keeping the order's own totals", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse({ access_token: "access-token" }))
      .mockResolvedValueOnce(jsonResponse({ value: [{ id: "customer-id-1" }] }))
      .mockResolvedValueOnce(
        jsonResponse({
          value: [
            {
              id: "order-1",
              number: "SO-2000",
              orderDate: "2026-08-01",
              customerNumber: "10000",
              customerName: "Nimbus Nordic",
              status: "Open",
              currencyCode: "DKK",
              totalAmountExcludingTax: 300,
              totalAmountIncludingTax: 375,
              salesOrderLines: [
                {
                  id: "line-open-1",
                  sequence: 20000,
                  lineType: "Item",
                  item: { number: "ITEM-2", displayName: "Gadget" },
                  description: "Still open",
                  quantity: 1,
                  unitPrice: 100,
                  amountExcludingTax: 100,
                },
              ],
            },
          ],
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          value: [
            {
              id: "invoice-1",
              number: "INV-2000",
              orderNumber: "SO-2000",
              invoiceDate: "2026-08-05",
              customerNumber: "10000",
              customerName: "Nimbus Nordic",
              status: "Open",
              currencyCode: "DKK",
              totalAmountExcludingTax: 200,
              totalAmountIncludingTax: 250,
              salesInvoiceLines: [
                {
                  id: "line-invoiced-1",
                  sequence: 10000,
                  lineType: "Item",
                  item: { number: "ITEM-1", displayName: "Widget" },
                  description: "Already invoiced",
                  quantity: 2,
                  unitPrice: 100,
                  amountExcludingTax: 200,
                },
              ],
            },
          ],
        })
      );

    const service = new BusinessCentralModuleService();

    const result = await service.getOrder({
      customerNumber: "10000",
      orderNumber: "SO-2000",
    });

    expect(result).toEqual(
      expect.objectContaining({
        id: "order-1",
        number: "SO-2000",
        invoiceStatus: "partially_invoiced",
        // D3: order shell's own totals win, not the invoice's.
        totalAmountExcludingTax: 300,
        totalAmountIncludingTax: 375,
      })
    );
    expect(result?.lines).toEqual([
      expect.objectContaining({ id: "line-open-1" }),
      expect.objectContaining({ id: "line-invoiced-1" }),
    ]);
    // D14: the source invoice itself is exposed alongside the merged lines.
    expect(result?.invoices).toEqual([
      expect.objectContaining({
        id: "invoice-1",
        number: "INV-2000",
        invoiceDate: "2026-08-05",
        totalAmountExcludingTax: 200,
        totalAmountIncludingTax: 250,
      }),
    ]);
  });

  // TC-4: fully invoiced, multiple invoices — order gone from salesOrders, lines and totals aggregate across invoices (D10).
  it("builds the detail from all linked invoices when the order has been fully invoiced", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse({ access_token: "access-token" }))
      .mockResolvedValueOnce(jsonResponse({ value: [{ id: "customer-id-1" }] }))
      .mockResolvedValueOnce(jsonResponse({ value: [] }))
      .mockResolvedValueOnce(
        jsonResponse({
          // $orderby=invoiceDate asc — earliest first, matching the real query.
          value: [
            {
              id: "invoice-early",
              number: "INV-3000",
              orderNumber: "SO-3000",
              invoiceDate: "2026-07-01",
              customerNumber: "10000",
              customerName: "Nimbus Nordic",
              status: "Paid",
              currencyCode: "DKK",
              totalAmountExcludingTax: 60,
              totalAmountIncludingTax: 75,
              salesInvoiceLines: [
                {
                  id: "line-early-1",
                  sequence: 10000,
                  lineType: "Item",
                  description: "First shipment",
                  quantity: 1,
                  unitPrice: 60,
                  amountExcludingTax: 60,
                },
              ],
            },
            {
              id: "invoice-late",
              number: "INV-3001",
              orderNumber: "SO-3000",
              invoiceDate: "2026-07-15",
              customerNumber: "10000",
              customerName: "Nimbus Nordic",
              status: "Paid",
              currencyCode: "DKK",
              totalAmountExcludingTax: 40,
              totalAmountIncludingTax: 50,
              salesInvoiceLines: [
                {
                  id: "line-late-1",
                  sequence: 10000,
                  lineType: "Item",
                  description: "Second shipment",
                  quantity: 1,
                  unitPrice: 40,
                  amountExcludingTax: 40,
                },
              ],
            },
          ],
        })
      );

    const service = new BusinessCentralModuleService();

    const result = await service.getOrder({
      customerNumber: "10000",
      orderNumber: "SO-3000",
    });

    expect(result).toEqual(
      expect.objectContaining({
        id: "invoice-late",
        number: "SO-3000",
        orderDate: "2026-07-01",
        invoiceStatus: "fully_invoiced",
        totalAmountExcludingTax: 100,
        totalAmountIncludingTax: 125,
      })
    );
    expect(result?.lines).toEqual([
      expect.objectContaining({ id: "line-early-1" }),
      expect.objectContaining({ id: "line-late-1" }),
    ]);
    // D14: both invoices from the split delivery are exposed, oldest first — same order as the lines.
    expect(result?.invoices).toEqual([
      expect.objectContaining({ id: "invoice-early", number: "INV-3000", invoiceDate: "2026-07-01" }),
      expect.objectContaining({ id: "invoice-late", number: "INV-3001", invoiceDate: "2026-07-15" }),
    ]);
  });
});
```

## Implementation Steps

1. Confirm Tasks 01 and 02 have landed.
2. In `apps/backend/src/modules/business-central/service.ts`:
   a. Add `MAX_ORDER_DETAIL_INVOICES` near the other constants.
   b. Add `BCSalesOrderLineRaw`, `BCSalesInvoiceLineRaw`, `mapSalesOrderLine`, `mapSalesInvoiceLine`, and `mapSalesInvoiceToSummary` (D14) near the mapping functions from Task 02.
   c. Replace the entire `getOrder` method body with the version above, removing its old inline `BCOrderLineRaw`/`BCOrderRaw` types.
3. Update `apps/backend/src/api/store/bc-orders/[id]/route.ts` per the "Impacted Files" section above (one field rename).
4. Update `apps/backend/src/modules/business-central/__tests__/service.spec.ts`: replace the `describe("BusinessCentralModuleService.getOrder", ...)` block with the version above.
5. Run `cd apps/backend && pnpm test:integration:modules` and confirm all `listOrders` and `getOrder` tests pass.
6. Run `cd apps/backend && pnpm build` and confirm the module compiles cleanly with no leftover references to `BCOrderRaw`/`BCOrderLineRaw`/`orderId`.
7. Run `pnpm lint` from the repo root and fix any lint issues in the lines you touched only.
