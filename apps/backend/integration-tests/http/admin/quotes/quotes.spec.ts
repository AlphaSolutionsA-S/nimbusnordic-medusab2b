import { medusaIntegrationTestRunner } from "@medusajs/test-utils";
import type QuoteModuleService from "../../../../src/modules/quote/service";
import {
  adminHeaders,
  createAdminUser,
  createStoreUser,
} from "../../../utils/admin";
import {
  cartSeeder,
  productSeeder,
  regionSeeder,
  salesChannelSeeder,
} from "../../../utils/seeder";
import {
  generatePublishableKey,
  generateStoreHeaders,
} from "../../../utils/store";

jest.setTimeout(60 * 1000);

medusaIntegrationTestRunner({
  inApp: true,
  env: {
    JWT_SECRET: "supersecret",
  },
  testSuite: ({ api, getContainer }) => {
    let storeHeaders, cart, product, salesChannel, region, customerToken;
    let adminUserId: string;

    beforeEach(async () => {
      const container = getContainer();
      adminUserId = (await createAdminUser(adminHeaders, container)).user.id;
      const publishableKey = await generatePublishableKey(container);
      storeHeaders = generateStoreHeaders({ publishableKey });
      const res = await createStoreUser({ api, storeHeaders });
      customerToken = res.token;
      storeHeaders.headers["Authorization"] = `Bearer ${customerToken}`;
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
      const published = await api.post(
        `/admin/products/${product.id}`,
        {
          status: "published",
          sales_channels: [{ id: salesChannel.id }],
        },
        adminHeaders
      );
      expect(published.status).toBe(200);
      expect(published.data.product.status).toBe("published");

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

    describe("POST /admin/quotes/:id/messages", () => {
      let quote1;

      beforeEach(async () => {
        const created = await api.post("/store/quotes", { cart_id: cart.id }, storeHeaders);
        expect(created.status).toBe(200);

        quote1 = created.data.quote;
      });

      it("successfully creates an admin quote message", async () => {
        const response = await api.post(
          `/admin/quotes/${quote1.id}/messages`,
          {
            text: "test message",
            item_id: cart.items[0].id,
          },
          adminHeaders
        );

        expect(response.status).toBe(200);
        expect(response.data.quote).toEqual(
          expect.objectContaining({
            id: quote1.id,
            messages: [
              expect.objectContaining({
                text: "test message",
                item_id: cart.items[0].id,
                admin_id: adminUserId,
                customer_id: null,
              }),
            ],
          })
        );
        const stored = await getContainer()
          .resolve<QuoteModuleService>("quote")
          .listMessages({ quote_id: quote1.id });
        expect(stored).toEqual([
          expect.objectContaining({
            text: "test message",
            item_id: cart.items[0].id,
            admin_id: adminUserId,
            customer_id: null,
          }),
        ]);
      });
    });
  },
});
