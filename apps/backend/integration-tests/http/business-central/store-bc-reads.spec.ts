import type { Logger } from "@medusajs/framework/types";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { medusaIntegrationTestRunner } from "@medusajs/test-utils";

import { BUSINESS_CENTRAL_MODULE } from "../../../src/modules/business-central";
import { businessCentralConfigurationError } from "../../../src/modules/business-central/environment-config";
import { BusinessCentralAmbiguousOutcomeError } from "../../../src/modules/business-central/service";
import type {
  BCListOrdersResult,
  BCListReturnsResult,
  BCOrderDetail,
  BCReturnDetail,
  BCReturnOrder,
  BCReturnReason,
  BusinessCentralEnvironment,
  IBusinessCentralModuleService,
} from "../../../src/modules/business-central/types";
import { COMPANY_MODULE } from "../../../src/modules/company";
import type { ICompanyModuleService } from "../../../src/types";
import { adminHeaders, createAdminUser, createStoreUser } from "../../utils/admin";
import { generatePublishableKey, generateStoreHeaders } from "../../utils/store";

jest.setTimeout(60 * 1000);

const CUSTOMER_NUMBER = "00088888";

const ordersResult: BCListOrdersResult = {
  orders: [
    {
      id: "order-1",
      number: "SO-1001",
      orderDate: "2026-10-01",
      customerNumber: CUSTOMER_NUMBER,
      customerName: "Store Reads Company",
      billToAddress: ["Street 1"],
      shipToAddress: ["Street 1"],
      status: "Open",
      invoiceStatus: "open",
      currencyCode: "NOK",
      totalAmountExcludingTax: 100,
      totalAmountIncludingTax: 125,
    },
  ],
  count: 1,
  offset: 0,
  limit: 20,
};

const orderDetail: BCOrderDetail = {
  ...ordersResult.orders[0],
  lines: [],
  invoices: [],
};

const returnsResult: BCListReturnsResult = {
  returns: [
    {
      id: "return-1",
      number: "RO-2001",
      documentDate: "2026-10-02",
      status: "Open",
      state: "open",
      source: "return_order",
      itemCount: 1,
      receipts: [],
    },
  ],
  count: 1,
  offset: 0,
  limit: 20,
};

const returnDetail: BCReturnDetail = {
  id: "return-1",
  number: "RO-2001",
  documentDate: "2026-10-02",
  status: "Open",
  state: "open",
  source: "return_order",
  lines: [],
  expectedCredit: {
    currencyCode: "NOK",
    amountIncludingTax: 125,
    amountExcludingTax: 100,
  },
  receipts: [],
};

const returnReasons: BCReturnReason[] = [{ id: "DAMAGED", description: "Damaged" }];

// Stands in for a call a case expects not to happen, so a regression never reaches Business Central.
const unexpectedCall = new Error("unexpected Business Central call");

medusaIntegrationTestRunner({
  inApp: true,
  env: {
    JWT_SECRET: "supersecret",
  },
  testSuite: ({ api, getContainer }) => {
    let authenticatedStoreHeaders;

    beforeEach(async () => {
      const container = getContainer();
      await createAdminUser(adminHeaders, container);
      const publishableKey = await generatePublishableKey(container);
      const publishableStoreHeaders = generateStoreHeaders({ publishableKey });
      const storeUser = await createStoreUser({
        api,
        storeHeaders: publishableStoreHeaders,
      });
      authenticatedStoreHeaders = {
        headers: {
          ...publishableStoreHeaders.headers,
          authorization: ["Bearer", storeUser.token].join(" "),
        },
      };
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    function bcService(): IBusinessCentralModuleService {
      return getContainer().resolve<IBusinessCentralModuleService>(
        BUSINESS_CENTRAL_MODULE
      );
    }

    // Registers a company through the store route (the customer becomes its employee), then sets
    // the stored country and customer number the routing reads.
    async function createCustomerCompany(
      country: string | null,
      businessCentralCustomerNumber: string | null
    ): Promise<void> {
      const response = await api.post(
        "/store/companies",
        {
          name: "Store Reads Company",
          email: "store-reads@example.com",
          phone: "12345678",
          address: "Street 1",
          city: "City",
          state: "State",
          zip: "1000",
          country: "DK",
          logo_url: "https://example.com/logo.png",
          currency_code: "DKK",
          spending_limit_reset_frequency: "monthly",
        },
        authenticatedStoreHeaders
      );
      const companyId = response.data.companies[0].id as string;

      await getContainer()
        .resolve<ICompanyModuleService>(COMPANY_MODULE)
        .updateCompanies({
          id: companyId,
          country,
          business_central_customer_number: businessCentralCustomerNumber,
        });
    }

    describe.each<[string, string | null, BusinessCentralEnvironment]>([
      ["NO", "NO", "NO"],
      ["DK", "DK", "DK"],
      ["blank", null, "DK"],
    ])("for a company with country %s", (_label, country, environment) => {
      beforeEach(async () => {
        await createCustomerCompany(country, CUSTOMER_NUMBER);
      });

      it(`lists orders from ${environment} with the company's number`, async () => {
        const listOrders = jest
          .spyOn(bcService(), "listOrders")
          .mockResolvedValueOnce(ordersResult);

        const response = await api.get("/store/bc-orders", authenticatedStoreHeaders);

        expect(response.status).toBe(200);
        expect(listOrders).toHaveBeenCalledWith(
          environment,
          expect.objectContaining({ customerNumber: CUSTOMER_NUMBER, limit: 20, offset: 0 })
        );
        expect(response.data).toEqual(ordersResult);
        expect(typeof response.data.count).toBe("number");
        expect(typeof response.data.orders[0].number).toBe("string");
        expect(typeof response.data.orders[0].totalAmountIncludingTax).toBe("number");
      });

      it(`reads an order from ${environment} with the company's number`, async () => {
        const getOrder = jest
          .spyOn(bcService(), "getOrder")
          .mockResolvedValueOnce(orderDetail);

        const response = await api.get("/store/bc-orders/SO-1001", authenticatedStoreHeaders);

        expect(response.status).toBe(200);
        expect(getOrder).toHaveBeenCalledWith(environment, {
          customerNumber: CUSTOMER_NUMBER,
          orderNumber: "SO-1001",
        });
        expect(response.data).toEqual({ order: orderDetail });
        expect(Array.isArray(response.data.order.lines)).toBe(true);
      });

      it(`lists returns from ${environment} with the company's number`, async () => {
        const listReturns = jest
          .spyOn(bcService(), "listReturns")
          .mockResolvedValueOnce(returnsResult);

        const response = await api.get("/store/bc-returns", authenticatedStoreHeaders);

        expect(response.status).toBe(200);
        expect(listReturns).toHaveBeenCalledWith(
          environment,
          expect.objectContaining({ customerNumber: CUSTOMER_NUMBER, limit: 20, offset: 0 })
        );
        expect(response.data).toEqual(returnsResult);
        expect(typeof response.data.count).toBe("number");
        expect(typeof response.data.returns[0].number).toBe("string");
        expect(Array.isArray(response.data.returns[0].receipts)).toBe(true);
      });

      it(`reads a return from ${environment} with the company's number`, async () => {
        const getReturn = jest
          .spyOn(bcService(), "getReturn")
          .mockResolvedValueOnce(returnDetail);

        const response = await api.get("/store/bc-returns/RO-2001", authenticatedStoreHeaders);

        expect(response.status).toBe(200);
        expect(getReturn).toHaveBeenCalledWith(environment, {
          customerNumber: CUSTOMER_NUMBER,
          returnNumber: "RO-2001",
        });
        expect(response.data).toEqual({ return: returnDetail });
        expect(typeof response.data.return.expectedCredit.currencyCode).toBe("string");
      });

      it(`lists return reasons from ${environment}`, async () => {
        const listReturnReasons = jest
          .spyOn(bcService(), "listReturnReasons")
          .mockResolvedValueOnce(returnReasons);

        const response = await api.get(
          "/store/bc-orders/return-reasons",
          authenticatedStoreHeaders
        );

        expect(response.status).toBe(200);
        expect(listReturnReasons).toHaveBeenCalledWith(environment);
        expect(response.data).toEqual({ return_reasons: returnReasons });
      });
    });

    describe("creating a return", () => {
      const sourceOrder: BCOrderDetail = {
        ...orderDetail,
        lines: [
          {
            id: "line-1",
            sequence: 10000,
            lineType: "Item",
            itemNumber: "ITEM-1",
            description: "Item 1",
            quantity: 2,
            unitPrice: 50,
            lineAmount: 100,
            shippedQuantity: 2,
            returnableQuantity: 2,
            reservations: [],
          },
        ],
      };
      const createdReturn: BCReturnOrder = {
        id: "RO-3001",
        number: "RO-3001",
        status: "Open",
        requestId: "RET-000000000000",
        sourceOrderNo: "SO-1001",
        lines: [{ sourceLineNo: 10000, quantityToReturn: 1, returnReasonCode: "NORMAL" }],
      };
      const body = {
        lines: [{ source_line_no: 10000, quantity: 1, return_reason_code: "NORMAL" }],
      };

      it.each<[string, BusinessCentralEnvironment]>([
        ["NO", "NO"],
        ["DK", "DK"],
      ])(
        "reads the order and creates the return in %s for a company with that country",
        async (country, environment) => {
          await createCustomerCompany(country, CUSTOMER_NUMBER);
          const getOrder = jest
            .spyOn(bcService(), "getOrder")
            .mockResolvedValueOnce(sourceOrder);
          const createReturn = jest
            .spyOn(bcService(), "createReturnFromSalesOrder")
            .mockResolvedValueOnce(createdReturn);

          const response = await api.post(
            "/store/bc-orders/SO-1001/returns",
            body,
            authenticatedStoreHeaders
          );

          expect(response.status).toBe(200);
          expect(getOrder).toHaveBeenCalledWith(environment, {
            customerNumber: CUSTOMER_NUMBER,
            orderNumber: "SO-1001",
          });
          expect(createReturn).toHaveBeenCalledWith(environment, {
            requestId: expect.stringMatching(/^RET-[0-9A-F]{12}$/),
            sourceOrderNo: "SO-1001",
            lines: [{ sourceLineNo: 10000, quantityToReturn: 1, returnReasonCode: "NORMAL" }],
          });
          expect(response.data).toEqual({ return: createdReturn });
          expect(typeof response.data.return.number).toBe("string");
        }
      );

      it("answers 404 without creating a return when the order is not in the company's environment", async () => {
        await createCustomerCompany("NO", CUSTOMER_NUMBER);
        const getOrder = jest.spyOn(bcService(), "getOrder").mockResolvedValueOnce(null);
        const createReturn = jest
          .spyOn(bcService(), "createReturnFromSalesOrder")
          .mockRejectedValue(unexpectedCall);

        const response = await api.post("/store/bc-orders/SO-1001/returns", body, {
          ...authenticatedStoreHeaders,
          validateStatus: () => true,
        });

        expect(response.status).toBe(404);
        expect(response.data).toEqual({ message: "Order not found." });
        expect(getOrder).toHaveBeenCalledWith("NO", expect.anything());
        expect(createReturn).not.toHaveBeenCalled();
      });

      it("answers 400 for a line that cannot be returned", async () => {
        await createCustomerCompany("NO", CUSTOMER_NUMBER);
        jest.spyOn(bcService(), "getOrder").mockResolvedValueOnce(sourceOrder);
        const createReturn = jest
          .spyOn(bcService(), "createReturnFromSalesOrder")
          .mockRejectedValue(unexpectedCall);

        const response = await api.post(
          "/store/bc-orders/SO-1001/returns",
          { lines: [{ source_line_no: 99999, quantity: 1, return_reason_code: "NORMAL" }] },
          { ...authenticatedStoreHeaders, validateStatus: () => true }
        );

        expect(response.status).toBe(400);
        expect(response.data).toEqual({
          message: "One or more selected lines cannot be returned.",
        });
        expect(createReturn).not.toHaveBeenCalled();
      });

      it("answers 503 when Business Central's outcome is unknown", async () => {
        await createCustomerCompany("NO", CUSTOMER_NUMBER);
        jest.spyOn(bcService(), "getOrder").mockResolvedValueOnce(sourceOrder);
        jest
          .spyOn(bcService(), "createReturnFromSalesOrder")
          .mockRejectedValueOnce(
            new BusinessCentralAmbiguousOutcomeError(
              "Business Central return request did not complete",
              "RET-000000000000"
            )
          );

        const response = await api.post("/store/bc-orders/SO-1001/returns", body, {
          ...authenticatedStoreHeaders,
          validateStatus: () => true,
        });

        expect(response.status).toBe(503);
        expect(response.data).toEqual({
          message: "We could not confirm the return request. Please try again shortly.",
        });
      });

      it("answers the generic 500 without the setting's name for a Business Central configuration error", async () => {
        await createCustomerCompany("NO", CUSTOMER_NUMBER);
        jest
          .spyOn(bcService(), "getOrder")
          .mockRejectedValueOnce(
            businessCentralConfigurationError(
              "BUSINESS_CENTRAL_NO_DISCOVERY_URL is required (Business Central environment NO)"
            )
          );

        const response = await api.post("/store/bc-orders/SO-1001/returns", body, {
          ...authenticatedStoreHeaders,
          validateStatus: () => true,
        });

        expect(response.status).toBe(500);
        expect(response.data).toEqual({
          message: "The return request could not be completed. Please try again later.",
        });
      });

      it("rejects an environment field in the body without calling Business Central", async () => {
        await createCustomerCompany("DK", CUSTOMER_NUMBER);
        const getOrder = jest.spyOn(bcService(), "getOrder").mockRejectedValue(unexpectedCall);
        const createReturn = jest
          .spyOn(bcService(), "createReturnFromSalesOrder")
          .mockRejectedValue(unexpectedCall);

        const response = await api.post(
          "/store/bc-orders/SO-1001/returns",
          { ...body, environment: "NO" },
          { ...authenticatedStoreHeaders, validateStatus: () => true }
        );

        expect(response.status).toBe(400);
        expect(getOrder).not.toHaveBeenCalled();
        expect(createReturn).not.toHaveBeenCalled();
      });

      it("answers 400 without calling Business Central when the company has no customer number", async () => {
        await createCustomerCompany("NO", null);
        const getOrder = jest.spyOn(bcService(), "getOrder").mockRejectedValue(unexpectedCall);

        const response = await api.post("/store/bc-orders/SO-1001/returns", body, {
          ...authenticatedStoreHeaders,
          validateStatus: () => true,
        });

        expect(response.status).toBe(400);
        expect(response.data).toEqual({
          message: "No Business Central customer number configured for this company.",
        });
        expect(getOrder).not.toHaveBeenCalled();
      });
    });

    // Security (NIMBUS-261): a missing or invalid Business Central setting is the operator's
    // problem; the shopper gets a generic 500 that names no setting, and the reason is logged. The
    // real module runs, so the error is the one it throws; fetch is stubbed so nothing reaches BC.
    describe.each<[string, string, string, Record<string, string | undefined>]>([
      [
        "a Norwegian company with no NO discovery URL",
        "NO",
        "BUSINESS_CENTRAL_NO_DISCOVERY_URL",
        { BUSINESS_CENTRAL_NO_DISCOVERY_URL: undefined },
      ],
      [
        "a Danish company with an invalid client id",
        "DK",
        "BUSINESS_CENTRAL_CLIENT_ID",
        {
          BUSINESS_CENTRAL_CLIENT_ID: "not-a-guid",
          BUSINESS_CENTRAL_CLIENT_SECRET: "synthetic-test-secret",
        },
      ],
    ])("for %s", (_label, country, variable, settings) => {
      const originals = Object.fromEntries(
        Object.keys(settings).map((name) => [name, process.env[name]])
      );
      let fetchSpy: jest.SpyInstance;
      let loggerError: jest.SpyInstance;

      function applySettings(values: Record<string, string | undefined>): void {
        for (const [name, value] of Object.entries(values)) {
          if (value === undefined) {
            delete process.env[name];
          } else {
            process.env[name] = value;
          }
        }
      }

      beforeEach(async () => {
        await createCustomerCompany(country, CUSTOMER_NUMBER);
        applySettings(settings);
        fetchSpy = jest.spyOn(global, "fetch").mockRejectedValue(unexpectedCall);
        loggerError = jest.spyOn(
          getContainer().resolve<Logger>(ContainerRegistrationKeys.LOGGER),
          "error"
        );
      });

      afterEach(() => {
        applySettings(originals);
      });

      it.each([
        "/store/bc-orders",
        "/store/bc-orders/SO-1001",
        "/store/bc-orders/return-reasons",
        "/store/bc-returns",
        "/store/bc-returns/RO-2001",
      ])("answers %s with a logged generic 500", async (path) => {
        const response = await api.get(path, {
          ...authenticatedStoreHeaders,
          validateStatus: () => true,
        });

        expect(response.status).toBe(500);
        expect(response.data).toEqual({
          code: "unknown_error",
          type: "unknown_error",
          message: "An unknown error occurred.",
        });
        expect(JSON.stringify(response.data)).not.toContain("BUSINESS_CENTRAL_");
        expect(loggerError).toHaveBeenCalledWith(
          expect.objectContaining({ message: expect.stringContaining(variable) })
        );
        expect(fetchSpy).not.toHaveBeenCalled();
      });

      it("answers a return request with the logged generic 500", async () => {
        const response = await api.post(
          "/store/bc-orders/SO-1001/returns",
          { lines: [{ source_line_no: 10000, quantity: 1, return_reason_code: "NORMAL" }] },
          { ...authenticatedStoreHeaders, validateStatus: () => true }
        );

        expect(response.status).toBe(500);
        expect(response.data).toEqual({
          message: "The return request could not be completed. Please try again later.",
        });
        expect(JSON.stringify(response.data)).not.toContain("BUSINESS_CENTRAL_");
        expect(loggerError).toHaveBeenCalledWith("BC return request failed");
        expect(fetchSpy).not.toHaveBeenCalled();
      });
    });

    // Security (NIMBUS-261): Azure AD's rejection names the app and the tenant; the shopper gets the
    // generic 500 and only the log keeps Azure's reason.
    describe("when Azure AD rejects the Business Central credentials", () => {
      const appId = "11111111-2222-3333-4444-555555555555";
      const tenantId = "99999999-8888-7777-6666-555555555555";
      const credentials = {
        BUSINESS_CENTRAL_CLIENT_ID: appId,
        BUSINESS_CENTRAL_CLIENT_SECRET: "synthetic-test-secret",
      };
      const originals = Object.fromEntries(
        Object.keys(credentials).map((name) => [name, process.env[name]])
      );
      let fetchSpy: jest.SpyInstance;
      let loggerError: jest.SpyInstance;

      function applySettings(values: Record<string, string | undefined>): void {
        for (const [name, value] of Object.entries(values)) {
          if (value === undefined) {
            delete process.env[name];
          } else {
            process.env[name] = value;
          }
        }
      }

      beforeEach(async () => {
        await createCustomerCompany("DK", CUSTOMER_NUMBER);
        applySettings(credentials);
        fetchSpy = jest.spyOn(global, "fetch").mockImplementation(async (input) => {
          if (!String(input).startsWith("https://login.microsoftonline.com/")) {
            throw unexpectedCall;
          }
          return new Response(
            JSON.stringify({
              error: "invalid_client",
              error_description: `AADSTS7000215: Invalid client secret provided for app '${appId}' in tenant '${tenantId}'.`,
            }),
            { status: 401, headers: { "content-type": "application/json" } }
          );
        });
        loggerError = jest.spyOn(
          getContainer().resolve<Logger>(ContainerRegistrationKeys.LOGGER),
          "error"
        );
      });

      afterEach(() => {
        applySettings(originals);
      });

      it.each([
        "/store/bc-orders",
        "/store/bc-orders/SO-1001",
        "/store/bc-orders/return-reasons",
        "/store/bc-returns",
        "/store/bc-returns/RO-2001",
      ])("answers %s with a logged generic 500 that names neither app nor tenant", async (path) => {
        const response = await api.get(path, {
          ...authenticatedStoreHeaders,
          validateStatus: () => true,
        });

        expect(response.status).toBe(500);
        expect(response.data).toEqual({
          code: "unknown_error",
          type: "unknown_error",
          message: "An unknown error occurred.",
        });
        const body = JSON.stringify(response.data);
        expect(body).not.toContain(appId);
        expect(body).not.toContain(tenantId);
        expect(body).not.toContain("AADSTS");
        expect(loggerError).toHaveBeenCalledWith(
          expect.objectContaining({ message: expect.stringContaining("AADSTS7000215") })
        );
        expect(fetchSpy).toHaveBeenCalledTimes(1);
      });
    });

    describe("a request cannot choose the environment", () => {
      beforeEach(async () => {
        await createCustomerCompany("DK", CUSTOMER_NUMBER);
      });

      it.each(["/store/bc-orders?environment=NO", "/store/bc-returns?environment=NO"])(
        "rejects an environment parameter on %s without calling Business Central",
        async (path) => {
          const listOrders = jest
            .spyOn(bcService(), "listOrders")
            .mockRejectedValue(unexpectedCall);
          const listReturns = jest
            .spyOn(bcService(), "listReturns")
            .mockRejectedValue(unexpectedCall);

          const response = await api.get(path, {
            ...authenticatedStoreHeaders,
            validateStatus: () => true,
          });

          expect(response.status).toBe(400);
          expect(listOrders).not.toHaveBeenCalled();
          expect(listReturns).not.toHaveBeenCalled();
        }
      );

      it("ignores an environment parameter on order detail", async () => {
        const getOrder = jest
          .spyOn(bcService(), "getOrder")
          .mockResolvedValueOnce(orderDetail);

        await api.get("/store/bc-orders/SO-1001?environment=NO", authenticatedStoreHeaders);

        expect(getOrder).toHaveBeenCalledWith("DK", expect.anything());
      });

      it("ignores an environment parameter on return detail", async () => {
        const getReturn = jest
          .spyOn(bcService(), "getReturn")
          .mockResolvedValueOnce(returnDetail);

        await api.get("/store/bc-returns/RO-2001?environment=NO", authenticatedStoreHeaders);

        expect(getReturn).toHaveBeenCalledWith("DK", expect.anything());
      });

      it("ignores an environment parameter on return reasons", async () => {
        const listReturnReasons = jest
          .spyOn(bcService(), "listReturnReasons")
          .mockResolvedValueOnce(returnReasons);

        await api.get(
          "/store/bc-orders/return-reasons?environment=NO",
          authenticatedStoreHeaders
        );

        expect(listReturnReasons).toHaveBeenCalledWith("DK");
      });
    });

    describe("existing answers are kept", () => {
      it.each([
        "/store/bc-orders",
        "/store/bc-orders/SO-1001",
        "/store/bc-returns",
        "/store/bc-returns/RO-2001",
      ])("answers 400 on %s when the company has no customer number", async (path) => {
        await createCustomerCompany("NO", null);
        const service = bcService();
        const calls = [
          jest.spyOn(service, "listOrders").mockRejectedValue(unexpectedCall),
          jest.spyOn(service, "getOrder").mockRejectedValue(unexpectedCall),
          jest.spyOn(service, "listReturns").mockRejectedValue(unexpectedCall),
          jest.spyOn(service, "getReturn").mockRejectedValue(unexpectedCall),
        ];

        const response = await api.get(path, {
          ...authenticatedStoreHeaders,
          validateStatus: () => true,
        });

        expect(response.status).toBe(400);
        expect(response.data).toEqual({
          message: "No Business Central customer number configured for this company.",
        });
        calls.forEach((call) => expect(call).not.toHaveBeenCalled());
      });

      it("answers 400 when the customer has no company", async () => {
        const listOrders = jest
          .spyOn(bcService(), "listOrders")
          .mockRejectedValue(unexpectedCall);

        const response = await api.get("/store/bc-orders", {
          ...authenticatedStoreHeaders,
          validateStatus: () => true,
        });

        expect(response.status).toBe(400);
        expect(response.data).toEqual({
          message: "No Business Central customer number configured for this company.",
        });
        expect(listOrders).not.toHaveBeenCalled();
      });

      it("answers 404 for an order Business Central does not return", async () => {
        await createCustomerCompany("NO", CUSTOMER_NUMBER);
        jest.spyOn(bcService(), "getOrder").mockResolvedValueOnce(null);

        const response = await api.get("/store/bc-orders/SO-404", {
          ...authenticatedStoreHeaders,
          validateStatus: () => true,
        });

        expect(response.status).toBe(404);
        expect(response.data).toEqual({ message: "Order not found." });
      });

      it("answers 404 for a return Business Central does not return", async () => {
        await createCustomerCompany("NO", CUSTOMER_NUMBER);
        jest.spyOn(bcService(), "getReturn").mockResolvedValueOnce(null);

        const response = await api.get("/store/bc-returns/RO-404", {
          ...authenticatedStoreHeaders,
          validateStatus: () => true,
        });

        expect(response.status).toBe(404);
        expect(response.data).toEqual({ message: "Return not found." });
      });
    });
  },
});
