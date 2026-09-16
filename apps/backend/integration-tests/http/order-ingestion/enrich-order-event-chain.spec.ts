import { medusaIntegrationTestRunner } from "@medusajs/test-utils";
import { Modules } from "@medusajs/framework/utils";
import type { IOrderModuleService, OrderDTO } from "@medusajs/framework/types";
import { createOrderFromCanonicalPayloadWorkflow } from "../../../src/workflows/order-ingestion/workflows/create-order-from-canonical-payload";
import { enrichOrderWorkflow } from "../../../src/workflows/order-ingestion/workflows/enrich-order";
import { emitOrderIngestionCreatedEventWorkflow } from "../../../src/workflows/order-ingestion/workflows/emit-order-ingestion-created-event";
import { COMPANY_MODULE } from "../../../src/modules/company";
import type { ICompanyModuleService } from "../../../src/types";
import { singleLineCanonicalOrder } from "../../../src/modules/order-ingestion/__fixtures__/canonical-order-fixtures";

jest.setTimeout(60 * 1000);

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

async function createTestOrder(
  container: any,
  customerNumber: string,
  externalOrderNumber: string
) {
  const companyService =
    container.resolve<ICompanyModuleService>(COMPANY_MODULE);
  await companyService.createCompanies({
    name: `Company for ${customerNumber}`,
    email: `${customerNumber}@example.com`,
    business_central_customer_number: customerNumber,
  });

  const { result: order } = await createOrderFromCanonicalPayloadWorkflow(
    container
  ).run({
    input: {
      customer_number: customerNumber,
      canonicalOrder: { ...singleLineCanonicalOrder, externalOrderNumber },
    },
  });

  return order;
}

medusaIntegrationTestRunner({
  inApp: true,
  testSuite: ({ getContainer }) => {
    describe("order ingestion async event chain", () => {
      it("TC-1: enrichOrderWorkflow transitions order_ingestion_state to ready_for_business_central (happy path, direct workflow call)", async () => {
        const container = getContainer();
        const orderModuleService = container.resolve<IOrderModuleService>(
          Modules.ORDER
        );
        const order = await createTestOrder(
          container,
          "tc1-enrich-customer",
          "TC1-ENRICH-ORDER"
        );

        await enrichOrderWorkflow(container).run({
          input: { order_id: order.id },
        });

        const updatedOrder = await orderModuleService.retrieveOrder(order.id, {
          select: ["id", "metadata"],
        });
        expect(updatedOrder.metadata?.order_ingestion_state).toEqual(
          "ready_for_business_central"
        );
      });

      it("TC-2: emitting order_ingestion.order_created (as the route does) triggers the subscriber and the same transition, end to end", async () => {
        const container = getContainer();
        const orderModuleService = container.resolve<IOrderModuleService>(
          Modules.ORDER
        );
        const order = await createTestOrder(
          container,
          "tc2-event-customer",
          "TC2-EVENT-ORDER"
        );

        await emitOrderIngestionCreatedEventWorkflow(container).run({
          input: { order_id: order.id },
        });

        const finalOrder = await waitForOrderIngestionState(
          orderModuleService,
          order.id,
          "ready_for_business_central"
        );
        expect(finalOrder.id).toEqual(order.id);
      });

      it("TC-3: updateOrderIngestionStateStep handles an order with no pre-existing order_ingestion metadata gracefully (edge case: read-merge-write against sparse metadata)", async () => {
        const container = getContainer();
        const orderModuleService = container.resolve<IOrderModuleService>(
          Modules.ORDER
        );

        const order = await orderModuleService.createOrders({
          currency_code: "DKK",
        });

        await enrichOrderWorkflow(container).run({
          input: { order_id: order.id },
        });

        const updatedOrder = await orderModuleService.retrieveOrder(order.id, {
          select: ["id", "metadata"],
        });
        expect(updatedOrder.metadata?.order_ingestion_state).toEqual(
          "ready_for_business_central"
        );
      });
    });
  },
});
