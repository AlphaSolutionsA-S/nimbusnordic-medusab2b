import { asValue } from "@medusajs/framework/awilix";
import {
  ContainerRegistrationKeys,
  createMedusaContainer,
  MedusaError,
} from "@medusajs/framework/utils";

import { BUSINESS_CENTRAL_MODULE } from "../../../modules/business-central";
import type { BCCustomer } from "../../../modules/business-central/types";
import { COMPANY_MODULE } from "../../../modules/company";
import { syncCompanyFromBusinessCentralWorkflow } from "../workflows/sync-company-from-business-central";

// The workflow and its steps run for real; only the database (Query and the company module) and
// Business Central are replaced. The integration cases in
// integration-tests/http/customers/company-sync.spec.ts cover the same paths against Postgres.
// A step's output is serialised before the next step reads it, so a Date the prepare step sets
// reaches the company update as an ISO string.
const ISO_TIMESTAMP = expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);

const card: BCCustomer = {
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
  currencyCode: null,
};

type CompanyRow = {
  id: string;
  business_central_customer_number: string | null;
  country: string | null;
};

function setup(options: {
  company: CompanyRow;
  getCustomer?: jest.Mock;
}) {
  const getCustomer =
    options.getCustomer ?? jest.fn().mockResolvedValue(card);
  const updateCompanies = jest.fn(
    async (update: { id: string; business_central_not_found_at?: string }) => [update]
  );
  const companyService = {
    listCompanies: jest.fn().mockResolvedValue([options.company]),
    updateCompanies,
  };
  const graph = jest.fn(async ({ entity }: { entity: string }) => ({
    data:
      entity === "company"
        ? [options.company]
        : [{ employee: { company: options.company } }],
  }));
  const logger = { error: jest.fn(), info: jest.fn(), warn: jest.fn(), debug: jest.fn() };

  const container = createMedusaContainer();
  container.register(BUSINESS_CENTRAL_MODULE, asValue({ getCustomer }));
  container.register(COMPANY_MODULE, asValue(companyService));
  container.register(ContainerRegistrationKeys.QUERY, asValue({ graph }));
  container.register(ContainerRegistrationKeys.LOGGER, asValue(logger));

  return { container, getCustomer, updateCompanies };
}

const triggers = [
  ["company id", { companyId: "comp_1" }],
  ["customer", { customerId: "cus_1" }],
] as const;

describe("syncCompanyFromBusinessCentralWorkflow", () => {
  const originalNoLcy = process.env.BUSINESS_CENTRAL_NO_LCY_CODE;

  beforeEach(() => {
    delete process.env.BUSINESS_CENTRAL_NO_LCY_CODE;
  });

  afterAll(() => {
    if (originalNoLcy === undefined) {
      delete process.env.BUSINESS_CENTRAL_NO_LCY_CODE;
    } else {
      process.env.BUSINESS_CENTRAL_NO_LCY_CODE = originalNoLcy;
    }
  });

  describe.each(triggers)("by %s", (_trigger, input) => {
    it.each([
      ["NO", "NO"],
      [" no ", "NO"],
      ["DK", "DK"],
      ["", "DK"],
      [null, "DK"],
    ])(
      "reads the card of a company with country %j in %s",
      async (country, environment) => {
        const { container, getCustomer } = setup({
          company: { id: "comp_1", business_central_customer_number: "00088888", country },
        });

        const { result } = await syncCompanyFromBusinessCentralWorkflow(container).run({
          input,
        });

        expect(result).toEqual({ status: "updated" });
        expect(getCustomer).toHaveBeenCalledTimes(1);
        expect(getCustomer).toHaveBeenCalledWith(environment, "00088888");
      }
    );

    it("writes the card with the Norwegian local currency and clears the not-found record", async () => {
      const { container, updateCompanies } = setup({
        company: { id: "comp_1", business_central_customer_number: "00088888", country: "NO" },
      });

      const { result } = await syncCompanyFromBusinessCentralWorkflow(container).run({
        input,
      });

      expect(result).toEqual({ status: "updated" });
      expect(updateCompanies).toHaveBeenCalledTimes(1);
      expect(updateCompanies.mock.calls[0][0]).toMatchObject({
        id: "comp_1",
        name: "Norsk Kunde AS",
        country: "NO",
        currency_code: "NOK",
        business_central_synced_at: ISO_TIMESTAMP,
        business_central_not_found_at: null,
        business_central_not_found_environment: null,
        business_central_not_found_customer_number: null,
      });
    });

    it("reports skipped and writes only the not-found record when the routed environment has no such customer", async () => {
      const { container, updateCompanies } = setup({
        company: { id: "comp_1", business_central_customer_number: "00088888", country: "NO" },
        getCustomer: jest.fn().mockResolvedValue(null),
      });
      const before = Date.now();

      const { result } = await syncCompanyFromBusinessCentralWorkflow(container).run({
        input,
      });

      expect(result).toEqual({ status: "skipped" });
      expect(updateCompanies).toHaveBeenCalledTimes(1);
      const update = updateCompanies.mock.calls[0][0];
      expect(update).toEqual({
        id: "comp_1",
        business_central_not_found_at: ISO_TIMESTAMP,
        business_central_not_found_environment: "NO",
        business_central_not_found_customer_number: "00088888",
      });
      expect(Date.parse(update.business_central_not_found_at ?? "")).toBeGreaterThanOrEqual(
        before
      );
    });

    it("writes nothing and calls no environment without a customer number", async () => {
      const { container, getCustomer, updateCompanies } = setup({
        company: { id: "comp_1", business_central_customer_number: null, country: "NO" },
      });

      const { result } = await syncCompanyFromBusinessCentralWorkflow(container).run({
        input,
      });

      expect(result).toEqual({ status: "skipped" });
      expect(getCustomer).not.toHaveBeenCalled();
      expect(updateCompanies).not.toHaveBeenCalled();
    });

    it("reports failed and writes nothing on a Business Central error", async () => {
      const { container, updateCompanies } = setup({
        company: { id: "comp_1", business_central_customer_number: "00088888", country: "NO" },
        getCustomer: jest
          .fn()
          .mockRejectedValue(
            new MedusaError(
              MedusaError.Types.INVALID_DATA,
              "BUSINESS_CENTRAL_NO_DISCOVERY_URL is required (Business Central environment NO)"
            )
          ),
      });

      const { result } = await syncCompanyFromBusinessCentralWorkflow(container).run({
        input,
      });

      expect(result).toEqual({ status: "failed" });
      expect(updateCompanies).not.toHaveBeenCalled();
    });
  });
});
