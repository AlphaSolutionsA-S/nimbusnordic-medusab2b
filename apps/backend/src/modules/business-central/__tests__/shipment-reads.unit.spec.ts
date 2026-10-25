import BusinessCentralModuleService from "../service";
import { BusinessCentralThrottledError, parseRetryAfterSeconds } from "../shipment-reads";

const originalFetch = global.fetch;
const DISCOVERY_URL =
  "https://api.businesscentral.dynamics.com/v2.0/tenant-id/Sandbox/api/v2.0";
const SHIPMENTS_PATH = "/salesShipments";
const COMPANY_ID = "00000000-0000-0000-0000-0000000000c1";
const COMPANY_PATH = `/companies(${COMPANY_ID})`;
const VARIANTS_PATH = "/v2.0/tenant-id/Sandbox/ODataV4/TRCShipmentLine";
const VARIANTS_URL = `https://api.businesscentral.dynamics.com${VARIANTS_PATH}`;

type FetchHandler = (url: URL, init: RequestInit | undefined) => Promise<Response> | Response;

type BcHandlers = {
  variants?: FetchHandler;
  company?: FetchHandler;
  token?: FetchHandler;
};

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers });
}

function tokenResponse(accessToken = "access-token", expiresIn = 3599): Response {
  return jsonResponse({ access_token: accessToken, token_type: "Bearer", expires_in: expiresIn });
}

function mockBc(handleShipments: FetchHandler, handlers: BcHandlers = {}): jest.Mock {
  const fetchMock = jest.fn(async (input: string | URL, init?: RequestInit) => {
    const url = new URL(String(input));

    if (url.hostname === "login.microsoftonline.com") {
      return handlers.token ? handlers.token(url, init) : tokenResponse();
    }
    if (url.pathname.endsWith(SHIPMENTS_PATH)) {
      return handleShipments(url, init);
    }
    if (url.pathname.endsWith(COMPANY_PATH)) {
      return handlers.company
        ? handlers.company(url, init)
        : jsonResponse({ id: COMPANY_ID, name: "Nimbus Nordic A/S" });
    }
    if (url.pathname === VARIANTS_PATH && handlers.variants) {
      return handlers.variants(url, init);
    }

    throw new Error(`Unexpected Business Central request: ${url.toString()}`);
  });

  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

function shipmentRequests(fetchMock: jest.Mock): Array<{ url: URL; init: RequestInit | undefined }> {
  return fetchMock.mock.calls
    .map(([input, init]) => ({ url: new URL(String(input)), init: init as RequestInit | undefined }))
    .filter(({ url }) => url.pathname.endsWith(SHIPMENTS_PATH));
}

function requestsTo(
  fetchMock: jest.Mock,
  matches: (url: URL) => boolean
): Array<{ url: URL; init: RequestInit | undefined }> {
  return fetchMock.mock.calls
    .map(([input, init]) => ({ url: new URL(String(input)), init: init as RequestInit | undefined }))
    .filter(({ url }) => matches(url));
}

function variantRequests(fetchMock: jest.Mock): Array<{ url: URL; init: RequestInit | undefined }> {
  return requestsTo(fetchMock, (url) => url.pathname === VARIANTS_PATH);
}

function companyRequests(fetchMock: jest.Mock): Array<{ url: URL; init: RequestInit | undefined }> {
  return requestsTo(fetchMock, (url) => url.pathname.endsWith(COMPANY_PATH));
}

function variantRow(documentNumber: unknown, lineNo: unknown, variantCode: unknown) {
  return { documentNumber, lineNo, variantCode };
}

function tokenRequestCount(fetchMock: jest.Mock): number {
  return fetchMock.mock.calls.filter(
    ([input]) => new URL(String(input)).hostname === "login.microsoftonline.com"
  ).length;
}

function headerValue(init: RequestInit | undefined, name: string): string | null {
  return new Headers(init?.headers).get(name);
}

function headerRow(number: string, lastModifiedDateTime = "2026-10-19T10:00:00.5Z") {
  return {
    id: `guid-${number}`,
    number,
    orderNumber: "SO-1001",
    externalDocumentNumber: "PO-77",
    customerNumber: "10000",
    postingDate: "2026-10-19",
    lastModifiedDateTime,
  };
}

const AFTER = new Date("2026-10-19T10:00:00.000Z");
const UNTIL = new Date("2026-10-19T10:15:00.000Z");

describe("BusinessCentralModuleService shipment reads", () => {
  beforeEach(() => {
    process.env.BUSINESS_CENTRAL_DISCOVERY_URL = DISCOVERY_URL;
    process.env.BUSINESS_CENTRAL_CLIENT_ID = "00000000-0000-0000-0000-000000000001";
    process.env.BUSINESS_CENTRAL_CLIENT_SECRET = "client-secret";
    process.env.BUSINESS_CENTRAL_COMPANY_ID = COMPANY_ID;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  describe("countShipments", () => {
    it.each(["count", "headers", "numbers"])("starts no token request for an expired %s read", async (read) => {
      jest.spyOn(Date, "now").mockReturnValue(1000);
      const fetchMock = mockBc(() => jsonResponse({ "@odata.count": 0, value: [] }));
      const service = new BusinessCentralModuleService();
      const operation = read === "count"
        ? service.countShipments({ after: AFTER, until: UNTIL }, 1000)
        : read === "headers"
          ? service.listShipmentHeaders({ after: AFTER, until: UNTIL }, 1000)
          : service.getShipmentsByNumbers(["S-1"], 1000);

      await expect(operation).rejects.toMatchObject({ name: "ShipmentReadDeadlineError" });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("does not dispatch data when token renewal crosses the deadline", async () => {
      const now = jest.spyOn(Date, "now").mockReturnValue(1000);
      const fetchMock = mockBc(() => jsonResponse({ "@odata.count": 0, value: [] }));
      const service = new BusinessCentralModuleService();
      await service.countShipments({ after: AFTER, until: UNTIL });
      now.mockReturnValue(4_000_000);
      fetchMock.mockImplementationOnce(async () => {
        now.mockReturnValue(4_000_100);
        return tokenResponse();
      });

      await expect(service.countShipments({ after: AFTER, until: UNTIL }, 4_000_100))
        .rejects.toMatchObject({ name: "ShipmentReadDeadlineError" });
      expect(tokenRequestCount(fetchMock)).toBe(2);
      expect(shipmentRequests(fetchMock)).toHaveLength(1);
    });

    it.each(["headers", "numbers"])("discards incomplete %s paging at the deadline", async (read) => {
      const now = jest.spyOn(Date, "now").mockReturnValue(1000);
      let page = 0;
      const fetchMock = mockBc(() => {
        now.mockReturnValue(1100);
        page += 1;
        return jsonResponse({ value: [headerRow("S-1")], ...(page === 1 ? { "@odata.nextLink": `${DISCOVERY_URL}/salesShipments?$skiptoken=page2` } : {}) });
      });
      const service = new BusinessCentralModuleService();
      const operation = read === "headers"
        ? service.listShipmentHeaders({ after: AFTER, until: UNTIL }, 1100)
        : service.getShipmentsByNumbers(["S-1"], 1100);

      await expect(operation).rejects.toMatchObject({ name: "ShipmentReadDeadlineError" });
      expect(shipmentRequests(fetchMock)).toHaveLength(1);
    });

    it("does not start another by-number chunk after the deadline", async () => {
      const now = jest.spyOn(Date, "now").mockReturnValue(1000);
      const fetchMock = mockBc(() => {
        now.mockReturnValue(1100);
        return jsonResponse({ value: [] });
      });
      const service = new BusinessCentralModuleService();

      await expect(service.getShipmentsByNumbers(Array.from({ length: 21 }, (_, i) => `S-${i}`), 1100))
        .rejects.toMatchObject({ name: "ShipmentReadDeadlineError" });
      expect(shipmentRequests(fetchMock)).toHaveLength(1);
    });

    it("returns a complete final page whose request finishes after the deadline", async () => {
      const now = jest.spyOn(Date, "now").mockReturnValue(1000);
      const fetchMock = mockBc(() => {
        now.mockReturnValue(1101);
        return jsonResponse({ value: [headerRow("S-1")] });
      });
      const service = new BusinessCentralModuleService();

      await expect(service.listShipmentHeaders({ after: AFTER, until: UNTIL }, 1100))
        .resolves.toEqual([expect.objectContaining({ number: "S-1" })]);
      expect(shipmentRequests(fetchMock)).toHaveLength(1);
    });

    it("counts headers modified in (after, until] with a server-side $count", async () => {
      const fetchMock = mockBc(() => jsonResponse({ "@odata.count": 412, value: [headerRow("S-1")] }));
      const service = new BusinessCentralModuleService();

      await expect(service.countShipments({ after: AFTER, until: UNTIL })).resolves.toBe(412);

      const [{ url }] = shipmentRequests(fetchMock);
      expect(url.searchParams.get("$filter")).toBe(
        "lastModifiedDateTime gt 2026-10-19T10:00:00.000Z and lastModifiedDateTime le 2026-10-19T10:15:00.000Z"
      );
      expect(url.searchParams.get("$count")).toBe("true");
    });

    it("throws when BC returns no count", async () => {
      mockBc(() => jsonResponse({ value: [] }));
      const service = new BusinessCentralModuleService();

      await expect(service.countShipments({ after: AFTER, until: UNTIL })).rejects.toThrow(
        "count"
      );
    });
  });

  describe("listShipmentHeaders", () => {
    it("reads the window ascending with a page-size preference and only header fields", async () => {
      const fetchMock = mockBc(() => jsonResponse({ value: [headerRow("S-1")] }));
      const service = new BusinessCentralModuleService();

      await service.listShipmentHeaders({ after: AFTER, until: UNTIL });

      const [{ url, init }] = shipmentRequests(fetchMock);
      expect(url.searchParams.get("$filter")).toBe(
        "lastModifiedDateTime gt 2026-10-19T10:00:00.000Z and lastModifiedDateTime le 2026-10-19T10:15:00.000Z"
      );
      expect(url.searchParams.get("$orderby")).toBe("lastModifiedDateTime asc");
      expect(url.searchParams.get("$select")).toBe(
        "id,number,orderNumber,externalDocumentNumber,customerNumber,postingDate,lastModifiedDateTime"
      );
      expect(headerValue(init, "prefer")).toBe("odata.maxpagesize=200");
    });

    it("accepts a single-timestamp window", async () => {
      const fetchMock = mockBc(() => jsonResponse({ value: [] }));
      const service = new BusinessCentralModuleService();
      const until = new Date("2026-10-19T10:00:00.124Z");

      await service.listShipmentHeaders({ after: new Date(until.getTime() - 1), until });

      const [{ url }] = shipmentRequests(fetchMock);
      expect(url.searchParams.get("$filter")).toBe(
        "lastModifiedDateTime gt 2026-10-19T10:00:00.123Z and lastModifiedDateTime le 2026-10-19T10:00:00.124Z"
      );
    });

    it("follows a three-page nextLink chain and returns every row once, in order", async () => {
      const page2 = `${DISCOVERY_URL}/salesShipments?$skiptoken=page2`;
      const page3 = `${DISCOVERY_URL}/salesShipments?$skiptoken=page3`;
      const fetchMock = mockBc((url) => {
        const skipToken = url.searchParams.get("$skiptoken");
        if (skipToken === "page2") {
          return jsonResponse({ value: [headerRow("S-3"), headerRow("S-4")], "@odata.nextLink": page3 });
        }
        if (skipToken === "page3") {
          return jsonResponse({ value: [headerRow("S-5")] });
        }
        return jsonResponse({ value: [headerRow("S-1"), headerRow("S-2")], "@odata.nextLink": page2 });
      });
      const service = new BusinessCentralModuleService();

      const headers = await service.listShipmentHeaders({ after: AFTER, until: UNTIL });

      expect(headers.map((header) => header.number)).toEqual(["S-1", "S-2", "S-3", "S-4", "S-5"]);
      const requests = shipmentRequests(fetchMock);
      expect(requests).toHaveLength(3);
      expect(requests.every(({ init }) => headerValue(init, "prefer") === "odata.maxpagesize=200")).toBe(
        true
      );
    });

    it("throws when a later page fails instead of returning a partial window", async () => {
      const page2 = `${DISCOVERY_URL}/salesShipments?$skiptoken=page2`;
      mockBc((url) =>
        url.searchParams.get("$skiptoken") === "page2"
          ? jsonResponse({ error: { code: "Internal" } }, 500)
          : jsonResponse({ value: [headerRow("S-1")], "@odata.nextLink": page2 })
      );
      const service = new BusinessCentralModuleService();

      await expect(service.listShipmentHeaders({ after: AFTER, until: UNTIL })).rejects.toThrow(
        "status 500"
      );
    });

    it("refuses a nextLink that points away from Business Central", async () => {
      const fetchMock = mockBc(() =>
        jsonResponse({ value: [headerRow("S-1")], "@odata.nextLink": "https://evil.example/salesShipments" })
      );
      const service = new BusinessCentralModuleService();

      await expect(service.listShipmentHeaders({ after: AFTER, until: UNTIL })).rejects.toThrow(
        "nextLink"
      );
      expect(fetchMock.mock.calls.some(([input]) => String(input).includes("evil.example"))).toBe(
        false
      );
    });

    it("maps header fields, turning empty strings into null", async () => {
      mockBc(() =>
        jsonResponse({
          value: [
            {
              ...headerRow("S-1", "2026-10-19T10:01:02.123Z"),
              orderNumber: "",
              externalDocumentNumber: "",
              postingDate: "",
            },
          ],
        })
      );
      const service = new BusinessCentralModuleService();

      const [header] = await service.listShipmentHeaders({ after: AFTER, until: UNTIL });

      expect(header).toEqual({
        id: "guid-S-1",
        number: "S-1",
        orderNumber: null,
        externalDocumentNumber: null,
        customerNumber: "10000",
        postingDate: null,
        lastModifiedDateTime: "2026-10-19T10:01:02.123Z",
      });
    });
  });

  describe("getShipmentsByNumbers", () => {
    it("reads 45 numbers in 3 OR-filtered requests of at most 20", async () => {
      const fetchMock = mockBc(() => jsonResponse({ value: [] }));
      const service = new BusinessCentralModuleService();
      const numbers = Array.from({ length: 45 }, (_, index) => `S-${index + 1}`);

      await service.getShipmentsByNumbers(numbers);

      const filters = shipmentRequests(fetchMock).map(({ url }) => url.searchParams.get("$filter") ?? "");
      expect(filters).toHaveLength(3);
      expect(filters.map((filter) => filter.split(" or ").length)).toEqual([20, 20, 5]);
      expect(filters[0].startsWith("number eq 'S-1' or number eq 'S-2'")).toBe(true);
    });

    it("escapes a quote in a shipment number", async () => {
      const fetchMock = mockBc(() => jsonResponse({ value: [] }));
      const service = new BusinessCentralModuleService();

      await service.getShipmentsByNumbers(["O'BRIEN-1"]);

      const [{ url }] = shipmentRequests(fetchMock);
      expect(url.searchParams.get("$filter")).toBe("number eq 'O''BRIEN-1'");
    });

    it("makes no request for an empty list", async () => {
      const fetchMock = mockBc(() => jsonResponse({ value: [] }));
      const service = new BusinessCentralModuleService();

      await expect(service.getShipmentsByNumbers([])).resolves.toEqual([]);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("expands lines and returns the full shipment; unknown numbers are simply absent", async () => {
      const fetchMock = mockBc(() =>
        jsonResponse({
          value: [
            {
              ...headerRow("S-1", "2026-10-19T10:01:02.123Z"),
              customerName: "Kunde A/S",
              customerPurchaseOrderReference: "Ref 9",
              shipmentMethodCode: "",
              sellToAddressLine1: "Vej 1",
              sellToAddressLine2: "",
              sellToCity: "Aarhus",
              sellToState: "",
              sellToPostCode: "8000",
              sellToCountry: "DK",
              billToCustomerNumber: "10001",
              billToName: "Kunde Holding",
              billToAddressLine1: "Vej 2",
              billToAddressLine2: "",
              billToCity: "Odense",
              billToState: "",
              billToPostCode: "5000",
              billToCountry: "DK",
              shipToName: "Lager",
              shipToContact: "",
              shipToAddressLine1: "Vej 3",
              shipToAddressLine2: "",
              shipToCity: "Vejle",
              shipToState: "",
              shipToPostCode: "7100",
              shipToCountry: "DK",
              salesShipmentLines: [
                {
                  sequence: 20000,
                  lineType: "Item",
                  lineObjectNumber: "ITEM-2",
                  description: "Jakke",
                  description2: "",
                  unitOfMeasureCode: "PCS",
                  quantity: 3,
                  shipmentDate: "2026-10-19",
                },
                {
                  sequence: 10000,
                  lineType: "Item",
                  lineObjectNumber: "ITEM-1",
                  description: "Vest",
                  description2: "Sort",
                  unitOfMeasureCode: "PCS",
                  quantity: 1,
                  shipmentDate: "2026-10-18",
                },
              ],
            },
          ],
        })
      );
      const service = new BusinessCentralModuleService();

      const shipments = await service.getShipmentsByNumbers(["S-1", "S-UNKNOWN"]);

      const [{ url }] = shipmentRequests(fetchMock);
      expect(url.searchParams.get("$expand")).toMatch(/^salesShipmentLines\(\$select=/);
      expect(shipments).toEqual([
        {
          id: "guid-S-1",
          number: "S-1",
          orderNumber: "SO-1001",
          externalDocumentNumber: "PO-77",
          customerNumber: "10000",
          postingDate: "2026-10-19",
          lastModifiedDateTime: "2026-10-19T10:01:02.123Z",
          shipmentMethodCode: null,
          yourReference: "Ref 9",
          sellTo: {
            customerNumber: "10000",
            name: "Kunde A/S",
            addressLine1: "Vej 1",
            addressLine2: null,
            city: "Aarhus",
            state: null,
            postCode: "8000",
            country: "DK",
          },
          billTo: {
            customerNumber: "10001",
            name: "Kunde Holding",
            addressLine1: "Vej 2",
            addressLine2: null,
            city: "Odense",
            state: null,
            postCode: "5000",
            country: "DK",
          },
          shipTo: {
            name: "Lager",
            contact: null,
            addressLine1: "Vej 3",
            addressLine2: null,
            city: "Vejle",
            state: null,
            postCode: "7100",
            country: "DK",
          },
          // As given: sorting is the decision's job.
          lines: [
            {
              sequence: 20000,
              lineType: "item",
              itemNumber: "ITEM-2",
              description: "Jakke",
              description2: null,
              unitOfMeasureCode: "PCS",
              quantity: 3,
              shipmentDate: "2026-10-19",
            },
            {
              sequence: 10000,
              lineType: "item",
              itemNumber: "ITEM-1",
              description: "Vest",
              description2: "Sort",
              unitOfMeasureCode: "PCS",
              quantity: 1,
              shipmentDate: "2026-10-18",
            },
          ],
        },
      ]);
    });

    it("decodes each line type and maps empty strings and empty BC dates to null", async () => {
      mockBc(() =>
        jsonResponse({
          value: [
            {
              ...headerRow("S-1"),
              salesShipmentLines: [
                { sequence: 10000, lineType: "Item", lineObjectNumber: "A", quantity: 1, shipmentDate: "2026-10-19" },
                { sequence: 20000, lineType: "_x0020_", lineObjectNumber: "", description: "Note", quantity: 0, shipmentDate: "" },
                { sequence: 30000, lineType: "G_x002F_L_x0020_Account", lineObjectNumber: "6100", quantity: 1, shipmentDate: "0001-01-01" },
                { sequence: 40000, lineType: "Resource", lineObjectNumber: "R1", quantity: 2, shipmentDate: "2026-10-19" },
              ],
            },
          ],
        })
      );
      const service = new BusinessCentralModuleService();

      const [shipment] = await service.getShipmentsByNumbers(["S-1"]);

      expect(shipment.lines.map((line) => line.lineType)).toEqual(["item", "comment", "other", "other"]);
      expect(shipment.lines[1]).toEqual({
        sequence: 20000,
        lineType: "comment",
        itemNumber: null,
        description: "Note",
        description2: null,
        unitOfMeasureCode: null,
        quantity: 0,
        shipmentDate: null,
      });
      expect(shipment.lines[2].shipmentDate).toBeNull();
    });
  });

  describe("failures", () => {
    it("throws a throttling error carrying Retry-After seconds on 429", async () => {
      mockBc(() => jsonResponse({}, 429, { "Retry-After": "120" }));
      const service = new BusinessCentralModuleService();

      const error = await service.countShipments({ after: AFTER, until: UNTIL }).catch((e: unknown) => e);

      expect(error).toBeInstanceOf(BusinessCentralThrottledError);
      expect((error as BusinessCentralThrottledError).retryAfterSeconds).toBe(120);
    });

    it("throws a throttling error on 503, with null seconds when Retry-After is absent", async () => {
      mockBc(() => jsonResponse({}, 503));
      const service = new BusinessCentralModuleService();

      const error = await service
        .getShipmentsByNumbers(["S-1"])
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(BusinessCentralThrottledError);
      expect((error as BusinessCentralThrottledError).retryAfterSeconds).toBeNull();
    });

    it("reads Retry-After given as an HTTP date", () => {
      const now = Date.parse("2026-10-19T10:00:00Z");

      expect(parseRetryAfterSeconds("Mon, 19 Oct 2026 10:01:30 GMT", now)).toBe(90);
      expect(parseRetryAfterSeconds("soon", now)).toBeNull();
    });

    it("throws a non-throttling error on other failures", async () => {
      mockBc(() => jsonResponse({}, 400));
      const service = new BusinessCentralModuleService();

      const error = await service.listShipmentHeaders({ after: AFTER, until: UNTIL }).catch((e: unknown) => e);

      expect(error).toBeInstanceOf(Error);
      expect(error).not.toBeInstanceOf(BusinessCentralThrottledError);
      expect((error as Error).message).toContain("status 400");
    });

    it("gives every request a 20-second timeout and throws when it fires", async () => {
      const controller = new AbortController();
      const timeoutSpy = jest.spyOn(AbortSignal, "timeout").mockReturnValue(controller.signal);
      mockBc(
        (_url, init) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
            controller.abort(new DOMException("The operation timed out.", "TimeoutError"));
          })
      );
      const service = new BusinessCentralModuleService();

      await expect(service.listShipmentHeaders({ after: AFTER, until: UNTIL })).rejects.toThrow(
        "did not complete"
      );
      expect(timeoutSpy).toHaveBeenCalledWith(20000);
      expect(timeoutSpy.mock.calls.every(([ms]) => ms === 20000)).toBe(true);
    });
  });

  describe("token reuse", () => {
    it("reuses one token within its lifetime and requests a new one 5 minutes before expiry", async () => {
      const nowSpy = jest.spyOn(Date, "now").mockReturnValue(1_000_000);
      const fetchMock = mockBc(() => jsonResponse({ "@odata.count": 0, value: [] }));
      const service = new BusinessCentralModuleService();

      await service.countShipments({ after: AFTER, until: UNTIL });
      await service.listShipmentHeaders({ after: AFTER, until: UNTIL });
      expect(tokenRequestCount(fetchMock)).toBe(1);

      // 3,599 s lifetime: still valid just under 5 minutes before expiry...
      nowSpy.mockReturnValue(1_000_000 + (3599 - 300) * 1000 - 1);
      await service.getShipmentsByNumbers(["S-1"]);
      expect(tokenRequestCount(fetchMock)).toBe(1);

      // ...and renewed from 5 minutes before expiry.
      nowSpy.mockReturnValue(1_000_000 + (3599 - 300) * 1000);
      await service.getShipmentsByNumbers(["S-1"]);
      expect(tokenRequestCount(fetchMock)).toBe(2);
      const authorizations = shipmentRequests(fetchMock).map(({ init }) => headerValue(init, "authorization"));
      expect(authorizations.every((value) => value === "Bearer access-token")).toBe(true);
    });
  });

  describe("getShipmentLineVariants", () => {
    const noShipments = () => jsonResponse({ value: [] });

    it("reads 45 numbers in 3 OR-filtered GETs of only documentNumber, lineNo and variantCode", async () => {
      const fetchMock = mockBc(noShipments, { variants: () => jsonResponse({ value: [] }) });
      const service = new BusinessCentralModuleService();
      const numbers = Array.from({ length: 45 }, (_, index) => `S-${index + 1}`);

      await service.getShipmentLineVariants(numbers);

      const requests = variantRequests(fetchMock);
      expect(requests).toHaveLength(3);
      const filters = requests.map(({ url }) => url.searchParams.get("$filter") ?? "");
      expect(filters.map((filter) => filter.split(" or ").length)).toEqual([20, 20, 5]);
      expect(filters[0].startsWith("documentNumber eq 'S-1' or documentNumber eq 'S-2'")).toBe(true);
      expect(filters[2].endsWith("documentNumber eq 'S-45'")).toBe(true);
      for (const { url, init } of requests) {
        expect(url.origin + url.pathname).toBe(VARIANTS_URL);
        expect(init?.method).toBe("GET");
        expect(url.searchParams.get("$select")).toBe("documentNumber,lineNo,variantCode");
        expect(url.searchParams.get("company")).toBe("'Nimbus Nordic A/S'");
        expect(headerValue(init, "prefer")).toBe("odata.maxpagesize=200");
      }
    });

    it("escapes a quote in a shipment number and in the company name", async () => {
      const fetchMock = mockBc(noShipments, {
        company: () => jsonResponse({ name: "Nimbus's A/S" }),
        variants: () => jsonResponse({ value: [] }),
      });
      const service = new BusinessCentralModuleService();

      await service.getShipmentLineVariants(["O'BRIEN-1"]);

      const [{ url }] = variantRequests(fetchMock);
      expect(url.searchParams.get("$filter")).toBe("documentNumber eq 'O''BRIEN-1'");
      expect(url.searchParams.get("company")).toBe("'Nimbus''s A/S'");
    });

    it("makes no request for an empty list", async () => {
      const fetchMock = mockBc(noShipments, { variants: () => jsonResponse({ value: [] }) });
      const service = new BusinessCentralModuleService();

      await expect(service.getShipmentLineVariants([])).resolves.toEqual([]);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("maps rows to shipment number, line number and a trimmed variant code, empty as null", async () => {
      mockBc(noShipments, {
        variants: () =>
          jsonResponse({
            value: [
              variantRow("30947954", 10000, "M"),
              variantRow("30947954", 20000, ""),
              variantRow("30947954", 30000, " L "),
            ],
          }),
      });
      const service = new BusinessCentralModuleService();

      await expect(service.getShipmentLineVariants(["30947954", "UNKNOWN"])).resolves.toEqual([
        { shipmentNumber: "30947954", lineNumber: 10000, variantCode: "M" },
        { shipmentNumber: "30947954", lineNumber: 20000, variantCode: null },
        { shipmentNumber: "30947954", lineNumber: 30000, variantCode: "L" },
      ]);
    });

    it.each([
      ["a non-numeric lineNo", variantRow("S-1", "10000", "M"), "lineNo"],
      ["a missing documentNumber", { lineNo: 10000, variantCode: "M" }, "documentNumber"],
      ["a missing variantCode", { documentNumber: "S-1", lineNo: 10000 }, "variantCode"],
    ])("throws on %s", async (_case, row, field) => {
      mockBc(noShipments, { variants: () => jsonResponse({ value: [row] }) });
      const service = new BusinessCentralModuleService();

      await expect(service.getShipmentLineVariants(["S-1"])).rejects.toThrow(field);
    });

    it("follows next links on the Business Central origin to the end", async () => {
      const page2 = `${VARIANTS_URL}?$skiptoken=page2`;
      const page3 = `${VARIANTS_URL}?$skiptoken=page3`;
      const fetchMock = mockBc(noShipments, {
        variants: (url) => {
          const skipToken = url.searchParams.get("$skiptoken");
          if (skipToken === "page2") {
            return jsonResponse({ value: [variantRow("S-1", 20000, "L")], "@odata.nextLink": page3 });
          }
          if (skipToken === "page3") {
            return jsonResponse({ value: [variantRow("S-2", 10000, "")] });
          }
          return jsonResponse({ value: [variantRow("S-1", 10000, "M")], "@odata.nextLink": page2 });
        },
      });
      const service = new BusinessCentralModuleService();

      const rows = await service.getShipmentLineVariants(["S-1", "S-2"]);

      expect(rows.map((row) => [row.shipmentNumber, row.lineNumber])).toEqual([
        ["S-1", 10000],
        ["S-1", 20000],
        ["S-2", 10000],
      ]);
      expect(variantRequests(fetchMock)).toHaveLength(3);
    });

    it("refuses a next link away from Business Central and never requests it", async () => {
      const fetchMock = mockBc(noShipments, {
        variants: () =>
          jsonResponse({
            value: [variantRow("S-1", 10000, "M")],
            "@odata.nextLink": "https://evil.example/ODataV4/TRCShipmentLine?$skiptoken=2",
          }),
      });
      const service = new BusinessCentralModuleService();

      await expect(service.getShipmentLineVariants(["S-1"])).rejects.toThrow("nextLink");
      expect(fetchMock.mock.calls.some(([input]) => String(input).includes("evil.example"))).toBe(false);
    });

    it("throws when a later page fails instead of returning a partial result", async () => {
      const page2 = `${VARIANTS_URL}?$skiptoken=page2`;
      mockBc(noShipments, {
        variants: (url) =>
          url.searchParams.get("$skiptoken") === "page2"
            ? jsonResponse({ error: { code: "Internal" } }, 500)
            : jsonResponse({ value: [variantRow("S-1", 10000, "M")], "@odata.nextLink": page2 }),
      });
      const service = new BusinessCentralModuleService();

      await expect(service.getShipmentLineVariants(["S-1"])).rejects.toThrow("status 500");
    });

    it.each([
      ["429 on the variant read", "variants", 429, { "Retry-After": "30" }, 30],
      ["503 on the variant read", "variants", 503, {}, null],
      ["429 on the company-name read", "company", 429, { "Retry-After": "45" }, 45],
      ["503 on the company-name read", "company", 503, {}, null],
    ] as const)("throws a throttling error on %s", async (_case, target, status, headers, seconds) => {
      const fetchMock = mockBc(noShipments, {
        [target]: () => jsonResponse({}, status, headers),
        ...(target === "company" ? { variants: () => jsonResponse({ value: [] }) } : {}),
      });
      const service = new BusinessCentralModuleService();

      const error = await service.getShipmentLineVariants(["S-1"]).catch((e: unknown) => e);

      expect(error).toBeInstanceOf(BusinessCentralThrottledError);
      expect((error as BusinessCentralThrottledError).retryAfterSeconds).toBe(seconds);
      if (target === "company") {
        expect(variantRequests(fetchMock)).toHaveLength(0);
      }
    });

    it.each(["variants", "company"] as const)(
      "throws a non-throttling error without BC response text on a 400 from the %s read",
      async (target) => {
        mockBc(noShipments, {
          variants: () => jsonResponse({ value: [] }),
          [target]: () => jsonResponse({ error: { message: "BC-SECRET-DETAIL" } }, 400),
        });
        const service = new BusinessCentralModuleService();

        const error = await service.getShipmentLineVariants(["S-1"]).catch((e: unknown) => e);

        expect(error).toBeInstanceOf(Error);
        expect(error).not.toBeInstanceOf(BusinessCentralThrottledError);
        expect((error as Error).message).toContain("status 400");
        expect((error as Error).message).not.toContain("BC-SECRET-DETAIL");
      }
    );

    it("gives the token, company-name and variant requests a 20-second timeout", async () => {
      const timeoutSpy = jest.spyOn(AbortSignal, "timeout");
      const fetchMock = mockBc(noShipments, { variants: () => jsonResponse({ value: [] }) });
      const service = new BusinessCentralModuleService();

      await service.getShipmentLineVariants(["S-1"]);

      expect(fetchMock).toHaveBeenCalledTimes(3);
      expect(fetchMock.mock.calls.every(([, init]) => (init as RequestInit | undefined)?.signal)).toBe(true);
      expect(timeoutSpy).toHaveBeenCalledTimes(3);
      expect(timeoutSpy.mock.calls.every(([ms]) => ms === 20000)).toBe(true);
    });

    it("throws when the variant request times out", async () => {
      const controller = new AbortController();
      jest.spyOn(AbortSignal, "timeout").mockReturnValue(controller.signal);
      mockBc(noShipments, {
        variants: (_url, init) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
            controller.abort(new DOMException("The operation timed out.", "TimeoutError"));
          }),
      });
      const service = new BusinessCentralModuleService();

      await expect(service.getShipmentLineVariants(["S-1"])).rejects.toThrow("did not complete");
    });

    it("starts no request when the deadline has passed", async () => {
      jest.spyOn(Date, "now").mockReturnValue(1000);
      const fetchMock = mockBc(noShipments, { variants: () => jsonResponse({ value: [] }) });
      const service = new BusinessCentralModuleService();

      await expect(service.getShipmentLineVariants(["S-1"], 1000)).rejects.toMatchObject({
        name: "ShipmentReadDeadlineError",
      });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("starts no company-name or variant request past the deadline with a cached token", async () => {
      const now = jest.spyOn(Date, "now").mockReturnValue(1000);
      const fetchMock = mockBc(noShipments, { variants: () => jsonResponse({ value: [] }) });
      const service = new BusinessCentralModuleService();
      await service.getShipmentsByNumbers(["S-1"]);
      now.mockReturnValue(2000);

      await expect(service.getShipmentLineVariants(["S-1"], 2000)).rejects.toMatchObject({
        name: "ShipmentReadDeadlineError",
      });
      expect(companyRequests(fetchMock)).toHaveLength(0);
      expect(variantRequests(fetchMock)).toHaveLength(0);
    });

    it("starts no variant request when the company-name read ends past the deadline", async () => {
      const now = jest.spyOn(Date, "now").mockReturnValue(1000);
      const fetchMock = mockBc(noShipments, {
        company: () => {
          now.mockReturnValue(1100);
          return jsonResponse({ name: "Nimbus Nordic A/S" });
        },
        variants: () => jsonResponse({ value: [] }),
      });
      const service = new BusinessCentralModuleService();

      await expect(service.getShipmentLineVariants(["S-1"], 1100)).rejects.toMatchObject({
        name: "ShipmentReadDeadlineError",
      });
      expect(variantRequests(fetchMock)).toHaveLength(0);
    });

    it("does not start another chunk after the deadline", async () => {
      const now = jest.spyOn(Date, "now").mockReturnValue(1000);
      const fetchMock = mockBc(noShipments, {
        variants: () => {
          now.mockReturnValue(1100);
          return jsonResponse({ value: [] });
        },
      });
      const service = new BusinessCentralModuleService();

      await expect(
        service.getShipmentLineVariants(Array.from({ length: 21 }, (_, i) => `S-${i}`), 1100)
      ).rejects.toMatchObject({ name: "ShipmentReadDeadlineError" });
      expect(variantRequests(fetchMock)).toHaveLength(1);
    });

    it("reads the company name once per shipment-read token and uses that token for every read", async () => {
      const nowSpy = jest.spyOn(Date, "now").mockReturnValue(1_000_000);
      let tokenCount = 0;
      const fetchMock = mockBc(noShipments, {
        token: () => {
          tokenCount += 1;
          return tokenResponse(`token-${tokenCount}`);
        },
        variants: () => jsonResponse({ value: [] }),
      });
      const service = new BusinessCentralModuleService();

      await service.getShipmentsByNumbers(["S-1"]);
      await service.getShipmentLineVariants(["S-1"]);
      await service.getShipmentLineVariants(["S-2"]);
      expect(tokenRequestCount(fetchMock)).toBe(1);
      expect(companyRequests(fetchMock)).toHaveLength(1);

      // Renewed 5 minutes before the 3,599 s lifetime ends.
      nowSpy.mockReturnValue(1_000_000 + (3599 - 300) * 1000);
      await service.getShipmentsByNumbers(["S-1"]);
      await service.getShipmentLineVariants(["S-1"]);
      await service.getShipmentLineVariants(["S-2"]);
      expect(tokenRequestCount(fetchMock)).toBe(2);
      expect(companyRequests(fetchMock)).toHaveLength(2);

      const authorization = ({ init }: { init: RequestInit | undefined }) => headerValue(init, "authorization");
      expect(shipmentRequests(fetchMock).map(authorization)).toEqual(["Bearer token-1", "Bearer token-2"]);
      expect(companyRequests(fetchMock).map(authorization)).toEqual(["Bearer token-1", "Bearer token-2"]);
      expect(variantRequests(fetchMock).map(authorization)).toEqual([
        "Bearer token-1",
        "Bearer token-1",
        "Bearer token-2",
        "Bearer token-2",
      ]);
    });
  });
});
