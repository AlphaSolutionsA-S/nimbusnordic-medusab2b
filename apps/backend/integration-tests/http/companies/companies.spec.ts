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

      it("returns no Business Central not-found field to a company admin or a regular employee", async () => {
        const companyService = getContainer().resolve<ICompanyModuleService>(
          COMPANY_MODULE
        );
        await companyService.updateCompanies({
          id: companyId,
          business_central_not_found_at: new Date(),
          business_central_not_found_environment: "NO",
          business_central_not_found_customer_number: "00011551",
        });

        for (const headers of [storeHeaders, employeeHeaders]) {
          const response = await api.get(
            `/store/companies/${companyId}?fields=+business_central_not_found_at,+business_central_not_found_environment,+business_central_not_found_customer_number`,
            headers
          );

          expect(response.status).toBe(200);
          expect(response.data.company.id).toBe(companyId);
          expect(JSON.stringify(response.data)).not.toMatch(
            /business_central_not_found/
          );
        }
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
        expect(getCustomerSpy).toHaveBeenCalledWith("DK", "00044444");

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

      it("routes a Norwegian company to the Norwegian Business Central", async () => {
        const companyId = await createCompany("00044444");
        const companyService = getContainer().resolve<ICompanyModuleService>(
          COMPANY_MODULE
        );
        await companyService.updateCompanies({ id: companyId, country: "NO" });
        const getCustomerSpy = spyOnGetCustomer().mockResolvedValueOnce(
          bcCustomer
        );

        const response = await api.post(syncUrl(companyId), {}, adminHeaders);

        expect(response.status).toBe(200);
        expect(response.data).toEqual({ status: "updated" });
        expect(getCustomerSpy).toHaveBeenCalledWith("NO", "00044444");
      });

      it("returns skipped and records the not-found record when Business Central has no such customer", async () => {
        const companyId = await createCompany("00044444");
        spyOnGetCustomer().mockResolvedValueOnce(null);

        const response = await api.post(syncUrl(companyId), {}, adminHeaders);

        expect(response.status).toBe(200);
        expect(response.data).toEqual({ status: "skipped" });
        const company = await readCompany(companyId);
        expect(company).toMatchObject({
          ...originalFields,
          business_central_not_found_environment: "DK",
          business_central_not_found_customer_number: "00044444",
        });
        expect(company.business_central_not_found_at).toBeInstanceOf(Date);
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

    describe("Admin Business Central customer routes", () => {
      beforeEach(() => {
        jest.restoreAllMocks();
      });

      afterEach(() => {
        jest.restoreAllMocks();
      });

      function card(country: string, displayName: string): BCCustomer {
        return {
          number: "00066666",
          displayName,
          email: "card@example.com",
          phoneNumber: "66665555",
          addressLine1: "Card Street 6",
          addressLine2: "Floor 2",
          city: "Card city",
          state: "",
          postalCode: "6000",
          country,
          blocked: "Invoice",
          creditLimit: 6000,
          taxRegistrationNumber: "VAT66666666",
          currencyCode: "NOK",
        };
      }

      async function createCompany(
        businessCentralCustomerNumber: string | null,
        country = "DK"
      ): Promise<string> {
        const companyService = getContainer().resolve<ICompanyModuleService>(
          COMPANY_MODULE
        );
        const created = await companyService.createCompanies({
          name: "BC Customer Company",
          email: "bc-customer@example.com",
          phone: "11112222",
          address: "Original address",
          city: "Original city",
          state: null,
          zip: "1000",
          country,
          logo_url: null,
          currency_code: "DKK",
          business_central_customer_number: businessCentralCustomerNumber,
          spending_limit_reset_frequency:
            ModuleCompanySpendingLimitResetFrequency.MONTHLY,
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

      // Answers per environment; anything not listed is "no such customer".
      function stubGetCustomer(
        answers: Partial<Record<"DK" | "NO", BCCustomer | Error>>
      ) {
        const bcService = getContainer().resolve<IBusinessCentralModuleService>(
          BUSINESS_CENTRAL_MODULE
        );

        return jest
          .spyOn(bcService, "getCustomer")
          .mockImplementation(async (environment) => {
            const answer = answers[environment];
            if (answer instanceof Error) {
              throw answer;
            }
            return answer ?? null;
          });
      }

      function url(companyId: string, suffix = ""): string {
        return `/admin/companies/${companyId}/business-central-customer${suffix}`;
      }

      const allowStatus = { ...adminHeaders, validateStatus: () => true };

      describe("GET status", () => {
        it("returns the routed environment, customer number and not-found record", async () => {
          const companyId = await createCompany("00066666", " no ");
          const companyService = getContainer().resolve<ICompanyModuleService>(
            COMPANY_MODULE
          );
          await companyService.updateCompanies({
            id: companyId,
            business_central_not_found_at: new Date("2026-10-01T10:00:00.000Z"),
            business_central_not_found_environment: "NO",
            business_central_not_found_customer_number: "00066666",
          });
          const getCustomerSpy = stubGetCustomer({});

          const response = await api.get(url(companyId), adminHeaders);

          expect(response.status).toBe(200);
          expect(response.data).toEqual({
            routed_environment: "NO",
            customer_number: "00066666",
            not_found: {
              at: "2026-10-01T10:00:00.000Z",
              environment: "NO",
              customer_number: "00066666",
            },
          });
          expect(getCustomerSpy).not.toHaveBeenCalled();
        });

        it("returns DK and no record for a company without a customer number", async () => {
          const companyId = await createCompany(null, "SE");

          const response = await api.get(url(companyId), adminHeaders);

          expect(response.data).toEqual({
            routed_environment: "DK",
            customer_number: null,
            not_found: null,
          });
        });

        it("answers 404 for an unknown company", async () => {
          const response = await api.get(url("comp_does_not_exist"), allowStatus);

          expect(response.status).toBe(404);
        });
      });

      describe("GET lookup", () => {
        const dkResult = {
          environment: "DK",
          status: "found",
          customer: {
            name: "Dansk Kort",
            country: "DK",
            routes_to: "DK",
            routes_elsewhere: false,
          },
        };
        const noResult = {
          environment: "NO",
          status: "found",
          customer: {
            name: "Norsk Kort",
            country: "NO",
            routes_to: "NO",
            routes_elsewhere: false,
          },
        };

        it.each([
          ["DK only", { DK: card("DK", "Dansk Kort") }, [dkResult, { environment: "NO", status: "not_found", customer: null }]],
          ["NO only", { NO: card("NO", "Norsk Kort") }, [{ environment: "DK", status: "not_found", customer: null }, noResult]],
          ["both", { DK: card("DK", "Dansk Kort"), NO: card("NO", "Norsk Kort") }, [dkResult, noResult]],
          [
            "neither",
            {},
            [
              { environment: "DK", status: "not_found", customer: null },
              { environment: "NO", status: "not_found", customer: null },
            ],
          ],
        ] as const)(
          "reports a card found in %s and writes nothing",
          async (_case, answers, results) => {
            const companyId = await createCompany("00066666");
            const before = await readCompany(companyId);
            const getCustomerSpy = stubGetCustomer(answers);

            const response = await api.get(url(companyId, "/lookup"), adminHeaders);

            expect(response.status).toBe(200);
            expect(response.data).toEqual({ customer_number: "00066666", results });
            expect(getCustomerSpy).toHaveBeenCalledWith("DK", "00066666");
            expect(getCustomerSpy).toHaveBeenCalledWith("NO", "00066666");
            expect(await readCompany(companyId)).toEqual(before);
          }
        );

        it("flags a card in NO whose country routes to DK", async () => {
          const companyId = await createCompany("00066666");
          stubGetCustomer({ NO: card("SE", "Svensk Kort") });

          const response = await api.get(url(companyId, "/lookup"), adminHeaders);

          expect(response.data.results[1]).toEqual({
            environment: "NO",
            status: "found",
            customer: {
              name: "Svensk Kort",
              country: "SE",
              routes_to: "DK",
              routes_elsewhere: true,
            },
          });
        });

        it("returns no address, contact, VAT or credit data", async () => {
          const companyId = await createCompany("00066666");
          stubGetCustomer({ DK: card("DK", "Dansk Kort"), NO: card("NO", "Norsk Kort") });

          const response = await api.get(url(companyId, "/lookup"), adminHeaders);

          for (const result of response.data.results) {
            expect(Object.keys(result.customer).sort()).toEqual([
              "country",
              "name",
              "routes_elsewhere",
              "routes_to",
            ]);
          }
          const body = JSON.stringify(response.data);
          for (const value of ["card@example.com", "66665555", "Card Street 6", "Card city", "VAT66666666", "6000"]) {
            expect(body).not.toContain(value);
          }
        });

        it("reports could_not_check for the failing environment, keeps the other result and logs ids only", async () => {
          const companyId = await createCompany("00066666");
          stubGetCustomer({
            DK: card("DK", "Dansk Kort"),
            NO: new MedusaError(
              MedusaError.Types.UNEXPECTED_STATE,
              "Business Central customer request failed with status 503"
            ),
          });
          const logger = getContainer().resolve(ContainerRegistrationKeys.LOGGER);
          const warnSpy = jest.spyOn(logger, "warn");

          const response = await api.get(url(companyId, "/lookup"), adminHeaders);

          expect(response.status).toBe(200);
          expect(response.data.results).toEqual([
            dkResult,
            { environment: "NO", status: "could_not_check", customer: null },
          ]);
          const lookupLogs = warnSpy.mock.calls
            .map(([message]) => String(message))
            .filter((message) => message.includes(companyId));
          expect(lookupLogs).toHaveLength(1);
          expect(lookupLogs[0]).toContain("environment NO");
          expect(lookupLogs[0]).not.toContain("00066666");
          expect(lookupLogs[0]).not.toContain("503");
        });

        it("answers 400 without a Business Central call for a company with no customer number", async () => {
          const companyId = await createCompany(null);
          const getCustomerSpy = stubGetCustomer({});

          const response = await api.get(url(companyId, "/lookup"), allowStatus);

          expect(response.status).toBe(400);
          expect(getCustomerSpy).not.toHaveBeenCalled();
        });

        it("answers 404 without a Business Central call for an unknown company", async () => {
          const getCustomerSpy = stubGetCustomer({});

          const response = await api.get(url("comp_does_not_exist", "/lookup"), allowStatus);

          expect(response.status).toBe(404);
          expect(getCustomerSpy).not.toHaveBeenCalled();
        });
      });

      describe("POST use", () => {
        it("sets the country from the NO card, syncs against NO and clears the not-found record", async () => {
          const companyId = await createCompany("00066666", "DK");
          const companyService = getContainer().resolve<ICompanyModuleService>(
            COMPANY_MODULE
          );
          await companyService.updateCompanies({
            id: companyId,
            business_central_not_found_at: new Date("2026-10-01T10:00:00.000Z"),
            business_central_not_found_environment: "DK",
            business_central_not_found_customer_number: "00066666",
          });
          const getCustomerSpy = stubGetCustomer({ NO: card("NO", "Norsk Kort") });

          const response = await api.post(
            url(companyId, "/use"),
            { environment: "NO" },
            adminHeaders
          );

          expect(response.status).toBe(200);
          expect(response.data).toEqual({ status: "updated", country: "NO" });
          expect(getCustomerSpy.mock.calls).toEqual([
            ["NO", "00066666"],
            ["NO", "00066666"],
          ]);
          const company = await readCompany(companyId);
          expect(company).toMatchObject({
            name: "Norsk Kort",
            country: "NO",
            currency_code: "NOK",
            business_central_not_found_at: null,
            business_central_not_found_environment: null,
            business_central_not_found_customer_number: null,
          });
        });

        it("answers 404 and leaves the company unchanged when the card is gone", async () => {
          const companyId = await createCompany("00066666", "DK");
          const before = await readCompany(companyId);
          const getCustomerSpy = stubGetCustomer({ DK: card("NO", "Dansk Kort") });

          const response = await api.post(
            url(companyId, "/use"),
            { environment: "NO" },
            allowStatus
          );

          expect(response.status).toBe(404);
          expect(getCustomerSpy).toHaveBeenCalledTimes(1);
          expect(await readCompany(companyId)).toEqual(before);
        });

        it("answers 400 without a Business Central call for a company with no customer number", async () => {
          const companyId = await createCompany(null);
          const getCustomerSpy = stubGetCustomer({ NO: card("NO", "Norsk Kort") });

          const response = await api.post(
            url(companyId, "/use"),
            { environment: "NO" },
            allowStatus
          );

          expect(response.status).toBe(400);
          expect(getCustomerSpy).not.toHaveBeenCalled();
        });

        it("answers 404 without a Business Central call for an unknown company", async () => {
          const getCustomerSpy = stubGetCustomer({ NO: card("NO", "Norsk Kort") });

          const response = await api.post(
            url("comp_does_not_exist", "/use"),
            { environment: "NO" },
            allowStatus
          );

          expect(response.status).toBe(404);
          expect(getCustomerSpy).not.toHaveBeenCalled();
        });

        it.each([
          [{ environment: "NO", country: "NO" }],
          [{ environment: "SE" }],
          [{}],
        ])("refuses a body of %j and leaves the company unchanged", async (body) => {
          const companyId = await createCompany("00066666", "DK");
          const before = await readCompany(companyId);
          const getCustomerSpy = stubGetCustomer({ NO: card("NO", "Norsk Kort") });

          const response = await api.post(url(companyId, "/use"), body, allowStatus);

          expect(response.status).toBe(400);
          expect(getCustomerSpy).not.toHaveBeenCalled();
          expect(await readCompany(companyId)).toEqual(before);
        });
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
