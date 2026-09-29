import { createWorkflow, WorkflowResponse } from "@medusajs/framework/workflows-sdk";
import { acquireLockStep, releaseLockStep, useRemoteQueryStep } from "@medusajs/core-flows";
import { ModuleUpdateApproval } from "../../../types";
import { updateApprovalStatusStep, updateApprovalStep } from "../steps";

export const updateApprovalsWorkflow = createWorkflow(
  "update-approvals",
  function (input: ModuleUpdateApproval) {
    const approval = useRemoteQueryStep({
      entry_point: "approval",
      fields: ["cart_id"],
      variables: { id: input.id },
      list: false,
      throw_if_key_not_found: true,
    });
    acquireLockStep({ key: approval.cart_id, timeout: 2, ttl: 30 });
    const updatedApproval = updateApprovalStep(input);

    updateApprovalStatusStep(updatedApproval);

    releaseLockStep({ key: approval.cart_id });

    return new WorkflowResponse(updatedApproval);
  }
);
