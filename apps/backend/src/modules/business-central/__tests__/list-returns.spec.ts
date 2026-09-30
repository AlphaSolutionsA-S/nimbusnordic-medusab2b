import BusinessCentralModuleService from "../service";

const originalFetch = global.fetch;
const COMPANY_ID = "00000000-0000-0000-0000-0000000000c1";

type MockReply = { body: unknown; status?: number };

type BcRoutes = {
  openReturns?: MockReply;
  receipts?: MockReply;
  lines?: MockReply;
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

function reply(route: MockReply | undefined): Response {
  return route ? jsonResponse(route.body, route.status) : jsonResponse({ value: [] });
}

function mockBc(routes: BcRoutes): jest.Mock {
  const fetchMock = jest.fn(async (input: string | URL) => {
    const url = new URL(String(input));

    if (url.hostname === "login.microsoftonline.com") {
      return jsonResponse({ access_token: "access-token" });
    }
    if (url.pathname.endsWith(`/companies(${COMPANY_ID})`)) {
      return jsonResponse({ name: "Nimbus Nordic A/S" });
    }
    if (url.pathname.endsWith("/salesReturnOrders()")) {
      return reply(routes.openReturns);
    }
    if (url.pathname.endsWith("/ODataV4/PostedReturnReceipt")) {
      return reply(routes.receipts);
    }
    if (url.pathname.endsWith("/ODataV4/PostedReturnReceiptReturnRcptLines")) {
      return reply(routes.lines);
    }

    throw new Error(`Unexpected Business Central request: ${url.toString()}`);
  });

  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

function requestsTo(fetchMock: jest.Mock, pathSuffix: string): URL[] {
  return fetchMock.mock.calls
    .map(([input]) => new URL(String(input)))
    .filter((url) => url.pathname.endsWith(pathSuffix));
}

// TestDK-shaped fixtures (NIMBUS-172 FEATURE.md technical notes).
const OPEN_RETURN = {
  id: "ro-guid-1",
  number: "31500002",
  documentDate: "2026-09-20",
  status: "Released",
  salesReturnOrderLines: [
    { id: "l1", lineType: "Item" },
    { id: "l2", lineType: "Item" },
    { id: "l3", lineType: "_x0020_" },
  ],
};

const RECEIPTS = [
  // Partial receipt of the still-open return order.
  { No: "30700010", Return_Order_No: "31500002", External_Document_No: "RET-3f2a9c1b", Document_Date: "2026-09-25" },
  // Two receipts of a return order that is no longer open (processed).
  { No: "30700005", Return_Order_No: "31400001", External_Document_No: "", Document_Date: "2026-08-10" },
  { No: "30700007", Return_Order_No: "31400001", External_Document_No: "", Document_Date: "2026-08-15" },
  // Receipt without a return order (stand-alone processed row).
  { No: "30700003", Return_Order_No: "", External_Document_No: "AX 209475", Document_Date: "2026-09-28" },
];

const LINES = [
  { Document_No: "30700005", Type: "Item", No: "FVIE-M-BLACK", Variant_Code: "XL", Quantity: 1 },
  { Document_No: "30700007", Type: "Item", No: "FVIE-M-BLACK", Variant_Code: "XL", Quantity: 1 },
  { Document_No: "30700007", Type: "Item", No: "F2", Variant_Code: "", Quantity: 0 },
  { Document_No: "30700007", Type: "_x0020_", No: "", Variant_Code: "", Quantity: 0 },
  { Document_No: "30700003", Type: "Item", No: "A1", Variant_Code: "", Quantity: 2 },
];

function mockTestDkShape(): jest.Mock {
  return mockBc({
    openReturns: { body: { value: [OPEN_RETURN] } },
    receipts: { body: { value: RECEIPTS } },
    lines: { body: { value: LINES } },
  });
}

describe("BusinessCentralModuleService.listReturns", () => {
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

  // TC-11
  it("merges open return orders and posted receipts into one list sorted by latest activity", async () => {
    mockTestDkShape();
    const service = new BusinessCentralModuleService();

    const result = await service.listReturns({ customerNumber: "10000", limit: 20, offset: 0 });

    expect(result).toEqual({
      returns: [
        {
          id: "posted-receipt:30700003",
          number: "30700003",
          documentDate: "2026-09-28",
          status: "",
          state: "processed",
          source: "posted_receipt",
          itemCount: 1,
          receipts: [
            { number: "30700003", receivedDate: "2026-09-28", externalDocumentNumber: "AX 209475" },
          ],
        },
        {
          id: "ro-guid-1",
          number: "31500002",
          documentDate: "2026-09-20",
          status: "Released",
          state: "open",
          source: "return_order",
          itemCount: 2,
          receipts: [
            { number: "30700010", receivedDate: "2026-09-25", externalDocumentNumber: "RET-3f2a9c1b" },
          ],
        },
        {
          id: "return-order:31400001",
          number: "31400001",
          documentDate: "2026-08-15",
          status: "",
          state: "processed",
          source: "return_order",
          itemCount: 1,
          receipts: [
            { number: "30700005", receivedDate: "2026-08-10", externalDocumentNumber: "" },
            { number: "30700007", receivedDate: "2026-08-15", externalDocumentNumber: "" },
          ],
        },
      ],
      count: 3,
      offset: 0,
      limit: 20,
    });
  });

  // TC-12
  it("scopes both BC sources to the session's customer and selects only display fields", async () => {
    const fetchMock = mockTestDkShape();
    const service = new BusinessCentralModuleService();

    await service.listReturns({ customerNumber: "10000", limit: 20, offset: 0 });

    const [openReturnsUrl] = requestsTo(fetchMock, "/salesReturnOrders()");
    expect(openReturnsUrl.searchParams.get("$filter")).toBe("sellToCustomerNumber eq '10000'");
    expect(openReturnsUrl.searchParams.get("$select")).toBe("id,number,documentDate,status");
    expect(openReturnsUrl.searchParams.get("$expand")).toBe(
      "salesReturnOrderLines($select=id,lineType)"
    );
    expect(openReturnsUrl.searchParams.get("$orderby")).toBe("documentDate desc");

    const [receiptsUrl] = requestsTo(fetchMock, "/ODataV4/PostedReturnReceipt");
    expect(`${receiptsUrl.origin}${receiptsUrl.pathname}`).toBe(
      "https://api.businesscentral.dynamics.com/v2.0/tenant-id/Sandbox/ODataV4/PostedReturnReceipt"
    );
    expect(receiptsUrl.searchParams.get("company")).toBe("'Nimbus Nordic A/S'");
    expect(receiptsUrl.searchParams.get("$filter")).toBe("Sell_to_Customer_No eq '10000'");
    expect(receiptsUrl.searchParams.get("$orderby")).toBe("Document_Date desc");
    const select = receiptsUrl.searchParams.get("$select");
    expect(select).toBe("No,Return_Order_No,External_Document_No,Document_Date");
    for (const personalField of ["Name", "Address", "Phone", "E_Mail"]) {
      expect(select).not.toContain(personalField);
    }
  });

  // TC-13
  it("reads receipt lines only for the processed rows on the page", async () => {
    const fetchMock = mockTestDkShape();
    const service = new BusinessCentralModuleService();

    await service.listReturns({ customerNumber: "10000", limit: 20, offset: 0 });

    const linesRequests = requestsTo(fetchMock, "/ODataV4/PostedReturnReceiptReturnRcptLines");
    expect(linesRequests).toHaveLength(1);
    const filter = linesRequests[0].searchParams.get("$filter") ?? "";
    expect(filter.split(" or ").sort()).toEqual([
      "Document_No eq '30700003'",
      "Document_No eq '30700005'",
      "Document_No eq '30700007'",
    ]);
    expect(filter).not.toContain("30700010");
    expect(linesRequests[0].searchParams.get("$select")).toBe(
      "Document_No,Type,No,Variant_Code,Quantity"
    );
    expect(linesRequests[0].searchParams.get("company")).toBe("'Nimbus Nordic A/S'");
  });

  // TC-14
  it("makes no lines request when the page has only open rows", async () => {
    const fetchMock = mockTestDkShape();
    const service = new BusinessCentralModuleService();

    const result = await service.listReturns({
      customerNumber: "10000",
      limit: 20,
      offset: 0,
      state: "open",
    });

    expect(result.returns.map((row) => row.number)).toEqual(["31500002"]);
    expect(result.count).toBe(1);
    expect(requestsTo(fetchMock, "/ODataV4/PostedReturnReceiptReturnRcptLines")).toHaveLength(0);
  });

  // TC-15
  it("pages after the merge and returns the filtered total as count", async () => {
    const fetchMock = mockTestDkShape();
    const service = new BusinessCentralModuleService();

    const result = await service.listReturns({ customerNumber: "10000", limit: 1, offset: 1 });

    expect(result.returns.map((row) => row.number)).toEqual(["31500002"]);
    expect(result).toMatchObject({ count: 3, offset: 1, limit: 1 });
    expect(requestsTo(fetchMock, "/ODataV4/PostedReturnReceiptReturnRcptLines")).toHaveLength(0);
  });

  // TC-16
  it("filters by processed state, date range and receipt number", async () => {
    mockTestDkShape();
    const service = new BusinessCentralModuleService();

    const result = await service.listReturns({
      customerNumber: "10000",
      limit: 20,
      offset: 0,
      state: "processed",
      date_from: "2026-08-01",
      date_to: "2026-08-31",
      search: "30700007",
    });

    expect(result.returns.map((row) => row.number)).toEqual(["31400001"]);
    expect(result.count).toBe(1);
  });

  // TC-17
  it("propagates a posted receipts error", async () => {
    mockBc({ receipts: { body: {}, status: 500 } });
    const service = new BusinessCentralModuleService();

    await expect(
      service.listReturns({ customerNumber: "10000", limit: 20, offset: 0 })
    ).rejects.toThrow("Business Central posted return receipts request failed with status 500");
  });

  // TC-18
  it("propagates an open return orders error", async () => {
    mockBc({ openReturns: { body: {}, status: 500 } });
    const service = new BusinessCentralModuleService();

    await expect(
      service.listReturns({ customerNumber: "10000", limit: 20, offset: 0 })
    ).rejects.toThrow("Business Central returns request failed with status 500");
  });

  // TC-19
  it("returns an empty page for a customer with no returns", async () => {
    const fetchMock = mockBc({});
    const service = new BusinessCentralModuleService();

    const result = await service.listReturns({ customerNumber: "10000", limit: 20, offset: 0 });

    expect(result).toEqual({ returns: [], count: 0, offset: 0, limit: 20 });
    expect(requestsTo(fetchMock, "/ODataV4/PostedReturnReceiptReturnRcptLines")).toHaveLength(0);
  });

  // TC-20
  it("decodes XML-encoded status values and counts 0 items when lines are missing", async () => {
    mockBc({
      openReturns: {
        body: {
          value: [
            {
              id: "return-2",
              number: "RET-1001",
              documentDate: "2026-08-02",
              status: "Pending_x0020_Approval",
            },
          ],
        },
      },
    });
    const service = new BusinessCentralModuleService();

    const result = await service.listReturns({ customerNumber: "10000", limit: 20, offset: 0 });

    expect(result.returns[0]).toMatchObject({
      status: "Pending Approval",
      itemCount: 0,
      state: "open",
      receipts: [],
    });
  });

  // TC-21
  it("escapes the customer number and chunks line filters in groups of 20", async () => {
    const receipts = Array.from({ length: 25 }, (_, index) => ({
      No: `R${String(index + 1).padStart(2, "0")}`,
      Return_Order_No: "",
      External_Document_No: "",
      Document_Date: "2026-09-01",
    }));
    const fetchMock = mockBc({ receipts: { body: { value: receipts } } });
    const service = new BusinessCentralModuleService();

    await service.listReturns({ customerNumber: "10'00", limit: 25, offset: 0 });

    const [receiptsUrl] = requestsTo(fetchMock, "/ODataV4/PostedReturnReceipt");
    expect(receiptsUrl.searchParams.get("$filter")).toBe("Sell_to_Customer_No eq '10''00'");

    const termCounts = requestsTo(fetchMock, "/ODataV4/PostedReturnReceiptReturnRcptLines")
      .map((url) => (url.searchParams.get("$filter") ?? "").split("Document_No eq").length - 1)
      .sort((left, right) => right - left);
    expect(termCounts).toEqual([20, 5]);
  });
});
