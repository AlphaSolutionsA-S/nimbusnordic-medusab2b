import {
  createWorkflow,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";
import { emitEventStep } from "@medusajs/medusa/core-flows";

export const ORDER_INGESTION_CREATED_EVENT = "order_ingestion.order_created";

export type EmitOrderIngestionCreatedEventInput = {
  order_id: string;
};

export const emitOrderIngestionCreatedEventWorkflow = createWorkflow(
  "emit-order-ingestion-created-event",
  function (input: EmitOrderIngestionCreatedEventInput) {
    emitEventStep({
      eventName: ORDER_INGESTION_CREATED_EVENT,
      data: input,
    });

    return new WorkflowResponse(input);
  }
);
