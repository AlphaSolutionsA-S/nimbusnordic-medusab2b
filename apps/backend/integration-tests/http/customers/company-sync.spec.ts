import { medusaIntegrationTestRunner } from "@medusajs/test-utils";
import { MedusaError } from "@medusajs/framework/utils";

import { BUSINESS_CENTRAL_MODULE } from "../../../src/modules/business-central";
import type { IBusinessCentralModuleService } from "../../../src/modules/business-central/types";
import { COMPANY_MODULE } from "../../../src/modules/company";
import type { ICompanyModuleService } from "../../../src/types";
import {
  adminHeaders,
  createAdminUser,
  createStoreUser,
} from "../../utils/admin";
import {
  generatePublishableKey,
  generateStoreHeaders,
} from "../../utils/store";

jest.setTimeout(60 * 1000);

medusaIntegrationTestRunner({
  inApp: true,
  env: {
    JWT_SECRET: "supersecret",
  },
  testSuite: ({ api, getContainer }) => {
    let authenticatedStoreHeaders;
    let publishableStoreHeaders;
    let customer: { id: string };

    beforeEach(async () => {
      const container = getContainer();
      await createAdminUser(adminHeaders, container);
      const publishableKey = await generatePublishableKey(container);
      publishableStoreHeaders = generateStoreHeaders({ publishableKey });
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

    async function createLinkedCompany(
      businessCentralCustomerNumber: string | null
    ): Promise<string> {
      const companyResponse = await api.post(
        "/store/companies",
        {
          name: "Test Company",
          email: "company@example.com",
          phone: "12345678",
          address: "Original address",
          city: "Original city",
          state: "Original state",
          zip: "1000",
          country: "DK",
          logo_url: "https://example.com/logo.png",
          currency_code: "DKK",
          spending_limit_reset_frequency: "monthly",
        },
        authenticatedStoreHeaders
      );
      const companyId = companyResponse.data.companies[0].id as string;

      if (businessCentralCustomerNumber) {
        const companyService =
          getContainer().resolve<ICompanyModuleService>(COMPANY_MODULE);
        await companyService.updateCompanies({
          id: companyId,
          business_central_customer_number: businessCentralCustomerNumber,
        });
      }

      await api.post(
        `/store/companies/${companyId}/employees`,
        {
          customer_id: customer.id,
          spending_limit: 0,
          is_admin: true,
        },
        authenticatedStoreHeaders
      );

      return companyId;
    }

    describe("POST /store/customers/me/company/sync-business-central", () => {
      it("rejects an unauthenticated request", async () => {
        const { response } = await api
          .post(
            "/store/customers/me/company/sync-business-central",
            {},
            publishableStoreHeaders
          )
          .catch((error) => error);

        expect(response.status).toBe(401);
      });

      it("resolves the authenticated customer company server-side", async () => {
        await createLinkedCompany(null);

        const response = await api.post(
          "/store/customers/me/company/sync-business-central",
          {},
          authenticatedStoreHeaders
        );

        expect(response.status).toBe(200);
        expect(response.data).toEqual({ status: "skipped" });
      });

      it("contains expected Business Central service failures", async () => {
        await createLinkedCompany("00011551");
        const bcService =
          getContainer().resolve<IBusinessCentralModuleService>(
            BUSINESS_CENTRAL_MODULE
          );
        jest
          .spyOn(bcService, "getCustomer")
          .mockRejectedValueOnce(
            new MedusaError(
              MedusaError.Types.UNEXPECTED_STATE,
              "expected BC failure"
            )
          );

        const response = await api.post(
          "/store/customers/me/company/sync-business-central",
          {},
          authenticatedStoreHeaders
        );

        expect(response.status).toBe(200);
        expect(response.data).toEqual({ status: "failed" });
      });

      it("does not contain unexpected Business Central programming failures", async () => {
        await createLinkedCompany("00011551");
        const bcService =
          getContainer().resolve<IBusinessCentralModuleService>(
            BUSINESS_CENTRAL_MODULE
          );
        jest
          .spyOn(bcService, "getCustomer")
          .mockRejectedValueOnce(new Error("unexpected programming failure"));

        const { response } = await api
          .post(
            "/store/customers/me/company/sync-business-central",
            {},
            authenticatedStoreHeaders
          )
          .catch((error) => error);

        expect(response.status).toBeGreaterThanOrEqual(500);
      });

      it("updates only the approved company fields", async () => {
        const companyId = await createLinkedCompany("00011551");
        const bcService =
          getContainer().resolve<IBusinessCentralModuleService>(
            BUSINESS_CENTRAL_MODULE
          );
        jest.spyOn(bcService, "getCustomer").mockResolvedValueOnce({
          number: "00011551",
          displayName: "Updated Company",
          email: "updated@example.com",
          phoneNumber: "87654321",
          addressLine1: "Updated Street 1",
          addressLine2: "Building 2",
          city: "Updated city",
          state: "Updated state",
          postalCode: "2000",
          country: "SE",
          blocked: "Invoice",
          creditLimit: 12345.67,
          taxRegistrationNumber: "SE12345678",
          currencyCode: "SEK",
        });

        const response = await api.post(
          "/store/customers/me/company/sync-business-central",
          {},
          authenticatedStoreHeaders
        );
        const companyService =
          getContainer().resolve<ICompanyModuleService>(COMPANY_MODULE);
        const [company] = await companyService.listCompanies({
          id: companyId,
        });

        expect(response.data).toEqual({ status: "updated" });
        expect(company).toMatchObject({
          id: companyId,
          name: "Updated Company",
          email: "updated@example.com",
          phone: "87654321",
          address: "Updated Street 1, Building 2",
          city: "Updated city",
          state: "Updated state",
          zip: "2000",
          country: "SE",
          blocked: "Invoice",
          credit_limit: 12345.67,
          vat_number: "SE12345678",
          currency_code: "SEK",
          business_central_customer_number: "00011551",
          spending_limit_reset_frequency: "monthly",
        });
      });

      it("does not convert unexpected database failures to HTTP 200", async () => {
        await createLinkedCompany("00011551");
        const container = getContainer();
        const bcService =
          container.resolve<IBusinessCentralModuleService>(
            BUSINESS_CENTRAL_MODULE
          );
        jest.spyOn(bcService, "getCustomer").mockResolvedValueOnce({
          number: "00011551",
          displayName: "Updated Company",
          email: "",
          phoneNumber: "",
          addressLine1: "",
          addressLine2: "",
          city: "",
          state: "",
          postalCode: "",
          country: "",
          blocked: "not_blocked",
          creditLimit: null,
          taxRegistrationNumber: "",
          currencyCode: null,
        });
        const companyService =
          container.resolve<ICompanyModuleService>(COMPANY_MODULE);
        const updateSpy = jest
          .spyOn(companyService, "updateCompanies")
          .mockRejectedValueOnce(new Error("unexpected database failure"));

        const { response } = await api
          .post(
            "/store/customers/me/company/sync-business-central",
            {},
            authenticatedStoreHeaders
          )
          .catch((error) => error);

        expect(response.status).toBeGreaterThanOrEqual(500);
        updateSpy.mockRestore();
      });
    });
  },
});
