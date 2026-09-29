import BusinessCentralModuleService, {
  BusinessCentralAmbiguousOutcomeError,
} from "../service";
import type { BCCreateSalesOrderParams } from "../types";

const originalFetch = global.fetch;

const TOKEN_URL = "https://login.microsoftonline.com";
const BASE_URL =
  "https://api.businesscentral.dynamics.com/v2.0/tenant-id/Sandbox/api/v2.0";
const SALES_ORDER_ID = "22222222-2222-2222-2222-222222222222";

function tokenResponse(): Response {
  return new Response(JSON.stringify({ access_token: "access-token" }), {
    status: 200,
  });
}

function headerResponse(
  body: Record<string, unknown> = {
    id: SALES_ORDER_ID,
    number: "SO-001234",
    status: "Draft",
  },
  status = 201
): Response {
  return new Response(JSON.stringify(body), { status });
}

function lineResponse(status = 201): Response {
  return new Response(JSON.stringify({ id: "line" }), { status });
}

function mockBusinessCentral(responses: Response[]): jest.Mock {
  const fetchMock = jest.fn();

  fetchMock.mockResolvedValueOnce(tokenResponse());

  for (const response of responses) {
    fetchMock.mockResolvedValueOnce(response);
  }

  global.fetch = fetchMock;

  return fetchMock;
}

type RecordedRequest = { url: string; body: Record<string, unknown> };

function bcRequests(fetchMock: jest.Mock): RecordedRequest[] {
  return fetchMock.mock.calls
    .filter((call) => !String(call[0]).startsWith(TOKEN_URL))
    .map((call) => ({
      url: String(call[0]),
      body: JSON.parse(String((call[1] as RequestInit).body ?? "{}")) as Record<
        string,
        unknown
      >,
    }));
}

const twoLineOrder: BCCreateSalesOrderParams = {
  customerNumber: "579000283084",
  externalDocumentNumber: "NKT004061",
  orderDate: "2026-08-26",
  email: "orders@example.com",
  shipTo: {
    name: "JK Tryk",
    contact: "3. Parts Nimbus",
    addressLine1: "Industrikrogen 11B",
    city: "Rønnede",
    postCode: "4683",
    country: "DK",
  },
  lines: [
    {
      lineNumber: 1,
      itemId: "11111111-1111-1111-1111-111111111111",
      quantity: 1,
      unitOfMeasureCode: "PCS",
      shipmentDate: "2026-09-01",
    },
    {
      lineNumber: 2,
      itemId: "33333333-3333-3333-3333-333333333333",
      quantity: 10,
    },
  ],
};

describe("BusinessCentralModuleService.createSalesOrder", () => {
  beforeEach(() => {
    process.env.BUSINESS_CENTRAL_DISCOVERY_URL = BASE_URL;
    process.env.BUSINESS_CENTRAL_CLIENT_ID =
      "00000000-0000-0000-0000-000000000001";
    process.env.BUSINESS_CENTRAL_CLIENT_SECRET = "client-secret";
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("TC-1: posts the header then one request per line", async () => {
    const fetchMock = mockBusinessCentral([
      headerResponse(),
      lineResponse(),
      lineResponse(),
    ]);
    const service = new BusinessCentralModuleService();

    await expect(service.createSalesOrder(twoLineOrder)).resolves.toEqual({
      id: SALES_ORDER_ID,
      number: "SO-001234",
      status: "Draft",
      acceptedLineNumbers: [1, 2],
      rejectedLines: [],
    });

    const requests = bcRequests(fetchMock);
    expect(requests).toHaveLength(3);
    expect(requests[0].url).toEqual(`${BASE_URL}/salesOrders`);
    expect(requests[1].url).toEqual(
      `${BASE_URL}/salesOrders(${SALES_ORDER_ID})/salesOrderLines`
    );
    expect(requests[2].url).toEqual(requests[1].url);
  });

  it("TC-2: maps header fields and sends no BC-owned header fields", async () => {
    const fetchMock = mockBusinessCentral([
      headerResponse(),
      lineResponse(),
      lineResponse(),
    ]);
    const service = new BusinessCentralModuleService();

    await service.createSalesOrder(twoLineOrder);

    const header = bcRequests(fetchMock)[0].body;
    expect(header).toMatchObject({
      customerNumber: "579000283084",
      externalDocumentNumber: "NKT004061",
      orderDate: "2026-08-26",
      email: "orders@example.com",
      shipToName: "JK Tryk",
      shipToContact: "3. Parts Nimbus",
      shipToAddressLine1: "Industrikrogen 11B",
      shipToCity: "Rønnede",
      shipToPostCode: "4683",
      shipToCountry: "DK",
    });

    for (const key of [
      "number",
      "id",
      "lines",
      "currencyCode",
      "salesperson",
      "pricesIncludeTax",
      "discountAmount",
    ]) {
      expect(Object.keys(header)).not.toContain(key);
    }
  });

  it("TC-3: sends lineType Item, the itemId, and nothing Business Central prices", async () => {
    const fetchMock = mockBusinessCentral([
      headerResponse(),
      lineResponse(),
      lineResponse(),
    ]);
    const service = new BusinessCentralModuleService();

    await service.createSalesOrder(twoLineOrder);

    expect(bcRequests(fetchMock)[1].body).toEqual({
      lineType: "Item",
      itemId: "11111111-1111-1111-1111-111111111111",
      quantity: 1,
      unitOfMeasureCode: "PCS",
      shipmentDate: "2026-09-01",
    });
  });

  it("TC-4: omits absent optional fields rather than sending nulls", async () => {
    const fetchMock = mockBusinessCentral([headerResponse(), lineResponse()]);
    const service = new BusinessCentralModuleService();

    await service.createSalesOrder({
      customerNumber: "C1",
      externalDocumentNumber: "EXT-1",
      lines: [{ lineNumber: 1, itemId: "item-guid", quantity: 1 }],
    });

    const requests = bcRequests(fetchMock);
    expect(Object.keys(requests[0].body)).toEqual([
      "customerNumber",
      "externalDocumentNumber",
    ]);
    expect(Object.keys(requests[1].body)).toEqual([
      "lineType",
      "itemId",
      "quantity",
    ]);
  });

  it("TC-5: collects a rejected line and still returns the BC order id", async () => {
    const fetchMock = mockBusinessCentral([
      headerResponse(),
      lineResponse(),
      lineResponse(400),
    ]);
    const service = new BusinessCentralModuleService();

    const result = await service.createSalesOrder(twoLineOrder);

    expect(result.id).toEqual(SALES_ORDER_ID);
    expect(result.acceptedLineNumbers).toEqual([1]);
    expect(result.rejectedLines).toEqual([
      {
        lineNumber: 2,
        message: "Business Central rejected the sales order line with status 400",
      },
    ]);
    expect(bcRequests(fetchMock)).toHaveLength(3);
  });

  it("TC-6: returns the BC order id even when every line is rejected", async () => {
    mockBusinessCentral([headerResponse(), lineResponse(400), lineResponse(400)]);
    const service = new BusinessCentralModuleService();

    const result = await service.createSalesOrder(twoLineOrder);

    expect(result.id).toEqual(SALES_ORDER_ID);
    expect(result.acceptedLineNumbers).toEqual([]);
    expect(result.rejectedLines.map((line) => line.lineNumber)).toEqual([1, 2]);
  });

  it("TC-7: throws a MedusaError on a definite header rejection and attempts no line", async () => {
    const fetchMock = mockBusinessCentral([headerResponse({}, 422)]);
    const service = new BusinessCentralModuleService();

    const error = await service.createSalesOrder(twoLineOrder).catch((e: unknown) => e);

    expect(error).not.toBeInstanceOf(BusinessCentralAmbiguousOutcomeError);
    expect((error as Error).message).toEqual(
      "Business Central sales order request failed with status 422"
    );
    expect(bcRequests(fetchMock)).toHaveLength(1);
  });

  it("TC-8: treats a created order with no id as an ambiguous outcome", async () => {
    mockBusinessCentral([headerResponse({ number: "SO-1", status: "Draft" })]);
    const service = new BusinessCentralModuleService();

    const error = await service.createSalesOrder(twoLineOrder).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(BusinessCentralAmbiguousOutcomeError);
    expect((error as BusinessCentralAmbiguousOutcomeError).idempotencyKey).toEqual(
      "NKT004061"
    );
  });

  it("TC-9: rejects invalid input without any request", async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock;
    const service = new BusinessCentralModuleService();

    await expect(
      service.createSalesOrder({ ...twoLineOrder, lines: [] })
    ).rejects.toThrow("at least one line");
    await expect(
      service.createSalesOrder({ ...twoLineOrder, customerNumber: "" })
    ).rejects.toThrow("customer number");
    await expect(
      service.createSalesOrder({ ...twoLineOrder, externalDocumentNumber: "" })
    ).rejects.toThrow("external document number");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("TC-10: uses a single token for the header and every line", async () => {
    const fetchMock = mockBusinessCentral([
      headerResponse(),
      lineResponse(),
      lineResponse(),
    ]);
    const service = new BusinessCentralModuleService();

    await service.createSalesOrder(twoLineOrder);

    const tokenCalls = fetchMock.mock.calls.filter((call) =>
      String(call[0]).startsWith(TOKEN_URL)
    );
    expect(tokenCalls).toHaveLength(1);

    for (const call of fetchMock.mock.calls.slice(1)) {
      const headers = (call[1] as RequestInit).headers as Record<string, string>;
      expect(headers.authorization).toEqual("Bearer access-token");
    }
  });

  it("TC-11: treats a 5xx header response as an ambiguous outcome", async () => {
    mockBusinessCentral([headerResponse({}, 503)]);
    const service = new BusinessCentralModuleService();

    const error = await service.createSalesOrder(twoLineOrder).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(BusinessCentralAmbiguousOutcomeError);
    expect((error as BusinessCentralAmbiguousOutcomeError).idempotencyKey).toEqual(
      "NKT004061"
    );
  });

  it("TC-12: treats a header request that never completes as an ambiguous outcome", async () => {
    const fetchMock = jest.fn();
    fetchMock.mockResolvedValueOnce(tokenResponse());
    fetchMock.mockRejectedValueOnce(new Error("socket hang up"));
    global.fetch = fetchMock;
    const service = new BusinessCentralModuleService();

    await expect(service.createSalesOrder(twoLineOrder)).rejects.toBeInstanceOf(
      BusinessCentralAmbiguousOutcomeError
    );
    expect(bcRequests(fetchMock)).toHaveLength(1);
  });

  it("TC-13: sends the currency override when one is given", async () => {
    const fetchMock = mockBusinessCentral([
      headerResponse(),
      lineResponse(),
      lineResponse(),
    ]);
    const service = new BusinessCentralModuleService();

    await service.createSalesOrder({ ...twoLineOrder, currencyCode: "EUR" });

    expect(bcRequests(fetchMock)[0].body.currencyCode).toEqual("EUR");
  });
});
