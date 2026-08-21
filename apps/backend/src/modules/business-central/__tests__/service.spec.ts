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
                salesOrderLines: [
                  {
                    id: "line-2",
                    sequence: 20000,
                    lineType: "Comment",
                    description: "Delivered by appointment",
                  },
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
          lineAmount: 75,
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
    expect(ordersRequest).toContain(
      "%24expand=salesOrderLines%28%24expand%3Ditem%29"
    );
    expect(global.fetch).toHaveBeenCalledTimes(3);
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