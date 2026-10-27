import { asValue } from "@medusajs/framework/awilix";
import {
  ContainerRegistrationKeys,
  createMedusaContainer,
  MedusaError,
} from "@medusajs/framework/utils";

import { BUSINESS_CENTRAL_MODULE } from "../../../../modules/business-central";
import { BusinessCentralAmbiguousOutcomeError } from "../../../../modules/business-central/service";
import type {
  BCOrderDetail,
  BCReturnOrder,
  BusinessCentralEnvironment,
} from "../../../../modules/business-central/types";
import type { BusinessCentralAccount } from "../../../../workflows/company/workflows/resolve-business-central-account";
import { resolveBusinessCentralAccountWorkflow } from "../../../../workflows/company/workflows/resolve-business-central-account";
import { POST } from "../[id]/returns/route";

// The account lookup needs the database; the return workflow itself runs for real, so its steps
// and the shape of a failed run are the real ones.
jest.mock(
  "../../../../workflows/company/workflows/resolve-business-central-account",
  () => ({ resolveBusinessCentralAccountWorkflow: jest.fn() })
);

type MockResponse = {
  status: jest.Mock;
  json: jest.Mock;
};

function createResponse(): MockResponse {
  const res = {} as MockResponse;
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

const sourceOrder: BCOrderDetail = {
  id: "order-1",
  number: "SO-1001",
  orderDate: "2026-10-01",
  customerNumber: "00088888",
  customerName: "Return Company",
  billToAddress: [],
  shipToAddress: [],
  status: "Open",
  invoiceStatus: "open",
  currencyCode: "NOK",
  totalAmountExcludingTax: 100,
  totalAmountIncludingTax: 125,
  lines: [
    {
      id: "line-1",
      sequence: 10000,
      lineType: "Item",
      description: "Item 1",
      quantity: 2,
      unitPrice: 50,
      lineAmount: 100,
      shippedQuantity: 2,
      returnableQuantity: 2,
      reservations: [],
    },
  ],
  invoices: [],
};

const createdReturn: BCReturnOrder = {
  id: "RO-2001",
  number: "RO-2001",
  status: "Open",
  requestId: "RET-X",
  sourceOrderNo: "SO-1001",
  lines: [{ sourceLineNo: 10000, quantityToReturn: 1, returnReasonCode: "NORMAL" }],
};

function createRequest(options: {
  customerNumber?: string | null;
  environment?: BusinessCentralEnvironment;
  getOrder?: jest.Mock;
  createReturnFromSalesOrder?: jest.Mock;
  lines?: { source_line_no: number; quantity: number; return_reason_code: string }[];
}) {
  const account: BusinessCentralAccount = {
    companyId: "comp_1",
    customerNumber:
      options.customerNumber === undefined ? "00088888" : options.customerNumber,
    environment: options.environment ?? "DK",
    notFound: null,
  };
  const run = jest.fn().mockResolvedValue({ result: account });
  jest
    .mocked(resolveBusinessCentralAccountWorkflow)
    .mockReturnValue({ run } as never);

  const bcService = {
    getOrder: options.getOrder ?? jest.fn().mockResolvedValue(sourceOrder),
    createReturnFromSalesOrder:
      options.createReturnFromSalesOrder ??
      jest.fn().mockResolvedValue(createdReturn),
  };
  const logger = { error: jest.fn(), info: jest.fn(), warn: jest.fn(), debug: jest.fn() };
  const scope = createMedusaContainer();
  scope.register(BUSINESS_CENTRAL_MODULE, asValue(bcService));
  scope.register(ContainerRegistrationKeys.LOGGER, asValue(logger));

  const req = {
    auth_context: { app_metadata: { customer_id: "cus_1" } },
    params: { id: "SO-1001" },
    validatedBody: {
      lines: options.lines ?? [
        { source_line_no: 10000, quantity: 1, return_reason_code: "NORMAL" },
      ],
    },
    scope,
  };

  return { req, run, bcService, logger };
}

describe("POST /store/bc-orders/:id/returns", () => {
  it.each<BusinessCentralEnvironment>(["NO", "DK"])(
    "reads the source order and creates the return in the company's environment (%s)",
    async (environment) => {
      const { req, run, bcService } = createRequest({ environment });
      const res = createResponse();

      await POST(req as never, res as never);

      expect(run).toHaveBeenCalledWith({ input: { customerId: "cus_1" } });
      expect(bcService.getOrder).toHaveBeenCalledWith(environment, {
        customerNumber: "00088888",
        orderNumber: "SO-1001",
      });
      expect(bcService.createReturnFromSalesOrder).toHaveBeenCalledWith(
        environment,
        {
          requestId: expect.stringMatching(/^RET-[0-9A-F]{12}$/),
          sourceOrderNo: "SO-1001",
          lines: [{ sourceLineNo: 10000, quantityToReturn: 1, returnReasonCode: "NORMAL" }],
        }
      );
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({ return: createdReturn });
    }
  );

  // The request id is derived from the customer, order and lines only, so the same request in
  // either environment keeps the same id (retries stay idempotent).
  it("derives the same request id in both environments", async () => {
    const requestIds: string[] = [];

    for (const environment of ["DK", "NO"] as const) {
      const { req, bcService } = createRequest({ environment });
      await POST(req as never, createResponse() as never);
      requestIds.push(bcService.createReturnFromSalesOrder.mock.calls[0][1].requestId);
    }

    expect(requestIds[0]).toBe(requestIds[1]);
  });

  it("answers 404 without creating a return when the order is not in the company's environment", async () => {
    const getOrder = jest.fn().mockResolvedValue(null);
    const { req, bcService } = createRequest({ environment: "NO", getOrder });
    const res = createResponse();

    await POST(req as never, res as never);

    expect(getOrder).toHaveBeenCalledWith("NO", expect.anything());
    expect(bcService.createReturnFromSalesOrder).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: "Order not found." });
  });

  it.each([
    [
      { source_line_no: 99999, quantity: 1, return_reason_code: "NORMAL" },
      "One or more selected lines cannot be returned.",
    ],
    [
      { source_line_no: 10000, quantity: 3, return_reason_code: "NORMAL" },
      "The requested return quantity exceeds the available quantity.",
    ],
    [
      { source_line_no: 10000, quantity: 1, return_reason_code: "DAMAGED" },
      "One or more return reasons are invalid.",
    ],
  ])("answers 400 with the validation message for %j", async (line, message) => {
    const { req, bcService } = createRequest({ environment: "NO", lines: [line] });
    const res = createResponse();

    await POST(req as never, res as never);

    expect(bcService.createReturnFromSalesOrder).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message });
  });

  it("answers 503 when Business Central's outcome is unknown", async () => {
    const createReturnFromSalesOrder = jest
      .fn()
      .mockRejectedValue(
        new BusinessCentralAmbiguousOutcomeError(
          "Business Central return request did not complete",
          "RET-X"
        )
      );
    const { req } = createRequest({ environment: "NO", createReturnFromSalesOrder });
    const res = createResponse();

    await POST(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({
      message: "We could not confirm the return request. Please try again shortly.",
    });
  });

  it("answers 500 without details and logs no error content for any other failure", async () => {
    const getOrder = jest
      .fn()
      .mockRejectedValue(new Error("Business Central order request failed with status 401"));
    const { req, logger } = createRequest({ getOrder });
    const res = createResponse();

    await POST(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: "The return request could not be completed. Please try again later.",
    });
    expect(logger.error).toHaveBeenCalledWith("BC return request failed");
  });

  // Security: Business Central configuration and rejection messages never reach the shopper; only
  // the return's own line validation is answered with its message.
  it.each([
    [
      "a missing environment setting",
      "getOrder",
      "BUSINESS_CENTRAL_NO_DISCOVERY_URL is required (Business Central environment NO)",
    ],
    [
      "invalid client credentials",
      "createReturnFromSalesOrder",
      "BUSINESS_CENTRAL_CLIENT_ID must be the Azure app registration GUID",
    ],
    [
      "Business Central rejecting the return",
      "createReturnFromSalesOrder",
      "The return request could not be accepted. Please check the selected lines and try again.",
    ],
  ] as const)(
    "answers the generic 500 for an invalid-data error from %s",
    async (_label, failingMethod, message) => {
      const failing = jest
        .fn()
        .mockRejectedValue(new MedusaError(MedusaError.Types.INVALID_DATA, message));
      const { req, logger } = createRequest({
        environment: "NO",
        [failingMethod]: failing,
      });
      const res = createResponse();

      await POST(req as never, res as never);

      expect(failing).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        message: "The return request could not be completed. Please try again later.",
      });
      expect(JSON.stringify(res.json.mock.calls)).not.toContain("BUSINESS_CENTRAL");
      expect(logger.error).toHaveBeenCalledWith("BC return request failed");
    }
  );

  it("answers 400 without calling Business Central when the company has no customer number", async () => {
    const { req, bcService } = createRequest({ customerNumber: null, environment: "NO" });
    const res = createResponse();

    await POST(req as never, res as never);

    expect(bcService.getOrder).not.toHaveBeenCalled();
    expect(bcService.createReturnFromSalesOrder).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "No Business Central customer number configured for this company.",
    });
  });
});
