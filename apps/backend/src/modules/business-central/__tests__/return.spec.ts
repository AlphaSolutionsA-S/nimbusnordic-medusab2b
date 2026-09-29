import { MedusaError } from "@medusajs/framework/utils";

import BusinessCentralModuleService, {
  BusinessCentralAmbiguousOutcomeError,
} from "../service";

const originalFetch = global.fetch;
const COMPANY_ID = "00000000-0000-0000-0000-0000000000c1";

const params = {
  requestId: "RET-123456",
  sourceOrderNo: "SO-1000",
  lines: [
    {
      sourceLineNo: 10000,
      quantityToReturn: 2,
      returnReasonCode: "NORMAL",
    },
  ],
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

function mockFetch(...responses: Array<Response | Error>): jest.Mock {
  const fetchMock = jest.fn();
  fetchMock
    .mockResolvedValueOnce(jsonResponse({ access_token: "access-token" }))
    .mockResolvedValueOnce(jsonResponse({ id: COMPANY_ID, name: "Nimbus Nordic A/S" }));

  for (const response of responses) {
    if (response instanceof Error) {
      fetchMock.mockRejectedValueOnce(response);
    } else {
      fetchMock.mockResolvedValueOnce(response);
    }
  }

  global.fetch = fetchMock;
  return fetchMock;
}

beforeEach(() => {
  process.env.BUSINESS_CENTRAL_DISCOVERY_URL =
    "https://api.businesscentral.dynamics.com/v2.0/tenant-id/Sandbox/api/v2.0";
  process.env.BUSINESS_CENTRAL_CLIENT_ID = "00000000-0000-0000-0000-000000000001";
  process.env.BUSINESS_CENTRAL_CLIENT_SECRET = "client-secret";
  process.env.BUSINESS_CENTRAL_COMPANY_ID = COMPANY_ID;
});

afterEach(() => {
  global.fetch = originalFetch;
});

describe("BusinessCentralModuleService.createReturnFromSalesOrder", () => {
  it("posts the return to the ODataV4 action with lines as a JSON string", async () => {
    const fetchMock = mockFetch(jsonResponse({ value: "RO-0001" }));
    const service = new BusinessCentralModuleService();

    await expect(service.createReturnFromSalesOrder(params)).resolves.toEqual({
      id: "RO-0001",
      number: "RO-0001",
      status: "Open",
      requestId: "RET-123456",
      sourceOrderNo: "SO-1000",
      lines: params.lines,
    });

    expect(fetchMock.mock.calls[1][0]).toBe(
      `https://api.businesscentral.dynamics.com/v2.0/tenant-id/Sandbox/api/v2.0/companies(${COMPANY_ID})`
    );

    const [actionUrl, init] = fetchMock.mock.calls[2];
    const url = new URL(actionUrl);
    expect(url.origin + url.pathname).toBe(
      "https://api.businesscentral.dynamics.com/v2.0/tenant-id/Sandbox/ODataV4/CustomerPortalReturns_CreateReturnOrder"
    );
    expect(url.searchParams.get("company")).toBe("'Nimbus Nordic A/S'");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({
      requestId: "RET-123456",
      sourceOrderNo: "SO-1000",
      lines: JSON.stringify(params.lines),
    });
  });

  it("maps a BC business-rule rejection to a customer-safe INVALID_DATA error", async () => {
    mockFetch(
      jsonResponse({ error: { code: "Internal_Error", message: "Line 10000 already returned" } }, 400)
    );
    const service = new BusinessCentralModuleService();

    const error = await service.createReturnFromSalesOrder(params).catch((e) => e);

    expect(error).toBeInstanceOf(MedusaError);
    expect(error.type).toBe(MedusaError.Types.INVALID_DATA);
    expect(error.message).not.toContain("10000");
  });

  it.each([
    ["a 5xx response", jsonResponse({}, 503)],
    ["a network failure or timeout", new Error("aborted")],
    ["a 2xx response without a return order", jsonResponse({ value: "" })],
  ])("treats %s as an ambiguous outcome", async (_label, response) => {
    mockFetch(response);
    const service = new BusinessCentralModuleService();

    const error = await service.createReturnFromSalesOrder(params).catch((e) => e);

    expect(error).toBeInstanceOf(BusinessCentralAmbiguousOutcomeError);
    expect(error.idempotencyKey).toBe("RET-123456");
  });

  it("rejects return requests without a line or a positive quantity", async () => {
    const service = new BusinessCentralModuleService();

    await expect(
      service.createReturnFromSalesOrder({ ...params, lines: [] })
    ).rejects.toThrow("at least one line");
    await expect(
      service.createReturnFromSalesOrder({
        ...params,
        lines: [{ ...params.lines[0], quantityToReturn: 0 }],
      })
    ).rejects.toThrow("positive quantity");
  });

  it("requires a company ID GUID", async () => {
    process.env.BUSINESS_CENTRAL_COMPANY_ID = "Nimbus Nordic A/S";
    mockFetch();
    const service = new BusinessCentralModuleService();

    await expect(service.createReturnFromSalesOrder(params)).rejects.toThrow(
      "BUSINESS_CENTRAL_COMPANY_ID"
    );
  });
});

describe("BusinessCentralModuleService.listReturnReasons", () => {
  it("maps enabled reason codes to unique return reasons", async () => {
    const fetchMock = mockFetch(
      jsonResponse({
        value: [
          { ReasonCode: "NORMAL", Description: "Normal return" },
          { ReasonCode: "NORMAL", Description: "Normal return" },
          { ReasonCode: "DAMAGED", Description: "" },
          { ReasonCode: "" },
        ],
      })
    );
    const service = new BusinessCentralModuleService();

    await expect(service.listReturnReasons()).resolves.toEqual([
      { id: "NORMAL", description: "Normal return" },
      { id: "DAMAGED", description: "DAMAGED" },
    ]);

    const url = new URL(fetchMock.mock.calls[2][0]);
    expect(url.pathname).toBe("/v2.0/tenant-id/Sandbox/ODataV4/CS_EnabledReasonCodes");
    expect(url.searchParams.get("company")).toBe("'Nimbus Nordic A/S'");
  });
});
