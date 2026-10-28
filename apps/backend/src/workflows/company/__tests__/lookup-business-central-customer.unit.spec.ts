import { asValue } from "@medusajs/framework/awilix";
import {
  ContainerRegistrationKeys,
  createMedusaContainer,
  MedusaError,
} from "@medusajs/framework/utils";

import { BUSINESS_CENTRAL_MODULE } from "../../../modules/business-central";
import { businessCentralConfigurationError } from "../../../modules/business-central/environment-config";
import type {
  BCCustomer,
  BusinessCentralEnvironment,
} from "../../../modules/business-central/types";
import { lookupBusinessCentralCustomerWorkflow } from "../workflows/lookup-business-central-customer";

// The workflow and its steps run for real; only Query and Business Central are replaced. The
// contract cases in integration-tests/http/companies/companies.spec.ts cover the route.

function card(country: string): BCCustomer {
  return {
    number: "00088888",
    displayName: `Kunde ${country}`,
    email: "kunde@example.com",
    phoneNumber: "22334455",
    addressLine1: "Storgata 1",
    addressLine2: "",
    city: "Oslo",
    state: "",
    postalCode: "0155",
    country,
    blocked: "not_blocked",
    creditLimit: 1000,
    taxRegistrationNumber: "NO123456789",
    currencyCode: "NOK",
  };
}

type Answer = BCCustomer | null | Error;

function setup(options: {
  customerNumber?: string | null;
  companyFound?: boolean;
  answers?: Partial<Record<BusinessCentralEnvironment, Answer>>;
}) {
  const company = {
    id: "comp_1",
    business_central_customer_number:
      options.customerNumber === undefined ? "00088888" : options.customerNumber,
    country: "DK",
    business_central_not_found_at: null,
    business_central_not_found_environment: null,
    business_central_not_found_customer_number: null,
  };
  const getCustomer = jest.fn(
    async (environment: BusinessCentralEnvironment): Promise<BCCustomer | null> => {
      const answer = options.answers?.[environment] ?? null;
      if (answer instanceof Error) {
        throw answer;
      }
      return answer;
    }
  );
  const graph = jest.fn(async () => ({
    data: options.companyFound === false ? [] : [company],
  }));
  const logger = { error: jest.fn(), info: jest.fn(), warn: jest.fn(), debug: jest.fn() };

  const container = createMedusaContainer();
  container.register(BUSINESS_CENTRAL_MODULE, asValue({ getCustomer }));
  container.register(ContainerRegistrationKeys.QUERY, asValue({ graph }));
  container.register(ContainerRegistrationKeys.LOGGER, asValue(logger));

  return { container, getCustomer, logger };
}

const notFound = { status: "not_found", customer: null };

describe("lookupBusinessCentralCustomerWorkflow", () => {
  it.each([
    [
      "DK only",
      { DK: card("DK") },
      [
        {
          environment: "DK",
          status: "found",
          customer: { name: "Kunde DK", country: "DK", routesTo: "DK", routesElsewhere: false },
        },
        { environment: "NO", ...notFound },
      ],
    ],
    [
      "NO only",
      { NO: card("NO") },
      [
        { environment: "DK", ...notFound },
        {
          environment: "NO",
          status: "found",
          customer: { name: "Kunde NO", country: "NO", routesTo: "NO", routesElsewhere: false },
        },
      ],
    ],
    [
      "both",
      { DK: card("NO"), NO: card("NO") },
      [
        {
          environment: "DK",
          status: "found",
          customer: { name: "Kunde NO", country: "NO", routesTo: "NO", routesElsewhere: true },
        },
        {
          environment: "NO",
          status: "found",
          customer: { name: "Kunde NO", country: "NO", routesTo: "NO", routesElsewhere: false },
        },
      ],
    ],
    [
      "neither",
      {},
      [
        { environment: "DK", ...notFound },
        { environment: "NO", ...notFound },
      ],
    ],
  ] as const)("reports a card found in %s", async (_case, answers, results) => {
    const { container, getCustomer } = setup({ answers });

    const { result } = await lookupBusinessCentralCustomerWorkflow(container).run({
      input: { companyId: "comp_1" },
    });

    expect(result).toEqual({ customerNumber: "00088888", results });
    expect(getCustomer).toHaveBeenCalledTimes(2);
    expect(getCustomer).toHaveBeenCalledWith("DK", "00088888");
    expect(getCustomer).toHaveBeenCalledWith("NO", "00088888");
  });

  it("flags a Norwegian card whose country routes to Denmark", async () => {
    const { container } = setup({ answers: { NO: card("SE") } });

    const { result } = await lookupBusinessCentralCustomerWorkflow(container).run({
      input: { companyId: "comp_1" },
    });

    expect(result.results[1]).toEqual({
      environment: "NO",
      status: "found",
      customer: { name: "Kunde SE", country: "SE", routesTo: "DK", routesElsewhere: true },
    });
  });

  it.each([
    ["a Business Central error", new MedusaError(MedusaError.Types.UNEXPECTED_STATE, "BC 500")],
    ["an unexpected error", new TypeError("boom 00088888")],
    [
      "a missing NO setting",
      businessCentralConfigurationError(
        "BUSINESS_CENTRAL_NO_DISCOVERY_URL is required (Business Central environment NO)"
      ),
    ],
  ])(
    "reports could_not_check for the environment that fails with %s and keeps the other result",
    async (_case, error) => {
      const { container, logger } = setup({ answers: { DK: card("DK"), NO: error } });

      const { result } = await lookupBusinessCentralCustomerWorkflow(container).run({
        input: { companyId: "comp_1" },
      });

      expect(result.results).toEqual([
        {
          environment: "DK",
          status: "found",
          customer: { name: "Kunde DK", country: "DK", routesTo: "DK", routesElsewhere: false },
        },
        { environment: "NO", status: "could_not_check", customer: null },
      ]);
      const logged = [...logger.warn.mock.calls, ...logger.error.mock.calls].map(([message]) =>
        String(message)
      );
      expect(logged).toEqual([expect.stringContaining("comp_1")]);
      expect(logged[0]).toContain("NO");
      expect(logged[0]).not.toContain("00088888");
      expect(logged[0]).not.toContain(error.message);
    }
  );

  it("refuses a company without a customer number before calling Business Central", async () => {
    const { container, getCustomer } = setup({ customerNumber: null });

    await expect(
      lookupBusinessCentralCustomerWorkflow(container).run({ input: { companyId: "comp_1" } })
    ).rejects.toMatchObject({ type: MedusaError.Types.INVALID_DATA });
    expect(getCustomer).not.toHaveBeenCalled();
  });

  it("answers not found for an unknown company before calling Business Central", async () => {
    const { container, getCustomer } = setup({ companyFound: false });

    await expect(
      lookupBusinessCentralCustomerWorkflow(container).run({ input: { companyId: "comp_x" } })
    ).rejects.toMatchObject({ type: MedusaError.Types.NOT_FOUND });
    expect(getCustomer).not.toHaveBeenCalled();
  });
});
