import { medusaIntegrationTestRunner } from "@medusajs/test-utils";

import { COMPANY_MODULE } from "../../../src/modules/company";
import type { ICompanyModuleService } from "../../../src/types";
import { ModuleCompanySpendingLimitResetFrequency } from "../../../src/types";
import { resolveBusinessCentralAccountWorkflow } from "../../../src/workflows/company/workflows/resolve-business-central-account";
import { adminHeaders, createAdminUser, createStoreUser } from "../../utils/admin";
import { generatePublishableKey, generateStoreHeaders } from "../../utils/store";

jest.setTimeout(60 * 1000);

medusaIntegrationTestRunner({
  inApp: true,
  env: {
    JWT_SECRET: "supersecret",
  },
  testSuite: ({ api, getContainer }) => {
    let authenticatedStoreHeaders;
    let customer: { id: string };

    beforeEach(async () => {
      const container = getContainer();
      await createAdminUser(adminHeaders, container);
      const publishableKey = await generatePublishableKey(container);
      const publishableStoreHeaders = generateStoreHeaders({ publishableKey });
      const storeUser = await createStoreUser({
        api,
        storeHeaders: publishableStoreHeaders,
      });
      customer = storeUser.customer;
      authenticatedStoreHeaders = {
        headers: {
          ...publishableStoreHeaders.headers,
          authorization: ["Bearer", storeUser.token].join(" "),
        },
      };
    });

    function companyService(): ICompanyModuleService {
      return getContainer().resolve<ICompanyModuleService>(COMPANY_MODULE);
    }

    // Registers a company through the store route, which makes the customer its employee.
    async function createCustomerCompany(
      country: string,
      businessCentralCustomerNumber: string | null
    ): Promise<string> {
      const response = await api.post(
        "/store/companies",
        {
          name: "Account Company",
          email: "account@example.com",
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

      await companyService().updateCompanies({
        id: companyId,
        country,
        business_central_customer_number: businessCentralCustomerNumber,
      });

      return companyId;
    }

    async function createCompanyWithoutEmployees(
      country: string,
      businessCentralCustomerNumber: string | null
    ): Promise<string> {
      const created = await companyService().createCompanies({
        name: "Lonely Company",
        email: "lonely@example.com",
        phone: "11111111",
        address: null,
        city: null,
        state: null,
        zip: null,
        country,
        logo_url: null,
        currency_code: "DKK",
        business_central_customer_number: businessCentralCustomerNumber,
        spending_limit_reset_frequency:
          ModuleCompanySpendingLimitResetFrequency.MONTHLY,
      });

      return created.id;
    }

    describe("resolveBusinessCentralAccountWorkflow", () => {
      it("resolves a customer whose company country is lower-case no to Norway with its number", async () => {
        const companyId = await createCustomerCompany("no", "00044444");

        const { result } = await resolveBusinessCentralAccountWorkflow(
          getContainer()
        ).run({ input: { customerId: customer.id } });

        expect(result).toEqual({
          companyId,
          customerNumber: "00044444",
          environment: "NO",
          notFound: null,
        });
      });

      it("resolves a customer whose company country is DK to Denmark", async () => {
        const companyId = await createCustomerCompany("DK", "00055555");

        const { result } = await resolveBusinessCentralAccountWorkflow(
          getContainer()
        ).run({ input: { customerId: customer.id } });

        expect(result).toEqual({
          companyId,
          customerNumber: "00055555",
          environment: "DK",
          notFound: null,
        });
      });

      it("resolves a company id to Norway with its number", async () => {
        const companyId = await createCompanyWithoutEmployees("no", "00066666");

        const { result } = await resolveBusinessCentralAccountWorkflow(
          getContainer()
        ).run({ input: { companyId } });

        expect(result).toEqual({
          companyId,
          customerNumber: "00066666",
          environment: "NO",
          notFound: null,
        });
      });

      it("resolves a company without a customer number to its environment and no number", async () => {
        const companyId = await createCompanyWithoutEmployees("NO", null);

        const { result } = await resolveBusinessCentralAccountWorkflow(
          getContainer()
        ).run({ input: { companyId } });

        expect(result).toEqual({
          companyId,
          customerNumber: null,
          environment: "NO",
          notFound: null,
        });
      });

      it("rejects an unknown company id as not found", async () => {
        await expect(
          resolveBusinessCentralAccountWorkflow(getContainer()).run({
            input: { companyId: "comp_does_not_exist" },
          })
        ).rejects.toMatchObject({ type: "not_found" });
      });

      it("resolves a customer without a company to Denmark and no number", async () => {
        // A Norwegian company the customer does not belong to must not leak into the result.
        await createCompanyWithoutEmployees("NO", "00077777");

        const { result } = await resolveBusinessCentralAccountWorkflow(
          getContainer()
        ).run({ input: { customerId: customer.id } });

        expect(result).toEqual({
          companyId: null,
          customerNumber: null,
          environment: "DK",
          notFound: null,
        });
      });
    });
  },
});
