import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";
import { emitEventStep } from "@medusajs/medusa/core-flows";
import { updateOrderIngestionStateStep } from "../steps/update-order-ingestion-state";

export const READY_FOR_BUSINESS_CENTRAL_EVENT =
  "order_ingestion.ready_for_business_central";

export type EnrichOrderInput = {
  order_id: string;
};

export const enrichOrderWorkflow = createWorkflow(
  "enrich-order",
  function (input: EnrichOrderInput) {
    // Header fields (currency, email, shipping/billing address, phone) are mapped onto the order
    // at creation time — see createIngestedOrderStep. Add further enrichment steps here, before
    // the state transition below, if a later story needs them.
    const stateInput = transform({ input }, (data) => ({
      order_id: data.input.order_id,
      state: "ready_for_business_central",
    }));

    const updated = updateOrderIngestionStateStep(stateInput);

    emitEventStep({
      eventName: READY_FOR_BUSINESS_CENTRAL_EVENT,
      data: input,
    });

    return new WorkflowResponse(updated);
  }
);
