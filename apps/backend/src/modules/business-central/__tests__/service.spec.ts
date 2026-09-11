import BusinessCentralModuleService from "../service";

const originalFetch = global.fetch;

describe("BusinessCentralModuleService.getCustomer", () => {
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

  function mockCustomerResponse(
    value: Record<string, unknown>[],
    status = 200
  ): void {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: "access-token" }), {
          status: 200,
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ value }), { status })
      );
  }

  it("requests and maps the customer with expanded currency", async () => {
    mockCustomerResponse([
      {
        number: "00011551",
        displayName: "Nimbus Nordic",
        email: "customer@example.com",
        phoneNumber: "12345678",
        addressLine1: "Main Street 1",
        addressLine2: "Building 2",
        city: "Copenhagen",
        state: "Capital",
        postalCode: "2100",
        country: "DK",
        blocked: "Ship",
        creditLimit: 12345.67,
        taxRegistrationNumber: "DK12345678",
        currency: { code: "SEK" },
      },
    ]);

    const service = new BusinessCentralModuleService();

    await expect(service.getCustomer("00011551")).resolves.toEqual({
      number: "00011551",
      displayName: "Nimbus Nordic",
      email: "customer@example.com",
      phoneNumber: "12345678",
      addressLine1: "Main Street 1",
      addressLine2: "Building 2",
      city: "Copenhagen",
      state: "Capital",
      postalCode: "2100",
      country: "DK",
      blocked: "Ship",
      creditLimit: 12345.67,
      taxRegistrationNumber: "DK12345678",
      currencyCode: "SEK",
    });

    const customerRequest = (global.fetch as jest.Mock).mock.calls[1][0] as string;
    expect(customerRequest).toContain("customers()");
    expect(customerRequest).toContain("number+eq+%2700011551%27");
    expect(customerRequest).toContain("%24top=1");
    expect(customerRequest).toContain("%24expand=currency");
  });

  it("returns null when no customer matches", async () => {
    mockCustomerResponse([]);

    const service = new BusinessCentralModuleService();

    await expect(service.getCustomer("00011551")).resolves.toBeNull();
  });

  it("throws when the customer request fails", async () => {
    mockCustomerResponse([], 500);

    const service = new BusinessCentralModuleService();

    await expect(service.getCustomer("00011551")).rejects.toThrow(
      "Business Central customer request failed with status 500"
    );
  });

  it("normalizes the Business Central unblocked wire value", async () => {
    mockCustomerResponse([{ blocked: "_x0020_" }]);

    const service = new BusinessCentralModuleService();

    await expect(service.getCustomer("00011551")).resolves.toMatchObject({
      blocked: "not_blocked",
    });
  });

  it("rejects an unknown blocked value", async () => {
    mockCustomerResponse([{ blocked: "Frozen" }]);

    const service = new BusinessCentralModuleService();

    await expect(service.getCustomer("00011551")).rejects.toThrow(
      "Unsupported Business Central blocked value"
    );
  });

  it("returns null when expanded currency is absent", async () => {
    mockCustomerResponse([{ blocked: "" }]);

    const service = new BusinessCentralModuleService();

    await expect(service.getCustomer("00011551")).resolves.toMatchObject({
      currencyCode: null,
      blocked: "not_blocked",
    });
  });

  it("preserves a decimal credit limit", async () => {
    mockCustomerResponse([{ blocked: "", creditLimit: 12345.67 }]);

    const service = new BusinessCentralModuleService();

    await expect(service.getCustomer("00011551")).resolves.toMatchObject({
      creditLimit: 12345.67,
    });
  });
});

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
      limit: 1,
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
      limit: 1,
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