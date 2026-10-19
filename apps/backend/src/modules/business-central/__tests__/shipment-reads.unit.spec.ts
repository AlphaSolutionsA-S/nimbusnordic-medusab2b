import BusinessCentralModuleService from "../service";
import { BusinessCentralThrottledError, parseRetryAfterSeconds } from "../shipment-reads";

const originalFetch = global.fetch;
const DISCOVERY_URL =
  "https://api.businesscentral.dynamics.com/v2.0/tenant-id/Sandbox/api/v2.0";
const SHIPMENTS_PATH = "/salesShipments";

type FetchHandler = (url: URL, init: RequestInit | undefined) => Promise<Response> | Response;

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers });
}

function tokenResponse(accessToken = "access-token", expiresIn = 3599): Response {
  return jsonResponse({ access_token: accessToken, token_type: "Bearer", expires_in: expiresIn });
}

function mockBc(handleShipments: FetchHandler): jest.Mock {
  const fetchMock = jest.fn(async (input: string | URL, init?: RequestInit) => {
    const url = new URL(String(input));

    if (url.hostname === "login.microsoftonline.com") {
      return tokenResponse();
    }
    if (url.pathname.endsWith(SHIPMENTS_PATH)) {
      return handleShipments(url, init);
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
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  describe("countShipments", () => {
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
});
