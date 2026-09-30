import BusinessCentralModuleService from "../service";

const originalFetch = global.fetch;
const originalLcyCode = process.env.BUSINESS_CENTRAL_LCY_CODE;
const COMPANY_ID = "00000000-0000-0000-0000-0000000000c1";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

function mockReturnResponse(body: unknown, status = 200): jest.Mock {
  const fetchMock = jest
    .fn()
    .mockResolvedValueOnce(jsonResponse({ access_token: "access-token" }))
    .mockResolvedValueOnce(jsonResponse(body, status));
  global.fetch = fetchMock;
  return fetchMock;
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
    const fetchMock = mockReturnResponse({ value: [rawReturnOrder()] });
    const service = new BusinessCentralModuleService();

    await expect(
      service.getReturn({ customerNumber: "10000", returnNumber: "31502910" })
    ).resolves.toEqual({
      id: "return-1",
      number: "31502910",
      documentDate: "2026-09-27",
      status: "Pending Approval",
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
    });
    // Token + one data call; no customer-GUID or company-name lookups.
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  // TC-2: wiring — Abakion endpoint, customer-scoped filter, $top=1, $select and $expand.
  it("queries the customer-portal salesReturnOrders scoped to the customer number", async () => {
    const fetchMock = mockReturnResponse({ value: [] });
    const service = new BusinessCentralModuleService();

    await service.getReturn({ customerNumber: "10000", returnNumber: "RO'1" });

    const requestUrl = new URL(fetchMock.mock.calls[1][0] as string);
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

  // TC-3: edge case — foreign, unknown or already-processed returns come back empty → null.
  it("returns null when no open return order matches the number and customer", async () => {
    mockReturnResponse({ value: [] });
    const service = new BusinessCentralModuleService();

    await expect(
      service.getReturn({ customerNumber: "10000", returnNumber: "99999999" })
    ).resolves.toBeNull();
  });

  // TC-4: error condition — a non-OK BC response throws.
  it("throws when the return order request fails", async () => {
    mockReturnResponse({}, 500);
    const service = new BusinessCentralModuleService();

    await expect(
      service.getReturn({ customerNumber: "10000", returnNumber: "31502910" })
    ).rejects.toThrow("Business Central return order request failed with status 500");
  });

  // TC-5: edge case — prices incl. VAT gives no net figure; explicit currency is kept.
  it("omits the excluding-tax credit when prices include VAT and keeps a foreign currency", async () => {
    mockReturnResponse({
      value: [rawReturnOrder({ currencyCode: "SEK", pricesIncludingVAT: true })],
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
    mockReturnResponse({
      value: [
        rawReturnOrder({
          salesReturnOrderLines: [
            { id: "a", sequence: 10000, lineType: "Item", lineAmount: 0.1, amountIncludingTax: 0.1 },
            { id: "b", sequence: 20000, lineType: "Item", lineAmount: 0.2, amountIncludingTax: 0.2 },
          ],
        }),
      ],
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
});
