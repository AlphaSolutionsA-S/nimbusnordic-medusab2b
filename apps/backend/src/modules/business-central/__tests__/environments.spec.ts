import BusinessCentralModuleService from "../service";
import { getBusinessCentralLocalCurrency } from "../environment-config";

const originalFetch = global.fetch;

const DK_TENANT = "tenant-dk";
const NO_TENANT = "tenant-no";
const DK_DISCOVERY_URL = `https://api.businesscentral.dynamics.com/v2.0/${DK_TENANT}/TestDK/api/v2.0`;
const NO_DISCOVERY_URL = `https://api.businesscentral.dynamics.com/v2.0/${NO_TENANT}/TestNO/api/v2.0`;
const DK_COMPANY_ID = "00000000-0000-0000-0000-0000000000d1";
const NO_COMPANY_ID = "223f0db0-7884-ee11-8178-002248dd26d9";
const DK_COMPANY_NAME = "Nimbus Nordic A/S";
const NO_COMPANY_NAME = "TEST-Nimbus NORGE-TEST";
const CLIENT_ID = "00000000-0000-0000-0000-000000000001";
const CLIENT_SECRET = "client-secret-value";

const MANAGED_VARIABLES = [
  "BUSINESS_CENTRAL_DISCOVERY_URL",
  "BUSINESS_CENTRAL_COMPANY_ID",
  "BUSINESS_CENTRAL_LCY_CODE",
  "BUSINESS_CENTRAL_NO_DISCOVERY_URL",
  "BUSINESS_CENTRAL_NO_COMPANY_ID",
  "BUSINESS_CENTRAL_NO_LCY_CODE",
  "BUSINESS_CENTRAL_CLIENT_ID",
  "BUSINESS_CENTRAL_CLIENT_SECRET",
] as const;
const originalValues = Object.fromEntries(
  MANAGED_VARIABLES.map((name) => [name, process.env[name]])
);

const COMPANY_NAMES: Record<string, string> = {
  [`/v2.0/${DK_TENANT}/TestDK/api/v2.0/companies(${DK_COMPANY_ID})`]: DK_COMPANY_NAME,
  [`/v2.0/${NO_TENANT}/TestNO/api/v2.0/companies(${NO_COMPANY_ID})`]: NO_COMPANY_NAME,
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

function returnOrder(currencyCode: string): Record<string, unknown> {
  return {
    id: "return-1",
    number: "31502910",
    documentDate: "2026-09-27",
    status: "Open",
    currencyCode,
    pricesIncludingVAT: false,
    salesReturnOrderLines: [
      { id: "a", sequence: 10000, lineType: "Item", lineAmount: 100, amountIncludingTax: 125 },
    ],
  };
}

// Answers every Business Central request the tests make; the access token names the tenant it
// was requested for, so a request shows which environment's token it carries.
function mockBc(returnOrderCurrency = ""): jest.Mock {
  const fetchMock = jest.fn(async (input: string | URL) => {
    const url = new URL(String(input));

    if (url.hostname === "login.microsoftonline.com") {
      const tenant = url.pathname.split("/").filter(Boolean)[0];
      return jsonResponse({ access_token: `token-${tenant}`, expires_in: 3599 });
    }
    if (COMPANY_NAMES[url.pathname]) {
      return jsonResponse({ name: COMPANY_NAMES[url.pathname] });
    }
    if (url.pathname.endsWith("/ODataV4/CS_EnabledReasonCodes")) {
      return jsonResponse({ value: [{ ReasonCode: "NORMAL", Description: "Normal return" }] });
    }
    if (url.pathname.endsWith("/salesReturnOrders")) {
      return jsonResponse({ value: [returnOrder(returnOrderCurrency)] });
    }
    if (url.pathname.endsWith("/customers()")) {
      return jsonResponse({ value: [] });
    }
    if (
      url.pathname.endsWith("/ODataV4/PostedReturnReceipt") ||
      url.pathname.endsWith("/ODataV4/TRCShipmentLine") ||
      url.pathname.endsWith("/salesShipments")
    ) {
      return jsonResponse({ value: [] });
    }

    throw new Error(`Unexpected Business Central request: ${url.toString()}`);
  });

  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

type Request = { url: URL; authorization: string | null };

function requests(fetchMock: jest.Mock): Request[] {
  return fetchMock.mock.calls.map(([input, init]) => ({
    url: new URL(String(input)),
    authorization: new Headers((init as RequestInit | undefined)?.headers).get("authorization"),
  }));
}

function requestsTo(fetchMock: jest.Mock, pathSuffix: string): Request[] {
  return requests(fetchMock).filter(({ url }) => url.pathname.endsWith(pathSuffix));
}

function tokenTenants(fetchMock: jest.Mock): string[] {
  return requests(fetchMock)
    .filter(({ url }) => url.hostname === "login.microsoftonline.com")
    .map(({ url }) => url.pathname.split("/").filter(Boolean)[0]);
}

beforeEach(() => {
  process.env.BUSINESS_CENTRAL_DISCOVERY_URL = DK_DISCOVERY_URL;
  process.env.BUSINESS_CENTRAL_COMPANY_ID = DK_COMPANY_ID;
  delete process.env.BUSINESS_CENTRAL_LCY_CODE;
  process.env.BUSINESS_CENTRAL_NO_DISCOVERY_URL = NO_DISCOVERY_URL;
  process.env.BUSINESS_CENTRAL_NO_COMPANY_ID = NO_COMPANY_ID;
  delete process.env.BUSINESS_CENTRAL_NO_LCY_CODE;
  process.env.BUSINESS_CENTRAL_CLIENT_ID = CLIENT_ID;
  process.env.BUSINESS_CENTRAL_CLIENT_SECRET = CLIENT_SECRET;
});

afterEach(() => {
  global.fetch = originalFetch;
  for (const name of MANAGED_VARIABLES) {
    const value = originalValues[name];
    if (value === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = value;
    }
  }
});

describe("Business Central environments", () => {
  it("sends a NO call to the NO discovery URL, company GUID and company name, and leaves DK unchanged", async () => {
    const fetchMock = mockBc();
    const service = new BusinessCentralModuleService();

    await service.listReturnReasons("DK");
    await service.listReturnReasons("NO");
    await service.getReturn("NO", { customerNumber: "10000", returnNumber: "31502910" });
    await service.getCustomer("NO", "10000");

    expect(tokenTenants(fetchMock)).toEqual([DK_TENANT, NO_TENANT, NO_TENANT, NO_TENANT]);

    const reasonRequests = requestsTo(fetchMock, "/ODataV4/CS_EnabledReasonCodes");
    expect(
      reasonRequests.map(({ url, authorization }) => [
        url.origin + url.pathname,
        url.searchParams.get("company"),
        authorization,
      ])
    ).toEqual([
      [
        `https://api.businesscentral.dynamics.com/v2.0/${DK_TENANT}/TestDK/ODataV4/CS_EnabledReasonCodes`,
        `'${DK_COMPANY_NAME}'`,
        `Bearer token-${DK_TENANT}`,
      ],
      [
        `https://api.businesscentral.dynamics.com/v2.0/${NO_TENANT}/TestNO/ODataV4/CS_EnabledReasonCodes`,
        `'${NO_COMPANY_NAME}'`,
        `Bearer token-${NO_TENANT}`,
      ],
    ]);

    const [returnRequest] = requestsTo(fetchMock, "/salesReturnOrders");
    expect(returnRequest.url.origin + returnRequest.url.pathname).toBe(
      `https://api.businesscentral.dynamics.com/v2.0/${NO_TENANT}/TestNO/api/abakion/customerPortal/v2.0/companies(${NO_COMPANY_ID})/salesReturnOrders`
    );
    const [receiptRequest] = requestsTo(fetchMock, "/ODataV4/PostedReturnReceipt");
    expect(receiptRequest.url.pathname).toBe(`/v2.0/${NO_TENANT}/TestNO/ODataV4/PostedReturnReceipt`);
    expect(receiptRequest.url.searchParams.get("company")).toBe(`'${NO_COMPANY_NAME}'`);

    const [customerRequest] = requestsTo(fetchMock, "/customers()");
    expect(customerRequest.url.origin + customerRequest.url.pathname).toBe(
      `${NO_DISCOVERY_URL}/customers()`
    );
    expect(customerRequest.authorization).toBe(`Bearer token-${NO_TENANT}`);
  });

  it.each([
    ["the discovery URL is unset", "BUSINESS_CENTRAL_NO_DISCOVERY_URL", undefined],
    ["the discovery URL is blank", "BUSINESS_CENTRAL_NO_DISCOVERY_URL", "  "],
    ["the discovery URL is not a URL", "BUSINESS_CENTRAL_NO_DISCOVERY_URL", `not a url ${NO_TENANT}`],
    [
      "the discovery URL is not https",
      "BUSINESS_CENTRAL_NO_DISCOVERY_URL",
      `http://api.businesscentral.dynamics.com/v2.0/${NO_TENANT}/TestNO/api/v2.0`,
    ],
    [
      "the discovery URL targets another host",
      "BUSINESS_CENTRAL_NO_DISCOVERY_URL",
      `https://evil.example/v2.0/${NO_TENANT}/TestNO/api/v2.0`,
    ],
    [
      "the discovery URL has no environment",
      "BUSINESS_CENTRAL_NO_DISCOVERY_URL",
      `https://api.businesscentral.dynamics.com/v2.0/${NO_TENANT}`,
    ],
    ["the company id is unset", "BUSINESS_CENTRAL_NO_COMPANY_ID", undefined],
    ["the company id is not a GUID", "BUSINESS_CENTRAL_NO_COMPANY_ID", NO_COMPANY_NAME],
  ])(
    "fails only NO calls when %s, naming the variable and NO without secrets",
    async (_case, variable, value) => {
      if (value === undefined) {
        delete process.env[variable];
      } else {
        process.env[variable] = value;
      }
      const fetchMock = mockBc();
      const service = new BusinessCentralModuleService();

      const error = await service.listReturnReasons("NO").catch((e: unknown) => e);

      expect(error).toBeInstanceOf(Error);
      const message = (error as Error).message;
      expect(message).toContain(variable);
      expect(message).toMatch(/\bNO\b/);
      for (const secret of [NO_TENANT, CLIENT_ID, CLIENT_SECRET, "evil.example", "://", NO_COMPANY_NAME]) {
        expect(message).not.toContain(secret);
      }
      expect(requests(fetchMock).some(({ url }) => url.hostname === "evil.example")).toBe(false);

      await expect(service.listReturnReasons("DK")).resolves.toEqual([
        { id: "NORMAL", description: "Normal return" },
      ]);
    }
  );

  it("resolves a blank return currency to the environment's local currency", async () => {
    mockBc("");
    const service = new BusinessCentralModuleService();
    const params = { customerNumber: "10000", returnNumber: "31502910" };

    expect((await service.getReturn("NO", params))?.expectedCredit?.currencyCode).toBe("NOK");
    expect((await service.getReturn("DK", params))?.expectedCredit?.currencyCode).toBe("DKK");

    process.env.BUSINESS_CENTRAL_NO_LCY_CODE = "SEK";
    expect((await service.getReturn("NO", params))?.expectedCredit?.currencyCode).toBe("SEK");
    expect((await service.getReturn("DK", params))?.expectedCredit?.currencyCode).toBe("DKK");
  });

  it("exposes each environment's local currency with its own override", () => {
    expect(getBusinessCentralLocalCurrency("DK")).toBe("DKK");
    expect(getBusinessCentralLocalCurrency("NO")).toBe("NOK");

    process.env.BUSINESS_CENTRAL_LCY_CODE = " EUR ";
    process.env.BUSINESS_CENTRAL_NO_LCY_CODE = "SEK";
    expect(getBusinessCentralLocalCurrency("DK")).toBe("EUR");
    expect(getBusinessCentralLocalCurrency("NO")).toBe("SEK");
  });

  it("does not reuse a cached DK shipment-read token or company name for a NO call", async () => {
    const fetchMock = mockBc();
    const service = new BusinessCentralModuleService();

    await service.getShipmentLineVariants("DK", ["S-1"]);
    await service.getShipmentLineVariants("NO", ["S-2"]);
    await service.getShipmentLineVariants("DK", ["S-3"]);
    await service.getShipmentLineVariants("NO", ["S-4"]);

    // One token and one company-name read per environment, each reused within its environment.
    expect(tokenTenants(fetchMock)).toEqual([DK_TENANT, NO_TENANT]);
    expect(
      requests(fetchMock)
        .filter(({ url }) => Boolean(COMPANY_NAMES[url.pathname]))
        .map(({ url, authorization }) => [COMPANY_NAMES[url.pathname], authorization])
    ).toEqual([
      [DK_COMPANY_NAME, `Bearer token-${DK_TENANT}`],
      [NO_COMPANY_NAME, `Bearer token-${NO_TENANT}`],
    ]);
    expect(
      requestsTo(fetchMock, "/ODataV4/TRCShipmentLine").map(({ url, authorization }) => [
        url.pathname,
        url.searchParams.get("company"),
        authorization,
      ])
    ).toEqual([
      [`/v2.0/${DK_TENANT}/TestDK/ODataV4/TRCShipmentLine`, `'${DK_COMPANY_NAME}'`, `Bearer token-${DK_TENANT}`],
      [`/v2.0/${NO_TENANT}/TestNO/ODataV4/TRCShipmentLine`, `'${NO_COMPANY_NAME}'`, `Bearer token-${NO_TENANT}`],
      [`/v2.0/${DK_TENANT}/TestDK/ODataV4/TRCShipmentLine`, `'${DK_COMPANY_NAME}'`, `Bearer token-${DK_TENANT}`],
      [`/v2.0/${NO_TENANT}/TestNO/ODataV4/TRCShipmentLine`, `'${NO_COMPANY_NAME}'`, `Bearer token-${NO_TENANT}`],
    ]);
  });
});
