import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import { Modules } from "@medusajs/framework/utils";
import type { IOrderModuleService } from "@medusajs/framework/types";

export type UpdateOrderIngestionStateInput = {
  order_id: string;
  state: string;
};

type UpdateOrderIngestionStateCompensationData = {
  order_id: string;
  previousState: unknown;
};

/*
  Transitions an order's `metadata.order_ingestion_state`. Note that `IOrderModuleService`'s
  `updateOrders` uses a two-argument (id, data) form — NOT the single-merged-object form used by
  custom MedusaService-generated modules. See src/workflows/order/steps/update-order.ts.
*/
export const updateOrderIngestionStateStep = createStep(
  "update-order-ingestion-state",
  async (
    input: UpdateOrderIngestionStateInput,
    { container }
  ): Promise<
    StepResponse<
      { order_id: string; state: string },
      UpdateOrderIngestionStateCompensationData
    >
  > => {
    const orderModuleService = container.resolve<IOrderModuleService>(
      Modules.ORDER
    );

    const [existingOrder] = await orderModuleService.listOrders(
      { id: input.order_id },
      { select: ["id", "metadata"] }
    );

    const previousMetadata = (existingOrder?.metadata ?? {}) as Record<
      string,
      unknown
    >;
    const previousState = previousMetadata.order_ingestion_state;

    // metadata is a single jsonb column — read-merge-write, or this update would silently wipe
    // out every other metadata key (including canonical_order and company_id).
    await orderModuleService.updateOrders(input.order_id, {
      metadata: {
        ...previousMetadata,
        order_ingestion_state: input.state,
        order_ingestion_state_updated_at: new Date().toISOString(),
      },
    });

    return new StepResponse(
      { order_id: input.order_id, state: input.state },
      { order_id: input.order_id, previousState }
    );
  },
  async (compensationData, { container }) => {
    if (!compensationData) {
      return;
    }

    const orderModuleService = container.resolve<IOrderModuleService>(
      Modules.ORDER
    );
    const [existingOrder] = await orderModuleService.listOrders(
      { id: compensationData.order_id },
      { select: ["id", "metadata"] }
    );
    const currentMetadata = (existingOrder?.metadata ?? {}) as Record<
      string,
      unknown
    >;

    await orderModuleService.updateOrders(compensationData.order_id, {
      metadata: {
        ...currentMetadata,
        order_ingestion_state: compensationData.previousState,
      },
    });
  }
);
