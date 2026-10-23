import { createWorkflow, WorkflowResponse } from "@medusajs/framework/workflows-sdk";
import { reopenShipmentTrackingStep, type ReopenShipmentTrackingInput } from "../steps/reopen-shipment-tracking";
import { validateShipmentTrackingCompanyStep } from "../steps/validate-shipment-tracking-company";

export const reopenShipmentTrackingWorkflow = createWorkflow(
  "reopen-shipment-tracking",
  function (input: ReopenShipmentTrackingInput) {
    validateShipmentTrackingCompanyStep({ id: input.id });
    return new WorkflowResponse(reopenShipmentTrackingStep(input));
  }
);
