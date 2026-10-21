import { createWorkflow, WorkflowResponse } from "@medusajs/framework/workflows-sdk";
import { validateOrderAccessStep, type OrderAccessInput } from "../steps/validate-order-access";

export const authorizeOrderAccessWorkflow = createWorkflow(
  "authorize-order-access",
  function (input: OrderAccessInput) {
    return new WorkflowResponse(validateOrderAccessStep(input));
  },
);
