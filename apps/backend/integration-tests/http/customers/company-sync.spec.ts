import { medusaIntegrationTestRunner } from "@medusajs/test-utils";
import { MedusaError } from "@medusajs/framework/utils";

import { BUSINESS_CENTRAL_MODULE } from "../../../src/modules/business-central";
import type {
  BCCustomer,
  IBusinessCentralModuleService,
} from "../../../src/modules/business-central/types";
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

      it.each([true, false])(
        "leaves order_api_enabled at %s after a sync",
        async (orderApiEnabled) => {
          const companyId = await createLinkedCompany("00011551");
          const companyService =
            getContainer().resolve<ICompanyModuleService>(COMPANY_MODULE);
          await companyService.updateCompanies({
            id: companyId,
            order_api_enabled: orderApiEnabled,
          });
          const bcService =
            getContainer().resolve<IBusinessCentralModuleService>(
              BUSINESS_CENTRAL_MODULE
            );
          jest.spyOn(bcService, "getCustomer").mockResolvedValueOnce({
            number: "00011551",
            displayName: "Synced Company",
            email: "synced@example.com",
            phoneNumber: "87654321",
            addressLine1: "Synced Street 1",
            addressLine2: "",
            city: "Synced city",
            state: "",
            postalCode: "2000",
            country: "DK",
            blocked: "not_blocked",
            creditLimit: 0,
            taxRegistrationNumber: "DK12345678",
            currencyCode: "DKK",
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
          expect(company.name).toBe("Synced Company");
          expect(company.order_api_enabled).toBe(orderApiEnabled);
        }
      );

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
        expect(getCustomerSpy).toHaveBeenCalledWith("DK", "00011551");
        expect(companyA.name).toBe("Matched Company");
        expect(companyA.business_central_synced_at?.getTime()).toBeGreaterThan(
          staleAt.getTime()
        );
      });
    });

    describe("syncCompanyFromBusinessCentralWorkflow - by company id", () => {
      beforeEach(() => {
        jest.restoreAllMocks();
      });

      afterEach(() => {
        jest.restoreAllMocks();
      });

      const staleAt = new Date(Date.now() - 11 * 60 * 1000);

      const bcCustomer: BCCustomer = {
        number: "00033333",
        displayName: "Synced By Id",
        email: "byid@example.com",
        phoneNumber: "55554444",
        addressLine1: "Sync Street 3",
        addressLine2: "Floor 4",
        city: "Synced city",
        state: "Synced state",
        postalCode: "3000",
        country: "NO",
        blocked: "Ship",
        creditLimit: 5000,
        taxRegistrationNumber: "NO987654321",
        currencyCode: "NOK",
      };

      // No employees: the company path must not depend on a customer.
      async function createCompanyWithoutEmployees(
        businessCentralCustomerNumber: string | null
      ): Promise<string> {
        const companyService =
          getContainer().resolve<ICompanyModuleService>(COMPANY_MODULE);
        const created = await companyService.createCompanies({
          name: "Lonely Company",
          email: "lonely@example.com",
          phone: "11111111",
          address: "Old address",
          city: "Old city",
          state: "Old state",
          zip: "1000",
          country: "DK",
          logo_url: "https://example.com/lonely.png",
          currency_code: "DKK",
          business_central_customer_number: businessCentralCustomerNumber,
          spending_limit_reset_frequency:
            ModuleCompanySpendingLimitResetFrequency.MONTHLY,
        });
        await companyService.updateCompanies({
          id: created.id,
          order_api_enabled: true,
          business_central_synced_at: staleAt,
        });

        return created.id;
      }

      async function readCompany(companyId: string) {
        const companyService =
          getContainer().resolve<ICompanyModuleService>(COMPANY_MODULE);
        const [company] = await companyService.listCompanies({ id: companyId });

        return company;
      }

      function spyOnGetCustomer() {
        const bcService =
          getContainer().resolve<IBusinessCentralModuleService>(
            BUSINESS_CENTRAL_MODULE
          );

        return jest.spyOn(bcService, "getCustomer");
      }

      const unchangedFields = {
        name: "Lonely Company",
        email: "lonely@example.com",
        phone: "11111111",
        address: "Old address",
        city: "Old city",
        state: "Old state",
        zip: "1000",
        country: "DK",
        currency_code: "DKK",
      };

      it("updates a company with no employees from Business Central", async () => {
        const companyId = await createCompanyWithoutEmployees("00033333");
        const getCustomerSpy = spyOnGetCustomer().mockResolvedValueOnce(
          bcCustomer
        );

        const { result } = await syncCompanyFromBusinessCentralWorkflow(
          getContainer()
        ).run({ input: { companyId } });

        const company = await readCompany(companyId);

        expect(result).toEqual({ status: "updated" });
        expect(getCustomerSpy).toHaveBeenCalledTimes(1);
        expect(getCustomerSpy).toHaveBeenCalledWith("DK", "00033333");
        expect(company).toMatchObject({
          id: companyId,
          name: "Synced By Id",
          email: "byid@example.com",
          phone: "55554444",
          address: "Sync Street 3, Floor 4",
          city: "Synced city",
          state: "Synced state",
          zip: "3000",
          country: "NO",
          blocked: "Ship",
          credit_limit: 5000,
          vat_number: "NO987654321",
          currency_code: "NOK",
          order_api_enabled: true,
          logo_url: "https://example.com/lonely.png",
          spending_limit_reset_frequency: "monthly",
          business_central_customer_number: "00033333",
        });
        expect(company.business_central_synced_at).toBeInstanceOf(Date);
        expect(company.business_central_synced_at?.getTime()).toBeGreaterThan(
          staleAt.getTime()
        );
      });

      it("skips without a Business Central call when the company has no BC number", async () => {
        const companyId = await createCompanyWithoutEmployees(null);
        const getCustomerSpy = spyOnGetCustomer();

        const { result } = await syncCompanyFromBusinessCentralWorkflow(
          getContainer()
        ).run({ input: { companyId } });

        const company = await readCompany(companyId);

        expect(result).toEqual({ status: "skipped" });
        expect(getCustomerSpy).not.toHaveBeenCalled();
        expect(company).toMatchObject(unchangedFields);
        expect(company.business_central_synced_at).toEqual(staleAt);
      });

      it("skips when Business Central has no matching customer", async () => {
        const companyId = await createCompanyWithoutEmployees("00033333");
        spyOnGetCustomer().mockResolvedValueOnce(null);

        const { result } = await syncCompanyFromBusinessCentralWorkflow(
          getContainer()
        ).run({ input: { companyId } });

        const company = await readCompany(companyId);

        expect(result).toEqual({ status: "skipped" });
        expect(company).toMatchObject(unchangedFields);
        expect(company.business_central_synced_at).toEqual(staleAt);
      });

      it("reports failed and changes nothing on an expected Business Central error", async () => {
        const companyId = await createCompanyWithoutEmployees("00033333");
        spyOnGetCustomer().mockRejectedValueOnce(
          new MedusaError(
            MedusaError.Types.UNEXPECTED_STATE,
            "expected BC failure"
          )
        );

        const { result } = await syncCompanyFromBusinessCentralWorkflow(
          getContainer()
        ).run({ input: { companyId } });

        const company = await readCompany(companyId);

        expect(result).toEqual({ status: "failed" });
        expect(company).toMatchObject(unchangedFields);
        expect(company.business_central_synced_at).toEqual(staleAt);
      });

      it("rejects on an unexpected Business Central error", async () => {
        const companyId = await createCompanyWithoutEmployees("00033333");
        spyOnGetCustomer().mockRejectedValueOnce(
          new Error("unexpected programming failure")
        );

        await expect(
          syncCompanyFromBusinessCentralWorkflow(getContainer()).run({
            input: { companyId },
          })
        ).rejects.toMatchObject({ message: "unexpected programming failure" });

        const company = await readCompany(companyId);

        expect(company).toMatchObject(unchangedFields);
        expect(company.business_central_synced_at).toEqual(staleAt);
      });

      it("rejects an unknown company id as not found without a Business Central call", async () => {
        const getCustomerSpy = spyOnGetCustomer();

        await expect(
          syncCompanyFromBusinessCentralWorkflow(getContainer()).run({
            input: { companyId: "comp_does_not_exist" },
          })
        ).rejects.toMatchObject({ type: "not_found" });

        expect(getCustomerSpy).not.toHaveBeenCalled();
      });
    });

    describe("syncCompanyFromBusinessCentralWorkflow - environment routing and the not-found record", () => {
      beforeEach(() => {
        jest.restoreAllMocks();
      });

      afterEach(() => {
        jest.restoreAllMocks();
      });

      const staleAt = new Date(Date.now() - 11 * 60 * 1000);

      const originalFields = {
        name: "Routed Company",
        email: "routed@example.com",
        phone: "11112222",
        address: "Old address",
        city: "Old city",
        state: "Old state",
        zip: "1000",
        currency_code: "DKK",
        blocked: "not_blocked",
        vat_number: null,
      } as const;

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

      type Trigger = "company id" | "customer";

      function companyService(): ICompanyModuleService {
        return getContainer().resolve<ICompanyModuleService>(COMPANY_MODULE);
      }

      // "customer": the store-registered company of the test customer; "company id": a company
      // without employees, as the Admin sync starts.
      async function createCompany(
        trigger: Trigger,
        country: string | null,
        businessCentralCustomerNumber: string | null
      ): Promise<string> {
        const companyId =
          trigger === "customer"
            ? await createLinkedCompany(null)
            : (
                await companyService().createCompanies({
                  name: originalFields.name,
                  email: originalFields.email,
                  phone: originalFields.phone,
                  address: null,
                  city: null,
                  state: null,
                  zip: null,
                  country,
                  logo_url: null,
                  currency_code: originalFields.currency_code,
                  spending_limit_reset_frequency:
                    ModuleCompanySpendingLimitResetFrequency.MONTHLY,
                })
              ).id;

        await companyService().updateCompanies({
          id: companyId,
          ...originalFields,
          country,
          business_central_customer_number: businessCentralCustomerNumber,
          business_central_synced_at: staleAt,
        });

        return companyId;
      }

      function runSync(trigger: Trigger, companyId: string) {
        return syncCompanyFromBusinessCentralWorkflow(getContainer()).run({
          input:
            trigger === "customer"
              ? { customerId: customer.id }
              : { companyId },
        });
      }

      async function readCompany(companyId: string) {
        const [company] = await companyService().listCompanies({
          id: companyId,
        });

        return company;
      }

      function spyOnGetCustomer() {
        const bcService =
          getContainer().resolve<IBusinessCentralModuleService>(
            BUSINESS_CENTRAL_MODULE
          );

        return jest.spyOn(bcService, "getCustomer");
      }

      describe.each<Trigger>(["company id", "customer"])("by %s", (trigger) => {
        it.each([
          ["NO", "NO"],
          [" no ", "NO"],
          ["DK", "DK"],
          ["SE", "DK"],
          [null, "DK"],
        ])(
          "reads the customer card of a company with country %j in %s",
          async (country, environment) => {
            const companyId = await createCompany(trigger, country, "00088888");
            const getCustomerSpy = spyOnGetCustomer().mockResolvedValueOnce(
              norwegianCard
            );

            const { result } = await runSync(trigger, companyId);

            expect(result).toEqual({ status: "updated" });
            expect(getCustomerSpy).toHaveBeenCalledTimes(1);
            expect(getCustomerSpy).toHaveBeenCalledWith(environment, "00088888");
          }
        );

        it("records the not-found record and leaves the BC-managed fields alone when the routed environment has no such customer", async () => {
          const companyId = await createCompany(trigger, "NO", "00088888");
          spyOnGetCustomer().mockResolvedValueOnce(null);
          const before = Date.now();

          const { result } = await runSync(trigger, companyId);

          const company = await readCompany(companyId);
          expect(result).toEqual({ status: "skipped" });
          expect(company).toMatchObject({
            ...originalFields,
            country: "NO",
            business_central_customer_number: "00088888",
            business_central_not_found_environment: "NO",
            business_central_not_found_customer_number: "00088888",
          });
          expect(company.credit_limit).toBeNull();
          expect(company.business_central_synced_at).toEqual(staleAt);
          expect(company.business_central_not_found_at).toBeInstanceOf(Date);
          expect(
            company.business_central_not_found_at?.getTime()
          ).toBeGreaterThanOrEqual(before - 1000);
        });

        it("overwrites an earlier not-found record with the latest attempt", async () => {
          const companyId = await createCompany(trigger, "DK", "00099999");
          const earlier = new Date(Date.now() - 60 * 60 * 1000);
          await companyService().updateCompanies({
            id: companyId,
            business_central_not_found_at: earlier,
            business_central_not_found_environment: "NO",
            business_central_not_found_customer_number: "00011111",
          });
          spyOnGetCustomer().mockResolvedValueOnce(null);

          const { result } = await runSync(trigger, companyId);

          const company = await readCompany(companyId);
          expect(result).toEqual({ status: "skipped" });
          expect(company).toMatchObject({
            business_central_not_found_environment: "DK",
            business_central_not_found_customer_number: "00099999",
          });
          expect(
            company.business_central_not_found_at?.getTime()
          ).toBeGreaterThan(earlier.getTime());
        });

        it("clears the not-found record when a later sync finds the customer", async () => {
          const companyId = await createCompany(trigger, "NO", "00088888");
          spyOnGetCustomer()
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce(norwegianCard);

          await runSync(trigger, companyId);
          const { result } = await runSync(trigger, companyId);

          const company = await readCompany(companyId);
          expect(result).toEqual({ status: "updated" });
          expect(company).toMatchObject({
            name: "Norsk Kunde AS",
            country: "NO",
            currency_code: "NOK",
            business_central_not_found_at: null,
            business_central_not_found_environment: null,
            business_central_not_found_customer_number: null,
          });
          expect(company.business_central_synced_at?.getTime()).toBeGreaterThan(
            staleAt.getTime()
          );
        });

        it("resolves a blank card currency in Norway to NOK", async () => {
          const companyId = await createCompany(trigger, "NO", "00088888");
          spyOnGetCustomer().mockResolvedValueOnce({
            ...norwegianCard,
            currencyCode: null,
          });

          const { result } = await runSync(trigger, companyId);

          const company = await readCompany(companyId);
          expect(result).toEqual({ status: "updated" });
          expect(company.currency_code).toBe("NOK");
        });

        it("writes nothing and calls no environment without a customer number", async () => {
          const companyId = await createCompany(trigger, "NO", null);
          const getCustomerSpy = spyOnGetCustomer();

          const { result } = await runSync(trigger, companyId);

          const company = await readCompany(companyId);
          expect(result).toEqual({ status: "skipped" });
          expect(getCustomerSpy).not.toHaveBeenCalled();
          expect(company).toMatchObject({
            ...originalFields,
            business_central_not_found_at: null,
            business_central_not_found_environment: null,
            business_central_not_found_customer_number: null,
          });
          expect(company.business_central_synced_at).toEqual(staleAt);
        });

        it("reports failed and keeps an existing not-found record on a Business Central error", async () => {
          const companyId = await createCompany(trigger, "NO", "00088888");
          const earlier = new Date(Date.now() - 60 * 60 * 1000);
          await companyService().updateCompanies({
            id: companyId,
            business_central_not_found_at: earlier,
            business_central_not_found_environment: "NO",
            business_central_not_found_customer_number: "00088888",
          });
          spyOnGetCustomer().mockRejectedValueOnce(
            new MedusaError(
              MedusaError.Types.INVALID_DATA,
              "BUSINESS_CENTRAL_NO_DISCOVERY_URL is required (Business Central environment NO)"
            )
          );

          const { result } = await runSync(trigger, companyId);

          const company = await readCompany(companyId);
          expect(result).toEqual({ status: "failed" });
          expect(company).toMatchObject({
            ...originalFields,
            business_central_not_found_at: earlier,
            business_central_not_found_environment: "NO",
            business_central_not_found_customer_number: "00088888",
          });
          expect(company.business_central_synced_at).toEqual(staleAt);
        });
      });
    });
  },
});
