import { medusaIntegrationTestRunner } from "@medusajs/test-utils";
import { ApiKeyType, Modules } from "@medusajs/framework/utils";
import type {
  IApiKeyModuleService,
  IOrderModuleService,
  OrderDTO,
} from "@medusajs/framework/types";
import { COMPANY_MODULE } from "../../../src/modules/company";
import type { ICompanyModuleService } from "../../../src/types";
import { singleLineCanonicalOrder } from "../../../src/modules/order-ingestion/__fixtures__/canonical-order-fixtures";

jest.setTimeout(60 * 1000);

async function generateSecretApiKeyHeaders(container: any) {
  const apiKeyModule = container.resolve<IApiKeyModuleService>(Modules.API_KEY);
  const secretKey = await apiKeyModule.createApiKeys({
    title: `test orderapi secret key ${Date.now()}`,
    type: ApiKeyType.SECRET,
    created_by: "test",
  });

  return { headers: { authorization: `Basic ${secretKey.token}` } };
}

async function waitForOrderIngestionState(
  orderModuleService: IOrderModuleService,
  orderId: string,
  expectedState: string,
  timeoutMs = 5000
): Promise<OrderDTO> {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const order = await orderModuleService.retrieveOrder(orderId, {
      select: ["id", "metadata"],
    });
    if (order.metadata?.order_ingestion_state === expectedState) {
      return order;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  throw new Error(
    `Timed out waiting for order ${orderId} to reach order_ingestion_state="${expectedState}"`
  );
}

medusaIntegrationTestRunner({
  inApp: true,
  testSuite: ({ api, getContainer }) => {
    describe("POST /orderapi/orders", () => {
      it("TC-1: accepts a valid order for a known customer and returns 201 with the real order id (happy path)", async () => {
        const container = getContainer();
        const companyService =
          container.resolve<ICompanyModuleService>(COMPANY_MODULE);
        const secretHeaders = await generateSecretApiKeyHeaders(container);

        await companyService.createCompanies({
          name: "TC-1 HTTP Company",
          email: "tc1-http@example.com",
          business_central_customer_number: "tc1-http-customer",
        });

        const response = await api.post(
          "/orderapi/orders?customerNumber=tc1-http-customer",
          singleLineCanonicalOrder,
          secretHeaders
        );

        expect(response.status).toEqual(201);
        expect(response.data.order_id).toEqual(
          expect.stringMatching(/^order_/)
        );
        expect(typeof response.data.status).toEqual("string");
      });

      it("TC-2: rejects a request with a missing or invalid secret API key (auth enforcement)", async () => {
        await expect(
          api.post(
            "/orderapi/orders?customerNumber=whatever",
            singleLineCanonicalOrder
          )
        ).rejects.toMatchObject({ response: { status: 401 } });

        await expect(
          api.post(
            "/orderapi/orders?customerNumber=whatever",
            singleLineCanonicalOrder,
            {
              headers: { authorization: "Basic sk_not_a_real_key" },
            }
          )
        ).rejects.toMatchObject({ response: { status: 401 } });
      });

      it("TC-3: rejects a structurally invalid body missing a required canonical field", async () => {
        const container = getContainer();
        const secretHeaders = await generateSecretApiKeyHeaders(container);
        const { externalOrderNumber, ...invalidBody } = singleLineCanonicalOrder;

        await expect(
          api.post(
            "/orderapi/orders?customerNumber=whatever",
            invalidBody,
            secretHeaders
          )
        ).rejects.toMatchObject({ response: { status: 400 } });
      });

      it("TC-4: rejects a request missing the customerNumber query parameter", async () => {
        const container = getContainer();
        const secretHeaders = await generateSecretApiKeyHeaders(container);

        await expect(
          api.post(
            "/orderapi/orders",
            singleLineCanonicalOrder,
            secretHeaders
          )
        ).rejects.toMatchObject({ response: { status: 400 } });
      });

      it("TC-5: rejects a request for an unrecognized customerNumber with a 404, synchronously — no order is created", async () => {
        const container = getContainer();
        const secretHeaders = await generateSecretApiKeyHeaders(container);

        await expect(
          api.post(
            "/orderapi/orders?customerNumber=no-such-customer-http",
            {
              ...singleLineCanonicalOrder,
              externalOrderNumber: "UNKNOWN-CUSTOMER-HTTP-1",
            },
            secretHeaders
          )
        ).rejects.toMatchObject({ response: { status: 404 } });
      });

      it("TC-6: rejects a duplicate externalOrderNumber for the same company with a 422, synchronously", async () => {
        const container = getContainer();
        const companyService =
          container.resolve<ICompanyModuleService>(COMPANY_MODULE);
        const secretHeaders = await generateSecretApiKeyHeaders(container);

        await companyService.createCompanies({
          name: "TC-6 HTTP Company",
          email: "tc6-http@example.com",
          business_central_customer_number: "tc6-http-customer",
        });

        const payload = {
          ...singleLineCanonicalOrder,
          externalOrderNumber: "DUP-ORDER-HTTP-1",
        };

        const first = await api.post(
          "/orderapi/orders?customerNumber=tc6-http-customer",
          payload,
          secretHeaders
        );
        expect(first.status).toEqual(201);

        await expect(
          api.post(
            "/orderapi/orders?customerNumber=tc6-http-customer",
            payload,
            secretHeaders
          )
        ).rejects.toMatchObject({ response: { status: 422 } });
      });

      it("TC-7: the full pipeline eventually reaches ready_for_business_central after a successful POST (integration/wiring: route → sync order creation → fire-and-forget event → subscriber → enrich workflow)", async () => {
        const container = getContainer();
        const companyService =
          container.resolve<ICompanyModuleService>(COMPANY_MODULE);
        const orderModuleService = container.resolve<IOrderModuleService>(
          Modules.ORDER
        );
        const secretHeaders = await generateSecretApiKeyHeaders(container);

        await companyService.createCompanies({
          name: "TC-7 HTTP Company",
          email: "tc7-http@example.com",
          business_central_customer_number: "tc7-http-customer",
        });

        const response = await api.post(
          "/orderapi/orders?customerNumber=tc7-http-customer",
          {
            ...singleLineCanonicalOrder,
            externalOrderNumber: "EVENT-CHAIN-HTTP-1",
          },
          secretHeaders
        );

        expect(response.status).toEqual(201);

        const finalOrder = await waitForOrderIngestionState(
          orderModuleService,
          response.data.order_id,
          "ready_for_business_central"
        );
        expect(finalOrder.id).toEqual(response.data.order_id);
      });
    });
  },
});
