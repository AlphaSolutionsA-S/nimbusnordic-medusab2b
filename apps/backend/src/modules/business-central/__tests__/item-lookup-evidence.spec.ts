import BusinessCentralModuleService from "../service";

const originalFetch = global.fetch;
const COMPANY_ID = "00000000-0000-0000-0000-0000000000c1";
const COMPANY_NAME = "Nimbus Nordic A/S";
const VENDOR_BODY_TEXT = "vendor diagnostic text that must not leak";

type Route = (filter: string) => Response;

type BcRoutes = {
  itemsByGtin?: Route;
  references?: Route;
  itemsByNumber?: Route;
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

const emptyList: Route = () => jsonResponse({ value: [] });

function mockBc(routes: BcRoutes = {}): jest.Mock {
  const fetchMock = jest.fn(async (input: string | URL) => {
    const url = new URL(String(input));
    const filter = url.searchParams.get("$filter") ?? "";

    if (url.hostname === "login.microsoftonline.com") {
      return jsonResponse({ access_token: "access-token" });
    }
    if (url.pathname.endsWith(`/companies(${COMPANY_ID})`)) {
      return jsonResponse({ name: COMPANY_NAME });
    }
    if (url.pathname.endsWith("/ODataV4/ItemReferenceEntries")) {
      return (routes.references ?? emptyList)(filter);
    }
    if (url.pathname.endsWith("/items()") && filter.startsWith("gtin")) {
      return (routes.itemsByGtin ?? emptyList)(filter);
    }
    if (url.pathname.endsWith("/items()") && filter.startsWith("number")) {
      return (routes.itemsByNumber ?? emptyList)(filter);
    }

    throw new Error(`Unexpected Business Central request: ${url.toString()}`);
  });

  global.fetch = fetchMock;

  return fetchMock;
}

function requestUrls(fetchMock: jest.Mock): URL[] {
  return fetchMock.mock.calls
    .map((call) => new URL(String(call[0])))
    .filter((url) => url.hostname !== "login.microsoftonline.com");
}

function referenceRequests(fetchMock: jest.Mock): URL[] {
  return requestUrls(fetchMock).filter((url) =>
    url.pathname.endsWith("/ODataV4/ItemReferenceEntries")
  );
}

function itemRequests(fetchMock: jest.Mock, field: "gtin" | "number"): URL[] {
  return requestUrls(fetchMock).filter(
    (url) =>
      url.pathname.endsWith("/items()") &&
      (url.searchParams.get("$filter") ?? "").startsWith(field)
  );
}

function filterValueCount(url: URL): number {
  return (url.searchParams.get("$filter") ?? "").split(" or ").length;
}

// TestDK shapes, samples/bc-variant-barcodes-testdk.md and bc-item-lookup-probe-planner.md.
const TESTDK_REFERENCE_ROWS = [
  {
    Reference_No: "5712094132141",
    Item_No: "HEND-L-MIDNBLUE",
    Variant_Code: "L",
    Unit_of_Measure: "",
    Reference_Type: "Bar Code",
  },
  {
    Reference_No: "5712094132141",
    Item_No: "HEND-L-MIDNBLUE",
    Variant_Code: "L",
    Unit_of_Measure: "PCS",
    Reference_Type: "Bar Code",
  },
  {
    Reference_No: "5712094132141",
    Item_No: "HEND-L-MIDNBLUE",
    Variant_Code: "L",
    Unit_of_Measure: "PCS",
    Reference_Type: " ",
  },
];

const HENDERSON_ITEM_RAW = {
  id: "d22247f7-005e-ee11-8def-0022489bc7be",
  number: "HEND-L-MIDNBLUE",
  displayName: "Henderson Women - Midnight Blue",
  gtin: "",
  baseUnitOfMeasureCode: "PCS",
  itemVariants: [
    { id: "a419dfc8-ab92-ee11-8178-0022489b54b1", code: "XS" },
    { id: "a019dfc8-ab92-ee11-8178-0022489b54b1", code: "L" },
  ],
};

const METZ_ITEM_RAW = {
  id: "11111111-1111-1111-1111-111111111111",
  number: "FLS-NIM-VESPERMNA-XL",
  displayName: "Vesper Vest Unisex, Navy - XL",
  gtin: "5712094145752",
  baseUnitOfMeasureCode: "PCS",
  itemVariants: [],
};

function barcode(index: number): string {
  return String(5712094100000 + index);
}

describe("BusinessCentralModuleService.getItemLookupEvidence", () => {
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

  it("reads Item Reference rows for a size barcode and the named item with its sizes", async () => {
    const fetchMock = mockBc({
      references: () => jsonResponse({ value: TESTDK_REFERENCE_ROWS }),
      itemsByNumber: () => jsonResponse({ value: [HENDERSON_ITEM_RAW] }),
    });
    const service = new BusinessCentralModuleService();

    const evidence = await service.getItemLookupEvidence([
      { lineNumber: 1, eanNo: "5712094132141" },
    ]);

    expect(evidence).toEqual({
      itemsByBarcode: [],
      barcodeReferences: [
        {
          barcode: "5712094132141",
          itemNumber: "HEND-L-MIDNBLUE",
          variantCode: "L",
          unitOfMeasureCode: "",
          referenceType: "bar_code",
        },
        {
          barcode: "5712094132141",
          itemNumber: "HEND-L-MIDNBLUE",
          variantCode: "L",
          unitOfMeasureCode: "PCS",
          referenceType: "bar_code",
        },
        {
          barcode: "5712094132141",
          itemNumber: "HEND-L-MIDNBLUE",
          variantCode: "L",
          unitOfMeasureCode: "PCS",
          referenceType: "other",
        },
      ],
      itemsByNumber: [
        {
          id: "d22247f7-005e-ee11-8def-0022489bc7be",
          number: "HEND-L-MIDNBLUE",
          displayName: "Henderson Women - Midnight Blue",
          gtin: "",
          baseUnitOfMeasureCode: "PCS",
          variants: [
            { id: "a419dfc8-ab92-ee11-8178-0022489b54b1", code: "XS" },
            { id: "a019dfc8-ab92-ee11-8178-0022489b54b1", code: "L" },
          ],
        },
      ],
    });

    const [referenceUrl] = referenceRequests(fetchMock);
    expect(referenceUrl.searchParams.get("company")).toEqual(`'${COMPANY_NAME}'`);
    expect(referenceUrl.searchParams.get("$filter")).toEqual(
      "Reference_No eq '5712094132141'"
    );
    expect(itemRequests(fetchMock, "number")[0].searchParams.get("$filter")).toEqual(
      "number eq 'HEND-L-MIDNBLUE'"
    );
  });

  it("maps every reference type other than Bar Code to other", async () => {
    mockBc({
      references: () =>
        jsonResponse({
          value: ["Customer", "Vendor", " ", "Bar_x0020_Code", undefined].map((type) => ({
            ...TESTDK_REFERENCE_ROWS[0],
            Reference_Type: type,
          })),
        }),
    });
    const service = new BusinessCentralModuleService();

    const evidence = await service.getItemLookupEvidence([
      { lineNumber: 1, eanNo: "5712094132141" },
    ]);

    expect(evidence.barcodeReferences.map((row) => row.referenceType)).toEqual([
      "other",
      "other",
      "other",
      "other",
      "other",
    ]);
  });

  it("keeps empty size and unit codes as empty strings", async () => {
    mockBc({
      references: () =>
        jsonResponse({
          value: [{ ...TESTDK_REFERENCE_ROWS[0], Variant_Code: "", Unit_of_Measure: null }],
        }),
    });
    const service = new BusinessCentralModuleService();

    const evidence = await service.getItemLookupEvidence([
      { lineNumber: 1, eanNo: "5712094132141" },
    ]);

    expect(evidence.barcodeReferences[0]).toMatchObject({
      variantCode: "",
      unitOfMeasureCode: "",
    });
  });

  it("returns items found by item-card barcode with their sizes, empty when they have none", async () => {
    const fetchMock = mockBc({
      itemsByGtin: () =>
        jsonResponse({ value: [{ ...METZ_ITEM_RAW, itemVariants: undefined }] }),
    });
    const service = new BusinessCentralModuleService();

    const evidence = await service.getItemLookupEvidence([
      { lineNumber: 1, eanNo: "5712094145752" },
    ]);

    expect(evidence.itemsByBarcode).toEqual([
      {
        id: METZ_ITEM_RAW.id,
        number: METZ_ITEM_RAW.number,
        displayName: METZ_ITEM_RAW.displayName,
        gtin: METZ_ITEM_RAW.gtin,
        baseUnitOfMeasureCode: "PCS",
        variants: [],
      },
    ]);

    const [gtinUrl] = itemRequests(fetchMock, "gtin");
    expect(gtinUrl.searchParams.get("$filter")).toEqual("gtin eq '5712094145752'");
    expect(gtinUrl.searchParams.get("$expand")).toEqual("itemVariants($select=id,code)");
  });

  it("reads barcodes in chunks of at most 20 values per or filter, deduplicated and without blanks", async () => {
    const fetchMock = mockBc();
    const service = new BusinessCentralModuleService();
    const lines = Array.from({ length: 45 }, (_, index) => ({
      lineNumber: index + 1,
      eanNo: barcode(index),
    }));

    await service.getItemLookupEvidence([
      ...lines,
      { lineNumber: 46, eanNo: barcode(0) },
      { lineNumber: 47, eanNo: "  " },
    ]);

    expect(itemRequests(fetchMock, "gtin").map(filterValueCount)).toEqual([20, 20, 5]);
    expect(referenceRequests(fetchMock).map(filterValueCount)).toEqual([20, 20, 5]);

    const requestedBarcodes = referenceRequests(fetchMock).flatMap((url) =>
      (url.searchParams.get("$filter") ?? "").split(" or ")
    );
    expect(new Set(requestedBarcodes).size).toEqual(45);
  });

  it("reads items by the union of reference item numbers, line item numbers and customer item numbers", async () => {
    const fetchMock = mockBc({
      references: () => jsonResponse({ value: TESTDK_REFERENCE_ROWS }),
      itemsByNumber: () => jsonResponse({ value: [HENDERSON_ITEM_RAW, METZ_ITEM_RAW] }),
    });
    const service = new BusinessCentralModuleService();

    const evidence = await service.getItemLookupEvidence([
      {
        lineNumber: 1,
        eanNo: "5712094132141",
        itemNumber: "HEND-L-MIDNBLUE",
        custItemNo: "FLS-NIM-VESPERMNA-XL",
      },
      {
        lineNumber: 2,
        eanNo: "5712094145752",
        itemNumber: " FLS-NIM-VESPERMNA-XL ",
        custItemNo: "",
      },
      { lineNumber: 3, eanNo: "5712094132141", itemNumber: "   ", custItemNo: "CUST-7" },
    ]);

    const numberUrls = itemRequests(fetchMock, "number");
    expect(numberUrls).toHaveLength(1);
    expect(numberUrls[0].searchParams.get("$filter")).toEqual(
      [
        "number eq 'HEND-L-MIDNBLUE'",
        "number eq 'FLS-NIM-VESPERMNA-XL'",
        "number eq 'CUST-7'",
      ].join(" or ")
    );
    expect(numberUrls[0].searchParams.get("$expand")).toEqual(
      "itemVariants($select=id,code)"
    );
    expect(evidence.itemsByNumber.map((item) => item.variants.length)).toEqual([2, 0]);
  });

  it("sends an item number containing a quote and ' or ' as one escaped literal", async () => {
    const fetchMock = mockBc();
    const service = new BusinessCentralModuleService();

    await service.getItemLookupEvidence([
      { lineNumber: 1, eanNo: "5712094132141", itemNumber: "A' or number eq 'B" },
    ]);

    expect(itemRequests(fetchMock, "number")[0].searchParams.get("$filter")).toEqual(
      "number eq 'A'' or number eq ''B'"
    );
  });

  it("does not request an item number longer than 20 characters", async () => {
    const fetchMock = mockBc({
      references: () =>
        jsonResponse({
          value: [{ ...TESTDK_REFERENCE_ROWS[0], Item_No: "NKT-NIM-TELLURIDENA-SX" }],
        }),
    });
    const service = new BusinessCentralModuleService();

    const evidence = await service.getItemLookupEvidence([
      {
        lineNumber: 1,
        eanNo: "5712094143628",
        itemNumber: "NKT-NIM-TELLURIDENA-S",
        custItemNo: "12345678901234567890",
      },
    ]);

    const numberUrls = itemRequests(fetchMock, "number");
    expect(numberUrls).toHaveLength(1);
    expect(numberUrls[0].searchParams.get("$filter")).toEqual(
      "number eq '12345678901234567890'"
    );
    expect(evidence.barcodeReferences).toHaveLength(1);
  });

  it("makes no request at all when the only identifier is a 21-character item number", async () => {
    const fetchMock = mockBc();
    const service = new BusinessCentralModuleService();

    await expect(
      service.getItemLookupEvidence([
        { lineNumber: 1, eanNo: "", itemNumber: "NKT-NIM-TELLURIDENA-S" },
      ])
    ).resolves.toEqual({ itemsByBarcode: [], barcodeReferences: [], itemsByNumber: [] });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("makes no number request when no usable item number is named", async () => {
    const fetchMock = mockBc();
    const service = new BusinessCentralModuleService();

    await service.getItemLookupEvidence([{ lineNumber: 1, eanNo: "5712094132141" }]);

    expect(itemRequests(fetchMock, "number")).toHaveLength(0);
  });

  it.each([
    ["the item-card barcode read", "itemsByGtin", 500],
    ["the Item Reference read", "references", 429],
    ["the item number read", "itemsByNumber", 400],
  ] as const)("throws without the response body when %s fails", async (_name, route, status) => {
    mockBc({
      references: () => jsonResponse({ value: TESTDK_REFERENCE_ROWS }),
      [route]: () => new Response(VENDOR_BODY_TEXT, { status }),
    });
    const service = new BusinessCentralModuleService();

    const error = await service
      .getItemLookupEvidence([{ lineNumber: 1, eanNo: "5712094132141" }])
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain(`status ${status}`);
    expect((error as Error).message).not.toContain(VENDOR_BODY_TEXT);
  });

  it.each(["itemsByGtin", "references", "itemsByNumber"] as const)(
    "throws when the %s response carries a next link",
    async (route) => {
      mockBc({
        references: () => jsonResponse({ value: TESTDK_REFERENCE_ROWS }),
        [route]: () =>
          jsonResponse({
            value: [],
            "@odata.nextLink":
              "https://api.businesscentral.dynamics.com/v2.0/tenant-id/Sandbox/next",
          }),
      });
      const service = new BusinessCentralModuleService();

      await expect(
        service.getItemLookupEvidence([{ lineNumber: 1, eanNo: "5712094132141" }])
      ).rejects.toThrow("incomplete");
    }
  );

  it("throws when a read does not complete", async () => {
    const fetchMock = mockBc();
    fetchMock.mockImplementationOnce(async () => jsonResponse({ access_token: "access-token" }));
    fetchMock.mockImplementationOnce(async () => {
      throw new Error(VENDOR_BODY_TEXT);
    });
    const service = new BusinessCentralModuleService();

    const error = await service
      .getItemLookupEvidence([{ lineNumber: 1, eanNo: "5712094132141" }])
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).not.toContain(VENDOR_BODY_TEXT);
  });

  it("uses one token for the whole read", async () => {
    const fetchMock = mockBc({
      references: () => jsonResponse({ value: TESTDK_REFERENCE_ROWS }),
    });
    const service = new BusinessCentralModuleService();

    await service.getItemLookupEvidence(
      Array.from({ length: 25 }, (_, index) => ({
        lineNumber: index + 1,
        eanNo: barcode(index),
        itemNumber: `ITEM-${index}`,
      }))
    );

    const tokenCalls = fetchMock.mock.calls.filter((call) =>
      String(call[0]).startsWith("https://login.microsoftonline.com")
    );
    expect(tokenCalls).toHaveLength(1);

    for (const call of fetchMock.mock.calls.slice(1)) {
      const headers = (call[1] as RequestInit).headers as Record<string, string>;
      expect(headers.authorization).toEqual("Bearer access-token");
    }
  });

  it("returns empty lists without any request for empty input", async () => {
    const fetchMock = mockBc();
    const service = new BusinessCentralModuleService();

    await expect(service.getItemLookupEvidence([])).resolves.toEqual({
      itemsByBarcode: [],
      barcodeReferences: [],
      itemsByNumber: [],
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
