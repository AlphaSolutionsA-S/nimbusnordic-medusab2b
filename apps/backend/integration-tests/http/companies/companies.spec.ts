import { medusaIntegrationTestRunner } from "@medusajs/test-utils";
import {
  ContainerRegistrationKeys,
  MedusaError,
  Modules,
} from "@medusajs/framework/utils";

import { BUSINESS_CENTRAL_MODULE } from "../../../src/modules/business-central";
import type {
  BCCustomer,
  IBusinessCentralModuleService,
} from "../../../src/modules/business-central/types";
import { COMPANY_MODULE } from "../../../src/modules/company";
import type { ICompanyModuleService } from "../../../src/types";
import { ModuleCompanySpendingLimitResetFrequency } from "../../../src/types";
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
    let storeHeaders, customerToken;

    beforeEach(async () => {
      const container = getContainer();
      await createAdminUser(adminHeaders, container);
      const publishableKey = await generatePublishableKey(container);
      storeHeaders = generateStoreHeaders({ publishableKey });
      const res = await createStoreUser({ api, storeHeaders });
      customerToken = res.token;
      storeHeaders.headers["Authorization"] = `Bearer ${customerToken}`;
    });

    async function createLinkedCompany(): Promise<string> {
      const response = await api.post(
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
        storeHeaders
      );
      const companyId = response.data.companies[0].id as string;
      const companyService = getContainer().resolve<ICompanyModuleService>(
        COMPANY_MODULE
      );

      await companyService.updateCompanies({
        id: companyId,
        business_central_customer_number: "00011551",
      });

      return companyId;
    }

    async function setSyncedAt(
      companyId: string,
      businessCentralSyncedAt: Date | null
    ): Promise<void> {
      const companyService = getContainer().resolve<ICompanyModuleService>(
        COMPANY_MODULE
      );

      await companyService.updateCompanies({
        id: companyId,
        business_central_synced_at: businessCentralSyncedAt,
      });
    }

    function businessCentralCustomer(displayName: string) {
      return {
        number: "00011551",
        displayName,
        email: "updated@example.com",
        phoneNumber: "87654321",
        addressLine1: "Updated Street 1",
        addressLine2: "Building 2",
        city: "Updated city",
        state: "Updated state",
        postalCode: "2000",
        country: "SE",
        blocked: "Invoice" as const,
        creditLimit: 12345.67,
        taxRegistrationNumber: "SE12345678",
        currencyCode: "SEK",
      };
    }

    describe("POST /store/companies", () => {
      it("successfully creates a company", async () => {
        const response = await api.post(
          "/store/companies",
          {
            name: "Test Company",
            email: "test@company.com",
            phone: "1234567890",
            address: "123 Test St",
            city: "Test City",
            state: "Test State",
            zip: "12345",
            country: "Test Country",
            logo_url: "http://test.com/logo.png",
            currency_code: "USD",
            spending_limit_reset_frequency: "monthly",
          },
          storeHeaders
        );

        expect(response.status).toEqual(200);
        expect(response.data.companies[0]).toMatchObject({
          id: expect.any(String),
          name: "Test Company",
          email: "test@company.com",
          phone: "1234567890",
          address: "123 Test St",
          city: "Test City",
          state: "Test State",
          zip: "12345",
          country: "Test Country",
          logo_url: "http://test.com/logo.png",
          currency_code: "USD",
        });
      });
    });

    describe("GET /store/companies/:id", () => {
      it("successfully retrieves a company", async () => {
        const response1 = await api.post(
          "/store/companies",
          {
            name: "Test Company",
            email: "test@company.com",
            phone: "1234567890",
            address: "123 Test St",
            city: "Test City",
            state: "Test State",
            zip: "12345",
            country: "Test Country",
            logo_url: "http://test.com/logo.png",
            currency_code: "USD",
            spending_limit_reset_frequency: "monthly",
          },
          storeHeaders
        );

        const response2 = await api.get(
          `/store/companies/${response1.data.companies[0].id}`,
          storeHeaders
        );

        expect(response2.data.company).toMatchObject({
          id: expect.any(String),
          name: "Test Company",
          email: "test@company.com",
          phone: "1234567890",
          address: "123 Test St",
          city: "Test City",
          state: "Test State",
          zip: "12345",
          country: "Test Country",
          logo_url: "http://test.com/logo.png",
          currency_code: "USD",
        });
      });

      it("should throw error when company does not exist", async () => {
        const { response } = await api
          .get(`/store/companies/does-not-exist`, storeHeaders)
          .catch((e) => e);

        expect(response.data).toMatchObject({
          type: "not_found",
        });
      });
    });

    describe("GET /store/companies/:id - Business Central freshness", () => {
      afterEach(() => {
        jest.restoreAllMocks();
      });

      it("does not call Business Central for a fresh company", async () => {
        const companyId = await createLinkedCompany();
        await setSyncedAt(companyId, new Date());
        const bcService =
          getContainer().resolve<IBusinessCentralModuleService>(
            BUSINESS_CENTRAL_MODULE
          );
        const getCustomerSpy = jest.spyOn(bcService, "getCustomer");

        const response = await api.get(
          `/store/companies/${companyId}`,
          storeHeaders
        );

        expect(response.status).toBe(200);
        expect(getCustomerSpy).not.toHaveBeenCalled();
        expect(response.data.company).toMatchObject({
          id: companyId,
          name: "Test Company",
          email: "company@example.com",
        });
      });

      it("synchronizes a company with no timestamp", async () => {
        const companyId = await createLinkedCompany();
        const bcService =
          getContainer().resolve<IBusinessCentralModuleService>(
            BUSINESS_CENTRAL_MODULE
          );
        const getCustomerSpy = jest
          .spyOn(bcService, "getCustomer")
          .mockResolvedValueOnce(businessCentralCustomer("Updated Company"));

        const response = await api.get(
          `/store/companies/${companyId}`,
          storeHeaders
        );
        const companyService = getContainer().resolve<ICompanyModuleService>(
          COMPANY_MODULE
        );
        const [company] = await companyService.listCompanies({ id: companyId });

        expect(response.status).toBe(200);
        expect(getCustomerSpy).toHaveBeenCalledTimes(1);
        expect(response.data.company).toMatchObject({
          name: "Updated Company",
          email: "updated@example.com",
        });
        expect(company.business_central_synced_at).not.toBeNull();
      });

      it("synchronizes a stale company and advances its timestamp", async () => {
        const companyId = await createLinkedCompany();
        const staleAt = new Date(Date.now() - 11 * 60 * 1000);
        await setSyncedAt(companyId, staleAt);
        const bcService =
          getContainer().resolve<IBusinessCentralModuleService>(
            BUSINESS_CENTRAL_MODULE
          );
        const getCustomerSpy = jest
          .spyOn(bcService, "getCustomer")
          .mockResolvedValueOnce(businessCentralCustomer("Stale Company Updated"));

        const response = await api.get(
          `/store/companies/${companyId}`,
          storeHeaders
        );
        const companyService = getContainer().resolve<ICompanyModuleService>(
          COMPANY_MODULE
        );
        const [company] = await companyService.listCompanies({ id: companyId });

        expect(response.status).toBe(200);
        expect(getCustomerSpy).toHaveBeenCalledTimes(1);
        expect(response.data.company.name).toBe("Stale Company Updated");
        expect(company.business_central_synced_at?.getTime()).toBeGreaterThan(
          staleAt.getTime()
        );
      });

      it("returns last-known data when a stale sync fails", async () => {
        const companyId = await createLinkedCompany();
        const staleAt = new Date(Date.now() - 11 * 60 * 1000);
        await setSyncedAt(companyId, staleAt);
        const bcService =
          getContainer().resolve<IBusinessCentralModuleService>(
            BUSINESS_CENTRAL_MODULE
          );
        const getCustomerSpy = jest
          .spyOn(bcService, "getCustomer")
          .mockRejectedValueOnce(
            new MedusaError(
              MedusaError.Types.UNEXPECTED_STATE,
              "expected BC failure"
            )
          );

        const response = await api.get(
          `/store/companies/${companyId}`,
          storeHeaders
        );
        const companyService = getContainer().resolve<ICompanyModuleService>(
          COMPANY_MODULE
        );
        const [company] = await companyService.listCompanies({ id: companyId });

        expect(response.status).toBe(200);
        expect(getCustomerSpy).toHaveBeenCalledTimes(1);
        expect(response.data.company).toMatchObject({
          name: "Test Company",
          email: "company@example.com",
        });
        expect(company.business_central_synced_at).toEqual(staleAt);
      });
    });

    describe("POST /store/companies/:id", () => {
      let company1;

      beforeEach(async () => {
        const response = await api.post(
          "/store/companies",
          {
            name: "Test Company",
            email: "test@company.com",
            phone: "1234567890",
            address: "123 Test St",
            city: "Test City",
            state: "Test State",
            zip: "12345",
            country: "Test Country",
            logo_url: "http://test.com/logo.png",
            currency_code: "USD",
            spending_limit_reset_frequency: "monthly",
          },
          storeHeaders
        );

        company1 = response.data.companies[0];
      });

      it("TC-6: the removed store update path cannot mutate a company", async () => {
        const response = await api.post(
          `/store/companies/${company1.id}`,
          { name: "Updated Company", email: "updated@company.com" },
          { ...storeHeaders, validateStatus: () => true }
        );

        const companyService = getContainer().resolve<ICompanyModuleService>(
          COMPANY_MODULE
        );
        const [company] = await companyService.listCompanies({
          id: company1.id,
        });

        expect(response.status).toEqual(404);
        expect(company).toMatchObject({
          name: "Test Company",
          email: "test@company.com",
        });
      });
    });

    describe("DELETE /store/companies/:id", () => {
      console.log("vic logs storeHeaders", storeHeaders);
      let company1;

      beforeEach(async () => {
        const response = await api.post(
          "/store/companies",
          {
            name: "Test Company",
            email: "test@company.com",
            phone: "1234567890",
            address: "123 Test St",
            city: "Test City",
            state: "Test State",
            zip: "12345",
            country: "Test Country",
            logo_url: "http://test.com/logo.png",
            currency_code: "USD",
            spending_limit_reset_frequency: "monthly",
          },
          storeHeaders
        );

        company1 = response.data.companies[0];
      });

      it("successfully deletes a company", async () => {
        const response = await api.delete(
          `/store/companies/${company1.id}`,
          storeHeaders
        );

        expect(response.status).toEqual(204);
      });

      it("should throw an error when company does not exist", async () => {
        const response = await api
          .delete(`/store/companies/does-not-exist`, storeHeaders)
          .catch((e) => e);

        expect(response.status).toEqual(404);
      });
    });

    describe("Business Central customer number", () => {
      it("TC-1: rejects business_central_customer_number on create", async () => {
        const { response } = await api
          .post(
            "/store/companies",
            {
              name: "BC Company",
              email: "bc@company.com",
              currency_code: "USD",
              business_central_customer_number: "123456",
            },
            storeHeaders
          )
          .catch((e) => e);

        expect(response.status).toEqual(400);
      });

      it("TC-2: rejects non-numeric business_central_customer_number on create", async () => {
        const { response } = await api
          .post(
            "/store/companies",
            {
              name: "BC Company",
              email: "bc@company.com",
              currency_code: "USD",
              business_central_customer_number: "ABC123",
            },
            storeHeaders
          )
          .catch((e) => e);

        expect(response.status).toEqual(400);
      });

      it("TC-3: offers no store update path for business_central_customer_number", async () => {
        const createResponse = await api.post(
          "/store/companies",
          {
            name: "BC Company",
            email: "bc@company.com",
            currency_code: "USD",
          },
          storeHeaders
        );
        const company = createResponse.data.companies[0];

        const { response } = await api
          .post(
            `/store/companies/${company.id}`,
            { business_central_customer_number: "98765" },
            storeHeaders
          )
          .catch((e) => e);

        expect(response.status).toEqual(404);
      });

      it("TC-4: offers no store update path for a non-numeric business_central_customer_number", async () => {
        const createResponse = await api.post(
          "/store/companies",
          {
            name: "BC Company",
            email: "bc@company.com",
            currency_code: "USD",
          },
          storeHeaders
        );
        const company = createResponse.data.companies[0];

        const { response } = await api
          .post(
            `/store/companies/${company.id}`,
            { business_central_customer_number: "12A34" },
            storeHeaders
          )
          .catch((e) => e);

        expect(response.status).toEqual(404);

        const getResponse = await api.get(
          `/store/companies/${company.id}`,
          storeHeaders
        );
        expect(getResponse.data.company.business_central_customer_number).toEqual(
          null
        );
      });

      it("TC-5: no regression when business_central_customer_number is absent", async () => {
        const createResponse = await api.post(
          "/store/companies",
          {
            name: "No BC Company",
            email: "nobc@company.com",
            currency_code: "USD",
          },
          storeHeaders
        );

        expect(createResponse.status).toEqual(200);
        expect(
          createResponse.data.companies[0].business_central_customer_number
        ).toBeNull();

        const company = createResponse.data.companies[0];
        const getResponse = await api.get(
          `/store/companies/${company.id}`,
          storeHeaders
        );

        expect(getResponse.status).toEqual(200);
        expect(
          getResponse.data.company.business_central_customer_number
        ).toBeNull();
      });
    });

    describe("Store company profile financial-field authorization", () => {
      const RESTRICTED_COMPANY_KEYS = [
        "credit_limit",
        "blocked",
        "spending_limit_reset_frequency",
      ];
      let companyId: string;
      let employeeId: string;
      let employeeHeaders: { headers: Record<string, string> };
      let foreignHeaders: { headers: Record<string, string> };

      async function loginCustomer(email: string): Promise<string> {
        const response = await api.post("/auth/customer/emailpass", {
          email,
          password: "password123",
        });
        return response.data.token;
      }

      function withToken(token: string) {
        return {
          headers: { ...storeHeaders.headers, Authorization: `Bearer ${token}` },
          validateStatus: () => true,
        };
      }

      function expectNoRestrictedKeys(company: Record<string, unknown>) {
        for (const key of RESTRICTED_COMPANY_KEYS) {
          expect(company).not.toHaveProperty(key);
        }
      }

      beforeEach(async () => {
        companyId = await createLinkedCompany();
        const companyService = getContainer().resolve<ICompanyModuleService>(
          COMPANY_MODULE
        );
        await companyService.updateCompanies({
          id: companyId,
          credit_limit: 12345.67,
          blocked: "Invoice",
          vat_number: "DK12345678",
          business_central_synced_at: new Date(),
        });

        const employeeResponse = await api.post(
          `/store/companies/${companyId}/employees`,
          {
            email: "regular@example.com",
            password: "password123",
            first_name: "Regular",
            last_name: "Employee",
            spending_limit: 500,
            is_admin: false,
          },
          storeHeaders
        );
        employeeId = employeeResponse.data.employee.id;
        employeeHeaders = withToken(await loginCustomer("regular@example.com"));

        const registerToken = (
          await api.post("/auth/customer/emailpass/register", {
            email: "foreign@example.com",
            password: "password123",
          })
        ).data.token;
        await api.post(
          "/store/customers",
          { email: "foreign@example.com" },
          {
            headers: {
              ...storeHeaders.headers,
              Authorization: `Bearer ${registerToken}`,
            },
          }
        );
        foreignHeaders = withToken(await loginCustomer("foreign@example.com"));
        await api.post(
          "/store/companies",
          {
            name: "Foreign Company",
            email: "foreign-company@example.com",
            currency_code: "DKK",
          },
          foreignHeaders
        );
      });

      it("TC-1: a regular employee receives basic data without financial keys", async () => {
        const response = await api.get(
          `/store/companies/${companyId}`,
          employeeHeaders
        );

        expect(response.status).toBe(200);
        expect(response.data.company).toMatchObject({
          id: companyId,
          name: "Test Company",
          email: "company@example.com",
          phone: "12345678",
          address: "Original address",
          city: "Original city",
          state: "Original state",
          zip: "1000",
          country: "DK",
          currency_code: "DKK",
          vat_number: "DK12345678",
          business_central_customer_number: "00011551",
        });
        expectNoRestrictedKeys(response.data.company);
        expect(response.data.company.employees.length).toBeGreaterThan(1);
        for (const employee of response.data.company.employees) {
          expect(employee).not.toHaveProperty("spending_limit");
        }
        expect(JSON.stringify(response.data)).not.toMatch(
          /credit_limit|spending_limit|"blocked"|12345\.67/
        );
      });

      it("TC-1: employee read endpoints omit financial keys for a regular employee", async () => {
        const list = await api.get(
          `/store/companies/${companyId}/employees`,
          employeeHeaders
        );
        const single = await api.get(
          `/store/companies/${companyId}/employees/${employeeId}`,
          employeeHeaders
        );

        expect(list.status).toBe(200);
        expect(list.data.employees.length).toBeGreaterThan(1);
        expect(single.status).toBe(200);
        expect(single.data.employee).toMatchObject({
          id: employeeId,
          company_id: companyId,
          is_admin: false,
          customer: expect.objectContaining({ email: "regular@example.com" }),
        });
        expectNoRestrictedKeys(single.data.employee.company);
        expect(JSON.stringify([list.data, single.data])).not.toMatch(
          /credit_limit|spending_limit|"blocked"|12345\.67/
        );
      });

      it("TC-2: a company admin receives the restricted financial values", async () => {
        const response = await api.get(
          `/store/companies/${companyId}`,
          storeHeaders
        );
        const single = await api.get(
          `/store/companies/${companyId}/employees/${employeeId}`,
          storeHeaders
        );

        expect(response.status).toBe(200);
        expect(response.data.company).toMatchObject({
          credit_limit: 12345.67,
          blocked: "Invoice",
          spending_limit_reset_frequency: "monthly",
        });
        expect(response.data.company.employees).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ id: employeeId, spending_limit: 500 }),
          ])
        );
        expect(single.data.employee).toMatchObject({
          spending_limit: 500,
          company: expect.objectContaining({ credit_limit: 12345.67 }),
        });
      });

      it("TC-3: another company's member cannot read the company or its employees", async () => {
        for (const url of [
          `/store/companies/${companyId}`,
          `/store/companies/${companyId}/employees`,
          `/store/companies/${companyId}/employees/${employeeId}`,
        ]) {
          const response = await api.get(url, foreignHeaders);
          expect({ url, status: response.status }).toEqual({ url, status: 403 });
          expect(JSON.stringify(response.data)).not.toMatch(
            /credit_limit|spending_limit|Test Company|12345\.67/
          );
        }
      });

      it("TC-4: a fields selection cannot restore redacted values", async () => {
        const response = await api.get(
          `/store/companies/${companyId}?fields=+credit_limit,+blocked,+spending_limit_reset_frequency,*employees`,
          employeeHeaders
        );
        const single = await api.get(
          `/store/companies/${companyId}/employees/${employeeId}?fields=+spending_limit,*company`,
          employeeHeaders
        );

        expect(response.status).toBe(200);
        expectNoRestrictedKeys(response.data.company);
        expect(single.status).toBe(200);
        expect(JSON.stringify([response.data, single.data])).not.toMatch(
          /credit_limit|spending_limit|"blocked"|12345\.67/
        );
      });

      it("TC-5: a company cart exposes only the company fields checkout needs", async () => {
        const container = getContainer();
        // Carts are personal (NIMBUS-177): the employee reads their own company cart.
        const owner = (await api.get("/store/customers/me", employeeHeaders)).data
          .customer.id;
        const cart = await container
          .resolve(Modules.CART)
          .createCarts({ currency_code: "dkk", customer_id: owner });
        await container.resolve(ContainerRegistrationKeys.LINK).create({
          [COMPANY_MODULE]: { company_id: companyId },
          [Modules.CART]: { cart_id: cart.id },
        });

        for (const fields of [
          "*company",
          "+company.credit_limit",
          "+company.blocked",
          "+company.spending_limit_reset_frequency",
          "*company.employees",
        ]) {
          const response = await api.get(
            `/store/carts/${cart.id}?fields=${fields}`,
            employeeHeaders
          );
          // Medusa drops fields that are not allowed rather than rejecting the request.
          expect({ fields, status: response.status }).toEqual({ fields, status: 200 });
          expect(JSON.stringify(response.data)).not.toMatch(
            /spending_limit"|"blocked"|12345\.67/
          );
        }

        const storefrontFields = await api.get(
          `/store/carts/${cart.id}?fields=+company.id,+company.name,*company.approval_settings`,
          employeeHeaders
        );
        expect(storefrontFields.status).toBe(200);
        expect(storefrontFields.data.cart.company).toMatchObject({
          id: companyId,
          name: "Test Company",
        });
        expectNoRestrictedKeys(storefrontFields.data.cart.company);
      });

      it("TC-6: the customer profile cannot select the linked company", async () => {
        for (const fields of [
          "*employee.company",
          "+employee.company.credit_limit",
          "+employee.spending_limit,*employee.company",
        ]) {
          const response = await api.get(
            `/store/customers/me?fields=${fields}`,
            employeeHeaders
          );
          expect(JSON.stringify(response.data)).not.toMatch(
            /credit_limit|"blocked"|12345\.67/
          );
        }
      });
    });

    describe("POST /admin/companies/:id - Business Central-managed fields", () => {
      it("accepts blocked, credit_limit, and vat_number from Admin", async () => {
        const companyId = await createLinkedCompany();

        const response = await api.post(
          `/admin/companies/${companyId}`,
          { blocked: "All", credit_limit: 9876.54, vat_number: "DK87654321" },
          adminHeaders
        );

        expect(response.status).toBe(200);
        expect(response.data.company).toMatchObject({
          blocked: "All",
          credit_limit: 9876.54,
          vat_number: "DK87654321",
        });

        const companyService = getContainer().resolve<ICompanyModuleService>(
          COMPANY_MODULE
        );
        const [company] = await companyService.listCompanies({ id: companyId });
        expect(company).toMatchObject({
          blocked: "All",
          vat_number: "DK87654321",
        });
        expect(Number(company.credit_limit)).toBe(9876.54);
      });
    });

    describe("POST /admin/companies/:id/sync-business-central", () => {
      beforeEach(() => {
        jest.restoreAllMocks();
      });

      afterEach(() => {
        jest.restoreAllMocks();
      });

      const staleAt = new Date(Date.now() - 11 * 60 * 1000);

      const bcCustomer: BCCustomer = {
        number: "00044444",
        displayName: "Admin Synced Company",
        email: "admin-synced@example.com",
        phoneNumber: "44443333",
        addressLine1: "Admin Street 4",
        addressLine2: "",
        city: "Admin city",
        state: "",
        postalCode: "4000",
        country: "SE",
        blocked: "Invoice",
        creditLimit: 2500,
        taxRegistrationNumber: "SE44444444",
        currencyCode: "SEK",
      };

      const originalFields = {
        name: "Admin Sync Company",
        email: "admin-sync@example.com",
        phone: "22223333",
        address: "Original admin address",
        city: "Original admin city",
        zip: "1000",
        country: "DK",
        currency_code: "DKK",
      };

      // Created without employees: the Admin sync starts from the company id alone.
      async function createCompany(
        businessCentralCustomerNumber: string | null,
        name = originalFields.name
      ): Promise<string> {
        const companyService = getContainer().resolve<ICompanyModuleService>(
          COMPANY_MODULE
        );
        const created = await companyService.createCompanies({
          ...originalFields,
          name,
          state: null,
          logo_url: "https://example.com/admin-sync.png",
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
        const companyService = getContainer().resolve<ICompanyModuleService>(
          COMPANY_MODULE
        );
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

      function syncUrl(companyId: string): string {
        return `/admin/companies/${companyId}/sync-business-central`;
      }

      it("updates the company from Business Central and leaves other companies alone", async () => {
        const companyId = await createCompany("00044444");
        const otherCompanyId = await createCompany("00055555", "Other Admin Company");
        const getCustomerSpy = spyOnGetCustomer().mockResolvedValueOnce(
          bcCustomer
        );

        const response = await api.post(syncUrl(companyId), {}, adminHeaders);

        expect(response.status).toBe(200);
        expect(response.data).toEqual({ status: "updated" });
        expect(getCustomerSpy).toHaveBeenCalledTimes(1);
        expect(getCustomerSpy).toHaveBeenCalledWith("00044444");

        const read = await api.get(`/admin/companies/${companyId}`, adminHeaders);
        expect(read.data.company.name).toBe("Admin Synced Company");
        expect(typeof read.data.company.business_central_synced_at).toBe(
          "string"
        );
        expect(
          new Date(read.data.company.business_central_synced_at).getTime()
        ).toBeGreaterThan(staleAt.getTime());

        const company = await readCompany(companyId);
        expect(company).toMatchObject({
          order_api_enabled: true,
          logo_url: "https://example.com/admin-sync.png",
          spending_limit_reset_frequency: "monthly",
          business_central_customer_number: "00044444",
        });

        const otherCompany = await readCompany(otherCompanyId);
        expect(otherCompany).toMatchObject({
          ...originalFields,
          name: "Other Admin Company",
        });
        expect(otherCompany.business_central_synced_at).toEqual(staleAt);
      });

      it("returns skipped without a Business Central call for a company with no BC number", async () => {
        const companyId = await createCompany(null);
        const getCustomerSpy = spyOnGetCustomer();

        const response = await api.post(syncUrl(companyId), {}, adminHeaders);

        expect(response.status).toBe(200);
        expect(response.data).toEqual({ status: "skipped" });
        expect(getCustomerSpy).not.toHaveBeenCalled();
        const company = await readCompany(companyId);
        expect(company).toMatchObject(originalFields);
        expect(company.business_central_synced_at).toEqual(staleAt);
      });

      it("returns failed and changes nothing on an expected Business Central error", async () => {
        const companyId = await createCompany("00044444");
        spyOnGetCustomer().mockRejectedValueOnce(
          new MedusaError(
            MedusaError.Types.UNEXPECTED_STATE,
            "expected BC failure"
          )
        );

        const response = await api.post(syncUrl(companyId), {}, adminHeaders);

        expect(response.status).toBe(200);
        expect(response.data).toEqual({ status: "failed" });
        const company = await readCompany(companyId);
        expect(company).toMatchObject(originalFields);
        expect(company.business_central_synced_at).toEqual(staleAt);
      });

      it("returns 404 without a Business Central call for an unknown company", async () => {
        const getCustomerSpy = spyOnGetCustomer();

        const response = await api.post(
          syncUrl("comp_does_not_exist"),
          {},
          { ...adminHeaders, validateStatus: () => true }
        );

        expect(response.status).toBe(404);
        expect(getCustomerSpy).not.toHaveBeenCalled();
      });

      it.each([
        [{ name: "Injected Name" }],
        [{ business_central_customer_number: "00099999" }],
      ])("refuses a body of %j and leaves the company unchanged", async (body) => {
        const companyId = await createCompany("00044444");
        const getCustomerSpy = spyOnGetCustomer();

        const response = await api.post(syncUrl(companyId), body, {
          ...adminHeaders,
          validateStatus: () => true,
        });

        expect(response.status).toBe(400);
        expect(getCustomerSpy).not.toHaveBeenCalled();
        const company = await readCompany(companyId);
        expect(company).toMatchObject({
          ...originalFields,
          business_central_customer_number: "00044444",
        });
        expect(company.business_central_synced_at).toEqual(staleAt);
      });
    });

    describe("GET /admin/companies - Business Central last-synced time", () => {
      it("returns null for a company that was never synced", async () => {
        const response = await api.post(
          "/admin/companies",
          {
            name: "Never Synced",
            email: "never-synced@example.com",
            currency_code: "DKK",
          },
          adminHeaders
        );
        const companyId = response.data.companies[0].id as string;

        const single = await api.get(
          `/admin/companies/${companyId}`,
          adminHeaders
        );
        const list = await api.get("/admin/companies", adminHeaders);

        expect(single.status).toBe(200);
        expect(single.data.company).toHaveProperty(
          "business_central_synced_at",
          null
        );
        expect(
          list.data.companies.find(
            (company: { id: string }) => company.id === companyId
          )
        ).toHaveProperty("business_central_synced_at", null);
      });
    });

    describe("order_api_enabled company setting", () => {
      async function createAdminCompany(): Promise<string> {
        const response = await api.post(
          "/admin/companies",
          {
            name: "Admin Company",
            email: "admin-company@example.com",
            currency_code: "DKK",
          },
          adminHeaders
        );
        return response.data.companies[0].id as string;
      }

      it("a new company is returned with the setting off", async () => {
        const companyId = await createAdminCompany();

        const response = await api.get(
          `/admin/companies/${companyId}`,
          adminHeaders
        );

        expect(response.status).toBe(200);
        expect(response.data.company.order_api_enabled).toBe(false);
      });

      it("the Admin update switches the setting on and off again", async () => {
        const companyId = await createAdminCompany();

        const on = await api.post(
          `/admin/companies/${companyId}`,
          { order_api_enabled: true },
          adminHeaders
        );
        expect(on.status).toBe(200);
        expect(on.data.company.order_api_enabled).toBe(true);
        const readOn = await api.get(
          `/admin/companies/${companyId}`,
          adminHeaders
        );
        expect(readOn.data.company.order_api_enabled).toBe(true);

        const off = await api.post(
          `/admin/companies/${companyId}`,
          { order_api_enabled: false },
          adminHeaders
        );
        expect(off.status).toBe(200);
        expect(off.data.company.order_api_enabled).toBe(false);
        const readOff = await api.get(
          `/admin/companies/${companyId}`,
          adminHeaders
        );
        expect(readOff.data.company.order_api_enabled).toBe(false);
      });

      it("the Admin create refuses the setting", async () => {
        const response = await api.post(
          "/admin/companies",
          {
            name: "Enabled At Birth",
            email: "enabled@example.com",
            currency_code: "DKK",
            order_api_enabled: true,
          },
          { ...adminHeaders, validateStatus: () => true }
        );

        expect(response.status).toBe(400);
        const companyService = getContainer().resolve<ICompanyModuleService>(
          COMPANY_MODULE
        );
        const companies = await companyService.listCompanies({});
        expect(
          companies.filter((company) => company.name === "Enabled At Birth")
        ).toHaveLength(0);
      });

      it("the store create refuses the setting", async () => {
        const response = await api.post(
          "/store/companies",
          {
            name: "Store Enabled",
            email: "store-enabled@example.com",
            currency_code: "DKK",
            order_api_enabled: true,
          },
          { ...storeHeaders, validateStatus: () => true }
        );

        expect(response.status).toBe(400);
      });

      it("the store company read never returns the setting", async () => {
        const companyId = await createLinkedCompany();
        const companyService = getContainer().resolve<ICompanyModuleService>(
          COMPANY_MODULE
        );
        await companyService.updateCompanies({
          id: companyId,
          order_api_enabled: true,
          business_central_synced_at: new Date(),
        });

        for (const query of [
          "",
          "?fields=order_api_enabled",
          "?fields=+order_api_enabled",
        ]) {
          const response = await api.get(
            `/store/companies/${companyId}${query}`,
            { ...storeHeaders, validateStatus: () => true }
          );
          expect({ query, status: response.status }).toEqual({
            query,
            status: 200,
          });
          expect(response.data.company).not.toHaveProperty(
            "order_api_enabled"
          );
          expect(JSON.stringify(response.data)).not.toMatch(
            /order_api_enabled/
          );
        }
      });
    });
  },
});
