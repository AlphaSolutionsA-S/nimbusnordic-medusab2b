import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import { ORDER_INGESTION_MODULE } from "../../../modules/order-ingestion";
import type OrderIngestionModuleService from "../../../modules/order-ingestion/service";

export type ReopenShipmentTrackingInput = { id: string; actor_id: string };

export const reopenShipmentTrackingStep = createStep(
  "reopen-shipment-tracking",
  async (input: ReopenShipmentTrackingInput, { container }) => {
    const service: OrderIngestionModuleService = container.resolve(ORDER_INGESTION_MODULE);
    return new StepResponse(await service.reopenShipmentTracking(input.id, input.actor_id));
  }
);
