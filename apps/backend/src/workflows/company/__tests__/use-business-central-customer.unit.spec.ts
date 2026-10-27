import { asValue } from "@medusajs/framework/awilix";
import {
  ContainerRegistrationKeys,
  createMedusaContainer,
  MedusaError,
} from "@medusajs/framework/utils";

import { BUSINESS_CENTRAL_MODULE } from "../../../modules/business-central";
import type {
  BCCustomer,
  BusinessCentralEnvironment,
} from "../../../modules/business-central/types";
import { COMPANY_MODULE } from "../../../modules/company";
import { useBusinessCentralCustomerWorkflow } from "../workflows/use-business-central-customer";

// The workflow, its steps and the nested company sync run for real; only the database (Query and
// the company module) and Business Central are replaced. The company row is shared state, so the
// nested sync reads the country the workflow just wrote.

const norwegianCard: BCCustomer = {
  number: "00088888",
  displayName: "Norsk Kunde AS",
  email: "norsk@example.com",
  phoneNumber: "22334455",
  addressLine1: "Storgata 1",
  addressLine2: "",
  city: "Oslo",
  state: "",
  postalCode: "0155",
  country: "NO",
  blocked: "not_blocked",
  creditLimit: 1000,
  taxRegistrationNumber: "NO123456789",
  currencyCode: "NOK",
};

type CompanyRow = Record<string, unknown> & { id: string };

function setup(options: {
  customerNumber?: string | null;
  companyFound?: boolean;
  answers: Partial<Record<BusinessCentralEnvironment, BCCustomer | null | Error>>;
}) {
  const row: CompanyRow = {
    id: "comp_1",
    name: "Dansk Navn",
    business_central_customer_number:
      options.customerNumber === undefined ? "00088888" : options.customerNumber,
    country: "DK",
    business_central_not_found_at: "2026-10-01T10:00:00.000Z",
    business_central_not_found_environment: "DK",
    business_central_not_found_customer_number: "00088888",
  };
  const getCustomer = jest.fn(
    async (environment: BusinessCentralEnvironment): Promise<BCCustomer | null> => {
      const answer = options.answers[environment] ?? null;
      if (answer instanceof Error) {
        throw answer;
      }
      return answer;
    }
  );
  const updateCompanies = jest.fn(async (update: CompanyRow) => {
    Object.assign(row, update);
    return { ...row };
  });
  const companyService = {
    listCompanies: jest.fn(async () => [{ ...row }]),
    updateCompanies,
  };
  const graph = jest.fn(async () => ({
    data: options.companyFound === false ? [] : [{ ...row }],
  }));
  const logger = { error: jest.fn(), info: jest.fn(), warn: jest.fn(), debug: jest.fn() };

  const container = createMedusaContainer();
  container.register(BUSINESS_CENTRAL_MODULE, asValue({ getCustomer }));
  container.register(COMPANY_MODULE, asValue(companyService));
  container.register(ContainerRegistrationKeys.QUERY, asValue({ graph }));
  container.register(ContainerRegistrationKeys.LOGGER, asValue(logger));

  return { container, getCustomer, updateCompanies, row };
}

describe("useBusinessCentralCustomerWorkflow", () => {
  it("writes only the card's country, then syncs the company in the environment it now routes to", async () => {
    const { container, getCustomer, updateCompanies, row } = setup({
      answers: { NO: norwegianCard },
    });

    const { result } = await useBusinessCentralCustomerWorkflow(container).run({
      input: { companyId: "comp_1", environment: "NO" },
    });

    expect(result).toEqual({ status: "updated", country: "NO" });
    expect(updateCompanies.mock.calls[0][0]).toEqual({ id: "comp_1", country: "NO" });
    expect(getCustomer.mock.calls).toEqual([
      ["NO", "00088888"],
      ["NO", "00088888"],
    ]);
    expect(row).toMatchObject({
      name: "Norsk Kunde AS",
      country: "NO",
      business_central_not_found_at: null,
      business_central_not_found_environment: null,
      business_central_not_found_customer_number: null,
    });
  });

  it("keeps the written country and reports the sync outcome when the following sync fails", async () => {
    const { container, getCustomer, row } = setup({ answers: { NO: norwegianCard } });
    getCustomer
      .mockResolvedValueOnce(norwegianCard)
      .mockRejectedValueOnce(new MedusaError(MedusaError.Types.UNEXPECTED_STATE, "BC 500"));

    const { result } = await useBusinessCentralCustomerWorkflow(container).run({
      input: { companyId: "comp_1", environment: "NO" },
    });

    expect(result).toEqual({ status: "failed", country: "NO" });
    expect(row).toMatchObject({ country: "NO", name: "Dansk Navn" });
  });

  it("answers not found and writes nothing when the card is gone from the chosen environment", async () => {
    const { container, getCustomer, updateCompanies, row } = setup({
      answers: { DK: norwegianCard },
    });

    await expect(
      useBusinessCentralCustomerWorkflow(container).run({
        input: { companyId: "comp_1", environment: "NO" },
      })
    ).rejects.toMatchObject({ type: MedusaError.Types.NOT_FOUND });
    expect(getCustomer).toHaveBeenCalledTimes(1);
    expect(getCustomer).toHaveBeenCalledWith("NO", "00088888");
    expect(updateCompanies).not.toHaveBeenCalled();
    expect(row.country).toBe("DK");
  });

  it("refuses a company without a customer number before calling Business Central", async () => {
    const { container, getCustomer, updateCompanies } = setup({
      customerNumber: null,
      answers: { NO: norwegianCard },
    });

    await expect(
      useBusinessCentralCustomerWorkflow(container).run({
        input: { companyId: "comp_1", environment: "NO" },
      })
    ).rejects.toMatchObject({ type: MedusaError.Types.INVALID_DATA });
    expect(getCustomer).not.toHaveBeenCalled();
    expect(updateCompanies).not.toHaveBeenCalled();
  });

  it("answers not found for an unknown company before calling Business Central", async () => {
    const { container, getCustomer, updateCompanies } = setup({
      companyFound: false,
      answers: { NO: norwegianCard },
    });

    await expect(
      useBusinessCentralCustomerWorkflow(container).run({
        input: { companyId: "comp_x", environment: "NO" },
      })
    ).rejects.toMatchObject({ type: MedusaError.Types.NOT_FOUND });
    expect(getCustomer).not.toHaveBeenCalled();
    expect(updateCompanies).not.toHaveBeenCalled();
  });
});
