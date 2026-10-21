import { createWorkflow, WorkflowResponse } from "@medusajs/framework/workflows-sdk";
import {
  listCompanyApprovalCartsStep,
  type ListCompanyApprovalCartsInput,
} from "../steps/list-company-approval-carts";

export const listCompanyApprovalCartsWorkflow = createWorkflow(
  "list-company-approval-carts",
  function (input: ListCompanyApprovalCartsInput) {
    return new WorkflowResponse(listCompanyApprovalCartsStep(input));
  },
);
