import { medusaIntegrationTestRunner } from "@medusajs/test-utils";
import { MedusaError } from "@medusajs/framework/utils";

import { BUSINESS_CENTRAL_MODULE } from "../../../src/modules/business-central";
import type { IBusinessCentralModuleService } from "../../../src/modules/business-central/types";
import { COMPANY_MODULE } from "../../../src/modules/company";
import type { ICompanyModuleService } from "../../../src/types";
import { ModuleCompanySpendingLimitResetFrequency } from "../../../src/types";
import { syncCompanyFromBusinessCentralWorkflow } from "../../../src/workflows/company/workflows/sync-company-from-business-central";
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

      it("resolves a blank Business Central currency code to the local currency (LCY)", async () => {
        const companyId = await createLinkedCompany("00011552");
        const companyService =
          getContainer().resolve<ICompanyModuleService>(COMPANY_MODULE);
        // Start from a non-LCY currency so the assertion proves the fallback ran, rather than
        // just observing the company's seeded default.
        await companyService.updateCompanies({
          id: companyId,
          currency_code: "SEK",
        });
        const bcService =
          getContainer().resolve<IBusinessCentralModuleService>(
            BUSINESS_CENTRAL_MODULE
          );
        jest.spyOn(bcService, "getCustomer").mockResolvedValueOnce({
          number: "00011552",
          displayName: "Domestic Company",
          email: "domestic@example.com",
          phoneNumber: "11223344",
          addressLine1: "Industrivej 15",
          addressLine2: "",
          city: "Silkeborg",
          state: "",
          postalCode: "8600",
          country: "DK",
          blocked: "not_blocked",
          creditLimit: 0,
          taxRegistrationNumber: "DK12345678",
          currencyCode: null,
        });

        const response = await api.post(
          "/store/customers/me/company/sync-business-central",
          {},
          authenticatedStoreHeaders
        );
        const [company] = await companyService.listCompanies({
          id: companyId,
        });

        expect(response.data).toEqual({ status: "updated" });
        expect(company.currency_code).toEqual("DKK");
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

    describe("syncCompanyFromBusinessCentralWorkflow - expected company guard", () => {
      // The login sync tests above leave their getCustomer spies in place; start clean.
      beforeEach(() => {
        jest.restoreAllMocks();
      });

      afterEach(() => {
        jest.restoreAllMocks();
      });

      const staleAt = new Date(Date.now() - 11 * 60 * 1000);

      async function createUnlinkedCompany(): Promise<string> {
        const companyService =
          getContainer().resolve<ICompanyModuleService>(COMPANY_MODULE);
        const created = await companyService.createCompanies({
          name: "Other Company",
          email: "other@example.com",
          phone: "99999999",
          address: null,
          city: null,
          state: null,
          zip: null,
          country: "DK",
          logo_url: null,
          currency_code: "DKK",
          business_central_customer_number: "00022222",
          spending_limit_reset_frequency:
            ModuleCompanySpendingLimitResetFrequency.MONTHLY,
        });
        await companyService.updateCompanies({
          id: created.id,
          business_central_synced_at: staleAt,
        });

        return created.id;
      }

      it("TC-1: skips without a Business Central call when the expected company differs", async () => {
        const companyAId = await createLinkedCompany("00011551");
        const companyBId = await createUnlinkedCompany();
        const companyService =
          getContainer().resolve<ICompanyModuleService>(COMPANY_MODULE);
        await companyService.updateCompanies({
          id: companyAId,
          business_central_synced_at: staleAt,
        });
        const bcService =
          getContainer().resolve<IBusinessCentralModuleService>(
            BUSINESS_CENTRAL_MODULE
          );
        const getCustomerSpy = jest.spyOn(bcService, "getCustomer");

        const { result } = await syncCompanyFromBusinessCentralWorkflow(
          getContainer()
        ).run({
          input: { customerId: customer.id, expectedCompanyId: companyBId },
        });

        const [companyA] = await companyService.listCompanies({ id: companyAId });
        const [companyB] = await companyService.listCompanies({ id: companyBId });

        expect(result).toEqual({ status: "skipped" });
        expect(getCustomerSpy).not.toHaveBeenCalled();
        expect(companyA.business_central_synced_at).toEqual(staleAt);
        expect(companyA.name).toBe("Test Company");
        expect(companyB.business_central_synced_at).toEqual(staleAt);
        expect(companyB.name).toBe("Other Company");
      });

      it("TC-2: synchronizes when the expected company matches the customer's company", async () => {
        const companyAId = await createLinkedCompany("00011551");
        const companyService =
          getContainer().resolve<ICompanyModuleService>(COMPANY_MODULE);
        await companyService.updateCompanies({
          id: companyAId,
          business_central_synced_at: staleAt,
        });
        const bcService =
          getContainer().resolve<IBusinessCentralModuleService>(
            BUSINESS_CENTRAL_MODULE
          );
        const getCustomerSpy = jest
          .spyOn(bcService, "getCustomer")
          .mockResolvedValueOnce({
            number: "00011551",
            displayName: "Matched Company",
            email: "matched@example.com",
            phoneNumber: "87654321",
            addressLine1: "Updated Street 1",
            addressLine2: "",
            city: "Updated city",
            state: "",
            postalCode: "2000",
            country: "DK",
            blocked: "not_blocked",
            creditLimit: 0,
            taxRegistrationNumber: "DK12345678",
            currencyCode: "DKK",
          });

        const { result } = await syncCompanyFromBusinessCentralWorkflow(
          getContainer()
        ).run({
          input: { customerId: customer.id, expectedCompanyId: companyAId },
        });

        const [companyA] = await companyService.listCompanies({ id: companyAId });

        expect(result).toEqual({ status: "updated" });
        expect(getCustomerSpy).toHaveBeenCalledTimes(1);
        expect(getCustomerSpy).toHaveBeenCalledWith("00011551");
        expect(companyA.name).toBe("Matched Company");
        expect(companyA.business_central_synced_at?.getTime()).toBeGreaterThan(
          staleAt.getTime()
        );
      });
    });
  },
});
