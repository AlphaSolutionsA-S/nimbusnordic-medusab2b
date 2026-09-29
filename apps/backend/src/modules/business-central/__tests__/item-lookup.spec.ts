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
    const duplicate = { ...NIMBUS_ITEM, id: "22222222-2222-2222-2222-222222222222" };
    mockBusinessCentral([
      itemsResponse([NIMBUS_ITEM, duplicate]),
      itemsResponse([NIMBUS_ITEM]),
    ]);
    const service = new BusinessCentralModuleService();

    const results = await service.findItemsForOrderLines([
      {
        lineNumber: 1,
        eanNo: "5712094145752",
        itemNumber: "FLS-NIM-VESPERMNA-XL",
      },
    ]);

    expect(results[0]).toMatchObject({ matched: true, matchedBy: "itemNumber" });
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
    const duplicate = { ...NIMBUS_ITEM, id: "22222222-2222-2222-2222-222222222222" };
    mockBusinessCentral([
      itemsResponse([NIMBUS_ITEM, duplicate]),
      itemsResponse([NIMBUS_ITEM, duplicate]),
    ]);
    const service = new BusinessCentralModuleService();

    const results = await service.findItemsForOrderLines([
      {
        lineNumber: 1,
        eanNo: "5712094145752",
        itemNumber: "FLS-NIM-VESPERMNA-XL",
      },
    ]);

    expect(results).toEqual([
      { lineNumber: 1, matched: false, reason: "ambiguous" },
    ]);
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
