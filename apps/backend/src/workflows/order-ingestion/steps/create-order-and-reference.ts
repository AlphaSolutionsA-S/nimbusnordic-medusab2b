import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import type { IOrderModuleService, OrderDTO } from "@medusajs/framework/types";
import { COMPANY_MODULE } from "../../../modules/company";
import { ORDER_INGESTION_MODULE } from "../../../modules/order-ingestion";
import OrderIngestionModuleService from "../../../modules/order-ingestion/service";
import type { CanonicalOrder } from "../../../modules/order-ingestion/canonical-order-schema";

export type CreateOrderAndReferenceInput = {
  companyId: string;
  canonicalOrder: CanonicalOrder;
};

type CreateOrderAndReferenceCompensationData = {
  orderId: string;
  referenceId: string;
};

export const createOrderAndReferenceStep = createStep(
  "create-order-and-reference",
  async (
    input: CreateOrderAndReferenceInput,
    { container }
  ): Promise<
    StepResponse<OrderDTO, CreateOrderAndReferenceCompensationData>
  > => {
    const orderModuleService = container.resolve<IOrderModuleService>(
      Modules.ORDER
    );
    const remoteLink = container.resolve(ContainerRegistrationKeys.LINK);
    const orderIngestionService =
      container.resolve<OrderIngestionModuleService>(ORDER_INGESTION_MODULE);

    // Header-only order: no items are created (Medusa has no product catalog behind these
    // order lines). The full canonical payload (including `lines`) is retained in metadata for
    // the future Business Central line-building to consume, and `order_ingestion_state` starts
    // the async chain that continues after this workflow returns.
    const order = await orderModuleService.createOrders({
      currency_code: input.canonicalOrder.currencyCode,
      email: input.canonicalOrder.email,
      metadata: {
        company_id: input.companyId,
        canonical_order: input.canonicalOrder,
        order_ingestion_state: "created",
        order_ingestion_state_updated_at: new Date().toISOString(),
      },
    });

    // Replicates src/workflows/hooks/order-created.ts's link-creation logic directly — that
    // hook only fires for createOrderWorkflow, which this step deliberately does not use.
    await remoteLink.create({
      [Modules.ORDER]: {
        order_id: order.id,
      },
      [COMPANY_MODULE]: {
        company_id: input.companyId,
      },
    });

    const reference = await orderIngestionService.createOrderExternalReferences(
      {
        external_order_number: input.canonicalOrder.externalOrderNumber,
        company_id: input.companyId,
        order_id: order.id,
      }
    );

    return new StepResponse(order, {
      orderId: order.id,
      referenceId: reference.id,
    });
  },
  async (compensationData, { container }) => {
    if (!compensationData) {
      return;
    }

    const orderModuleService = container.resolve<IOrderModuleService>(
      Modules.ORDER
    );
    const remoteLink = container.resolve(ContainerRegistrationKeys.LINK);
    const orderIngestionService =
      container.resolve<OrderIngestionModuleService>(ORDER_INGESTION_MODULE);

    await orderIngestionService.deleteOrderExternalReferences(
      compensationData.referenceId
    );
    await remoteLink.dismiss({
      [Modules.ORDER]: {
        order_id: compensationData.orderId,
      },
    });
    await orderModuleService.deleteOrders(compensationData.orderId);
  }
);
