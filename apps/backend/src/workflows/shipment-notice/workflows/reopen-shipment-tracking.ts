import { createWorkflow, WorkflowResponse } from "@medusajs/framework/workflows-sdk";
import { reopenShipmentTrackingStep, type ReopenShipmentTrackingInput } from "../steps/reopen-shipment-tracking";

export const reopenShipmentTrackingWorkflow = createWorkflow(
  "reopen-shipment-tracking",
  function (input: ReopenShipmentTrackingInput) {
    return new WorkflowResponse(reopenShipmentTrackingStep(input));
  }
);
