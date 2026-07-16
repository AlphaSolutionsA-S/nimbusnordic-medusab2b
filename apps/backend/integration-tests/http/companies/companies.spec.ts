import { medusaIntegrationTestRunner } from "@medusajs/test-utils";
import {
  adminHeaders,
  createAdminUser,
  createStoreUser,
} from "../../utils/admin";
import {
  cartSeeder,
  productSeeder,
  regionSeeder,
  salesChannelSeeder,
} from "../../utils/seeder";
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
    let storeHeaders, cart, product, salesChannel, region, customerToken;

    beforeEach(async () => {
      const container = getContainer();
      await createAdminUser(adminHeaders, container);
      const publishableKey = await generatePublishableKey(container);
      storeHeaders = generateStoreHeaders({ publishableKey });
      const res = await createStoreUser({ api, storeHeaders });
      customerToken = res.token;
      console.log("vic logs customerToken", customerToken);
      storeHeaders.headers["Authorization"] = `Bearer ${customerToken}`;
      console.log("vic logs storeHeaders", storeHeaders);
      region = await regionSeeder({ api, adminHeaders, data: {} });

      salesChannel = await salesChannelSeeder({
        api,
        adminHeaders,
        data: {},
      });

      product = await productSeeder({
        api,
        adminHeaders,
        data: {
          sales_channels: [{ id: salesChannel.id }],
        },
      });

      await api.post(
        `/admin/api-keys/${publishableKey.id}/sales-channels`,
        { add: [salesChannel.id] },
        adminHeaders
      );

      cart = await cartSeeder({
        api,
        storeHeaders,
        data: {
          region_id: region.id,
          sales_channel_id: salesChannel.id,
          items: [{ quantity: 1, variant_id: product.variants[0].id }],
        },
      });
    });

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

      it("successfully updates a company", async () => {
        const response = await api.post(
          `/store/companies/${company1.id}`,
          {
            name: "Updated Company",
            email: "updated@company.com",
            phone: "0987654321",
            address: "456 Updated Ave",
            city: "Updated City",
            state: "Updated State",
            zip: "54321",
            country: "Updated Country",
            logo_url: "http://updated.com/logo.png",
            currency_code: "EUR",
            spending_limit_reset_frequency: "yearly",
          },
          storeHeaders
        );

        expect(response.data.company).toMatchObject({
          id: company1.id,
          name: "Updated Company",
          email: "updated@company.com",
          phone: "0987654321",
          address: "456 Updated Ave",
          city: "Updated City",
          state: "Updated State",
          zip: "54321",
          country: "Updated Country",
          logo_url: "http://updated.com/logo.png",
          currency_code: "EUR",
        });
      });

      it("should throw an error when company does not exist", async () => {
        const { response } = await api
          .post(
            `/store/companies/does-not-exist`,
            { name: "Nonexistent Company" },
            storeHeaders
          )
          .catch((e) => e);

        expect(response.data).toMatchObject({
          type: "not_found",
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

        expect(response.status).toEqual(204);
      });
    });

    describe("Business Central customer number", () => {
      it("TC-1: creates company with numeric business_central_customer_number", async () => {
        const response = await api.post(
          "/store/companies",
          {
            name: "BC Company",
            email: "bc@company.com",
            currency_code: "USD",
            business_central_customer_number: "123456",
          },
          storeHeaders
        );

        expect(response.status).toEqual(200);
        expect(response.data.companies[0]).toMatchObject({
          business_central_customer_number: "123456",
        });
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

      it("TC-3: updates company with numeric business_central_customer_number", async () => {
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

        const updateResponse = await api.post(
          `/store/companies/${company.id}`,
          { business_central_customer_number: "98765" },
          storeHeaders
        );

        expect(updateResponse.status).toEqual(200);
        expect(updateResponse.data.company).toMatchObject({
          business_central_customer_number: "98765",
        });
      });

      it("TC-4: rejects non-numeric business_central_customer_number on update", async () => {
        const createResponse = await api.post(
          "/store/companies",
          {
            name: "BC Company",
            email: "bc@company.com",
            currency_code: "USD",
            business_central_customer_number: "11111",
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

        expect(response.status).toEqual(400);

        const getResponse = await api.get(
          `/store/companies/${company.id}`,
          storeHeaders
        );
        expect(getResponse.data.company.business_central_customer_number).toEqual(
          "11111"
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
        const updateResponse = await api.post(
          `/store/companies/${company.id}`,
          { name: "No BC Company Updated" },
          storeHeaders
        );

        expect(updateResponse.status).toEqual(200);
        expect(
          updateResponse.data.company.business_central_customer_number
        ).toBeNull();
      });
    });
  },
});
