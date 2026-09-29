import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import { Modules } from "@medusajs/framework/utils";
import type { IOrderModuleService, OrderDTO } from "@medusajs/framework/types";
import type { CanonicalOrder } from "../../../modules/order-ingestion/canonical-order-schema";
import {
  BC_INTEGRATION_STATE_METADATA_KEY,
  createInitialBcIntegrationState,
} from "../../../modules/order-ingestion/bc-integration-state";
import { mapCanonicalOrderHeader } from "../utils/map-canonical-order-header";

export type CreateIngestedOrderInput = {
  companyId: string;
  canonicalOrder: CanonicalOrder;
};

export const createIngestedOrderStep = createStep(
  "create-ingested-order",
  async (
    input: CreateIngestedOrderInput,
    { container }
  ): Promise<StepResponse<OrderDTO, string>> => {
    const orderModuleService = container.resolve<IOrderModuleService>(
      Modules.ORDER
    );

    // Header-only order: no items are created (Medusa has no product catalog behind these
    // order lines). Mapped header fields (currency, email, addresses, phone) become native
    // columns. The full canonical payload (including `lines`) is retained in metadata for
    // the Business Central line-building to consume, `order_ingestion_state` starts the async
    // chain that continues after this workflow returns, and the Business Central integration
    // state starts at `pending`.
    const now = new Date().toISOString();

    const order = await orderModuleService.createOrders({
      ...mapCanonicalOrderHeader(input.canonicalOrder),
      metadata: {
        company_id: input.companyId,
        canonical_order: input.canonicalOrder,
        order_ingestion_state: "created",
        order_ingestion_state_updated_at: now,
        [BC_INTEGRATION_STATE_METADATA_KEY]:
          createInitialBcIntegrationState(now),
      },
    });

    return new StepResponse(order, order.id);
  },
  async (orderId, { container }) => {
    if (!orderId) {
      return;
    }

    const orderModuleService = container.resolve<IOrderModuleService>(
      Modules.ORDER
    );

    await orderModuleService.deleteOrders(orderId);
  }
);
