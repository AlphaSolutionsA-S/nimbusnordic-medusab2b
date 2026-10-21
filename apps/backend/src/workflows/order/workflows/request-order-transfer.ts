import { requestOrderTransferWorkflow } from "@medusajs/core-flows";
import type { OrderWorkflow } from "@medusajs/framework/types";
import { createWorkflow } from "@medusajs/framework/workflows-sdk";
import { validateOrderTransferableStep } from "../steps/validate-order-transferable";

/**
 * Core's request-transfer workflow behind a refusal of account-owned orders (NIMBUS-177). Core's
 * workflow defines no hook, so it runs as a step after the check.
 */
export const requestTransferableOrderTransferWorkflow = createWorkflow(
  "request-transferable-order-transfer",
  function (input: OrderWorkflow.RequestOrderTransferWorkflowInput) {
    validateOrderTransferableStep({ order_id: input.order_id });
    requestOrderTransferWorkflow.runAsStep({ input });
  },
);
