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
    // IMPLEMENT: this is where further data mapping / enrichment onto the order's header
    // fields belongs — content intentionally not specified yet. Candidate work items to confirm
    // during implementation: mapping canonical billTo/shipTo onto the Order's real address
    // relations (verify the exact field shape in @medusajs/types before attempting), or any
    // other header-field mapping that turned out not to be needed for the synchronous response.
    // Add further steps here, before the state transition below, once the content is decided.
    // If it's a single mutation, it may be simpler to fold directly into
    // updateOrderIngestionStateStep's own metadata write instead of adding a new step.
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
