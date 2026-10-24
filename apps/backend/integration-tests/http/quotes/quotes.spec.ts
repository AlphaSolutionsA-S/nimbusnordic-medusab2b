import { medusaIntegrationTestRunner } from "@medusajs/test-utils";
import type { ICustomerModuleService } from "@medusajs/framework/types";
import { Modules } from "@medusajs/framework/utils";
import type CompanyModuleService from "../../../src/modules/company/service";
import type QuoteModuleService from "../../../src/modules/quote/service";
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
  env: {},
  testSuite: ({ api, getContainer }) => {
    let storeHeaders, cart, product, salesChannel, region, customerToken;
    let customerId: string;
    let staffId: string;

    beforeEach(async () => {
      const container = getContainer();
      staffId = (await createAdminUser(adminHeaders, container)).user.id;
      const publishableKey = await generatePublishableKey(container);
      storeHeaders = generateStoreHeaders({ publishableKey });
      const res = await createStoreUser({ api, storeHeaders });
      customerToken = res.token;
      customerId = res.customer.id;
      storeHeaders.headers["Authorization"] = `Bearer ${customerToken}`;
      await container.resolve<ICustomerModuleService>(Modules.CUSTOMER).updateCustomers(customerId, {
        first_name: "Quote", last_name: "Customer", phone: "12345678",
      });
      const company = (await api.post("/store/companies", {
        name: "Quote company", email: "quote-company@example.test", currency_code: "usd",
      }, storeHeaders)).data.companies[0];
      const companies = container.resolve<CompanyModuleService>("company");
      const [employee] = await companies.listEmployees({ company_id: company.id });
      await companies.updateEmployees({ id: employee.id, spending_limit: 1000 });
      region = await regionSeeder({ api, adminHeaders, data: { countries: ["us"] } });

      salesChannel = await salesChannelSeeder({
        api,
        adminHeaders,
        data: {},
      });

      product = await productSeeder({
        api,
        adminHeaders,
        data: {},
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
      expect(published.data.product.sales_channels).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: salesChannel.id })])
      );

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

    it("retains contact, spending, message references and numeric quote detail and preview data", async () => {
      const created = await api.post("/store/quotes", { cart_id: cart.id }, storeHeaders);
      expect(created.status).toBe(200);
      const id = created.data.quote.id;
      const itemId = created.data.quote.draft_order.items[0].id;
      const messages = await getContainer().resolve<QuoteModuleService>("quote").createMessages([
        { quote_id: id, admin_id: staffId, text: "Staff item response", item_id: itemId },
        { quote_id: id, customer_id: customerId, text: "Customer request" },
      ]);
      const posted = await api.post(`/store/quotes/${id}/messages`, {
        text: "Customer item request", item_id: itemId,
      }, storeHeaders);
      expect(posted.status).toBe(200);

      const detail = await api.get(`/store/quotes/${id}`, storeHeaders);
      const list = await api.get("/store/quotes?order=-created_at", storeHeaders);
      const preview = await api.get(`/store/quotes/${id}/preview`, storeHeaders);
      expect([detail.status, list.status, preview.status]).toEqual([200, 200, 200]);
      for (const quote of [posted.data.quote, detail.data.quote, list.data.quotes[0], preview.data.quote]) {
        expect(quote).toEqual(expect.objectContaining({
          id, draft_order_id: expect.any(String),
          customer: expect.objectContaining({
            id: customerId, email: "test@email.com", phone: "12345678", first_name: "Quote", last_name: "Customer",
            employee: expect.objectContaining({ spending_limit: 1000, is_admin: true, company: { name: "Quote company" } }),
          }),
          draft_order: expect.objectContaining({
            display_id: expect.any(Number), currency_code: "usd",
            total: expect.any(Number), subtotal: expect.any(Number), tax_total: expect.any(Number),
            discount_total: expect.any(Number), shipping_total: expect.any(Number),
            summary: expect.objectContaining({ current_order_total: expect.any(Number), pending_difference: expect.any(Number) }),
            items: [expect.objectContaining({
              id: itemId, quantity: expect.any(Number), unit_price: expect.any(Number),
              total: expect.any(Number), subtotal: expect.any(Number),
              variant: expect.objectContaining({ id: product.variants[0].id, product: expect.objectContaining({ id: product.id }) }),
              detail: expect.objectContaining({ fulfilled_quantity: expect.any(Number) }),
            })],
          }),
          messages: expect.arrayContaining([
            expect.objectContaining({ id: messages[0].id, text: "Staff item response", item_id: itemId, admin_id: staffId,
              admin: { first_name: "Admin", last_name: "User" }, created_at: expect.any(String) }),
            expect.objectContaining({ id: messages[1].id, text: "Customer request", customer_id: customerId,
              customer: { first_name: "Quote", last_name: "Customer" } }),
            expect.objectContaining({ id: expect.any(String), text: "Customer item request", item_id: itemId, customer_id: customerId }),
          ]),
        }));
      }
      expect(preview.data.quote.order_preview).toEqual(expect.objectContaining({
        total: expect.any(Number), subtotal: expect.any(Number), tax_total: expect.any(Number),
        discount_total: expect.any(Number), shipping_total: expect.any(Number),
        items: [expect.objectContaining({
          id: itemId, quantity: expect.any(Number), unit_price: expect.any(Number), total: expect.any(Number),
          variant_sku: expect.any(String), product_title: expect.any(String),
          detail: expect.objectContaining({ fulfilled_quantity: expect.any(Number) }),
        })],
      }));
    });

    describe("POST /store/quotes", () => {
      it("successfully initiates a quote with a draft order", async () => {
        const response = await api.post(
          "/store/quotes",
          { cart_id: cart.id },
          storeHeaders
        );

        const draftOrder = response.data.quote.draft_order;

        expect(response.status).toEqual(200);
        expect(response.data.quote).toEqual(
          expect.objectContaining({
            id: expect.any(String),
            cart_id: cart.id,
            draft_order_id: expect.any(String),
            draft_order: expect.objectContaining({
              status: "draft",
              version: 1,
              items: [
                expect.objectContaining({
                  quantity: cart.items[0].quantity,
                  unit_price: cart.items[0].unit_price,
                }),
              ],
              summary: expect.objectContaining({
                paid_total: 0,
                difference_sum: 0,
                refunded_total: 0,
                transaction_total: 0,
                pending_difference: 100,
                current_order_total: 100,
                original_order_total: 100,
              }),
            }),
            order_change: expect.objectContaining({
              actions: [],
            }),
          })
        );
      });
    });

    describe("GET /store/quotes/:id", () => {
      it("successfully retrieves a quote", async () => {
        const {
          data: { quote: newQuote },
        } = await api.post("/store/quotes", { cart_id: cart.id }, storeHeaders);

        const {
          data: { quote },
        } = await api.get(`/store/quotes/${newQuote.id}`, storeHeaders);

        expect(quote).toEqual(
          expect.objectContaining({
            id: expect.any(String),
            cart: expect.objectContaining({
              id: cart.id,
            }),
            draft_order: expect.objectContaining({
              id: newQuote.draft_order_id,
            }),
          })
        );
      });

      it("should throw error when quote does not exist", async () => {
        const {
          response: { data },
        } = await api
          .get(`/store/quotes/does-not-exist`, storeHeaders)
          .catch((e) => e);

        expect(data).toEqual({
          type: "not_found",
          message: "Quote id not found: does-not-exist",
        });
      });
    });

    describe("GET /store/quotes", () => {
      let cart2;

      beforeEach(async () => {
        cart2 = await cartSeeder({
          api,
          storeHeaders,
          data: {
            region_id: region.id,
            sales_channel_id: salesChannel.id,
            items: [{ quantity: 1, variant_id: product.variants[0].id }],
          },
        });
      });

      it("successfully retrieves all quote for a customer", async () => {
        const {
          data: { quote: quote1 },
        } = await api.post("/store/quotes", { cart_id: cart.id }, storeHeaders);

        const {
          data: { quote: quote2 },
        } = await api.post(
          "/store/quotes",
          { cart_id: cart2.id },
          storeHeaders
        );

        const {
          data: { quotes },
        } = await api.get(`/store/quotes`, storeHeaders);

        expect(quotes).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              id: quote1.id,
              cart: expect.objectContaining({
                id: cart.id,
              }),
              draft_order: expect.objectContaining({
                id: quote1.draft_order_id,
              }),
            }),
            expect.objectContaining({
              id: quote2.id,
              cart: expect.objectContaining({
                id: cart2.id,
              }),
              draft_order: expect.objectContaining({
                id: quote2.draft_order_id,
              }),
            }),
          ])
        );
      });
    });

    describe("POST /store/quotes/:id/accept", () => {
      let quote1;

      beforeEach(async () => {
        const {
          data: { quote: newQuote },
        } = await api.post("/store/quotes", { cart_id: cart.id }, storeHeaders);

        quote1 = newQuote;
      });

      it("successfully accepts a quote", async () => {
        await api.post(`/admin/quotes/${quote1.id}/send`, {}, adminHeaders);

        const {
          data: { quote },
        } = await api.post(
          `/store/quotes/${quote1.id}/accept?fields=+draft_order.is_draft_order,+draft_order.status`,
          {},
          storeHeaders
        );

        expect(quote).toEqual(
          expect.objectContaining({
            id: quote1.id,
            draft_order: expect.objectContaining({
              id: quote1.draft_order_id,
              status: "pending",
              is_draft_order: false,
              summary: expect.objectContaining({
                pending_difference: 100,
              }),
              payment_collections: [
                expect.objectContaining({
                  amount: 100,
                }),
              ],
            }),
          })
        );
      });

      it("should throw an error when quote is already accepted", async () => {
        await api.post(`/admin/quotes/${quote1.id}/send`, {}, adminHeaders);

        await api.post(`/store/quotes/${quote1.id}/accept`, {}, storeHeaders);

        const { response } = await api
          .post(`/store/quotes/${quote1.id}/accept`, {}, storeHeaders)
          .catch((e) => e);

        expect(response.data).toEqual({
          type: "invalid_data",
          message: "Cannot accept quote when quote status is accepted",
        });
      });
    });

    describe("POST /store/quotes/:id/reject", () => {
      let quote1;

      beforeEach(async () => {
        const {
          data: { quote: newQuote },
        } = await api.post("/store/quotes", { cart_id: cart.id }, storeHeaders);

        quote1 = newQuote;
      });

      it("successfully rejects a quote", async () => {
        await api.post(`/admin/quotes/${quote1.id}/send`, {}, adminHeaders);

        const {
          data: { quote },
        } = await api.post(
          `/store/quotes/${quote1.id}/reject?fields=+draft_order.status`,
          {},
          storeHeaders
        );

        expect(quote).toEqual(
          expect.objectContaining({
            id: quote1.id,
            status: "customer_rejected",
          })
        );
      });
    });
  },
});
