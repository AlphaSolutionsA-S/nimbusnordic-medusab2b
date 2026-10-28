import type { BusinessCentralAccount } from "../../../../workflows/company/workflows/resolve-business-central-account";
import { resolveBusinessCentralAccountWorkflow } from "../../../../workflows/company/workflows/resolve-business-central-account";
import { GET } from "../[number]/route";

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

function createRequest(options: {
  returnNumber: string;
  bcCustomerNumber: string | null;
  environment?: BusinessCentralAccount["environment"];
  getReturn?: jest.Mock;
}) {
  const account: BusinessCentralAccount = {
    companyId: "comp_1",
    customerNumber: options.bcCustomerNumber,
    environment: options.environment ?? "DK",
    notFound: null,
  };
  const run = jest.fn().mockResolvedValue({ result: account });
  jest
    .mocked(resolveBusinessCentralAccountWorkflow)
    .mockReturnValue({ run } as never);
  const bcService = { getReturn: options.getReturn ?? jest.fn() };

  const req = {
    auth_context: { app_metadata: { customer_id: "cus_1" } },
    params: { number: options.returnNumber },
    scope: { resolve: jest.fn(() => bcService) },
  };

  return { req, run, bcService };
}

const bcReturn = {
  id: "return-1",
  number: "31502910",
  documentDate: "2026-09-27",
  status: "Open",
  state: "open",
  source: "return_order",
  lines: [],
  expectedCredit: {
    currencyCode: "DKK",
    amountIncludingTax: 1598.75,
    amountExcludingTax: 1279,
  },
  receipts: [],
};

describe("GET /store/bc-returns/:number", () => {
  // The return is loaded for the session's company: its customer number in its environment.
  it("returns the return from the authenticated customer's company environment", async () => {
    const getReturn = jest.fn().mockResolvedValue(bcReturn);
    const { req, run } = createRequest({
      returnNumber: "31502910",
      bcCustomerNumber: "10000",
      environment: "NO",
      getReturn,
    });
    const res = createResponse();

    await GET(req as never, res as never);

    expect(run).toHaveBeenCalledWith({ input: { customerId: "cus_1" } });
    expect(getReturn).toHaveBeenCalledWith("NO", {
      customerNumber: "10000",
      returnNumber: "31502910",
    });
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ return: bcReturn });
  });

  // NIMBUS-172: a processed return is passed through as 200.
  it("returns a processed return with 200", async () => {
    const processedReturn = {
      ...bcReturn,
      id: "return-order:31400001",
      number: "31400001",
      status: "",
      state: "processed",
      lines: [],
      expectedCredit: null,
      receipts: [],
    };
    const getReturn = jest.fn().mockResolvedValue(processedReturn);
    const { req } = createRequest({
      returnNumber: "31400001",
      bcCustomerNumber: "10000",
      getReturn,
    });
    const res = createResponse();

    await GET(req as never, res as never);

    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ return: processedReturn });
  });

  // Security: a foreign/unknown return gives a non-disclosing 404.
  it("responds 404 when the return is not found for this customer", async () => {
    const getReturn = jest.fn().mockResolvedValue(null);
    const { req } = createRequest({
      returnNumber: "31502999",
      bcCustomerNumber: "10000",
      getReturn,
    });
    const res = createResponse();

    await GET(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: "Return not found." });
  });

  // An impossible return number gets the same 404 without calling BC.
  it("responds 404 without calling Business Central for a number longer than 20 characters", async () => {
    const getReturn = jest.fn();
    const { req } = createRequest({
      returnNumber: "X".repeat(21),
      bcCustomerNumber: "10000",
      getReturn,
    });
    const res = createResponse();

    await GET(req as never, res as never);

    expect(getReturn).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: "Return not found." });
  });

  // No BC customer number configured on the company.
  it("responds 400 when the company has no Business Central customer number", async () => {
    const getReturn = jest.fn();
    const { req } = createRequest({
      returnNumber: "31502910",
      bcCustomerNumber: null,
      getReturn,
    });
    const res = createResponse();

    await GET(req as never, res as never);

    expect(getReturn).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "No Business Central customer number configured for this company.",
    });
  });

  // BC failures propagate to Medusa's error handler (no leak in body).
  it("propagates Business Central errors instead of responding with their details", async () => {
    const getReturn = jest
      .fn()
      .mockRejectedValue(new Error("Business Central return order request failed with status 500"));
    const { req } = createRequest({
      returnNumber: "31502910",
      bcCustomerNumber: "10000",
      getReturn,
    });
    const res = createResponse();

    await expect(GET(req as never, res as never)).rejects.toThrow(
      "Business Central return order request failed with status 500"
    );
    expect(res.json).not.toHaveBeenCalled();
  });
});
