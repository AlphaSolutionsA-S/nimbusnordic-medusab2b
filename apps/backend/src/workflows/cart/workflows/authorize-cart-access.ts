import { createWorkflow, WorkflowResponse } from "@medusajs/framework/workflows-sdk";
import { validateCartAccessStep, type CartAccessInput } from "../steps/validate-cart-access";

export const authorizeCartAccessWorkflow = createWorkflow(
  "authorize-cart-access",
  function (input: CartAccessInput) {
    return new WorkflowResponse(validateCartAccessStep(input));
  },
);
