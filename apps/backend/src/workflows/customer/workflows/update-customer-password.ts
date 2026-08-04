import {
  createWorkflow,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";
import { updateCustomerPasswordStep } from "../steps/update-customer-password";

type WorkflowInput = {
  email: string;
  old_password: string;
  new_password: string;
};

export const updateCustomerPasswordWorkflow = createWorkflow(
  "update-customer-password",
  function (input: WorkflowInput) {
    const result = updateCustomerPasswordStep(input);

    return new WorkflowResponse(result);
  }
);
