import BusinessCentralModuleService from "../service";

const originalFetch = global.fetch;

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

  it("returns null when the order is outside the company scope", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: "access-token" }), {
          status: 200,
        })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ value: [{ id: "customer-id-1" }] }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ value: [] }), { status: 200 })
      );

    const service = new BusinessCentralModuleService();

    await expect(
      service.getOrder({ customerNumber: "10000", orderId: "order-1" })
    ).resolves.toBeNull();

    const customerRequest = (global.fetch as jest.Mock).mock.calls[1][0] as string;
    expect(customerRequest).toContain("customers()");
    expect(customerRequest).toContain("number+eq+%2710000%27");

    const ordersRequest = (global.fetch as jest.Mock).mock.calls[2][0] as string;
    expect(ordersRequest).toContain(
      "customerId+eq+customer-id-1+and+id+eq+order-1"
    );
  });

  it("returns the scoped order header and line items", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: "access-token" }), {
          status: 200,
        })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ value: [{ id: "customer-id-1" }] }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            value: [
              {
                id: "order-1",
                number: "SO-1000",
                orderDate: "2026-08-14",
                customerNumber: "10000",
                customerName: "Nimbus Nordic",
                billToName: "Nimbus Nordic Billing",
                billToAddressLine1: "Billing Street 1",
                billToCity: "Copenhagen",
                billToPostalCode: "2100",
                billToCountry: "DK",
                shipToName: "Nimbus Nordic Warehouse",
                shipToAddressLine1: "Shipping Street 1",
                shipToCity: "Aarhus",
                shipToPostalCode: "8000",
                shipToCountry: "DK",
                status: "Open",
                currencyCode: "DKK",
                totalAmountExcludingTax: 100,
                totalAmountIncludingTax: 125,
              },
            ],
          }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            value: [
              {
                id: "line-1",
                sequence: 10000,
                lineType: "Item",
                itemId: "item-1",
                item: { number: "ITEM-1", displayName: "Widget" },
                description: "Item description",
                quantity: 2,
                unitPrice: 50,
                lineAmount: 100,
              },
              {
                id: "line-2",
                sequence: 20000,
                lineType: "Comment",
                description: "Delivered by appointment",
              },
            ],
          }),
          { status: 200 }
        )
      );

    const service = new BusinessCentralModuleService();

    await expect(
      service.getOrder({ customerNumber: "10000", orderId: "order-1" })
    ).resolves.toEqual({
      id: "order-1",
      number: "SO-1000",
      orderDate: "2026-08-14",
      customerNumber: "10000",
      customerName: "Nimbus Nordic",
      billToAddress: [
        "Nimbus Nordic Billing",
        "Billing Street 1",
        "2100 Copenhagen",
        "DK",
      ],
      shipToAddress: [
        "Nimbus Nordic Warehouse",
        "Shipping Street 1",
        "8000 Aarhus",
        "DK",
      ],
      status: "Open",
      currencyCode: "DKK",
      totalAmountExcludingTax: 100,
      totalAmountIncludingTax: 125,
      lines: [
        {
          id: "line-1",
          sequence: 10000,
          lineType: "Item",
          itemId: "item-1",
          itemNumber: "ITEM-1",
          itemDisplayName: "Widget",
          description: "Item description",
          quantity: 2,
          unitPrice: 50,
          lineAmount: 100,
        },
        {
          id: "line-2",
          sequence: 20000,
          lineType: "Comment",
          description: "Delivered by appointment",
          quantity: 0,
          unitPrice: 0,
          lineAmount: 0,
        },
      ],
    });

    const ordersRequest = (global.fetch as jest.Mock).mock.calls[2][0] as string;
    expect(ordersRequest).toContain("customerId+eq+customer-id-1");

    const linesRequest = (global.fetch as jest.Mock).mock.calls[3][0] as string;
    expect(linesRequest).toContain("SalesOrders(order-1)/salesOrderLines()");
    expect(linesRequest).toContain("%24expand=item");
    expect(linesRequest).toContain("%24orderby=sequence");
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

  it("filters orders by the BC customer ID resolved from the company customer number", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: "access-token" }), {
          status: 200,
        })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ value: [{ id: "customer-id-1" }] }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ "@odata.count": 0, value: [] }), {
          status: 200,
        })
      );

    const service = new BusinessCentralModuleService();

    await expect(
      service.listOrders({
        customerNumber: "10000",
        limit: 20,
        offset: 0,
      })
    ).resolves.toEqual({ orders: [], count: 0, offset: 0, limit: 20 });

    const customerRequest = (global.fetch as jest.Mock).mock.calls[1][0] as string;
    expect(customerRequest).toContain("customers()");
    expect(customerRequest).toContain("number+eq+%2710000%27");

    const ordersRequest = (global.fetch as jest.Mock).mock.calls[2][0] as string;
    expect(ordersRequest).toContain("customerId+eq+customer-id-1");
  });
});