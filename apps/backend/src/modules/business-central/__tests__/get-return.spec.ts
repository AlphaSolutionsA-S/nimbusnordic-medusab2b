import BusinessCentralModuleService from "../service";

const originalFetch = global.fetch;
const originalLcyCode = process.env.BUSINESS_CENTRAL_LCY_CODE;
const COMPANY_ID = "00000000-0000-0000-0000-0000000000c1";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

type MockReply = { body: unknown; status?: number };

type BcRoutes = {
  returnOrder?: MockReply;
  receiptsByReturnOrder?: MockReply;
  receiptsByNumber?: MockReply;
  lines?: MockReply;
};

function reply(route: MockReply | undefined): Response {
  return route ? jsonResponse(route.body, route.status) : jsonResponse({ value: [] });
}

function mockBc(routes: BcRoutes): jest.Mock {
  const fetchMock = jest.fn(async (input: string | URL) => {
    const url = new URL(String(input));

    if (url.hostname === "login.microsoftonline.com") {
      return jsonResponse({ access_token: "access-token" });
    }
    if (url.pathname.endsWith(`/api/v2.0/companies(${COMPANY_ID})`)) {
      return jsonResponse({ name: "Nimbus Nordic A/S" });
    }
    if (url.pathname.endsWith("/salesReturnOrders")) {
      return reply(routes.returnOrder);
    }
    if (url.pathname.endsWith("/ODataV4/PostedReturnReceipt")) {
      // Check Return_Order_No first: "Return_Order_No eq" also contains "No eq".
      return (url.searchParams.get("$filter") ?? "").includes("Return_Order_No eq")
        ? reply(routes.receiptsByReturnOrder)
        : reply(routes.receiptsByNumber);
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

// Shape of TestDK return order 31502910 (verified 2026-09-29), trimmed to the selected fields.
function rawReturnOrder(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "return-1",
    number: "31502910",
    documentDate: "2026-09-27",
    status: "Pending_x0020_Approval",
    currencyCode: "",
    pricesIncludingVAT: false,
    salesReturnOrderLines: [
      {
        id: "line-60000",
        sequence: 60000,
        lineType: "Item",
        lineObjectNumber: "F2",
        variantCode: "",
        description: "Small Freight",
        unitOfMeasureCode: "PCS",
        quantity: 1,
        returnQtyReceived: 0,
        returnReasonCode: "NORMAL",
        lineAmount: 50,
        amountIncludingTax: 62.5,
      },
      {
        id: "line-10000",
        sequence: 10000,
        lineType: "_x0020_",
        lineObjectNumber: "",
        variantCode: "",
        description: "Fakturanr. SIN47206:",
        unitOfMeasureCode: "",
        quantity: 0,
        returnQtyReceived: 0,
        returnReasonCode: "",
        lineAmount: 0,
        amountIncludingTax: 0,
      },
      {
        id: "line-30000",
        sequence: 30000,
        lineType: "Item",
        lineObjectNumber: "FVIE-M-BLACK",
        variantCode: "XL",
        description: "Fjeld Vest",
        unitOfMeasureCode: "PCS",
        quantity: 2,
        returnQtyReceived: 1,
        returnReasonCode: "NORMAL",
        lineAmount: 1229,
        amountIncludingTax: 1536.25,
      },
    ],
    ...overrides,
  };
}

const RECEIPT_HEADERS_31502910 = [
  { No: "30700012", Return_Order_No: "31502910", External_Document_No: "RET-3f2a9c1b", Document_Date: "2026-09-29" },
  { No: "30700011", Return_Order_No: "31502910", External_Document_No: "", Document_Date: "2026-09-28" },
];

const RECEIPT_LINES_31502910 = [
  { Document_No: "30700011", Line_No: 30000, Type: "Item", No: "FVIE-M-BLACK", Variant_Code: "XL", Description: "Fjeld Vest", Quantity: 1, Unit_of_Measure_Code: "PCS", Return_Reason_Code: "NORMAL" },
  { Document_No: "30700011", Line_No: 10000, Type: "_x0020_", No: "", Variant_Code: "", Description: "Fakturanr. SIN47206:", Quantity: 0, Unit_of_Measure_Code: "", Return_Reason_Code: "" },
  { Document_No: "30700011", Line_No: 60000, Type: "Item", No: "F2", Variant_Code: "", Description: "Small Freight", Quantity: 0, Unit_of_Measure_Code: "PCS", Return_Reason_Code: "NORMAL" },
  { Document_No: "30700012", Line_No: 30000, Type: "Item", No: "FVIE-M-BLACK", Variant_Code: "XL", Description: "Fjeld Vest", Quantity: 1, Unit_of_Measure_Code: "PCS", Return_Reason_Code: "DAMAGED" },
];

// The text line and the zero-quantity F2 line are dropped; oldest receipt first.
const EXPECTED_RECEIPTS_31502910 = [
  {
    number: "30700011",
    receivedDate: "2026-09-28",
    externalDocumentNumber: "",
    lines: [
      { lineNumber: 30000, itemNumber: "FVIE-M-BLACK", variantCode: "XL", description: "Fjeld Vest", quantity: 1, unitOfMeasureCode: "PCS", returnReasonCode: "NORMAL" },
    ],
  },
  {
    number: "30700012",
    receivedDate: "2026-09-29",
    externalDocumentNumber: "RET-3f2a9c1b",
    lines: [
      { lineNumber: 30000, itemNumber: "FVIE-M-BLACK", variantCode: "XL", description: "Fjeld Vest", quantity: 1, unitOfMeasureCode: "PCS", returnReasonCode: "DAMAGED" },
    ],
  },
];

describe("BusinessCentralModuleService.getReturn", () => {
  beforeEach(() => {
    process.env.BUSINESS_CENTRAL_DISCOVERY_URL =
      "https://api.businesscentral.dynamics.com/v2.0/tenant-id/Sandbox/api/v2.0";
    process.env.BUSINESS_CENTRAL_CLIENT_ID = "00000000-0000-0000-0000-000000000001";
    process.env.BUSINESS_CENTRAL_CLIENT_SECRET = "client-secret";
    process.env.BUSINESS_CENTRAL_COMPANY_ID = COMPANY_ID;
    delete process.env.BUSINESS_CENTRAL_LCY_CODE;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    if (originalLcyCode === undefined) {
      delete process.env.BUSINESS_CENTRAL_LCY_CODE;
    } else {
      process.env.BUSINESS_CENTRAL_LCY_CODE = originalLcyCode;
    }
  });

  // TC-1: happy path — maps header, sorted item lines without prices, and the expected credit.
  it("maps the return order, drops text lines and sums the expected credit", async () => {
    const fetchMock = mockBc({ returnOrder: { body: { value: [rawReturnOrder()] } } });
    const service = new BusinessCentralModuleService();

    await expect(
      service.getReturn({ customerNumber: "10000", returnNumber: "31502910" })
    ).resolves.toEqual({
      id: "return-1",
      number: "31502910",
      documentDate: "2026-09-27",
      status: "Pending Approval",
      state: "open",
      source: "return_order",
      lines: [
        {
          id: "line-30000",
          sequence: 30000,
          lineType: "Item",
          itemNumber: "FVIE-M-BLACK",
          variantCode: "XL",
          description: "Fjeld Vest",
          unitOfMeasureCode: "PCS",
          quantity: 2,
          quantityReceived: 1,
          returnReasonCode: "NORMAL",
        },
        {
          id: "line-60000",
          sequence: 60000,
          lineType: "Item",
          itemNumber: "F2",
          variantCode: "",
          description: "Small Freight",
          unitOfMeasureCode: "PCS",
          quantity: 1,
          quantityReceived: 0,
          returnReasonCode: "NORMAL",
        },
      ],
      expectedCredit: {
        currencyCode: "DKK",
        amountIncludingTax: 1598.75,
        amountExcludingTax: 1279,
      },
      receipts: [],
    });
    // No receipts, so no receipt lines request.
    expect(requestsTo(fetchMock, "/ODataV4/PostedReturnReceiptReturnRcptLines")).toHaveLength(0);
  });

  // TC-2: wiring — Abakion endpoint, customer-scoped filter, $top=1, $select and $expand.
  it("queries the customer-portal salesReturnOrders scoped to the customer number", async () => {
    const fetchMock = mockBc({ returnOrder: { body: { value: [] } } });
    const service = new BusinessCentralModuleService();

    await service.getReturn({ customerNumber: "10000", returnNumber: "RO'1" });

    const [requestUrl] = requestsTo(fetchMock, "/salesReturnOrders");
    expect(`${requestUrl.origin}${requestUrl.pathname}`).toBe(
      `https://api.businesscentral.dynamics.com/v2.0/tenant-id/Sandbox/api/abakion/customerPortal/v2.0/companies(${COMPANY_ID})/salesReturnOrders`
    );
    expect(requestUrl.searchParams.get("$filter")).toBe(
      "number eq 'RO''1' and sellToCustomerNumber eq '10000'"
    );
    expect(requestUrl.searchParams.get("$top")).toBe("1");
    expect(requestUrl.searchParams.get("$select")).toBe(
      "id,number,documentDate,status,currencyCode,pricesIncludingVAT"
    );
    expect(requestUrl.searchParams.get("$expand")).toBe(
      "salesReturnOrderLines($select=id,sequence,lineType,lineObjectNumber,variantCode,description,unitOfMeasureCode,quantity,returnQtyReceived,returnReasonCode,lineAmount,amountIncludingTax)"
    );
    expect(requestUrl.searchParams.get("$select")).not.toContain("externalDocumentNumber");
  });

  // TC-3: edge case — foreign or unknown returns (no return order, no receipts) → null.
  it("returns null when no open return order matches the number and customer", async () => {
    mockBc({ returnOrder: { body: { value: [] } } });
    const service = new BusinessCentralModuleService();

    await expect(
      service.getReturn({ customerNumber: "10000", returnNumber: "99999999" })
    ).resolves.toBeNull();
  });

  // TC-4: error condition — a non-OK BC response throws.
  it("throws when the return order request fails", async () => {
    mockBc({ returnOrder: { body: {}, status: 500 } });
    const service = new BusinessCentralModuleService();

    await expect(
      service.getReturn({ customerNumber: "10000", returnNumber: "31502910" })
    ).rejects.toThrow("Business Central return order request failed with status 500");
  });

  // TC-5: edge case — prices incl. VAT gives no net figure; explicit currency is kept.
  it("omits the excluding-tax credit when prices include VAT and keeps a foreign currency", async () => {
    mockBc({
      returnOrder: {
        body: { value: [rawReturnOrder({ currencyCode: "SEK", pricesIncludingVAT: true })] },
      },
    });
    const service = new BusinessCentralModuleService();

    const result = await service.getReturn({
      customerNumber: "10000",
      returnNumber: "31502910",
    });

    expect(result?.expectedCredit).toEqual({
      currencyCode: "SEK",
      amountIncludingTax: 1598.75,
      amountExcludingTax: null,
    });
  });

  // TC-6: edge case — blank currency honours BUSINESS_CENTRAL_LCY_CODE; sums are rounded.
  it("resolves a blank currency to BUSINESS_CENTRAL_LCY_CODE and rounds the sums", async () => {
    process.env.BUSINESS_CENTRAL_LCY_CODE = "NOK";
    mockBc({
      returnOrder: {
        body: {
          value: [
            rawReturnOrder({
              salesReturnOrderLines: [
                { id: "a", sequence: 10000, lineType: "Item", lineAmount: 0.1, amountIncludingTax: 0.1 },
                { id: "b", sequence: 20000, lineType: "Item", lineAmount: 0.2, amountIncludingTax: 0.2 },
              ],
            }),
          ],
        },
      },
    });
    const service = new BusinessCentralModuleService();

    const result = await service.getReturn({
      customerNumber: "10000",
      returnNumber: "31502910",
    });

    expect(result?.expectedCredit).toEqual({
      currencyCode: "NOK",
      amountIncludingTax: 0.3,
      amountExcludingTax: 0.3,
    });
    expect(result?.lines).toHaveLength(2);
    expect(result?.lines[0]).toEqual({
      id: "a",
      sequence: 10000,
      lineType: "Item",
      itemNumber: "",
      variantCode: "",
      description: "",
      unitOfMeasureCode: "",
      quantity: 0,
      quantityReceived: 0,
      returnReasonCode: "",
    });
  });
  // TC-7 (NIMBUS-172): an open return order with partial receipts keeps its detail.
  it("keeps the open detail and lists the partial receipts of an open return order", async () => {
    mockBc({
      returnOrder: { body: { value: [rawReturnOrder()] } },
      receiptsByReturnOrder: { body: { value: RECEIPT_HEADERS_31502910 } },
      lines: { body: { value: RECEIPT_LINES_31502910 } },
    });
    const service = new BusinessCentralModuleService();

    const result = await service.getReturn({ customerNumber: "10000", returnNumber: "31502910" });

    expect(result).toMatchObject({
      state: "open",
      source: "return_order",
      status: "Pending Approval",
      expectedCredit: {
        currencyCode: "DKK",
        amountIncludingTax: 1598.75,
        amountExcludingTax: 1279,
      },
    });
    expect(result?.receipts).toEqual(EXPECTED_RECEIPTS_31502910);
  });

  // TC-8 (NIMBUS-172): a return order that is no longer open is returned as processed.
  it("returns a return order that is no longer open as processed", async () => {
    mockBc({
      returnOrder: { body: { value: [] } },
      receiptsByReturnOrder: { body: { value: RECEIPT_HEADERS_31502910 } },
      lines: { body: { value: RECEIPT_LINES_31502910 } },
    });
    const service = new BusinessCentralModuleService();

    await expect(
      service.getReturn({ customerNumber: "10000", returnNumber: "31502910" })
    ).resolves.toEqual({
      id: "return-order:31502910",
      number: "31502910",
      documentDate: "2026-09-29",
      status: "",
      state: "processed",
      source: "return_order",
      lines: [],
      expectedCredit: null,
      receipts: EXPECTED_RECEIPTS_31502910,
    });
  });

  // TC-9 (NIMBUS-172): a stand-alone receipt is opened by its receipt number.
  it("opens a stand-alone receipt by its receipt number", async () => {
    mockBc({
      receiptsByNumber: {
        body: {
          value: [
            { No: "30700003", Return_Order_No: "", External_Document_No: "AX 209475", Document_Date: "2026-09-28" },
          ],
        },
      },
      lines: {
        body: {
          value: [
            { Document_No: "30700003", Line_No: 10000, Type: "Item", No: "A1", Variant_Code: "", Description: "Anorak", Quantity: 2, Unit_of_Measure_Code: "PCS", Return_Reason_Code: "NORMAL" },
          ],
        },
      },
    });
    const service = new BusinessCentralModuleService();

    const result = await service.getReturn({ customerNumber: "10000", returnNumber: "30700003" });

    expect(result).toMatchObject({
      id: "posted-receipt:30700003",
      source: "posted_receipt",
      state: "processed",
    });
    expect(result?.receipts[0].externalDocumentNumber).toBe("AX 209475");
    expect(result?.receipts[0].lines).toHaveLength(1);
  });

  // TC-10 (NIMBUS-172): a receipt that belongs to a return order is not opened on its own.
  it("returns null for a receipt number whose receipt belongs to a return order", async () => {
    const fetchMock = mockBc({
      receiptsByNumber: {
        body: {
          value: [
            { No: "30700011", Return_Order_No: "31502910", External_Document_No: "", Document_Date: "2026-09-28" },
          ],
        },
      },
    });
    const service = new BusinessCentralModuleService();

    await expect(
      service.getReturn({ customerNumber: "10000", returnNumber: "30700011" })
    ).resolves.toBeNull();
    expect(requestsTo(fetchMock, "/ODataV4/PostedReturnReceiptReturnRcptLines")).toHaveLength(0);
  });

  // TC-11 (NIMBUS-172): every receipt query is customer-scoped and selects display fields only.
  it("scopes both receipt queries to the customer and selects only display fields", async () => {
    const fetchMock = mockBc({});
    const service = new BusinessCentralModuleService();

    await expect(
      service.getReturn({ customerNumber: "10'00", returnNumber: "RO'1" })
    ).resolves.toBeNull();

    const receiptRequests = requestsTo(fetchMock, "/ODataV4/PostedReturnReceipt");
    expect(receiptRequests).toHaveLength(2);
    expect(receiptRequests.map((url) => url.searchParams.get("$filter")).sort()).toEqual(
      [
        "Sell_to_Customer_No eq '10''00' and Return_Order_No eq 'RO''1'",
        "Sell_to_Customer_No eq '10''00' and No eq 'RO''1'",
      ].sort()
    );
    for (const url of receiptRequests) {
      expect(url.searchParams.get("$select")).toBe(
        "No,Return_Order_No,External_Document_No,Document_Date"
      );
      expect(url.searchParams.get("company")).toBe("'Nimbus Nordic A/S'");
    }
  });

  // TC-12 (NIMBUS-172): the lines request uses the detail fields and only the found receipts.
  it("requests the detail line fields for the found receipts only", async () => {
    const fetchMock = mockBc({
      returnOrder: { body: { value: [] } },
      receiptsByReturnOrder: { body: { value: RECEIPT_HEADERS_31502910 } },
      lines: { body: { value: RECEIPT_LINES_31502910 } },
    });
    const service = new BusinessCentralModuleService();

    await service.getReturn({ customerNumber: "10000", returnNumber: "31502910" });

    const linesRequests = requestsTo(fetchMock, "/ODataV4/PostedReturnReceiptReturnRcptLines");
    expect(linesRequests).toHaveLength(1);
    const filter = linesRequests[0].searchParams.get("$filter") ?? "";
    expect(filter).toContain("Document_No eq '30700012'");
    expect(filter).toContain("Document_No eq '30700011'");
    expect(filter).toContain(" or ");
    expect(linesRequests[0].searchParams.get("$select")).toBe(
      "Document_No,Line_No,Type,No,Variant_Code,Description,Quantity,Unit_of_Measure_Code,Return_Reason_Code"
    );
  });

  // TC-13 (NIMBUS-172): a posted receipts error propagates.
  it("throws when the posted receipts request fails", async () => {
    mockBc({ receiptsByReturnOrder: { body: {}, status: 500 } });
    const service = new BusinessCentralModuleService();

    await expect(
      service.getReturn({ customerNumber: "10000", returnNumber: "31502910" })
    ).rejects.toThrow("Business Central posted return receipts request failed with status 500");
  });
});
